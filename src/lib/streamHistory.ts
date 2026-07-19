import type { ApiRequest, StoredStreamSession, StreamConnectionMetadata, StreamMessage } from '../types';

const MAX_STREAM_MESSAGES = 5_000;
const MAX_STREAM_TEXT_CHARACTERS = 5_000_000;
const MAX_STREAM_TIMELINE_ENTRIES = 5_000;

export type StreamEventCategory = '' | 'message' | 'open' | 'close' | 'error';

const sameScope = (candidate: StoredStreamSession, session: StoredStreamSession, filterResponsesByEnv: boolean) => candidate.requestId === session.requestId
  && (!filterResponsesByEnv || candidate.environmentId === session.environmentId);

const newestFirst = (left: StoredStreamSession, right: StoredStreamSession) => right.startedAt.localeCompare(left.startedAt);

const boundMessages = (messages: StreamMessage[]) => {
  const bounded = messages.slice(-MAX_STREAM_MESSAGES);
  let characters = bounded.reduce((total, message) => total + message.text.length, 0);
  while (bounded.length > 1 && characters > MAX_STREAM_TEXT_CHARACTERS) {
    characters -= bounded.shift()!.text.length;
  }
  return bounded;
};

export const appendVisibleStreamMessage = (messages: StreamMessage[], message: StreamMessage) => boundMessages([...messages, message]);

export const streamMessageCategory = (message: StreamMessage): Exclude<StreamEventCategory, ''> | 'other' => {
  if (message.kind === 'open') return 'open';
  if (message.kind === 'close' || message.kind === 'closed') return 'close';
  if (message.kind === 'error') return 'error';
  return message.direction === 'system' ? 'other' : 'message';
};

export const filterStreamMessages = (
  messages: StreamMessage[],
  category: StreamEventCategory,
  searchQuery: string,
  clearedThrough = '',
) => {
  const query = searchQuery.toLocaleLowerCase();
  return messages.filter((message) => {
    if (clearedThrough && message.timestamp <= clearedThrough) return false;
    const messageCategory = streamMessageCategory(message);
    if (category && messageCategory !== category) return false;
    if (!query) return true;
    if (messageCategory !== 'message' && messageCategory !== 'error' && messageCategory !== 'close') return false;
    return message.text.toLocaleLowerCase().includes(query);
  });
};

export const createStreamSession = (
  request: ApiRequest,
  environmentId: string,
  sessionId: string,
  startedAt = new Date().toISOString(),
): StoredStreamSession => ({
  id: sessionId,
  requestId: request.id,
  requestName: request.name,
  requestUrl: request.url,
  environmentId,
  protocol: request.protocol as StoredStreamSession['protocol'],
  startedAt,
  messages: [],
  requestSnapshot: structuredClone(request),
  timeline: [
    { name: 'Text', value: `Connecting to ${request.url}`, elapsedMs: 0 },
    ...(request.protocol === 'socketio' ? [{ name: 'Text' as const, value: `Handshake path: ${request.socketIo.path || '/socket.io'}`, elapsedMs: 0 }] : []),
  ],
});

export const applyStreamConnectionMetadata = (
  sessions: StoredStreamSession[],
  sessionId: string,
  metadata: StreamConnectionMetadata,
) => sessions.some((session) => session.id === sessionId) ? sessions.map((session) => session.id !== sessionId ? session : {
  ...session,
  ...metadata,
  timeline: [
    ...(session.timeline ?? []),
    { name: 'Text' as const, value: `HTTP ${metadata.status} ${metadata.statusText} · ${metadata.httpVersion || 'unknown version'}`, elapsedMs: metadata.durationMs },
    { name: 'Text' as const, value: `Transport: ${metadata.transport}`, elapsedMs: metadata.durationMs },
  ].slice(-MAX_STREAM_TIMELINE_ENTRIES),
}) : sessions;

export const retainStreamSessionHistory = (
  sessions: StoredStreamSession[],
  session: StoredStreamSession,
  maxHistoryResponses: number,
  filterResponsesByEnv: boolean,
) => {
  const existing = sessions.filter((candidate) => candidate.id !== session.id);
  const outsideScope = existing.filter((candidate) => !sameScope(candidate, session, filterResponsesByEnv));
  const limit = Math.max(-1, Math.trunc(maxHistoryResponses));
  if (limit === 0) return outsideScope.sort(newestFirst);
  const scoped = [session, ...existing.filter((candidate) => sameScope(candidate, session, filterResponsesByEnv))].sort(newestFirst);
  return [...(limit < 0 ? scoped : scoped.slice(0, limit)), ...outsideScope].sort(newestFirst);
};

export const appendStreamSessionMessage = (
  sessions: StoredStreamSession[],
  sessionId: string,
  message: StreamMessage,
) => sessions.some((session) => session.id === sessionId) ? sessions.map((session) => {
  if (session.id !== sessionId) return session;
  const updated = {
    ...session,
    messages: boundMessages([...session.messages, message]),
    ...(message.kind === 'closed' || message.kind === 'close' || message.kind === 'error' ? { endedAt: message.timestamp } : {}),
  };
  if (message.direction === 'system' && ['open', 'upgrade', 'reconnecting', 'error', 'close', 'closed'].includes(message.kind)) {
    const startedAt = Date.parse(session.startedAt);
    const timestamp = Date.parse(message.timestamp);
    updated.timeline = [
      ...(session.timeline ?? []),
      { name: 'Text' as const, value: `${message.kind}: ${message.text}`, elapsedMs: Number.isFinite(startedAt) && Number.isFinite(timestamp) ? Math.max(0, timestamp - startedAt) : 0 },
    ].slice(-MAX_STREAM_TIMELINE_ENTRIES);
  }
  if (message.kind === 'open' || message.kind === 'reconnecting') delete updated.endedAt;
  return updated;
}) : sessions;

export const visibleStreamSessionHistory = (
  sessions: StoredStreamSession[],
  requestId: string,
  environmentId: string,
  filterResponsesByEnv: boolean,
) => sessions
  .filter((session) => session.requestId === requestId && (!filterResponsesByEnv || session.environmentId === environmentId))
  .sort(newestFirst);

export const deleteStoredStreamSession = (sessions: StoredStreamSession[], sessionId: string) => sessions
  .filter((session) => session.id !== sessionId);

export const clearStoredStreamSessions = (sessions: StoredStreamSession[], requestId: string, environmentId: string) => sessions
  .filter((session) => session.requestId !== requestId || session.environmentId !== environmentId);

export type StreamHistorySection = { label: string; sessions: StoredStreamSession[] };

export const streamHistorySections = (sessions: StoredStreamSession[], now = new Date()): StreamHistorySection[] => {
  const sections: StreamHistorySection[] = [
    { label: 'Just Now', sessions: [] },
    { label: 'Less Than Two Hours Ago', sessions: [] },
    { label: 'Today', sessions: [] },
    { label: 'This Week', sessions: [] },
    { label: 'Older Than This Week', sessions: [] },
  ];
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  sessions.forEach((session) => {
    const startedAt = new Date(session.startedAt);
    const elapsed = now.getTime() - startedAt.getTime();
    const section = Number.isNaN(startedAt.getTime()) ? sections[4]
      : elapsed < 5 * 60_000 ? sections[0]
        : elapsed < 2 * 60 * 60_000 ? sections[1]
          : startedAt >= startOfToday ? sections[2]
            : startedAt >= startOfWeek ? sections[3]
              : sections[4];
    section.sessions.push(session);
  });
  return sections.filter((section) => section.sessions.length);
};
