import { createServer, type Server } from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { McpClient } from '../types';
import { disconnectMcpClient, discoverMcpClient, forgetMcpClientSession, invokeMcpOperation } from './mcp';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(), isTauri: () => false }));

let server: Server | undefined;

afterEach(async () => {
  forgetMcpClientSession('loopback-mcp', 'loopback-project');
  if (!server) return;
  server.closeAllConnections();
  await new Promise<void>((resolve) => server?.close(() => resolve()));
  server = undefined;
});

const clientFor = (url: string): McpClient => ({
  id: 'loopback-mcp', name: 'Loopback MCP', enabled: true, transport: 'http', url, command: '', args: [], headers: [], authType: 'none', token: '', username: '', password: '', oauthAuthorizationUrl: '', oauthAccessTokenUrl: '', oauthClientId: '', oauthClientSecret: '', oauthScope: '', oauthState: '', oauthRefreshToken: '', oauthIdentityToken: '', oauthExpiresAt: 0, oauthTokenPrefix: 'Bearer', oauthRegisteredClientId: '', oauthRegisteredClientSecret: '', oauthRegisteredClientIdIssuedAt: 0, oauthRegisteredClientSecretExpiresAt: 0, oauthRegisteredTokenEndpointAuthMethod: 'none', roots: [], tools: [], prompts: [], resources: [], resourceTemplates: [],
});

describe('MCP Streamable HTTP session lifecycle', () => {
  it('reuses, replaces, and terminates a real loopback session', async () => {
    let initializeCount = 0;
    let rejectFirstSession = false;
    let terminatedSession = '';
    const operationSessions: string[] = [];
    const protocolHeaders: string[] = [];
    server = createServer(async (request, response) => {
      response.setHeader('Connection', 'close');
      const sessionId = String(request.headers['mcp-session-id'] ?? '');
      if (request.method === 'DELETE') {
        terminatedSession = sessionId;
        protocolHeaders.push(String(request.headers['mcp-protocol-version'] ?? ''));
        response.writeHead(204).end();
        return;
      }
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));
      const message = JSON.parse(Buffer.concat(chunks).toString('utf8')) as { id?: string; method: string };
      if (message.method !== 'initialize') protocolHeaders.push(String(request.headers['mcp-protocol-version'] ?? ''));
      if (message.method === 'initialize') {
        initializeCount += 1;
        response.writeHead(200, { 'Content-Type': 'application/json', 'Mcp-Session-Id': `loopback-session-${initializeCount}` });
        response.end(JSON.stringify({ jsonrpc: '2.0', id: message.id, result: { protocolVersion: '2025-06-18', capabilities: {} } }));
        return;
      }
      if (message.method === 'notifications/initialized') {
        response.writeHead(202).end();
        return;
      }
      if (message.method === 'tools/call') {
        operationSessions.push(sessionId);
        if (rejectFirstSession && sessionId === 'loopback-session-1') {
          response.writeHead(404, { 'Content-Type': 'text/plain' }).end('session expired');
          return;
        }
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ jsonrpc: '2.0', id: message.id, result: { content: [{ type: 'text', text: 'ok' }] } }));
        return;
      }
      const result = message.method === 'tools/list'
        ? { tools: [{ name: 'search', description: 'Search', inputSchema: {} }] }
        : message.method === 'prompts/list'
          ? { prompts: [] }
          : message.method === 'resources/list'
            ? { resources: [] }
            : { resourceTemplates: [] };
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ jsonrpc: '2.0', id: message.id, result }));
    });
    await new Promise<void>((resolve) => server?.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Loopback MCP server did not expose a TCP port.');
    const client = clientFor(`http://127.0.0.1:${address.port}/mcp`);
    const context = { sessionScope: 'loopback-project', requestTimeoutMs: 5_000 };

    const discovered = await discoverMcpClient(client, undefined, context);
    await discoverMcpClient(discovered.client, undefined, context);
    expect(initializeCount).toBe(1);

    rejectFirstSession = true;
    const invoked = await invokeMcpOperation(discovered.client, 'tool', 'search', {}, undefined, context);
    expect(invoked.result).toEqual({ content: [{ type: 'text', text: 'ok' }] });
    expect(initializeCount).toBe(2);
    expect(operationSessions).toEqual(['loopback-session-1', 'loopback-session-2']);

    expect((await disconnectMcpClient(invoked.client, undefined, context)).terminated).toBe(true);
    expect(terminatedSession).toBe('loopback-session-2');
    expect(protocolHeaders).not.toContain('');
    expect(new Set(protocolHeaders)).toEqual(new Set(['2025-06-18']));
  });
});
