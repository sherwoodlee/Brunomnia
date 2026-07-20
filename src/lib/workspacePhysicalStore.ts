import type { Environment, Workspace, WorkspaceFileState } from '../types';

export const workspacePhysicalStoreFormat = 'brunomnia-project-store';
export const workspacePhysicalRecordFormat = 'brunomnia-project-file';

export type WorkspacePhysicalScope = 'collection' | 'design' | 'mock-server' | 'environment' | 'mcp';

export type WorkspacePhysicalRecordReference = {
  key: string;
  scope: WorkspacePhysicalScope;
  id: string;
};

export type WorkspacePhysicalManifest = {
  format: typeof workspacePhysicalStoreFormat;
  version: 1;
  workspace: Workspace;
  records: WorkspacePhysicalRecordReference[];
};

type IndexedValue<Value> = { index: number; value: Value };

export type WorkspacePhysicalRecord = {
  format: typeof workspacePhysicalRecordFormat;
  version: 1;
  scope: WorkspacePhysicalScope;
  id: string;
  fileState?: WorkspaceFileState;
  collection?: IndexedValue<Workspace['collections'][number]>;
  design?: IndexedValue<Workspace['apiDesigns'][number]>;
  generatedCollection?: IndexedValue<Workspace['collections'][number]>;
  mockServer?: IndexedValue<Workspace['mockServers'][number]>;
  environments?: Array<IndexedValue<Environment>>;
  mcpClient?: IndexedValue<Workspace['mcpClients'][number]>;
};

export type SplitWorkspacePhysicalStore = {
  manifest: WorkspacePhysicalManifest;
  records: Array<{ key: string; record: WorkspacePhysicalRecord }>;
};

const record = (value: unknown) => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
const safeIndex = (value: unknown) => Number.isSafeInteger(value) && Number(value) >= 0 ? Number(value) : undefined;
const validScope = (value: unknown): value is WorkspacePhysicalScope => value === 'collection' || value === 'design' || value === 'mock-server' || value === 'environment' || value === 'mcp';
const validId = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 500;

const environmentBranches = (environments: Environment[]) => {
  const byId = new Map(environments.map((environment, index) => [environment.id, { environment, index }]));
  const byParent = new Map<string, Array<{ environment: Environment; index: number }>>();
  environments.forEach((environment, index) => {
    const children = byParent.get(environment.parentId ?? '') ?? [];
    children.push({ environment, index });
    byParent.set(environment.parentId ?? '', children);
  });
  const assigned = new Set<string>();
  const roots = environments
    .map((environment, index) => ({ environment, index }))
    .filter(({ environment }) => !environment.parentId || !byId.has(environment.parentId));
  const branches: Array<{ id: string; values: Array<IndexedValue<Environment>> }> = [];
  const collect = (root: { environment: Environment; index: number }) => {
    const values: Array<IndexedValue<Environment>> = [];
    const pending = [root];
    while (pending.length) {
      const current = pending.shift()!;
      if (assigned.has(current.environment.id)) continue;
      assigned.add(current.environment.id);
      values.push({ index: current.index, value: current.environment });
      pending.push(...(byParent.get(current.environment.id) ?? []));
    }
    if (values.length) branches.push({ id: root.environment.id, values });
  };
  roots.forEach(collect);
  environments.forEach((environment, index) => {
    if (!assigned.has(environment.id)) collect({ environment, index });
  });
  return branches;
};

export const splitWorkspacePhysicalStore = (
  workspace: Workspace,
  keyForRecord: (scope: WorkspacePhysicalScope, id: string, index: number) => string,
): SplitWorkspacePhysicalStore => {
  const shell = structuredClone(workspace);
  const source = structuredClone(workspace);
  shell.collections = [];
  shell.environments = [];
  shell.apiDesigns = [];
  shell.mockServers = [];
  shell.mcpClients = [];
  const generatedCollectionIds = new Set(source.apiDesigns.flatMap((design) => design.generatedCollectionId ? [design.generatedCollectionId] : []));
  const consumedGeneratedCollectionIds = new Set<string>();
  const records: SplitWorkspacePhysicalStore['records'] = [];
  const seenIds = new Set<string>();

  const add = (scope: WorkspacePhysicalScope, id: string, payload: Omit<WorkspacePhysicalRecord, 'format' | 'version' | 'scope' | 'id' | 'fileState'>) => {
    if (!validId(id) || seenIds.has(id)) throw new Error(`Project file identity '${id || '(empty)'}' is invalid or duplicated.`);
    const key = keyForRecord(scope, id, records.length);
    if (!key || key.length > 1_024 || records.some((candidate) => candidate.key === key)) throw new Error('Project file storage keys must be unique and contain 1–1,024 characters.');
    seenIds.add(id);
    const fileState = source.fileState[id];
    if (fileState) delete shell.fileState[id];
    records.push({
      key,
      record: {
        format: workspacePhysicalRecordFormat,
        version: 1,
        scope,
        id,
        ...(fileState ? { fileState } : {}),
        ...payload,
      },
    });
  };

  source.collections.forEach((collection, index) => {
    if (!generatedCollectionIds.has(collection.id)) add('collection', collection.id, { collection: { index, value: collection } });
  });
  source.apiDesigns.forEach((design, index) => {
    const generatedIndex = design.generatedCollectionId
      ? source.collections.findIndex((collection) => collection.id === design.generatedCollectionId)
      : -1;
    const generatedCollection = generatedIndex >= 0 && !consumedGeneratedCollectionIds.has(design.generatedCollectionId!)
      ? { index: generatedIndex, value: source.collections[generatedIndex] }
      : undefined;
    if (generatedCollection) consumedGeneratedCollectionIds.add(generatedCollection.value.id);
    add('design', design.id, { design: { index, value: design }, ...(generatedCollection ? { generatedCollection } : {}) });
  });
  source.collections.forEach((collection, index) => {
    if (generatedCollectionIds.has(collection.id) && !consumedGeneratedCollectionIds.has(collection.id)) {
      add('collection', collection.id, { collection: { index, value: collection } });
    }
  });
  source.mockServers.forEach((mockServer, index) => add('mock-server', mockServer.id, { mockServer: { index, value: mockServer } }));
  environmentBranches(source.environments).forEach((branch) => add('environment', branch.id, { environments: branch.values }));
  source.mcpClients.forEach((mcpClient, index) => add('mcp', mcpClient.id, { mcpClient: { index, value: mcpClient } }));

  return {
    manifest: {
      format: workspacePhysicalStoreFormat,
      version: 1,
      workspace: shell,
      records: records.map(({ key, record }) => ({ key, scope: record.scope, id: record.id })),
    },
    records,
  };
};

const parseReference = (value: unknown): WorkspacePhysicalRecordReference | undefined => {
  const source = record(value);
  if (!source || typeof source.key !== 'string' || !source.key || source.key.length > 1_024 || !validScope(source.scope) || !validId(source.id)) return undefined;
  return { key: source.key, scope: source.scope, id: source.id };
};

export const isWorkspacePhysicalManifest = (value: unknown): value is WorkspacePhysicalManifest => {
  const source = record(value);
  const workspace = record(source?.workspace);
  if (source?.format !== workspacePhysicalStoreFormat || source.version !== 1 || !workspace || workspace.format !== 'brunomnia' || !Array.isArray(source.records) || source.records.length > 20_000) return false;
  const references = source.records.map(parseReference);
  if (references.some((reference) => !reference)) return false;
  const keys = new Set<string>();
  const ids = new Set<string>();
  return references.every((reference) => {
    if (!reference || keys.has(reference.key) || ids.has(reference.id)) return false;
    keys.add(reference.key);
    ids.add(reference.id);
    return true;
  });
};

const parseIndexed = <Value>(value: unknown): IndexedValue<Value> | undefined => {
  const source = record(value);
  const index = safeIndex(source?.index);
  return source && index !== undefined && source.value && typeof source.value === 'object' && !Array.isArray(source.value)
    ? { index, value: source.value as Value }
    : undefined;
};

const parsePhysicalRecord = (value: unknown, reference: WorkspacePhysicalRecordReference): WorkspacePhysicalRecord | undefined => {
  const source = record(value);
  if (source?.format !== workspacePhysicalRecordFormat || source.version !== 1 || source.scope !== reference.scope || source.id !== reference.id) return undefined;
  const fileState = record(source.fileState) as WorkspaceFileState | undefined;
  const base: Pick<WorkspacePhysicalRecord, 'format' | 'version' | 'scope' | 'id'> & { fileState?: WorkspaceFileState } = {
    format: workspacePhysicalRecordFormat,
    version: 1,
    scope: reference.scope,
    id: reference.id,
    ...(fileState ? { fileState } : {}),
  };
  if (reference.scope === 'collection') {
    const collection = parseIndexed<Workspace['collections'][number]>(source.collection);
    return collection?.value.id === reference.id ? { ...base, collection } : undefined;
  }
  if (reference.scope === 'design') {
    const design = parseIndexed<Workspace['apiDesigns'][number]>(source.design);
    const generatedCollection = source.generatedCollection === undefined ? undefined : parseIndexed<Workspace['collections'][number]>(source.generatedCollection);
    const generatedMatches = source.generatedCollection === undefined
      || (generatedCollection && generatedCollection.value.id === design?.value.generatedCollectionId);
    return design?.value.id === reference.id && generatedMatches ? { ...base, design, ...(generatedCollection ? { generatedCollection } : {}) } : undefined;
  }
  if (reference.scope === 'mock-server') {
    const mockServer = parseIndexed<Workspace['mockServers'][number]>(source.mockServer);
    return mockServer?.value.id === reference.id ? { ...base, mockServer } : undefined;
  }
  if (reference.scope === 'environment') {
    if (!Array.isArray(source.environments) || !source.environments.length || source.environments.length > 10_000) return undefined;
    const environments = source.environments.map((environment) => parseIndexed<Environment>(environment));
    return environments.every(Boolean) && environments[0]?.value.id === reference.id ? { ...base, environments: environments as Array<IndexedValue<Environment>> } : undefined;
  }
  const mcpClient = parseIndexed<Workspace['mcpClients'][number]>(source.mcpClient);
  return mcpClient?.value.id === reference.id ? { ...base, mcpClient } : undefined;
};

const orderedValues = <Value>(values: Array<IndexedValue<Value>>) => values
  .sort((left, right) => left.index - right.index)
  .map(({ value }) => value);

export const assembleWorkspacePhysicalStore = (
  manifestValue: unknown,
  recordForKey: (key: string) => unknown,
): Workspace => {
  if (!isWorkspacePhysicalManifest(manifestValue)) throw new Error('The project file manifest is invalid.');
  const manifest = manifestValue;
  const workspace = structuredClone(manifest.workspace);
  if (!Array.isArray(workspace.collections) || workspace.collections.length || !Array.isArray(workspace.environments) || workspace.environments.length
    || !Array.isArray(workspace.apiDesigns) || workspace.apiDesigns.length || !Array.isArray(workspace.mockServers) || workspace.mockServers.length
    || !Array.isArray(workspace.mcpClients) || workspace.mcpClients.length || !workspace.fileState || typeof workspace.fileState !== 'object') {
    throw new Error('The project file manifest shell is invalid.');
  }
  const collections: Array<IndexedValue<Workspace['collections'][number]>> = [];
  const designs: Array<IndexedValue<Workspace['apiDesigns'][number]>> = [];
  const mockServers: Array<IndexedValue<Workspace['mockServers'][number]>> = [];
  const environments: Array<IndexedValue<Environment>> = [];
  const mcpClients: Array<IndexedValue<Workspace['mcpClients'][number]>> = [];
  const occupied = new Set<string>();

  manifest.records.forEach((reference) => {
    const physical = parsePhysicalRecord(recordForKey(reference.key), reference);
    if (!physical || occupied.has(physical.id)) throw new Error(`Project file record '${reference.key}' is invalid.`);
    occupied.add(physical.id);
    if (physical.fileState) workspace.fileState[physical.id] = physical.fileState;
    if (physical.collection) collections.push(physical.collection);
    if (physical.design) designs.push(physical.design);
    if (physical.generatedCollection) collections.push(physical.generatedCollection);
    if (physical.mockServer) mockServers.push(physical.mockServer);
    if (physical.environments) environments.push(...physical.environments);
    if (physical.mcpClient) mcpClients.push(physical.mcpClient);
  });

  const assertUnique = (values: Array<{ id: string }>, label: string) => {
    const ids = new Set<string>();
    if (values.some((value) => !validId(value.id) || ids.has(value.id) || !ids.add(value.id))) throw new Error(`The project contains duplicated or invalid ${label} identities.`);
  };
  const assertUniqueIndexes = (values: Array<IndexedValue<unknown>>, label: string) => {
    const indexes = new Set<number>();
    if (values.some(({ index }) => {
      if (indexes.has(index)) return true;
      indexes.add(index);
      return false;
    })) throw new Error(`The project contains duplicated ${label} ordering indexes.`);
  };
  assertUniqueIndexes(collections, 'collection');
  assertUniqueIndexes(designs, 'API design');
  assertUniqueIndexes(mockServers, 'mock server');
  assertUniqueIndexes(environments, 'environment');
  assertUniqueIndexes(mcpClients, 'MCP client');
  workspace.collections = orderedValues(collections);
  workspace.apiDesigns = orderedValues(designs);
  workspace.mockServers = orderedValues(mockServers);
  workspace.environments = orderedValues(environments);
  workspace.mcpClients = orderedValues(mcpClients);
  assertUnique(workspace.collections, 'collection');
  assertUnique(workspace.apiDesigns, 'API design');
  assertUnique(workspace.mockServers, 'mock server');
  assertUnique(workspace.environments, 'environment');
  assertUnique(workspace.mcpClients, 'MCP client');
  return workspace;
};
