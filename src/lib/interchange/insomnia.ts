import { stringify } from 'yaml';
import type { ApiDesign, ApiRequest, Collection, CookieRecord, Environment, ImportWarning, JsonValue, KeyValue, MockRoute, MockServer, RequestFolder } from '../../types';
import { asArray, asBoolean, asNumber, asRecord, asString, keyValues, normalizeMethod, objectVariables, requestFrom, sourceId, sourceMetadata, toJsonValue, type UnknownRecord } from './common';
import { emptyResources, type ArtifactImport } from './types';

const joinScripts = (...scripts: unknown[]) => scripts.map((script) => asString(script)).filter(Boolean).join('\n\n');

const applyInsomniaAuth = (request: ApiRequest, rawValue: unknown, format: string, warnings: ImportWarning[]) => {
  const auth = asRecord(rawValue);
  const type = asString(auth?.type);
  if (!auth || !type) return;
  const disabled = asBoolean(auth.disabled);
  if (type === 'none') request.auth = { ...request.auth, type: 'none', disabled };
  else if (type === 'basic' || type === 'digest') request.auth = { ...request.auth, type, disabled, username: asString(auth.username), password: asString(auth.password) };
  else if (type === 'bearer' || type === 'singleToken') request.auth = { ...request.auth, type: 'bearer', disabled, token: asString(auth.token), prefix: asString(auth.prefix, 'Bearer') };
  else if (type === 'apikey') request.auth = { ...request.auth, type: 'api-key', disabled, apiKeyName: asString(auth.key, 'X-API-Key'), apiKeyValue: asString(auth.value), apiKeyLocation: auth.addTo === 'queryParams' || auth.addTo === 'query' ? 'query' : 'header' };
  else if (type === 'oauth1') request.auth = {
    ...request.auth, type: 'oauth1', disabled,
    oauth1SignatureMethod: ['HMAC-SHA1', 'HMAC-SHA256', 'RSA-SHA1', 'PLAINTEXT'].includes(asString(auth.signatureMethod)) ? asString(auth.signatureMethod) as ApiRequest['auth']['oauth1SignatureMethod'] : 'HMAC-SHA1',
    consumerKey: asString(auth.consumerKey), consumerSecret: asString(auth.consumerSecret), tokenKey: asString(auth.tokenKey), tokenSecret: asString(auth.tokenSecret), privateKey: asString(auth.privateKey), version: asString(auth.version, '1.0'), nonce: asString(auth.nonce), timestamp: asString(auth.timestamp), callback: asString(auth.callback), realm: asString(auth.realm), verifier: asString(auth.verifier), includeBodyHash: asBoolean(auth.includeBodyHash),
  };
  else if (type === 'oauth2') {
    const grantType = asString(auth.grantType);
    const supportedGrant = ['authorization_code', 'client_credentials', 'implicit', 'password', 'refresh_token'].includes(grantType);
    if (grantType && !supportedGrant) warnings.push({ code: 'unsupported-auth-option', message: `OAuth 2 grant '${grantType}' was imported as authorization code.`, resource: request.name });
    const responseType = asString(auth.responseType);
    request.auth = {
      ...request.auth, type: 'oauth2', disabled,
      oauth2GrantType: supportedGrant ? grantType as ApiRequest['auth']['oauth2GrantType'] : 'authorization_code',
      accessTokenUrl: asString(auth.accessTokenUrl), authorizationUrl: asString(auth.authorizationUrl), clientId: asString(auth.clientId), clientSecret: asString(auth.clientSecret), audience: asString(auth.audience), scope: asString(auth.scope), resource: asString(auth.resource), origin: asString(auth.origin), username: asString(auth.username), password: asString(auth.password), redirectUrl: asString(auth.redirectUrl), credentialsInBody: asBoolean(auth.credentialsInBody), state: asString(auth.state), code: asString(auth.code), accessToken: asString(auth.accessToken), identityToken: asString(auth.identityToken), refreshToken: asString(auth.refreshToken), tokenPrefix: asString(auth.tokenPrefix, 'Bearer'), usePkce: asBoolean(auth.usePkce), pkceMethod: auth.pkceMethod === 'plain' ? 'plain' : 'S256', codeVerifier: asString(auth.codeVerifier), responseType: ['code', 'token', 'id_token', 'id_token token'].includes(responseType) ? responseType as ApiRequest['auth']['responseType'] : 'code',
    };
  }
  else if (type === 'ntlm') request.auth = { ...request.auth, type: 'ntlm', disabled, username: asString(auth.username), password: asString(auth.password), ntlmDomain: asString(auth.domain), ntlmWorkstation: asString(auth.workstation, request.auth.ntlmWorkstation) };
  else if (type === 'iam') request.auth = { ...request.auth, type: 'iam', disabled, awsAccessKeyId: asString(auth.accessKeyId), awsSecretAccessKey: asString(auth.secretAccessKey), awsSessionToken: asString(auth.sessionToken), awsRegion: asString(auth.region, 'us-east-1'), awsService: asString(auth.service, 'execute-api') };
  else if (type === 'hawk') request.auth = { ...request.auth, type: 'hawk', disabled, hawkId: asString(auth.id), hawkKey: asString(auth.key), hawkExt: asString(auth.ext), hawkAlgorithm: auth.algorithm === 'sha1' ? 'sha1' : 'sha256', hawkValidatePayload: asBoolean(auth.validatePayload, true) };
  else if (type === 'asap') request.auth = { ...request.auth, type: 'asap', disabled, asapIssuer: asString(auth.issuer), asapSubject: asString(auth.subject), asapAudience: asString(auth.audience), asapAdditionalClaims: asString(auth.addintionalClaims ?? auth.additionalClaims, '{}'), asapPrivateKey: asString(auth.privateKey), asapKeyId: asString(auth.keyId) };
  else if (type === 'netrc') request.auth = { ...request.auth, type: 'netrc', disabled, netrc: asString(auth.netrc) };
  else {
    request.source = sourceMetadata(format, request.source?.sourceId, { authentication: auth });
    warnings.push({ code: 'unsupported-auth', message: `Insomnia authentication '${type}' was preserved as source metadata.`, resource: request.name });
  }
};

const insomniaCookie = (rawValue: unknown, format: string, index: number): CookieRecord | undefined => {
  const raw = asRecord(rawValue);
  const name = asString(raw?.key ?? raw?.name);
  const domain = asString(raw?.domain).replace(/^\./, '');
  if (!raw || !name || !domain) return undefined;
  const rawExpires = raw.expires;
  const expires = typeof rawExpires === 'string' && rawExpires ? rawExpires : undefined;
  const sameSiteValue = asString(raw.sameSite).toLowerCase();
  return {
    id: sourceId('cookie', format, `${name}:${domain}:${asString(raw.path, '/')}`, index), name, value: asString(raw.value), domain, path: asString(raw.path, '/'), expires,
    secure: asBoolean(raw.secure), httpOnly: asBoolean(raw.httpOnly), sameSite: ['strict', 'lax', 'none'].includes(sameSiteValue) ? sameSiteValue as CookieRecord['sameSite'] : '', hostOnly: asBoolean(raw.hostOnly, !asString(raw.domain).startsWith('.')), createdAt: asString(raw.creation ?? raw.createdAt, new Date().toISOString()),
  };
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
      const multiline = typeof item.multiline === 'string' || item.multiline === true;
      if (fileName) warnings.push({ code: 'external-file', message: `Insomnia file '${fileName}' requires re-selecting the local payload.`, resource: request.name });
      return [{
        id: `${request.id}-part-${index}`,
        name: asString(item.name),
        value: asString(item.value),
        enabled: !asBoolean(item.disabled),
        description: asString(item.description),
        kind: fileName ? 'file' as const : 'text' as const,
        multiline,
        fileName,
        contentType: typeof item.multiline === 'string' ? item.multiline : asString(item.contentType ?? item.mimeType),
      }];
    });
  } else if (params.length || mime.includes('application/x-www-form-urlencoded')) {
    request.bodyMode = 'form-urlencoded';
    request.formBody = keyValues(params, `${request.id}-form`).map((row, index) => ({ ...row, multiline: asRecord(params[index])?.multiline === true || typeof asRecord(params[index])?.multiline === 'string' }));
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
  identityScope = '',
): ApiRequest => {
  const meta = asRecord(raw.meta);
  const sourceIdentity = asString(raw._id ?? meta?.id, `${path.join('/')}:${index}`);
  const identity = identityScope ? `${identityScope}:${sourceIdentity}` : sourceIdentity;
  const request = requestFrom(format, identity, index);
  request.name = [...path, asString(raw.name, `Request ${index + 1}`)].join(' / ');
  request.documentation = asString(raw.description ?? meta?.description);
  request.url = asString(raw.url ?? asRecord(raw.reflectionApi)?.url);
  const type = asString(raw._type);
  const metaId = asString(meta?.id);
  const isWebsocket = type === 'websocket_request' || metaId.startsWith('ws-req');
  const isSocketIo = type === 'socketio_request' || metaId.startsWith('socketio-req');
  const isMcp = type === 'mcp_request' || metaId.startsWith('mcp-req');
  const isGrpc = type === 'grpc_request' || Boolean(raw.protoMethodName) || Boolean(raw.reflectionApi);
  if (isWebsocket) {
    request.protocol = 'websocket';
    request.method = 'GET';
  } else if (isSocketIo) {
    request.protocol = 'socketio';
    request.method = 'GET';
    const socketSettings = asRecord(raw.settings);
    const payload = asRecord(raw.payload);
    request.socketIo = {
      ...request.socketIo,
      path: asString(raw.settingPath ?? socketSettings?.path, '/socket.io'),
      eventName: asString(payload?.eventName, 'message'),
      ack: asBoolean(payload?.ack),
      args: (Array.isArray(payload?.args) ? payload.args : request.socketIo.args).flatMap((value, argIndex) => {
        const arg = asRecord(value);
        if (!arg) return [];
        return [{ id: asString(arg.id, `${request.id}-socketio-arg-${argIndex}`), value: asString(arg.value), mode: arg.mode === 'text' ? 'text' as const : 'json' as const }];
      }),
      eventListeners: (Array.isArray(raw.eventListeners) ? raw.eventListeners : []).flatMap((value, listenerIndex) => {
        const listener = asRecord(value);
        if (!listener) return [];
        return [{
          id: asString(listener.id, `${request.id}-socketio-listener-${listenerIndex}`),
          eventName: asString(listener.eventName),
          description: asString(listener.desc ?? listener.description),
          enabled: asBoolean(listener.isOpen ?? listener.enabled),
        }];
      }),
    };
  } else if (isGrpc) {
    const reflectionApi = asRecord(raw.reflectionApi);
    request.protocol = 'grpc';
    request.method = 'POST';
    request.grpc = {
      ...request.grpc,
      method: asString(raw.protoMethodName).split('/').pop() ?? '',
      service: asString(raw.protoMethodName).split('/').slice(0, -1).join('/'),
      input: asString(asRecord(raw.body)?.text, '{}'),
      metadata: keyValues(raw.metadata, `${request.id}-metadata`),
      descriptorSource: asBoolean(reflectionApi?.enabled) ? 'buf' : asString(raw.protoFileId) ? 'proto' : 'reflection',
      reflectionApiUrl: asString(reflectionApi?.url, request.grpc.reflectionApiUrl),
      reflectionApiKey: asString(reflectionApi?.apiKey),
      reflectionApiModule: asString(reflectionApi?.module, request.grpc.reflectionApiModule),
      disableUserAgentHeader: asBoolean(raw.disableUserAgentHeader),
    };
  } else if (isMcp) {
    request.method = 'POST';
  } else {
    request.method = normalizeMethod(raw.method, warnings, request.name);
  }
  request.pathParams = keyValues(raw.pathParameters, `${request.id}-path`);
  request.params = keyValues(raw.parameters, `${request.id}-query`);
  request.headers = [...inherited.headers, ...keyValues(raw.headers, `${request.id}-header`)];
  if (!isGrpc && !isWebsocket && !isSocketIo && !isMcp) applyInsomniaBody(request, raw.body, format, warnings);
  applyInsomniaAuth(request, raw.authentication ?? inherited.authentication, format, warnings);
  const scripts = asRecord(raw.scripts);
  request.preRequestScript = joinScripts(inherited.preRequestScript, raw.preRequestScript, scripts?.preRequest);
  request.tests = joinScripts(inherited.tests, raw.afterResponseScript, scripts?.afterResponse);
  const settings = asRecord(raw.settings);
  if (raw.settingDisableRenderRequestBody !== undefined) request.renderBodyTemplates = !asBoolean(raw.settingDisableRenderRequestBody);
  else if (settings?.renderRequestBody !== undefined) request.renderBodyTemplates = asBoolean(settings.renderRequestBody, true);
  const cookieSettings = asRecord(settings?.cookies);
  if (raw.settingSendCookies !== undefined || cookieSettings?.send !== undefined) request.transport.sendCookies = asBoolean(raw.settingSendCookies ?? cookieSettings?.send, true);
  if (raw.settingStoreCookies !== undefined || cookieSettings?.store !== undefined) request.transport.storeCookies = asBoolean(raw.settingStoreCookies ?? cookieSettings?.store, true);
  const followRedirectsMode = raw.settingFollowRedirects ?? settings?.followRedirects;
  if (followRedirectsMode === 'global' || followRedirectsMode === 'on' || followRedirectsMode === 'off') {
    request.transport.followRedirectsMode = followRedirectsMode;
    request.transport.followRedirects = followRedirectsMode !== 'off';
  }
  const unsupported: Record<string, JsonValue> = { ...(request.source?.unsupported ?? {}) };
  if (isMcp) {
    unsupported.mcp = toJsonValue({ transportType: raw.transportType, env: raw.env, roots: raw.roots });
    warnings.push({ code: 'unsupported-protocol', message: 'MCP was imported as an HTTP baseline; transport settings were preserved as source metadata.', resource: request.name });
  }
  if (raw.pathParameters && request.pathParams.length === 0) unsupported.pathParameters = toJsonValue(raw.pathParameters);
  request.source = {
    ...(request.source ?? sourceMetadata(format, sourceIdentity)),
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

const folderConfig = (raw: UnknownRecord, format: 'insomnia-v4' | 'insomnia-v5', id: string, index: number, warnings: ImportWarning[]): RequestFolder => {
  const authRequest = requestFrom(format, `${id}-auth`, index);
  if (raw.authentication) applyInsomniaAuth(authRequest, raw.authentication, format, warnings);
  const scripts = asRecord(raw.scripts);
  const meta = asRecord(raw.meta);
  const rawEnvironment = Array.isArray(raw.environment)
    ? keyValues(raw.environment, `${id}-environment`)
    : objectVariables(raw.environment, `${id}-environment`);
  return {
    id,
    name: asString(raw.name, `Folder ${index + 1}`),
    parentId: '',
    expanded: true,
    headers: keyValues(raw.headers, `${id}-header`),
    environment: rawEnvironment,
    auth: raw.authentication ? authRequest.auth : undefined,
    preRequestScript: joinScripts(raw.preRequestScript, scripts?.preRequest),
    tests: joinScripts(raw.afterResponseScript, scripts?.afterResponse),
    documentation: asString(raw.description ?? meta?.description),
  };
};

const v4Environments = (resources: UnknownRecord[], workspaceId: string, format: 'insomnia-v4'): Environment[] => {
  const all = new Map(resources.filter((resource) => resource._type === 'environment').map((environment) => [asString(environment._id), environment]));
  const belongsToWorkspace = (environment: UnknownRecord) => {
    const visited = new Set<string>();
    let parentId = asString(environment.parentId);
    while (parentId && !visited.has(parentId)) {
      if (parentId === workspaceId) return true;
      visited.add(parentId);
      parentId = asString(all.get(parentId)?.parentId);
    }
    return false;
  };
  const selected = [...all.values()].filter(belongsToWorkspace);
  const ids = new Map(selected.map((environment, index) => [asString(environment._id), sourceId('environment', format, `${workspaceId}:${asString(environment._id)}`, index)]));
  return selected.map((environment, index) => ({
    id: ids.get(asString(environment._id))!,
    name: asString(environment.name, `Environment ${index + 1}`),
    variables: objectVariables(environment.data, `insomnia-v4-env-${index}`),
    parentId: ids.get(asString(environment.parentId)) ?? '',
    source: sourceMetadata(format, environment._id, { parentId: environment.parentId }),
  }));
};

const collectionEnvironmentFields = (environments: Environment[]) => {
  const base = environments.find((environment) => !environment.parentId) ?? environments[0];
  return {
    environment: base?.variables ?? [],
    subEnvironments: environments.filter((environment) => environment.id !== base?.id).map((environment) => ({ id: environment.id, name: environment.name, variables: environment.variables })),
    activeSubEnvironmentId: '',
  };
};

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
  const socketIoPayloads = new Map(resources.filter((resource) => resource._type === 'socketio_payload' || resource._type === 'socket_io_payload').map((payload) => [asString(payload.parentId), payload]));
  const collectionWorkspaces = workspaces.length ? workspaces : [{ _id: '__WORKSPACE_ID__', name: sourceName }];
  const collections: Collection[] = [];
  const environments: Environment[] = [];
  const mockServers: MockServer[] = [];
  const cookieMap = new Map<string, CookieRecord>();
  resources.filter((resource) => resource._type === 'cookie_jar').flatMap((resource) => asArray(resource.cookies)).forEach((cookie, index) => {
    const mapped = insomniaCookie(cookie, 'insomnia-v4', index);
    if (mapped) cookieMap.set(`${mapped.name}\n${mapped.domain}\n${mapped.path}`, mapped);
  });
  const cookies = [...cookieMap.values()];

  for (const [workspaceIndex, workspace] of collectionWorkspaces.entries()) {
    const workspaceId = asString(workspace._id, '__WORKSPACE_ID__');
    const belongsToWorkspace = (folder: UnknownRecord) => {
      const visited = new Set<string>();
      let current: UnknownRecord | undefined = folder;
      while (current && !visited.has(asString(current._id))) {
        visited.add(asString(current._id));
        if (current.parentId === workspaceId) return true;
        current = folders.get(asString(current.parentId));
      }
      return false;
    };
    const rawFolders = [...folders.values()].filter(belongsToWorkspace);
    const folderIds = new Map(rawFolders.map((folder, index) => [asString(folder._id), sourceId('folder', 'insomnia-v4', `${workspaceId}:${asString(folder._id)}`, index)]));
    const requestFolders = rawFolders.map((folder, index) => ({
      ...folderConfig(folder, 'insomnia-v4', folderIds.get(asString(folder._id))!, index, warnings),
      parentId: folderIds.get(asString(folder.parentId)) ?? '',
    }));
    const requests = resources.filter((resource) => ['request', 'websocket_request', 'grpc_request', 'socketio_request', 'mcp_request'].includes(asString(resource._type)))
      .filter((resource) => resource.parentId === workspaceId || folders.has(asString(resource.parentId)))
      .filter((resource) => {
        const path = folderPath(asString(resource.parentId), folders);
        const rootFolder = path.length ? folders.get(asString(resource.parentId)) : undefined;
        if (!rootFolder) return resource.parentId === workspaceId;
        let current: UnknownRecord | undefined = rootFolder;
        const visited = new Set<string>();
        while (current && folders.has(asString(current.parentId))) {
          const id = asString(current._id);
          if (visited.has(id)) return false;
          visited.add(id);
          current = folders.get(asString(current.parentId));
        }
        return current?.parentId === workspaceId;
      })
      .map((resource, requestIndex) => {
        const request = mapInsomniaRequest({ ...resource, payload: socketIoPayloads.get(asString(resource._id)) ?? resource.payload }, 'insomnia-v4', requestIndex, [], { headers: [], preRequestScript: '', tests: '' }, warnings, workspaceId);
        request.folderId = folderIds.get(asString(resource.parentId)) ?? '';
        request.inheritFolderAuth = Boolean(request.folderId) && !resource.authentication;
        return request;
      });
    const collectionEnvironments = v4Environments(resources, workspaceId, 'insomnia-v4');
    collections.push({ id: sourceId('collection', 'insomnia-v4', workspaceId, workspaceIndex), name: asString(workspace.name, `Workspace ${workspaceIndex + 1}`), expanded: true, requests, folders: requestFolders, ...collectionEnvironmentFields(collectionEnvironments), documentation: asString(workspace.description), source: sourceMetadata('insomnia-v4', workspaceId, { description: workspace.description }) });
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
    collections, environments, apiDesigns, mockServers, cookies,
  };
};

const nestedV5Requests = (
  children: unknown,
  parentId: string,
  warnings: ImportWarning[],
  output: ApiRequest[],
  folders: RequestFolder[],
  identityPrefix: string,
) => {
  for (const rawChild of asArray(children)) {
    const child = asRecord(rawChild);
    if (!child) continue;
    if (Array.isArray(child.children)) {
      const meta = asRecord(child.meta);
      const folderId = sourceId('folder', 'insomnia-v5', `${identityPrefix}:${asString(meta?.id, `${parentId}:${folders.length}`)}`, folders.length);
      folders.push({ ...folderConfig(child, 'insomnia-v5', folderId, folders.length, warnings), parentId });
      nestedV5Requests(child.children, folderId, warnings, output, folders, identityPrefix);
    } else {
      const request = mapInsomniaRequest(child, 'insomnia-v5', output.length, [], { headers: [], preRequestScript: '', tests: '' }, warnings, identityPrefix);
      request.folderId = parentId;
      request.inheritFolderAuth = Boolean(parentId) && !child.authentication;
      output.push(request);
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
  const baseId = environments[0].id;
  asArray(root.subEnvironments).map(asRecord).filter((environment): environment is UnknownRecord => Boolean(environment)).forEach((environment, index) => {
    environments.push({ id: sourceId('environment', 'insomnia-v5', asString(asRecord(environment.meta)?.id, `${prefix}-${index}`)), name: asString(environment.name, `Environment ${index + 1}`), variables: objectVariables(environment.data, `${prefix}-${index}`), parentId: baseId, source: sourceMetadata('insomnia-v5', asRecord(environment.meta)?.id) });
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
  const cookies: CookieRecord[] = [];
  for (const [documentIndex, document] of documents.entries()) {
    const type = asString(document.type);
    const meta = asRecord(document.meta);
    const identity = asString(meta?.id, `${sourceName}-${documentIndex}`);
    if (type.startsWith('collection.') || type.startsWith('spec.')) {
      asArray(asRecord(document.cookieJar)?.cookies).forEach((cookie, index) => {
        const mapped = insomniaCookie(cookie, 'insomnia-v5', cookies.length + index);
        if (mapped && !cookies.some((current) => current.name === mapped.name && current.domain === mapped.domain && current.path === mapped.path)) cookies.push(mapped);
      });
      const requests: ApiRequest[] = [];
      const folders: RequestFolder[] = [];
      nestedV5Requests(document.collection, '', warnings, requests, folders, identity);
      const name = asString(document.name, `Collection ${documentIndex + 1}`);
      const collectionEnvironments = v5Environments(document, identity);
      collections.push({ id: sourceId('collection', 'insomnia-v5', identity), name, expanded: true, requests, folders, ...collectionEnvironmentFields(collectionEnvironments), documentation: asString(meta?.description), source: sourceMetadata('insomnia-v5', identity, { schemaVersion: document.schema_version }) });
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
  return { ...emptyResources(), format: 'insomnia-v5', sourceName, warnings, metadata: { documents: String(documents.length), schemaVersions: [...new Set(documents.map((document) => asString(document.schema_version)).filter(Boolean))].join(', ') }, collections, environments, apiDesigns, mockServers, cookies };
};
