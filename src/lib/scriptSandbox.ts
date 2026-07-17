import { createBlankRequest } from '../data/seed';
import type { ApiRequest, CookieRecord, FilePayload, HttpResponse, KeyValue, ScriptRunResult, StoredResponse } from '../types';
import { storeResponseCookies } from './cookies';
import { createScriptModules } from './scriptModules';

export type ScriptFolderState = { id: string; name: string; environment: Record<string, string>; disabled?: string[] };

export type ScriptFileReference = {
  kind: 'body' | 'multipart' | 'certificate-cert' | 'certificate-key';
  path: string;
  partId?: string;
  fileName?: string;
  contentType?: string;
};

export type ScriptRunOptions = {
  baseGlobals?: Record<string, string>;
  baseGlobalDisabled?: string[];
  globalDisabled?: string[];
  globalsAreBase?: boolean;
  baseEnvironment?: Record<string, string>;
  baseEnvironmentDisabled?: string[];
  collectionVariables?: Record<string, string>;
  collectionDisabled?: string[];
  collectionVariablesAreBase?: boolean;
  folders?: ScriptFolderState[];
  vault?: Record<string, string>;
  sendRequest?: (request: ApiRequest, variables: Record<string, string>) => Promise<HttpResponse>;
  maxSubrequests?: number;
  maxSubrequestBytes?: number;
  readFile?: (path: string) => Promise<FilePayload>;
};

type WorkerOutput = {
  type: 'result';
  ok: boolean;
  error?: string;
  request: ApiRequest;
  environment: Record<string, string>;
  baseGlobals: Record<string, string>;
  baseGlobalDisabled: string[];
  globalDisabled: string[];
  collectionVariables: Record<string, string>;
  baseEnvironment: Record<string, string>;
  baseEnvironmentDisabled: string[];
  collectionDisabled: string[];
  folders: ScriptFolderState[];
  logs: string[];
  tests: ScriptRunResult['tests'];
  localVariables: Record<string, string>;
  fileReferences: ScriptFileReference[];
};

type WorkerSubrequest = {
  type: 'subrequest';
  id: string;
  input: unknown;
  variables: Record<string, string>;
};

export const applyScriptSubresponse = (
  cookies: CookieRecord[],
  responses: StoredResponse[],
  request: ApiRequest,
  response: HttpResponse,
  receivedAt = new Date().toISOString(),
): { cookies: CookieRecord[]; responses: StoredResponse[] } => {
  const requestUrl = response.requestUrl ?? request.url;
  const nextCookies = request.transport.storeCookies ? storeResponseCookies(cookies, requestUrl, response.setCookies ?? []) : cookies;
  const stored: StoredResponse = { ...response, requestId: request.id, requestName: request.name, requestUrl, receivedAt };
  return { cookies: nextCookies, responses: [stored, ...responses].slice(0, 100) };
};

const payloadBytes = (payload: FilePayload) => Math.floor(payload.dataBase64.length * 3 / 4) - (payload.dataBase64.endsWith('==') ? 2 : payload.dataBase64.endsWith('=') ? 1 : 0);
const payloadText = (payload: FilePayload) => {
  try {
    const bytes = Uint8Array.from(atob(payload.dataBase64), (character) => character.charCodeAt(0));
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new Error(`Script certificate file '${payload.fileName}' is not valid UTF-8 PEM text.`);
  }
};

export const hydrateScriptFileReferences = async (
  request: ApiRequest,
  references: ScriptFileReference[],
  readFile?: (path: string) => Promise<FilePayload>,
): Promise<ApiRequest> => {
  if (!references.length) return request;
  if (!readFile) throw new Error('Script file access is disabled. Enable it in Preferences.');
  if (references.length > 20) throw new Error('Script request exceeds the 20-file attachment limit.');
  let totalBytes = 0;
  for (const reference of references) {
    const payload = await readFile(reference.path);
    const bytes = payloadBytes(payload);
    if (bytes < 0 || bytes > 5_000_000) throw new Error(`Script file '${payload.fileName}' exceeds the 5 MB per-file limit.`);
    totalBytes += bytes;
    if (totalBytes > 20_000_000) throw new Error('Script request files exceed the 20 MB aggregate limit.');
    if (reference.kind === 'body') {
      request.bodyMode = 'binary';
      request.binaryBody = payload;
    } else if (reference.kind === 'multipart') {
      const part = request.multipartBody.find((candidate) => candidate.id === reference.partId);
      if (!part) throw new Error(`Script multipart file target '${reference.partId}' was not found.`);
      part.kind = 'file';
      part.file = payload;
      part.fileName = reference.fileName || payload.fileName;
      part.contentType = reference.contentType || payload.mimeType;
    } else if (reference.kind === 'certificate-cert') {
      request.transport.clientCertificatePem = payloadText(payload);
    } else {
      request.transport.clientKeyPem = payloadText(payload);
    }
  }
  return request;
};

const record = (value: unknown): Record<string, unknown> | undefined => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
const stringValue = (value: unknown, fallback = '') => typeof value === 'string' ? value : value === undefined || value === null ? fallback : String(value);
const scriptRow = (value: unknown, index: number, prefix: string): KeyValue | undefined => {
  const source = record(value);
  if (!source) return undefined;
  const name = stringValue(source.key ?? source.name).trim();
  if (!name) return undefined;
  return { id: `${prefix}-${index}`, name, value: stringValue(source.value), enabled: source.enabled !== false, description: stringValue(source.description) };
};

const scriptHeaders = (value: unknown): KeyValue[] => {
  if (Array.isArray(value)) return value.map((item, index) => scriptRow(item, index, 'script-header')).filter((item): item is KeyValue => Boolean(item));
  const source = record(value);
  return source ? Object.entries(source).flatMap(([name, item], index) => {
    const values = Array.isArray(item) ? item : [item];
    return values.map((entry, offset) => ({ id: `script-header-${index}-${offset}`, name, value: stringValue(entry), enabled: true }));
  }) : [];
};

const assertHttpUrl = (value: unknown): string => {
  const url = stringValue(value).trim();
  let parsed: URL;
  try { parsed = new URL(url); } catch {
    if (!/^[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?(?::\d+)?(?:\/|$)/.test(url)) throw new Error('Script requests require an HTTP(S) URL or bare hostname.');
    try { parsed = new URL(`https://${url}`); } catch { throw new Error('Script requests require an HTTP(S) URL or bare hostname.'); }
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('Script requests are limited to http:// and https:// URLs.');
  return parsed.toString();
};

/** Converts the documented Insomnia sendRequest input into a bounded Brunomnia request. */
export const normalizeScriptSubrequest = (input: unknown, sourceRequest: ApiRequest): ApiRequest => {
  const serialized = JSON.stringify(input);
  if (serialized && new Blob([serialized]).size > 256_000) throw new Error('Script request input exceeds the 256 KB bridge limit.');
  const source = typeof input === 'string' ? { url: input } : record(input);
  if (!source) throw new Error('Script requests must be a URL string or request object.');
  const request = createBlankRequest('Script request');
  request.id = `script-request-${crypto.randomUUID()}`;
  request.url = assertHttpUrl(source.url);
  request.method = stringValue(source.method, 'GET').trim().toUpperCase() || 'GET';
  if (!/^[A-Z][A-Z0-9!#$%&'*+.^_`|~-]{0,31}$/.test(request.method)) throw new Error('Script request method is not a valid HTTP token.');
  request.headers = scriptHeaders(source.header ?? source.headers);
  request.transport = { ...sourceRequest.transport, timeoutMs: Math.min(10_000, Math.max(1_000, sourceRequest.transport.timeoutMs)) };
  request.preRequestScript = '';
  request.tests = '';
  const auth = record(source.auth);
  if (auth) {
    const type = stringValue(auth.type, 'none').toLowerCase();
    const keyed = (name: string, key: string, fallback: unknown) => Array.isArray(auth[name]) ? record((auth[name] as unknown[]).find((item) => record(item)?.key === key))?.value ?? fallback : fallback;
    request.auth.disabled = false;
    if (type === 'basic') { request.auth.type = 'basic'; request.auth.username = stringValue(keyed('basic', 'username', auth.username)); request.auth.password = stringValue(keyed('basic', 'password', auth.password)); }
    else if (type === 'bearer') { request.auth.type = 'bearer'; request.auth.token = stringValue(keyed('bearer', 'token', auth.token ?? auth.accessToken)); request.auth.prefix = stringValue(keyed('bearer', 'prefix', auth.prefix), 'Bearer'); }
    else if (type === 'apikey' || type === 'api-key') { request.auth.type = 'api-key'; request.auth.apiKeyName = stringValue(keyed('apikey', 'key', auth.key ?? auth.name)); request.auth.apiKeyValue = stringValue(keyed('apikey', 'value', auth.value)); const location = keyed('apikey', 'in', auth.in ?? auth.location); request.auth.apiKeyLocation = location === 'query' ? 'query' : 'header'; }
    else if (type !== 'none' && type !== 'noauth') throw new Error(`Script request auth type '${type}' is not supported.`);
  }
  const proxy = record(source.proxy);
  if (proxy) {
    if (proxy.url) request.transport.proxyUrl = stringValue(proxy.url);
    else if (proxy.host) request.transport.proxyUrl = `${stringValue(proxy.protocol, 'http')}://${stringValue(proxy.host)}${proxy.port ? `:${stringValue(proxy.port)}` : ''}`;
    request.transport.proxyExclusions = Array.isArray(proxy.exclusions) ? proxy.exclusions.map(String).join(',') : stringValue(proxy.exclusions);
  }
  const certificate = record(source.certificate);
  if (certificate) {
    if (certificate.certPath || certificate.keyPath || certificate.path) throw new Error('Script requests cannot read certificate file paths. Paste PEM content in Transport settings instead.');
    request.transport.clientCertificatePem = stringValue(certificate.cert ?? certificate.certificate);
    request.transport.clientKeyPem = stringValue(certificate.key);
    request.transport.clientCertificateDomains = Array.isArray(certificate.domains) ? certificate.domains.map(String).join(',') : stringValue(certificate.domains);
  }

  const body = source.body;
  if (typeof body === 'string') {
    request.bodyMode = 'text';
    request.body = body;
  } else if (record(body)) {
    const bodySource = body as Record<string, unknown>;
    const mode = stringValue(bodySource.mode, 'raw').toLowerCase();
    if (mode === 'raw') {
      request.bodyMode = 'text';
      request.body = stringValue(bodySource.raw);
    } else if (mode === 'urlencoded') {
      request.bodyMode = 'form-urlencoded';
      request.formBody = (Array.isArray(bodySource.urlencoded) ? bodySource.urlencoded : []).map((item, index) => scriptRow(item, index, 'script-form')).filter((item): item is KeyValue => Boolean(item));
    } else if (mode === 'graphql') {
      const graphql = record(bodySource.graphql) ?? bodySource;
      request.protocol = 'graphql';
      request.method = 'POST';
      request.graphql.query = stringValue(graphql.query);
      request.graphql.variables = typeof graphql.variables === 'string' ? graphql.variables : JSON.stringify(graphql.variables ?? {}, null, 2);
      request.graphql.operationName = stringValue(graphql.operationName);
    } else if (mode === 'formdata') {
      const parts = Array.isArray(bodySource.formdata) ? bodySource.formdata : [];
      if (parts.some((item) => record(item)?.type === 'file' || record(item)?.src !== undefined)) throw new Error('Script requests cannot read file paths. Attach files in the request editor instead.');
      request.bodyMode = 'multipart';
      request.multipartBody = parts.map((item, index) => scriptRow(item, index, 'script-part')).filter((item): item is KeyValue => Boolean(item)).map((item) => ({ ...item, kind: 'text' as const }));
    } else if (mode === 'file') {
      throw new Error('Script requests cannot read file paths. Attach files in the request editor instead.');
    } else {
      throw new Error(`Script request body mode '${mode}' is not supported.`);
    }
  }
  return request;
};

const sandboxPrefix = `
const pendingSubrequests = new Map();
self.addEventListener('message', ({ data }) => {
  if (data?.type !== 'subresponse') return;
  const pending = pendingSubrequests.get(data.id);
  if (!pending) return;
  pendingSubrequests.delete(data.id);
  if (data.error) pending.reject(new Error(data.error));
  else pending.resolve(data.response);
});
self.onmessage = async ({ data }) => {
  if (data?.type !== 'run') return;
  const state = structuredClone(data.state);
  const hostPostMessage = self.postMessage.bind(self);
  const logs = [];
  const tests = [];
  const pendingTests = [];
  const fileReferences = [];
  let subrequestCount = 0;
  const constructors = [Function, (async () => {}).constructor, (function* () {}).constructor, (async function* () {}).constructor];
  constructors.forEach((constructor) => {
    try { Object.defineProperty(constructor.prototype, 'constructor', { value: undefined, writable: false, configurable: false }); }
    catch { /* The worker boundary remains the outer permission boundary. */ }
  });
  const denied = (capability) => () => { throw new Error(capability + ' is not available in the script sandbox.'); };
  const fetch = denied('Direct network access; enable and use insomnia.sendRequest()');
  const XMLHttpRequest = undefined;
  const WebSocket = undefined;
  const WebTransport = undefined;
  const EventSource = undefined;
  const Worker = undefined;
  const SharedWorker = undefined;
  const BroadcastChannel = undefined;
  const importScripts = denied('Module imports');
  const indexedDB = undefined;
  const caches = undefined;
  const navigator = undefined;
  const location = undefined;
  const document = undefined;
  const window = undefined;
  const pushLog = (value) => { if (logs.length < 1000) logs.push(String(value).slice(0, 20000)); };
  const console = {
    log: (...values) => pushLog(values.map((value) => typeof value === 'string' ? value : JSON.stringify(value)).join(' ')),
    info: (...values) => pushLog(values.map(String).join(' ')),
    warn: (...values) => pushLog('[warn] ' + values.map(String).join(' ')),
    error: (...values) => pushLog('[error] ' + values.map(String).join(' ')),
  };
  const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
  if (state.globalsAreBase) state.environment = state.baseGlobals;
  if (state.collectionVariablesAreBase) state.collectionVariables = state.baseEnvironment;
  const applyScope = (values, scope, disabled) => {
    (disabled || []).forEach((name) => delete values[name]);
    Object.assign(values, scope);
  };
  const mergedVariables = () => {
    const values = {};
    applyScope(values, state.baseGlobals, state.baseGlobalDisabled);
    if (!state.globalsAreBase) applyScope(values, state.environment, state.globalDisabled);
    applyScope(values, state.baseEnvironment, state.baseEnvironmentDisabled);
    if (!state.collectionVariablesAreBase) applyScope(values, state.collectionVariables, state.collectionDisabled);
    state.folders.forEach((folder) => { (folder.disabled || []).forEach((name) => delete values[name]); Object.assign(values, folder.environment); });
    return Object.assign(values, state.iterationData, state.localVariables);
  };
  const replaceIn = (value) => String(value).replace(/{{\\s*([^{}]+?)\\s*}}/g, (match, name) => mergedVariables()[name] ?? match);
  const removeFileReferences = (...kinds) => {
    for (let index = fileReferences.length - 1; index >= 0; index -= 1) if (kinds.includes(fileReferences[index].kind)) fileReferences.splice(index, 1);
  };
  const addFileReference = (reference) => {
    if (!state.permissions.files) throw new Error('Script file access is disabled. Enable it in Preferences.');
    const path = replaceIn(reference.path ?? '').trim();
    if (!path) throw new Error('Script file path cannot be empty.');
    if (path.length > 10000) throw new Error('Script file path exceeds 10,000 characters.');
    if (fileReferences.length >= 20) throw new Error('Script request exceeds the 20-file attachment limit.');
    fileReferences.push({ ...reference, path });
    return path;
  };
  const variableApi = (values, disabled = []) => ({
    get: (name) => values[name],
    set: (name, value) => {
      const key = String(name);
      const text = String(value);
      if (key.length > 256 || text.length > 1000000) throw new Error('Script variable exceeds the name or 1 MB value limit.');
      if (!Object.prototype.hasOwnProperty.call(values, key) && Object.keys(values).length >= 10000) throw new Error('Script variable scope exceeds 10,000 entries.');
      values[key] = text;
      const disabledIndex = disabled.indexOf(key);
      if (disabledIndex >= 0) disabled.splice(disabledIndex, 1);
    },
    unset: (name) => { const key = String(name); delete values[key]; const disabledIndex = disabled.indexOf(key); if (disabledIndex >= 0) disabled.splice(disabledIndex, 1); },
    has: (name) => Object.prototype.hasOwnProperty.call(values, name),
    clear: () => { Object.keys(values).forEach((name) => delete values[name]); disabled.splice(0); },
    toObject: () => ({ ...values }),
    replaceIn,
  });
  const expect = (actual, negated = false) => {
    let keyMode = 'all';
    const verify = (condition, message) => { if (negated ? condition : !condition) throw new Error(message); };
    const api = {
      toBe: (expected) => verify(actual === expected, 'Expected ' + JSON.stringify(actual) + ' to be ' + JSON.stringify(expected)),
      toEqual: (expected) => verify(same(actual, expected), 'Expected ' + JSON.stringify(actual) + ' to equal ' + JSON.stringify(expected)),
      toContain: (expected) => verify(Boolean(actual?.includes?.(expected)), 'Expected value to contain ' + JSON.stringify(expected)),
      toBeTruthy: () => verify(Boolean(actual), 'Expected value to be truthy'),
      toBeLessThan: (expected) => verify(actual < expected, 'Expected ' + actual + ' to be less than ' + expected),
      toBeGreaterThan: (expected) => verify(actual > expected, 'Expected ' + actual + ' to be greater than ' + expected),
      equal: (expected) => verify(actual === expected, 'Expected ' + JSON.stringify(actual) + ' to equal ' + JSON.stringify(expected)),
      eql: (expected) => verify(same(actual, expected), 'Expected values to deeply equal'),
      include: (expected) => verify(Boolean(actual?.includes?.(expected)), 'Expected value to include ' + JSON.stringify(expected)),
      match: (expected) => verify(expected instanceof RegExp && expected.test(String(actual)), 'Expected value to match ' + expected),
      above: (expected) => verify(actual > expected, 'Expected ' + actual + ' to be above ' + expected),
      below: (expected) => verify(actual < expected, 'Expected ' + actual + ' to be below ' + expected),
      a: (expected) => { verify(expected === 'array' ? Array.isArray(actual) : typeof actual === expected, 'Expected value to be a ' + expected); return api; },
      an: (expected) => { verify(expected === 'array' ? Array.isArray(actual) : typeof actual === expected, 'Expected value to be an ' + expected); return api; },
      property(name, expected) {
        const exists = actual !== null && actual !== undefined && Object.prototype.hasOwnProperty.call(Object(actual), name);
        verify(exists && (arguments.length < 2 || same(actual[name], expected)), 'Expected value to have property ' + name);
        return expect(actual?.[name], negated);
      },
      length: (expected) => verify(actual?.length === expected, 'Expected length ' + expected + ' but got ' + actual?.length),
      lengthOf: (expected) => verify(actual?.length === expected, 'Expected length ' + expected + ' but got ' + actual?.length),
      oneOf: (expected) => verify(Array.isArray(expected) && expected.includes(actual), 'Expected value to be one of ' + JSON.stringify(expected)),
      keys: (...expected) => {
        const values = expected.length === 1 && Array.isArray(expected[0]) ? expected[0] : expected;
        const actualKeys = actual && typeof actual === 'object' ? Object.keys(actual) : [];
        const condition = keyMode === 'any' ? values.some((key) => actualKeys.includes(String(key))) : values.every((key) => actualKeys.includes(String(key)));
        verify(condition, 'Expected value to have ' + keyMode + ' keys ' + values.join(', '));
      },
    };
    ['to', 'be', 'been', 'is', 'that', 'which', 'and', 'has', 'have', 'with', 'at', 'of', 'same'].forEach((name) => Object.defineProperty(api, name, { get: () => api }));
    Object.defineProperty(api, 'all', { get: () => { keyMode = 'all'; return api; } });
    Object.defineProperty(api, 'any', { get: () => { keyMode = 'any'; return api; } });
    Object.defineProperty(api, 'not', { get: () => expect(actual, !negated) });
    Object.defineProperty(api, 'ok', { get: () => { verify(Boolean(actual), 'Expected value to be truthy'); return api; } });
    Object.defineProperty(api, 'true', { get: () => { verify(actual === true, 'Expected value to be true'); return api; } });
    Object.defineProperty(api, 'false', { get: () => { verify(actual === false, 'Expected value to be false'); return api; } });
    Object.defineProperty(api, 'empty', { get: () => { verify(actual?.length === 0 || Object.keys(actual || {}).length === 0, 'Expected value to be empty'); return api; } });
    return api;
  };
  const modules = (${createScriptModules.toString()})({
    atob,
    btoa,
    crypto,
    expect,
    structuredClone,
    TextDecoder,
    TextEncoder,
    URL,
    URLSearchParams,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
  });
  const require = (name) => {
    if (Object.prototype.hasOwnProperty.call(modules, name)) return modules[name];
    throw new Error("Module '" + name + "' is not bundled in Brunomnia's script sandbox.");
  };
  const headerApi = {
    add: ({ key, name, value }) => { if (state.request.headers.length >= 500) throw new Error('Script request exceeds 500 headers.'); state.request.headers.push({ id: 'script-' + Date.now() + '-' + state.request.headers.length, name: String(key || name || '').slice(0, 1000), value: String(value).slice(0, 100000), enabled: true }); },
    remove: (name) => { state.request.headers = state.request.headers.filter((header) => header.name.toLowerCase() !== String(name).toLowerCase()); },
    get: (name) => state.request.headers.find((header) => header.enabled && header.name.toLowerCase() === String(name).toLowerCase())?.value,
    has: (name) => state.request.headers.some((header) => header.enabled && header.name.toLowerCase() === String(name).toLowerCase()),
    set: (name, value) => {
      const existing = state.request.headers.find((header) => header.name.toLowerCase() === String(name).toLowerCase());
      if (existing) { existing.value = String(value).slice(0, 100000); existing.enabled = true; }
      else { if (state.request.headers.length >= 500) throw new Error('Script request exceeds 500 headers.'); state.request.headers.push({ id: 'script-' + Date.now() + '-' + state.request.headers.length, name: String(name).slice(0, 1000), value: String(value).slice(0, 100000), enabled: true }); }
    },
  };
  let requestUrl = String(state.request.url || '');
  const urlApi = {
    addQueryParams: (items) => {
      const entries = typeof items === 'string'
        ? [...new URLSearchParams(items).entries()].map(([name, value]) => ({ name, value }))
        : Array.isArray(items) ? items : Object.entries(items || {}).map(([name, value]) => ({ name, value }));
      try {
        const url = new URL(requestUrl);
        entries.forEach((item) => { const name = item.name ?? item.key; if (name) url.searchParams.append(String(name), String(item.value ?? '')); });
        requestUrl = url.toString();
      } catch {
        const query = entries.flatMap((item) => { const name = item.name ?? item.key; return name ? [encodeURIComponent(String(name)) + '=' + encodeURIComponent(String(item.value ?? ''))] : []; }).join('&');
        if (query) requestUrl += (requestUrl.includes('?') ? '&' : '?') + query;
      }
      if (requestUrl.length > 100000) throw new Error('Script request URL exceeds 100 KB.');
      return urlApi;
    },
    getQueryString: () => { try { return new URL(requestUrl).searchParams.toString(); } catch { return requestUrl.split('?')[1]?.split('#')[0] || ''; } },
    toString: () => requestUrl,
    valueOf: () => requestUrl,
    [Symbol.toPrimitive]: () => requestUrl,
  };
  let requestBody = String(state.request.body || '');
  const bodyApi = {
    update: (body) => {
      const input = typeof body === 'string' ? { mode: 'raw', raw: body } : body || {};
      const mode = String(input.mode || 'raw').toLowerCase();
      if (mode === 'raw') { removeFileReferences('body', 'multipart'); delete state.request.binaryBody; const next = String(input.raw ?? ''); if (next.length > 5000000) throw new Error('Script request body exceeds 5 MB.'); state.request.bodyMode = 'text'; requestBody = next; }
      else if (mode === 'urlencoded') { removeFileReferences('body', 'multipart'); delete state.request.binaryBody; state.request.bodyMode = 'form-urlencoded'; state.request.formBody = (input.urlencoded || []).map((item, index) => ({ id: 'script-form-' + index, name: String(item.key ?? item.name ?? ''), value: String(item.value ?? ''), enabled: item.enabled !== false, description: String(item.description ?? '') })).filter((item) => item.name); }
      else if (mode === 'graphql') { removeFileReferences('body', 'multipart'); delete state.request.binaryBody; const graphql = input.graphql || input; state.request.protocol = 'graphql'; state.request.method = 'POST'; state.request.graphql.query = String(graphql.query ?? ''); state.request.graphql.variables = typeof graphql.variables === 'string' ? graphql.variables : JSON.stringify(graphql.variables || {}, null, 2); state.request.graphql.operationName = String(graphql.operationName ?? ''); }
      else if (mode === 'formdata') {
        removeFileReferences('body', 'multipart'); delete state.request.binaryBody; state.request.bodyMode = 'multipart';
        const parts = Array.isArray(input.formdata) ? input.formdata : [];
        state.request.multipartBody = parts.slice(0, 1000).map((item, index) => {
          const id = 'script-part-' + index; const name = String(item.key ?? item.name ?? ''); const isFile = item.type === 'file' || item.src !== undefined;
          if (!name) return { id, name: '', value: '', enabled: false, kind: 'text' };
          if (isFile) { addFileReference({ kind: 'multipart', path: item.src ?? item.value, partId: id, fileName: String(item.fileName ?? item.filename ?? ''), contentType: String(item.contentType ?? '') }); return { id, name, value: '', enabled: item.enabled !== false, description: String(item.description ?? ''), kind: 'file', fileName: String(item.fileName ?? item.filename ?? ''), contentType: String(item.contentType ?? '') }; }
          return { id, name, value: String(item.value ?? ''), enabled: item.enabled !== false, description: String(item.description ?? ''), kind: 'text' };
        }).filter((item) => item.name);
      }
      else if (mode === 'file') { removeFileReferences('body', 'multipart'); const path = input.file?.src ?? input.file ?? input.src; addFileReference({ kind: 'body', path }); state.request.bodyMode = 'binary'; delete state.request.binaryBody; requestBody = ''; }
      else throw new Error("Request body mode '" + mode + "' is not supported.");
      return bodyApi;
    },
    toString: () => requestBody,
    valueOf: () => requestBody,
    [Symbol.toPrimitive]: () => requestBody,
  };
  Object.defineProperty(state.request, 'url', { configurable: true, enumerable: true, get: () => urlApi, set: (value) => { const next = String(value); if (next.length > 100000) throw new Error('Script request URL exceeds 100 KB.'); requestUrl = next; } });
  Object.defineProperty(state.request, 'body', { configurable: true, enumerable: true, get: () => bodyApi, set: (value) => { removeFileReferences('body', 'multipart'); delete state.request.binaryBody; const next = typeof value === 'string' ? value : JSON.stringify(value); if (next.length > 5000000) throw new Error('Script request body exceeds 5 MB.'); requestBody = next; state.request.bodyMode = 'text'; } });
  state.request.auth.update = (auth, requestedType) => {
    const input = auth || {};
    const type = String(requestedType || input.type || 'none').toLowerCase();
    const keyed = (name, key, fallback) => Array.isArray(input[name]) ? input[name].find((item) => item.key === key)?.value ?? fallback : fallback;
    state.request.auth.disabled = false;
    if (type === 'basic') { state.request.auth.type = 'basic'; state.request.auth.username = String(keyed('basic', 'username', input.username ?? '')); state.request.auth.password = String(keyed('basic', 'password', input.password ?? '')); }
    else if (type === 'bearer') { state.request.auth.type = 'bearer'; state.request.auth.token = String(keyed('bearer', 'token', input.token ?? input.accessToken ?? '')); state.request.auth.prefix = String(keyed('bearer', 'prefix', input.prefix ?? 'Bearer')); }
    else if (type === 'apikey' || type === 'api-key') { state.request.auth.type = 'api-key'; state.request.auth.apiKeyName = String(keyed('apikey', 'key', input.key ?? input.name ?? '')); state.request.auth.apiKeyValue = String(keyed('apikey', 'value', input.value ?? '')); const location = keyed('apikey', 'in', input.in ?? input.location); state.request.auth.apiKeyLocation = location === 'query' ? 'query' : 'header'; }
    else if (type === 'none' || type === 'noauth') { state.request.auth.type = 'none'; state.request.auth.disabled = true; }
    else throw new Error("Request auth type '" + type + "' is not supported by script mutation yet.");
  };
  state.request.proxy = {
    getProxyUrl: () => state.request.transport.proxyUrl,
    update: (proxy) => {
      const input = proxy || {};
      if (input.url) state.request.transport.proxyUrl = String(input.url);
      else if (input.host) state.request.transport.proxyUrl = String(input.protocol || 'http') + '://' + String(input.host) + (input.port ? ':' + String(input.port) : '');
      state.request.transport.proxyExclusions = Array.isArray(input.exclusions) ? input.exclusions.join(',') : String(input.exclusions ?? state.request.transport.proxyExclusions);
    },
  };
  const certificateApi = state.request.certificate = {
    key: { src: '' },
    cert: { src: '' },
    pfx: { src: '' },
    passphrase: '',
    update: (certificate) => {
      const input = certificate || {};
      removeFileReferences('certificate-cert', 'certificate-key');
      if (input.disabled === true) { state.request.transport.clientCertificatePem = ''; state.request.transport.clientKeyPem = ''; state.request.transport.clientCertificateDomains = ''; certificateApi.key.src = ''; certificateApi.cert.src = ''; certificateApi.pfx.src = ''; return; }
      if (input.pfx?.src || input.pfxPath) throw new Error('PFX certificate files are not supported by the native PEM transport.');
      const certPath = input.certPath ?? input.cert?.src; const keyPath = input.keyPath ?? input.key?.src;
      if (certPath) { certificateApi.cert.src = addFileReference({ kind: 'certificate-cert', path: certPath }); state.request.transport.clientCertificatePem = ''; }
      else state.request.transport.clientCertificatePem = String(input.cert?.pem ?? input.cert ?? input.certificate ?? '');
      if (keyPath) { certificateApi.key.src = addFileReference({ kind: 'certificate-key', path: keyPath }); state.request.transport.clientKeyPem = ''; }
      else state.request.transport.clientKeyPem = String(input.key?.pem ?? input.key ?? '');
      state.request.transport.clientCertificateDomains = Array.isArray(input.domains) ? input.domains.join(',') : String(input.domains ?? '');
    },
  };
  const responseFacade = (response) => {
    if (!response) return undefined;
    const headers = Object.entries(response.headers || {}).map(([key, value]) => ({ key, value }));
    headers.get = (name) => headers.find((header) => header.key.toLowerCase() === String(name).toLowerCase())?.value;
    headers.has = (name) => headers.some((header) => header.key.toLowerCase() === String(name).toLowerCase());
    headers.toObject = () => Object.fromEntries(headers.map(({ key, value }) => [key, value]));
    const cookieValues = (response.setCookies || []).map((header) => header.split(';')[0]);
    return {
      status: response.status,
      code: response.status,
      statusText: response.statusText,
      responseTime: response.durationMs,
      json: () => JSON.parse(response.body),
      text: () => response.body,
      headers,
      hasHeader: (name) => headers.has(name),
      getHeader: (name) => headers.get(name),
      cookies: {
        toObject: () => Object.fromEntries(cookieValues.map((pair) => { const split = pair.indexOf('='); return split > 0 ? [pair.slice(0, split).trim(), pair.slice(split + 1).trim()] : ['', '']; }).filter(([name]) => name)),
        get: (name) => { const pair = cookieValues.find((value) => value.slice(0, value.indexOf('=')).trim() === String(name)); return pair ? pair.slice(pair.indexOf('=') + 1).trim() : undefined; },
      },
    };
  };
  const sendRequest = (input, callback) => {
    const run = () => {
      if (!state.permissions.network) throw new Error('Script-initiated requests are disabled. Enable them in Preferences.');
      if (subrequestCount >= state.permissions.maxSubrequests) throw new Error('Script exceeded the secondary-request limit.');
      subrequestCount += 1;
      const id = 'subrequest-' + subrequestCount + '-' + Date.now();
      const promise = new Promise((resolve, reject) => pendingSubrequests.set(id, { resolve, reject }));
      hostPostMessage({ type: 'subrequest', id, input, variables: mergedVariables() });
      return promise.then(responseFacade);
    };
    if (typeof callback === 'function') { Promise.resolve().then(run).then((response) => callback(null, response), (error) => callback(error)); return undefined; }
    return Promise.resolve().then(run);
  };
  const baseGlobalApi = variableApi(state.baseGlobals, state.baseGlobalDisabled);
  const globalApi = variableApi(state.environment, state.globalsAreBase ? state.baseGlobalDisabled : state.globalDisabled);
  const baseEnvironmentApi = variableApi(state.baseEnvironment, state.baseEnvironmentDisabled);
  const collectionApi = variableApi(state.collectionVariables, state.collectionVariablesAreBase ? state.baseEnvironmentDisabled : state.collectionDisabled);
  const localApi = variableApi(state.localVariables);
  const iterationApi = variableApi(state.iterationData);
  const variablesApi = {
    get: (name) => mergedVariables()[name],
    set: localApi.set,
    unset: localApi.unset,
    has: (name) => Object.prototype.hasOwnProperty.call(mergedVariables(), name),
    clear: localApi.clear,
    toObject: mergedVariables,
    replaceIn,
    baseGlobalVars: baseGlobalApi,
    globalVars: globalApi,
    collectionVars: baseEnvironmentApi,
    collectionVariables: baseEnvironmentApi,
    environmentVars: collectionApi,
    localVars: localApi,
    iterationDataVars: iterationApi,
  };
  const folderFacade = (folder) => ({ id: folder.id, name: folder.name, environment: variableApi(folder.environment, folder.disabled) });
  const parentFolders = {
    get: (selector) => { const folder = [...state.folders].reverse().find((item) => item.id === String(selector) || item.name === String(selector)); return folder ? folderFacade(folder) : undefined; },
    getById: (id) => { const folder = state.folders.find((item) => item.id === String(id)); return folder ? folderFacade(folder) : undefined; },
    getByName: (name) => { const folder = [...state.folders].reverse().find((item) => item.name === String(name)); return folder ? folderFacade(folder) : undefined; },
    getEnvironments: () => [...state.folders].reverse().map((folder) => variableApi(folder.environment, folder.disabled)),
  };
  const insomnia = {
    baseGlobals: baseGlobalApi,
    globals: globalApi,
    environment: collectionApi,
    baseEnvironment: baseEnvironmentApi,
    CollectionVariables: baseEnvironmentApi,
    collectionVariables: baseEnvironmentApi,
    variables: variablesApi,
    localVars: localApi,
    iterationData: iterationApi,
    parentFolders,
    request: state.request,
    response: responseFacade(state.response),
    sendRequest,
    replaceIn,
    vault: { get: (name) => { if (!state.permissions.vault) throw new Error('Script vault access is disabled. Enable it in Preferences.'); return state.vault[String(name)]; } },
    expect,
    test: (name, callback) => {
      if (tests.length >= 1000) throw new Error('Script exceeds 1,000 test results.');
      const result = { name, passed: true };
      tests.push(result);
      try {
        const outcome = callback();
        if (outcome && typeof outcome.then === 'function') pendingTests.push(Promise.resolve(outcome).catch((error) => { result.passed = false; result.error = error instanceof Error ? error.message : String(error); }));
      }
      catch (error) { result.passed = false; result.error = error instanceof Error ? error.message : String(error); }
    },
  };
  insomnia.request.headersApi = headerApi;
  insomnia.request.addHeader = headerApi.add;
  insomnia.request.removeHeader = headerApi.remove;
  insomnia.request.setHeader = headerApi.set;
  insomnia.request.getHeader = headerApi.get;
  insomnia.request.hasHeader = headerApi.has;
  insomnia.request.getUrl = () => requestUrl;
  insomnia.request.setUrl = (url) => { const next = String(url); if (next.length > 100000) throw new Error('Script request URL exceeds 100 KB.'); requestUrl = next; };
  insomnia.request.getMethod = () => insomnia.request.method;
  insomnia.request.setMethod = (method) => { insomnia.request.method = String(method).toUpperCase(); };
  insomnia.request.getBody = () => requestBody;
  insomnia.request.setBody = (body) => { removeFileReferences('body', 'multipart'); delete insomnia.request.binaryBody; const next = typeof body === 'string' ? body : JSON.stringify(body); if (next.length > 5000000) throw new Error('Script request body exceeds 5 MB.'); requestBody = next; insomnia.request.bodyMode = 'text'; };
  const cleanupRequest = () => {
    delete state.request.headersApi;
    delete state.request.addHeader;
    delete state.request.removeHeader;
    delete state.request.setHeader;
    delete state.request.getHeader;
    delete state.request.hasHeader;
    delete state.request.getUrl;
    delete state.request.setUrl;
    delete state.request.getMethod;
    delete state.request.setMethod;
    delete state.request.getBody;
    delete state.request.setBody;
    delete state.request.auth.update;
    delete state.request.proxy;
    delete state.request.certificate;
    delete state.request.url;
    state.request.url = requestUrl;
    delete state.request.body;
    state.request.body = requestBody;
  };
  try {
    const runUserScript = async function () {
      'use strict';
      const globalThis = undefined;
      const self = undefined;
      const state = undefined;
      const hostPostMessage = undefined;
      const pendingSubrequests = undefined;
      const constructors = undefined;
      const cleanupRequest = undefined;
      const subrequestCount = undefined;
      const requestUrl = undefined;
      const requestBody = undefined;
      const logs = undefined;
      const tests = undefined;
      const pendingTests = undefined;
      const fileReferences = undefined;
      const Function = undefined;
      const WebAssembly = undefined;
      const WebTransport = undefined;
      const SharedWorker = undefined;
      const BroadcastChannel = undefined;
      const location = undefined;
      const postMessage = undefined;
      const onmessage = undefined;
`;

const sandboxSuffix = `
    };
    await runUserScript();
    await Promise.all(pendingTests);
    cleanupRequest();
    const output = { type: 'result', ok: true, request: state.request, environment: state.environment, baseGlobals: state.baseGlobals, baseGlobalDisabled: state.baseGlobalDisabled, globalDisabled: state.globalDisabled, collectionVariables: state.collectionVariables, baseEnvironment: state.baseEnvironment, baseEnvironmentDisabled: state.baseEnvironmentDisabled, collectionDisabled: state.collectionDisabled, folders: state.folders, localVariables: state.localVariables, fileReferences, logs, tests };
    if (JSON.stringify(output).length > 20000000) hostPostMessage({ type: 'result', ok: false, error: 'Script result exceeds the 20 MB bridge limit.' });
    else hostPostMessage(output);
  } catch (error) {
    cleanupRequest();
    const output = { type: 'result', ok: false, error: error instanceof Error ? error.message : String(error), request: state.request, environment: state.environment, baseGlobals: state.baseGlobals, baseGlobalDisabled: state.baseGlobalDisabled, globalDisabled: state.globalDisabled, collectionVariables: state.collectionVariables, baseEnvironment: state.baseEnvironment, baseEnvironmentDisabled: state.baseEnvironmentDisabled, collectionDisabled: state.collectionDisabled, folders: state.folders, localVariables: state.localVariables, fileReferences, logs, tests };
    if (JSON.stringify(output).length > 20000000) hostPostMessage({ type: 'result', ok: false, error: 'Script result exceeds the 20 MB bridge limit.' });
    else hostPostMessage(output);
  }
};
`;

export const validateScriptSource = (script: string) => {
  if (/\bimport\s*(?:\/\*[\s\S]*?\*\/\s*)?\(/.test(script)) throw new Error('Module imports are not available in the script sandbox.');
  if (/\beval\b/.test(script)) throw new Error('eval is not available in the script sandbox.');
};

export const buildScriptWorkerSource = (script: string) => `${sandboxPrefix}${script}${sandboxSuffix}`;

export const runBrowserScript = async (
  script: string,
  request: ApiRequest,
  environment: Record<string, string>,
  response?: HttpResponse,
  timeoutMs = 10_000,
  localVariables: Record<string, string> = {},
  iterationData: Record<string, string> = {},
  options: ScriptRunOptions = {},
): Promise<ScriptRunResult> => {
  const globalsAreBase = options.globalsAreBase === true;
  const collectionVariablesAreBase = options.collectionVariablesAreBase === true;
  const baseGlobals = { ...(options.baseGlobals ?? (globalsAreBase ? environment : {})) };
  const globalVariables = globalsAreBase ? baseGlobals : { ...environment };
  const baseEnvironment = { ...(options.baseEnvironment ?? (collectionVariablesAreBase ? options.collectionVariables : {})) };
  const collectionVariables = collectionVariablesAreBase ? baseEnvironment : { ...(options.collectionVariables ?? {}) };
  const folders = structuredClone(options.folders ?? []);
  if (!script.trim()) return { request: structuredClone(request), environment: globalVariables, baseGlobals, baseGlobalDisabled: [...(options.baseGlobalDisabled ?? [])], globalDisabled: [...(options.globalDisabled ?? [])], collectionVariables, baseEnvironment, baseEnvironmentDisabled: [...(options.baseEnvironmentDisabled ?? [])], collectionDisabled: [...(options.collectionDisabled ?? [])], folders, localVariables: { ...localVariables }, logs: [], tests: [] };
  validateScriptSource(script);
  const blob = new Blob([buildScriptWorkerSource(script)], { type: 'text/javascript' });
  const workerUrl = URL.createObjectURL(blob);
  const worker = new Worker(workerUrl);
  const maxSubrequests = Math.min(20, Math.max(1, options.maxSubrequests ?? 5));
  const maxSubrequestBytes = Math.min(20_000_000, Math.max(1_024, options.maxSubrequestBytes ?? 5_000_000));
  try {
    const output = await new Promise<WorkerOutput>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error(`Script exceeded the ${timeoutMs} ms execution limit.`)), timeoutMs);
      const fail = (error: Error) => { window.clearTimeout(timeout); reject(error); };
      worker.onerror = (event) => fail(new Error(event.message || 'Script worker failed.'));
      worker.onmessage = (event: MessageEvent<WorkerOutput | WorkerSubrequest>) => {
        const message = event.data;
        if (message.type === 'result') {
          window.clearTimeout(timeout);
          resolve(message);
          return;
        }
        if (!options.sendRequest) {
          worker.postMessage({ type: 'subresponse', id: message.id, error: 'Script-initiated requests are disabled. Enable them in Preferences.' });
          return;
        }
        try {
          const subrequest = normalizeScriptSubrequest(message.input, request);
          void options.sendRequest(subrequest, message.variables).then((subresponse) => {
            if (new Blob([subresponse.body]).size > maxSubrequestBytes) throw new Error(`Script response exceeds the ${Math.round(maxSubrequestBytes / 1_000_000)} MB bridge limit.`);
            worker.postMessage({ type: 'subresponse', id: message.id, response: subresponse });
          }).catch((error) => worker.postMessage({ type: 'subresponse', id: message.id, error: error instanceof Error ? error.message : String(error) }));
        } catch (error) {
          worker.postMessage({ type: 'subresponse', id: message.id, error: error instanceof Error ? error.message : String(error) });
        }
      };
      worker.postMessage({
        type: 'run',
        state: {
          request,
          environment: globalVariables,
          baseGlobals,
          baseGlobalDisabled: options.baseGlobalDisabled ?? [],
          globalDisabled: options.globalDisabled ?? [],
          globalsAreBase,
          baseEnvironment,
          baseEnvironmentDisabled: options.baseEnvironmentDisabled ?? [],
          collectionVariables,
          collectionDisabled: options.collectionDisabled ?? [],
          collectionVariablesAreBase,
          folders,
          response,
          localVariables,
          iterationData,
          vault: options.vault ?? {},
          permissions: { network: Boolean(options.sendRequest), files: Boolean(options.readFile), vault: Boolean(options.vault), maxSubrequests },
        },
      });
    });
    if (!output.ok) throw new Error(output.error || 'Script execution failed.');
    const hydratedRequest = await hydrateScriptFileReferences(output.request, output.fileReferences ?? [], options.readFile);
    return { request: hydratedRequest, environment: output.environment, baseGlobals: output.baseGlobals, baseGlobalDisabled: output.baseGlobalDisabled, globalDisabled: output.globalDisabled, collectionVariables: output.collectionVariables, baseEnvironment: output.baseEnvironment, baseEnvironmentDisabled: output.baseEnvironmentDisabled, collectionDisabled: output.collectionDisabled, folders: output.folders, localVariables: output.localVariables, logs: output.logs, tests: output.tests };
  } finally {
    worker.terminate();
    URL.revokeObjectURL(workerUrl);
  }
};
