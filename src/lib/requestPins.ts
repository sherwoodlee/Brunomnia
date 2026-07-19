import type { ApiRequest, Workspace } from '../types';

export type PinnedWorkspaceRequest = {
  collectionId: string;
  request: ApiRequest;
};

const MAX_PINNED_REQUESTS = 5_000;

const workspaceRequestIds = (workspace: Workspace): Set<string> => new Set(
  workspace.collections.flatMap((collection) => collection.requests.map((request) => request.id)),
);

export const parsePinnedRequestIds = (value: string | null): string[] => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    return parsed.filter((id): id is string => typeof id === 'string' && id.length <= 500 && !seen.has(id) && Boolean(seen.add(id))).slice(0, MAX_PINNED_REQUESTS);
  } catch {
    return [];
  }
};

export const reconcilePinnedRequestIds = (workspace: Workspace, ids: string[]): string[] => {
  const validIds = workspaceRequestIds(workspace);
  const seen = new Set<string>();
  return ids.filter((id) => validIds.has(id) && !seen.has(id) && Boolean(seen.add(id))).slice(0, MAX_PINNED_REQUESTS);
};

export const togglePinnedRequestId = (workspace: Workspace, ids: string[], requestId: string): string[] => {
  const reconciled = reconcilePinnedRequestIds(workspace, ids);
  if (reconciled.includes(requestId)) return reconciled.filter((id) => id !== requestId);
  if (!workspaceRequestIds(workspace).has(requestId) || reconciled.length >= MAX_PINNED_REQUESTS) return reconciled;
  return [...reconciled, requestId];
};

export const pinnedWorkspaceRequests = (workspace: Workspace, ids: string[], search = ''): PinnedWorkspaceRequest[] => {
  const pinnedIds = new Set(reconcilePinnedRequestIds(workspace, ids));
  const normalizedSearch = search.trim().toLowerCase();
  return workspace.collections.flatMap((collection) => {
    const requests = new Map(collection.requests.map((request) => [request.id, request]));
    const seen = new Set<string>();
    const order = [...(collection.resourceOrder ?? []), ...collection.requests.map((request) => request.id)]
      .filter((id) => requests.has(id) && !seen.has(id) && Boolean(seen.add(id)));
    return order.flatMap((id): PinnedWorkspaceRequest[] => {
      const request = requests.get(id);
      if (!request || !pinnedIds.has(id)) return [];
      if (normalizedSearch && !`${request.name} ${request.method} ${request.protocol} ${request.url}`.toLowerCase().includes(normalizedSearch)) return [];
      return [{ collectionId: collection.id, request }];
    });
  });
};
