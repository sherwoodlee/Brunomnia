import { stringify } from 'yaml';
import type { ApiRequest, Environment, ImportWarning, Workspace } from '../../types';
import type { ArtifactExport, ExportFormat, ExportScope } from './types';

export type ExportOptions = {
  format: ExportFormat;
  scope: ExportScope;
  collectionId?: string;
  designId?: string;
};

const safeName = (value: string) => value.trim().replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'brunomnia-export';

const selectedCollections = (workspace: Workspace, options: ExportOptions) => options.scope === 'collection'
  ? workspace.collections.filter((collection) => collection.id === options.collectionId)
  : options.scope === 'design'
    ? workspace.collections.filter((collection) => collection.id === workspace.apiDesigns.find((design) => design.id === options.designId)?.generatedCollectionId)
    : workspace.collections;

const selectedDesigns = (workspace: Workspace, options: ExportOptions) => options.scope === 'design'
  ? workspace.apiDesigns.filter((design) => design.id === options.designId)
  : options.scope === 'all' ? workspace.apiDesigns : [];

const scopedWorkspace = (workspace: Workspace, options: ExportOptions): Workspace => {
  if (options.scope === 'all') return workspace;
  const collections = selectedCollections(workspace, options);
  const designs = selectedDesigns(workspace, options);
  return {
    ...workspace,
    activeRequestId: collections.flatMap((collection) => collection.requests)[0]?.id ?? '',
    collections,
    apiDesigns: designs,
    mockServers: [],
    runnerReports: workspace.runnerReports.filter((report) => collections.some((collection) => collection.id === report.collectionId)),
  };
};

const insomniaAuth = (request: ApiRequest) => {
  if (request.auth.type === 'basic') return { type: 'basic', username: request.auth.username, password: request.auth.password, disabled: false };
  if (request.auth.type === 'bearer') return { type: 'bearer', token: request.auth.token, disabled: false };
  if (request.auth.type === 'api-key') return { type: 'apikey', key: request.auth.apiKeyName, value: request.auth.apiKeyValue, addTo: request.auth.apiKeyLocation === 'query' ? 'queryParams' : 'header', disabled: false };
  return { type: 'none', disabled: false };
};

const insomniaBody = (request: ApiRequest, warnings: ImportWarning[]) => {
  if (request.protocol === 'graphql') return { mimeType: 'application/graphql', text: request.graphql.query };
  if (request.bodyMode === 'json') return { mimeType: 'application/json', text: request.body };
  if (request.bodyMode === 'text') return { mimeType: request.headers.find((header) => header.name.toLowerCase() === 'content-type')?.value || 'text/plain', text: request.body };
  if (request.bodyMode === 'form-urlencoded') return { mimeType: 'application/x-www-form-urlencoded', params: request.formBody.map((part) => ({ name: part.name, value: part.value, disabled: !part.enabled })) };
  if (request.bodyMode === 'multipart') return { mimeType: 'multipart/form-data', params: request.multipartBody.map((part) => ({ name: part.name, value: part.kind === 'text' ? part.value : undefined, fileName: part.file?.fileName, disabled: !part.enabled })) };
  if (request.bodyMode === 'binary') {
    warnings.push({ code: 'binary-export', message: 'Binary payload bytes are not embedded in Insomnia compatibility exports.', resource: request.name });
    return { mimeType: request.binaryBody?.mimeType ?? 'application/octet-stream', fileName: request.binaryBody?.fileName ?? '' };
  }
  return {};
};

const v4Request = (request: ApiRequest, parentId: string, index: number, warnings: ImportWarning[]) => {
  const base = {
    _id: `__REQUEST_${index + 1}__`, parentId, modified: Date.now(), created: Date.now(), name: request.name,
    url: request.url, method: request.method, parameters: request.params.map((parameter) => ({ name: parameter.name, value: parameter.value, disabled: !parameter.enabled })),
    headers: request.headers.map((header) => ({ name: header.name, value: header.value, disabled: !header.enabled })),
    authentication: insomniaAuth(request), preRequestScript: request.preRequestScript, afterResponseScript: request.tests,
  };
  if (request.protocol === 'websocket') return { ...base, _type: 'websocket_request' };
  if (request.protocol === 'grpc') return { ...base, _type: 'grpc_request', body: { text: request.grpc.input }, metadata: request.grpc.metadata.map((item) => ({ name: item.name, value: item.value, disabled: !item.enabled })), protoMethodName: [request.grpc.service, request.grpc.method].filter(Boolean).join('/'), reflectionApi: { enabled: request.grpc.descriptorSource === 'reflection', url: request.url } };
  return { ...base, _type: 'request', body: insomniaBody(request, warnings) };
};

const exportInsomniaV4 = (workspace: Workspace, options: ExportOptions): ArtifactExport => {
  const warnings: ImportWarning[] = [];
  const collections = selectedCollections(workspace, options);
  const resources: unknown[] = [];
  collections.forEach((collection, collectionIndex) => {
    const workspaceId = `__WORKSPACE_${collectionIndex + 1}__`;
    resources.push({ _id: workspaceId, parentId: null, modified: Date.now(), created: Date.now(), name: collection.name, description: '', scope: 'collection', _type: 'workspace' });
    resources.push({ _id: `__BASE_ENVIRONMENT_${collectionIndex + 1}__`, parentId: workspaceId, modified: Date.now(), created: Date.now(), name: 'Base Environment', data: {}, _type: 'environment' });
    workspace.environments.forEach((environment, environmentIndex) => resources.push({ _id: `__ENVIRONMENT_${collectionIndex + 1}_${environmentIndex + 1}__`, parentId: `__BASE_ENVIRONMENT_${collectionIndex + 1}__`, modified: Date.now(), created: Date.now(), name: environment.name, data: Object.fromEntries(environment.variables.filter((variable) => variable.enabled && variable.name).map((variable) => [variable.name, variable.value])), _type: 'environment' }));
    collection.requests.forEach((request, requestIndex) => resources.push(v4Request(request, workspaceId, requestIndex, warnings)));
  });
  selectedDesigns(workspace, options).forEach((design, index) => resources.push({ _id: `__API_SPEC_${index + 1}__`, parentId: resources.length ? '__WORKSPACE_1__' : null, name: design.name, contents: design.contents, _type: 'api_spec' }));
  if (options.scope === 'all') workspace.mockServers.forEach((server, index) => resources.push({ _id: `__MOCK_${index + 1}__`, parentId: resources.length ? '__WORKSPACE_1__' : null, name: server.name, url: `http://${server.host}:${server.port}`, routes: server.routes.map((route) => ({ name: route.name, method: route.method, path: route.path, statusCode: route.status, headers: route.headers.map((header) => ({ name: header.name, value: header.value, disabled: !header.enabled })), body: route.body, delayMs: route.delayMs })), _type: 'mock_server' }));
  const output = { _type: 'export', __export_format: 4, __export_date: new Date().toISOString(), __export_source: 'brunomnia.desktop.app:0.1.0', resources };
  return { contents: `${JSON.stringify(output, null, 2)}\n`, fileName: `${safeName(workspace.name)}-insomnia-v4.json`, mimeType: 'application/json', warnings };
};

const v5Environment = (environments: Environment[], prefix: string) => {
  const [base, ...subEnvironments] = environments;
  return {
    name: base?.name ?? 'Base Environment',
    meta: { id: `${prefix}-environment-base` },
    data: Object.fromEntries((base?.variables ?? []).filter((variable) => variable.enabled && variable.name).map((variable) => [variable.name, variable.value])),
    subEnvironments: subEnvironments.map((environment, index) => ({ name: environment.name, meta: { id: `${prefix}-environment-${index + 1}` }, data: Object.fromEntries(environment.variables.filter((variable) => variable.enabled && variable.name).map((variable) => [variable.name, variable.value])) })),
  };
};

const v5Request = (request: ApiRequest, index: number, warnings: ImportWarning[]) => {
  const common = {
    url: request.url, name: request.name, meta: { id: `req_${index + 1}`, description: request.source ? `Imported from ${request.source.format}` : '' },
    headers: request.headers.map((header) => ({ name: header.name, value: header.value, disabled: !header.enabled })),
    parameters: request.params.map((parameter) => ({ name: parameter.name, value: parameter.value, disabled: !parameter.enabled })),
    authentication: insomniaAuth(request),
  };
  if (request.protocol === 'websocket') return { ...common, meta: { ...common.meta, id: `ws-req_${index + 1}` }, settings: { encodeUrl: true, followRedirects: request.transport.followRedirects ? 'on' : 'off', cookies: { send: true, store: true } } };
  if (request.protocol === 'grpc') return { ...common, meta: { ...common.meta, id: `greq_${index + 1}` }, body: { text: request.grpc.input }, metadata: request.grpc.metadata.map((item) => ({ name: item.name, value: item.value, disabled: !item.enabled })), protoMethodName: [request.grpc.service, request.grpc.method].filter(Boolean).join('/'), reflectionApi: { enabled: request.grpc.descriptorSource === 'reflection', url: request.url, apiKey: '', module: '' } };
  return {
    ...common,
    method: request.method,
    body: insomniaBody(request, warnings),
    scripts: { preRequest: request.preRequestScript, afterResponse: request.tests },
    settings: { renderRequestBody: true, encodeUrl: true, followRedirects: request.transport.followRedirects ? 'on' : 'off', cookies: { send: true, store: true }, rebuildPath: true },
  };
};

const exportInsomniaV5 = (workspace: Workspace, options: ExportOptions): ArtifactExport => {
  const warnings: ImportWarning[] = [];
  const documents: unknown[] = [];
  const standaloneCollections = options.scope === 'design' ? [] : selectedCollections(workspace, options);
  standaloneCollections.forEach((collection, index) => {
    documents.push({ type: 'collection.insomnia.rest/5.0', schema_version: '5.1', name: collection.name, meta: { id: `wrk_${index + 1}`, description: 'Exported by Brunomnia' }, collection: collection.requests.map((request, requestIndex) => v5Request(request, requestIndex, warnings)), environments: v5Environment(workspace.environments, `wrk_${index + 1}`), cookieJar: { name: 'Default Jar', meta: { id: `jar_${index + 1}` }, cookies: [] }, certificates: [] });
  });
  selectedDesigns(workspace, options).forEach((design, index) => {
    const collection = workspace.collections.find((candidate) => candidate.id === design.generatedCollectionId);
    documents.push({ type: 'spec.insomnia.rest/5.0', schema_version: '5.1', name: design.name, meta: { id: `spc_${index + 1}`, description: 'Exported by Brunomnia' }, spec: { contents: design.contents }, collection: collection?.requests.map((request, requestIndex) => v5Request(request, requestIndex, warnings)) ?? [], environments: v5Environment(workspace.environments, `spc_${index + 1}`), testSuites: [], certificates: [] });
  });
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
    return { mimeType: 'multipart/form-data', params: request.multipartBody.filter((part) => part.enabled).map((part) => ({ name: part.name, value: part.kind === 'text' ? part.value : undefined, fileName: part.file?.fileName })) };
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
  if (options.format === 'brunomnia') {
    const scoped = scopedWorkspace(workspace, options);
    return { contents: `${JSON.stringify(scoped, null, 2)}\n`, fileName: `${safeName(scoped.name)}.brunomnia.json`, mimeType: 'application/json', warnings: [] };
  }
  if (options.format === 'insomnia-v4') return exportInsomniaV4(workspace, options);
  if (options.format === 'insomnia-v5') return exportInsomniaV5(workspace, options);
  if (options.format === 'har') return exportHar(workspace, options);
  const design = workspace.apiDesigns.find((candidate) => candidate.id === options.designId) ?? workspace.apiDesigns[0];
  if (!design) throw new Error('There is no OpenAPI design to export.');
  return { contents: design.contents, fileName: `${safeName(design.name)}.yaml`, mimeType: 'application/yaml', warnings: [] };
};
