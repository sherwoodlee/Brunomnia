import { stringify } from 'yaml';
import type { ApiRequest, Collection, Environment, ImportWarning, McpClient, Workspace } from '../../types';
import type { ArtifactExport, ExportFormat, ExportScope } from './types';
import { normalizeGrpcProtoTree } from '../grpcProto';
import { orderedCollectionChildren, publicEnvironments } from '../resources';
import { environmentRowsToObject } from '../environmentJson';
import { emptyWorkspaceFileState, getWorkspaceFileState, workspaceFileIdForCollection } from '../workspaceFileState';

export type ExportOptions = {
  format: ExportFormat;
  scope: ExportScope;
  collectionId?: string;
  designId?: string;
  requestIds?: string[];
  includePrivateEnvironments?: boolean;
};

const safeName = (value: string) => value.trim().replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'brunomnia-export';

const environmentData = (rows: Workspace['environments'][number]['variables']) => environmentRowsToObject(rows).object
  ?? Object.fromEntries(rows.filter((row) => row.enabled && row.name.trim()).map((row) => [row.name.trim(), row.value]));

const insomniaV4EnvironmentFields = (rows: Workspace['environments'][number]['variables'], mode: 'table' | 'raw' | undefined, dataKey: 'data' | 'environment' = 'data') => ({
  [dataKey]: environmentData(rows),
  environmentType: mode === 'raw' ? 'json' : 'kv',
  kvPairData: mode === 'raw' ? [] : rows.map((row) => ({ id: row.id, name: row.name, value: row.value, type: row.valueType === 'json' ? 'json' : 'str', enabled: row.enabled })),
});

const selectCollectionRequests = (collection: Collection, requestIds: string[] | undefined): Collection => {
  if (!requestIds) return collection;
  const selectedIds = new Set(requestIds);
  const requests = collection.requests.filter((request) => selectedIds.has(request.id));
  const foldersById = new Map((collection.folders ?? []).map((folder) => [folder.id, folder]));
  const folderIds = new Set<string>();
  requests.forEach((request) => {
    let folderId = request.folderId;
    const visited = new Set<string>();
    while (folderId && !visited.has(folderId)) {
      visited.add(folderId);
      folderIds.add(folderId);
      folderId = foldersById.get(folderId)?.parentId ?? '';
    }
  });
  const retainedIds = new Set([...selectedIds, ...folderIds]);
  return {
    ...collection,
    requests,
    folders: (collection.folders ?? []).filter((folder) => folderIds.has(folder.id)),
    resourceOrder: (collection.resourceOrder ?? []).filter((id) => retainedIds.has(id)),
  };
};

const selectedCollections = (workspace: Workspace, options: ExportOptions) => options.scope === 'collection'
  ? workspace.collections.filter((collection) => collection.id === options.collectionId).map((collection) => selectCollectionRequests(collection, options.requestIds))
  : options.scope === 'design'
    ? workspace.collections.filter((collection) => collection.id === workspace.apiDesigns.find((design) => design.id === options.designId)?.generatedCollectionId)
    : workspace.collections;

const exportEnvironments = (workspace: Workspace, options: ExportOptions) => options.includePrivateEnvironments
  ? workspace.environments
  : publicEnvironments(workspace.environments);

const selectedDesigns = (workspace: Workspace, options: ExportOptions) => options.scope === 'design'
  ? workspace.apiDesigns.filter((design) => design.id === options.designId)
  : options.scope === 'all' ? workspace.apiDesigns : [];

const scopedWorkspace = (workspace: Workspace, options: ExportOptions): Workspace => {
  const environments = exportEnvironments(workspace, options);
  const activeEnvironmentId = environments.some((environment) => environment.id === workspace.activeEnvironmentId) ? workspace.activeEnvironmentId : environments[0]?.id ?? '';
  if (options.scope === 'all') return { ...workspace, environments, activeEnvironmentId };
  const collections = selectedCollections(workspace, options);
  const designs = selectedDesigns(workspace, options);
  const collectionIds = new Set(collections.map((collection) => collection.id));
  const requestIds = new Set(collections.flatMap((collection) => collection.requests.map((request) => request.id)));
  const testSuites = workspace.testSuites.filter((suite) => collectionIds.has(suite.collectionId)).map((suite) => {
    const tests = suite.tests.filter((test) => test.requestId === null || requestIds.has(test.requestId));
    return { ...suite, tests };
  });
  const testIdsBySuite = new Map(testSuites.map((suite) => [suite.id, new Set(suite.tests.map((test) => test.id))]));
  const fileIds = new Set(options.scope === 'design'
    ? designs.map((design) => design.id)
    : collections.map((collection) => workspaceFileIdForCollection(workspace, collection.id)));
  return {
    ...workspace,
    activeRequestId: collections.flatMap((collection) => collection.requests)[0]?.id ?? '',
    collections,
    apiDesigns: designs,
    mockServers: [],
    testSuites,
    unitTestResults: workspace.unitTestResults.flatMap((result) => {
      const testIds = testIdsBySuite.get(result.suiteId);
      return testIds ? [{ ...result, tests: result.tests.filter((test) => testIds.has(test.testId)) }] : [];
    }),
    environments,
    activeEnvironmentId,
    runnerReports: workspace.runnerReports.filter((report) => collections.some((collection) => collection.id === report.collectionId)),
    cookies: [],
    fileState: Object.fromEntries(Object.entries(workspace.fileState).filter(([fileId]) => fileIds.has(fileId))),
    certificates: emptyWorkspaceFileState().certificates,
  };
};

const insomniaAuth = (auth: ApiRequest['auth']) => {
  const disabled = auth.disabled;
  if (auth.type === 'basic' || auth.type === 'digest') return { type: auth.type, username: auth.username, password: auth.password, disabled };
  if (auth.type === 'bearer') return { type: 'bearer', token: auth.token, prefix: auth.prefix, disabled };
  if (auth.type === 'api-key') return { type: 'apikey', key: auth.apiKeyName, value: auth.apiKeyValue, addTo: auth.apiKeyLocation === 'query' ? 'queryParams' : 'header', disabled };
  if (auth.type === 'oauth1') return { type: 'oauth1', disabled, signatureMethod: auth.oauth1SignatureMethod, consumerKey: auth.consumerKey, consumerSecret: auth.consumerSecret, tokenKey: auth.tokenKey, tokenSecret: auth.tokenSecret, privateKey: auth.privateKey, version: auth.version, nonce: auth.nonce, timestamp: auth.timestamp, callback: auth.callback, realm: auth.realm, verifier: auth.verifier, includeBodyHash: auth.includeBodyHash };
  if (auth.type === 'oauth2') return { type: 'oauth2', disabled, grantType: auth.oauth2GrantType, accessTokenUrl: auth.accessTokenUrl, authorizationUrl: auth.authorizationUrl, clientId: auth.clientId, clientSecret: auth.clientSecret, audience: auth.audience, scope: auth.scope, resource: auth.resource, origin: auth.origin, username: auth.username, password: auth.password, redirectUrl: auth.redirectUrl, useDefaultBrowser: auth.useDefaultBrowser, credentialsInBody: auth.credentialsInBody, state: auth.state, code: auth.code, accessToken: auth.accessToken, identityToken: auth.identityToken, refreshToken: auth.refreshToken, tokenPrefix: auth.tokenPrefix, usePkce: auth.usePkce, pkceMethod: auth.pkceMethod, responseType: auth.responseType };
  if (auth.type === 'ntlm') return { type: 'ntlm', disabled, username: auth.username, password: auth.password, domain: auth.ntlmDomain, workstation: auth.ntlmWorkstation };
  if (auth.type === 'iam') return { type: 'iam', disabled, accessKeyId: auth.awsAccessKeyId, secretAccessKey: auth.awsSecretAccessKey, sessionToken: auth.awsSessionToken, region: auth.awsRegion, service: auth.awsService };
  if (auth.type === 'hawk') return { type: 'hawk', disabled, id: auth.hawkId, key: auth.hawkKey, ext: auth.hawkExt, validatePayload: auth.hawkValidatePayload, algorithm: auth.hawkAlgorithm };
  if (auth.type === 'asap') return { type: 'asap', disabled, issuer: auth.asapIssuer, subject: auth.asapSubject, audience: auth.asapAudience, addintionalClaims: auth.asapAdditionalClaims, privateKey: auth.asapPrivateKey, keyId: auth.asapKeyId };
  if (auth.type === 'netrc') return { type: 'netrc', disabled };
  return { type: 'none', disabled };
};

const insomniaMcpAuth = (client: McpClient) => {
  if (client.authType === 'basic') return { type: 'basic', username: client.username, password: client.password, disabled: false };
  if (client.authType === 'bearer') return { type: 'bearer', token: client.token, prefix: 'Bearer', disabled: false };
  if (client.authType === 'oauth2') return {
    type: 'oauth2',
    grantType: 'mcp_auth_flow',
    authorizationUrl: client.oauthAuthorizationUrl,
    accessTokenUrl: client.oauthAccessTokenUrl,
    clientId: client.oauthClientId,
    clientSecret: client.oauthClientSecret,
    scope: client.oauthScope,
    state: client.oauthState,
    tokenPrefix: client.oauthTokenPrefix || 'Bearer',
    usePkce: true,
    pkceMethod: 'S256',
    responseType: 'code',
    disabled: false,
  };
  return {};
};

const quoteMcpCommandToken = (value: string) => value && /^[A-Za-z0-9_@%+=:,./-]+$/.test(value)
  ? value
  : `'${value.replace(/'/g, `'"'"'`)}'`;

const insomniaMcpRequest = (client: McpClient, index: number) => ({
  name: client.name,
  url: client.transport === 'stdio' ? [client.command, ...client.args].map(quoteMcpCommandToken).join(' ') : client.url,
  transportType: client.transport === 'stdio' ? 'stdio' : 'streamable-http',
  headers: client.headers.map((header) => ({ name: header.name, value: header.value, description: header.description, disabled: !header.enabled })),
  authentication: insomniaMcpAuth(client),
  env: client.env.map((variable) => ({ id: variable.id, name: variable.name, value: variable.value, type: 'str', enabled: variable.enabled })),
  roots: client.roots.map((uri) => ({ uri })),
  meta: { id: `mcp-req_${index + 1}` },
});

const insomniaCookie = (cookie: Workspace['cookies'][number]) => ({ key: cookie.name, value: cookie.value, domain: cookie.domain, path: cookie.path, expires: cookie.expires ?? null, secure: cookie.secure, httpOnly: cookie.httpOnly, sameSite: cookie.sameSite || undefined, hostOnly: cookie.hostOnly, creation: cookie.createdAt });

const insomniaBody = (request: ApiRequest, warnings: ImportWarning[]) => {
  if (request.protocol === 'graphql') return { mimeType: 'application/graphql', text: request.graphql.query };
  if (request.bodyMode === 'json') return { mimeType: 'application/json', text: request.body };
  if (request.bodyMode === 'text') return { mimeType: request.headers.find((header) => header.name.toLowerCase() === 'content-type')?.value || 'text/plain', text: request.body };
  if (request.bodyMode === 'form-urlencoded') return { mimeType: 'application/x-www-form-urlencoded', params: request.formBody.map((part) => ({ name: part.name, value: part.value, multiline: part.multiline || undefined, description: part.description, disabled: !part.enabled })) };
  if (request.bodyMode === 'multipart') return { mimeType: 'multipart/form-data', params: request.multipartBody.map((part) => ({
    name: part.name,
    value: part.kind === 'text' ? part.value : undefined,
    fileName: part.fileName || part.file?.fileName,
    multiline: part.kind === 'text' && part.contentType ? part.contentType : part.kind === 'text' && part.multiline ? true : undefined,
    contentType: part.kind === 'file' ? part.contentType || part.file?.mimeType : undefined,
    description: part.description,
    disabled: !part.enabled,
  })) };
  if (request.bodyMode === 'binary') {
    warnings.push({ code: 'binary-export', message: 'Binary payload bytes are not embedded in Insomnia compatibility exports.', resource: request.name });
    return { mimeType: request.binaryBody?.mimeType ?? 'application/octet-stream', fileName: request.binaryBody?.fileName ?? '' };
  }
  return {};
};

const v4RequestId = (prefix: string, index: number) => `__REQUEST_${prefix}_${index + 1}__`;

const v4Request = (request: ApiRequest, parentId: string, index: number, sortKey: number, warnings: ImportWarning[], prefix: string, protoFileId = '') => {
  const base = {
    _id: v4RequestId(prefix, index), parentId, modified: Date.now(), created: Date.now(), name: request.name,
    metaSortKey: sortKey,
    url: request.url, method: request.method,
    pathParameters: request.pathParams.map((parameter) => ({ name: parameter.name, value: parameter.value, disabled: !parameter.enabled, description: parameter.description })),
    parameters: request.params.map((parameter) => ({ name: parameter.name, value: parameter.value, disabled: !parameter.enabled, description: parameter.description })),
    headers: request.headers.map((header) => ({ name: header.name, value: header.value, disabled: !header.enabled, description: header.description })),
    disableUserAgentHeader: request.disableUserAgentHeader,
    authentication: insomniaAuth(request.auth), preRequestScript: request.preRequestScript, afterResponseScript: request.tests, description: request.documentation ?? '',
    settingFollowRedirects: request.transport.followRedirectsMode,
    settingDisableRenderRequestBody: !request.renderBodyTemplates,
  };
  if (request.protocol === 'websocket') return { ...base, _type: 'websocket_request' };
  if (request.protocol === 'socketio') return {
    ...base,
    _type: 'socketio_request',
    settingPath: request.socketIo.path,
    settingSendCookies: request.transport.sendCookies,
    settingStoreCookies: request.transport.storeCookies,
    eventListeners: request.socketIo.eventListeners.map((listener) => ({ id: listener.id, eventName: listener.eventName, desc: listener.description, isOpen: listener.enabled })),
    payload: { eventName: request.socketIo.eventName, ack: request.socketIo.ack, args: request.socketIo.args },
  };
  if (request.protocol === 'grpc') return { ...base, _type: 'grpc_request', body: { text: request.grpc.input }, metadata: request.grpc.metadata.map((item) => ({ name: item.name, value: item.value, disabled: !item.enabled })), protoFileId, protoMethodName: [request.grpc.service, request.grpc.method].filter(Boolean).join('/'), reflectionApi: { enabled: request.grpc.descriptorSource === 'buf', url: request.grpc.reflectionApiUrl, apiKey: request.grpc.reflectionApiKey, module: request.grpc.reflectionApiModule } };
  return { ...base, _type: 'request', body: insomniaBody(request, warnings) };
};

const pushV4ProtoResources = (resources: unknown[], request: ApiRequest, workspaceId: string, collectionIndex: number, requestIndex: number) => {
  if (request.protocol !== 'grpc' || request.grpc.descriptorSource !== 'proto') return '';
  const tree = normalizeGrpcProtoTree(request.grpc.protoFiles, request.grpc.protoText, request.grpc.protoEntryPath, request.grpc.protoActivePath);
  if (!tree.protoFiles.length) return '';
  const prefix = `__PROTO_${collectionIndex + 1}_${requestIndex + 1}`;
  const rootId = `${prefix}_DIRECTORY__`;
  const now = Date.now();
  resources.push({ _id: rootId, parentId: workspaceId, modified: now, created: now, name: `${request.name} Protos`, _type: 'proto_directory' });
  const directories = new Map<string, string>();
  let entryId = '';
  tree.protoFiles.forEach((file, fileIndex) => {
    const segments = file.path.split('/');
    const name = segments.pop()!;
    let parentId = rootId;
    let currentPath = '';
    segments.forEach((segment, directoryIndex) => {
      currentPath = currentPath ? `${currentPath}/${segment}` : segment;
      let directoryId = directories.get(currentPath);
      if (!directoryId) {
        directoryId = `${prefix}_DIRECTORY_${directories.size + 1}__`;
        directories.set(currentPath, directoryId);
        resources.push({ _id: directoryId, parentId, modified: now, created: now, name: segment, _type: 'proto_directory', sortKey: directoryIndex });
      }
      parentId = directoryId;
    });
    const fileId = `${prefix}_FILE_${fileIndex + 1}__`;
    resources.push({ _id: fileId, parentId, modified: now, created: now, name, protoText: file.text, _type: 'proto_file' });
    if (file.path === tree.protoEntryPath) entryId = fileId;
  });
  return entryId || `${prefix}_FILE_1__`;
};

const pushV4McpWorkspace = (resources: unknown[], workspace: Workspace, options: ExportOptions, client: McpClient, index: number) => {
  const workspaceId = `__MCP_WORKSPACE_${index + 1}__`;
  const now = Date.now();
  resources.push({ _id: workspaceId, parentId: null, modified: now, created: now, name: client.name, scope: 'mcp', _type: 'workspace' });
  const publicEnvironment = exportEnvironments(workspace, options);
  const environmentIds = new Map(publicEnvironment.map((environment, environmentIndex) => [environment.id, `__MCP_ENVIRONMENT_${index + 1}_${environmentIndex + 1}__`]));
  publicEnvironment.forEach((environment) => resources.push({
    _id: environmentIds.get(environment.id),
    parentId: environment.parentId ? environmentIds.get(environment.parentId) ?? workspaceId : workspaceId,
    modified: now,
    created: now,
    name: environment.name,
    ...insomniaV4EnvironmentFields(environment.variables, environment.environmentEditorMode),
    _type: 'environment',
  }));
  const { meta: _meta, ...request } = insomniaMcpRequest(client, index);
  resources.push({
    ...request,
    _id: `__MCP_CLIENT_${index + 1}__`,
    parentId: workspaceId,
    modified: now,
    created: now,
    description: '',
    mcpStdioAccess: false,
    subscribeResources: [],
    connected: false,
    sslValidation: true,
    disableUserAgentHeader: false,
    _type: 'mcp_request',
  });
};

const exportInsomniaV4 = (workspace: Workspace, options: ExportOptions): ArtifactExport => {
  const warnings: ImportWarning[] = [];
  const collections = selectedCollections(workspace, options);
  const resources: unknown[] = [];
  if (exportEnvironments(workspace, options).some((environment) => environment.variables.length) && !(options.scope === 'all' && workspace.mcpClients.length)) warnings.push({ code: 'global-environment-export', message: 'Insomnia v4 workspace exports have no separate global-environment resource; collection environments are preserved and Brunomnia global environments are omitted.' });
  collections.forEach((collection, collectionIndex) => {
    const workspaceId = `__WORKSPACE_${collectionIndex + 1}__`;
    const fileState = getWorkspaceFileState(workspace, workspaceFileIdForCollection(workspace, collection.id));
    resources.push({ _id: workspaceId, parentId: null, modified: Date.now(), created: Date.now(), name: collection.name, description: collection.documentation ?? '', scope: 'collection', _type: 'workspace' });
    resources.push({ _id: `__COOKIE_JAR_${collectionIndex + 1}__`, parentId: workspaceId, modified: Date.now(), created: Date.now(), name: 'Default Jar', cookies: fileState.cookies.map(insomniaCookie), _type: 'cookie_jar' });
    const baseEnvironmentId = `__BASE_ENVIRONMENT_${collectionIndex + 1}__`;
    resources.push({ _id: baseEnvironmentId, parentId: workspaceId, modified: Date.now(), created: Date.now(), name: 'Base Environment', ...insomniaV4EnvironmentFields(collection.environment ?? [], collection.environmentEditorMode), _type: 'environment' });
    (collection.subEnvironments ?? []).forEach((environment, environmentIndex) => resources.push({ _id: `__ENVIRONMENT_${collectionIndex + 1}_${environmentIndex + 1}__`, parentId: baseEnvironmentId, modified: Date.now(), created: Date.now(), name: environment.name, ...insomniaV4EnvironmentFields(environment.variables, environment.environmentEditorMode), _type: 'environment' }));
    const folders = collection.folders ?? [];
    const foldersById = new Map(folders.map((folder) => [folder.id, folder]));
    const requestsById = new Map(collection.requests.map((request) => [request.id, request]));
    const folderIds = new Map(folders.map((folder, folderIndex) => [folder.id, `__REQUEST_GROUP_${collectionIndex + 1}_${folderIndex + 1}__`]));
    const exportedRequestIds = new Map<string, string>();
    let requestIndex = 0;
    const appendChildren = (parentId: string, exportedParentId: string) => {
      orderedCollectionChildren(collection, parentId).forEach((resource, siblingIndex) => {
        if (resource.kind === 'folder') {
          const folder = foldersById.get(resource.id);
          const folderId = folderIds.get(resource.id);
          if (!folder || !folderId) return;
          resources.push({
            _id: folderId, parentId: exportedParentId, modified: Date.now(), created: Date.now(), name: folder.name, description: folder.documentation, metaSortKey: siblingIndex,
            headers: folder.headers.map((header) => ({ name: header.name, value: header.value, disabled: !header.enabled })),
            ...insomniaV4EnvironmentFields(folder.environment, folder.environmentEditorMode, 'environment'),
            authentication: folder.auth ? insomniaAuth(folder.auth) : undefined,
            preRequestScript: folder.preRequestScript, afterResponseScript: folder.tests, _type: 'request_group',
          });
          appendChildren(folder.id, folderId);
          return;
        }
        const request = requestsById.get(resource.id);
        if (!request) return;
        const currentRequestIndex = requestIndex++;
        const protoFileId = pushV4ProtoResources(resources, request, workspaceId, collectionIndex, currentRequestIndex);
        const exported = v4Request(request, exportedParentId, currentRequestIndex, siblingIndex, warnings, String(collectionIndex + 1), protoFileId);
        exportedRequestIds.set(request.id, exported._id);
        resources.push(exported);
        if (request.protocol === 'socketio') resources.push({ _id: `__SOCKET_IO_PAYLOAD_${collectionIndex + 1}_${currentRequestIndex + 1}__`, parentId: exported._id, modified: Date.now(), created: Date.now(), eventName: request.socketIo.eventName, ack: request.socketIo.ack, args: request.socketIo.args, _type: 'socketio_payload' });
      });
    };
    appendChildren('', workspaceId);
    workspace.testSuites.filter((suite) => suite.collectionId === collection.id).sort((left, right) => left.sortKey - right.sortKey).forEach((suite, suiteIndex) => {
      const suiteId = `__UNIT_TEST_SUITE_${collectionIndex + 1}_${suiteIndex + 1}__`;
      resources.push({ _id: suiteId, parentId: workspaceId, modified: Date.now(), created: Date.now(), name: suite.name, metaSortKey: suite.sortKey, _type: 'unit_test_suite' });
      [...suite.tests].filter((test) => test.requestId === null || exportedRequestIds.has(test.requestId)).sort((left, right) => left.sortKey - right.sortKey).forEach((test, testIndex) => resources.push({
        _id: `__UNIT_TEST_${collectionIndex + 1}_${suiteIndex + 1}_${testIndex + 1}__`, parentId: suiteId, modified: Date.now(), created: Date.now(), name: test.name,
        requestId: test.requestId ? exportedRequestIds.get(test.requestId) ?? null : null, code: test.code, metaSortKey: test.sortKey, _type: 'unit_test',
      }));
    });
  });
  if (options.scope === 'all') workspace.mcpClients.forEach((client, index) => pushV4McpWorkspace(resources, workspace, options, client, index));
  else if (workspace.mcpClients.length) warnings.push({ code: 'mcp-scope-export', message: 'Project-scoped MCP clients are omitted from collection/design-only Insomnia exports. Export the full project to include them.' });
  selectedDesigns(workspace, options).forEach((design, index) => resources.push({ _id: `__API_SPEC_${index + 1}__`, parentId: resources.length ? '__WORKSPACE_1__' : null, name: design.name, contents: design.contents, _type: 'api_spec' }));
  if (options.scope === 'all') workspace.mockServers.forEach((server, index) => resources.push({ _id: `__MOCK_${index + 1}__`, parentId: resources.length ? '__WORKSPACE_1__' : null, name: server.name, url: `http://${server.host}:${server.port}`, routes: server.routes.map((route) => ({ name: route.name, method: route.method, path: route.path, statusCode: route.status, headers: route.headers.map((header) => ({ name: header.name, value: header.value, disabled: !header.enabled })), body: route.body, delayMs: route.delayMs })), _type: 'mock_server' }));
  const output = { _type: 'export', __export_format: 4, __export_date: new Date().toISOString(), __export_source: 'brunomnia.desktop.app:0.1.0', resources };
  return { contents: `${JSON.stringify(output, null, 2)}\n`, fileName: `${safeName(workspace.name)}-insomnia-v4.json`, mimeType: 'application/json', warnings };
};

const v5GlobalEnvironment = (environments: Environment[], prefix: string) => {
  const base = environments.find((environment) => !environment.parentId) ?? environments[0];
  const subEnvironments = environments.filter((environment) => environment.id !== base?.id);
  return {
    name: base?.name ?? 'Base Environment',
    meta: { id: `${prefix}-environment-base` },
    data: environmentData(base?.variables ?? []),
    subEnvironments: subEnvironments.map((environment, index) => ({ name: environment.name, meta: { id: `${prefix}-environment-${index + 1}` }, data: environmentData(environment.variables) })),
  };
};

const v5CollectionEnvironment = (collection: Workspace['collections'][number], prefix: string) => ({
  name: 'Base Environment',
  meta: { id: `${prefix}-environment-base` },
  data: environmentData(collection.environment ?? []),
  subEnvironments: (collection.subEnvironments ?? []).map((environment, index) => ({ name: environment.name, meta: { id: `${prefix}-environment-${index + 1}` }, data: environmentData(environment.variables) })),
});

const v5RequestId = (request: ApiRequest, index: number, prefix: string) => {
  if (request.protocol === 'websocket') return `${prefix}-ws-req_${index + 1}`;
  if (request.protocol === 'socketio') return `socketio-req_${prefix}_${index + 1}`;
  if (request.protocol === 'grpc') return `${prefix}-greq_${index + 1}`;
  return `${prefix}-req_${index + 1}`;
};

const v5Request = (request: ApiRequest, index: number, sortKey: number, warnings: ImportWarning[], prefix: string) => {
  const id = v5RequestId(request, index, prefix);
  const common = {
    url: request.url, name: request.name, meta: { id, description: request.documentation || (request.source ? `Imported from ${request.source.format}` : ''), sortKey },
    headers: request.headers.map((header) => ({ name: header.name, value: header.value, disabled: !header.enabled, description: header.description })),
    disableUserAgentHeader: request.disableUserAgentHeader,
    pathParameters: request.pathParams.map((parameter) => ({ name: parameter.name, value: parameter.value, disabled: !parameter.enabled, description: parameter.description })),
    parameters: request.params.map((parameter) => ({ name: parameter.name, value: parameter.value, disabled: !parameter.enabled, description: parameter.description })),
    authentication: insomniaAuth(request.auth),
  };
  if (request.protocol === 'websocket') return { ...common, settings: { encodeUrl: true, followRedirects: request.transport.followRedirectsMode, cookies: { send: true, store: true } } };
  if (request.protocol === 'socketio') return {
    ...common,
    settings: { encodeUrl: true, path: request.socketIo.path, cookies: { send: request.transport.sendCookies, store: request.transport.storeCookies } },
    eventListeners: request.socketIo.eventListeners.map((listener) => ({ id: listener.id, eventName: listener.eventName, desc: listener.description, isOpen: listener.enabled })),
    payload: { eventName: request.socketIo.eventName, ack: request.socketIo.ack, args: request.socketIo.args },
  };
  if (request.protocol === 'grpc') {
    if (request.grpc.descriptorSource === 'proto') warnings.push({ code: 'external-schema', message: 'Insomnia v5 collection YAML cannot embed its database-backed proto resource; import the proto source separately.', resource: request.name });
    return { ...common, body: { text: request.grpc.input }, metadata: request.grpc.metadata.map((item) => ({ name: item.name, value: item.value, disabled: !item.enabled })), protoFileId: '', protoMethodName: [request.grpc.service, request.grpc.method].filter(Boolean).join('/'), reflectionApi: { enabled: request.grpc.descriptorSource === 'buf', url: request.grpc.reflectionApiUrl, apiKey: request.grpc.reflectionApiKey, module: request.grpc.reflectionApiModule } };
  }
  return {
    ...common,
    method: request.method,
    body: insomniaBody(request, warnings),
    scripts: { preRequest: request.preRequestScript, afterResponse: request.tests },
    settings: { renderRequestBody: request.renderBodyTemplates, encodeUrl: true, followRedirects: request.transport.followRedirectsMode, cookies: { send: true, store: true }, rebuildPath: true },
  };
};

const v5Collection = (collection: Workspace['collections'][number], warnings: ImportWarning[], prefix: string) => {
  let requestIndex = 0;
  const requestIds = new Map<string, string>();
  const folders = collection.folders ?? [];
  const foldersById = new Map(folders.map((folder) => [folder.id, folder]));
  const requestsById = new Map(collection.requests.map((request) => [request.id, request]));
  const children = (parentId: string): unknown[] => orderedCollectionChildren(collection, parentId).flatMap((resource, siblingIndex): unknown[] => {
    if (resource.kind === 'folder') {
      const folder = foldersById.get(resource.id);
      if (!folder) return [];
      return [{
        name: folder.name,
        meta: { id: `${prefix}-folder-${folder.id}`, description: folder.documentation, sortKey: siblingIndex },
        headers: folder.headers.map((header) => ({ name: header.name, value: header.value, disabled: !header.enabled })),
        authentication: folder.auth ? insomniaAuth(folder.auth) : undefined,
        environment: environmentData(folder.environment),
        scripts: { preRequest: folder.preRequestScript, afterResponse: folder.tests },
        children: children(folder.id),
      }];
    }
    const request = requestsById.get(resource.id);
    if (!request) return [];
    const currentRequestIndex = requestIndex++;
    requestIds.set(request.id, v5RequestId(request, currentRequestIndex, prefix));
    return [v5Request(request, currentRequestIndex, siblingIndex, warnings, prefix)];
  });
  return { collection: children(''), requestIds };
};

const v5TestSuites = (workspace: Workspace, collectionId: string, requestIds: Map<string, string>, prefix: string) => workspace.testSuites
  .filter((suite) => suite.collectionId === collectionId)
  .sort((left, right) => left.sortKey - right.sortKey)
  .map((suite, suiteIndex) => ({
    name: suite.name,
    meta: { id: `${prefix}-suite-${suiteIndex + 1}`, sortKey: suite.sortKey },
    tests: [...suite.tests].filter((test) => test.requestId === null || requestIds.has(test.requestId)).sort((left, right) => left.sortKey - right.sortKey).map((test, testIndex) => ({
      name: test.name,
      meta: { id: `${prefix}-test-${suiteIndex + 1}-${testIndex + 1}`, sortKey: test.sortKey },
      requestId: test.requestId ? requestIds.get(test.requestId) ?? null : null,
      code: test.code,
    })),
  }));

const exportInsomniaV5 = (workspace: Workspace, options: ExportOptions): ArtifactExport => {
  const warnings: ImportWarning[] = [];
  const documents: unknown[] = [];
  const standaloneCollections = options.scope === 'design' ? [] : selectedCollections(workspace, options);
  standaloneCollections.forEach((collection, index) => {
    const exported = v5Collection(collection, warnings, `wrk_${index + 1}`);
    const fileState = getWorkspaceFileState(workspace, workspaceFileIdForCollection(workspace, collection.id));
    documents.push({ type: 'collection.insomnia.rest/5.0', schema_version: '5.1', name: collection.name, meta: { id: `wrk_${index + 1}`, description: collection.documentation || 'Exported by Brunomnia' }, collection: exported.collection, environments: v5CollectionEnvironment(collection, `wrk_${index + 1}`), cookieJar: { name: 'Default Jar', meta: { id: `jar_${index + 1}` }, cookies: fileState.cookies.map(insomniaCookie) }, certificates: [] });
  });
  const designs = selectedDesigns(workspace, options);
  designs.forEach((design, index) => {
    const collection = workspace.collections.find((candidate) => candidate.id === design.generatedCollectionId);
    const prefix = `spc_${index + 1}`;
    const exported = collection ? v5Collection(collection, warnings, prefix) : undefined;
    const fileState = getWorkspaceFileState(workspace, design.id);
    documents.push({ type: 'spec.insomnia.rest/5.0', schema_version: '5.1', name: design.name, meta: { id: prefix, description: 'Exported by Brunomnia' }, spec: { contents: design.contents }, collection: exported?.collection ?? [], environments: collection ? v5CollectionEnvironment(collection, prefix) : v5GlobalEnvironment([], prefix), cookieJar: { name: 'Default Jar', meta: { id: `${prefix}-jar` }, cookies: fileState.cookies.map(insomniaCookie) }, testSuites: collection && exported ? v5TestSuites(workspace, collection.id, exported.requestIds, prefix) : [], certificates: [] });
  });
  const representableCollectionIds = new Set(designs.flatMap((design) => design.generatedCollectionId ? [design.generatedCollectionId] : []));
  const selectedCollectionIds = new Set(selectedCollections(workspace, options).map((collection) => collection.id));
  workspace.testSuites.filter((suite) => selectedCollectionIds.has(suite.collectionId) && !representableCollectionIds.has(suite.collectionId)).forEach((suite) => warnings.push({ code: 'unsupported-v5-test-suite', message: 'Insomnia v5 can store standalone test suites only on API specification documents, so this collection-owned suite was omitted.', resource: suite.name }));
  const globalEnvironments = exportEnvironments(workspace, options);
  const byId = new Map(globalEnvironments.map((environment) => [environment.id, environment]));
  globalEnvironments.filter((environment) => !environment.parentId || !byId.has(environment.parentId)).forEach((base, index) => {
    const belongsToBase = (environment: Environment) => {
      const visited = new Set<string>();
      let current: Environment | undefined = environment;
      while (current && !visited.has(current.id)) {
        if (current.id === base.id) return true;
        visited.add(current.id);
        current = current.parentId ? byId.get(current.parentId) : undefined;
      }
      return false;
    };
    documents.push({ type: 'environment.insomnia.rest/5.0', schema_version: '5.1', name: base.name, meta: { id: `global_${index + 1}` }, environments: v5GlobalEnvironment(globalEnvironments.filter(belongsToBase), `global_${index + 1}`) });
  });
  if (options.scope === 'all') workspace.mcpClients.forEach((client, index) => {
    const prefix = `mcp_${index + 1}`;
    documents.push({
      type: 'mcpClient.insomnia/5.0',
      schema_version: '5.1',
      name: client.name,
      meta: { id: prefix, description: 'Exported by Brunomnia' },
      mcpRequest: insomniaMcpRequest(client, index),
      environments: v5GlobalEnvironment(globalEnvironments, prefix),
    });
  });
  else if (workspace.mcpClients.length) warnings.push({ code: 'mcp-scope-export', message: 'Project-scoped MCP clients are omitted from collection/design-only Insomnia exports. Export the full project to include them.' });
  if (options.scope === 'all') workspace.mockServers.forEach((server, index) => documents.push({ type: 'mock.insomnia.rest/5.0', schema_version: '5.1', name: server.name, meta: { id: `mock_${index + 1}` }, server: { meta: { id: `mock-server_${index + 1}` }, url: `http://${server.host}:${server.port}`, useInsomniaCloud: false }, routes: server.routes.map((route, routeIndex) => ({ name: route.path || route.name, meta: { id: `mock-route_${index + 1}_${routeIndex + 1}`, description: route.name }, body: route.body, headers: route.headers.map((header) => ({ name: header.name, value: header.value, disabled: !header.enabled })), method: route.method, statusCode: route.status })) }));
  if (!documents.length) throw new Error('The selected scope has no Insomnia v5 resources to export.');
  const contents = documents.map((document) => stringify(document, { lineWidth: 100 })).join('---\n');
  return { contents, fileName: `${safeName(workspace.name)}-insomnia-v5.yaml`, mimeType: 'application/yaml', warnings };
};

const harPostData = (request: ApiRequest, warnings: ImportWarning[]) => {
  if (request.protocol === 'graphql') {
    let variables: unknown = {};
    try { variables = JSON.parse(request.graphql.variables || '{}'); } catch { variables = request.graphql.variables; }
    return { mimeType: 'application/json', text: JSON.stringify({ query: request.graphql.query, variables, operationName: request.graphql.operationName || undefined }) };
  }
  if (request.bodyMode === 'json') return { mimeType: 'application/json', text: request.body };
  if (request.bodyMode === 'text') return { mimeType: request.headers.find((header) => header.name.toLowerCase() === 'content-type')?.value || 'text/plain', text: request.body };
  if (request.bodyMode === 'form-urlencoded') return { mimeType: 'application/x-www-form-urlencoded', params: request.formBody.filter((part) => part.enabled).map((part) => ({ name: part.name, value: part.value })) };
  if (request.bodyMode === 'multipart') {
    request.multipartBody.filter((part) => part.enabled && part.kind === 'file').forEach((part) => warnings.push({ code: 'binary-export', message: `Multipart file '${part.file?.fileName ?? part.name}' is referenced by name in HAR; bytes are not embedded.`, resource: request.name }));
    return { mimeType: 'multipart/form-data', params: request.multipartBody.filter((part) => part.enabled).map((part) => ({ name: part.name, value: part.kind === 'text' ? part.value : undefined, fileName: part.fileName || part.file?.fileName, contentType: part.contentType || part.file?.mimeType })) };
  }
  if (request.bodyMode === 'binary') warnings.push({ code: 'binary-export', message: 'Binary request bodies are not embedded in HAR.', resource: request.name });
  return undefined;
};

const exportHar = (workspace: Workspace, options: ExportOptions): ArtifactExport => {
  const warnings: ImportWarning[] = [];
  const requests = selectedCollections(workspace, options).flatMap((collection) => collection.requests).filter((request) => {
    const supported = request.protocol === 'http' || request.protocol === 'graphql';
    if (!supported) warnings.push({ code: 'unsupported-protocol', message: `${request.protocol} request '${request.name}' was omitted from HAR.`, resource: request.name });
    return supported;
  });
  const entries = requests.map((request) => ({
    startedDateTime: new Date().toISOString(), time: 0,
    request: {
      method: request.method, url: request.url, httpVersion: 'HTTP/1.1', comment: request.name,
      headers: request.headers.filter((header) => header.enabled).map((header) => ({ name: header.name, value: header.value })),
      queryString: request.params.filter((parameter) => parameter.enabled).map((parameter) => ({ name: parameter.name, value: parameter.value })),
      cookies: [], headersSize: -1, bodySize: request.body.length,
      postData: harPostData(request, warnings),
    },
    response: { status: 0, statusText: '', httpVersion: 'HTTP/1.1', headers: [], cookies: [], content: { size: 0, mimeType: 'application/octet-stream', text: '' }, redirectURL: '', headersSize: -1, bodySize: -1 },
    cache: {}, timings: { send: 0, wait: 0, receive: 0 }, comment: request.name,
  }));
  const output = { log: { version: '1.2', creator: { name: 'Brunomnia', version: '0.1.0' }, entries } };
  return { contents: `${JSON.stringify(output, null, 2)}\n`, fileName: `${safeName(workspace.name)}.har`, mimeType: 'application/json', warnings };
};

export const exportArtifact = (workspace: Workspace, options: ExportOptions): ArtifactExport => {
  if (options.scope === 'collection' && options.requestIds?.length === 0) throw new Error('Select at least one request to export.');
  let artifact: ArtifactExport;
  if (options.format === 'brunomnia') {
    const scoped = scopedWorkspace(workspace, options);
    artifact = { contents: `${JSON.stringify(scoped, null, 2)}\n`, fileName: `${safeName(scoped.name)}.brunomnia.json`, mimeType: 'application/json', warnings: [] };
  } else if (options.format === 'insomnia-v4') artifact = exportInsomniaV4(workspace, options);
  else if (options.format === 'insomnia-v5') artifact = exportInsomniaV5(workspace, options);
  else if (options.format === 'har') artifact = exportHar(workspace, options);
  else {
    const design = workspace.apiDesigns.find((candidate) => candidate.id === options.designId) ?? workspace.apiDesigns[0];
    if (!design) throw new Error('There is no OpenAPI design to export.');
    artifact = { contents: design.contents, fileName: `${safeName(design.name)}.yaml`, mimeType: 'application/yaml', warnings: [] };
  }
  if (options.format !== 'openapi' && options.includePrivateEnvironments && publicEnvironments(workspace.environments).length < workspace.environments.length) {
    artifact.warnings.unshift({ code: 'private-environment-export', message: 'This export intentionally includes device-private environment values. Review and protect the downloaded file.' });
  }
  return artifact;
};
