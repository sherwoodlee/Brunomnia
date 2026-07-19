import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBlankRequest } from '../data/seed';
import {
  applyOAuth2Callback,
  acquireOAuth2TokenWithoutBrowser,
  authorizeOAuth2,
  cancelOAuth2Authorization,
  completeOAuth2Authorization,
  prepareOAuth2Authorization,
  type OAuth2CallbackReady,
} from './oauth2';

const tauri = vi.hoisted(() => ({
  channels: [] as Array<{ onmessage?: (event: OAuth2CallbackReady) => void }>,
  invoke: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({
  Channel: class {
    onmessage?: (event: OAuth2CallbackReady) => void;
    constructor() { tauri.channels.push(this); }
  },
  invoke: tauri.invoke,
  isTauri: () => true,
}));

beforeEach(() => {
  tauri.channels.length = 0;
  tauri.invoke.mockReset();
});

const oauthRequest = () => {
  const request = createBlankRequest('oauth-callback');
  request.auth = {
    ...request.auth,
    type: 'oauth2',
    authorizationUrl: 'https://identity.example.test/authorize',
    accessTokenUrl: 'https://identity.example.test/token',
    clientId: 'client-1',
    redirectUrl: 'http://127.0.0.1/callback',
  };
  return request;
};

describe('OAuth 2 callback preparation', () => {
  it('generates state and a PKCE verifier without mutating the request', async () => {
    const request = oauthRequest();
    request.auth.usePkce = true;

    const prepared = await prepareOAuth2Authorization(request, {}, 'oauth2-fixed');
    const authorizationUrl = new URL(prepared.authorizationUrl);

    expect(prepared.flowId).toBe('oauth2-fixed');
    expect(prepared.expectedState).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(prepared.request.auth.codeVerifier).toMatch(/^[A-Za-z0-9_-]{60,}$/);
    expect(authorizationUrl.searchParams.get('state')).toBe(prepared.expectedState);
    expect(authorizationUrl.searchParams.get('code_challenge_method')).toBe('S256');
    expect(authorizationUrl.searchParams.get('response_type')).toBe('code');
    expect(request.auth.state).toBe('');
    expect(request.auth.codeVerifier).toBe('');
  });

  it('normalizes a legacy implicit response type to an access-token response', async () => {
    const request = oauthRequest();
    request.auth.oauth2GrantType = 'implicit';
    request.auth.responseType = 'code';

    const prepared = await prepareOAuth2Authorization(request, {}, 'oauth2-implicit');

    expect(prepared.request.auth.responseType).toBe('token');
    expect(new URL(prepared.authorizationUrl).searchParams.get('response_type')).toBe('token');
  });
});

describe('OAuth 2 callback results', () => {
  it('maps a checked authorization code and listener redirect URL', () => {
    const auth = oauthRequest().auth;
    const applied = applyOAuth2Callback(auth, {
      redirectUrl: 'http://127.0.0.1:49152/callback',
      parameters: { code: 'code-123', state: 'expected-state' },
    }, 'expected-state');

    expect(applied.auth).toMatchObject({ code: 'code-123', redirectUrl: 'http://127.0.0.1:49152/callback' });
  });

  it('stores implicit access and identity tokens with provider metadata', () => {
    const auth = oauthRequest().auth;
    auth.oauth2GrantType = 'implicit';
    const applied = applyOAuth2Callback(auth, {
      redirectUrl: 'http://127.0.0.1:49153/callback',
      parameters: {
        access_token: 'access-123',
        id_token: 'identity-123',
        token_type: 'DPoP',
        expires_in: '900',
        state: 'expected-state',
      },
    }, 'expected-state');

    expect(applied.auth).toMatchObject({ accessToken: 'access-123', identityToken: 'identity-123', tokenPrefix: 'DPoP' });
    expect(applied.expiresIn).toBe(900);
    expect(applied.auth.expiresAt).toBeGreaterThan(Date.now());
  });

  it('uses an ID token as the request token for ID-only implicit responses', () => {
    const auth = oauthRequest().auth;
    auth.oauth2GrantType = 'implicit';
    const applied = applyOAuth2Callback(auth, {
      redirectUrl: 'http://127.0.0.1:49153/callback',
      parameters: { id_token: 'identity-only', state: 'expected-state' },
    }, 'expected-state');
    expect(applied.auth).toMatchObject({ accessToken: 'identity-only', identityToken: 'identity-only' });
  });

  it('surfaces provider errors and rejects state mismatches', () => {
    const auth = oauthRequest().auth;
    expect(() => applyOAuth2Callback(auth, {
      redirectUrl: 'http://127.0.0.1/callback',
      parameters: { error: 'access_denied', error_description: 'The user declined.', state: 'expected' },
    }, 'expected')).toThrow('OAuth authorization failed: The user declined.');
    expect(() => applyOAuth2Callback(auth, {
      redirectUrl: 'http://127.0.0.1/callback',
      parameters: { code: 'code-123', state: 'unexpected' },
    }, 'expected')).toThrow('state did not match');
  });
});

describe('OAuth 2 token lifecycle', () => {
  it('keeps a current non-expiring token without network traffic', async () => {
    const request = oauthRequest();
    request.auth.accessToken = 'current-token';
    request.auth.expiresAt = 0;
    await expect(acquireOAuth2TokenWithoutBrowser(request, undefined)).resolves.toBe(request.auth);
    expect(tauri.invoke).not.toHaveBeenCalled();
  });

  it('refreshes an expired token and preserves refresh state', async () => {
    const request = oauthRequest();
    request.auth.accessToken = 'expired-token';
    request.auth.refreshToken = 'refresh-123';
    request.auth.expiresAt = Date.now() - 1;
    tauri.invoke.mockResolvedValue({
      status: 200,
      statusText: 'OK',
      headers: {},
      body: '{"access_token":"fresh-token","id_token":"fresh-identity","token_type":"DPoP","expires_in":120}',
      durationMs: 1,
      sizeBytes: 98,
      setCookies: [],
      httpVersion: 'HTTP/2.0',
    });

    const auth = await acquireOAuth2TokenWithoutBrowser(request, undefined);

    expect(auth).toMatchObject({ accessToken: 'fresh-token', identityToken: 'fresh-identity', refreshToken: 'refresh-123', tokenPrefix: 'DPoP' });
    expect(auth?.expiresAt).toBeGreaterThan(Date.now());
    expect(tauri.invoke).toHaveBeenCalledWith('send_http_request', expect.objectContaining({
      input: expect.objectContaining({
        formBody: expect.arrayContaining([
          expect.objectContaining({ name: 'grant_type', value: 'refresh_token' }),
          expect.objectContaining({ name: 'refresh_token', value: 'refresh-123' }),
        ]),
      }),
    }));
  });

  it('requires browser authorization when an interactive grant has no reusable credential', async () => {
    const request = oauthRequest();
    request.auth.code = '';
    await expect(acquireOAuth2TokenWithoutBrowser(request, undefined)).resolves.toBeUndefined();
    request.auth.oauth2GrantType = 'implicit';
    await expect(acquireOAuth2TokenWithoutBrowser(request, undefined)).resolves.toBeUndefined();
    expect(tauri.invoke).not.toHaveBeenCalled();
  });

  it('requests fresh browser authorization after an invalid refresh grant', async () => {
    const request = oauthRequest();
    request.auth.accessToken = 'expired-token';
    request.auth.refreshToken = 'rejected-refresh';
    request.auth.expiresAt = Date.now() - 1;
    tauri.invoke.mockResolvedValue({ status: 400, statusText: 'Bad Request', headers: {}, body: '{"error":"invalid_grant","error_description":"Refresh token expired"}', durationMs: 1, sizeBytes: 70, setCookies: [], httpVersion: 'HTTP/2.0' });

    await expect(acquireOAuth2TokenWithoutBrowser(request, undefined)).resolves.toBeUndefined();
  });

  it('retries a rejected refresh with the configured noninteractive grant', async () => {
    const request = oauthRequest();
    request.auth.oauth2GrantType = 'client_credentials';
    request.auth.accessToken = 'expired-token';
    request.auth.refreshToken = 'rejected-refresh';
    request.auth.expiresAt = Date.now() - 1;
    tauri.invoke
      .mockResolvedValueOnce({ status: 401, statusText: 'Unauthorized', headers: {}, body: '', durationMs: 1, sizeBytes: 0, setCookies: [], httpVersion: 'HTTP/2.0' })
      .mockResolvedValueOnce({ status: 200, statusText: 'OK', headers: {}, body: '{"access_token":"client-token"}', durationMs: 1, sizeBytes: 31, setCookies: [], httpVersion: 'HTTP/2.0' });

    const auth = await acquireOAuth2TokenWithoutBrowser(request, undefined);

    expect(auth).toMatchObject({ accessToken: 'client-token', refreshToken: '', expiresAt: 0 });
    const secondInput = tauri.invoke.mock.calls[1][1] as { input: { formBody: Array<{ name: string; value: string }> } };
    expect(secondInput.input.formBody).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'grant_type', value: 'client_credentials' })]));
  });
});

describe('OAuth 2 native bridge', () => {
  it('forwards readiness events and supports explicit cancellation', async () => {
    const prepared = await prepareOAuth2Authorization(oauthRequest(), {}, 'oauth2-channel');
    const onReady = vi.fn();
    tauri.invoke.mockImplementation(async (command: string, arguments_: Record<string, unknown>) => {
      if (command !== 'oauth2_authorize') return undefined;
      const channel = arguments_.onEvent as { onmessage?: (event: OAuth2CallbackReady) => void };
      channel.onmessage?.({
        kind: 'ready',
        authorizationUrl: prepared.authorizationUrl,
        redirectUrl: 'http://127.0.0.1:49154/callback',
      });
      return {
        redirectUrl: 'http://127.0.0.1:49154/callback',
        parameters: { code: 'code-123', state: prepared.expectedState },
      };
    });

    await expect(authorizeOAuth2(prepared, onReady)).resolves.toMatchObject({ parameters: { code: 'code-123' } });
    expect(onReady).toHaveBeenCalledWith(expect.objectContaining({ kind: 'ready', redirectUrl: 'http://127.0.0.1:49154/callback' }));
    expect(tauri.invoke).toHaveBeenCalledWith('oauth2_authorize', expect.objectContaining({
      input: expect.objectContaining({ flowId: 'oauth2-channel' }),
      onEvent: tauri.channels[0],
    }));

    await cancelOAuth2Authorization('oauth2-channel');
    expect(tauri.invoke).toHaveBeenLastCalledWith('oauth2_cancel', { flowId: 'oauth2-channel' });
  });

  it('completes authorization-code callbacks through token exchange', async () => {
    const prepared = await prepareOAuth2Authorization(oauthRequest(), {}, 'oauth2-complete');
    tauri.invoke.mockImplementation(async (command: string, arguments_: Record<string, unknown>) => {
      if (command === 'oauth2_authorize') {
        const channel = arguments_.onEvent as { onmessage?: (event: OAuth2CallbackReady) => void };
        channel.onmessage?.({ kind: 'ready', authorizationUrl: prepared.authorizationUrl, redirectUrl: 'http://127.0.0.1:49155/callback' });
        return { redirectUrl: 'http://127.0.0.1:49155/callback', parameters: { code: 'code-456', state: prepared.expectedState } };
      }
      if (command === 'send_http_request') {
        return { status: 200, statusText: 'OK', headers: {}, body: '{"access_token":"access-456","refresh_token":"refresh-456","id_token":"identity-456","expires_in":300}', durationMs: 1, sizeBytes: 111, setCookies: [], httpVersion: 'HTTP/2.0' };
      }
      return undefined;
    });

    const completed = await completeOAuth2Authorization(prepared, undefined);

    expect(completed.auth).toMatchObject({
      code: '',
      codeVerifier: '',
      redirectUrl: 'http://127.0.0.1/callback',
      accessToken: 'access-456',
      refreshToken: 'refresh-456',
      identityToken: 'identity-456',
    });
    expect(completed.expiresIn).toBe(300);
    expect(tauri.invoke).toHaveBeenCalledWith('send_http_request', expect.objectContaining({ input: expect.objectContaining({
      formBody: expect.arrayContaining([
        expect.objectContaining({ name: 'code', value: 'code-456' }),
        expect.objectContaining({ name: 'redirect_uri', value: 'http://127.0.0.1:49155/callback' }),
      ]),
    }) }));
  });
});
