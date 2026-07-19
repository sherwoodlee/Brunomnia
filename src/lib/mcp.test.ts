import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { McpClient } from '../types';
import { discoverMcpClient, invokeMcpOperation, parseMcpJsonRpcResponse } from './mcp';

const tauri = vi.hoisted(() => ({ invoke: vi.fn(), isTauri: vi.fn(() => true) }));
vi.mock('@tauri-apps/api/core', () => tauri);

beforeEach(() => {
  tauri.invoke.mockReset();
  tauri.isTauri.mockReturnValue(true);
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
    const client: McpClient = {
      id: 'stdio', name: 'STDIO tools', enabled: true, transport: 'stdio', url: '', command: '/usr/bin/server', args: ['--stdio'], headers: [], authType: 'none', token: '', username: '', password: '', oauthAuthorizationUrl: '', oauthAccessTokenUrl: '', oauthClientId: '', oauthClientSecret: '', oauthScope: '', oauthState: '', oauthRefreshToken: '', oauthIdentityToken: '', oauthExpiresAt: 0, oauthTokenPrefix: 'Bearer', oauthRegisteredClientId: '', oauthRegisteredClientSecret: '', oauthRegisteredClientIdIssuedAt: 0, oauthRegisteredClientSecretExpiresAt: 0, oauthRegisteredTokenEndpointAuthMethod: 'none', roots: ['file:///project'], tools: [], prompts: [], resources: [], resourceTemplates: [],
    };
    let rejectCall: ((reason: Error) => void) | undefined;
    tauri.invoke.mockImplementation((command: string) => {
      if (command === 'mcp_stdio_call') return new Promise((_resolve, reject) => { rejectCall = reject; });
      if (command === 'cancel_mcp_stdio_call') {
        rejectCall?.(new Error('MCP STDIO request canceled.'));
        return Promise.resolve(true);
      }
      return Promise.reject(new Error(`Unexpected command ${command}`));
    });
    const controller = new AbortController();
    const pending = invokeMcpOperation(client, 'tool', 'search', {}, undefined, { signal: controller.signal, cancellationId: 'mcp-stdio-cancel' });
    await vi.waitFor(() => expect(tauri.invoke).toHaveBeenCalledWith('mcp_stdio_call', expect.objectContaining({ input: expect.objectContaining({ cancellationId: 'mcp-stdio-cancel' }) })));
    controller.abort(new DOMException('MCP operation canceled.', 'AbortError'));

    await expect(pending).rejects.toThrow('MCP STDIO request canceled');
    expect(tauri.invoke).toHaveBeenCalledWith('cancel_mcp_stdio_call', { cancellationId: 'mcp-stdio-cancel' });
  });
});
