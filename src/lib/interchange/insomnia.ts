import { stringify } from 'yaml';
import type { ApiDesign, ApiRequest, Collection, CookieRecord, Environment, ImportWarning, JsonValue, KeyValue, McpClient, MockRoute, MockServer, RequestFolder, UnitTestSuite } from '../../types';
import { normalizeGrpcProtoTree } from '../grpcProto';
import { isProtectedSecretReference, isSensitiveSecretName } from '../security';
import { asArray, asBoolean, asNumber, asRecord, asString, keyValues, normalizeMethod, objectVariables, requestFrom, sourceId, sourceMetadata, toJsonValue, type UnknownRecord } from './common';
import { emptyResources, type ArtifactImport } from './types';

const joinScripts = (...scripts: unknown[]) => scripts.map((script) => asString(script)).filter(Boolean).join('\n\n');

const insomniaEnvironmentMode = (raw: UnknownRecord): 'table' | 'raw' => raw.environmentType === 'kv' ? 'table' : 'raw';

const withoutInsomniaVaultData = (value: unknown) => {
  const data = asRecord(value);
  if (!data) return value;
  const { __insomnia_vault: _encryptedSecrets, ...publicData } = data;
  return publicData;
};

const hasInsomniaEnvironmentSecrets = (raw: UnknownRecord) => asArray(raw.kvPairData).some((value) => asRecord(value)?.type === 'secret')
  || Boolean(asRecord(raw.data)?.__insomnia_vault)
  || Boolean(asRecord(raw.environment)?.__insomnia_vault);

const insomniaEnvironmentRows = (raw: UnknownRecord, dataKey: 'data' | 'environment', prefix: string): KeyValue[] => {
  const pairs = asArray(raw.kvPairData).flatMap((value, index): KeyValue[] => {
    const pair = asRecord(value);
    if (!pair || pair.type === 'secret') return [];
    return [{
      id: asString(pair.id, `${prefix}-${index}`),
      name: asString(pair.name),
      value: asString(pair.value),
      enabled: pair.enabled !== false,
      valueType: pair.type === 'json' ? 'json' : 'string',
    }];
  });
  return raw.environmentType === 'kv' && pairs.length ? pairs : objectVariables(withoutInsomniaVaultData(raw[dataKey]), prefix);
};

const isInsomniaMcpRequest = (raw: UnknownRecord) => asString(raw._type) === 'mcp_request' || asString(asRecord(raw.meta)?.id).startsWith('mcp-req');

const parseMcpStdioCommand = (value: string): string[] | undefined => {
  const tokens: string[] = [];
  let token = '';
  let quote = '';
  let escaped = false;
  let started = false;
  const push = () => {
    if (!started) return;
    tokens.push(token);
    token = '';
    started = false;
  };
  for (const character of value) {
    if (escaped) {
      token += character;
      escaped = false;
      started = true;
    } else if (character === '\\' && quote !== "'") {
      escaped = true;
      started = true;
    } else if (quote) {
      if (character === quote) quote = '';
      else token += character;
      started = true;
    } else if (character === '"' || character === "'") {
      quote = character;
      started = true;
    } else if (/[\r\n|&;<>()`$#]/.test(character)) {
      return undefined;
    } else if (/\s/.test(character)) push();
    else {
      token += character;
      started = true;
    }
  }
  if (escaped || quote) return undefined;
  push();
  return tokens.length <= 101 && tokens.every((entry) => entry.length <= 8_192) ? tokens : undefined;
};

const protectedMcpRows = (value: unknown, prefix: string): KeyValue[] => asArray(value).flatMap((entry, index): KeyValue[] => {
  const item = asRecord(entry);
  if (!item) return [];
  const name = asString(item.name ?? item.key);
  const rawValue = asString(item.value);
  return [{
    id: asString(item.id, `${prefix}-${index}`),
    name,
    value: isSensitiveSecretName(name) && rawValue && !isProtectedSecretReference(rawValue) ? '' : rawValue,
    enabled: item.enabled !== false && item.disabled !== true,
    description: asString(item.description),
  }];
});

const mapInsomniaMcpClient = (
  raw: UnknownRecord,
  format: 'insomnia-v4' | 'insomnia-v5',
  index: number,
  warnings: ImportWarning[],
): McpClient => {
  const meta = asRecord(raw.meta);
  const identity = asString(raw._id ?? meta?.id, `mcp-${index}`);
  const name = asString(raw.name, `MCP Client ${index + 1}`);
  const transport = raw.transportType === 'stdio' ? 'stdio' : 'http';
  if (raw.transportType !== undefined && raw.transportType !== 'stdio' && raw.transportType !== 'streamable-http') warnings.push({ code: 'unsupported-protocol', message: `Unknown MCP transport '${asString(raw.transportType)}' was imported as Streamable HTTP.`, resource: name });
  const parsedCommand = transport === 'stdio' ? parseMcpStdioCommand(asString(raw.url)) : [];
  if (transport === 'stdio' && !parsedCommand) warnings.push({ code: 'mcp-command', message: 'The STDIO command contains unsupported shell syntax and was preserved as one disabled executable value for review.', resource: name });
  const authentication = asRecord(raw.authentication);
  const authenticationType = asString(authentication?.type);
  let authType: McpClient['authType'] = 'none';
  if (authenticationType === 'bearer' || authenticationType === 'singleToken') authType = 'bearer';
  else if (authenticationType === 'basic') authType = 'basic';
  else if (authenticationType === 'oauth2') authType = 'oauth2';
  else if (authenticationType && authenticationType !== 'none' && authenticationType !== 'apikey') warnings.push({ code: 'unsupported-auth', message: `Insomnia MCP authentication '${authenticationType}' was omitted.`, resource: name });
  const headers = protectedMcpRows(raw.headers, `${identity}-header`);
  if (authenticationType === 'apikey') {
    const key = asString(authentication?.key, 'X-API-Key');
    const value = asString(authentication?.value);
    headers.push({ id: `${identity}-api-key`, name: key, value: value && !isProtectedSecretReference(value) ? '' : value, enabled: authentication?.disabled !== true });
  }
  const env = protectedMcpRows(raw.env, `${identity}-environment`).slice(0, 100);
  const roots = asArray(raw.roots).flatMap((root): string[] => {
    const uri = asString(asRecord(root)?.uri);
    return uri ? [uri] : [];
  }).slice(0, 100);
  warnings.push({ code: 'integrations-disabled', message: 'Imported MCP clients are disabled and credential fields are cleared until their endpoints, commands, and authority are reviewed.', resource: name });
  return {
    id: sourceId('mcp-client', format, identity, index),
    name,
    enabled: false,
    transport,
    url: transport === 'http' ? asString(raw.url) : '',
    command: transport === 'stdio' ? parsedCommand?.[0] ?? asString(raw.url).trim().slice(0, 8_192) : '',
    args: transport === 'stdio' ? parsedCommand?.slice(1) ?? [] : [],
    env,
    headers,
    authType,
    token: '',
    username: authType === 'basic' ? asString(authentication?.username) : '',
    password: '',
    oauthAuthorizationUrl: authType === 'oauth2' ? asString(authentication?.authorizationUrl) : '',
    oauthAccessTokenUrl: authType === 'oauth2' ? asString(authentication?.accessTokenUrl) : '',
    oauthClientId: authType === 'oauth2' ? asString(authentication?.clientId) : '',
    oauthClientSecret: '',
    oauthScope: authType === 'oauth2' ? asString(authentication?.scope) : '',
    oauthState: authType === 'oauth2' ? asString(authentication?.state) : '',
    oauthRefreshToken: '',
    oauthIdentityToken: '',
    oauthExpiresAt: 0,
    oauthTokenPrefix: authType === 'oauth2' ? asString(authentication?.tokenPrefix, 'Bearer') : 'Bearer',
    oauthRegisteredClientId: '',
    oauthRegisteredClientSecret: '',
    oauthRegisteredClientIdIssuedAt: 0,
    oauthRegisteredClientSecretExpiresAt: 0,
    oauthRegisteredTokenEndpointAuthMethod: 'none',
    roots,
    tools: [],
    prompts: [],
    resources: [],
    resourceTemplates: [],
  };
};

const appendInsomniaMcpClient = (
  target: McpClient[],
  raw: UnknownRecord,
  format: 'insomnia-v4' | 'insomnia-v5',
  warnings: ImportWarning[],
) => {
  if (target.length >= 100) {
    if (!warnings.some((warning) => warning.code === 'mcp-client-limit')) warnings.push({ code: 'mcp-client-limit', message: 'Only the first 100 MCP clients were imported.' });
    return;
  }
  target.push(mapInsomniaMcpClient(raw, format, target.length, warnings));
};

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
      accessTokenUrl: asString(auth.accessTokenUrl), authorizationUrl: asString(auth.authorizationUrl), clientId: asString(auth.clientId), clientSecret: asString(auth.clientSecret), audience: asString(auth.audience), scope: asString(auth.scope), resource: asString(auth.resource), origin: asString(auth.origin), username: asString(auth.username), password: asString(auth.password), redirectUrl: asString(auth.redirectUrl), useDefaultBrowser: asBoolean(auth.useDefaultBrowser), credentialsInBody: asBoolean(auth.credentialsInBody), state: asString(auth.state), code: asString(auth.code), accessToken: asString(auth.accessToken), identityToken: asString(auth.identityToken), refreshToken: asString(auth.refreshToken), tokenPrefix: asString(auth.tokenPrefix, 'Bearer'), usePkce: asBoolean(auth.usePkce), pkceMethod: auth.pkceMethod === 'plain' ? 'plain' : 'S256', codeVerifier: asString(auth.codeVerifier), responseType: ['code', 'token', 'id_token', 'id_token token'].includes(responseType) ? responseType as ApiRequest['auth']['responseType'] : 'code',
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
  const isGrpc = type === 'grpc_request' || Boolean(raw.protoMethodName) || Boolean(raw.reflectionApi);
  request.disableUserAgentHeader = asBoolean(raw.disableUserAgentHeader);
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
      descriptorSource: asBoolean(reflectionApi?.enabled) ? 'buf' : 'reflection',
      reflectionApiUrl: asString(reflectionApi?.url, request.grpc.reflectionApiUrl),
      reflectionApiKey: asString(reflectionApi?.apiKey),
      reflectionApiModule: asString(reflectionApi?.module, request.grpc.reflectionApiModule),
    };
  } else {
    request.method = normalizeMethod(raw.method, warnings, request.name);
  }
  request.pathParams = keyValues(raw.pathParameters, `${request.id}-path`);
  request.params = keyValues(raw.parameters, `${request.id}-query`);
  request.headers = [...inherited.headers, ...keyValues(raw.headers, `${request.id}-header`)];
  if (!isGrpc && !isWebsocket && !isSocketIo) applyInsomniaBody(request, raw.body, format, warnings);
  applyInsomniaAuth(request, raw.authentication ?? inherited.authentication, format, warnings);
  const scripts = asRecord(raw.scripts);
  request.preRequestScript = joinScripts(inherited.preRequestScript, raw.preRequestScript, scripts?.preRequest);
  request.tests = joinScripts(inherited.tests, raw.afterResponseScript, scripts?.afterResponse);
  const settings = asRecord(raw.settings);
  if (raw.settingDisableRenderRequestBody !== undefined) request.renderBodyTemplates = !asBoolean(raw.settingDisableRenderRequestBody);
  else if (settings?.renderRequestBody !== undefined) request.renderBodyTemplates = asBoolean(settings.renderRequestBody, true);
  request.encodeUrl = asBoolean(raw.settingEncodeUrl ?? settings?.encodeUrl, true);
  const cookieSettings = asRecord(settings?.cookies);
  if (raw.settingSendCookies !== undefined || cookieSettings?.send !== undefined) request.transport.sendCookies = asBoolean(raw.settingSendCookies ?? cookieSettings?.send, true);
  if (raw.settingStoreCookies !== undefined || cookieSettings?.store !== undefined) request.transport.storeCookies = asBoolean(raw.settingStoreCookies ?? cookieSettings?.store, true);
  const followRedirectsMode = raw.settingFollowRedirects ?? settings?.followRedirects;
  if (followRedirectsMode === 'global' || followRedirectsMode === 'on' || followRedirectsMode === 'off') {
    request.transport.followRedirectsMode = followRedirectsMode;
    request.transport.followRedirects = followRedirectsMode !== 'off';
  }
  const unsupported: Record<string, JsonValue> = { ...(request.source?.unsupported ?? {}) };
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
    : insomniaEnvironmentRows(raw, 'environment', `${id}-environment`);
  return {
    id,
    name: asString(raw.name, `Folder ${index + 1}`),
    parentId: '',
    expanded: true,
    headers: keyValues(raw.headers, `${id}-header`),
    environment: rawEnvironment,
    environmentEditorMode: Array.isArray(raw.environment) ? 'table' : insomniaEnvironmentMode(raw),
    auth: raw.authentication ? authRequest.auth : undefined,
    preRequestScript: joinScripts(raw.preRequestScript, scripts?.preRequest),
    tests: joinScripts(raw.afterResponseScript, scripts?.afterResponse),
    documentation: asString(raw.description ?? meta?.description),
  };
};

const byDeclaredSortKey = (resources: UnknownRecord[], value: (resource: UnknownRecord) => unknown) => {
  const sorted = resources.map((resource, index) => ({ resource, index, sortKey: value(resource) }));
  if (!sorted.every((item) => typeof item.sortKey === 'number' && Number.isFinite(item.sortKey))) return resources;
  return sorted.sort((left, right) => Number(left.sortKey) - Number(right.sortKey) || left.index - right.index).map((item) => item.resource);
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
    variables: insomniaEnvironmentRows(environment, 'data', `insomnia-v4-env-${index}`),
    environmentEditorMode: insomniaEnvironmentMode(environment),
    parentId: ids.get(asString(environment.parentId)) ?? '',
    source: sourceMetadata(format, environment._id, { parentId: environment.parentId }),
  }));
};

const collectionEnvironmentFields = (environments: Environment[]) => {
  const base = environments.find((environment) => !environment.parentId) ?? environments[0];
  return {
    environment: base?.variables ?? [],
    environmentEditorMode: base?.environmentEditorMode ?? 'table',
    subEnvironments: environments.filter((environment) => environment.id !== base?.id).map((environment) => ({ id: environment.id, name: environment.name, variables: environment.variables, environmentEditorMode: environment.environmentEditorMode })),
    activeSubEnvironmentId: '',
  };
};

const appendUniqueEnvironmentTree = (target: Environment[], incoming: Environment[], fingerprints: Set<string>) => {
  if (!incoming.length) return;
  const indexes = new Map(incoming.map((environment, index) => [environment.id, index]));
  const fingerprint = JSON.stringify(incoming.map((environment) => ({
    name: environment.name,
    parent: environment.parentId ? indexes.get(environment.parentId) ?? -1 : -1,
    mode: environment.environmentEditorMode,
    variables: environment.variables.map((variable) => ({ name: variable.name, value: variable.value, enabled: variable.enabled, valueType: variable.valueType ?? 'string' })),
  })));
  if (fingerprints.has(fingerprint)) return;
  fingerprints.add(fingerprint);
  target.push(...incoming);
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

const protoResourceName = (value: unknown, fallback: string, ensureExtension = false) => {
  const leaf = asString(value).trim().replaceAll('\\', '/').split('/').filter(Boolean).at(-1);
  const name = !leaf || leaf === '.' || leaf === '..' ? fallback : leaf;
  return ensureExtension && !name.toLowerCase().endsWith('.proto') ? `${name}.proto` : name;
};

const v4ProtoTree = (
  protoFileId: string,
  workspaceId: string,
  protoFiles: Map<string, UnknownRecord>,
  protoDirectories: Map<string, UnknownRecord>,
  warnings: ImportWarning[],
  requestName: string,
) => {
  const entry = protoFiles.get(protoFileId);
  if (!entry) {
    warnings.push({ code: 'external-schema', message: `Proto file '${protoFileId}' referenced by the request was not included in the export.`, resource: requestName });
    return undefined;
  }
  let rootDirectoryId = '';
  let parentId = asString(entry.parentId);
  const ancestors = new Set<string>();
  while (protoDirectories.has(parentId) && !ancestors.has(parentId)) {
    ancestors.add(parentId);
    rootDirectoryId = parentId;
    parentId = asString(protoDirectories.get(parentId)?.parentId);
  }
  if (parentId !== workspaceId) {
    warnings.push({ code: 'external-schema', message: `Proto file '${protoFileId}' is outside the request workspace.`, resource: requestName });
    return undefined;
  }
  const resourcePath = (file: UnknownRecord) => {
    const segments = [protoResourceName(file.name, 'schema.proto', true)];
    if (!rootDirectoryId) return asString(file._id) === protoFileId ? segments.join('/') : '';
    let currentParentId = asString(file.parentId);
    const visited = new Set<string>();
    while (currentParentId !== rootDirectoryId) {
      if (!currentParentId || visited.has(currentParentId)) return '';
      visited.add(currentParentId);
      const directory = protoDirectories.get(currentParentId);
      if (!directory) return '';
      segments.unshift(protoResourceName(directory.name, '_'));
      currentParentId = asString(directory.parentId);
    }
    return segments.join('/');
  };
  const rawFiles = [...protoFiles.values()].flatMap((file) => {
    const path = resourcePath(file);
    return path ? [{ id: asString(file._id), path, text: asString(file.protoText) }] : [];
  });
  const preferredEntryPath = resourcePath(entry);
  const tree = normalizeGrpcProtoTree(rawFiles, '', preferredEntryPath, preferredEntryPath);
  if (!tree.protoFiles.length) {
    warnings.push({ code: 'external-schema', message: `Proto resources for '${requestName}' contained no usable .proto files.`, resource: requestName });
    return undefined;
  }
  if (tree.protoFiles.length !== rawFiles.length) warnings.push({ code: 'external-schema', message: `Some proto resources for '${requestName}' were invalid, duplicated, or exceeded Brunomnia's import limits.`, resource: requestName });
  return tree;
};

export const isInsomniaV4 = (document: UnknownRecord) => document.__export_format === 4 && Array.isArray(document.resources);

type LegacyInsomniaVersion = 1 | 2 | 3;

export const insomniaLegacyVersion = (document: UnknownRecord): LegacyInsomniaVersion | undefined => {
  const version = asNumber(document.__export_format);
  return (version === 1 && Array.isArray(document.items)) || ((version === 2 || version === 3) && Array.isArray(document.resources))
    ? version as LegacyInsomniaVersion
    : undefined;
};

const legacyContentType = (headers: unknown) => asArray(headers).map(asRecord)
  .find((header) => asString(header?.name).toLowerCase() === 'content-type');

const legacyV1Resources = (document: UnknownRecord): UnknownRecord[] => asArray(document.items).flatMap((value, groupIndex) => {
  const item = asRecord(value);
  if (!item) return [];
  const groupId = `__LEGACY_GROUP_${groupIndex + 1}__`;
  const group: UnknownRecord = {
    _type: 'request_group',
    _id: groupId,
    parentId: '__WORKSPACE_ID__',
    name: asString(item.name, `Imported Folder ${groupIndex + 1}`),
    environment: asRecord(asRecord(item.environments)?.base) ?? {},
  };
  const requests = asArray(item.requests).flatMap((requestValue, requestIndex): UnknownRecord[] => {
    const raw = asRecord(requestValue);
    if (!raw) return [];
    const headers = asArray(raw.headers).map(asRecord).filter((header): header is UnknownRecord => Boolean(header));
    const format = asString(asRecord(raw.__insomnia)?.format);
    const formatMime: Record<string, string> = { form: 'application/x-www-form-urlencoded', json: 'application/json', text: 'text/plain', xml: 'application/xml' };
    let contentType = legacyContentType(headers);
    if (!contentType && formatMime[format]) {
      contentType = { name: 'Content-Type', value: formatMime[format] };
      headers.push(contentType);
    }
    const mimeType = asString(contentType?.value).split(';')[0];
    const bodyText = asString(raw.body);
    const formBody = /^application\/(?:x-www-form-urlencoded|multipart\/form-encoded)/i.test(asString(contentType?.value));
    const body = formBody
      ? {
          mimeType,
          params: bodyText.split('&').filter(Boolean).map((pair) => {
            const separator = pair.indexOf('=');
            const decode = (part: string) => {
              try { return decodeURIComponent(part.replace(/\+/g, ' ')); } catch { return part; }
            };
            return { name: decode(separator < 0 ? pair : pair.slice(0, separator)), value: decode(separator < 0 ? '' : pair.slice(separator + 1)) };
          }),
        }
      : bodyText ? { mimeType: mimeType || formatMime[format] || '', text: bodyText } : {};
    const authentication = asRecord(raw.authentication);
    return [{
      _type: 'request',
      _id: `__LEGACY_REQUEST_${groupIndex + 1}_${requestIndex + 1}__`,
      parentId: groupId,
      name: asString(raw.name, `Imported Request ${requestIndex + 1}`),
      url: asString(raw.url),
      method: asString(raw.method, 'GET'),
      body,
      parameters: asArray(raw.params),
      headers,
      authentication: authentication && (asString(authentication.username) || asString(authentication.password))
        ? { ...authentication, type: asString(authentication._type, 'basic') }
        : authentication ?? {},
    }];
  });
  return [group, ...requests];
});

const legacyResources = (document: UnknownRecord, version: LegacyInsomniaVersion): UnknownRecord[] => {
  if (version === 1) return legacyV1Resources(document);
  return asArray(document.resources).flatMap((value): UnknownRecord[] => {
    const resource = asRecord(value);
    if (!resource) return [];
    if (version !== 2 || resource._type !== 'request' || typeof resource.body !== 'string') return [{ ...resource }];
    return [{
      ...resource,
      body: {
        mimeType: asString(legacyContentType(resource.headers)?.value).split(';')[0],
        text: resource.body,
      },
    }];
  });
};

export const importInsomniaLegacy = (sourceName: string, document: UnknownRecord): ArtifactImport => {
  const version = insomniaLegacyVersion(document);
  if (!version) throw new Error('The document is not an Insomnia v1, v2, or v3 export.');
  const imported = importInsomniaV4(sourceName, {
    __export_format: 4,
    __export_source: `insomnia.legacy:v${version}`,
    resources: legacyResources(document, version),
  });
  return {
    ...imported,
    format: `insomnia-v${version}` as const,
    warnings: [{ code: 'legacy-format', message: `Insomnia v${version} was migrated through the pinned legacy compatibility model; review imported requests before use.` }, ...imported.warnings],
    metadata: { ...imported.metadata, legacyVersion: String(version) },
  };
};

export const importInsomniaV4 = (sourceName: string, document: UnknownRecord): ArtifactImport => {
  const warnings: ImportWarning[] = [];
  const resources = asArray(document.resources).map(asRecord).filter((resource): resource is UnknownRecord => Boolean(resource));
  if (resources.some(hasInsomniaEnvironmentSecrets)) warnings.push({ code: 'environment-secrets-omitted', message: 'Encrypted Insomnia Secret environment rows were omitted because their account vault key is not portable. Recreate them in an unlocked private Brunomnia environment.' });
  const workspaces = resources.filter((resource) => resource._type === 'workspace');
  const folders = new Map(resources.filter((resource) => resource._type === 'request_group').map((folder) => [asString(folder._id), folder]));
  const protoFiles = new Map(resources.filter((resource) => resource._type === 'proto_file').map((file) => [asString(file._id), file]));
  const protoDirectories = new Map(resources.filter((resource) => resource._type === 'proto_directory').map((directory) => [asString(directory._id), directory]));
  const socketIoPayloads = new Map(resources.filter((resource) => resource._type === 'socketio_payload' || resource._type === 'socket_io_payload').map((payload) => [asString(payload.parentId), payload]));
  const mcpResources = resources.filter(isInsomniaMcpRequest);
  const mcpClients: McpClient[] = [];
  mcpResources.forEach((resource) => appendInsomniaMcpClient(mcpClients, resource, 'insomnia-v4', warnings));
  const mcpWorkspaceIds = new Set([
    ...workspaces.filter((workspace) => workspace.scope === 'mcp').map((workspace) => asString(workspace._id)),
    ...mcpResources.map((resource) => asString(resource.parentId)).filter(Boolean),
  ]);
  const ordinaryRequestTypes = new Set(['request', 'websocket_request', 'grpc_request', 'socketio_request']);
  const collectionWorkspaces = workspaces.filter((workspace) => {
    const workspaceId = asString(workspace._id);
    if (workspace.scope === 'mcp') return false;
    if (!mcpWorkspaceIds.has(workspaceId)) return true;
    return resources.some((resource) => resource.parentId === workspaceId && (ordinaryRequestTypes.has(asString(resource._type)) || resource._type === 'request_group'));
  });
  if (!workspaces.length && !mcpResources.length) collectionWorkspaces.push({ _id: '__WORKSPACE_ID__', name: sourceName });
  const collections: Collection[] = [];
  const environments: Environment[] = [];
  const environmentFingerprints = new Set<string>();
  const mockServers: MockServer[] = [];
  const testSuites: UnitTestSuite[] = [];
  const cookieMap = new Map<string, CookieRecord>();
  resources.filter((resource) => resource._type === 'cookie_jar').flatMap((resource) => asArray(resource.cookies)).forEach((cookie, index) => {
    const mapped = insomniaCookie(cookie, 'insomnia-v4', index);
    if (mapped) cookieMap.set(`${mapped.name}\n${mapped.domain}\n${mapped.path}`, mapped);
  });
  const cookies = [...cookieMap.values()];
  mcpWorkspaceIds.forEach((workspaceId) => appendUniqueEnvironmentTree(environments, v4Environments(resources, workspaceId, 'insomnia-v4'), environmentFingerprints));

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
    const rawRequests = resources.filter((resource) => ordinaryRequestTypes.has(asString(resource._type)))
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
      });
    const requests = rawRequests.map((resource, requestIndex) => {
        const request = mapInsomniaRequest({ ...resource, payload: socketIoPayloads.get(asString(resource._id)) ?? resource.payload }, 'insomnia-v4', requestIndex, [], { headers: [], preRequestScript: '', tests: '' }, warnings, workspaceId);
        if (request.protocol === 'grpc' && !asBoolean(asRecord(resource.reflectionApi)?.enabled)) {
          const protoFileId = asString(resource.protoFileId);
          if (protoFileId) {
            const tree = v4ProtoTree(protoFileId, workspaceId, protoFiles, protoDirectories, warnings, request.name);
            if (tree) request.grpc = { ...request.grpc, ...tree, descriptorSource: 'proto' };
          }
        }
        request.folderId = folderIds.get(asString(resource.parentId)) ?? '';
        request.inheritFolderAuth = Boolean(request.folderId) && !resource.authentication;
        return request;
      });
    const requestIds = new Map(rawRequests.map((request, index) => [asString(request._id), requests[index].id]));
    const orderableIds = new Set([...folderIds.keys(), ...requestIds.keys()]);
    const orderableResources = resources.filter((resource) => orderableIds.has(asString(resource._id)));
    const resourceOrder: string[] = [];
    const appendResourceOrder = (parentId: string, visited: Set<string>) => {
      const children = byDeclaredSortKey(orderableResources.filter((resource) => asString(resource.parentId) === parentId), (resource) => resource.metaSortKey);
      children.forEach((resource) => {
        const sourceResourceId = asString(resource._id);
        if (visited.has(sourceResourceId)) return;
        visited.add(sourceResourceId);
        const mappedId = folderIds.get(sourceResourceId) ?? requestIds.get(sourceResourceId);
        if (mappedId) resourceOrder.push(mappedId);
        if (folderIds.has(sourceResourceId)) appendResourceOrder(sourceResourceId, visited);
      });
    };
    appendResourceOrder(workspaceId, new Set());
    const collectionEnvironments = v4Environments(resources, workspaceId, 'insomnia-v4');
    const collectionId = sourceId('collection', 'insomnia-v4', workspaceId, workspaceIndex);
    collections.push({ id: collectionId, name: asString(workspace.name, `Workspace ${workspaceIndex + 1}`), expanded: true, requests, folders: requestFolders, resourceOrder, ...collectionEnvironmentFields(collectionEnvironments), documentation: asString(workspace.description), source: sourceMetadata('insomnia-v4', workspaceId, { description: workspace.description }) });
    byDeclaredSortKey(resources.filter((resource) => resource._type === 'unit_test_suite' && resource.parentId === workspaceId), (resource) => resource.metaSortKey).forEach((suite, suiteIndex) => {
      const suiteSourceId = asString(suite._id, `${workspaceId}-suite-${suiteIndex}`);
      const tests = byDeclaredSortKey(resources.filter((resource) => resource._type === 'unit_test' && resource.parentId === suiteSourceId), (resource) => resource.metaSortKey).map((test, testIndex) => ({
        id: sourceId('unit-test', 'insomnia-v4', `${workspaceId}:${suiteSourceId}:${asString(test._id, String(testIndex))}`, testIndex),
        name: asString(test.name, `Test ${testIndex + 1}`),
        code: asString(test.code),
        requestId: requestIds.get(asString(test.requestId)) ?? null,
        sortKey: asNumber(test.metaSortKey, testIndex),
      }));
      testSuites.push({ id: sourceId('test-suite', 'insomnia-v4', `${workspaceId}:${suiteSourceId}`, suiteIndex), name: asString(suite.name, `Suite ${suiteIndex + 1}`), collectionId, sortKey: asNumber(suite.metaSortKey, suiteIndex), tests });
    });
    mockServers.push(...v4Mocks(resources, workspaceId));
  }

  const apiDesigns: ApiDesign[] = resources.filter((resource) => ['api_spec', 'api_specification'].includes(asString(resource._type))).map((resource, index) => ({
    id: sourceId('design', 'insomnia-v4', asString(resource._id), index),
    name: asString(resource.name, `API specification ${index + 1}`),
    contents: typeof resource.contents === 'string' ? resource.contents : stringify(resource.contents ?? {}),
    source: sourceMetadata('insomnia-v4', resource._id),
  }));
  if (!collections.some((collection) => collection.requests.length) && !apiDesigns.length && !environments.length && !mcpClients.length) warnings.push({ code: 'empty-export', message: 'The Insomnia v4 export contained no supported request, environment, design, or MCP resources.' });
  return {
    ...emptyResources(), format: 'insomnia-v4', sourceName, warnings,
    metadata: { source: asString(document.__export_source), date: asString(document.__export_date), resources: String(resources.length) },
    collections, environments, apiDesigns, mockServers, cookies, testSuites, mcpClients,
  };
};

const nestedV5Requests = (
  children: unknown,
  parentId: string,
  warnings: ImportWarning[],
  mcpClients: McpClient[],
  output: ApiRequest[],
  folders: RequestFolder[],
  resourceOrder: string[],
  identityPrefix: string,
) => {
  const rawChildren = asArray(children).map(asRecord).filter((child): child is UnknownRecord => Boolean(child));
  const orderedChildren = byDeclaredSortKey(rawChildren, (child) => asRecord(child.meta)?.sortKey);
  for (const child of orderedChildren) {
    if (isInsomniaMcpRequest(child)) {
      appendInsomniaMcpClient(mcpClients, child, 'insomnia-v5', warnings);
      continue;
    }
    if (Array.isArray(child.children)) {
      const meta = asRecord(child.meta);
      const folderId = sourceId('folder', 'insomnia-v5', `${identityPrefix}:${asString(meta?.id, `${parentId}:${folders.length}`)}`, folders.length);
      folders.push({ ...folderConfig(child, 'insomnia-v5', folderId, folders.length, warnings), parentId });
      resourceOrder.push(folderId);
      nestedV5Requests(child.children, folderId, warnings, mcpClients, output, folders, resourceOrder, identityPrefix);
    } else {
      const request = mapInsomniaRequest(child, 'insomnia-v5', output.length, [], { headers: [], preRequestScript: '', tests: '' }, warnings, identityPrefix);
      const protoFileId = asString(child.protoFileId);
      if (request.protocol === 'grpc' && protoFileId && request.grpc.descriptorSource !== 'buf') {
        warnings.push({ code: 'external-schema', message: `Insomnia v5 references proto file '${protoFileId}' by database ID without embedding its contents; import the proto source separately.`, resource: request.name });
        request.source = { ...request.source!, unsupported: { ...(request.source?.unsupported ?? {}), protoFileId } };
      }
      request.folderId = parentId;
      request.inheritFolderAuth = Boolean(parentId) && !child.authentication;
      output.push(request);
      resourceOrder.push(request.id);
    }
  }
};

const v5Environments = (document: UnknownRecord, prefix: string): Environment[] => {
  const root = asRecord(document.environments);
  if (!root) return [];
  const environments: Environment[] = [{
    id: sourceId('environment', 'insomnia-v5', asString(asRecord(root.meta)?.id, `${prefix}-base`)),
    name: asString(root.name, 'Base Environment'), variables: objectVariables(withoutInsomniaVaultData(root.data), `${prefix}-base`), environmentEditorMode: 'raw', source: sourceMetadata('insomnia-v5', asRecord(root.meta)?.id),
  }];
  const baseId = environments[0].id;
  asArray(root.subEnvironments).map(asRecord).filter((environment): environment is UnknownRecord => Boolean(environment)).forEach((environment, index) => {
    environments.push({ id: sourceId('environment', 'insomnia-v5', asString(asRecord(environment.meta)?.id, `${prefix}-${index}`)), name: asString(environment.name, `Environment ${index + 1}`), variables: objectVariables(withoutInsomniaVaultData(environment.data), `${prefix}-${index}`), environmentEditorMode: 'raw', parentId: baseId, source: sourceMetadata('insomnia-v5', asRecord(environment.meta)?.id) });
  });
  return environments;
};

export const isInsomniaV5 = (document: UnknownRecord) => /^(?:(?:collection|spec|mock|environment)\.insomnia\.rest|mcpClient\.insomnia)\/5\.0$/.test(asString(document.type));

export const importInsomniaV5 = (sourceName: string, documents: UnknownRecord[]): ArtifactImport => {
  const warnings: ImportWarning[] = [];
  const collections: Collection[] = [];
  const environments: Environment[] = [];
  const environmentFingerprints = new Set<string>();
  const apiDesigns: ApiDesign[] = [];
  const mockServers: MockServer[] = [];
  const cookies: CookieRecord[] = [];
  const testSuites: UnitTestSuite[] = [];
  const mcpClients: McpClient[] = [];
  for (const [documentIndex, document] of documents.entries()) {
    const type = asString(document.type);
    const meta = asRecord(document.meta);
    const identity = asString(meta?.id, `${sourceName}-${documentIndex}`);
    const environmentRoot = asRecord(document.environments);
    if (environmentRoot && [environmentRoot, ...asArray(environmentRoot.subEnvironments).map(asRecord).filter((environment): environment is UnknownRecord => Boolean(environment))].some(hasInsomniaEnvironmentSecrets) && !warnings.some((warning) => warning.code === 'environment-secrets-omitted')) {
      warnings.push({ code: 'environment-secrets-omitted', message: 'Encrypted Insomnia Secret environment rows were omitted because their account vault key is not portable. Recreate them in an unlocked private Brunomnia environment.' });
    }
    if (type.startsWith('collection.') || type.startsWith('spec.')) {
      asArray(asRecord(document.cookieJar)?.cookies).forEach((cookie, index) => {
        const mapped = insomniaCookie(cookie, 'insomnia-v5', cookies.length + index);
        if (mapped && !cookies.some((current) => current.name === mapped.name && current.domain === mapped.domain && current.path === mapped.path)) cookies.push(mapped);
      });
      const requests: ApiRequest[] = [];
      const folders: RequestFolder[] = [];
      const resourceOrder: string[] = [];
      nestedV5Requests(document.collection, '', warnings, mcpClients, requests, folders, resourceOrder, identity);
      const name = asString(document.name, `Collection ${documentIndex + 1}`);
      const collectionEnvironments = v5Environments(document, identity);
      const collectionId = sourceId('collection', 'insomnia-v5', identity);
      collections.push({ id: collectionId, name, expanded: true, requests, folders, resourceOrder, ...collectionEnvironmentFields(collectionEnvironments), documentation: asString(meta?.description), source: sourceMetadata('insomnia-v5', identity, { schemaVersion: document.schema_version }) });
      const requestIds = new Map(requests.flatMap((request) => {
        const sourceRequestId = request.source?.sourceId;
        if (!sourceRequestId) return [];
        const unscopedRequestId = sourceRequestId.startsWith(`${identity}:`) ? sourceRequestId.slice(identity.length + 1) : sourceRequestId;
        return [[sourceRequestId, request.id] as const, [unscopedRequestId, request.id] as const];
      }));
      if (type.startsWith('spec.')) asArray(document.testSuites).map(asRecord).filter((suite): suite is UnknownRecord => Boolean(suite)).forEach((suite, suiteIndex) => {
        const suiteMeta = asRecord(suite.meta);
        const suiteSourceId = asString(suiteMeta?.id, `${identity}-suite-${suiteIndex}`);
        const tests = asArray(suite.tests).map(asRecord).filter((test): test is UnknownRecord => Boolean(test)).map((test, testIndex) => {
          const testMeta = asRecord(test.meta);
          return {
            id: sourceId('unit-test', 'insomnia-v5', `${identity}:${suiteSourceId}:${asString(testMeta?.id, String(testIndex))}`, testIndex),
            name: asString(test.name, `Test ${testIndex + 1}`),
            code: asString(test.code),
            requestId: requestIds.get(asString(test.requestId)) ?? null,
            sortKey: asNumber(testMeta?.sortKey, testIndex),
          };
        }).sort((left, right) => left.sortKey - right.sortKey);
        testSuites.push({ id: sourceId('test-suite', 'insomnia-v5', `${identity}:${suiteSourceId}`, suiteIndex), name: asString(suite.name, `Suite ${suiteIndex + 1}`), collectionId, sortKey: asNumber(suiteMeta?.sortKey, suiteIndex), tests });
      });
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
    } else if (type.startsWith('environment.')) appendUniqueEnvironmentTree(environments, v5Environments(document, identity), environmentFingerprints);
    else if (type.startsWith('mcpClient.')) {
      const mcpRequest = asRecord(document.mcpRequest) ?? {};
      appendInsomniaMcpClient(mcpClients, { ...mcpRequest, name: asString(mcpRequest.name, asString(document.name, `MCP Client ${documentIndex + 1}`)) }, 'insomnia-v5', warnings);
      appendUniqueEnvironmentTree(environments, v5Environments(document, identity), environmentFingerprints);
    }
  }
  if (!collections.length && !environments.length && !mockServers.length && !mcpClients.length) warnings.push({ code: 'empty-export', message: 'The Insomnia v5 file contained no supported resources.' });
  return { ...emptyResources(), format: 'insomnia-v5', sourceName, warnings, metadata: { documents: String(documents.length), schemaVersions: [...new Set(documents.map((document) => asString(document.schema_version)).filter(Boolean))].join(', ') }, collections, environments, apiDesigns, mockServers, cookies, testSuites, mcpClients };
};
