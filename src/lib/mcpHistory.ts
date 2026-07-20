import type { McpClient, McpHistoryEvent, McpHistoryEventCategory, McpHistorySession, ResponseTimelineEntry } from '../types';
import type { McpEvent } from './mcp';

const MAX_MCP_EVENTS = 5_000;
const MAX_MCP_EVENT_CHARACTERS = 5_000_000;
const MAX_MCP_TIMELINE_ENTRIES = 5_000;
const MAX_MCP_HISTORY_SESSIONS = 5_000;

const newestFirst = (left: McpHistorySession, right: McpHistorySession) => right.startedAt.localeCompare(left.startedAt);
const sameScope = (candidate: McpHistorySession, session: McpHistorySession, filterResponsesByEnv: boolean) => candidate.clientId === session.clientId
  && (!filterResponsesByEnv || candidate.environmentId === session.environmentId);
const elapsedMs = (startedAt: string, timestamp: string) => {
  const started = Date.parse(startedAt);
  const event = Date.parse(timestamp);
  return Number.isFinite(started) && Number.isFinite(event) ? Math.max(0, event - started) : 0;
};

export const mcpEventCategory = (event: Pick<McpEvent, 'direction' | 'method' | 'detail'>): McpHistoryEventCategory => {
  if (event.direction === 'server' && event.method.startsWith('notifications/')) return 'notification';
  if (event.direction === 'stderr' || event.method === 'transport/error' || /(?:^|\s)error$/i.test(event.method)) return 'error';
  if (event.method === 'MCP session') {
    if (/clear|disconnect|terminat|closed/i.test(event.detail)) return 'close';
    if (/connect|reuse|initializ/i.test(event.detail)) return 'open';
  }
  return 'message';
};

export const toMcpHistoryEvent = (event: McpEvent): McpHistoryEvent => ({
  ...event,
  id: `mcp-event-${crypto.randomUUID()}`,
  method: event.method.slice(0, 1_000),
  detail: event.detail.slice(0, 1_000_000),
  category: mcpEventCategory(event),
});

const boundEvents = (events: McpHistoryEvent[]) => {
  const bounded = events.slice(-MAX_MCP_EVENTS);
  let characters = bounded.reduce((total, event) => total + event.method.length + event.detail.length, 0);
  while (bounded.length > 1 && characters > MAX_MCP_EVENT_CHARACTERS) {
    const removed = bounded.shift()!;
    characters -= removed.method.length + removed.detail.length;
  }
  return bounded;
};

const timelineEntry = (session: McpHistorySession, event: McpHistoryEvent): ResponseTimelineEntry => ({
  name: 'Text',
  value: `${event.direction} · ${event.method}${event.detail ? ` · ${event.detail.slice(0, 2_000)}` : ''}`,
  elapsedMs: elapsedMs(session.startedAt, event.timestamp),
});

export const createMcpHistorySession = (
  client: McpClient,
  environmentId: string,
  id = `mcp-response-${crypto.randomUUID()}`,
  startedAt = new Date().toISOString(),
): McpHistorySession => ({
  id,
  clientId: client.id,
  clientName: client.name,
  endpoint: client.transport === 'stdio' ? [client.command, ...client.args].join(' ').trim() : client.url,
  environmentId,
  transport: client.transport,
  startedAt,
  status: 'connecting',
  events: [],
  timeline: [{ name: 'Text', value: `Connecting ${client.transport.toUpperCase()} MCP client to ${client.transport === 'stdio' ? client.command : client.url}`, elapsedMs: 0 }],
});

export const retainMcpHistorySession = (
  sessions: McpHistorySession[],
  session: McpHistorySession,
  maxHistoryResponses: number,
  filterResponsesByEnv: boolean,
) => {
  const existing = sessions
    .filter((candidate) => candidate.id !== session.id)
    .map((candidate) => candidate.clientId === session.clientId && !candidate.endedAt
      ? { ...candidate, status: 'disconnected' as const, endedAt: session.startedAt, timeline: [...candidate.timeline, { name: 'Text' as const, value: 'Replaced by a newer MCP connection.', elapsedMs: elapsedMs(candidate.startedAt, session.startedAt) }].slice(-MAX_MCP_TIMELINE_ENTRIES) }
      : candidate);
  const outsideScope = existing.filter((candidate) => !sameScope(candidate, session, filterResponsesByEnv));
  const limit = Math.max(-1, Math.trunc(maxHistoryResponses));
  if (limit === 0) return outsideScope.sort(newestFirst).slice(0, MAX_MCP_HISTORY_SESSIONS);
  const scoped = [session, ...existing.filter((candidate) => sameScope(candidate, session, filterResponsesByEnv))].sort(newestFirst);
  return [...(limit < 0 ? scoped : scoped.slice(0, limit)), ...outsideScope].sort(newestFirst).slice(0, MAX_MCP_HISTORY_SESSIONS);
};

export const appendMcpHistoryEvents = (sessions: McpHistorySession[], sessionId: string, events: McpEvent[]) => {
  if (!events.length || !sessions.some((session) => session.id === sessionId)) return sessions;
  return sessions.map((session) => {
    if (session.id !== sessionId) return session;
    const known = new Set(session.events.map((event) => `${event.direction}\n${event.method}\n${event.detail}\n${event.timestamp}`));
    const appended = events.map(toMcpHistoryEvent).filter((event) => {
      const key = `${event.direction}\n${event.method}\n${event.detail}\n${event.timestamp}`;
      if (known.has(key)) return false;
      known.add(key);
      return true;
    });
    if (!appended.length) return session;
    return {
      ...session,
      events: boundEvents([...session.events, ...appended]),
      timeline: [...session.timeline, ...appended.map((event) => timelineEntry(session, event))].slice(-MAX_MCP_TIMELINE_ENTRIES),
    };
  });
};

export const markMcpHistoryConnected = (sessions: McpHistorySession[], sessionId: string, timestamp = new Date().toISOString()) => sessions.map((session) => {
  if (session.id !== sessionId || session.status === 'connected') return session;
  return {
    ...session,
    status: 'connected' as const,
    timeline: [...session.timeline, { name: 'Text' as const, value: 'MCP connection ready.', elapsedMs: elapsedMs(session.startedAt, timestamp) }].slice(-MAX_MCP_TIMELINE_ENTRIES),
  };
});

export const finishMcpHistorySession = (
  sessions: McpHistorySession[],
  sessionId: string,
  status: 'disconnected' | 'error',
  detail: string,
  endedAt = new Date().toISOString(),
) => sessions.map((session) => session.id !== sessionId ? session : {
  ...session,
  status,
  endedAt,
  timeline: [...session.timeline, { name: 'Text' as const, value: detail, elapsedMs: elapsedMs(session.startedAt, endedAt) }].slice(-MAX_MCP_TIMELINE_ENTRIES),
});

export const visibleMcpHistory = (
  sessions: McpHistorySession[],
  clientId: string,
  environmentId: string,
  filterResponsesByEnv: boolean,
) => sessions
  .filter((session) => session.clientId === clientId && (!filterResponsesByEnv || session.environmentId === environmentId))
  .sort(newestFirst);

export const deleteMcpHistorySession = (sessions: McpHistorySession[], sessionId: string) => sessions.filter((session) => session.id !== sessionId);
export const clearMcpHistorySessions = (sessions: McpHistorySession[], clientId: string, environmentId: string) => sessions.filter((session) => session.clientId !== clientId || session.environmentId !== environmentId);

export const filterMcpHistoryEvents = (
  events: McpHistoryEvent[],
  tab: 'events' | 'notifications',
  category: '' | Exclude<McpHistoryEventCategory, 'notification'>,
  searchQuery: string,
  clearedThrough = '',
) => {
  const query = searchQuery.toLocaleLowerCase();
  return [...events].reverse().filter((event) => {
    if (clearedThrough && event.timestamp <= clearedThrough) return false;
    if (tab === 'notifications') {
      if (event.category !== 'notification') return false;
      return !query || event.detail.toLocaleLowerCase().includes(query);
    }
    if (event.category === 'notification') return false;
    if (category && event.category !== category) return false;
    if (!query) return true;
    if (event.category !== 'message' && event.category !== 'error' && event.category !== 'close') return false;
    return event.method.toLocaleLowerCase().includes(query) || event.detail.toLocaleLowerCase().includes(query);
  });
};

export type McpHistorySection = { label: string; sessions: McpHistorySession[] };

export const mcpHistorySections = (sessions: McpHistorySession[], now = new Date()): McpHistorySection[] => {
  const sections: McpHistorySection[] = [
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

const record = (value: unknown) => value && typeof value === 'object' ? value as Record<string, unknown> : undefined;
const stringValue = (value: unknown, fallback = '') => typeof value === 'string' ? value : fallback;

export const normalizeMcpHistorySessions = (value: unknown, clientIds: Set<string>, environmentIds: Set<string>): McpHistorySession[] => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((candidate, sessionIndex): McpHistorySession[] => {
    const session = record(candidate);
    const clientId = stringValue(session?.clientId);
    const environmentId = stringValue(session?.environmentId);
    if (!session || !clientIds.has(clientId) || (environmentId && !environmentIds.has(environmentId))) return [];
    const startedAt = stringValue(session.startedAt, new Date(0).toISOString());
    const events = (Array.isArray(session.events) ? session.events : []).flatMap((candidate, eventIndex): McpHistoryEvent[] => {
      const event = record(candidate);
      if (!event) return [];
      const direction: McpHistoryEvent['direction'] = event.direction === 'client' || event.direction === 'stderr' ? event.direction : 'server';
      const method = stringValue(event.method, 'message').slice(0, 1_000);
      const detail = stringValue(event.detail).slice(0, 1_000_000);
      const base: Pick<McpEvent, 'direction' | 'method' | 'detail'> = { direction, method, detail };
      return [{
        id: stringValue(event.id, `mcp-event-${sessionIndex}-${eventIndex}`).slice(0, 512),
        ...base,
        timestamp: stringValue(event.timestamp, startedAt),
        category: ['message', 'notification', 'open', 'close', 'error'].includes(String(event.category)) ? event.category as McpHistoryEventCategory : mcpEventCategory(base),
      }];
    });
    const timeline = (Array.isArray(session.timeline) ? session.timeline : []).flatMap((candidate): ResponseTimelineEntry[] => {
      const entry = record(candidate);
      if (!entry) return [];
      return [{ name: 'Text', value: stringValue(entry.value).slice(0, 100_000), elapsedMs: Math.max(0, Number(entry.elapsedMs) || 0), ...(entry.hidden === true ? { hidden: true } : {}) }];
    }).slice(-MAX_MCP_TIMELINE_ENTRIES);
    const persistedStatus = session.status === 'error' ? 'error' as const : 'disconnected' as const;
    return [{
      id: stringValue(session.id, `mcp-response-${sessionIndex}`).slice(0, 512),
      clientId,
      clientName: stringValue(session.clientName, 'MCP client').slice(0, 1_000),
      endpoint: stringValue(session.endpoint).slice(0, 32_768),
      environmentId,
      transport: session.transport === 'stdio' ? 'stdio' : 'http',
      startedAt,
      ...(typeof session.endedAt === 'string' ? { endedAt: session.endedAt } : {}),
      status: persistedStatus,
      events: boundEvents(events),
      timeline,
    }];
  }).sort(newestFirst).slice(0, MAX_MCP_HISTORY_SESSIONS);
};
