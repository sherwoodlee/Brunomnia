import type { Collection, CookieRecord, Environment, KeyValue, UnitTestSuite, Workspace } from '../types';

export type ProjectWorkspaceScope = 'collection' | 'design' | 'mock-server' | 'environment' | 'mcp';

export type ProjectWorkspaceSummary = {
  id: string;
  name: string;
  scope: ProjectWorkspaceScope;
  label: 'Collection' | 'Document' | 'Mock Server' | 'Environment' | 'MCP Client';
};

export type DuplicateProjectWorkspaceResult = {
  workspace: Workspace;
  projectWorkspace: ProjectWorkspaceSummary;
};

export type MoveProjectWorkspaceResult = {
  source: Workspace;
  target: Workspace;
  projectWorkspace: ProjectWorkspaceSummary;
};

type IdFactory = (prefix: string) => string;

const nextId: IdFactory = (prefix) => `${prefix}-${crypto.randomUUID()}`;
const cleanName = (name: string, fallback: string) => name.replace(/[\r\n\0]/g, ' ').trim().slice(0, 200) || fallback;
const cloneRows = (rows: KeyValue[], id: IdFactory) => rows.map((row) => ({ ...row, id: id('row') }));

const environmentRoots = (environments: Environment[]) => {
  const ids = new Set(environments.map((environment) => environment.id));
  return environments.filter((environment) => !environment.parentId || !ids.has(environment.parentId));
};

export const listProjectWorkspaces = (workspace: Workspace): ProjectWorkspaceSummary[] => {
  const generatedCollectionIds = new Set(workspace.apiDesigns.flatMap((design) => design.generatedCollectionId ? [design.generatedCollectionId] : []));
  return [
    ...workspace.collections.filter((collection) => !generatedCollectionIds.has(collection.id)).map((collection): ProjectWorkspaceSummary => ({ id: collection.id, name: collection.name, scope: 'collection', label: 'Collection' })),
    ...workspace.apiDesigns.map((design): ProjectWorkspaceSummary => ({ id: design.id, name: design.name, scope: 'design', label: 'Document' })),
    ...workspace.mockServers.map((server): ProjectWorkspaceSummary => ({ id: server.id, name: server.name, scope: 'mock-server', label: 'Mock Server' })),
    ...environmentRoots(workspace.environments).map((environment): ProjectWorkspaceSummary => ({ id: environment.id, name: environment.name, scope: 'environment', label: 'Environment' })),
    ...workspace.mcpClients.map((client): ProjectWorkspaceSummary => ({ id: client.id, name: client.name, scope: 'mcp', label: 'MCP Client' })),
  ];
};

export const isProjectWorkspaceEmpty = (workspace: Workspace) => listProjectWorkspaces(workspace).length === 0 && workspace.testSuites.length === 0;

const cloneCollection = (source: Collection, name: string, id: IdFactory) => {
  const collectionId = id('collection');
  const folderIds = new Map((source.folders ?? []).map((folder) => [folder.id, id('folder')]));
  const requestIds = new Map(source.requests.map((request) => [request.id, id('request')]));
  const environmentIds = new Map((source.subEnvironments ?? []).map((environment) => [environment.id, id('environment')]));
  const collection: Collection = {
    ...structuredClone(source),
    id: collectionId,
    name,
    environment: cloneRows(source.environment ?? [], id),
    subEnvironments: (source.subEnvironments ?? []).map((environment) => ({
      ...structuredClone(environment),
      id: environmentIds.get(environment.id)!,
      variables: cloneRows(environment.variables, id),
    })),
    activeSubEnvironmentId: source.activeSubEnvironmentId ? environmentIds.get(source.activeSubEnvironmentId) ?? '' : '',
    resourceOrder: (source.resourceOrder ?? []).flatMap((resourceId) => {
      const mapped = folderIds.get(resourceId) ?? requestIds.get(resourceId);
      return mapped ? [mapped] : [];
    }),
    folders: (source.folders ?? []).map((folder) => ({
      ...structuredClone(folder),
      id: folderIds.get(folder.id)!,
      parentId: folder.parentId ? folderIds.get(folder.parentId) ?? '' : '',
      headers: cloneRows(folder.headers, id),
      environment: cloneRows(folder.environment, id),
    })),
    requests: source.requests.map((request) => ({
      ...structuredClone(request),
      id: requestIds.get(request.id)!,
      folderId: request.folderId ? folderIds.get(request.folderId) ?? '' : '',
      pathParams: cloneRows(request.pathParams, id),
      params: cloneRows(request.params, id),
      headers: cloneRows(request.headers, id),
      formBody: cloneRows(request.formBody, id),
      multipartBody: request.multipartBody.map((part) => ({ ...structuredClone(part), id: id('multipart') })),
      graphql: structuredClone(request.graphql),
      grpc: {
        ...structuredClone(request.grpc),
        protoFiles: request.grpc.protoFiles.map((file) => ({ ...structuredClone(file), id: id('proto') })),
        metadata: cloneRows(request.grpc.metadata, id),
      },
      socketIo: {
        ...structuredClone(request.socketIo),
        args: request.socketIo.args.map((arg) => ({ ...structuredClone(arg), id: id('socket-arg') })),
        eventListeners: request.socketIo.eventListeners.map((listener) => ({ ...structuredClone(listener), id: id('socket-listener') })),
      },
    })),
  };
  return { collection, collectionId, folderIds, requestIds };
};

const cloneSuites = (suites: UnitTestSuite[], collectionId: string, requestIds: Map<string, string>, id: IdFactory) => suites.map((suite) => ({
  ...structuredClone(suite),
  id: id('suite'),
  collectionId,
  tests: suite.tests.map((test) => ({
    ...structuredClone(test),
    id: id('test'),
    requestId: test.requestId ? requestIds.get(test.requestId) ?? null : null,
  })),
}));

const mergeCookies = (target: CookieRecord[], source: CookieRecord[], id: IdFactory) => {
  const output = new Map(target.map((cookie) => [`${cookie.name}\n${cookie.domain}\n${cookie.path}`, cookie]));
  source.forEach((cookie) => output.set(`${cookie.name}\n${cookie.domain}\n${cookie.path}`, { ...structuredClone(cookie), id: id('cookie') }));
  return [...output.values()];
};

const environmentBranch = (environments: Environment[], rootId: string) => {
  const byParent = new Map<string, Environment[]>();
  environments.forEach((environment) => {
    const children = byParent.get(environment.parentId ?? '') ?? [];
    children.push(environment);
    byParent.set(environment.parentId ?? '', children);
  });
  const output: Environment[] = [];
  const pending = [rootId];
  const seen = new Set<string>();
  while (pending.length) {
    const currentId = pending.shift()!;
    if (seen.has(currentId)) continue;
    seen.add(currentId);
    const current = environments.find((environment) => environment.id === currentId);
    if (!current) continue;
    output.push(current);
    pending.push(...(byParent.get(currentId) ?? []).map((environment) => environment.id));
  }
  return output;
};

export const duplicateProjectWorkspace = (
  source: Workspace,
  target: Workspace,
  projectWorkspaceId: string,
  requestedName: string,
  id: IdFactory = nextId,
): DuplicateProjectWorkspaceResult => {
  const summary = listProjectWorkspaces(source).find((candidate) => candidate.id === projectWorkspaceId);
  if (!summary) throw new Error('The selected project file no longer exists.');
  const name = cleanName(requestedName, summary.name);
  let workspace = structuredClone(target);
  let duplicatedId = '';

  if (summary.scope === 'collection') {
    const sourceCollection = source.collections.find((collection) => collection.id === summary.id)!;
    const cloned = cloneCollection(sourceCollection, name, id);
    duplicatedId = cloned.collectionId;
    workspace.collections.push(cloned.collection);
    workspace.activeRequestId = cloned.collection.requests[0]?.id ?? workspace.activeRequestId;
    if (source !== target) workspace.cookies = mergeCookies(workspace.cookies, source.cookies, id);
  } else if (summary.scope === 'design') {
    const sourceDesign = source.apiDesigns.find((design) => design.id === summary.id)!;
    duplicatedId = id('design');
    const generated = source.collections.find((collection) => collection.id === sourceDesign.generatedCollectionId);
    if (generated) {
      const cloned = cloneCollection(generated, generated.name, id);
      const sourceSuites = source.testSuites.filter((suite) => suite.collectionId === generated.id);
      workspace.collections.push(cloned.collection);
      workspace.testSuites.push(...cloneSuites(sourceSuites, cloned.collectionId, cloned.requestIds, id));
      workspace.activeRequestId = cloned.collection.requests[0]?.id ?? workspace.activeRequestId;
      workspace.apiDesigns.push({ ...structuredClone(sourceDesign), id: duplicatedId, name, generatedCollectionId: cloned.collectionId });
      if (source !== target) workspace.cookies = mergeCookies(workspace.cookies, source.cookies, id);
    } else {
      workspace.apiDesigns.push({ ...structuredClone(sourceDesign), id: duplicatedId, name, generatedCollectionId: undefined });
    }
  } else if (summary.scope === 'mock-server') {
    const server = source.mockServers.find((candidate) => candidate.id === summary.id)!;
    duplicatedId = id('mock-server');
    workspace.mockServers.push({
      ...structuredClone(server),
      id: duplicatedId,
      name,
      routes: server.routes.map((route) => ({ ...structuredClone(route), id: id('mock-route'), headers: cloneRows(route.headers, id) })),
    });
  } else if (summary.scope === 'environment') {
    const branch = environmentBranch(source.environments, summary.id);
    const environmentIds = new Map(branch.map((environment) => [environment.id, id('environment')]));
    duplicatedId = environmentIds.get(summary.id)!;
    workspace.environments.push(...branch.map((environment) => ({
      ...structuredClone(environment),
      id: environmentIds.get(environment.id)!,
      name: environment.id === summary.id ? name : environment.name,
      parentId: environment.parentId ? environmentIds.get(environment.parentId) ?? '' : '',
      variables: cloneRows(environment.variables, id),
    })));
    workspace.activeEnvironmentId = duplicatedId;
  } else {
    const client = source.mcpClients.find((candidate) => candidate.id === summary.id)!;
    duplicatedId = id('mcp');
    workspace.mcpClients.push({
      ...structuredClone(client),
      id: duplicatedId,
      name,
      enabled: false,
      env: cloneRows(client.env, id),
      headers: cloneRows(client.headers, id),
      token: client.authType === 'oauth2' ? '' : client.token,
      oauthState: '',
      oauthRefreshToken: '',
      oauthIdentityToken: '',
      oauthExpiresAt: 0,
      oauthRegisteredClientId: '',
      oauthRegisteredClientSecret: '',
      oauthRegisteredClientIdIssuedAt: 0,
      oauthRegisteredClientSecretExpiresAt: 0,
      oauthRegisteredTokenEndpointAuthMethod: 'none',
    });
  }

  return {
    workspace,
    projectWorkspace: { ...summary, id: duplicatedId, name },
  };
};

const projectIdentityIds = (workspace: Workspace) => new Set([
  ...workspace.collections.flatMap((collection) => [collection.id, ...(collection.folders ?? []).map((folder) => folder.id), ...collection.requests.map((request) => request.id), ...(collection.subEnvironments ?? []).map((environment) => environment.id)]),
  ...workspace.apiDesigns.map((design) => design.id),
  ...workspace.mockServers.flatMap((server) => [server.id, ...server.routes.map((route) => route.id)]),
  ...workspace.environments.map((environment) => environment.id),
  ...workspace.testSuites.flatMap((suite) => [suite.id, ...suite.tests.map((test) => test.id)]),
  ...workspace.unitTestResults.map((result) => result.id),
  ...workspace.runnerReports.flatMap((report) => [report.id, ...report.results.map((result) => result.id)]),
  ...workspace.history.map((entry) => entry.id),
  ...workspace.responses.map((response) => response.id),
  ...workspace.streamSessions.map((session) => session.id),
  ...workspace.mcpClients.map((client) => client.id),
  ...workspace.mcpSessions.map((session) => session.id),
]);

const assertNoIdentityCollisions = (target: Workspace, ids: Iterable<string>) => {
  const targetIds = projectIdentityIds(target);
  const collision = [...ids].find((id) => targetIds.has(id));
  if (collision) throw new Error(`The destination project already contains resource identity '${collision}'. Duplicate the file instead of moving it.`);
};

const partition = <Item>(items: Item[], belongs: (item: Item) => boolean) => ({
  moved: items.filter(belongs),
  remaining: items.filter((item) => !belongs(item)),
});

const repairSourceCollections = (workspace: Workspace) => {
  const requestIds = new Set(workspace.collections.flatMap((collection) => collection.requests.map((request) => request.id)));
  if (!requestIds.has(workspace.activeRequestId)) workspace.activeRequestId = workspace.collections.flatMap((collection) => collection.requests)[0]?.id ?? '';
};

const repairSourceEnvironments = (workspace: Workspace) => {
  if (!workspace.environments.some((environment) => environment.id === workspace.activeEnvironmentId)) workspace.activeEnvironmentId = workspace.environments[0]?.id ?? '';
};

const splitResponseFilters = (filters: Workspace['responseFilters'], requestIds: Set<string>) => {
  const moved: NonNullable<Workspace['responseFilters']> = {};
  const remaining: NonNullable<Workspace['responseFilters']> = {};
  Object.entries(filters ?? {}).forEach(([requestId, value]) => {
    (requestIds.has(requestId) ? moved : remaining)[requestId] = value;
  });
  return { moved, remaining };
};

const moveCollectionOwnedResources = (source: Workspace, target: Workspace, collection: Collection, id: IdFactory) => {
  const requestIds = new Set(collection.requests.map((request) => request.id));
  const suites = partition(source.testSuites, (suite) => suite.collectionId === collection.id);
  const suiteIds = new Set(suites.moved.map((suite) => suite.id));
  const unitTestResults = partition(source.unitTestResults, (result) => suiteIds.has(result.suiteId));
  const runnerReports = partition(source.runnerReports, (report) => report.collectionId === collection.id);
  const history = partition(source.history, (entry) => requestIds.has(entry.requestId));
  const responses = partition(source.responses, (response) => requestIds.has(response.requestId));
  const streamSessions = partition(source.streamSessions, (session) => requestIds.has(session.requestId));
  const responseFilters = splitResponseFilters(source.responseFilters, requestIds);
  const movedIds = new Set([
    collection.id,
    ...(collection.folders ?? []).map((folder) => folder.id),
    ...collection.requests.map((request) => request.id),
    ...(collection.subEnvironments ?? []).map((environment) => environment.id),
    ...suites.moved.flatMap((suite) => [suite.id, ...suite.tests.map((test) => test.id)]),
    ...unitTestResults.moved.map((result) => result.id),
    ...runnerReports.moved.flatMap((report) => [report.id, ...report.results.map((result) => result.id)]),
    ...history.moved.map((entry) => entry.id),
    ...responses.moved.map((response) => response.id),
    ...streamSessions.moved.map((session) => session.id),
  ]);
  assertNoIdentityCollisions(target, movedIds);

  source.collections = source.collections.filter((candidate) => candidate.id !== collection.id);
  source.testSuites = suites.remaining;
  source.unitTestResults = unitTestResults.remaining;
  source.runnerReports = runnerReports.remaining;
  source.history = history.remaining;
  source.responses = responses.remaining;
  source.streamSessions = streamSessions.remaining;
  source.responseFilters = responseFilters.remaining;

  target.collections.push(collection);
  target.testSuites.push(...suites.moved);
  target.unitTestResults.push(...unitTestResults.moved);
  target.runnerReports = [...runnerReports.moved, ...target.runnerReports];
  target.history = [...history.moved, ...target.history].sort((left, right) => right.createdAt.localeCompare(left.createdAt)).slice(0, 100);
  target.responses.push(...responses.moved);
  target.streamSessions.push(...streamSessions.moved);
  target.responseFilters = { ...target.responseFilters, ...responseFilters.moved };
  target.cookies = mergeCookies(target.cookies, source.cookies, id);
  target.activeRequestId = collection.requests[0]?.id ?? target.activeRequestId;
};

export const moveProjectWorkspace = (
  sourceWorkspace: Workspace,
  targetWorkspace: Workspace,
  projectWorkspaceId: string,
  id: IdFactory = nextId,
): MoveProjectWorkspaceResult => {
  if (sourceWorkspace === targetWorkspace) throw new Error('Choose a different destination project to move this file.');
  const summary = listProjectWorkspaces(sourceWorkspace).find((candidate) => candidate.id === projectWorkspaceId);
  if (!summary) throw new Error('The selected project file no longer exists.');
  const source = structuredClone(sourceWorkspace);
  const target = structuredClone(targetWorkspace);

  if (summary.scope === 'collection') {
    const collection = source.collections.find((candidate) => candidate.id === summary.id)!;
    moveCollectionOwnedResources(source, target, collection, id);
    repairSourceCollections(source);
  } else if (summary.scope === 'design') {
    const design = source.apiDesigns.find((candidate) => candidate.id === summary.id)!;
    const generated = source.collections.find((collection) => collection.id === design.generatedCollectionId);
    if (projectIdentityIds(target).has(design.id)) throw new Error(`The destination project already contains resource identity '${design.id}'. Duplicate the file instead of moving it.`);
    if (generated) moveCollectionOwnedResources(source, target, generated, id);
    source.apiDesigns = source.apiDesigns.filter((candidate) => candidate.id !== design.id);
    target.apiDesigns.push(design);
    repairSourceCollections(source);
  } else if (summary.scope === 'mock-server') {
    const server = source.mockServers.find((candidate) => candidate.id === summary.id)!;
    assertNoIdentityCollisions(target, [server.id, ...server.routes.map((route) => route.id)]);
    source.mockServers = source.mockServers.filter((candidate) => candidate.id !== server.id);
    target.mockServers.push(server);
  } else if (summary.scope === 'environment') {
    const branch = environmentBranch(source.environments, summary.id);
    assertNoIdentityCollisions(target, branch.map((environment) => environment.id));
    const branchIds = new Set(branch.map((environment) => environment.id));
    source.environments = source.environments.filter((environment) => !branchIds.has(environment.id));
    target.environments.push(...branch);
    target.activeEnvironmentId = summary.id;
    repairSourceEnvironments(source);
  } else {
    const client = source.mcpClients.find((candidate) => candidate.id === summary.id)!;
    const sessions = partition(source.mcpSessions, (session) => session.clientId === client.id);
    assertNoIdentityCollisions(target, [client.id, ...sessions.moved.map((session) => session.id)]);
    source.mcpClients = source.mcpClients.filter((candidate) => candidate.id !== client.id);
    source.mcpSessions = sessions.remaining;
    target.mcpClients.push(client);
    target.mcpSessions.push(...sessions.moved);
  }

  return { source, target, projectWorkspace: summary };
};
