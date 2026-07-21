import { invoke, isTauri } from '@tauri-apps/api/core';
import type { ApiRequest, CookieRecord, Environment, HttpResponse, PreferredHttpVersion, StoredResponse, WorkspaceCertificates } from '../types';
import { applyAdvancedAuth } from './auth';
import { applyWorkspaceCertificates } from './certificates';
import { cookieHeaderForUrl } from './cookies';
import { buildHeaders, buildRequestUrl, environmentMap, mockResponse, resolveTemplate } from './request';
import { buildRequestFailureTimeline, buildResponseTimeline } from './timeline';
import { decodeHttpResponseBody, responseBodyFromBytes, responseCharset } from './responseBytes';
import { resolveCertificateValidation, resolveFollowRedirects, resolveProxyTransport, resolveRequestTimeout, type ProxyPreferences } from './transport';
import { applyDefaultUserAgentHeader } from './userAgent';
import { applyDefaultAcceptEncodingHeader, applyDefaultAcceptHeader } from './calculatedHeaders';
import { renderApiRequest, type RequestRenderContext } from './requestRender';
import { clearTemplatePromptValuesForRequest } from './templates';

export type NativeHttpResponse = HttpResponse & {
  headerLines?: Array<{ name: string; value: string }>;
  redirects?: Array<{ status: number; fromUrl: string; toUrl: string; elapsedMs: number }>;
  redirectsTruncated?: boolean;
  effectiveUrl?: string;
};

type NativeHttpError = {
  message: string;
  kind: string;
  elapsedMs: number;
  redirects?: Array<{ status: number; fromUrl: string; toUrl: string; elapsedMs: number }>;
  redirectsTruncated?: boolean;
};

const parseNativeHttpError = (value: unknown): NativeHttpError | undefined => {
  let candidate = value;
  if (typeof candidate === 'string' && candidate.startsWith('{')) {
    try { candidate = JSON.parse(candidate); } catch { return undefined; }
  }
  if (!candidate || typeof candidate !== 'object') return undefined;
  const source = candidate as Partial<NativeHttpError>;
  if (typeof source.message !== 'string' || typeof source.kind !== 'string' || typeof source.elapsedMs !== 'number' || !Number.isFinite(source.elapsedMs)) return undefined;
  return {
    message: source.message,
    kind: source.kind,
    elapsedMs: Math.max(0, Number(source.elapsedMs)),
    redirects: Array.isArray(source.redirects) ? source.redirects : [],
    redirectsTruncated: source.redirectsTruncated === true,
  };
};

export class HttpTransportError extends Error {
  readonly kind: string;
  readonly durationMs: number;
  readonly requestUrl: string;
  readonly timeline: NonNullable<HttpResponse['timeline']>;

  constructor(message: string, kind: string, durationMs: number, requestUrl: string, timeline: NonNullable<HttpResponse['timeline']>) {
    super(message);
    this.name = 'HttpTransportError';
    this.kind = kind;
    this.durationMs = durationMs;
    this.requestUrl = requestUrl;
    this.timeline = timeline;
  }
}

export type SendRequestContext = {
  cookies?: CookieRecord[];
  responses?: StoredResponse[];
  preferredHttpVersion?: PreferredHttpVersion;
  maxRedirects?: number;
  followRedirects?: boolean;
  requestTimeoutMs?: number;
  validateCertificates?: boolean;
  validateAuthCertificates?: boolean;
  proxy?: ProxyPreferences;
  certificates?: WorkspaceCertificates;
  maxTimelineDataSizeKB?: number;
  filterResponsesByEnv?: boolean;
  vault?: Record<string, string>;
  externalSecret?: (input: { provider: 'aws' | 'gcp' | 'azure' | 'hashicorp'; reference: string; scope?: string; field?: string; version?: string; credentialId?: string; appName?: string }) => Promise<string>;
  readFile?: (path: string) => Promise<string>;
  requestAncestors?: RequestRenderContext['requestAncestors'];
  prompt?: RequestRenderContext['prompt'];
  resolveResponse?: RequestRenderContext['resolveResponse'];
  requestChain?: RequestRenderContext['requestChain'];
  skipOAuth2Acquisition?: boolean;
  onOAuth2Token?: (request: ApiRequest) => void;
  authorizeOAuth2?: (request: ApiRequest, environment: Environment | undefined) => Promise<ApiRequest['auth']>;
  signal?: AbortSignal;
  cancellationId?: string;
  nativeHttpTransport?: {
    send: (input: unknown, cancellationId?: string) => Promise<NativeHttpResponse>;
  };
  pluginRuntime?: {
    beforeRequest: (request: ApiRequest) => Promise<ApiRequest>;
    afterResponse: (request: ApiRequest, response: HttpResponse) => Promise<HttpResponse>;
    templateTag: (name: string, args: string[], request: ApiRequest) => Promise<string | undefined>;
  };
};

const abortError = (signal: AbortSignal) => signal.reason instanceof Error ? signal.reason : new DOMException('Request canceled.', 'AbortError');
const throwIfAborted = (signal?: AbortSignal) => { if (signal?.aborted) throw abortError(signal); };
const abortableDelay = (milliseconds: number, signal?: AbortSignal) => new Promise<void>((resolve, reject) => {
  throwIfAborted(signal);
  const onAbort = () => { window.clearTimeout(timeout); reject(signal ? abortError(signal) : new DOMException('Request canceled.', 'AbortError')); };
  const timeout = window.setTimeout(() => { signal?.removeEventListener('abort', onAbort); resolve(); }, milliseconds);
  signal?.addEventListener('abort', onAbort, { once: true });
});

const serializeGraphqlBody = (request: ApiRequest, variablesSource: string) => {
  let parsedVariables: unknown = {};
  if (variablesSource.trim()) parsedVariables = JSON.parse(variablesSource.trim());
  return JSON.stringify({
    query: request.graphql.query,
    variables: parsedVariables,
    operationName: request.graphql.operationName || undefined,
  });
};

export const graphqlBody = (request: ApiRequest, variables: Record<string, string>) => serializeGraphqlBody(
  request,
  request.renderBodyTemplates !== false ? resolveTemplate(request.graphql.variables, variables) : request.graphql.variables,
);

const browserBody = (request: ApiRequest): BodyInit | undefined => {
  if (request.method === 'GET' || request.method === 'HEAD' || request.bodyMode === 'none') return undefined;
  if (request.protocol === 'graphql') return serializeGraphqlBody(request, request.graphql.variables);
  if (request.bodyMode === 'form-urlencoded') {
    return new URLSearchParams(request.formBody
      .filter((row) => row.enabled)
      .map((row) => [row.name, row.value]));
  }
  if (request.bodyMode === 'multipart') {
    const body = new FormData();
    request.multipartBody.filter((part) => part.enabled && Boolean(part.name || part.value || part.fileName || part.file?.fileName)).forEach((part) => {
      if (part.kind === 'file' && part.file) {
        const bytes = Uint8Array.from(atob(part.file.dataBase64), (character) => character.charCodeAt(0));
        body.append(part.name, new Blob([bytes], { type: part.contentType || part.file.mimeType }), part.fileName || part.file.fileName);
      } else {
        body.append(part.name, part.value);
      }
    });
    return body;
  }
  if (request.bodyMode === 'binary' && request.binaryBody) {
    return Uint8Array.from(atob(request.binaryBody.dataBase64), (character) => character.charCodeAt(0));
  }
  return request.body;
};

const signingBody = (request: ApiRequest, variables: Record<string, string>) => {
  if (request.protocol === 'graphql') return graphqlBody(request, variables);
  if (request.bodyMode === 'form-urlencoded') return new URLSearchParams(request.formBody.filter((field) => field.enabled).map((field) => [field.name, field.value])).toString();
  if (request.bodyMode === 'json' || request.bodyMode === 'text') return request.body;
  return '';
};

const nativeNetworkTimeline = (
  requestUrl: string,
  response: Pick<HttpResponse, 'durationMs' | 'httpVersion'>,
  validateCertificates: boolean,
  proxyMode: 'system' | 'custom' | 'disabled',
) => {
  const target = new URL(requestUrl);
  const port = target.port || (target.protocol === 'https:' ? '443' : '80');
  return [
    { value: `Connected to ${target.hostname}:${port}${response.httpVersion ? ` using ${response.httpVersion}` : ''}`, elapsedMs: response.durationMs },
    ...(target.protocol === 'https:' ? [{ value: `TLS certificate validation ${validateCertificates ? 'enabled' : 'disabled'}`, elapsedMs: response.durationMs }] : []),
    { value: proxyMode === 'custom' ? 'Native request used a configured proxy route' : proxyMode === 'system' ? 'Native request used system proxy resolution' : 'Native request bypassed proxy resolution', elapsedMs: response.durationMs },
  ];
};

export const sendRequest = async (request: ApiRequest, environment: Environment | undefined, context: SendRequestContext = {}): Promise<HttpResponse> => {
  throwIfAborted(context.signal);
  const variables = { ...environmentMap(environment), ...(context.vault ?? {}) };
  let hooked = context.pluginRuntime ? await context.pluginRuntime.beforeRequest(request) : request;
  if (!context.skipOAuth2Acquisition && hooked.auth.type === 'oauth2' && !hooked.auth.disabled) {
    const { acquireOAuth2TokenWithoutBrowser } = await import('./oauth2');
    const oauthContext = { ...context, nativeHttpTransport: undefined };
    const auth = await acquireOAuth2TokenWithoutBrowser(hooked, environment, { ...oauthContext, skipOAuth2Acquisition: true })
      ?? await context.authorizeOAuth2?.(hooked, environment);
    if (!auth) throw new Error('OAuth 2 browser authorization is required before this request can be sent.');
    if (auth !== hooked.auth) {
      hooked = { ...hooked, auth };
      context.onOAuth2Token?.(hooked);
    }
  }
  const renderContext = context;
  const prepared = await renderApiRequest(hooked, variables, {
    cookies: renderContext.cookies,
    responses: renderContext.responses,
    environmentId: environment?.id,
    customTag: renderContext.pluginRuntime ? (name, args) => renderContext.pluginRuntime!.templateTag(name, args, hooked) : undefined,
    externalSecret: renderContext.externalSecret,
    readFile: renderContext.readFile,
    requestAncestors: renderContext.requestAncestors,
    renderPurpose: 'send',
    prompt: renderContext.prompt,
    resolveResponse: renderContext.resolveResponse,
    requestChain: renderContext.requestChain,
  });
  throwIfAborted(context.signal);
  const followRedirects = resolveFollowRedirects(prepared.transport, context.followRedirects ?? true);
  const timeoutMs = resolveRequestTimeout(prepared.transport, context.requestTimeoutMs ?? 30_000);
  const validateCertificates = resolveCertificateValidation(prepared.transport, context.validateCertificates ?? true);
  const graphqlPayload = prepared.protocol === 'graphql' ? graphqlBody(prepared, variables) : undefined;
  const finish = async (response: HttpResponse) => {
    clearTemplatePromptValuesForRequest(request.id);
    return context.pluginRuntime ? context.pluginRuntime.afterResponse(prepared, response) : response;
  };
  let url = buildRequestUrl(prepared, variables);
  const proxy = resolveProxyTransport(prepared.transport, url, context.proxy);
  let headers = buildHeaders(prepared, variables);
  const contentType = (value: string) => value.toLowerCase() === 'content-type';
  if (prepared.protocol === 'graphql' && !headers.some((header) => header.enabled && contentType(header.name))) {
    headers = [...headers, { id: 'graphql-content-type', name: 'Content-Type', value: 'application/json', enabled: true }];
  }
  if (prepared.protocol === 'http' && (prepared.bodyMode === 'multipart' || prepared.bodyMode === 'form-urlencoded')) {
    headers = headers.filter((header) => !contentType(header.name));
  }
  if (prepared.protocol === 'http' && prepared.bodyMode === 'binary' && prepared.binaryBody?.mimeType && !headers.some((header) => header.enabled && contentType(header.name))) {
    headers = [...headers, { id: 'binary-content-type', name: 'Content-Type', value: prepared.binaryBody.mimeType, enabled: true }];
  }

  if (!prepared.auth.disabled && prepared.auth.type === 'api-key' && prepared.auth.apiKeyLocation === 'query' && prepared.auth.apiKeyName) {
    const parsedUrl = new URL(url);
    parsedUrl.searchParams.set(
      prepared.auth.apiKeyName,
      prepared.auth.apiKeyValue,
    );
    url = parsedUrl.toString();
  }
  if (prepared.transport.sendCookies) {
    const jar = cookieHeaderForUrl(context.cookies ?? [], url);
    if (jar) {
      const existing = headers.find((header) => header.enabled && header.name.toLowerCase() === 'cookie');
      headers = existing
        ? headers.map((header) => header === existing ? { ...header, value: [header.value, jar].filter(Boolean).join('; ') } : header)
        : [...headers, { id: 'cookie-jar', name: 'Cookie', value: jar, enabled: true }];
    }
  }
  const authenticated = await applyAdvancedAuth(prepared, variables, { url, headers, body: signingBody(prepared, variables) });
  url = authenticated.url;
  headers = authenticated.headers;
  const withTimeline = (response: HttpResponse, transport: Parameters<typeof buildResponseTimeline>[5] = {}): HttpResponse => {
    const output = { ...response, requestUrl: transport.effectiveUrl ?? url };
    return { ...output, timeline: buildResponseTimeline(prepared, url, output, context.maxTimelineDataSizeKB ?? 10, graphqlPayload, transport) };
  };

  throwIfAborted(context.signal);
  if (isTauri()) {
    headers = applyDefaultAcceptHeader(headers);
    headers = applyDefaultAcceptEncodingHeader(headers);
    headers = applyDefaultUserAgentHeader(headers, prepared.disableUserAgentHeader);
    const body = prepared.protocol === 'graphql'
      ? graphqlPayload!
      : prepared.body;
    const cancellationId = context.signal ? context.cancellationId ?? `http-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}` : undefined;
    const cancel = () => { if (cancellationId) void invoke('cancel_http_request', { cancellationId }).catch(() => undefined); };
    context.signal?.addEventListener('abort', cancel, { once: true });
    try {
      const input = {
        method: prepared.method,
        url,
        headers,
        bodyMode: prepared.protocol === 'graphql' ? 'json' : prepared.bodyMode,
        body,
        formBody: prepared.formBody,
        multipartBody: prepared.multipartBody,
        binaryBody: prepared.binaryBody,
        transport: applyWorkspaceCertificates({
          ...prepared.transport,
          followRedirects,
          timeoutMs,
          validateCertificates,
          ...proxy,
          preferredHttpVersion: context.preferredHttpVersion ?? 'default',
          maxRedirects: context.maxRedirects ?? 10,
        }, url, context.certificates),
        auth: {
          authType: prepared.auth.type,
          disabled: prepared.auth.disabled,
          username: prepared.auth.username,
          password: prepared.auth.password,
          ntlmDomain: prepared.auth.ntlmDomain,
          ntlmWorkstation: prepared.auth.ntlmWorkstation,
          netrc: prepared.auth.netrc,
        },
      };
      const output = context.nativeHttpTransport
        ? await context.nativeHttpTransport.send(input, cancellationId)
        : await invoke<NativeHttpResponse>('send_http_request', { cancellationId, input });
      const decoded = decodeHttpResponseBody(output);
      const { headerLines, redirects, redirectsTruncated, effectiveUrl, ...response } = decoded;
      return finish(withTimeline({ ...response, headerLines }, {
        requestHeaders: headers.filter((header) => header.enabled).map((header) => ({ name: header.name, value: header.value })),
        responseHeaders: headerLines,
        redirects,
        redirectsTruncated,
        effectiveUrl,
        networkText: nativeNetworkTimeline(effectiveUrl ?? url, response, validateCertificates, proxy.proxyMode),
      }));
    } catch (caught) {
      const failure = parseNativeHttpError(caught);
      if (!failure) throw caught;
      const transport = {
        requestHeaders: headers.filter((header) => header.enabled).map((header) => ({ name: header.name, value: header.value })),
        redirects: failure.redirects,
        redirectsTruncated: failure.redirectsTruncated,
      };
      throw new HttpTransportError(
        failure.message,
        failure.kind,
        failure.elapsedMs,
        url,
        buildRequestFailureTimeline(prepared, url, failure, context.maxTimelineDataSizeKB ?? 10, graphqlPayload, transport),
      );
    } finally {
      context.signal?.removeEventListener('abort', cancel);
    }
  }

  if (new URL(url).hostname === 'api.acme.dev') {
    await abortableDelay(380, context.signal);
    return finish(withTimeline(mockResponse()));
  }

  const startedAt = performance.now();
  const timeoutSignal = timeoutMs > 0 ? AbortSignal.timeout(timeoutMs) : undefined;
  const signal = context.signal && timeoutSignal ? AbortSignal.any([context.signal, timeoutSignal]) : context.signal ?? timeoutSignal;
  const response = await fetch(url, {
    method: prepared.method,
    headers: Object.fromEntries(headers.filter((header) => header.enabled).map((header) => [header.name, header.value])),
    body: browserBody(prepared),
    redirect: followRedirects ? 'follow' : 'manual',
    signal,
    credentials: prepared.transport.sendCookies ? 'include' : 'omit',
  });
  const bytes = new Uint8Array(await response.arrayBuffer());
  const responseHeaders = Object.fromEntries(response.headers.entries());
  const responseBody = responseBodyFromBytes(bytes, responseCharset(responseHeaders));
  return finish(withTimeline({
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
    ...responseBody,
    durationMs: Math.round(performance.now() - startedAt),
    sizeBytes: bytes.byteLength,
  }, {
    requestHeaders: headers.filter((header) => header.enabled).map((header) => ({ name: header.name, value: header.value })),
    responseHeaders: Object.entries(responseHeaders).map(([name, value]) => ({ name, value })),
    effectiveUrl: response.url,
  }));
};

export type OAuth2TokenResult = {
  accessToken: string;
  identityToken: string;
  refreshToken: string;
  tokenType: string;
  expiresAt: number;
  expiresIn?: number;
};

export class OAuth2TokenRequestError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, detail: string) {
    super(`OAuth 2 token request failed (${status}): ${detail}`);
    this.name = 'OAuth2TokenRequestError';
    this.status = status;
    this.code = code;
  }
}

export const fetchOAuth2Token = async (
  request: ApiRequest,
  environment: Environment | undefined,
  context: SendRequestContext = {},
): Promise<OAuth2TokenResult> => {
  const auth = request.auth;
  if (auth.oauth2GrantType === 'implicit') throw new Error('Implicit grants return through the authorization URL. Copy that URL and paste the resulting access token.');
  if (!auth.accessTokenUrl.trim()) throw new Error('Enter an access-token URL.');
  const fields: Array<[string, string]> = [['grant_type', auth.oauth2GrantType]];
  if (auth.oauth2GrantType === 'authorization_code') {
    if (!auth.code.trim()) throw new Error('Enter the authorization code returned by the provider.');
    fields.push(['code', auth.code], ['redirect_uri', auth.redirectUrl]);
    if (auth.usePkce) fields.push(['code_verifier', auth.codeVerifier]);
  } else if (auth.oauth2GrantType === 'password') {
    fields.push(['username', auth.username], ['password', auth.password]);
  } else if (auth.oauth2GrantType === 'refresh_token') {
    if (!auth.refreshToken.trim()) throw new Error('Enter a refresh token.');
    fields.push(['refresh_token', auth.refreshToken]);
  }
  if (auth.scope) fields.push(['scope', auth.scope]);
  if (auth.audience) fields.push(['audience', auth.audience]);
  if (auth.resource) fields.push(['resource', auth.resource]);
  if (auth.credentialsInBody) fields.push(['client_id', auth.clientId], ['client_secret', auth.clientSecret]);
  const tokenRequest: ApiRequest = {
    ...structuredClone(request),
    id: `${request.id}-oauth2-token`,
    name: `${request.name} OAuth 2 token`,
    protocol: 'http',
    method: 'POST',
    url: auth.accessTokenUrl,
    params: [],
    headers: [
      { id: 'oauth2-accept', name: 'Accept', value: 'application/x-www-form-urlencoded, application/json', enabled: true },
      ...(auth.origin && auth.oauth2GrantType !== 'refresh_token' ? [{ id: 'oauth2-origin', name: 'Origin', value: auth.origin, enabled: true }] : []),
    ],
    bodyMode: 'form-urlencoded',
    body: '',
    formBody: fields.filter(([, value]) => value !== '').map(([name, value], index) => ({ id: `oauth2-${index}`, name, value, enabled: true })),
    multipartBody: [],
    auth: { ...request.auth, type: auth.credentialsInBody ? 'none' : 'basic', username: auth.clientId, password: auth.clientSecret, disabled: false },
    transport: { ...request.transport, validateCertificatesMode: 'global' },
    preRequestScript: '',
    tests: '',
  };
  const response = await sendRequest(tokenRequest, environment, { ...context, validateCertificates: context.validateAuthCertificates ?? true });
  let payload: Record<string, unknown>;
  try { payload = JSON.parse(response.body) as Record<string, unknown>; }
  catch { payload = Object.fromEntries(new URLSearchParams(response.body).entries()); }
  if (response.status < 200 || response.status >= 300) {
    const code = String(payload.error ?? '');
    const detail = String(payload.error_description ?? (code || response.statusText));
    throw new OAuth2TokenRequestError(response.status, code, detail);
  }
  const accessToken = String(payload.access_token ?? '');
  if (!accessToken) throw new Error('The OAuth 2 response did not contain an access_token.');
  const expires = Number(payload.expires_in);
  const expiresIn = Number.isFinite(expires) && expires > 0 ? expires : undefined;
  return {
    accessToken,
    identityToken: String(payload.id_token ?? auth.identityToken ?? ''),
    refreshToken: String(payload.refresh_token ?? auth.refreshToken ?? ''),
    tokenType: String(payload.token_type ?? auth.tokenPrefix ?? 'Bearer'),
    expiresAt: expiresIn ? Date.now() + expiresIn * 1_000 : 0,
    expiresIn,
  };
};
