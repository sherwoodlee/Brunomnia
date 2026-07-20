import { invoke, isTauri } from '@tauri-apps/api/core';
import type { ApiRequest, AuthConfig, Environment, HttpResponse, JsonValue, McpClient, McpPrompt, McpResource, McpTool } from '../types';
import { createBlankRequest } from '../data/seed';
import { sendRequest, type SendRequestContext } from './http';
import { discoverMcpOAuthConfiguration, mcpOAuthClientCredentials, mcpOAuthConfigurationReady, mcpOAuthResource, parseMcpOAuthChallenge } from './mcpOAuthDiscovery';
import { expandMcpUriTemplate, mcpUriTemplateVariables } from './mcpUriTemplate';
import { isProtectedSecretReference, isSensitiveSecretName } from './security';

type McpEvent = { direction: 'client' | 'server' | 'stderr'; method: string; detail: string; timestamp: string };
type McpOperationResult = { result: unknown; events: McpEvent[]; client: McpClient; sessionId?: string };
export type McpRequestContext = SendRequestContext & { onMcpClient?: (client: McpClient) => void; sessionScope?: string };
type StdioOutput = { result: unknown; events: unknown[]; stderr: string };
type McpHttpSession = { client: McpClient; fingerprint: string; sessionId: string };

const now = () => new Date().toISOString();
const requestId = () => `mcp-${Date.now().toString(36)}-${crypto.randomUUID()}`;
const asRecord = (value: unknown) => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
const asString = (value: unknown) => typeof value === 'string' ? value : '';
const mcpAbortError = (signal: AbortSignal) => signal.reason instanceof Error ? signal.reason : new DOMException('MCP operation canceled.', 'AbortError');
const throwIfMcpAborted = (signal?: AbortSignal) => { if (signal?.aborted) throw mcpAbortError(signal); };
const MCP_PROTOCOL_VERSION = '2025-06-18';
const MAX_HTTP_SESSIONS = 100;
const MAX_SESSION_ID_BYTES = 4_096;
const httpSessions = new Map<string, McpHttpSession>();
const stdioSessions = new Map<string, string>();
const stdioSessionRevisions = new Map<string, number>();

class McpHttpStatusError extends Error {
  constructor(readonly status: number, body: string) {
    super(`MCP HTTP request failed (${status}): ${body.slice(0, 2_000)}`);
  }
}

const sessionKey = (clientId: string, scope = '') => JSON.stringify([scope, clientId]);
const sessionFingerprint = (client: McpClient) => JSON.stringify({
  url: client.url,
  headers: client.headers.map(({ name, value, enabled }) => ({ name, value, enabled })),
  authType: client.authType,
  token: client.authType === 'bearer' ? client.token : '',
  username: client.authType === 'basic' ? client.username : '',
  password: client.authType === 'basic' ? client.password : '',
  oauthAuthorizationUrl: client.authType === 'oauth2' ? client.oauthAuthorizationUrl : '',
  oauthAccessTokenUrl: client.authType === 'oauth2' ? client.oauthAccessTokenUrl : '',
  oauthClientId: client.authType === 'oauth2' ? client.oauthClientId : '',
  oauthClientSecret: client.authType === 'oauth2' ? client.oauthClientSecret : '',
  oauthScope: client.authType === 'oauth2' ? client.oauthScope : '',
  oauthRegisteredClientId: client.authType === 'oauth2' ? client.oauthRegisteredClientId : '',
  oauthRegisteredClientSecret: client.authType === 'oauth2' ? client.oauthRegisteredClientSecret : '',
  oauthRegisteredTokenEndpointAuthMethod: client.authType === 'oauth2' ? client.oauthRegisteredTokenEndpointAuthMethod : 'none',
});
const stdioSessionFingerprint = (client: McpClient) => JSON.stringify([client.command.trim(), client.args]);
const stdioSessionRevision = (key: string) => stdioSessionRevisions.get(key) ?? 0;
const rememberStdioSession = (key: string, fingerprint: string, revision: number) => {
  if (stdioSessionRevision(key) === revision) stdioSessions.set(key, fingerprint);
};
const invalidateStdioSession = (key: string) => {
  const active = stdioSessions.delete(key);
  stdioSessionRevisions.set(key, stdioSessionRevision(key) + 1);
  return active;
};
const normalizeSessionId = (value: string) => {
  if (!value) return '';
  if (value.length > MAX_SESSION_ID_BYTES || /[\0\r\n]/.test(value)) throw new Error('The MCP server returned an invalid or oversized session identity.');
  return value;
};
const matchingHttpSession = (client: McpClient, context: Pick<McpRequestContext, 'sessionScope'>) => {
  const key = sessionKey(client.id, context.sessionScope);
  const session = httpSessions.get(key);
  if (!session) return undefined;
  if (session.fingerprint !== sessionFingerprint(client)) {
    httpSessions.delete(key);
    return undefined;
  }
  httpSessions.delete(key);
  httpSessions.set(key, session);
  return session;
};
const rememberHttpSession = (client: McpClient, context: Pick<McpRequestContext, 'sessionScope'>, sessionId: string) => {
  const normalized = normalizeSessionId(sessionId);
  const key = sessionKey(client.id, context.sessionScope);
  httpSessions.delete(key);
  httpSessions.set(key, { client, fingerprint: sessionFingerprint(client), sessionId: normalized });
  while (httpSessions.size > MAX_HTTP_SESSIONS) httpSessions.delete(httpSessions.keys().next().value!);
};
export const forgetMcpClientSession = (clientId: string, sessionScope = '') => {
  const key = sessionKey(clientId, sessionScope);
  const http = httpSessions.delete(key);
  const stdio = invalidateStdioSession(key);
  return http || stdio;
};
export const hasMcpClientSession = (client: McpClient, sessionScope = '') => {
  const key = sessionKey(client.id, sessionScope);
  return client.transport === 'stdio' ? stdioSessions.get(key) === stdioSessionFingerprint(client) : httpSessions.get(key)?.fingerprint === sessionFingerprint(client);
};

const validateHttpEndpoint = (value: string) => {
  const url = new URL(value);
  if (url.username || url.password) throw new Error('MCP endpoint URLs cannot contain credentials. Use the Auth fields or vault-backed headers.');
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('MCP HTTP endpoints must use http or https.');
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '::1';
  if (url.protocol !== 'https:' && !local) throw new Error('Remote MCP endpoints must use HTTPS; plain HTTP is limited to loopback servers.');
  return url.toString();
};

const assertProtectedCredentials = (client: McpClient) => {
  if (client.authType === 'bearer' && (!client.token.trim() || !isProtectedSecretReference(client.token))) {
    throw new Error('MCP bearer tokens must be a complete local-vault or approved external-vault reference.');
  }
  if (client.authType === 'basic' && (!client.password.trim() || !isProtectedSecretReference(client.password))) {
    throw new Error('MCP Basic passwords must be a complete local-vault or approved external-vault reference.');
  }
  if (client.authType === 'oauth2') {
    if (client.oauthClientSecret.trim() && !isProtectedSecretReference(client.oauthClientSecret)) {
      throw new Error('MCP OAuth client secrets must be a complete local-vault or approved external-vault reference.');
    }
  }
  const unsafeHeader = client.headers.find((header) => header.enabled && header.value.trim() && isSensitiveSecretName(header.name) && !isProtectedSecretReference(header.value));
  if (unsafeHeader) throw new Error(`MCP sensitive header '${unsafeHeader.name}' must use a complete local-vault or approved external-vault reference.`);
};

const responseMessages = (body: string): unknown[] => {
  const source = body.trim();
  if (!source) return [];
  if (source.startsWith('{') || source.startsWith('[')) {
    const parsed: unknown = JSON.parse(source);
    return Array.isArray(parsed) ? parsed : [parsed];
  }
  const messages: unknown[] = [];
  let data: string[] = [];
  const flush = () => {
    const value = data.join('\n').trim();
    data = [];
    if (value && value !== '[DONE]') messages.push(JSON.parse(value));
  };
  source.split(/\r?\n/).forEach((line) => {
    if (!line.trim()) flush();
    else if (line.startsWith('data:')) data.push(line.slice(5).trimStart());
  });
  flush();
  if (!messages.length) throw new Error('The MCP server returned neither JSON nor JSON-bearing SSE events.');
  return messages;
};

const operationResult = (messages: unknown[], id: string): { result: unknown; events: McpEvent[] } => {
  const events: McpEvent[] = [];
  for (const value of messages) {
    const message = asRecord(value);
    if (!message) continue;
    if (message.id === id) {
      if (message.error) throw new Error(`MCP error: ${JSON.stringify(message.error)}`);
      return { result: message.result, events };
    }
    events.push({ direction: 'server', method: asString(message.method) || 'message', detail: JSON.stringify(message), timestamp: now() });
  }
  throw new Error('The MCP server did not return the matching JSON-RPC response.');
};

export const parseMcpJsonRpcResponse = (body: string, id: string) => operationResult(responseMessages(body), id);

export const mcpAuthentication = (client: McpClient, defaults: AuthConfig): AuthConfig => {
  if (client.authType === 'oauth2') {
    const credentials = mcpOAuthClientCredentials(client);
    return {
      ...defaults,
      type: 'oauth2',
      disabled: false,
      oauth2GrantType: 'authorization_code',
      authorizationUrl: client.oauthAuthorizationUrl,
      accessTokenUrl: client.oauthAccessTokenUrl,
      clientId: credentials.clientId,
      clientSecret: credentials.clientSecret,
      scope: client.oauthScope,
      state: client.oauthState,
      redirectUrl: 'http://127.0.0.1/mcp/oauth/callback',
      credentialsInBody: credentials.tokenEndpointAuthMethod !== 'client_secret_basic',
      resource: mcpOAuthResource(client.url),
      accessToken: client.token,
      refreshToken: client.oauthRefreshToken,
      identityToken: client.oauthIdentityToken,
      expiresAt: client.oauthExpiresAt,
      tokenPrefix: client.oauthTokenPrefix || 'Bearer',
      usePkce: true,
      pkceMethod: 'S256',
      responseType: 'code',
    };
  }
  return {
    ...defaults,
    type: client.authType,
    token: client.token,
    username: client.username,
    password: client.password,
    disabled: client.authType === 'none',
  };
};

export const mcpClientWithOAuth2Auth = (client: McpClient, auth: AuthConfig): McpClient => client.authType !== 'oauth2' || auth.type !== 'oauth2' ? client : ({
  ...client,
  token: auth.accessToken,
  oauthRefreshToken: auth.refreshToken,
  oauthIdentityToken: auth.identityToken,
  oauthExpiresAt: auth.expiresAt,
  oauthTokenPrefix: auth.tokenPrefix || 'Bearer',
});

const sendHttpCancellation = async (
  client: McpClient,
  requestIdToCancel: string,
  sessionId: string,
  auth: AuthConfig,
  environment: Environment | undefined,
  context: McpRequestContext,
) => {
  const request = createBlankRequest(requestId());
  request.name = `${client.name} · notifications/cancelled`;
  request.method = 'POST';
  request.url = validateHttpEndpoint(client.url);
  request.bodyMode = 'json';
  request.body = JSON.stringify({ jsonrpc: '2.0', method: 'notifications/cancelled', params: { requestId: requestIdToCancel, reason: 'Canceled by user.' } });
  request.headers = [
    { id: `${request.id}-content-type`, name: 'Content-Type', value: 'application/json', enabled: true },
    { id: `${request.id}-accept`, name: 'Accept', value: 'application/json, text/event-stream', enabled: true },
    { id: `${request.id}-protocol`, name: 'Mcp-Protocol-Version', value: MCP_PROTOCOL_VERSION, enabled: true },
    ...(sessionId ? [{ id: `${request.id}-session`, name: 'Mcp-Session-Id', value: sessionId, enabled: true }] : []),
    ...client.headers,
  ];
  request.auth = mcpAuthentication(client, auth);
  request.transport = { ...request.transport, followRedirects: false, followRedirectsMode: 'off', timeoutMode: 'custom', timeoutMs: 5_000, sendCookies: false, storeCookies: false };
  const detachedContext: SendRequestContext = {
    ...context,
    signal: undefined,
    cancellationId: undefined,
    pluginRuntime: undefined,
    skipOAuth2Acquisition: true,
    onOAuth2Token: undefined,
    authorizeOAuth2: undefined,
  };
  await sendRequest(request, environment, detachedContext);
};

const httpRequest = async (
  client: McpClient,
  method: string,
  params: unknown,
  environment: Environment | undefined,
  context: McpRequestContext,
  sessionId = '',
  notification = false,
  oauthRetry = false,
): Promise<McpOperationResult> => {
  throwIfMcpAborted(context.signal);
  assertProtectedCredentials(client);
  const id = requestId();
  const request = createBlankRequest(id);
  request.name = `${client.name} · ${method}`;
  request.method = 'POST';
  request.url = validateHttpEndpoint(client.url);
  request.bodyMode = 'json';
  request.body = JSON.stringify(notification
    ? { jsonrpc: '2.0', method, params }
    : { jsonrpc: '2.0', id, method, params });
  request.headers = [
    { id: `${id}-content-type`, name: 'Content-Type', value: 'application/json', enabled: true },
    { id: `${id}-accept`, name: 'Accept', value: 'application/json, text/event-stream', enabled: true },
    ...(method === 'initialize' ? [] : [{ id: `${id}-protocol`, name: 'Mcp-Protocol-Version', value: MCP_PROTOCOL_VERSION, enabled: true }]),
    ...(sessionId ? [{ id: `${id}-session`, name: 'Mcp-Session-Id', value: sessionId, enabled: true }] : []),
    ...client.headers,
  ];
  const discoveryProbe = client.authType === 'oauth2'
    && !mcpOAuthConfigurationReady(client)
    && !client.token.trim()
    && !client.oauthRefreshToken.trim();
  request.auth = discoveryProbe
    ? { ...request.auth, type: 'none', disabled: true }
    : mcpAuthentication(client, request.auth);
  request.transport = { ...request.transport, followRedirects: false, followRedirectsMode: 'off', timeoutMode: 'custom', timeoutMs: 30_000, sendCookies: false, storeCookies: false };
  let updatedClient = client;
  const cancel = () => {
    if (!notification) void sendHttpCancellation(updatedClient, id, sessionId, request.auth, environment, context).catch(() => undefined);
  };
  context.signal?.addEventListener('abort', cancel, { once: true });
  let response: HttpResponse;
  try {
    response = await sendRequest(request, environment, {
      ...context,
      onOAuth2Token: (updatedRequest: ApiRequest) => {
        updatedClient = mcpClientWithOAuth2Auth(updatedClient, updatedRequest.auth);
        context.onMcpClient?.(updatedClient);
      },
    });
  } finally {
    context.signal?.removeEventListener('abort', cancel);
  }
  if (response.status === 401 && client.authType === 'oauth2' && !oauthRetry) {
    const discovered = await discoverMcpOAuthConfiguration(updatedClient, response, environment, context);
    context.onMcpClient?.(discovered.client);
    const retryClient = { ...discovered.client, token: '', oauthRefreshToken: '', oauthIdentityToken: '', oauthExpiresAt: 0 };
    const retried = await httpRequest(retryClient, method, params, environment, context, sessionId, notification, true);
    return {
      ...retried,
      events: [
        { direction: 'server', method: 'MCP OAuth', detail: '401 authentication challenge', timestamp: now() },
        ...discovered.traces,
        ...retried.events,
      ],
    };
  }
  const challenge = response.status === 403 && client.authType === 'oauth2' ? parseMcpOAuthChallenge(response) : undefined;
  if (challenge?.error === 'insufficient_scope' && challenge.scope && !oauthRetry) {
    const retryClient = { ...updatedClient, oauthScope: challenge.scope, token: '', oauthRefreshToken: '', oauthIdentityToken: '', oauthExpiresAt: 0 };
    context.onMcpClient?.(retryClient);
    const retried = await httpRequest(retryClient, method, params, environment, context, sessionId, notification, true);
    return {
      ...retried,
      events: [{ direction: 'server', method: 'MCP OAuth', detail: `403 insufficient_scope · ${challenge.scope}`, timestamp: now() }, ...retried.events],
    };
  }
  if (response.status === 401) throw new Error('MCP authentication failed with 401 after credential acquisition. Review the server, OAuth, PAT, or Basic configuration.');
  if (response.status < 200 || response.status >= 300) throw new McpHttpStatusError(response.status, response.body);
  const nextSession = normalizeSessionId(Object.entries(response.headers).find(([name]) => name.toLowerCase() === 'mcp-session-id')?.[1] ?? sessionId);
  const events: McpEvent[] = [{ direction: 'client', method, detail: notification ? 'notification' : id, timestamp: now() }];
  if (notification || !response.body.trim()) return { result: undefined, events, client: updatedClient, sessionId: nextSession };
  const parsed = parseMcpJsonRpcResponse(response.body, id);
  return { result: parsed.result, events: [...events, ...parsed.events], client: updatedClient, sessionId: nextSession };
};

const httpSession = async (client: McpClient, environment: Environment | undefined, context: McpRequestContext) => {
  const cached = matchingHttpSession(client, context);
  if (cached) {
    return {
      client,
      sessionId: cached.sessionId,
      events: [{ direction: 'client', method: 'MCP session', detail: 'Reused the active HTTP session.', timestamp: now() }] as McpEvent[],
    };
  }
  const initialized = await httpRequest(client, 'initialize', {
    protocolVersion: MCP_PROTOCOL_VERSION,
    capabilities: { roots: { listChanged: false } },
    clientInfo: { name: 'Brunomnia', version: '0.1.0' },
  }, environment, context);
  const notification = await httpRequest(initialized.client, 'notifications/initialized', {}, environment, context, initialized.sessionId, true);
  const sessionId = notification.sessionId ?? initialized.sessionId ?? '';
  rememberHttpSession(notification.client, context, sessionId);
  return { client: notification.client, sessionId, events: [...initialized.events, ...notification.events] };
};

export const disconnectMcpClient = async (client: McpClient, environment: Environment | undefined, context: McpRequestContext): Promise<{ events: McpEvent[]; terminated: boolean }> => {
  const key = sessionKey(client.id, context.sessionScope);
  if (client.transport === 'stdio') {
    const active = invalidateStdioSession(key);
    const events: McpEvent[] = [{ direction: 'client', method: 'MCP session', detail: 'Cleared the local STDIO connection and requested process termination.', timestamp: now() }];
    try {
      const terminated = isTauri() && await invoke<boolean>('close_mcp_stdio_session', { sessionKey: key });
      if (!active && !terminated) return { events: [], terminated: false };
      return { events, terminated };
    } catch (error) {
      if (!active) return { events: [], terminated: false };
      return { events: [...events, { direction: 'server', method: 'MCP session', detail: `Native MCP STDIO termination failed after local disconnect: ${error instanceof Error ? error.message : String(error)}`, timestamp: now() }], terminated: false };
    }
  }
  const session = httpSessions.get(key);
  httpSessions.delete(key);
  if (!session) return { events: [] as McpEvent[], terminated: false };
  if (!session.sessionId) return { events: [{ direction: 'client', method: 'MCP session', detail: 'Cleared the local stateless HTTP connection.', timestamp: now() }], terminated: false };
  const request = createBlankRequest(requestId());
  request.name = `${session.client.name} · terminate MCP session`;
  request.method = 'DELETE';
  request.url = validateHttpEndpoint(session.client.url);
  request.headers = [
    { id: `${request.id}-accept`, name: 'Accept', value: 'application/json, text/event-stream', enabled: true },
    { id: `${request.id}-protocol`, name: 'Mcp-Protocol-Version', value: MCP_PROTOCOL_VERSION, enabled: true },
    { id: `${request.id}-session`, name: 'Mcp-Session-Id', value: session.sessionId, enabled: true },
    ...session.client.headers,
  ];
  request.auth = mcpAuthentication(session.client, request.auth);
  request.transport = { ...request.transport, followRedirects: false, followRedirectsMode: 'off', timeoutMode: 'custom', timeoutMs: 5_000, sendCookies: false, storeCookies: false };
  const detachedContext: SendRequestContext = { ...context, signal: undefined, cancellationId: undefined, pluginRuntime: undefined, skipOAuth2Acquisition: true, onOAuth2Token: undefined, authorizeOAuth2: undefined };
  const events: McpEvent[] = [{ direction: 'client', method: 'MCP session', detail: 'Cleared the local HTTP session and requested remote termination.', timestamp: now() }];
  try {
    const response = await sendRequest(request, environment, detachedContext);
    if (response.status >= 200 && response.status < 300) return { events, terminated: true };
    const detail = response.status === 404
      ? 'The remote MCP session was already gone.'
      : response.status === 405
        ? 'The server does not support explicit MCP session termination; the local session was still cleared.'
        : `Remote MCP session termination returned HTTP ${response.status}; the local session was still cleared.`;
    return { events: [...events, { direction: 'server', method: 'MCP session', detail, timestamp: now() }], terminated: false };
  } catch (error) {
    return { events: [...events, { direction: 'server', method: 'MCP session', detail: `Remote MCP session termination failed; the local session was still cleared: ${error instanceof Error ? error.message : String(error)}`, timestamp: now() }], terminated: false };
  }
};

const stdioRequest = async (client: McpClient, method: string, params: unknown, context: McpRequestContext): Promise<McpOperationResult> => {
  throwIfMcpAborted(context.signal);
  if (!isTauri()) throw new Error('MCP STDIO servers require the Tauri desktop app.');
  if (!client.command.trim()) throw new Error('Enter the MCP STDIO executable and arguments. Brunomnia never invokes a shell.');
  const sessionKeyValue = sessionKey(client.id, context.sessionScope);
  const sessionRevision = stdioSessionRevision(sessionKeyValue);
  const fingerprint = stdioSessionFingerprint(client);
  const cancellationId = context.signal ? context.cancellationId ?? `mcp-stdio-${crypto.randomUUID()}` : '';
  const cancel = () => { if (cancellationId) void invoke('cancel_mcp_stdio_call', { cancellationId }).catch(() => undefined); };
  context.signal?.addEventListener('abort', cancel, { once: true });
  let output: StdioOutput;
  try {
    output = await invoke<StdioOutput>('mcp_stdio_call', { input: { command: client.command, args: client.args, method, params, roots: client.roots, timeoutMs: 30_000, cancellationId, sessionKey: sessionKeyValue } });
    rememberStdioSession(sessionKeyValue, fingerprint, sessionRevision);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    if (detail.startsWith('The MCP server returned an error:')) rememberStdioSession(sessionKeyValue, fingerprint, sessionRevision);
    else if (context.signal?.aborted) {
      try {
        const active = await invoke<boolean>('has_mcp_stdio_session', { sessionKey: sessionKeyValue });
        if (active) rememberStdioSession(sessionKeyValue, fingerprint, sessionRevision);
        else if (stdioSessionRevision(sessionKeyValue) === sessionRevision) stdioSessions.delete(sessionKeyValue);
      } catch {}
    } else if (stdioSessionRevision(sessionKeyValue) === sessionRevision) stdioSessions.delete(sessionKeyValue);
    throw error;
  } finally {
    context.signal?.removeEventListener('abort', cancel);
  }
  const events: McpEvent[] = output.events.map((event) => ({ direction: 'server', method: asString(asRecord(event)?.method) || 'message', detail: JSON.stringify(event), timestamp: now() }));
  if (output.stderr) events.push({ direction: 'stderr', method: 'stderr', detail: output.stderr, timestamp: now() });
  return { result: output.result, events, client };
};

const operation = async (
  client: McpClient,
  method: string,
  params: unknown,
  environment: Environment | undefined,
  context: McpRequestContext,
  sessionId?: string,
) => client.transport === 'stdio'
  ? stdioRequest(client, method, params, context)
  : httpRequest(client, method, params, environment, context, sessionId);

const operationWithSessionRecovery = async (
  client: McpClient,
  method: string,
  params: unknown,
  environment: Environment | undefined,
  context: McpRequestContext,
  sessionId = '',
) => {
  try {
    const response = await operation(client, method, params, environment, context, sessionId);
    if (client.transport === 'http' && response.sessionId) rememberHttpSession(response.client, context, response.sessionId);
    return response;
  } catch (error) {
    if (client.transport !== 'http' || !sessionId || !(error instanceof McpHttpStatusError) || error.status !== 404) throw error;
    forgetMcpClientSession(client.id, context.sessionScope);
    const reconnected = await httpSession(client, environment, context);
    const response = await httpRequest(reconnected.client, method, params, environment, context, reconnected.sessionId);
    if (response.sessionId) rememberHttpSession(response.client, context, response.sessionId);
    return {
      ...response,
      events: [
        { direction: 'server', method: 'MCP session', detail: 'The server rejected the expired HTTP session; Brunomnia initialized one replacement and retried once.', timestamp: now() } as McpEvent,
        ...reconnected.events,
        ...response.events,
      ],
    };
  }
};

const toolList = (value: unknown): McpTool[] => {
  const tools = asRecord(value)?.tools;
  return !Array.isArray(tools) ? [] : tools.flatMap((item): McpTool[] => {
    const tool = asRecord(item);
    const name = asString(tool?.name);
    return tool && name ? [{ name, description: asString(tool.description), inputSchema: (tool.inputSchema ?? {}) as JsonValue }] : [];
  });
};

const promptList = (value: unknown): McpPrompt[] => {
  const prompts = asRecord(value)?.prompts;
  return !Array.isArray(prompts) ? [] : prompts.flatMap((item): McpPrompt[] => {
    const prompt = asRecord(item);
    const name = asString(prompt?.name);
    if (!prompt || !name) return [];
    const args = Array.isArray(prompt.arguments) ? prompt.arguments.flatMap((item): McpPrompt['arguments'] => {
      const argument = asRecord(item);
      const argumentName = asString(argument?.name);
      return argument && argumentName ? [{ name: argumentName, description: asString(argument.description), required: argument.required === true }] : [];
    }) : [];
    return [{ name, description: asString(prompt.description), arguments: args }];
  });
};

const resourceList = (value: unknown, key: 'resources' | 'resourceTemplates'): McpResource[] => {
  const resources = asRecord(value)?.[key];
  return !Array.isArray(resources) ? [] : resources.flatMap((item): McpResource[] => {
    const resource = asRecord(item);
    const uriTemplate = key === 'resourceTemplates' ? asString(resource?.uriTemplate) : '';
    const uri = asString(resource?.uri) || uriTemplate;
    if (!resource || !uri) return [];
    let variables: string[] = [];
    if (uriTemplate) {
      try { variables = mcpUriTemplateVariables(uriTemplate); }
      catch { variables = []; }
    }
    return [{ uri, uriTemplate, variables, name: asString(resource.name) || uri, description: asString(resource.description), mimeType: asString(resource.mimeType) }];
  });
};

export const mcpResourceUri = (client: McpClient, value: string, parameters: Record<string, unknown>) => {
  const template = client.resourceTemplates.find((resource) => resource.uri === value || resource.uriTemplate === value);
  return template ? expandMcpUriTemplate(template.uriTemplate || template.uri, parameters) : value;
};

export const discoverMcpClient = async (client: McpClient, environment: Environment | undefined, context: McpRequestContext) => {
  if (!client.enabled) throw new Error('Review the MCP endpoint or command, then enable this client before connecting.');
  const session = client.transport === 'http' ? await httpSession(client, environment, context) : { client, sessionId: '', events: [] as McpEvent[] };
  let activeClient = session.client;
  let sessionId = session.sessionId;
  const events = [...session.events];
  const warnings: string[] = [];
  const list = async (method: string, key: 'tools' | 'prompts' | 'resources' | 'resourceTemplates') => {
    const values: unknown[] = [];
    let cursor = '';
    for (let page = 0; page < 100; page += 1) {
      try {
        const response = await operationWithSessionRecovery(activeClient, method, cursor ? { cursor } : {}, environment, context, sessionId);
        activeClient = response.client;
        sessionId = response.sessionId ?? sessionId;
        events.push(...response.events);
        values.push(response.result);
        cursor = asString(asRecord(response.result)?.nextCursor);
        if (!cursor) break;
      } catch (error) {
        if (context.signal?.aborted) throw mcpAbortError(context.signal);
        warnings.push(`${method}: ${error instanceof Error ? error.message : String(error)}`);
        break;
      }
    }
    if (key === 'tools') return values.flatMap(toolList).slice(0, 5_000);
    if (key === 'prompts') return values.flatMap(promptList).slice(0, 5_000);
    return values.flatMap((value) => resourceList(value, key)).slice(0, 5_000);
  };
  const tools = await list('tools/list', 'tools') as McpTool[];
  const prompts = await list('prompts/list', 'prompts') as McpPrompt[];
  const resources = await list('resources/list', 'resources') as McpResource[];
  const resourceTemplates = await list('resources/templates/list', 'resourceTemplates') as McpResource[];
  throwIfMcpAborted(context.signal);
  return { client: { ...activeClient, tools, prompts, resources, resourceTemplates, lastSyncedAt: now() }, events, warnings };
};

export const invokeMcpOperation = async (
  client: McpClient,
  kind: 'tool' | 'prompt' | 'resource',
  name: string,
  parameters: Record<string, unknown>,
  environment: Environment | undefined,
  context: McpRequestContext,
) => {
  if (!client.enabled) throw new Error('Enable this MCP client before invoking operations.');
  const session = client.transport === 'http' ? await httpSession(client, environment, context) : { client, sessionId: '', events: [] as McpEvent[] };
  const method = kind === 'tool' ? 'tools/call' : kind === 'prompt' ? 'prompts/get' : 'resources/read';
  const params = kind === 'tool' ? { name, arguments: parameters } : kind === 'prompt' ? { name, arguments: parameters } : { uri: mcpResourceUri(session.client, name, parameters) };
  const response = await operationWithSessionRecovery(session.client, method, params, environment, context, session.sessionId);
  return { result: response.result, events: [...session.events, ...response.events], client: response.client };
};

export type { McpEvent };
