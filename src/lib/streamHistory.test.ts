import { describe, expect, it } from 'vitest';
import { cloneSeedWorkspace } from '../data/seed';
import { appendStreamSessionMessage, clearStoredStreamSessions, createStreamSession, deleteStoredStreamSession, retainStreamSessionHistory, streamHistorySections, visibleStreamSessionHistory } from './streamHistory';

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
});
