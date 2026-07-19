import type { ApiRequest, Workspace } from '../types';

type RequestSnapshotOwner = { requestId: string; requestSnapshot?: ApiRequest };

const record = (value: unknown): Record<string, unknown> | undefined => value && typeof value === 'object' ? value as Record<string, unknown> : undefined;
const protocols = new Set(['http', 'graphql', 'websocket', 'socketio', 'sse', 'grpc']);
const bodyModes = new Set(['none', 'json', 'text', 'form-urlencoded', 'multipart', 'binary']);

export const restoreRequestSnapshot = (owner: RequestSnapshotOwner, current: ApiRequest): ApiRequest => {
  const snapshot = record(owner.requestSnapshot);
  if (!snapshot
    || snapshot.id !== current.id
    || typeof snapshot.name !== 'string'
    || typeof snapshot.method !== 'string'
    || typeof snapshot.url !== 'string'
    || !protocols.has(String(snapshot.protocol))
    || !bodyModes.has(String(snapshot.bodyMode))
    || !Array.isArray(snapshot.pathParams)
    || !Array.isArray(snapshot.params)
    || !Array.isArray(snapshot.headers)
    || !Array.isArray(snapshot.formBody)
    || !Array.isArray(snapshot.multipartBody)
    || !record(snapshot.auth)
    || !record(snapshot.graphql)
    || !record(snapshot.grpc)
    || !record(snapshot.transport)
    || !record(snapshot.sse)) return current;
  const restored = structuredClone(snapshot) as ApiRequest;
  return { ...restored, id: current.id, folderId: current.folderId, socketIo: record(snapshot.socketIo) ? restored.socketIo : current.socketIo };
};

export const restoreWorkspaceRequestSnapshot = (owner: RequestSnapshotOwner, workspace: Workspace): Workspace => {
  if (workspace.activeRequestId !== owner.requestId) return workspace;
  let changed = false;
  const collections = workspace.collections.map((collection) => ({
    ...collection,
    requests: collection.requests.map((request) => {
      if (request.id !== workspace.activeRequestId) return request;
      const restored = restoreRequestSnapshot(owner, request);
      changed ||= restored !== request;
      return restored;
    }),
  }));
  return changed ? { ...workspace, collections } : workspace;
};
