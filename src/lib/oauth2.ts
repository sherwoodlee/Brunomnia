import { Channel, invoke, isTauri } from '@tauri-apps/api/core';
import type { ApiRequest, AuthConfig, Environment } from '../types';
import { createOAuth2AuthorizationUrl, generateCodeVerifier, generateOAuth2State } from './auth';
import { fetchOAuth2Token, OAuth2TokenRequestError, type SendRequestContext } from './http';

export type OAuth2CallbackReady = {
  kind: 'ready';
  authorizationUrl: string;
  redirectUrl: string;
};

export type OAuth2CallbackOutput = {
  redirectUrl: string;
  parameters: Record<string, string>;
};

export type PreparedOAuth2Authorization = {
  authorizationUrl: string;
  expectedState: string;
  flowId: string;
  redirectUrl: string;
  request: ApiRequest;
  sourceAuth: AuthConfig;
};

export type AppliedOAuth2Callback = {
  auth: AuthConfig;
  expiresIn?: number;
};

export const canCaptureOAuth2Callback = () => isTauri();

export const createOAuth2FlowId = () => `oauth2-${crypto.randomUUID()}`;

export const prepareOAuth2Authorization = async (
  request: ApiRequest,
  variables: Record<string, string>,
  flowId = createOAuth2FlowId(),
): Promise<PreparedOAuth2Authorization> => {
  const grantType = request.auth.oauth2GrantType;
  if (grantType !== 'authorization_code' && grantType !== 'implicit') {
    throw new Error('This OAuth 2 grant does not use browser authorization.');
  }
  const auth: AuthConfig = {
    ...request.auth,
    state: request.auth.state.trim() || generateOAuth2State(),
    codeVerifier: request.auth.usePkce && !request.auth.codeVerifier.trim()
      ? generateCodeVerifier()
      : request.auth.codeVerifier,
    responseType: grantType === 'implicit' && request.auth.responseType === 'code'
      ? 'token'
      : request.auth.responseType,
  };
  const preparedRequest = { ...request, auth };
  const authorizationUrl = await createOAuth2AuthorizationUrl(preparedRequest, variables);
  const parsed = new URL(authorizationUrl);
  const expectedState = parsed.searchParams.get('state') ?? '';
  const redirectUrl = parsed.searchParams.get('redirect_uri') ?? '';
  if (!expectedState) throw new Error('OAuth state resolved to an empty value.');
  if (!redirectUrl) throw new Error('Enter an OAuth redirect URL.');
  return { authorizationUrl, expectedState, flowId, redirectUrl, request: preparedRequest, sourceAuth: { ...request.auth } };
};

const providerError = (parameters: Record<string, string>) => {
  if (!parameters.error) return '';
  const description = parameters.error_description || parameters.error;
  const uri = parameters.error_uri ? ` · ${parameters.error_uri}` : '';
  return `OAuth authorization failed: ${description}${uri}`;
};

export const applyOAuth2Callback = (
  auth: AuthConfig,
  callback: OAuth2CallbackOutput,
  expectedState: string,
): AppliedOAuth2Callback => {
  if (callback.parameters.state !== expectedState) {
    throw new Error('OAuth callback state did not match this authorization attempt.');
  }
  const error = providerError(callback.parameters);
  if (error) throw new Error(error);
  if (auth.oauth2GrantType === 'authorization_code') {
    const code = callback.parameters.code ?? '';
    if (!code) throw new Error('The OAuth callback did not contain an authorization code.');
    return { auth: { ...auth, code, redirectUrl: callback.redirectUrl } };
  }
  const accessToken = callback.parameters.access_token ?? '';
  const identityToken = callback.parameters.id_token ?? '';
  if (!accessToken && !identityToken) {
    throw new Error('The OAuth callback did not contain an access token or identity token.');
  }
  const expires = Number(callback.parameters.expires_in);
  const expiresIn = Number.isFinite(expires) && expires > 0 ? expires : undefined;
  return {
    auth: {
      ...auth,
      accessToken: accessToken || identityToken,
      identityToken,
      redirectUrl: callback.redirectUrl,
      expiresAt: expiresIn ? Date.now() + expiresIn * 1_000 : 0,
      tokenPrefix: callback.parameters.token_type || auth.tokenPrefix || 'Bearer',
    },
    expiresIn,
  };
};

export const oauth2TokenIsUsable = (auth: AuthConfig, now = Date.now()) => Boolean(
  auth.accessToken.trim() && (auth.expiresAt <= 0 || auth.expiresAt > now),
);

const tokenAuth = (auth: AuthConfig, token: Awaited<ReturnType<typeof fetchOAuth2Token>>): AuthConfig => ({
  ...auth,
  code: '',
  codeVerifier: '',
  accessToken: token.accessToken,
  identityToken: token.identityToken,
  refreshToken: token.refreshToken,
  expiresAt: token.expiresAt,
  tokenPrefix: token.tokenType,
});

export const acquireOAuth2TokenWithoutBrowser = async (
  request: ApiRequest,
  environment: Environment | undefined,
  context: SendRequestContext = {},
  forceRefresh = false,
): Promise<AuthConfig | undefined> => {
  const auth = request.auth;
  if (auth.type !== 'oauth2' || auth.disabled) return auth;
  if (!forceRefresh && oauth2TokenIsUsable(auth)) return auth;
  let grantType = auth.oauth2GrantType;
  if (auth.refreshToken.trim()) grantType = 'refresh_token';
  else if (grantType === 'implicit') return undefined;
  else if (grantType === 'authorization_code' && (auth.accessToken.trim() || !auth.code.trim())) return undefined;
  const exchangeRequest = { ...request, auth: { ...auth, oauth2GrantType: grantType } };
  try {
    return tokenAuth(auth, await fetchOAuth2Token(exchangeRequest, environment, context));
  } catch (error) {
    const refreshRejected = grantType === 'refresh_token'
      && error instanceof OAuth2TokenRequestError
      && (error.status === 401 || error.code === 'invalid_grant');
    if (!refreshRejected) throw error;
    if (auth.oauth2GrantType === 'authorization_code' || auth.oauth2GrantType === 'implicit') return undefined;
    if (auth.oauth2GrantType === 'client_credentials' || auth.oauth2GrantType === 'password') {
      const clearedAuth = { ...auth, accessToken: '', identityToken: '', refreshToken: '', expiresAt: 0 };
      return tokenAuth(clearedAuth, await fetchOAuth2Token({ ...request, auth: clearedAuth }, environment, context));
    }
    throw error;
  }
};

export const authorizeOAuth2 = async (
  prepared: PreparedOAuth2Authorization,
  onReady?: (event: OAuth2CallbackReady) => void,
): Promise<OAuth2CallbackOutput> => {
  if (!isTauri()) throw new Error('Automatic OAuth callbacks require the Tauri desktop app.');
  const channel = new Channel<OAuth2CallbackReady>();
  channel.onmessage = (event) => {
    if (event.kind === 'ready') onReady?.(event);
  };
  return invoke<OAuth2CallbackOutput>('oauth2_authorize', {
    input: {
      flowId: prepared.flowId,
      authorizationUrl: prepared.authorizationUrl,
      redirectUrl: prepared.redirectUrl,
    },
    onEvent: channel,
  });
};

export const completeOAuth2Authorization = async (
  prepared: PreparedOAuth2Authorization,
  environment: Environment | undefined,
  context: SendRequestContext = {},
  onReady?: (event: OAuth2CallbackReady) => void,
): Promise<AppliedOAuth2Callback> => {
  const callback = await authorizeOAuth2(prepared, onReady);
  const applied = applyOAuth2Callback(prepared.request.auth, callback, prepared.expectedState);
  const stableConfiguration = { redirectUrl: prepared.sourceAuth.redirectUrl, state: prepared.sourceAuth.state };
  if (applied.auth.oauth2GrantType !== 'authorization_code') {
    return { ...applied, auth: { ...applied.auth, ...stableConfiguration, code: '', codeVerifier: '' } };
  }
  const token = await fetchOAuth2Token({ ...prepared.request, auth: applied.auth }, environment, context);
  return { auth: { ...tokenAuth(applied.auth, token), ...stableConfiguration }, expiresIn: token.expiresIn };
};

export const cancelOAuth2Authorization = async (flowId: string) => {
  if (!isTauri()) return;
  await invoke('oauth2_cancel', { flowId });
};
