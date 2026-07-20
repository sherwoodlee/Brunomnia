import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBlankRequest } from '../data/seed';
import type { ApiRequest, McpClient } from '../types';
import type { SendRequestContext } from './http';
import { disconnectMcpClient, discoverMcpClient, forgetMcpClientSession, hasMcpClientSession, invokeMcpOperation, mcpAuthentication, mcpClientWithOAuth2Auth, mcpResourceUri } from './mcp';
import { authorizationServerMetadataUrls, parseMcpOAuthChallenge, protectedResourceMetadataUrls } from './mcpOAuthDiscovery';

const transport = vi.hoisted(() => ({ sendRequest: vi.fn() }));

vi.mock('./http', () => ({ sendRequest: transport.sendRequest }));

const oauthClient = (): McpClient => ({
  id: 'oauth-mcp',
  name: 'OAuth tools',
  enabled: true,
  transport: 'http',
  url: 'https://mcp.example.test/rpc',
  command: '',
  args: [],
  headers: [],
  authType: 'oauth2',
  token: '',
  username: '',
  password: '',
  oauthAuthorizationUrl: 'https://identity.example.test/authorize',
  oauthAccessTokenUrl: 'https://identity.example.test/token',
  oauthClientId: 'mcp-client',
  oauthClientSecret: '',
  oauthScope: 'mcp.read mcp.invoke',
  oauthState: '',
  oauthRefreshToken: '',
  oauthIdentityToken: '',
  oauthExpiresAt: 0,
  oauthTokenPrefix: 'Bearer',
  oauthRegisteredClientId: '',
  oauthRegisteredClientSecret: '',
  oauthRegisteredClientIdIssuedAt: 0,
  oauthRegisteredClientSecretExpiresAt: 0,
  oauthRegisteredTokenEndpointAuthMethod: 'none',
  roots: [],
  tools: [],
  prompts: [],
  resources: [],
  resourceTemplates: [],
});

beforeEach(() => {
  transport.sendRequest.mockReset();
  ['', 'project-a', 'project-b', 'project-recovery', 'stateless'].forEach((scope) => forgetMcpClientSession('oauth-mcp', scope));
});

describe('MCP OAuth request mapping', () => {
  it('parses Bearer challenge fields and builds path-aware discovery fallbacks', () => {
    expect(parseMcpOAuthChallenge({ headers: { 'WWW-Authenticate': 'Basic realm="legacy", Bearer resource_metadata="/.well-known/oauth-protected-resource", scope="mcp.read mcp.write"' } })).toEqual({
      resourceMetadataUrl: '/.well-known/oauth-protected-resource',
      scope: 'mcp.read mcp.write',
      error: '',
    });
    expect(protectedResourceMetadataUrls('https://tools.example.test/team/mcp', '')).toEqual([
      'https://tools.example.test/.well-known/oauth-protected-resource/team/mcp',
      'https://tools.example.test/.well-known/oauth-protected-resource',
    ]);
    expect(authorizationServerMetadataUrls('https://identity.example.test/tenant', 'https://tools.example.test/mcp')).toEqual([
      'https://identity.example.test/.well-known/oauth-authorization-server/tenant',
      'https://identity.example.test/.well-known/openid-configuration/tenant',
      'https://identity.example.test/tenant/.well-known/openid-configuration',
    ]);
    expect(parseMcpOAuthChallenge({ headers: { 'WWW-Authenticate': 'Basic realm="legacy"' } })).toEqual({ resourceMetadataUrl: '', scope: '', error: '' });
    expect(() => protectedResourceMetadataUrls('https://tools.example.test/mcp', 'http://metadata.example.test/oauth')).toThrow('HTTPS');
  });

  it('uses authorization code, PKCE, and public-client credentials by default', () => {
    const client = oauthClient();
    const auth = mcpAuthentication(client, createBlankRequest('mcp-auth').auth);

    expect(auth).toMatchObject({
      type: 'oauth2',
      oauth2GrantType: 'authorization_code',
      authorizationUrl: client.oauthAuthorizationUrl,
      accessTokenUrl: client.oauthAccessTokenUrl,
      clientId: 'mcp-client',
      scope: 'mcp.read mcp.invoke',
      redirectUrl: 'http://127.0.0.1/mcp/oauth/callback',
      credentialsInBody: true,
      usePkce: true,
      pkceMethod: 'S256',
    });
  });

  it('maps refreshed token metadata back without replacing configuration', () => {
    const client = oauthClient();
    const auth = {
      ...mcpAuthentication(client, createBlankRequest('mcp-auth').auth),
      accessToken: 'access-2',
      refreshToken: 'refresh-2',
      identityToken: 'identity-2',
      expiresAt: 456,
      tokenPrefix: 'DPoP',
    };

    expect(mcpClientWithOAuth2Auth(client, auth)).toMatchObject({
      oauthClientId: 'mcp-client',
      token: 'access-2',
      oauthRefreshToken: 'refresh-2',
      oauthIdentityToken: 'identity-2',
      oauthExpiresAt: 456,
      oauthTokenPrefix: 'DPoP',
    });
  });

  it('carries acquired credentials across initialization and discovery calls', async () => {
    const observedTokens: string[] = [];
    transport.sendRequest.mockImplementation(async (request: ApiRequest, _environment: unknown, context: SendRequestContext) => {
      if (!request) return { status: 204, statusText: 'No Content', headers: {}, body: '', durationMs: 0, sizeBytes: 0 };
      observedTokens.push(request.auth.accessToken);
      if (observedTokens.length === 1) {
        context.onOAuth2Token?.({
          ...request,
          auth: {
            ...request.auth,
            accessToken: 'acquired-access',
            refreshToken: 'acquired-refresh',
            expiresAt: Date.now() + 60_000,
          },
        });
      }
      const message = JSON.parse(request.body) as { id?: string; method: string };
      const results: Record<string, unknown> = {
        initialize: { protocolVersion: '2025-06-18', capabilities: {} },
        'tools/list': { tools: [{ name: 'search', description: 'Search', inputSchema: {} }] },
        'prompts/list': { prompts: [] },
        'resources/list': { resources: [] },
        'resources/templates/list': { resourceTemplates: [{ name: 'Find files', description: 'Find project files', uriTemplate: 'files://{/path}{?query,limit}' }] },
      };
      return {
        status: 200,
        statusText: 'OK',
        headers: message.method === 'initialize' ? { 'Mcp-Session-Id': 'session-one' } : {},
        body: message.id ? JSON.stringify({ jsonrpc: '2.0', id: message.id, result: results[message.method] ?? {} }) : '',
        durationMs: 1,
        sizeBytes: 0,
      };
    });

    const output = await discoverMcpClient(oauthClient(), undefined, {});

    expect(output.client).toMatchObject({ token: 'acquired-access', oauthRefreshToken: 'acquired-refresh' });
    expect(output.client.tools.map((tool) => tool.name)).toEqual(['search']);
    expect(output.client.resourceTemplates[0]).toMatchObject({ uri: 'files://{/path}{?query,limit}', uriTemplate: 'files://{/path}{?query,limit}', variables: ['path', 'query', 'limit'] });
    expect(mcpResourceUri(output.client, output.client.resourceTemplates[0].uri, { path: 'src/lib', query: 'oauth token', limit: 5 })).toBe('files:///src%2Flib?query=oauth%20token&limit=5');
    expect(observedTokens[0]).toBe('');
    expect(observedTokens.slice(1)).toEqual(Array(observedTokens.length - 1).fill('acquired-access'));
  });

  it('discovers metadata, registers a local client, authorizes, and retries a 401 challenge', async () => {
    const client = oauthClient();
    client.oauthAuthorizationUrl = '';
    client.oauthAccessTokenUrl = '';
    client.oauthClientId = '';
    client.oauthScope = '';
    const protectedMetadataUrl = 'https://mcp.example.test/.well-known/oauth-protected-resource';
    const redirectedProtectedMetadataUrl = 'https://mcp.example.test/oauth/resource-document';
    const authorizationMetadataUrl = 'https://identity.example.test/.well-known/oauth-authorization-server/tenant';
    const redirectedAuthorizationMetadataUrl = 'https://identity.example.test/tenant/oauth-server-document';
    const registrationUrl = 'https://identity.example.test/tenant/register';
    const protectedRequests: ApiRequest[] = [];
    const persistedClients: McpClient[] = [];
    transport.sendRequest.mockImplementation(async (request: ApiRequest, _environment: unknown, context: SendRequestContext) => {
      if (!request) return { status: 204, statusText: 'No Content', headers: {}, body: '', durationMs: 0, sizeBytes: 0 };
      protectedRequests.push(request);
      if (request.name === 'MCP OAuth metadata' && request.url === protectedMetadataUrl) {
        expect(context).toMatchObject({ cookies: [], responses: [], pluginRuntime: undefined, validateCertificates: false, skipOAuth2Acquisition: true });
        expect(request.transport).toMatchObject({ followRedirects: false, followRedirectsMode: 'off', sendCookies: false, storeCookies: false });
        return { status: 302, statusText: 'Found', headers: { Location: '/oauth/resource-document' }, body: '', durationMs: 1, sizeBytes: 0 };
      }
      if (request.name === 'MCP OAuth metadata' && request.url === redirectedProtectedMetadataUrl) {
        return { status: 200, statusText: 'OK', headers: {}, body: JSON.stringify({ resource: client.url, authorization_servers: ['https://identity.example.test/tenant'], scopes_supported: ['metadata.scope'] }), durationMs: 1, sizeBytes: 1 };
      }
      if (request.name === 'MCP OAuth metadata' && request.url === authorizationMetadataUrl) {
        return { status: 307, statusText: 'Temporary Redirect', headers: { location: '/tenant/oauth-server-document' }, body: '', durationMs: 1, sizeBytes: 0 };
      }
      if (request.name === 'MCP OAuth metadata' && request.url === redirectedAuthorizationMetadataUrl) {
        return { status: 200, statusText: 'OK', headers: {}, body: JSON.stringify({ issuer: 'https://identity.example.test/tenant', authorization_endpoint: 'https://identity.example.test/tenant/authorize', token_endpoint: 'https://identity.example.test/tenant/token', registration_endpoint: registrationUrl, response_types_supported: ['code'], grant_types_supported: ['authorization_code', 'refresh_token'], code_challenge_methods_supported: ['S256'] }), durationMs: 1, sizeBytes: 1 };
      }
      if (request.name === 'MCP OAuth dynamic client registration') {
        expect(request.url).toBe(registrationUrl);
        expect(JSON.parse(request.body)).toMatchObject({ token_endpoint_auth_method: 'none', scope: 'challenge.scope' });
        return { status: 201, statusText: 'Created', headers: {}, body: JSON.stringify({ client_id: 'dynamic-client', token_endpoint_auth_method: 'none', client_id_issued_at: 123 }), durationMs: 1, sizeBytes: 1 };
      }
      const message = JSON.parse(request.body) as { id?: string; method: string };
      if (message.method === 'initialize' && request.auth.type === 'none') {
        return { status: 401, statusText: 'Unauthorized', headers: { 'WWW-Authenticate': 'Bearer resource_metadata="/.well-known/oauth-protected-resource", scope="challenge.scope"' }, body: '', durationMs: 1, sizeBytes: 0 };
      }
      if (message.method === 'initialize') {
        expect(request.auth).toMatchObject({ type: 'oauth2', clientId: 'dynamic-client', authorizationUrl: 'https://identity.example.test/tenant/authorize', accessTokenUrl: 'https://identity.example.test/tenant/token', scope: 'challenge.scope', resource: client.url, usePkce: true });
        context.onOAuth2Token?.({ ...request, auth: { ...request.auth, accessToken: 'dynamic-access', refreshToken: 'dynamic-refresh', expiresAt: Date.now() + 60_000 } });
      }
      const results: Record<string, unknown> = {
        initialize: { protocolVersion: '2025-06-18', capabilities: {} },
        'tools/list': { tools: [] },
        'prompts/list': { prompts: [] },
        'resources/list': { resources: [] },
        'resources/templates/list': { resourceTemplates: [] },
      };
      return { status: 200, statusText: 'OK', headers: message.method === 'initialize' ? { 'Mcp-Session-Id': 'dynamic-session' } : {}, body: message.id ? JSON.stringify({ jsonrpc: '2.0', id: message.id, result: results[message.method] ?? {} }) : '', durationMs: 1, sizeBytes: 0 };
    });

    const output = await discoverMcpClient(client, undefined, { validateAuthCertificates: false, onMcpClient: (updated) => persistedClients.push(structuredClone(updated)) });

    expect(output.client).toMatchObject({ oauthRegisteredClientId: 'dynamic-client', oauthRegisteredClientIdIssuedAt: 123, oauthScope: 'challenge.scope', token: 'dynamic-access', oauthRefreshToken: 'dynamic-refresh' });
    expect(output.events.some((event) => event.method === 'MCP OAuth · dynamic client registration')).toBe(true);
    expect(output.events.some((event) => event.detail === redirectedProtectedMetadataUrl)).toBe(true);
    expect(output.events.some((event) => event.detail === redirectedAuthorizationMetadataUrl)).toBe(true);
    expect(protectedRequests.filter((request) => request.name === 'OAuth tools · initialize')).toHaveLength(2);
    expect(persistedClients.some((updated) => updated.oauthRegisteredClientId === 'dynamic-client' && !updated.token)).toBe(true);
    expect(persistedClients.some((updated) => updated.token === 'dynamic-access')).toBe(true);
  });

  it('re-authorizes once with a server-requested scope after insufficient_scope', async () => {
    const client = oauthClient();
    client.token = 'old-access';
    const seenScopes: string[] = [];
    transport.sendRequest.mockImplementation(async (request: ApiRequest, _environment: unknown, context: SendRequestContext) => {
      if (!request) return { status: 204, statusText: 'No Content', headers: {}, body: '', durationMs: 0, sizeBytes: 0 };
      const message = JSON.parse(request.body) as { id?: string; method: string };
      if (message.method === 'initialize') {
        seenScopes.push(request.auth.scope);
        if (request.auth.accessToken === 'old-access') {
          return { status: 403, statusText: 'Forbidden', headers: { 'WWW-Authenticate': 'Bearer error="insufficient_scope", scope="mcp.admin"' }, body: '', durationMs: 1, sizeBytes: 0 };
        }
        context.onOAuth2Token?.({ ...request, auth: { ...request.auth, accessToken: 'step-up-access', expiresAt: Date.now() + 60_000 } });
      }
      const results: Record<string, unknown> = {
        initialize: { protocolVersion: '2025-06-18', capabilities: {} },
        'tools/list': { tools: [] },
        'prompts/list': { prompts: [] },
        'resources/list': { resources: [] },
        'resources/templates/list': { resourceTemplates: [] },
      };
      return { status: 200, statusText: 'OK', headers: {}, body: message.id ? JSON.stringify({ jsonrpc: '2.0', id: message.id, result: results[message.method] ?? {} }) : '', durationMs: 1, sizeBytes: 0 };
    });

    const output = await discoverMcpClient(client, undefined, {});

    expect(seenScopes).toEqual(['mcp.read mcp.invoke', 'mcp.admin']);
    expect(output.client).toMatchObject({ oauthScope: 'mcp.admin', token: 'step-up-access' });
    expect(output.events.some((event) => event.detail.includes('403 insufficient_scope'))).toBe(true);
  });

  it('rejects insecure, looping, and excessive metadata redirects before registration', async () => {
    const client = oauthClient();
    client.oauthAuthorizationUrl = '';
    client.oauthAccessTokenUrl = '';
    client.oauthClientId = '';
    client.oauthScope = '';
    const metadataUrl = 'https://mcp.example.test/.well-known/oauth-protected-resource';
    const seen: string[] = [];
    transport.sendRequest.mockImplementation(async (request: ApiRequest) => {
      seen.push(request.url);
      if (request.name !== 'MCP OAuth metadata') {
        return { status: 401, statusText: 'Unauthorized', headers: { 'WWW-Authenticate': `Bearer resource_metadata=\"${metadataUrl}\"` }, body: '', durationMs: 1, sizeBytes: 0 };
      }
      return { status: 302, statusText: 'Found', headers: { location: 'http://metadata.example.test/document' }, body: '', durationMs: 1, sizeBytes: 0 };
    });

    await expect(discoverMcpClient(client, undefined, {})).rejects.toThrow('HTTPS');
    expect(seen).not.toContain('http://metadata.example.test/document');

    transport.sendRequest.mockImplementation(async (request: ApiRequest) => {
      if (!request) return { status: 204, statusText: 'No Content', headers: {}, body: '', durationMs: 0, sizeBytes: 0 };
      return request.name === 'MCP OAuth metadata'
        ? { status: 302, statusText: 'Found', headers: { location: metadataUrl }, body: '', durationMs: 1, sizeBytes: 0 }
        : { status: 401, statusText: 'Unauthorized', headers: { 'WWW-Authenticate': `Bearer resource_metadata=\"${metadataUrl}\"` }, body: '', durationMs: 1, sizeBytes: 0 };
    });
    await expect(discoverMcpClient(client, undefined, {})).rejects.toThrow('redirect loop');

    transport.sendRequest.mockImplementation(async (request: ApiRequest) => {
      if (!request) return { status: 204, statusText: 'No Content', headers: {}, body: '', durationMs: 0, sizeBytes: 0 };
      if (request.name !== 'MCP OAuth metadata') {
        return { status: 401, statusText: 'Unauthorized', headers: { 'WWW-Authenticate': `Bearer resource_metadata=\"${metadataUrl}\"` }, body: '', durationMs: 1, sizeBytes: 0 };
      }
      const match = /\/redirect\/(\d+)$/.exec(request.url);
      const next = match ? Number(match[1]) + 1 : 1;
      return { status: 302, statusText: 'Found', headers: { location: `/redirect/${next}` }, body: '', durationMs: 1, sizeBytes: 0 };
    });
    await expect(discoverMcpClient(client, undefined, {})).rejects.toThrow('exceeded 20 redirects');
  });

  it('aborts an in-flight HTTP operation and sends notifications/cancelled', async () => {
    const client = oauthClient();
    const requests: ApiRequest[] = [];
    transport.sendRequest.mockImplementation(async (request: ApiRequest, _environment: unknown, context: SendRequestContext) => {
      if (!request) return { status: 204, statusText: 'No Content', headers: {}, body: '', durationMs: 0, sizeBytes: 0 };
      requests.push(request);
      const message = JSON.parse(request.body) as { id?: string; method: string; params?: { requestId?: string } };
      if (message.method === 'notifications/cancelled') {
        return { status: 202, statusText: 'Accepted', headers: {}, body: '', durationMs: 1, sizeBytes: 0 };
      }
      if (message.method === 'initialize') {
        context.onOAuth2Token?.({ ...request, auth: { ...request.auth, accessToken: 'initial-access', expiresAt: Date.now() + 60_000 } });
        return { status: 200, statusText: 'OK', headers: { 'Mcp-Session-Id': 'cancel-session' }, body: JSON.stringify({ jsonrpc: '2.0', id: message.id, result: { protocolVersion: '2025-06-18', capabilities: {} } }), durationMs: 1, sizeBytes: 1 };
      }
      if (message.method === 'notifications/initialized') {
        return { status: 202, statusText: 'Accepted', headers: {}, body: '', durationMs: 1, sizeBytes: 0 };
      }
      context.onOAuth2Token?.({ ...request, auth: { ...request.auth, accessToken: 'refreshed-during-call', expiresAt: Date.now() + 60_000 } });
      return new Promise((_resolve, reject) => context.signal?.addEventListener('abort', () => reject(context.signal?.reason), { once: true }));
    });
    const controller = new AbortController();
    const pending = discoverMcpClient(client, undefined, { signal: controller.signal, cancellationId: 'mcp-http-cancel' });
    await vi.waitFor(() => expect(requests.some((request) => JSON.parse(request.body).method === 'tools/list')).toBe(true));
    const toolsRequest = requests.find((request) => JSON.parse(request.body).method === 'tools/list');
    const toolsMessage = JSON.parse(toolsRequest?.body ?? '{}') as { id: string };
    controller.abort(new DOMException('MCP operation canceled.', 'AbortError'));

    await expect(pending).rejects.toThrow('MCP operation canceled');
    await vi.waitFor(() => expect(requests.some((request) => JSON.parse(request.body).method === 'notifications/cancelled')).toBe(true));
    const cancellation = requests.find((request) => JSON.parse(request.body).method === 'notifications/cancelled');
    expect(JSON.parse(cancellation?.body ?? '{}').params.requestId).toBe(toolsMessage.id);
    expect(cancellation?.headers).toContainEqual(expect.objectContaining({ name: 'Mcp-Session-Id', value: 'cancel-session' }));
    expect(cancellation?.headers).toContainEqual(expect.objectContaining({ name: 'Mcp-Protocol-Version', value: '2025-06-18' }));
    expect(cancellation?.auth).toMatchObject({ type: 'oauth2', accessToken: 'refreshed-during-call' });
    expect(cancellation?.transport).toMatchObject({ followRedirects: false, timeoutMs: 5_000, sendCookies: false, storeCookies: false });
  });

  it('reuses and explicitly terminates project-scoped HTTP sessions', async () => {
    const client = oauthClient();
    client.authType = 'none';
    const requests: ApiRequest[] = [];
    let initializeCount = 0;
    transport.sendRequest.mockImplementation(async (request: ApiRequest) => {
      requests.push(request);
      if (request.method === 'DELETE') return { status: 204, statusText: 'No Content', headers: {}, body: '', durationMs: 1, sizeBytes: 0 };
      const message = JSON.parse(request.body) as { id?: string; method: string };
      if (message.method === 'initialize') {
        initializeCount += 1;
        return { status: 200, statusText: 'OK', headers: { 'Mcp-Session-Id': `session-${initializeCount}` }, body: JSON.stringify({ jsonrpc: '2.0', id: message.id, result: { protocolVersion: '2025-06-18', capabilities: {} } }), durationMs: 1, sizeBytes: 1 };
      }
      if (message.method === 'notifications/initialized') return { status: 202, statusText: 'Accepted', headers: {}, body: '', durationMs: 1, sizeBytes: 0 };
      const result = message.method === 'tools/list' ? { tools: [] } : message.method === 'prompts/list' ? { prompts: [] } : message.method === 'resources/list' ? { resources: [] } : { resourceTemplates: [] };
      return { status: 200, statusText: 'OK', headers: {}, body: JSON.stringify({ jsonrpc: '2.0', id: message.id, result }), durationMs: 1, sizeBytes: 1 };
    });

    const first = await discoverMcpClient(client, undefined, { sessionScope: 'project-a' });
    const second = await discoverMcpClient(first.client, undefined, { sessionScope: 'project-a' });
    await discoverMcpClient(first.client, undefined, { sessionScope: 'project-b' });

    expect(initializeCount).toBe(2);
    expect(second.events).toContainEqual(expect.objectContaining({ method: 'MCP session', detail: 'Reused the active HTTP session.' }));
    expect(hasMcpClientSession(first.client, 'project-a')).toBe(true);
    expect(hasMcpClientSession(first.client, 'project-b')).toBe(true);
    const disconnected = await disconnectMcpClient(first.client, undefined, { sessionScope: 'project-a' });
    expect(disconnected.terminated).toBe(true);
    const termination = requests.find((request) => request.method === 'DELETE');
    expect(termination?.headers).toContainEqual(expect.objectContaining({ name: 'Mcp-Session-Id', value: 'session-1' }));
    expect(termination?.headers).toContainEqual(expect.objectContaining({ name: 'Mcp-Protocol-Version', value: '2025-06-18' }));
    expect(requests.filter((request) => request.method === 'DELETE' || JSON.parse(request.body).method !== 'initialize').every((request) => request.headers.some((header) => header.name === 'Mcp-Protocol-Version' && header.value === '2025-06-18'))).toBe(true);
    expect(hasMcpClientSession(first.client, 'project-a')).toBe(false);
    expect(hasMcpClientSession(first.client, 'project-b')).toBe(true);
  });

  it('reinitializes once when a server rejects an expired HTTP session', async () => {
    const client = oauthClient();
    client.authType = 'none';
    let initializeCount = 0;
    let expireFirstSession = false;
    const toolSessions: string[] = [];
    transport.sendRequest.mockImplementation(async (request: ApiRequest) => {
      const message = JSON.parse(request.body) as { id?: string; method: string };
      const sessionId = request.headers.find((header) => header.name === 'Mcp-Session-Id')?.value ?? '';
      if (message.method === 'initialize') {
        initializeCount += 1;
        return { status: 200, statusText: 'OK', headers: { 'Mcp-Session-Id': initializeCount === 1 ? 'expired-session' : 'replacement-session' }, body: JSON.stringify({ jsonrpc: '2.0', id: message.id, result: { protocolVersion: '2025-06-18', capabilities: {} } }), durationMs: 1, sizeBytes: 1 };
      }
      if (message.method === 'notifications/initialized') return { status: 202, statusText: 'Accepted', headers: {}, body: '', durationMs: 1, sizeBytes: 0 };
      if (message.method === 'tools/call') {
        toolSessions.push(sessionId);
        if (expireFirstSession && sessionId === 'expired-session') return { status: 404, statusText: 'Not Found', headers: {}, body: 'session expired', durationMs: 1, sizeBytes: 0 };
        return { status: 200, statusText: 'OK', headers: {}, body: JSON.stringify({ jsonrpc: '2.0', id: message.id, result: { content: [{ type: 'text', text: 'ok' }] } }), durationMs: 1, sizeBytes: 1 };
      }
      const result = message.method === 'tools/list' ? { tools: [{ name: 'search', description: '', inputSchema: {} }] } : message.method === 'prompts/list' ? { prompts: [] } : message.method === 'resources/list' ? { resources: [] } : { resourceTemplates: [] };
      return { status: 200, statusText: 'OK', headers: {}, body: JSON.stringify({ jsonrpc: '2.0', id: message.id, result }), durationMs: 1, sizeBytes: 1 };
    });

    const discovered = await discoverMcpClient(client, undefined, { sessionScope: 'project-recovery' });
    expireFirstSession = true;
    const output = await invokeMcpOperation(discovered.client, 'tool', 'search', {}, undefined, { sessionScope: 'project-recovery' });

    expect(initializeCount).toBe(2);
    expect(toolSessions).toEqual(['expired-session', 'replacement-session']);
    expect(output.events).toContainEqual(expect.objectContaining({ method: 'MCP session', detail: expect.stringContaining('expired HTTP session') }));
    expect(hasMcpClientSession(output.client, 'project-recovery')).toBe(true);
  });

  it('reuses a logical HTTP connection when the server omits a session identity', async () => {
    const client = oauthClient();
    client.authType = 'none';
    let initializeCount = 0;
    transport.sendRequest.mockImplementation(async (request: ApiRequest) => {
      const message = JSON.parse(request.body) as { id?: string; method: string };
      if (message.method === 'initialize') initializeCount += 1;
      const result = message.method === 'initialize'
        ? { protocolVersion: '2025-06-18', capabilities: {} }
        : message.method === 'tools/list'
          ? { tools: [] }
          : message.method === 'prompts/list'
            ? { prompts: [] }
            : message.method === 'resources/list'
              ? { resources: [] }
              : { resourceTemplates: [] };
      return { status: message.id ? 200 : 202, statusText: 'OK', headers: {}, body: message.id ? JSON.stringify({ jsonrpc: '2.0', id: message.id, result }) : '', durationMs: 1, sizeBytes: 1 };
    });

    const first = await discoverMcpClient(client, undefined, { sessionScope: 'stateless' });
    await discoverMcpClient(first.client, undefined, { sessionScope: 'stateless' });
    expect(initializeCount).toBe(1);
    expect(hasMcpClientSession(first.client, 'stateless')).toBe(true);
    expect((await disconnectMcpClient(first.client, undefined, { sessionScope: 'stateless' })).terminated).toBe(false);
    expect(hasMcpClientSession(first.client, 'stateless')).toBe(false);
  });

  it('rejects oversized HTTP session identities before caching them', async () => {
    const client = oauthClient();
    client.authType = 'none';
    transport.sendRequest.mockResolvedValue({ status: 200, statusText: 'OK', headers: { 'Mcp-Session-Id': 'x'.repeat(4_097) }, body: '{}', durationMs: 1, sizeBytes: 1 });
    await expect(discoverMcpClient(client, undefined, {})).rejects.toThrow('oversized session identity');
    expect(hasMcpClientSession(client)).toBe(false);
  });
});
