import type { StoredResponse } from '../types';

const sameScope = (candidate: StoredResponse, response: StoredResponse, filterResponsesByEnv: boolean) => candidate.requestId === response.requestId
  && (!filterResponsesByEnv || candidate.environmentId === response.environmentId);

const newestFirst = (left: StoredResponse, right: StoredResponse) => right.receivedAt.localeCompare(left.receivedAt);

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
