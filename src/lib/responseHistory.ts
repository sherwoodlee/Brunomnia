import type { ApiRequest, StoredResponse } from '../types';

const sameScope = (candidate: StoredResponse, response: StoredResponse, filterResponsesByEnv: boolean) => candidate.requestId === response.requestId
  && (!filterResponsesByEnv || candidate.environmentId === response.environmentId);

const newestFirst = (left: StoredResponse, right: StoredResponse) => right.receivedAt.localeCompare(left.receivedAt);

export const createRequestSnapshot = (request: ApiRequest): ApiRequest => structuredClone(request);

export const visibleResponseHistory = (
  responses: StoredResponse[],
  requestId: string,
  environmentId: string,
  filterResponsesByEnv: boolean,
) => responses
  .filter((response) => response.requestId === requestId && (!filterResponsesByEnv || response.environmentId === environmentId))
  .sort(newestFirst);

export const deleteSavedResponse = (responses: StoredResponse[], responseId: string) => responses
  .filter((response) => response.id !== responseId);

export const clearSavedResponseHistory = (responses: StoredResponse[], requestId: string, environmentId: string) => responses
  .filter((response) => response.requestId !== requestId || response.environmentId !== environmentId);

export type ResponseHistorySection = { label: string; responses: StoredResponse[] };

export const responseHistorySections = (responses: StoredResponse[], now = new Date()): ResponseHistorySection[] => {
  const sections: ResponseHistorySection[] = [
    { label: 'Just Now', responses: [] },
    { label: 'Less Than Two Hours Ago', responses: [] },
    { label: 'Today', responses: [] },
    { label: 'This Week', responses: [] },
    { label: 'Older Than This Week', responses: [] },
  ];
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  responses.forEach((response) => {
    const receivedAt = new Date(response.receivedAt);
    const elapsed = now.getTime() - receivedAt.getTime();
    const section = Number.isNaN(receivedAt.getTime()) ? sections[4]
      : elapsed < 5 * 60_000 ? sections[0]
        : elapsed < 2 * 60 * 60_000 ? sections[1]
          : receivedAt >= startOfToday ? sections[2]
            : receivedAt >= startOfWeek ? sections[3]
              : sections[4];
    section.responses.push(response);
  });
  return sections.filter((section) => section.responses.length);
};

export const retainResponseHistory = (
  responses: StoredResponse[],
  response: StoredResponse,
  maxHistoryResponses: number,
  filterResponsesByEnv: boolean,
) => {
  const existing = responses.filter((candidate) => candidate.id !== response.id);
  const outsideScope = existing.filter((candidate) => !sameScope(candidate, response, filterResponsesByEnv));
  const limit = Math.max(-1, Math.trunc(maxHistoryResponses));
  if (limit === 0) return outsideScope.sort(newestFirst);
  const scoped = [response, ...existing.filter((candidate) => sameScope(candidate, response, filterResponsesByEnv))].sort(newestFirst);
  return [...(limit < 0 ? scoped : scoped.slice(0, limit)), ...outsideScope].sort(newestFirst);
};
