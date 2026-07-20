import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { McpClient } from '../types';
import { disconnectMcpClient, discoverMcpClient, forgetMcpClientSession, hasMcpClientSession, invokeMcpOperation, parseMcpJsonRpcResponse } from './mcp';

const tauri = vi.hoisted(() => {
  class Channel<T> {
    onmessage: (message: T) => void = () => undefined;
  }
  return { Channel, invoke: vi.fn(), isTauri: vi.fn(() => true) };
});
vi.mock('@tauri-apps/api/core', () => tauri);

beforeEach(() => {
  tauri.invoke.mockReset();
  tauri.isTauri.mockReturnValue(true);
  ['', 'project-a', 'project-failure'].forEach((scope) => forgetMcpClientSession('stdio', scope));
});

const stdioClient = (): McpClient => ({
  id: 'stdio', name: 'STDIO tools', enabled: true, transport: 'stdio', url: '', command: '/usr/bin/server', args: ['--stdio'], env: [], headers: [], authType: 'none', token: '', username: '', password: '', oauthAuthorizationUrl: '', oauthAccessTokenUrl: '', oauthClientId: '', oauthClientSecret: '', oauthScope: '', oauthState: '', oauthRefreshToken: '', oauthIdentityToken: '', oauthExpiresAt: 0, oauthTokenPrefix: 'Bearer', oauthRegisteredClientId: '', oauthRegisteredClientSecret: '', oauthRegisteredClientIdIssuedAt: 0, oauthRegisteredClientSecretExpiresAt: 0, oauthRegisteredTokenEndpointAuthMethod: 'none', roots: ['file:///project'], tools: [], prompts: [], resources: [], resourceTemplates: [],
});

const httpClient = (): McpClient => ({
  ...stdioClient(),
  id: 'http-stream',
  name: 'HTTP tools',
  transport: 'http',
  url: 'https://mcp.example.test/rpc',
  command: '',
  args: [],
  roots: [],
});

const nativeResponse = (status: number, body = '', headers: Record<string, string> = {}) => ({
  status,
  statusText: status === 200 ? 'OK' : status === 202 ? 'Accepted' : 'No Content',
  headers,
  headerLines: Object.entries(headers).map(([name, value]) => ({ name, value })),
  body,
  durationMs: 1,
  sizeBytes: body.length,
  setCookies: [],
  httpVersion: 'HTTP/1.1',
  effectiveUrl: 'https://mcp.example.test/rpc',
  redirects: [],
  redirectsTruncated: false,
});

describe('MCP JSON-RPC transport parsing', () => {
  it('parses ordinary JSON responses', () => {
    expect(parseMcpJsonRpcResponse('{"jsonrpc":"2.0","id":"one","result":{"tools":[]}}', 'one').result).toEqual({ tools: [] });
  });

  it('parses SSE notifications followed by the matching response', () => {
    const parsed = parseMcpJsonRpcResponse([
      'event: message',
      'data: {"jsonrpc":"2.0","method":"notifications/tools/list_changed"}',
      '',
      'event: message',
      'data: {"jsonrpc":"2.0","id":"two","result":{"tools":[{"name":"search"}]}}',
      '',
    ].join('\n'), 'two');
    expect(parsed.result).toEqual({ tools: [{ name: 'search' }] });
    expect(parsed.events[0].method).toBe('notifications/tools/list_changed');
  });

  it('surfaces JSON-RPC errors', () => {
    expect(() => parseMcpJsonRpcResponse('{"jsonrpc":"2.0","id":"bad","error":{"code":-32601,"message":"missing"}}', 'bad')).toThrow('MCP error');
  });

  it('rejects plaintext bearer tokens before connecting', async () => {
    await expect(discoverMcpClient({ id: 'one', name: 'Tools', enabled: true, transport: 'http', url: 'https://mcp.example', command: '', args: [], env: [], headers: [], authType: 'bearer', token: 'plaintext', username: '', password: '', oauthAuthorizationUrl: '', oauthAccessTokenUrl: '', oauthClientId: '', oauthClientSecret: '', oauthScope: '', oauthState: '', oauthRefreshToken: '', oauthIdentityToken: '', oauthExpiresAt: 0, oauthTokenPrefix: 'Bearer', oauthRegisteredClientId: '', oauthRegisteredClientSecret: '', oauthRegisteredClientIdIssuedAt: 0, oauthRegisteredClientSecretExpiresAt: 0, oauthRegisteredTokenEndpointAuthMethod: 'none', roots: [], tools: [], prompts: [], resources: [], resourceTemplates: [] }, undefined, {})).rejects.toThrow('complete local-vault');
  });

  it('routes HTTP MCP calls through the native streaming bridge and closes its GET session', async () => {
    const client = httpClient();
    const liveEvents: Array<{ method: string }> = [];
    tauri.invoke.mockImplementation((command: string, args?: Record<string, any>) => {
      if (command === 'send_mcp_http_request') {
        const message = JSON.parse(args?.input.request.body) as { id?: string; method: string };
        expect(args?.onEvent).toBeInstanceOf(tauri.Channel);
        if (message.method === 'notifications/initialized') {
          args?.onEvent.onmessage({ direction: 'server', method: 'notifications/tools/list_changed', detail: '{}', timestamp: new Date().toISOString() });
          return Promise.resolve(nativeResponse(202));
        }
        const result = message.method === 'initialize'
          ? { protocolVersion: '2025-06-18', capabilities: {} }
          : { content: [{ type: 'text', text: 'done' }] };
        return Promise.resolve(nativeResponse(200, JSON.stringify([{ jsonrpc: '2.0', id: message.id, result }]), message.method === 'initialize' ? { 'mcp-session-id': 'native-session' } : {}));
      }
      if (command === 'close_mcp_http_session') return Promise.resolve(true);
      if (command === 'send_http_request') return Promise.resolve(nativeResponse(204));
      return Promise.reject(new Error(`Unexpected command ${command}`));
    });

    const output = await invokeMcpOperation(client, 'tool', 'search', {}, undefined, { sessionScope: 'native-project', onMcpEvent: (event) => liveEvents.push(event) });
    expect(output.result).toEqual({ content: [{ type: 'text', text: 'done' }] });
    expect(liveEvents).toEqual([expect.objectContaining({ method: 'notifications/tools/list_changed' })]);
    const calls = tauri.invoke.mock.calls.filter(([command]) => command === 'send_mcp_http_request');
    expect(calls).toHaveLength(3);
    expect(calls[0][1]).toMatchObject({ input: { sessionKey: '["native-project","http-stream"]', startGetStream: false } });
    expect(calls[1][1]).toMatchObject({ input: { requestId: '', startGetStream: true } });
    expect(calls[2][1]).toMatchObject({ input: { startGetStream: false } });

    await disconnectMcpClient(output.client, undefined, { sessionScope: 'native-project' });
    expect(tauri.invoke).toHaveBeenCalledWith('close_mcp_http_session', { sessionKey: '["native-project","http-stream"]' });
    expect(tauri.invoke).toHaveBeenCalledWith('send_http_request', expect.objectContaining({ input: expect.objectContaining({ method: 'DELETE' }) }));
  });

  it('cancels an in-flight native STDIO operation with the same identity', async () => {
    const client = stdioClient();
    let rejectCall: ((reason: Error) => void) | undefined;
    tauri.invoke.mockImplementation((command: string) => {
      if (command === 'mcp_stdio_call') return new Promise((_resolve, reject) => { rejectCall = reject; });
      if (command === 'cancel_mcp_stdio_call') {
        rejectCall?.(new Error('MCP STDIO request canceled.'));
        return Promise.resolve(true);
      }
      if (command === 'has_mcp_stdio_session') return Promise.resolve(false);
      return Promise.reject(new Error(`Unexpected command ${command}`));
    });
    const controller = new AbortController();
    const pending = invokeMcpOperation(client, 'tool', 'search', {}, undefined, { signal: controller.signal, cancellationId: 'mcp-stdio-cancel' });
    await vi.waitFor(() => expect(tauri.invoke).toHaveBeenCalledWith('mcp_stdio_call', expect.objectContaining({ input: expect.objectContaining({ cancellationId: 'mcp-stdio-cancel', sessionKey: '["","stdio"]' }) })));
    controller.abort(new DOMException('MCP operation canceled.', 'AbortError'));

    await expect(pending).rejects.toThrow('MCP STDIO request canceled');
    expect(tauri.invoke).toHaveBeenCalledWith('cancel_mcp_stdio_call', { cancellationId: 'mcp-stdio-cancel' });
  });

  it('reuses one project-scoped STDIO identity through cancellation and explicit disconnect', async () => {
    const client = stdioClient();
    let stdioCalls = 0;
    let rejectCall: ((reason: Error) => void) | undefined;
    tauri.invoke.mockImplementation((command: string) => {
      if (command === 'mcp_stdio_call') {
        stdioCalls += 1;
        if (stdioCalls === 2) return new Promise((_resolve, reject) => { rejectCall = reject; });
        return Promise.resolve({ result: { content: [] }, events: [], stderr: '' });
      }
      if (command === 'cancel_mcp_stdio_call') {
        rejectCall?.(new Error('MCP STDIO request canceled.'));
        return Promise.resolve(true);
      }
      if (command === 'has_mcp_stdio_session') return Promise.resolve(true);
      if (command === 'close_mcp_stdio_session') return Promise.resolve(true);
      return Promise.reject(new Error(`Unexpected command ${command}`));
    });
    const context = { sessionScope: 'project-a' };

    await invokeMcpOperation(client, 'tool', 'search', {}, undefined, context);
    expect(hasMcpClientSession(client, 'project-a')).toBe(true);
    expect(hasMcpClientSession({ ...client, command: '/usr/bin/changed' }, 'project-a')).toBe(false);
    expect(hasMcpClientSession({ ...client, env: [{ id: 'mode', name: 'MODE', value: 'changed', enabled: true }] }, 'project-a')).toBe(false);

    const controller = new AbortController();
    const pending = invokeMcpOperation(client, 'tool', 'search', {}, undefined, { ...context, signal: controller.signal, cancellationId: 'reuse-cancel' });
    await vi.waitFor(() => expect(stdioCalls).toBe(2));
    controller.abort(new DOMException('MCP operation canceled.', 'AbortError'));
    await expect(pending).rejects.toThrow('MCP STDIO request canceled');
    expect(hasMcpClientSession(client, 'project-a')).toBe(true);

    await invokeMcpOperation(client, 'tool', 'search', {}, undefined, context);
    const calls = tauri.invoke.mock.calls.filter(([command]) => command === 'mcp_stdio_call');
    expect(calls).toHaveLength(3);
    expect(calls.map(([, value]) => value.input.sessionKey)).toEqual(Array(3).fill('["project-a","stdio"]'));

    expect(await disconnectMcpClient(client, undefined, context)).toEqual(expect.objectContaining({ terminated: true }));
    expect(tauri.invoke).toHaveBeenCalledWith('close_mcp_stdio_session', { sessionKey: '["project-a","stdio"]' });
    expect(hasMcpClientSession(client, 'project-a')).toBe(false);
  });

  it('does not retain a failed STDIO spawn as connected', async () => {
    const client = stdioClient();
    tauri.invoke.mockRejectedValue(new Error('Unable to start the MCP STDIO server'));

    await expect(invokeMcpOperation(client, 'tool', 'search', {}, undefined, { sessionScope: 'project-failure' })).rejects.toThrow('Unable to start');
    expect(hasMcpClientSession(client, 'project-failure')).toBe(false);
  });

  it('renders bounded enabled STDIO environment rows and applies last duplicate wins', async () => {
    const client = stdioClient();
    client.env = [
      { id: 'mode', name: 'MODE', value: '{{ stage }}', enabled: true },
      { id: 'token', name: 'API_TOKEN', value: '{{ vault.mcp_env_token }}', enabled: true },
      { id: 'duplicate-one', name: 'DUPLICATE', value: 'first', enabled: true },
      { id: 'duplicate-two', name: 'DUPLICATE', value: 'second', enabled: true },
      { id: 'disabled', name: 'DISABLED', value: 'ignored', enabled: false },
    ];
    tauri.invoke.mockResolvedValue({ result: { content: [] }, events: [], stderr: '' });

    await invokeMcpOperation(client, 'tool', 'search', {}, { id: 'environment', name: 'Development', variables: [{ id: 'stage', name: 'stage', value: 'dev', enabled: true }] }, { vault: { 'vault.mcp_env_token': 'resolved-token' } });

    expect(tauri.invoke).toHaveBeenCalledWith('mcp_stdio_call', expect.objectContaining({ input: expect.objectContaining({ env: [
      { name: 'MODE', value: 'dev' },
      { name: 'API_TOKEN', value: 'resolved-token' },
      { name: 'DUPLICATE', value: 'second' },
    ] }) }));
  });

  it('rejects plaintext sensitive STDIO environment values before process launch', async () => {
    const client = stdioClient();
    client.env = [{ id: 'token', name: 'API_TOKEN', value: 'plaintext', enabled: true }];

    await expect(invokeMcpOperation(client, 'tool', 'search', {}, undefined, {})).rejects.toThrow("sensitive environment variable 'API_TOKEN'");
    expect(tauri.invoke).not.toHaveBeenCalled();

    client.env = [{ id: 'templated-name', name: '{{ variableName }}', value: 'plaintext', enabled: true }];
    await expect(invokeMcpOperation(client, 'tool', 'search', {}, { id: 'environment', name: 'Development', variables: [{ id: 'name', name: 'variableName', value: 'PRIVATE_KEY', enabled: true }] }, {})).rejects.toThrow("sensitive environment variable 'PRIVATE_KEY'");
    expect(tauri.invoke).not.toHaveBeenCalled();
  });

  it('does not resurrect a STDIO marker when an in-flight call settles after disconnect', async () => {
    const client = stdioClient();
    let resolveCall: ((value: { result: object; events: never[]; stderr: string }) => void) | undefined;
    let stdioCalls = 0;
    tauri.invoke.mockImplementation((command: string) => {
      if (command === 'mcp_stdio_call') {
        stdioCalls += 1;
        if (stdioCalls === 1) return Promise.resolve({ result: { content: [] }, events: [], stderr: '' });
        return new Promise((resolve) => { resolveCall = resolve; });
      }
      if (command === 'close_mcp_stdio_session') return Promise.resolve(true);
      return Promise.reject(new Error(`Unexpected command ${command}`));
    });
    const context = { sessionScope: 'project-a' };

    await invokeMcpOperation(client, 'tool', 'search', {}, undefined, context);
    const pending = invokeMcpOperation(client, 'tool', 'search', {}, undefined, context);
    await vi.waitFor(() => expect(stdioCalls).toBe(2));
    expect((await disconnectMcpClient(client, undefined, context)).terminated).toBe(true);
    resolveCall?.({ result: { content: [] }, events: [], stderr: '' });
    await pending;

    expect(hasMcpClientSession(client, 'project-a')).toBe(false);
  });
});
