import type { ApiRequest, Collection, Environment, ImportWarning, JsonValue, KeyValue } from '../../types';
import { asArray, asBoolean, asRecord, asString, fileStem, keyValues, normalizeMethod, requestFrom, sourceId, sourceMetadata, stripQuery, toJsonValue, type UnknownRecord } from './common';
import { emptyResources, type ArtifactImport } from './types';

const postmanFormat = 'postman-2' as const;

const scriptText = (event: UnknownRecord) => {
  const script = asRecord(event.script);
  const exec = script?.exec;
  return Array.isArray(exec) ? exec.map((line) => asString(line)).join('\n') : asString(exec);
};

const translatePostmanScript = (source: string) => source
  .replace(/\bpm\.test\s*\(/g, 'insomnia.test(')
  .replace(/pm\.response\.to\.have\.status\s*\(([^)]+)\)\s*;?/g, 'insomnia.expect(insomnia.response.status).toBe($1);')
  .replace(/\bpm\.environment\./g, 'insomnia.environment.')
  .replace(/\bpm\.collectionVariables\./g, 'insomnia.collectionVariables.')
  .replace(/\bpm\.globals\./g, 'insomnia.globals.')
  .replace(/\bpm\.variables\./g, 'insomnia.variables.')
  .replace(/\bpm\.iterationData\./g, 'insomnia.iterationData.')
  .replace(/\bpm\.vault\./g, 'insomnia.vault.')
  .replace(/\bpm\.sendRequest\s*\(/g, 'insomnia.sendRequest(')
  .replace(/\bpm\.response\.code\b/g, 'insomnia.response.status')
  .replace(/\bpm\.response\.responseTime\b/g, 'insomnia.response.responseTime')
  .replace(/\bpm\.response\.json\s*\(\s*\)/g, 'insomnia.response.json()')
  .replace(/\bpm\.request\.headers\.add\s*\(/g, 'insomnia.request.addHeader(')
  .replace(/\bpm\.request\.headers\.remove\s*\(/g, 'insomnia.request.removeHeader(')
  .replace(/\bpm\.request\.headers\.get\s*\(/g, 'insomnia.request.getHeader(')
  .replace(/\bpm\.request\.headers\.has\s*\(/g, 'insomnia.request.hasHeader(')
  .replace(/\bpm\.response\./g, 'insomnia.response.')
  .replace(/\bpm\.request\./g, 'insomnia.request.')
  .replace(/\bpm\.expect\s*\(/g, 'insomnia.expect(');

const eventsScript = (eventSources: unknown[], listen: 'prerequest' | 'test', warnings: ImportWarning[], resource: string) => {
  const scripts = eventSources.flatMap((source) => asArray(source)).map(asRecord)
    .filter((event): event is UnknownRecord => Boolean(event) && event?.listen === listen)
    .map(scriptText).filter(Boolean);
  if (!scripts.length) return '';
  warnings.push({ code: 'script-translated', message: `Postman ${listen} script syntax was translated where possible; review unsupported pm APIs.`, resource });
  return translatePostmanScript(scripts.join('\n\n'));
};

const postmanUrl = (value: unknown) => {
  if (typeof value === 'string') return value;
  const url = asRecord(value);
  if (!url) return '';
  if (typeof url.raw === 'string') return url.raw;
  const protocol = asString(url.protocol, 'https');
  const host = Array.isArray(url.host) ? url.host.map((value) => asString(value)).join('.') : asString(url.host);
  const path = Array.isArray(url.path) ? url.path.map((value) => asString(value)).join('/') : asString(url.path);
  return `${protocol}://${host}${path ? `/${path}` : ''}`;
};

const postmanHeaders = (value: unknown, prefix: string): KeyValue[] => {
  if (typeof value === 'string') {
    return value.split(/\r?\n/).flatMap((line, index) => {
      const separator = line.indexOf(':');
      if (separator < 0) return [];
      return [{ id: `${prefix}-${index}`, name: line.slice(0, separator).trim(), value: line.slice(separator + 1).trim(), enabled: true }];
    });
  }
  return keyValues(value, prefix, { name: 'key' });
};

const authProperty = (auth: UnknownRecord, type: string, key: string) => {
  const items = asArray(auth[type]).map(asRecord);
  return asString(items.find((item) => item?.key === key)?.value);
};

const postmanSignatureMethod = (value: string): ApiRequest['auth']['oauth1SignatureMethod'] => {
  const normalized = value.toUpperCase().replace(/_/g, '-');
  return ['HMAC-SHA1', 'HMAC-SHA256', 'RSA-SHA1', 'PLAINTEXT'].includes(normalized) ? normalized as ApiRequest['auth']['oauth1SignatureMethod'] : 'HMAC-SHA1';
};

const applyPostmanAuth = (request: ApiRequest, rawAuth: unknown, warnings: ImportWarning[]) => {
  const auth = asRecord(rawAuth);
  const type = asString(auth?.type);
  if (!auth || !type || type === 'noauth') return;
  if (type === 'basic') {
    request.auth = { ...request.auth, type: 'basic', username: authProperty(auth, type, 'username'), password: authProperty(auth, type, 'password') };
  } else if (type === 'bearer') {
    request.auth = { ...request.auth, type: 'bearer', token: authProperty(auth, type, 'token') };
  } else if (type === 'apikey') {
    const location = authProperty(auth, type, 'in');
    request.auth = {
      ...request.auth,
      type: 'api-key',
      apiKeyName: authProperty(auth, type, 'key') || 'X-API-Key',
      apiKeyValue: authProperty(auth, type, 'value'),
      apiKeyLocation: location === 'query' || location === 'queryParams' ? 'query' : 'header',
    };
  } else if (type === 'digest') {
    request.auth = { ...request.auth, type: 'digest', username: authProperty(auth, type, 'username'), password: authProperty(auth, type, 'password') };
  } else if (type === 'oauth1') {
    request.auth = { ...request.auth, type: 'oauth1', consumerKey: authProperty(auth, type, 'consumerKey'), consumerSecret: authProperty(auth, type, 'consumerSecret'), tokenKey: authProperty(auth, type, 'token'), tokenSecret: authProperty(auth, type, 'tokenSecret'), oauth1SignatureMethod: postmanSignatureMethod(authProperty(auth, type, 'signatureMethod')), realm: authProperty(auth, type, 'realm'), version: authProperty(auth, type, 'version') || '1.0', nonce: authProperty(auth, type, 'nonce'), timestamp: authProperty(auth, type, 'timestamp'), verifier: authProperty(auth, type, 'verifier'), callback: authProperty(auth, type, 'callback') };
  } else if (type === 'oauth2') {
    request.auth = { ...request.auth, type: 'oauth2', accessToken: authProperty(auth, type, 'accessToken'), tokenPrefix: authProperty(auth, type, 'headerPrefix') || authProperty(auth, type, 'tokenType') || 'Bearer' };
  } else if (type === 'ntlm') {
    request.auth = { ...request.auth, type: 'ntlm', username: authProperty(auth, type, 'username'), password: authProperty(auth, type, 'password'), ntlmDomain: authProperty(auth, type, 'domain'), ntlmWorkstation: authProperty(auth, type, 'workstation') || request.auth.ntlmWorkstation };
  } else if (type === 'hawk') {
    request.auth = { ...request.auth, type: 'hawk', hawkId: authProperty(auth, type, 'authId'), hawkKey: authProperty(auth, type, 'authKey'), hawkExt: authProperty(auth, type, 'ext'), hawkAlgorithm: authProperty(auth, type, 'algorithm').toLowerCase() === 'sha1' ? 'sha1' : 'sha256' };
  } else if (type === 'awsv4') {
    request.auth = { ...request.auth, type: 'iam', awsAccessKeyId: authProperty(auth, type, 'accessKey'), awsSecretAccessKey: authProperty(auth, type, 'secretKey'), awsSessionToken: authProperty(auth, type, 'sessionToken'), awsRegion: authProperty(auth, type, 'region') || 'us-east-1', awsService: authProperty(auth, type, 'service') || 'execute-api' };
  } else {
    request.source = sourceMetadata(postmanFormat, request.source?.sourceId, { authentication: auth });
    warnings.push({ code: 'unsupported-auth', message: `Postman authentication '${type}' was preserved as source metadata.`, resource: request.name });
  }
};

const addContentType = (request: ApiRequest, value: string) => {
  if (!value || request.headers.some((header) => header.name.toLowerCase() === 'content-type')) return;
  request.headers.push({ id: `${request.id}-content-type`, name: 'Content-Type', value, enabled: true });
};

const applyPostmanBody = (request: ApiRequest, rawBody: unknown, warnings: ImportWarning[]) => {
  const body = asRecord(rawBody);
  const mode = asString(body?.mode);
  if (!body || !mode) { request.bodyMode = 'none'; return; }
  if (mode === 'raw') {
    request.body = asString(body.raw);
    const language = asString(asRecord(asRecord(body.options)?.raw)?.language);
    request.bodyMode = language === 'json' || /^\s*[\[{]/.test(request.body) ? 'json' : 'text';
    addContentType(request, request.bodyMode === 'json' ? 'application/json' : 'text/plain');
  } else if (mode === 'urlencoded') {
    request.bodyMode = 'form-urlencoded';
    request.formBody = keyValues(body.urlencoded, `${request.id}-form`, { name: 'key' });
    addContentType(request, 'application/x-www-form-urlencoded');
  } else if (mode === 'formdata') {
    request.bodyMode = 'multipart';
    request.multipartBody = asArray(body.formdata).flatMap((entry, index) => {
      const item = asRecord(entry);
      if (!item) return [];
      const file = item.type === 'file';
      if (file) warnings.push({ code: 'external-file', message: 'Postman file references require re-selecting the local file.', resource: request.name });
      return [{ id: `${request.id}-part-${index}`, name: asString(item.key), value: asString(item.value), enabled: !asBoolean(item.disabled), description: asString(item.description), kind: file ? 'file' as const : 'text' as const, multiline: asString(item.value).includes('\n'), fileName: asString(item.src), contentType: asString(item.contentType) }];
    });
    addContentType(request, 'multipart/form-data');
  } else if (mode === 'graphql') {
    const graphql = asRecord(body.graphql);
    request.protocol = 'graphql';
    request.method = 'POST';
    request.graphql = {
      ...request.graphql,
      query: asString(graphql?.query),
      variables: typeof graphql?.variables === 'string' ? graphql.variables : JSON.stringify(graphql?.variables ?? {}, null, 2),
      operationName: '',
    };
    request.bodyMode = 'none';
    addContentType(request, 'application/json');
  } else if (mode === 'file') {
    request.bodyMode = 'binary';
    request.source = sourceMetadata(postmanFormat, request.source?.sourceId, { file: body.file });
    warnings.push({ code: 'external-file', message: 'Postman binary file references require re-selecting the local file.', resource: request.name });
  } else {
    request.source = sourceMetadata(postmanFormat, request.source?.sourceId, { body });
    warnings.push({ code: 'unsupported-body', message: `Postman body mode '${mode}' was preserved as source metadata.`, resource: request.name });
  }
};

const postmanRequest = (
  item: UnknownRecord,
  path: string[],
  inheritedEvents: unknown[],
  inheritedAuth: unknown,
  warnings: ImportWarning[],
  index: number,
): ApiRequest | undefined => {
  if (typeof item.request === 'string') {
    warnings.push({ code: 'request-reference', message: 'A string request reference could not be expanded.', resource: asString(item.name) });
    return undefined;
  }
  const raw = asRecord(item.request);
  if (!raw) return undefined;
  const identity = asString(item.id, `${path.join('/')}/${asString(item.name)}/${index}`);
  const request = requestFrom(postmanFormat, identity, index);
  request.name = [...path, asString(item.name, `Request ${index + 1}`)].join(' / ');
  request.method = normalizeMethod(raw.method, warnings, request.name);
  const url = asRecord(raw.url);
  const importedUrl = postmanUrl(raw.url);
  request.url = (Array.isArray(url?.query) ? stripQuery(importedUrl) : importedUrl).replace(/:([A-Za-z_][\w-]*)/g, '{$1}');
  request.pathParams = keyValues(url?.variable, `${request.id}-path`, { name: 'key' });
  request.params = keyValues(url?.query, `${request.id}-query`, { name: 'key' });
  request.headers = postmanHeaders(raw.header, `${request.id}-header`);
  applyPostmanBody(request, raw.body, warnings);
  applyPostmanAuth(request, raw.auth ?? inheritedAuth, warnings);
  const events = [...inheritedEvents, item.event];
  request.preRequestScript = eventsScript(events, 'prerequest', warnings, request.name);
  request.tests = eventsScript(events, 'test', warnings, request.name);
  const unsupported: Record<string, JsonValue> = { ...(request.source?.unsupported ?? {}) };
  if (item.response) unsupported.savedResponses = toJsonValue(item.response);
  if (raw.protocolProfileBehavior) unsupported.protocolProfileBehavior = toJsonValue(raw.protocolProfileBehavior);
  request.source = {
    ...(request.source ?? sourceMetadata(postmanFormat, identity)),
    unsupported,
  };
  return request;
};

const walkPostmanItems = (
  items: unknown,
  path: string[],
  inheritedEvents: unknown[],
  inheritedAuth: unknown,
  warnings: ImportWarning[],
  output: ApiRequest[],
) => {
  for (const rawItem of asArray(items)) {
    const item = asRecord(rawItem);
    if (!item) continue;
    if (Array.isArray(item.item)) {
      walkPostmanItems(item.item, [...path, asString(item.name, 'Folder')], [...inheritedEvents, item.event], item.auth ?? inheritedAuth, warnings, output);
    } else {
      const request = postmanRequest(item, path, inheritedEvents, inheritedAuth, warnings, output.length);
      if (request) output.push(request);
    }
  }
};

export const isPostmanCollection = (document: UnknownRecord) => asString(asRecord(document.info)?.schema).includes('postman') && Array.isArray(document.item);

export const importPostman = (sourceName: string, document: UnknownRecord): ArtifactImport => {
  const warnings: ImportWarning[] = [];
  const info = asRecord(document.info);
  const name = asString(info?.name, fileStem(sourceName));
  const requests: ApiRequest[] = [];
  walkPostmanItems(document.item, [], [document.event], document.auth, warnings, requests);
  const variables = keyValues(document.variable, 'postman-variable', { name: 'key' });
  const collection: Collection = {
    id: sourceId('collection', postmanFormat, asString(info?._postman_id, sourceName)),
    name,
    expanded: true,
    requests,
    environment: variables,
    source: sourceMetadata(postmanFormat, info?._postman_id, { schema: info?.schema }),
  };
  return {
    ...emptyResources(), format: postmanFormat, sourceName, warnings,
    metadata: { title: name, schema: asString(info?.schema), requests: String(requests.length) },
    collections: [collection],
  };
};

export const isPostmanEnvironment = (document: UnknownRecord) => document._postman_variable_scope === 'environment' || (Array.isArray(document.values) && typeof document.name === 'string' && '_postman_exported_at' in document);

export const importPostmanEnvironment = (sourceName: string, document: UnknownRecord): ArtifactImport => {
  const name = asString(document.name, fileStem(sourceName));
  const variables = asArray(document.values).flatMap((entry, index) => {
    const item = asRecord(entry);
    if (!item) return [];
    return [{ id: `postman-env-${index}`, name: asString(item.key), value: asString(item.value), enabled: item.enabled !== false }];
  });
  const environment: Environment = { id: sourceId('environment', 'postman-environment', asString(document.id, sourceName)), name, variables, source: sourceMetadata('postman-environment', document.id) };
  return { ...emptyResources(), format: 'postman-environment', sourceName, warnings: [], metadata: { title: name, variables: String(variables.length) }, environments: [environment] };
};
