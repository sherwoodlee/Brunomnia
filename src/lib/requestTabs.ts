export type DocumentTabType = 'request' | 'folder';

export type DocumentTabReference = {
  id: string;
  type: DocumentTabType;
};

export type RequestDocumentTab = {
  requestId: string;
  type: DocumentTabType;
  temporary: boolean;
};

export type RequestTabState = {
  tabs: RequestDocumentTab[];
  activeRequestId: string;
  history: string[];
  closed: string[];
  dashboard: boolean;
};

export type RequestTabPlacement = 'before' | 'after';

const MAX_OPEN_TABS = 100;
const MAX_TAB_HISTORY = 100;
const MAX_CLOSED_TABS = 50;

export const emptyRequestTabState = (): RequestTabState => ({ tabs: [], activeRequestId: '', history: [], closed: [], dashboard: false });

const uniqueIds = (value: unknown, limit: number): string[] => {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.filter((id): id is string => typeof id === 'string' && id.length > 0 && id.length <= 500 && !seen.has(id) && Boolean(seen.add(id))).slice(0, limit);
};

const documentReference = (value: string | DocumentTabReference): DocumentTabReference => (
  typeof value === 'string' ? { id: value, type: 'request' } : value
);

export const parseRequestTabState = (value: string | null): RequestTabState => {
  if (!value || value.length > 1_000_000) return emptyRequestTabState();
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    const seen = new Set<string>();
    let temporarySeen = false;
    const tabs = (Array.isArray(parsed.tabs) ? parsed.tabs : []).flatMap((value): RequestDocumentTab[] => {
      if (!value || typeof value !== 'object') return [];
      const tab = value as Record<string, unknown>;
      const requestId = typeof tab.requestId === 'string' ? tab.requestId : '';
      if (!requestId || requestId.length > 500 || seen.has(requestId)) return [];
      seen.add(requestId);
      const temporary = tab.temporary === true && !temporarySeen;
      temporarySeen ||= temporary;
      return [{ requestId, type: tab.type === 'folder' ? 'folder' : 'request', temporary }];
    }).slice(0, MAX_OPEN_TABS);
    return {
      tabs,
      activeRequestId: typeof parsed.activeRequestId === 'string' ? parsed.activeRequestId : '',
      history: uniqueIds(parsed.history, MAX_TAB_HISTORY),
      closed: uniqueIds(parsed.closed, MAX_CLOSED_TABS),
      dashboard: parsed.dashboard === true && tabs.length === 0,
    };
  } catch {
    return emptyRequestTabState();
  }
};

const activate = (state: RequestTabState, requestId: string): RequestTabState => {
  if (!state.tabs.some((tab) => tab.requestId === requestId)) return state;
  if (state.activeRequestId === requestId) return { ...state, closed: state.closed.filter((id) => id !== requestId), dashboard: false };
  const history = state.activeRequestId && state.tabs.some((tab) => tab.requestId === state.activeRequestId)
    ? [state.activeRequestId, ...state.history.filter((id) => id !== state.activeRequestId && id !== requestId)]
    : state.history.filter((id) => id !== requestId);
  return { ...state, activeRequestId: requestId, history: history.slice(0, MAX_TAB_HISTORY), closed: state.closed.filter((id) => id !== requestId), dashboard: false };
};

export const reconcileRequestTabState = (state: RequestTabState, validDocuments: Array<string | DocumentTabReference>, fallbackDocument: string | DocumentTabReference = ''): RequestTabState => {
  const validReferences = validDocuments.map(documentReference);
  const validById = new Map(validReferences.map((reference) => [reference.id, reference.type]));
  const fallback = documentReference(fallbackDocument);
  const seen = new Set<string>();
  let temporarySeen = false;
  const tabs = state.tabs.flatMap((tab): RequestDocumentTab[] => {
    if (validById.get(tab.requestId) !== tab.type || seen.has(tab.requestId)) return [];
    seen.add(tab.requestId);
    const temporary = tab.temporary && !temporarySeen;
    temporarySeen ||= temporary;
    return [{ requestId: tab.requestId, type: tab.type, temporary }];
  }).slice(0, MAX_OPEN_TABS);
  const dashboard = state.dashboard && tabs.length === 0;
  if (!tabs.length && !dashboard && validById.get(fallback.id) === fallback.type) tabs.push({ requestId: fallback.id, type: fallback.type, temporary: true });
  const tabIds = new Set(tabs.map((tab) => tab.requestId));
  const activeRequestId = tabIds.has(state.activeRequestId)
    ? state.activeRequestId
    : tabIds.has(fallback.id) ? fallback.id : tabs[0]?.requestId ?? '';
  return {
    tabs,
    activeRequestId,
    history: uniqueIds(state.history, MAX_TAB_HISTORY).filter((id) => tabIds.has(id) && id !== activeRequestId),
    closed: uniqueIds(state.closed, MAX_CLOSED_TABS).filter((id) => validById.has(id) && !tabIds.has(id)),
    dashboard: dashboard && tabs.length === 0,
  };
};

export const openDocumentTab = (state: RequestTabState, requestId: string, type: DocumentTabType, permanent = false): RequestTabState => {
  if (!requestId) return state;
  const existing = state.tabs.find((tab) => tab.requestId === requestId && tab.type === type);
  if (existing) {
    const tabs = permanent ? state.tabs.map((tab) => tab.requestId === requestId ? { ...tab, temporary: false } : tab) : state.tabs;
    return activate({ ...state, tabs }, requestId);
  }
  let tabs = [...state.tabs];
  let history = state.history;
  const temporaryIndex = permanent ? -1 : tabs.findIndex((tab) => tab.temporary);
  if (temporaryIndex >= 0) {
    const replacedId = tabs[temporaryIndex].requestId;
    tabs[temporaryIndex] = { requestId, type, temporary: true };
    history = history.filter((id) => id !== replacedId);
  } else if (tabs.length < MAX_OPEN_TABS) {
    tabs.push({ requestId, type, temporary: !permanent });
  } else {
    return state;
  }
  return activate({ ...state, tabs, history }, requestId);
};

export const openRequestTab = (state: RequestTabState, requestId: string, permanent = false): RequestTabState => openDocumentTab(state, requestId, 'request', permanent);

export const promoteRequestTab = (state: RequestTabState, requestId: string): RequestTabState => (
  state.tabs.some((tab) => tab.requestId === requestId && tab.temporary)
    ? { ...state, tabs: state.tabs.map((tab) => tab.requestId === requestId ? { ...tab, temporary: false } : tab) }
    : state
);

export const closeRequestTab = (state: RequestTabState, requestId: string): RequestTabState => {
  const index = state.tabs.findIndex((tab) => tab.requestId === requestId);
  if (index < 0) return state;
  if (state.tabs.length === 1) {
    return {
      tabs: [],
      activeRequestId: '',
      history: [],
      closed: [...state.closed.filter((id) => id !== requestId), requestId].slice(-MAX_CLOSED_TABS),
      dashboard: true,
    };
  }
  const tabs = state.tabs.filter((tab) => tab.requestId !== requestId);
  const tabIds = new Set(tabs.map((tab) => tab.requestId));
  const history = state.history.filter((id) => id !== requestId && tabIds.has(id));
  const activeRequestId = state.activeRequestId === requestId
    ? history[0] ?? tabs[Math.max(0, index - 1)]?.requestId ?? tabs[0].requestId
    : state.activeRequestId;
  return {
    tabs,
    activeRequestId,
    history: history.filter((id) => id !== activeRequestId),
    closed: [...state.closed.filter((id) => id !== requestId), requestId].slice(-MAX_CLOSED_TABS),
    dashboard: false,
  };
};

export const closeAllRequestTabs = (state: RequestTabState): RequestTabState => {
  if (!state.tabs.length) return state;
  const closingIds = state.tabs.map((tab) => tab.requestId);
  const closing = new Set(closingIds);
  return {
    tabs: [],
    activeRequestId: '',
    history: [],
    closed: [...state.closed.filter((id) => !closing.has(id)), ...closingIds].slice(-MAX_CLOSED_TABS),
    dashboard: true,
  };
};

export const closeOtherRequestTabs = (state: RequestTabState, requestId: string): RequestTabState => {
  const reserved = state.tabs.find((tab) => tab.requestId === requestId);
  if (!reserved || state.tabs.length <= 1) return state;
  const closingIds = state.tabs.filter((tab) => tab.requestId !== requestId).map((tab) => tab.requestId);
  const closing = new Set(closingIds);
  return {
    tabs: [reserved],
    activeRequestId: requestId,
    history: [],
    closed: [...state.closed.filter((id) => id !== requestId && !closing.has(id)), ...closingIds].slice(-MAX_CLOSED_TABS),
    dashboard: false,
  };
};

export const reopenClosedRequestTab = (state: RequestTabState, validRequestIds: string[]): RequestTabState => {
  return reopenClosedDocumentTab(state, validRequestIds);
};

export const reopenClosedDocumentTab = (state: RequestTabState, validDocuments: Array<string | DocumentTabReference>): RequestTabState => {
  const validById = new Map(validDocuments.map(documentReference).map((reference) => [reference.id, reference.type]));
  const requestId = [...state.closed].reverse().find((id) => validById.has(id) && !state.tabs.some((tab) => tab.requestId === id));
  if (!requestId) return state;
  return openDocumentTab({ ...state, closed: state.closed.filter((id) => id !== requestId) }, requestId, validById.get(requestId)!, true);
};

export const cycleRequestTab = (state: RequestTabState, direction: 'next' | 'previous'): RequestTabState => {
  if (state.tabs.length < 2) return state;
  const index = state.tabs.findIndex((tab) => tab.requestId === state.activeRequestId);
  const offset = direction === 'next' ? 1 : -1;
  const target = state.tabs[(Math.max(index, 0) + offset + state.tabs.length) % state.tabs.length];
  return target ? activate(state, target.requestId) : state;
};

export const moveRequestTab = (state: RequestTabState, requestId: string, targetRequestId: string, placement: RequestTabPlacement): RequestTabState => {
  const tab = state.tabs.find((candidate) => candidate.requestId === requestId);
  if (!tab || requestId === targetRequestId || !state.tabs.some((candidate) => candidate.requestId === targetRequestId)) return state;
  const tabs = state.tabs.filter((candidate) => candidate.requestId !== requestId);
  const targetIndex = tabs.findIndex((candidate) => candidate.requestId === targetRequestId);
  tabs.splice(targetIndex + (placement === 'after' ? 1 : 0), 0, tab);
  return { ...state, tabs };
};
