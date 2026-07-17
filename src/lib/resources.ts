import type { ApiRequest, Collection, Environment, KeyValue, RequestFolder, Workspace } from '../types';

export type VariableScope = { values: Record<string, string>; disabled: string[] };

export type CollectionResourceRef = { kind: 'folder' | 'request'; id: string };

export type WorkspaceResourceMove =
  | { kind: 'collection'; collectionId: string; targetCollectionId: string; placement: 'before' | 'after' }
  | {
    kind: 'folder' | 'request';
    collectionId: string;
    resourceId: string;
    targetCollectionId: string;
    targetParentId: string;
    targetResourceId?: string;
    placement?: 'before' | 'after';
  };

const collectionResourceOrder = (collection: Collection): string[] => {
  const validIds = new Set([
    ...(collection.folders ?? []).map((folder) => folder.id),
    ...collection.requests.map((request) => request.id),
  ]);
  const seen = new Set<string>();
  return [
    ...(collection.resourceOrder ?? []),
    ...(collection.folders ?? []).map((folder) => folder.id),
    ...collection.requests.map((request) => request.id),
  ].filter((id) => validIds.has(id) && !seen.has(id) && Boolean(seen.add(id)));
};

export const orderedCollectionChildren = (collection: Collection, parentId = ''): CollectionResourceRef[] => {
  const folders = new Map((collection.folders ?? []).map((folder) => [folder.id, folder]));
  const requests = new Map(collection.requests.map((request) => [request.id, request]));
  return collectionResourceOrder(collection).flatMap((id): CollectionResourceRef[] => {
    const folder = folders.get(id);
    if (folder?.parentId === parentId) return [{ kind: 'folder', id }];
    const request = requests.get(id);
    if ((request?.folderId ?? '') === parentId) return [{ kind: 'request', id }];
    return [];
  });
};

const sortCollectionResources = (collection: Collection, resourceOrder: string[]): Collection => {
  const rank = new Map(resourceOrder.map((id, index) => [id, index]));
  const compare = (left: { id: string }, right: { id: string }) => (rank.get(left.id) ?? Number.MAX_SAFE_INTEGER) - (rank.get(right.id) ?? Number.MAX_SAFE_INTEGER);
  return {
    ...collection,
    resourceOrder,
    folders: [...(collection.folders ?? [])].sort(compare),
    requests: [...collection.requests].sort(compare),
  };
};

const insertResource = (
  order: string[],
  resourceId: string,
  siblingIds: Set<string>,
  targetResourceId?: string,
  placement: 'before' | 'after' = 'after',
): string[] => {
  const output = order.filter((id) => id !== resourceId);
  if (targetResourceId && siblingIds.has(targetResourceId)) {
    const targetIndex = output.indexOf(targetResourceId);
    if (targetIndex >= 0) {
      output.splice(targetIndex + (placement === 'after' ? 1 : 0), 0, resourceId);
      return output;
    }
  }
  const lastSiblingIndex = output.reduce((last, id, index) => siblingIds.has(id) ? index : last, -1);
  output.splice(lastSiblingIndex < 0 ? output.length : lastSiblingIndex + 1, 0, resourceId);
  return output;
};

const folderSubtree = (collection: Collection, rootId: string): Set<string> => {
  const ids = new Set([rootId]);
  for (let pass = 0; pass < (collection.folders ?? []).length; pass += 1) {
    let changed = false;
    (collection.folders ?? []).forEach((folder) => {
      if (ids.has(folder.parentId) && !ids.has(folder.id)) {
        ids.add(folder.id);
        changed = true;
      }
    });
    if (!changed) break;
  }
  return ids;
};

export const moveWorkspaceResource = (workspace: Workspace, move: WorkspaceResourceMove): Workspace => {
  if (move.kind === 'collection') {
    if (move.collectionId === move.targetCollectionId) return workspace;
    const source = workspace.collections.find((collection) => collection.id === move.collectionId);
    const targetIndex = workspace.collections.findIndex((collection) => collection.id === move.targetCollectionId);
    if (!source || targetIndex < 0) return workspace;
    const collections = workspace.collections.filter((collection) => collection.id !== source.id);
    const adjustedTarget = collections.findIndex((collection) => collection.id === move.targetCollectionId);
    collections.splice(adjustedTarget + (move.placement === 'after' ? 1 : 0), 0, source);
    return { ...workspace, collections };
  }

  const sourceIndex = workspace.collections.findIndex((collection) => collection.id === move.collectionId);
  const targetIndex = workspace.collections.findIndex((collection) => collection.id === move.targetCollectionId);
  if (sourceIndex < 0 || targetIndex < 0) return workspace;
  const source = workspace.collections[sourceIndex];
  const target = workspace.collections[targetIndex];
  if (move.targetParentId && !(target.folders ?? []).some((folder) => folder.id === move.targetParentId)) return workspace;

  if (move.kind === 'request') {
    const request = source.requests.find((candidate) => candidate.id === move.resourceId);
    if (!request) return workspace;
    if (sourceIndex !== targetIndex && target.requests.some((candidate) => candidate.id === request.id)) return workspace;
    const targetSiblingIds = new Set(orderedCollectionChildren(target, move.targetParentId).map((resource) => resource.id).filter((id) => id !== request.id));
    if (move.targetResourceId && !targetSiblingIds.has(move.targetResourceId)) return workspace;
    const updatedRequest = { ...request, folderId: move.targetParentId || '' };
    const collections = [...workspace.collections];
    if (sourceIndex === targetIndex) {
      const updated = { ...source, expanded: true, requests: source.requests.map((candidate) => candidate.id === request.id ? updatedRequest : candidate) };
      const targetFolders = (updated.folders ?? []).map((folder) => folder.id === move.targetParentId ? { ...folder, expanded: true } : folder);
      const order = insertResource(collectionResourceOrder(updated), request.id, targetSiblingIds, move.targetResourceId, move.placement);
      collections[sourceIndex] = sortCollectionResources({ ...updated, folders: targetFolders }, order);
    } else {
      const sourceOrder = collectionResourceOrder(source).filter((id) => id !== request.id);
      collections[sourceIndex] = sortCollectionResources({ ...source, requests: source.requests.filter((candidate) => candidate.id !== request.id) }, sourceOrder);
      const updatedTarget = {
        ...target,
        expanded: true,
        folders: (target.folders ?? []).map((folder) => folder.id === move.targetParentId ? { ...folder, expanded: true } : folder),
        requests: [...target.requests, updatedRequest],
      };
      const order = insertResource(collectionResourceOrder(updatedTarget), request.id, targetSiblingIds, move.targetResourceId, move.placement);
      collections[targetIndex] = sortCollectionResources(updatedTarget, order);
    }
    return { ...workspace, collections };
  }

  const folder = (source.folders ?? []).find((candidate) => candidate.id === move.resourceId);
  if (!folder) return workspace;
  const subtreeIds = folderSubtree(source, folder.id);
  if (sourceIndex === targetIndex && move.targetParentId && subtreeIds.has(move.targetParentId)) return workspace;
  const movingRequestIds = new Set(source.requests.filter((request) => request.folderId && subtreeIds.has(request.folderId)).map((request) => request.id));
  const movingIds = new Set([...subtreeIds, ...movingRequestIds]);
  const targetIds = new Set([...(target.folders ?? []).map((item) => item.id), ...target.requests.map((item) => item.id)]);
  if (sourceIndex !== targetIndex && [...movingIds].some((id) => targetIds.has(id))) return workspace;
  const targetSiblingIds = new Set(orderedCollectionChildren(target, move.targetParentId).map((resource) => resource.id).filter((id) => !movingIds.has(id)));
  if (move.targetResourceId && !targetSiblingIds.has(move.targetResourceId)) return workspace;
  const collections = [...workspace.collections];

  if (sourceIndex === targetIndex) {
    const updated = {
      ...source,
      expanded: true,
      folders: (source.folders ?? []).map((candidate) => candidate.id === folder.id
        ? { ...candidate, parentId: move.targetParentId }
        : candidate.id === move.targetParentId ? { ...candidate, expanded: true } : candidate),
    };
    const order = insertResource(collectionResourceOrder(updated), folder.id, targetSiblingIds, move.targetResourceId, move.placement);
    collections[sourceIndex] = sortCollectionResources(updated, order);
  } else {
    const sourceOrder = collectionResourceOrder(source);
    const transferredOrder = sourceOrder.filter((id) => movingIds.has(id) && id !== folder.id);
    collections[sourceIndex] = sortCollectionResources({
      ...source,
      folders: (source.folders ?? []).filter((candidate) => !subtreeIds.has(candidate.id)),
      requests: source.requests.filter((request) => !movingRequestIds.has(request.id)),
    }, sourceOrder.filter((id) => !movingIds.has(id)));
    const transferredFolders = (source.folders ?? []).filter((candidate) => subtreeIds.has(candidate.id)).map((candidate) => candidate.id === folder.id ? { ...candidate, parentId: move.targetParentId } : candidate);
    const transferredRequests = source.requests.filter((request) => movingRequestIds.has(request.id));
    const updatedTarget = {
      ...target,
      expanded: true,
      folders: [
        ...(target.folders ?? []).map((candidate) => candidate.id === move.targetParentId ? { ...candidate, expanded: true } : candidate),
        ...transferredFolders,
      ],
      requests: [...target.requests, ...transferredRequests],
    };
    let order = insertResource(collectionResourceOrder(updatedTarget).filter((id) => !movingIds.has(id)), folder.id, targetSiblingIds, move.targetResourceId, move.placement);
    order = [...order, ...transferredOrder];
    collections[targetIndex] = sortCollectionResources(updatedTarget, order);
  }
  return { ...workspace, collections };
};

export const variableScope = (layers: KeyValue[][]): VariableScope => {
  const values: Record<string, string> = {};
  const disabled = new Set<string>();
  layers.forEach((rows) => rows.forEach((row) => {
    const name = row.name.trim();
    if (!name) return;
    if (row.enabled) { values[name] = row.value; disabled.delete(name); }
    else { delete values[name]; disabled.add(name); }
  }));
  return { values, disabled: [...disabled] };
};

export type ScriptEnvironmentScopes = {
  baseId: string;
  selectedId: string;
  baseGlobals: VariableScope;
  globals: VariableScope;
  globalsAreBase: boolean;
};

export const scriptEnvironmentScopes = (environments: Environment[], activeId: string): ScriptEnvironmentScopes | undefined => {
  const selected = environments.find((environment) => environment.id === activeId) ?? environments[0];
  if (!selected) return undefined;
  const ancestors = environmentAncestors(environments, selected.id);
  const base = ancestors[0] ?? selected;
  const globalsAreBase = base.id === selected.id;
  return {
    baseId: base.id,
    selectedId: selected.id,
    baseGlobals: variableScope([base.variables]),
    globals: globalsAreBase ? variableScope([base.variables]) : variableScope([...ancestors.slice(1).map((environment) => environment.variables), selected.variables]),
    globalsAreBase,
  };
};

export const collectionEnvironmentScopes = (collection: Collection) => {
  const selected = (collection.subEnvironments ?? []).find((environment) => environment.id === collection.activeSubEnvironmentId);
  return {
    baseEnvironment: variableScope([collection.environment ?? []]),
    environment: selected ? variableScope([selected.variables]) : variableScope([collection.environment ?? []]),
    environmentIsBase: !selected,
    selectedId: selected?.id,
  };
};

const rowMap = (rows: KeyValue[], caseInsensitive: boolean) => {
  const output = new Map<string, KeyValue>();
  rows.forEach((row) => {
    const name = row.name.trim();
    if (!name) return;
    output.set(caseInsensitive ? name.toLowerCase() : name, row);
  });
  return output;
};

const mergeRows = (layers: KeyValue[][], caseInsensitive = false): KeyValue[] => {
  const merged = new Map<string, KeyValue>();
  layers.forEach((rows) => rowMap(rows, caseInsensitive).forEach((row, name) => merged.set(name, row)));
  return [...merged.values()];
};

export const resolveEnvironment = (environments: Environment[], activeId: string): Environment | undefined => {
  const selected = environments.find((environment) => environment.id === activeId) ?? environments[0];
  if (!selected) return undefined;
  const byId = new Map(environments.map((environment) => [environment.id, environment]));
  const chain: Environment[] = [];
  const visited = new Set<string>();
  let current: Environment | undefined = selected;
  while (current && !visited.has(current.id) && chain.length < 20) {
    visited.add(current.id);
    chain.unshift(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return { ...selected, variables: mergeRows(chain.map((environment) => environment.variables)) };
};

export const environmentAncestors = (environments: Environment[], environmentId: string): Environment[] => {
  const byId = new Map(environments.map((environment) => [environment.id, environment]));
  const output: Environment[] = [];
  const visited = new Set<string>();
  let current = byId.get(environmentId);
  while (current?.parentId && !visited.has(current.id) && output.length < 20) {
    visited.add(current.id);
    const parent = byId.get(current.parentId);
    if (!parent) break;
    output.unshift(parent);
    current = parent;
  }
  return output;
};

export const folderAncestors = (collection: Collection, folderId: string | undefined): RequestFolder[] => {
  if (!folderId) return [];
  const byId = new Map((collection.folders ?? []).map((folder) => [folder.id, folder]));
  const chain: RequestFolder[] = [];
  const visited = new Set<string>();
  let current = byId.get(folderId);
  while (current && !visited.has(current.id) && chain.length < 20) {
    visited.add(current.id);
    chain.unshift(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return chain;
};

const joinedScripts = (scripts: string[]) => scripts.map((script) => script.trim()).filter(Boolean).join('\n\n');

export const applyCollectionConfiguration = (collection: Collection, request: ApiRequest, environment: Environment): { request: ApiRequest; environment: Environment; folders: RequestFolder[] } => {
  const folders = folderAncestors(collection, request.folderId);
  const nearestAuth = [...folders].reverse().find((folder) => folder.auth)?.auth;
  const selectedCollectionEnvironment = (collection.subEnvironments ?? []).find((candidate) => candidate.id === collection.activeSubEnvironmentId);
  return {
    folders,
    environment: { ...environment, variables: mergeRows([environment.variables, collection.environment ?? [], selectedCollectionEnvironment?.variables ?? [], ...folders.map((folder) => folder.environment)]) },
    request: {
      ...request,
      headers: mergeRows([...folders.map((folder) => folder.headers), request.headers], true),
      auth: request.inheritFolderAuth && nearestAuth ? structuredClone(nearestAuth) : request.auth,
      preRequestScript: joinedScripts([...folders.map((folder) => folder.preRequestScript), request.preRequestScript]),
      tests: joinedScripts([request.tests, ...[...folders].reverse().map((folder) => folder.tests)]),
    },
  };
};

export const publicEnvironments = (environments: Environment[]): Environment[] => {
  const byId = new Map(environments.map((environment) => [environment.id, environment]));
  const isEffectivelyPrivate = (environment: Environment) => {
    const visited = new Set<string>();
    let current: Environment | undefined = environment;
    while (current && !visited.has(current.id) && visited.size < 500) {
      if (current.private) return true;
      visited.add(current.id);
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
    return false;
  };
  return environments.filter((environment) => !isEffectivelyPrivate(environment));
};

export const folderPath = (collection: Collection, folderId: string): string => folderAncestors(collection, folderId).map((folder) => folder.name).join(' / ');
