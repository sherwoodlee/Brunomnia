import { createBlankRequest } from '../data/seed';
import type { Environment, HttpResponse, McpClient } from '../types';
import { sendRequest, type SendRequestContext } from './http';

const maxMetadataBytes = 1024 * 1024;
const redirectUrl = 'http://127.0.0.1/mcp/oauth/callback';

type JsonRecord = Record<string, unknown>;
type ProtectedResourceMetadata = {
  resource: string;
  authorizationServers: string[];
  scopes: string[];
};
type AuthorizationServerMetadata = {
  issuer: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  registrationEndpoint: string;
  scopes: string[];
};

export type McpOAuthTrace = {
  direction: 'client' | 'server';
  method: string;
  detail: string;
  timestamp: string;
};

const now = () => new Date().toISOString();
const asRecord = (value: unknown): JsonRecord | undefined => value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : undefined;
const asString = (value: unknown) => typeof value === 'string' ? value : '';
const stringArray = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())) : [];
const unique = (values: string[]) => [...new Set(values)];

const safeOAuthUrl = (value: string, base?: string) => {
  let url: URL;
  try { url = base ? new URL(value, base) : new URL(value); }
  catch { throw new Error(`MCP OAuth metadata contained a malformed URL: ${value}`); }
  if (url.username || url.password) throw new Error('MCP OAuth URLs cannot contain credentials.');
  if (url.hash) throw new Error('MCP OAuth URLs cannot contain fragments.');
  const loopback = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '::1' || url.hostname === '[::1]';
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) {
    throw new Error('MCP OAuth endpoints must use HTTPS, except for loopback HTTP servers.');
  }
  return url;
};

export const mcpOAuthResource = (value: string) => {
  const url = safeOAuthUrl(value);
  url.hash = '';
  return url.toString();
};

const resourceMatches = (serverUrl: string, configuredResource: string) => {
  const requested = safeOAuthUrl(serverUrl);
  const configured = safeOAuthUrl(configuredResource);
  if (requested.origin.toLowerCase() !== configured.origin.toLowerCase()) return false;
  const requestedPath = `${requested.pathname.replace(/\/$/, '')}/`;
  const configuredPath = `${configured.pathname.replace(/\/$/, '')}/`;
  return requestedPath.startsWith(configuredPath);
};

const quotedValue = (value: string) => value.replace(/\\(["\\])/g, '$1');

export const parseMcpOAuthChallenge = (response: Pick<HttpResponse, 'headers'>) => {
  const value = Object.entries(response.headers).find(([name]) => name.toLowerCase() === 'www-authenticate')?.[1] ?? '';
  if (!/(?:^|,)\s*Bearer(?:\s|$)/i.test(value)) return { resourceMetadataUrl: '', scope: '', error: '' };
  const parameter = (name: string) => {
    const match = new RegExp(`${name}\\s*=\\s*(?:"((?:\\\\.|[^"])*)"|([^\\s,]+))`, 'i').exec(value);
    return match ? quotedValue(match[1] ?? match[2] ?? '') : '';
  };
  return { resourceMetadataUrl: parameter('resource_metadata'), scope: parameter('scope'), error: parameter('error') };
};

export const protectedResourceMetadataUrls = (serverUrl: string, challengeUrl = '') => {
  const server = safeOAuthUrl(serverUrl);
  const origin = server.origin;
  const urls: string[] = [];
  if (challengeUrl) urls.push(safeOAuthUrl(challengeUrl, server.toString()).toString());
  if (server.pathname && server.pathname !== '/') urls.push(safeOAuthUrl(`/.well-known/oauth-protected-resource${server.pathname}`, origin).toString());
  urls.push(safeOAuthUrl('/.well-known/oauth-protected-resource', origin).toString());
  return unique(urls);
};

export const authorizationServerMetadataUrls = (authorizationServerUrl: string, serverUrl: string) => {
  if (!authorizationServerUrl) {
    const server = safeOAuthUrl(serverUrl);
    return [safeOAuthUrl('/.well-known/oauth-authorization-server', server.origin).toString()];
  }
  const issuer = safeOAuthUrl(authorizationServerUrl);
  const path = issuer.pathname.replace(/\/$/, '');
  if (path) {
    return unique([
      safeOAuthUrl(`/.well-known/oauth-authorization-server${path}`, issuer.origin).toString(),
      safeOAuthUrl(`/.well-known/openid-configuration${path}`, issuer.origin).toString(),
      safeOAuthUrl(`${path}/.well-known/openid-configuration`, issuer.origin).toString(),
    ]);
  }
  return [
    safeOAuthUrl('/.well-known/oauth-authorization-server', issuer.origin).toString(),
    safeOAuthUrl('/.well-known/openid-configuration', issuer.origin).toString(),
  ];
};

export const mcpOAuthClientCredentials = (client: McpClient, clock = Date.now()) => {
  if (client.oauthClientId.trim()) {
    return {
      clientId: client.oauthClientId,
      clientSecret: client.oauthClientSecret,
      tokenEndpointAuthMethod: client.oauthClientSecret.trim() ? 'client_secret_basic' as const : 'none' as const,
    };
  }
  const secretExpired = client.oauthRegisteredClientSecretExpiresAt > 0
    && client.oauthRegisteredClientSecretExpiresAt <= Math.floor(clock / 1000);
  return {
    clientId: secretExpired ? '' : client.oauthRegisteredClientId,
    clientSecret: secretExpired ? '' : client.oauthRegisteredClientSecret,
    tokenEndpointAuthMethod: client.oauthRegisteredTokenEndpointAuthMethod,
  };
};

export const mcpOAuthConfigurationReady = (client: McpClient, clock = Date.now()) => {
  const credentials = mcpOAuthClientCredentials(client, clock);
  return Boolean(client.oauthAuthorizationUrl.trim() && client.oauthAccessTokenUrl.trim() && credentials.clientId.trim());
};

const metadataRequest = async (
  url: string,
  environment: Environment | undefined,
  context: SendRequestContext,
  method: 'GET' | 'POST' = 'GET',
  body?: JsonRecord,
) => {
  const request = createBlankRequest(`mcp-oauth-${crypto.randomUUID()}`);
  request.name = method === 'GET' ? 'MCP OAuth metadata' : 'MCP OAuth dynamic client registration';
  request.method = method;
  request.url = safeOAuthUrl(url).toString();
  request.headers = [
    { id: 'mcp-oauth-accept', name: 'Accept', value: 'application/json', enabled: true },
    { id: 'mcp-oauth-version', name: 'MCP-Protocol-Version', value: '2025-06-18', enabled: true },
    ...(body ? [{ id: 'mcp-oauth-content-type', name: 'Content-Type', value: 'application/json', enabled: true }] : []),
  ];
  request.bodyMode = body ? 'json' : 'none';
  request.body = body ? JSON.stringify(body) : '';
  request.transport = { ...request.transport, followRedirects: false, followRedirectsMode: 'off', timeoutMode: 'custom', timeoutMs: 30_000, sendCookies: false, storeCookies: false };
  return sendRequest(request, environment, { ...context, cookies: [], responses: [], pluginRuntime: undefined, validateCertificates: context.validateAuthCertificates ?? true, skipOAuth2Acquisition: true, onOAuth2Token: undefined, authorizeOAuth2: undefined });
};

const parsedJson = (response: HttpResponse, label: string) => {
  if (new TextEncoder().encode(response.body).byteLength > maxMetadataBytes) throw new Error(`${label} exceeded 1 MiB.`);
  try { return asRecord(JSON.parse(response.body)); }
  catch { return undefined; }
};

const protectedResource = (response: HttpResponse, serverUrl: string): ProtectedResourceMetadata | undefined => {
  if (response.status !== 200) return undefined;
  const value = parsedJson(response, 'MCP protected-resource metadata');
  const resource = asString(value?.resource);
  const authorizationServers = stringArray(value?.authorization_servers);
  if (!resource || !authorizationServers.length || !resourceMatches(serverUrl, resource)) return undefined;
  return {
    resource: mcpOAuthResource(resource),
    authorizationServers: authorizationServers.map((item) => safeOAuthUrl(item).toString()),
    scopes: stringArray(value?.scopes_supported),
  };
};

const authorizationServer = (response: HttpResponse, expectedIssuer: string): AuthorizationServerMetadata | undefined => {
  if (response.status !== 200) return undefined;
  const value = parsedJson(response, 'MCP authorization-server metadata');
  const issuer = asString(value?.issuer);
  const authorizationEndpoint = asString(value?.authorization_endpoint);
  const tokenEndpoint = asString(value?.token_endpoint);
  if (!issuer || !authorizationEndpoint || !tokenEndpoint) return undefined;
  const normalizedIssuer = safeOAuthUrl(issuer).toString().replace(/\/$/, '');
  if (expectedIssuer && normalizedIssuer !== safeOAuthUrl(expectedIssuer).toString().replace(/\/$/, '')) return undefined;
  const pkce = stringArray(value?.code_challenge_methods_supported);
  if (pkce.length && !pkce.includes('S256')) throw new Error('The MCP authorization server does not support PKCE S256.');
  const responseTypes = stringArray(value?.response_types_supported);
  if (responseTypes.length && !responseTypes.includes('code')) throw new Error('The MCP authorization server does not support authorization-code responses.');
  const grants = stringArray(value?.grant_types_supported);
  if (grants.length && !grants.includes('authorization_code')) throw new Error('The MCP authorization server does not support the authorization-code grant.');
  return {
    issuer: safeOAuthUrl(issuer).toString(),
    authorizationEndpoint: safeOAuthUrl(authorizationEndpoint).toString(),
    tokenEndpoint: safeOAuthUrl(tokenEndpoint).toString(),
    registrationEndpoint: asString(value?.registration_endpoint) ? safeOAuthUrl(asString(value?.registration_endpoint)).toString() : '',
    scopes: stringArray(value?.scopes_supported),
  };
};

const requestTrace = (method: string, url: string): McpOAuthTrace => ({ direction: 'client', method, detail: url, timestamp: now() });
const responseTrace = (method: string, response: HttpResponse): McpOAuthTrace => ({ direction: 'server', method, detail: `${response.status} ${response.statusText}`, timestamp: now() });

const discoverProtectedResource = async (
  client: McpClient,
  challengeUrl: string,
  environment: Environment | undefined,
  context: SendRequestContext,
  traces: McpOAuthTrace[],
) => {
  for (const url of protectedResourceMetadataUrls(client.url, challengeUrl)) {
    traces.push(requestTrace('MCP OAuth · protected resource metadata', url));
    const response = await metadataRequest(url, environment, context);
    traces.push(responseTrace('MCP OAuth · protected resource metadata', response));
    const metadata = protectedResource(response, client.url);
    if (metadata) return metadata;
  }
  return undefined;
};

const discoverAuthorizationServer = async (
  client: McpClient,
  issuer: string,
  environment: Environment | undefined,
  context: SendRequestContext,
  traces: McpOAuthTrace[],
) => {
  for (const url of authorizationServerMetadataUrls(issuer, client.url)) {
    traces.push(requestTrace('MCP OAuth · authorization server metadata', url));
    const response = await metadataRequest(url, environment, context);
    traces.push(responseTrace('MCP OAuth · authorization server metadata', response));
    const metadata = authorizationServer(response, issuer);
    if (metadata) return metadata;
  }
  return undefined;
};

const registerClient = async (
  client: McpClient,
  registrationUrl: string,
  scope: string,
  environment: Environment | undefined,
  context: SendRequestContext,
  traces: McpOAuthTrace[],
) => {
  const body: JsonRecord = {
    redirect_uris: [redirectUrl],
    token_endpoint_auth_method: 'none',
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    client_name: 'Brunomnia MCP Client',
    ...(scope ? { scope } : {}),
  };
  traces.push(requestTrace('MCP OAuth · dynamic client registration', registrationUrl));
  const response = await metadataRequest(registrationUrl, environment, context, 'POST', body);
  traces.push(responseTrace('MCP OAuth · dynamic client registration', response));
  if (response.status !== 200 && response.status !== 201) {
    throw new Error(`MCP OAuth dynamic client registration failed (${response.status}): ${response.body.slice(0, 1_000)}`);
  }
  const value = parsedJson(response, 'MCP dynamic client registration response');
  const clientId = asString(value?.client_id);
  if (!clientId || clientId.length > 4096) throw new Error('MCP OAuth dynamic registration did not return a bounded client_id.');
  const requestedMethod = asString(value?.token_endpoint_auth_method);
  const clientSecret = asString(value?.client_secret);
  const tokenEndpointAuthMethod: McpClient['oauthRegisteredTokenEndpointAuthMethod'] = requestedMethod === 'client_secret_basic' || requestedMethod === 'client_secret_post'
    ? requestedMethod
    : 'none';
  if (tokenEndpointAuthMethod !== 'none' && !clientSecret) throw new Error('MCP OAuth dynamic registration selected confidential-client authentication without a client secret.');
  return {
    ...client,
    oauthRegisteredClientId: clientId,
    oauthRegisteredClientSecret: tokenEndpointAuthMethod === 'none' ? '' : clientSecret.slice(0, 8192),
    oauthRegisteredClientIdIssuedAt: Number.isFinite(Number(value?.client_id_issued_at)) ? Math.max(0, Math.trunc(Number(value?.client_id_issued_at))) : 0,
    oauthRegisteredClientSecretExpiresAt: Number.isFinite(Number(value?.client_secret_expires_at)) ? Math.max(0, Math.trunc(Number(value?.client_secret_expires_at))) : 0,
    oauthRegisteredTokenEndpointAuthMethod: tokenEndpointAuthMethod,
  };
};

export const discoverMcpOAuthConfiguration = async (
  client: McpClient,
  unauthorized: HttpResponse,
  environment: Environment | undefined,
  context: SendRequestContext,
) => {
  const traces: McpOAuthTrace[] = [];
  const challenge = parseMcpOAuthChallenge(unauthorized);
  if (mcpOAuthConfigurationReady(client)) {
    return { client: client.oauthScope.trim() || !challenge.scope ? client : { ...client, oauthScope: challenge.scope }, traces };
  }
  const resourceMetadata = await discoverProtectedResource(client, challenge.resourceMetadataUrl, environment, context, traces);
  const authorizationServerUrl = resourceMetadata?.authorizationServers[0] ?? '';
  const serverMetadata = await discoverAuthorizationServer(client, authorizationServerUrl, environment, context, traces);
  const fallbackBase = authorizationServerUrl ? safeOAuthUrl(authorizationServerUrl) : safeOAuthUrl(client.url);
  const scope = client.oauthScope.trim()
    || challenge.scope.trim()
    || resourceMetadata?.scopes.join(' ')
    || serverMetadata?.scopes.join(' ')
    || '';
  let configured: McpClient = {
    ...client,
    oauthAuthorizationUrl: client.oauthAuthorizationUrl || serverMetadata?.authorizationEndpoint || safeOAuthUrl('/authorize', fallbackBase.origin).toString(),
    oauthAccessTokenUrl: client.oauthAccessTokenUrl || serverMetadata?.tokenEndpoint || safeOAuthUrl('/token', fallbackBase.origin).toString(),
    oauthScope: scope,
  };
  if (!mcpOAuthClientCredentials(configured).clientId) {
    const registrationUrl = serverMetadata?.registrationEndpoint || safeOAuthUrl('/register', fallbackBase.origin).toString();
    configured = await registerClient(configured, registrationUrl, scope, environment, context, traces);
  }
  if (!mcpOAuthConfigurationReady(configured)) throw new Error('MCP OAuth discovery did not produce complete authorization, token, and client configuration.');
  return { client: configured, traces };
};
