import type { Collection, CookieRecord, Workspace, WorkspaceFileState } from '../types';
import { emptyWorkspaceCertificates } from './certificates';

export const emptyWorkspaceFileState = (): WorkspaceFileState => ({ cookies: [], certificates: emptyWorkspaceCertificates() });

export const workspaceFileIdForCollection = (workspace: Workspace, collectionId: string) => (
  workspace.apiDesigns.find((design) => design.generatedCollectionId === collectionId)?.id ?? collectionId
);

export const workspaceFileIdForRequest = (workspace: Workspace, requestId: string) => {
  const collection = workspace.collections.find((candidate) => candidate.requests.some((request) => request.id === requestId));
  return collection ? workspaceFileIdForCollection(workspace, collection.id) : '';
};

export const workspaceFileIdForEnvironment = (workspace: Workspace, environmentId: string) => {
  const byId = new Map(workspace.environments.map((environment) => [environment.id, environment]));
  let current = byId.get(environmentId);
  const visited = new Set<string>();
  while (current?.parentId && !visited.has(current.id)) {
    visited.add(current.id);
    const parent = byId.get(current.parentId);
    if (!parent) break;
    current = parent;
  }
  return current?.id ?? '';
};

export const workspaceFileIdForCollectionRecord = (workspace: Workspace, collection: Collection) => workspaceFileIdForCollection(workspace, collection.id);

export const getWorkspaceFileState = (workspace: Workspace, fileId: string): WorkspaceFileState => {
  const state = fileId ? workspace.fileState[fileId] : undefined;
  return state ?? emptyWorkspaceFileState();
};

export const cloneWorkspaceFileState = (workspace: Workspace, fileId: string): WorkspaceFileState => structuredClone(
  getWorkspaceFileState(workspace, fileId),
);

export const updateWorkspaceFileState = (
  workspace: Workspace,
  fileId: string,
  update: (state: WorkspaceFileState) => WorkspaceFileState,
): Workspace => {
  if (!fileId) return workspace;
  return { ...workspace, fileState: { ...workspace.fileState, [fileId]: update(getWorkspaceFileState(workspace, fileId)) } };
};

export const setWorkspaceFileCookies = (workspace: Workspace, fileId: string, cookies: CookieRecord[]) => updateWorkspaceFileState(
  workspace,
  fileId,
  (state) => ({ ...state, cookies }),
);
