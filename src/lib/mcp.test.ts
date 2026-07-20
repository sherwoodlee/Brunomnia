import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { McpClient } from '../types';
import { disconnectMcpClient, discoverMcpClient, forgetMcpClientSession, hasMcpClientSession, invokeMcpOperation, parseMcpJsonRpcResponse } from './mcp';

const tauri = vi.hoisted(() => ({ invoke: vi.fn(), isTauri: vi.fn(() => true) }));
vi.mock('@tauri-apps/api/core', () => tauri);

beforeEach(() => {
  tauri.invoke.mockReset();
  tauri.isTauri.mockReturnValue(true);
  ['', 'project-a', 'project-failure'].forEach((scope) => forgetMcpClientSession('stdio', scope));
});

const stdioClient = (): McpClient => ({
  id: 'stdio', name: 'STDIO tools', enabled: true, transport: 'stdio', url: '', command: '/usr/bin/server', args: ['--stdio'], headers: [], authType: 'none', token: '', username: '', password: '', oauthAuthorizationUrl: '', oauthAccessTokenUrl: '', oauthClientId: '', oauthClientSecret: '', oauthScope: '', oauthState: '', oauthRefreshToken: '', oauthIdentityToken: '', oauthExpiresAt: 0, oauthTokenPrefix: 'Bearer', oauthRegisteredClientId: '', oauthRegisteredClientSecret: '', oauthRegisteredClientIdIssuedAt: 0, oauthRegisteredClientSecretExpiresAt: 0, oauthRegisteredTokenEndpointAuthMethod: 'none', roots: ['file:///project'], tools: [], prompts: [], resources: [], resourceTemplates: [],
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
    await expect(discoverMcpClient({ id: 'one', name: 'Tools', enabled: true, transport: 'http', url: 'https://mcp.example', command: '', args: [], headers: [], authType: 'bearer', token: 'plaintext', username: '', password: '', oauthAuthorizationUrl: '', oauthAccessTokenUrl: '', oauthClientId: '', oauthClientSecret: '', oauthScope: '', oauthState: '', oauthRefreshToken: '', oauthIdentityToken: '', oauthExpiresAt: 0, oauthTokenPrefix: 'Bearer', oauthRegisteredClientId: '', oauthRegisteredClientSecret: '', oauthRegisteredClientIdIssuedAt: 0, oauthRegisteredClientSecretExpiresAt: 0, oauthRegisteredTokenEndpointAuthMethod: 'none', roots: [], tools: [], prompts: [], resources: [], resourceTemplates: [] }, undefined, {})).rejects.toThrow('complete local-vault');
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
