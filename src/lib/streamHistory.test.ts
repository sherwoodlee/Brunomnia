import { describe, expect, it } from 'vitest';
import { cloneSeedWorkspace } from '../data/seed';
import { restoreRequestSnapshot } from './historicalRequest';
import { appendStreamSessionMessage, applyStreamConnectionMetadata, clearStoredStreamSessions, createStreamSession, deleteStoredStreamSession, filterStreamMessages, retainStreamSessionHistory, streamHistorySections, streamMessageCategory, visibleStreamSessionHistory } from './streamHistory';

describe('stream session history', () => {
  it('retains request/environment scoped sessions and incrementally closes logs', () => {
    const workspace = cloneSeedWorkspace();
    const request = workspace.collections[0].requests[0];
    request.protocol = 'socketio';
    const first = createStreamSession(request, 'env-a', 'stream-a', '2026-07-18T12:00:00.000Z');
    const second = createStreamSession(request, 'env-a', 'stream-b', '2026-07-18T13:00:00.000Z');
    const otherEnvironment = createStreamSession(request, 'env-b', 'stream-c', '2026-07-18T14:00:00.000Z');
    let sessions = retainStreamSessionHistory([], first, 1, true);
    sessions = retainStreamSessionHistory(sessions, second, 1, true);
    sessions = retainStreamSessionHistory(sessions, otherEnvironment, 1, true);
    expect(sessions.map((session) => session.id)).toEqual(['stream-c', 'stream-b']);

    sessions = appendStreamSessionMessage(sessions, 'stream-b', { id: 'event-1', sessionId: 'stream-b', direction: 'system', kind: 'open', text: 'Connected', timestamp: '2026-07-18T13:00:01.000Z' });
    sessions = appendStreamSessionMessage(sessions, 'stream-b', { id: 'event-2', sessionId: 'stream-b', direction: 'system', kind: 'closed', text: 'Disconnected', timestamp: '2026-07-18T13:01:00.000Z' });
    expect(sessions.find((session) => session.id === 'stream-b')).toMatchObject({ endedAt: '2026-07-18T13:01:00.000Z', messages: [{ kind: 'open' }, { kind: 'closed' }] });
    sessions = appendStreamSessionMessage(sessions, 'stream-b', { id: 'event-3', sessionId: 'stream-b', direction: 'system', kind: 'reconnecting', text: 'Retrying', timestamp: '2026-07-18T13:01:01.000Z' });
    expect(sessions.find((session) => session.id === 'stream-b')).not.toHaveProperty('endedAt');
    expect(visibleStreamSessionHistory(sessions, request.id, 'env-a', true).map((session) => session.id)).toEqual(['stream-b']);
  });

  it('groups, deletes, clears, and honors disabled persistence', () => {
    const workspace = cloneSeedWorkspace();
    const request = workspace.collections[0].requests[0];
    request.protocol = 'sse';
    const recent = createStreamSession(request, 'env-a', 'recent', '2026-07-18T11:58:00.000Z');
    const older = createStreamSession(request, 'env-a', 'older', '2026-07-17T10:00:00.000Z');
    expect(retainStreamSessionHistory([older], recent, 0, false)).toEqual([]);
    expect(streamHistorySections([recent, older], new Date('2026-07-18T12:00:00.000Z')).map((section) => section.label)).toEqual(['Just Now', 'This Week']);
    expect(deleteStoredStreamSession([recent, older], 'recent')).toEqual([older]);
    expect(clearStoredStreamSessions([recent, older], request.id, 'env-a')).toEqual([]);
  });

  it('captures and restores an independent editable request version', () => {
    const workspace = cloneSeedWorkspace();
    const request = workspace.collections[0].requests[0];
    request.protocol = 'websocket';
    request.url = 'wss://example.test/original';
    request.folderId = 'historical-folder';
    const session = createStreamSession(request, 'env-a', 'stream-version');
    request.name = 'Current name';
    request.url = 'wss://example.test/current';
    request.folderId = 'current-folder';

    expect(session.requestSnapshot?.url).toBe('wss://example.test/original');
    expect(restoreRequestSnapshot(session, request)).toMatchObject({
      id: request.id,
      name: 'Current name',
      url: 'wss://example.test/original',
      folderId: 'current-folder',
    });
  });

  it('persists GraphQL subscriptions as GraphQL stream sessions', () => {
    const request = cloneSeedWorkspace().collections[0].requests[0];
    request.protocol = 'graphql';
    request.graphql.query = 'subscription Events { event { id } }';
    const session = createStreamSession(request, 'env-a', 'graphql-stream');
    expect(session).toMatchObject({ protocol: 'graphql', requestSnapshot: { protocol: 'graphql' } });
  });

  it('filters searchable event categories and clears only the current view', () => {
    const messages = [
      { id: 'open', sessionId: 'stream', direction: 'system' as const, kind: 'open', text: 'Connected', timestamp: '2026-07-18T12:00:00.000Z' },
      { id: 'incoming', sessionId: 'stream', direction: 'incoming' as const, kind: 'order.created', text: '{"id":42}', timestamp: '2026-07-18T12:00:01.000Z' },
      { id: 'info', sessionId: 'stream', direction: 'system' as const, kind: 'upgrade', text: 'Upgraded to WebSocket', timestamp: '2026-07-18T12:00:02.000Z' },
      { id: 'error', sessionId: 'stream', direction: 'system' as const, kind: 'error', text: 'Connection reset', timestamp: '2026-07-18T12:00:03.000Z' },
      { id: 'close', sessionId: 'stream', direction: 'system' as const, kind: 'closed', text: 'Disconnected', timestamp: '2026-07-18T12:00:04.000Z' },
    ];

    expect(messages.map(streamMessageCategory)).toEqual(['open', 'message', 'other', 'error', 'close']);
    expect(filterStreamMessages(messages, 'message', '', '').map(({ id }) => id)).toEqual(['incoming']);
    expect(filterStreamMessages(messages, '', 'connection', '').map(({ id }) => id)).toEqual(['error']);
    expect(filterStreamMessages(messages, '', 'connected', '').map(({ id }) => id)).toEqual(['close']);
    expect(filterStreamMessages(messages, '', '', '2026-07-18T12:00:03.000Z').map(({ id }) => id)).toEqual(['close']);
  });

  it('persists bounded handshake metadata and lifecycle timeline evidence', () => {
    const request = cloneSeedWorkspace().collections[0].requests[1];
    request.protocol = 'websocket';
    const session = createStreamSession(request, 'env-a', 'stream-metadata', '2026-07-18T12:00:00.000Z');
    let sessions = applyStreamConnectionMetadata([session], session.id, {
      status: 101,
      statusText: 'Switching Protocols',
      headers: { upgrade: 'websocket' },
      httpVersion: 'HTTP/1.1',
      durationMs: 42,
      transport: 'WebSocket',
    });
    sessions = appendStreamSessionMessage(sessions, session.id, { id: 'closed', sessionId: session.id, direction: 'system', kind: 'closed', text: 'Disconnected', timestamp: '2026-07-18T12:00:01.000Z' });

    expect(sessions[0]).toMatchObject({ status: 101, statusText: 'Switching Protocols', headers: { upgrade: 'websocket' }, httpVersion: 'HTTP/1.1', durationMs: 42, transport: 'WebSocket' });
    expect(sessions[0].timeline?.map(({ value, elapsedMs }) => [value, elapsedMs])).toEqual([
      [`Connecting to ${request.url}`, 0],
      ['HTTP 101 Switching Protocols · HTTP/1.1', 42],
      ['Transport: WebSocket', 42],
      ['closed: Disconnected', 1_000],
    ]);
  });
});
