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

export type WorkspaceResourceKeyboardTarget =
  | { kind: 'collection'; collectionId: string }
  | { kind: 'folder' | 'request'; collectionId: string; resourceId: string };

export type WorkspaceResourceKeyboardAction = 'up' | 'down' | 'first' | 'last' | 'indent' | 'outdent';

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

export const keyboardWorkspaceResourceMove = (
  workspace: Workspace,
  target: WorkspaceResourceKeyboardTarget,
  action: WorkspaceResourceKeyboardAction,
): WorkspaceResourceMove | undefined => {
  if (target.kind === 'collection') {
    const index = workspace.collections.findIndex((collection) => collection.id === target.collectionId);
    if (index < 0 || workspace.collections.length < 2 || action === 'indent' || action === 'outdent') return undefined;
    const targetIndex = action === 'up' ? index - 1 : action === 'down' ? index + 1 : action === 'first' ? 0 : workspace.collections.length - 1;
    const sibling = workspace.collections[targetIndex];
    if (!sibling || sibling.id === target.collectionId) return undefined;
    return {
      kind: 'collection',
      collectionId: target.collectionId,
      targetCollectionId: sibling.id,
      placement: action === 'down' || action === 'last' ? 'after' : 'before',
    };
  }

  const collection = workspace.collections.find((candidate) => candidate.id === target.collectionId);
  if (!collection) return undefined;
  const folder = target.kind === 'folder' ? (collection.folders ?? []).find((candidate) => candidate.id === target.resourceId) : undefined;
  const request = target.kind === 'request' ? collection.requests.find((candidate) => candidate.id === target.resourceId) : undefined;
  if (!folder && !request) return undefined;
  const parentId = folder?.parentId ?? request?.folderId ?? '';
  const siblings = orderedCollectionChildren(collection, parentId);
  const index = siblings.findIndex((candidate) => candidate.kind === target.kind && candidate.id === target.resourceId);
  if (index < 0) return undefined;
  if (action === 'indent') {
    const previous = siblings[index - 1];
    return previous?.kind === 'folder' ? { ...target, targetCollectionId: collection.id, targetParentId: previous.id } : undefined;
  }
  if (action === 'outdent') {
    const parent = (collection.folders ?? []).find((candidate) => candidate.id === parentId);
    return parent ? { ...target, targetCollectionId: collection.id, targetParentId: parent.parentId, targetResourceId: parent.id, placement: 'after' } : undefined;
  }
  const targetIndex = action === 'up' ? index - 1 : action === 'down' ? index + 1 : action === 'first' ? 0 : siblings.length - 1;
  const sibling = siblings[targetIndex];
  if (!sibling || sibling.id === target.resourceId) return undefined;
  return {
    ...target,
    targetCollectionId: collection.id,
    targetParentId: parentId,
    targetResourceId: sibling.id,
    placement: action === 'down' || action === 'last' ? 'after' : 'before',
  };
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

export const duplicateWorkspaceFolder = (
  workspace: Workspace,
  collectionId: string,
  folderId: string,
  name: string,
  createId: (kind: string) => string = (kind) => `${kind}-${crypto.randomUUID()}`,
): Workspace => {
  const collection = workspace.collections.find((candidate) => candidate.id === collectionId);
  const root = (collection?.folders ?? []).find((folder) => folder.id === folderId);
  if (!collection || !root || !name.trim()) return workspace;
  const subtreeIds = folderSubtree(collection, folderId);
  const folders = (collection.folders ?? []).filter((folder) => subtreeIds.has(folder.id));
  const requests = collection.requests.filter((request) => request.folderId && subtreeIds.has(request.folderId));
  const folderIds = new Map(folders.map((folder) => [folder.id, createId('folder')]));
  const requestIds = new Map(requests.map((request) => [request.id, createId('request')]));
  const duplicatedFolders = folders.map((folder) => ({
    ...structuredClone(folder),
    id: folderIds.get(folder.id)!,
    name: folder.id === folderId ? name.trim() : folder.name,
    parentId: folder.id === folderId ? root.parentId : folderIds.get(folder.parentId) ?? root.parentId,
    headers: folder.headers.map((row) => ({ ...row, id: createId('header') })),
    environment: folder.environment.map((row) => ({ ...row, id: createId('variable') })),
    source: undefined,
  }));
  const duplicatedRequests = requests.map((request) => {
    const copy = structuredClone(request);
    copy.id = requestIds.get(request.id)!;
    copy.folderId = folderIds.get(request.folderId ?? '') ?? '';
    copy.pathParams = copy.pathParams.map((row) => ({ ...row, id: createId('path') }));
    copy.params = copy.params.map((row) => ({ ...row, id: createId('parameter') }));
    copy.headers = copy.headers.map((row) => ({ ...row, id: createId('header') }));
    copy.formBody = copy.formBody.map((row) => ({ ...row, id: createId('form') }));
    copy.multipartBody = copy.multipartBody.map((row) => ({ ...row, id: createId('multipart') }));
    copy.grpc.metadata = copy.grpc.metadata.map((row) => ({ ...row, id: createId('metadata') }));
    copy.socketIo.args = copy.socketIo.args.map((argument) => ({ ...argument, id: createId('socket-argument') }));
    copy.socketIo.eventListeners = copy.socketIo.eventListeners.map((listener) => ({ ...listener, id: createId('socket-listener') }));
    copy.source = undefined;
    return copy;
  });
  const order = collectionResourceOrder(collection);
  const duplicatedOrder = order.filter((id) => subtreeIds.has(id) || requestIds.has(id)).map((id) => folderIds.get(id) ?? requestIds.get(id)!).filter(Boolean);
  const lastSubtreeIndex = order.reduce((last, id, index) => subtreeIds.has(id) || requestIds.has(id) ? index : last, -1);
  order.splice(lastSubtreeIndex + 1, 0, ...duplicatedOrder);
  return {
    ...workspace,
    collections: workspace.collections.map((candidate) => candidate.id !== collectionId ? candidate : sortCollectionResources({
      ...candidate,
      folders: [...(candidate.folders ?? []), ...duplicatedFolders],
      requests: [...candidate.requests, ...duplicatedRequests],
    }, order)),
  };
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

export const requestAncestorNames = (collections: Collection[], request: ApiRequest): string[] => {
  const collection = collections.find((candidate) => candidate.requests.some((item) => item.id === request.id));
  if (!collection) return [];
  return [...folderAncestors(collection, request.folderId)].reverse().map((folder) => folder.name).concat(collection.name);
};

export const persistEffectiveAuthentication = (
  collection: Collection,
  requestId: string,
  auth: ApiRequest['auth'],
): Collection => {
  const request = collection.requests.find((candidate) => candidate.id === requestId);
  if (!request) return collection;
  const ownerFolder = request.inheritFolderAuth
    ? [...folderAncestors(collection, request.folderId)].reverse().find((folder) => folder.auth)
    : undefined;
  if (ownerFolder) {
    return {
      ...collection,
      folders: (collection.folders ?? []).map((folder) => folder.id === ownerFolder.id ? { ...folder, auth } : folder),
    };
  }
  return {
    ...collection,
    requests: collection.requests.map((candidate) => candidate.id === requestId ? { ...candidate, auth } : candidate),
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
