import { describe, expect, it } from 'vitest';
import type { McpClient, McpHistorySession } from '../types';
import { appendMcpHistoryEvents, clearMcpHistorySessions, createMcpHistorySession, deleteMcpHistorySession, filterMcpHistoryEvents, finishMcpHistorySession, markMcpHistoryConnected, mcpEventCategory, mcpHistorySections, normalizeMcpHistorySessions, retainMcpHistorySession, visibleMcpHistory } from './mcpHistory';

const client = (id = 'client-a'): McpClient => ({
  id,
  name: `Client ${id}`,
  enabled: true,
  transport: 'http',
  url: 'https://mcp.example/rpc',
  command: '',
  args: [],
  env: [],
  headers: [],
  authType: 'none',
  token: '',
  username: '',
  password: '',
  oauthAuthorizationUrl: '',
  oauthAccessTokenUrl: '',
  oauthClientId: '',
  oauthClientSecret: '',
  oauthScope: '',
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

const session = (id: string, clientId = 'client-a', environmentId = 'dev', startedAt = '2026-07-19T12:00:00.000Z') => createMcpHistorySession(client(clientId), environmentId, id, startedAt);

describe('MCP response history', () => {
  it('retains connection history by client and environment policy', () => {
    const devOld = session('dev-old', 'client-a', 'dev', '2026-07-19T10:00:00.000Z');
    const prod = session('prod', 'client-a', 'prod', '2026-07-19T11:00:00.000Z');
    const other = session('other', 'client-b', 'dev', '2026-07-19T11:30:00.000Z');
    const devNew = session('dev-new', 'client-a', 'dev', '2026-07-19T12:00:00.000Z');

    const retained = retainMcpHistorySession([devOld, prod, other], devNew, 1, true);
    expect(retained.map(({ id }) => id)).toEqual(['dev-new', 'other', 'prod']);
    expect(retained.find(({ id }) => id === 'dev-old')).toBeUndefined();
    expect(visibleMcpHistory(retained, 'client-a', 'dev', true).map(({ id }) => id)).toEqual(['dev-new']);
    expect(visibleMcpHistory(retained, 'client-a', 'dev', false).map(({ id }) => id)).toEqual(['dev-new', 'prod']);
    expect(retainMcpHistorySession([devOld], devNew, 0, false)).toEqual([]);
  });

  it('records responses, separates notifications, filters, and clears only the view', () => {
    let sessions = retainMcpHistorySession([], session('active'), 20, false);
    sessions = markMcpHistoryConnected(sessions, 'active', '2026-07-19T12:00:01.000Z');
    sessions = appendMcpHistoryEvents(sessions, 'active', [
      { direction: 'client', method: 'tools/call', detail: '{"name":"search"}', timestamp: '2026-07-19T12:00:02.000Z' },
      { direction: 'server', method: 'tools/call', detail: '{"result":{"ok":true}}', timestamp: '2026-07-19T12:00:03.000Z' },
      { direction: 'server', method: 'notifications/resources/updated', detail: '{"params":{"uri":"file:///project"}}', timestamp: '2026-07-19T12:00:04.000Z' },
      { direction: 'stderr', method: 'stderr', detail: 'diagnostic', timestamp: '2026-07-19T12:00:05.000Z' },
    ]);
    const active = sessions[0];
    expect(active.status).toBe('connected');
    expect(active.timeline).toHaveLength(6);
    expect(filterMcpHistoryEvents(active.events, 'events', 'message', 'result')).toHaveLength(1);
    expect(filterMcpHistoryEvents(active.events, 'notifications', '', 'project')).toHaveLength(1);
    expect(filterMcpHistoryEvents(active.events, 'events', '', '', '2026-07-19T12:00:03.000Z').map(({ method }) => method)).toEqual(['stderr']);
    expect(mcpEventCategory({ direction: 'server', method: 'notifications/tools/list_changed', detail: '{}' })).toBe('notification');
    const oversized = appendMcpHistoryEvents(sessions, 'active', [{ direction: 'server', method: 'tools/call', detail: 'x'.repeat(1_000_100), timestamp: '2026-07-19T12:00:06.000Z' }]);
    expect(oversized[0].events.at(-1)?.detail).toHaveLength(1_000_000);
  });

  it('finalizes, groups, deletes, clears, and normalizes bounded device-local records', () => {
    let sessions = [
      finishMcpHistorySession([session('recent', 'client-a', 'dev', '2026-07-22T12:00:00.000Z')], 'recent', 'disconnected', 'Closed.', '2026-07-22T12:01:00.000Z')[0],
      session('week', 'client-a', 'dev', '2026-07-19T12:00:00.000Z'),
      session('other-client', 'client-b', 'dev', '2026-07-22T12:00:00.000Z'),
    ];
    expect(mcpHistorySections(sessions, new Date('2026-07-22T12:02:00.000Z')).map(({ label }) => label)).toEqual(['Just Now', 'This Week']);
    sessions = deleteMcpHistorySession(sessions, 'week');
    expect(sessions.some(({ id }) => id === 'week')).toBe(false);
    sessions = clearMcpHistorySessions(sessions, 'client-a', 'dev');
    expect(sessions.map(({ id }) => id)).toEqual(['other-client']);

    const malformed = { ...session('normalized'), status: 'unknown', events: [{ direction: 'invalid', method: 42, detail: 'ok', timestamp: '2026-07-19T12:00:00.000Z' }], timeline: [{ name: 'HeaderIn', value: 'line', elapsedMs: -4 }] } as unknown as McpHistorySession;
    const normalized = normalizeMcpHistorySessions([malformed, session('missing-client', 'missing')], new Set(['client-a']), new Set(['dev']));
    expect(normalized).toEqual([expect.objectContaining({ id: 'normalized', status: 'disconnected', events: [expect.objectContaining({ direction: 'server', method: 'message', category: 'message' })], timeline: [expect.objectContaining({ name: 'Text', elapsedMs: 0 })] })]);
  });
});
