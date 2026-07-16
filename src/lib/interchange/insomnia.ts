import { stringify } from 'yaml';
import type { ApiDesign, ApiRequest, Collection, Environment, ImportWarning, JsonValue, KeyValue, MockRoute, MockServer } from '../../types';
import { asArray, asBoolean, asNumber, asRecord, asString, keyValues, normalizeMethod, objectVariables, requestFrom, sourceId, sourceMetadata, toJsonValue, type UnknownRecord } from './common';
import { emptyResources, type ArtifactImport } from './types';

const joinScripts = (...scripts: unknown[]) => scripts.map((script) => asString(script)).filter(Boolean).join('\n\n');

const applyInsomniaAuth = (request: ApiRequest, rawValue: unknown, format: string, warnings: ImportWarning[]) => {
  const auth = asRecord(rawValue);
  const type = asString(auth?.type);
  if (!auth || !type || type === 'none' || auth.disabled === true) return;
  if (type === 'basic') request.auth = { ...request.auth, type: 'basic', username: asString(auth.username), password: asString(auth.password) };
  else if (type === 'bearer' || type === 'singleToken') request.auth = { ...request.auth, type: 'bearer', token: asString(auth.token) };
  else if (type === 'apikey') request.auth = { ...request.auth, type: 'api-key', apiKeyName: asString(auth.key, 'X-API-Key'), apiKeyValue: asString(auth.value), apiKeyLocation: auth.addTo === 'queryParams' || auth.addTo === 'query' ? 'query' : 'header' };
  else {
    request.source = sourceMetadata(format, request.source?.sourceId, { authentication: auth });
    warnings.push({ code: 'unsupported-auth', message: `Insomnia authentication '${type}' was preserved as source metadata.`, resource: request.name });
  }
};

const applyInsomniaBody = (request: ApiRequest, rawValue: unknown, format: string, warnings: ImportWarning[]) => {
  const body = asRecord(rawValue);
  if (!body) { request.bodyMode = 'none'; return; }
  const mime = asString(body.mimeType).toLowerCase();
  const params = asArray(body.params);
  if (mime === 'application/graphql') {
    request.protocol = 'graphql';
    request.method = 'POST';
    request.graphql = { ...request.graphql, query: asString(body.text), variables: '{}' };
    request.bodyMode = 'none';
  } else if (params.length && mime.includes('multipart/form-data')) {
    request.bodyMode = 'multipart';
    request.multipartBody = params.flatMap((entry, index) => {
      const item = asRecord(entry);
      if (!item) return [];
      const fileName = asString(item.fileName);
      if (fileName) warnings.push({ code: 'external-file', message: `Insomnia file '${fileName}' requires re-selecting the local payload.`, resource: request.name });
      return [{ id: `${request.id}-part-${index}`, name: asString(item.name), value: asString(item.value), enabled: !asBoolean(item.disabled), kind: fileName ? 'file' as const : 'text' as const }];
    });
  } else if (params.length || mime.includes('application/x-www-form-urlencoded')) {
    request.bodyMode = 'form-urlencoded';
    request.formBody = keyValues(params, `${request.id}-form`);
  } else if (body.fileName) {
    request.bodyMode = 'binary';
    request.source = sourceMetadata(format, request.source?.sourceId, { fileName: body.fileName });
    warnings.push({ code: 'external-file', message: `Insomnia file '${asString(body.fileName)}' requires re-selecting the local payload.`, resource: request.name });
  } else if (typeof body.text === 'string') {
    request.body = body.text;
    request.bodyMode = mime.includes('json') || /^\s*[\[{]/.test(body.text) ? 'json' : 'text';
  } else request.bodyMode = 'none';
};

type InheritedRequestValues = { headers: KeyValue[]; authentication?: unknown; preRequestScript: string; tests: string };

const mapInsomniaRequest = (
  raw: UnknownRecord,
  format: 'insomnia-v4' | 'insomnia-v5',
  index: number,
  path: string[],
  inherited: InheritedRequestValues,
  warnings: ImportWarning[],
): ApiRequest => {
  const meta = asRecord(raw.meta);
  const identity = asString(raw._id ?? meta?.id, `${path.join('/')}:${index}`);
  const request = requestFrom(format, identity, index);
  request.name = [...path, asString(raw.name, `Request ${index + 1}`)].join(' / ');
  request.url = asString(raw.url ?? asRecord(raw.reflectionApi)?.url);
  const type = asString(raw._type);
  const metaId = asString(meta?.id);
  const isWebsocket = type === 'websocket_request' || metaId.startsWith('ws-req');
  const isSocketIo = type === 'socketio_request' || metaId.startsWith('socketio-req');
  const isMcp = type === 'mcp_request' || metaId.startsWith('mcp-req');
  const isGrpc = type === 'grpc_request' || Boolean(raw.protoMethodName) || Boolean(raw.reflectionApi);
  if (isWebsocket || isSocketIo) {
    request.protocol = 'websocket';
    request.method = 'GET';
  } else if (isGrpc) {
    request.protocol = 'grpc';
    request.method = 'POST';
    request.grpc = {
      ...request.grpc,
      method: asString(raw.protoMethodName).split('/').pop() ?? '',
      service: asString(raw.protoMethodName).split('/').slice(0, -1).join('/'),
      input: asString(asRecord(raw.body)?.text, '{}'),
      metadata: keyValues(raw.metadata, `${request.id}-metadata`),
      descriptorSource: asBoolean(asRecord(raw.reflectionApi)?.enabled, true) ? 'reflection' : 'proto',
    };
  } else if (isMcp) {
    request.method = 'POST';
  } else {
    request.method = normalizeMethod(raw.method, warnings, request.name);
  }
  request.params = keyValues(raw.parameters, `${request.id}-query`);
  request.headers = [...inherited.headers, ...keyValues(raw.headers, `${request.id}-header`)];
  if (!isGrpc && !isWebsocket && !isSocketIo && !isMcp) applyInsomniaBody(request, raw.body, format, warnings);
  applyInsomniaAuth(request, raw.authentication ?? inherited.authentication, format, warnings);
  const scripts = asRecord(raw.scripts);
  request.preRequestScript = joinScripts(inherited.preRequestScript, raw.preRequestScript, scripts?.preRequest);
  request.tests = joinScripts(inherited.tests, raw.afterResponseScript, scripts?.afterResponse);
  const settings = asRecord(raw.settings);
  if (settings?.followRedirects === 'off') request.transport.followRedirects = false;
  const unsupported: Record<string, JsonValue> = { ...(request.source?.unsupported ?? {}) };
  if (isSocketIo) {
    unsupported.socketIo = toJsonValue({ eventListeners: raw.eventListeners, pathParameters: raw.pathParameters, settings: raw.settings });
    warnings.push({ code: 'unsupported-protocol', message: 'Socket.IO was imported as a WebSocket baseline; event listeners and settings were preserved as source metadata.', resource: request.name });
  }
  if (isMcp) {
    unsupported.mcp = toJsonValue({ transportType: raw.transportType, env: raw.env, roots: raw.roots });
    warnings.push({ code: 'unsupported-protocol', message: 'MCP was imported as an HTTP baseline; transport settings were preserved as source metadata.', resource: request.name });
  }
  if (raw.pathParameters) unsupported.pathParameters = toJsonValue(raw.pathParameters);
  if (settings?.cookies) unsupported.cookieSettings = toJsonValue(settings.cookies);
  request.source = {
    ...(request.source ?? sourceMetadata(format, identity)),
    unsupported,
  };
  return request;
};

const folderPath = (id: string, folders: Map<string, UnknownRecord>) => {
  const output: string[] = [];
  const visited = new Set<string>();
  let current = folders.get(id);
  while (current && !visited.has(asString(current._id))) {
    visited.add(asString(current._id));
    output.unshift(asString(current.name, 'Folder'));
    current = folders.get(asString(current.parentId));
  }
  return output;
};

const v4Environments = (resources: UnknownRecord[], workspaceId: string, format: 'insomnia-v4'): Environment[] => resources
  .filter((resource) => resource._type === 'environment' && (resource.parentId === workspaceId || resources.some((candidate) => candidate._type === 'environment' && candidate._id === resource.parentId && candidate.parentId === workspaceId)))
  .map((resource, index) => ({
    id: sourceId('environment', format, asString(resource._id), index),
    name: asString(resource.name, `Environment ${index + 1}`),
    variables: objectVariables(resource.data, `insomnia-v4-env-${index}`),
    source: sourceMetadata(format, resource._id, { parentId: resource.parentId }),
  }));

const v4Mocks = (resources: UnknownRecord[], workspaceId: string): MockServer[] => {
  const servers = resources.filter((resource) => (resource._type === 'mock' || resource._type === 'mock_server') && (resource.parentId === workspaceId || !resource.parentId));
  return servers.map((server, index) => {
    const rawRoutes = asArray(server.routes).map(asRecord).filter((route): route is UnknownRecord => Boolean(route));
    const routes: MockRoute[] = rawRoutes.map((route, routeIndex) => ({
      id: sourceId('route', 'insomnia-v4', asString(route._id ?? route.name), routeIndex),
      name: asString(route.name, `Route ${routeIndex + 1}`), enabled: route.disabled !== true,
      method: normalizeMethod(route.method, [], asString(route.name)), path: asString(route.path, '/'),
      status: asNumber(route.statusCode ?? route.status, 200), headers: keyValues(route.headers, `insomnia-v4-mock-${routeIndex}`),
      body: asString(route.body, '{}'), delayMs: asNumber(route.delayMs),
    }));
    let port = 4010;
    try { port = Number(new URL(asString(server.url, 'http://127.0.0.1:4010')).port) || 4010; } catch { /* keep local default */ }
    return { id: sourceId('mock', 'insomnia-v4', asString(server._id), index), name: asString(server.name, `Mock ${index + 1}`), host: '127.0.0.1' as const, port, routes, source: sourceMetadata('insomnia-v4', server._id) };
  });
};

export const isInsomniaV4 = (document: UnknownRecord) => document.__export_format === 4 && Array.isArray(document.resources);

export const importInsomniaV4 = (sourceName: string, document: UnknownRecord): ArtifactImport => {
  const warnings: ImportWarning[] = [];
  const resources = asArray(document.resources).map(asRecord).filter((resource): resource is UnknownRecord => Boolean(resource));
  const workspaces = resources.filter((resource) => resource._type === 'workspace');
  const folders = new Map(resources.filter((resource) => resource._type === 'request_group').map((folder) => [asString(folder._id), folder]));
  const collectionWorkspaces = workspaces.length ? workspaces : [{ _id: '__WORKSPACE_ID__', name: sourceName }];
  const collections: Collection[] = [];
  const environments: Environment[] = [];
  const mockServers: MockServer[] = [];

  for (const [workspaceIndex, workspace] of collectionWorkspaces.entries()) {
    const workspaceId = asString(workspace._id, '__WORKSPACE_ID__');
    const requests = resources.filter((resource) => ['request', 'websocket_request', 'grpc_request', 'socketio_request', 'mcp_request'].includes(asString(resource._type)))
      .filter((resource) => resource.parentId === workspaceId || folders.has(asString(resource.parentId)))
      .filter((resource) => {
        const path = folderPath(asString(resource.parentId), folders);
        const rootFolder = path.length ? folders.get(asString(resource.parentId)) : undefined;
        if (!rootFolder) return resource.parentId === workspaceId;
        let current: UnknownRecord | undefined = rootFolder;
        while (current && folders.has(asString(current.parentId))) current = folders.get(asString(current.parentId));
        return current?.parentId === workspaceId;
      })
      .map((resource, requestIndex) => mapInsomniaRequest(resource, 'insomnia-v4', requestIndex, folderPath(asString(resource.parentId), folders), { headers: [], preRequestScript: '', tests: '' }, warnings));
    collections.push({ id: sourceId('collection', 'insomnia-v4', workspaceId, workspaceIndex), name: asString(workspace.name, `Workspace ${workspaceIndex + 1}`), expanded: true, requests, source: sourceMetadata('insomnia-v4', workspaceId, { description: workspace.description }) });
    environments.push(...v4Environments(resources, workspaceId, 'insomnia-v4'));
    mockServers.push(...v4Mocks(resources, workspaceId));
  }

  const apiDesigns: ApiDesign[] = resources.filter((resource) => ['api_spec', 'api_specification'].includes(asString(resource._type))).map((resource, index) => ({
    id: sourceId('design', 'insomnia-v4', asString(resource._id), index),
    name: asString(resource.name, `API specification ${index + 1}`),
    contents: typeof resource.contents === 'string' ? resource.contents : stringify(resource.contents ?? {}),
    source: sourceMetadata('insomnia-v4', resource._id),
  }));
  if (!collections.some((collection) => collection.requests.length) && !apiDesigns.length && !environments.length) warnings.push({ code: 'empty-export', message: 'The Insomnia v4 export contained no supported request, environment, or design resources.' });
  return {
    ...emptyResources(), format: 'insomnia-v4', sourceName, warnings,
    metadata: { source: asString(document.__export_source), date: asString(document.__export_date), resources: String(resources.length) },
    collections, environments, apiDesigns, mockServers,
  };
};

const nestedV5Requests = (
  children: unknown,
  path: string[],
  inherited: InheritedRequestValues,
  warnings: ImportWarning[],
  output: ApiRequest[],
) => {
  for (const rawChild of asArray(children)) {
    const child = asRecord(rawChild);
    if (!child) continue;
    if (Array.isArray(child.children)) {
      const scripts = asRecord(child.scripts);
      nestedV5Requests(child.children, [...path, asString(child.name, 'Folder')], {
        headers: [...inherited.headers, ...keyValues(child.headers, `v5-folder-header-${output.length}`)],
        authentication: child.authentication ?? inherited.authentication,
        preRequestScript: joinScripts(inherited.preRequestScript, scripts?.preRequest),
        tests: joinScripts(inherited.tests, scripts?.afterResponse),
      }, warnings, output);
    } else {
      output.push(mapInsomniaRequest(child, 'insomnia-v5', output.length, path, inherited, warnings));
    }
  }
};

const v5Environments = (document: UnknownRecord, prefix: string): Environment[] => {
  const root = asRecord(document.environments);
  if (!root) return [];
  const environments: Environment[] = [{
    id: sourceId('environment', 'insomnia-v5', asString(asRecord(root.meta)?.id, `${prefix}-base`)),
    name: asString(root.name, 'Base Environment'), variables: objectVariables(root.data, `${prefix}-base`), source: sourceMetadata('insomnia-v5', asRecord(root.meta)?.id),
  }];
  asArray(root.subEnvironments).map(asRecord).filter((environment): environment is UnknownRecord => Boolean(environment)).forEach((environment, index) => {
    environments.push({ id: sourceId('environment', 'insomnia-v5', asString(asRecord(environment.meta)?.id, `${prefix}-${index}`)), name: asString(environment.name, `Environment ${index + 1}`), variables: objectVariables(environment.data, `${prefix}-${index}`), source: sourceMetadata('insomnia-v5', asRecord(environment.meta)?.id) });
  });
  return environments;
};

export const isInsomniaV5 = (document: UnknownRecord) => /^(collection|spec|mock|environment)\.insomnia\.rest\/5\.0$/.test(asString(document.type));

export const importInsomniaV5 = (sourceName: string, documents: UnknownRecord[]): ArtifactImport => {
  const warnings: ImportWarning[] = [];
  const collections: Collection[] = [];
  const environments: Environment[] = [];
  const apiDesigns: ApiDesign[] = [];
  const mockServers: MockServer[] = [];
  for (const [documentIndex, document] of documents.entries()) {
    const type = asString(document.type);
    const meta = asRecord(document.meta);
    const identity = asString(meta?.id, `${sourceName}-${documentIndex}`);
    if (type.startsWith('collection.') || type.startsWith('spec.')) {
      const requests: ApiRequest[] = [];
      nestedV5Requests(document.collection, [], { headers: [], preRequestScript: '', tests: '' }, warnings, requests);
      const name = asString(document.name, `Collection ${documentIndex + 1}`);
      collections.push({ id: sourceId('collection', 'insomnia-v5', identity), name, expanded: true, requests, source: sourceMetadata('insomnia-v5', identity, { schemaVersion: document.schema_version }) });
      environments.push(...v5Environments(document, identity));
      if (type.startsWith('spec.')) {
        const spec = asRecord(document.spec);
        const contents = spec?.contents;
        apiDesigns.push({ id: sourceId('design', 'insomnia-v5', identity), name, contents: typeof contents === 'string' ? contents : stringify(contents ?? {}), generatedCollectionId: collections.at(-1)?.id, source: sourceMetadata('insomnia-v5', identity) });
      }
    } else if (type.startsWith('mock.')) {
      const server = asRecord(document.server);
      let port = 4010;
      try { port = Number(new URL(asString(server?.url, 'http://127.0.0.1:4010')).port) || 4010; } catch { /* use local default */ }
      const routes: MockRoute[] = asArray(document.routes).flatMap((rawRoute, routeIndex) => {
        const route = asRecord(rawRoute);
        if (!route) return [];
        const routeName = asString(route.name, `Route ${routeIndex + 1}`);
        return [{ id: sourceId('route', 'insomnia-v5', asString(asRecord(route.meta)?.id, routeName), routeIndex), name: routeName, enabled: true, method: normalizeMethod(route.method, warnings, routeName), path: routeName.startsWith('/') ? routeName : `/${routeName.replace(/\s+/g, '-').toLowerCase()}`, status: asNumber(route.statusCode, 200), headers: keyValues(route.headers, `v5-mock-${routeIndex}`), body: asString(route.body, '{}'), delayMs: 0 }];
      });
      mockServers.push({ id: sourceId('mock', 'insomnia-v5', identity), name: asString(document.name, `Mock ${documentIndex + 1}`), host: '127.0.0.1', port, routes, source: sourceMetadata('insomnia-v5', identity, { originalUrl: server?.url }) });
    } else if (type.startsWith('environment.')) environments.push(...v5Environments(document, identity));
  }
  if (!collections.length && !environments.length && !mockServers.length) warnings.push({ code: 'empty-export', message: 'The Insomnia v5 file contained no supported resources.' });
  return { ...emptyResources(), format: 'insomnia-v5', sourceName, warnings, metadata: { documents: String(documents.length), schemaVersions: [...new Set(documents.map((document) => asString(document.schema_version)).filter(Boolean))].join(', ') }, collections, environments, apiDesigns, mockServers };
};
