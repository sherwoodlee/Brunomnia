import { invoke, isTauri } from '@tauri-apps/api/core';
import type { ApiRequest, CookieRecord, Environment, HttpResponse, PreferredHttpVersion, StoredResponse } from '../types';
import { applyAdvancedAuth } from './auth';
import { cookieHeaderForUrl } from './cookies';
import { buildHeaders, buildRequestUrl, environmentMap, mockResponse, resolveTemplate } from './request';
import { renderTemplate } from './templates';
import { buildResponseTimeline } from './timeline';
import { resolveFollowRedirects, resolveRequestTimeout } from './transport';

export type SendRequestContext = {
  cookies?: CookieRecord[];
  responses?: StoredResponse[];
  preferredHttpVersion?: PreferredHttpVersion;
  maxRedirects?: number;
  followRedirects?: boolean;
  requestTimeoutMs?: number;
  maxTimelineDataSizeKB?: number;
  filterResponsesByEnv?: boolean;
  vault?: Record<string, string>;
  externalSecret?: (input: { provider: 'aws' | 'gcp' | 'azure' | 'hashicorp'; reference: string; scope?: string; field?: string; version?: string }) => Promise<string>;
  pluginRuntime?: {
    beforeRequest: (request: ApiRequest) => Promise<ApiRequest>;
    afterResponse: (request: ApiRequest, response: HttpResponse) => Promise<HttpResponse>;
    templateTag: (name: string, args: string[], request: ApiRequest) => Promise<string | undefined>;
  };
};

export const graphqlBody = (request: ApiRequest, variables: Record<string, string>) => {
  let parsedVariables: unknown = {};
  const resolvedVariables = resolveTemplate(request.graphql.variables, variables).trim();
  if (resolvedVariables) parsedVariables = JSON.parse(resolvedVariables);
  return JSON.stringify({
    query: request.graphql.query,
    variables: parsedVariables,
    operationName: request.graphql.operationName || undefined,
  });
};

const browserBody = (request: ApiRequest, variables: Record<string, string>): BodyInit | undefined => {
  if (request.method === 'GET' || request.method === 'HEAD' || request.bodyMode === 'none') return undefined;
  if (request.protocol === 'graphql') return graphqlBody(request, variables);
  if (request.bodyMode === 'form-urlencoded') {
    return new URLSearchParams(request.formBody
      .filter((row) => row.enabled && row.name)
      .map((row) => [resolveTemplate(row.name, variables), resolveTemplate(row.value, variables)]));
  }
  if (request.bodyMode === 'multipart') {
    const body = new FormData();
    request.multipartBody.filter((part) => part.enabled && part.name).forEach((part) => {
      if (part.kind === 'file' && part.file) {
        const bytes = Uint8Array.from(atob(part.file.dataBase64), (character) => character.charCodeAt(0));
        body.append(part.name, new Blob([bytes], { type: part.contentType || part.file.mimeType }), part.fileName || part.file.fileName);
      } else {
        body.append(part.name, resolveTemplate(part.value, variables));
      }
    });
    return body;
  }
  if (request.bodyMode === 'binary' && request.binaryBody) {
    return Uint8Array.from(atob(request.binaryBody.dataBase64), (character) => character.charCodeAt(0));
  }
  return resolveTemplate(request.body, variables);
};

const renderRows = async (rows: ApiRequest['headers'], render: (value: string) => Promise<string>) => Promise.all(rows.map(async (row) => ({
  ...row,
  name: await render(row.name),
  value: await render(row.value),
})));

const renderRequest = async (request: ApiRequest, variables: Record<string, string>, context: SendRequestContext) => {
  const templateContext = {
    variables,
    cookies: context.cookies ?? [],
    responses: context.responses ?? [],
    request,
    customTag: context.pluginRuntime ? (name: string, args: string[]) => context.pluginRuntime!.templateTag(name, args, request) : undefined,
    externalSecret: context.externalSecret,
  };
  const render = (value: string) => renderTemplate(value, templateContext);
  const authEntries = await Promise.all(Object.entries(request.auth).map(async ([key, value]) => [key, typeof value === 'string' ? await render(value) : value]));
  return {
    ...request,
    name: await render(request.name),
    url: await render(request.url),
    pathParams: await renderRows(request.pathParams, render),
    params: await renderRows(request.params, render),
    headers: await renderRows(request.headers, render),
    body: await render(request.body),
    formBody: await renderRows(request.formBody, render),
    multipartBody: await Promise.all(request.multipartBody.map(async (part) => ({ ...part, name: await render(part.name), value: await render(part.value) }))),
    auth: Object.fromEntries(authEntries) as ApiRequest['auth'],
    graphql: { ...request.graphql, query: request.graphql.query, variables: await render(request.graphql.variables), operationName: request.graphql.operationName },
    grpc: { ...request.grpc, service: await render(request.grpc.service), method: await render(request.grpc.method), protoText: await render(request.grpc.protoText), input: await render(request.grpc.input), metadata: await renderRows(request.grpc.metadata, render) },
    transport: {
      ...request.transport,
      proxyUrl: await render(request.transport.proxyUrl),
      proxyExclusions: await render(request.transport.proxyExclusions),
      clientCertificateDomains: await render(request.transport.clientCertificateDomains),
    },
  };
};

const signingBody = (request: ApiRequest, variables: Record<string, string>) => {
  if (request.protocol === 'graphql') return graphqlBody(request, variables);
  if (request.bodyMode === 'form-urlencoded') return new URLSearchParams(request.formBody.filter((field) => field.enabled && field.name).map((field) => [field.name, field.value])).toString();
  if (request.bodyMode === 'json' || request.bodyMode === 'text') return request.body;
  return '';
};

export const sendRequest = async (request: ApiRequest, environment: Environment | undefined, context: SendRequestContext = {}): Promise<HttpResponse> => {
  const variables = { ...environmentMap(environment), ...(context.vault ?? {}) };
  const hooked = context.pluginRuntime ? await context.pluginRuntime.beforeRequest(request) : request;
  const renderContext = context.filterResponsesByEnv
    ? { ...context, responses: (context.responses ?? []).filter((response) => response.environmentId === environment?.id) }
    : context;
  const prepared = await renderRequest(hooked, variables, renderContext);
  const followRedirects = resolveFollowRedirects(prepared.transport, context.followRedirects ?? true);
  const timeoutMs = resolveRequestTimeout(prepared.transport, context.requestTimeoutMs ?? 30_000);
  const graphqlPayload = prepared.protocol === 'graphql' ? graphqlBody(prepared, variables) : undefined;
  const finish = async (response: HttpResponse) => context.pluginRuntime
    ? context.pluginRuntime.afterResponse(prepared, response)
    : response;
  let url = buildRequestUrl(prepared, variables);
  let headers = buildHeaders(prepared, variables);
  const contentType = (value: string) => value.toLowerCase() === 'content-type';
  if (prepared.protocol === 'graphql' && !headers.some((header) => header.enabled && contentType(header.name))) {
    headers = [...headers, { id: 'graphql-content-type', name: 'Content-Type', value: 'application/json', enabled: true }];
  }
  if (prepared.protocol === 'http' && (prepared.bodyMode === 'multipart' || prepared.bodyMode === 'form-urlencoded')) {
    headers = headers.filter((header) => !contentType(header.name));
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
  const withTimeline = (response: HttpResponse): HttpResponse => {
    const output = { ...response, requestUrl: url };
    return { ...output, timeline: buildResponseTimeline(prepared, url, output, context.maxTimelineDataSizeKB ?? 10, graphqlPayload) };
  };

  if (isTauri()) {
    const body = prepared.protocol === 'graphql'
      ? graphqlPayload!
      : prepared.body;
    const output = await invoke<HttpResponse>('send_http_request', {
      input: {
        method: prepared.method,
        url,
        headers,
        bodyMode: prepared.protocol === 'graphql' ? 'json' : prepared.bodyMode,
        body,
        formBody: prepared.formBody,
        multipartBody: prepared.multipartBody,
        binaryBody: prepared.binaryBody,
        transport: {
          ...prepared.transport,
          followRedirects,
          timeoutMs,
          preferredHttpVersion: context.preferredHttpVersion ?? 'default',
          maxRedirects: context.maxRedirects ?? 10,
        },
        auth: {
          authType: prepared.auth.type,
          disabled: prepared.auth.disabled,
          username: prepared.auth.username,
          password: prepared.auth.password,
          ntlmDomain: prepared.auth.ntlmDomain,
          ntlmWorkstation: prepared.auth.ntlmWorkstation,
          netrc: prepared.auth.netrc,
        },
      },
    });
    return finish(withTimeline(output));
  }

  if (new URL(url).hostname === 'api.acme.dev') {
    await new Promise((resolve) => window.setTimeout(resolve, 380));
    return finish(withTimeline(mockResponse()));
  }

  const startedAt = performance.now();
  const response = await fetch(url, {
    method: prepared.method,
    headers: Object.fromEntries(headers.filter((header) => header.enabled).map((header) => [header.name, header.value])),
    body: browserBody(prepared, variables),
    redirect: followRedirects ? 'follow' : 'manual',
    signal: timeoutMs > 0 ? AbortSignal.timeout(timeoutMs) : undefined,
    credentials: prepared.transport.sendCookies ? 'include' : 'omit',
  });
  const body = await response.text();
  return finish(withTimeline({
    status: response.status,
    statusText: response.statusText,
    headers: Object.fromEntries(response.headers.entries()),
    body,
    durationMs: Math.round(performance.now() - startedAt),
    sizeBytes: new Blob([body]).size,
  }));
};

export type OAuth2TokenResult = {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn?: number;
};

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
    headers: [{ id: 'oauth2-accept', name: 'Accept', value: 'application/json', enabled: true }],
    bodyMode: 'form-urlencoded',
    body: '',
    formBody: fields.filter(([, value]) => value !== '').map(([name, value], index) => ({ id: `oauth2-${index}`, name, value, enabled: true })),
    multipartBody: [],
    auth: { ...request.auth, type: auth.credentialsInBody ? 'none' : 'basic', username: auth.clientId, password: auth.clientSecret, disabled: false },
    preRequestScript: '',
    tests: '',
  };
  const response = await sendRequest(tokenRequest, environment, context);
  let payload: Record<string, unknown>;
  try { payload = JSON.parse(response.body) as Record<string, unknown>; }
  catch { payload = Object.fromEntries(new URLSearchParams(response.body).entries()); }
  if (response.status < 200 || response.status >= 300) {
    const detail = String(payload.error_description ?? payload.error ?? response.statusText);
    throw new Error(`OAuth 2 token request failed (${response.status}): ${detail}`);
  }
  const accessToken = String(payload.access_token ?? '');
  if (!accessToken) throw new Error('The OAuth 2 response did not contain an access_token.');
  const expires = Number(payload.expires_in);
  return {
    accessToken,
    refreshToken: String(payload.refresh_token ?? auth.refreshToken ?? ''),
    tokenType: String(payload.token_type ?? auth.tokenPrefix ?? 'Bearer'),
    expiresIn: Number.isFinite(expires) ? expires : undefined,
  };
};
