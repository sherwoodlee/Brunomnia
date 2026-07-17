import { describe, expect, it } from 'vitest';
import { discoverMcpClient, parseMcpJsonRpcResponse } from './mcp';

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
    await expect(discoverMcpClient({ id: 'one', name: 'Tools', enabled: true, transport: 'http', url: 'https://mcp.example', command: '', args: [], headers: [], authType: 'bearer', token: 'plaintext', username: '', password: '', roots: [], tools: [], prompts: [], resources: [], resourceTemplates: [] }, undefined, {})).rejects.toThrow('complete local-vault');
  });
});
