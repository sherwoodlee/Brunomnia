import type { ApiRequest, Collection, Environment, KeyValue, RequestFolder } from '../types';

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
  return {
    folders,
    environment: { ...environment, variables: mergeRows([environment.variables, collection.environment ?? [], ...folders.map((folder) => folder.environment)]) },
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
