import { readFile, writeFile } from 'node:fs/promises';
import vm from 'node:vm';
import { analyzeOpenApi, generateCollectionFromOpenApi } from '../src/lib/openapi';
import { buildHeaders, buildRequestUrl, resolveTemplate } from '../src/lib/request';
import { parseRunnerData, runCollection } from '../src/lib/runner';
import type { ApiDesign, ApiRequest, AuthConfig, Environment, HttpResponse, ScriptRunResult, Workspace } from '../src/types';
import { resolveEnvironment, scriptEnvironmentScopes } from '../src/lib/resources';
import { normalizeScriptSubrequest, type ScriptRunOptions } from '../src/lib/scriptSandbox';

const args = process.argv.slice(2);
const flag = (name: string) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const hasFlag = (name: string) => args.includes(name);
const fail = (message: string, code = 1): never => {
  console.error(message);
  process.exit(code);
};
const loadText = async (path: string) => readFile(path, 'utf8').catch((error) => fail(`Unable to read ${path}: ${error.message}`));
const loadWorkspace = async (path: string): Promise<Workspace> => {
  const parsed = JSON.parse(await loadText(path)) as Partial<Workspace>;
  if (parsed.format !== 'brunomnia' || !Array.isArray(parsed.collections)) fail('The input is not a Brunomnia workspace.');
  return parsed as Workspace;
};

const expectApi = (actual: unknown, negated = false) => {
  let keyMode: 'all' | 'any' = 'all';
  const verify = (condition: boolean, message: string) => { if (negated ? condition : !condition) throw new Error(message); };
  const api = {
    toBe(expected: unknown) { verify(actual === expected, `Expected ${JSON.stringify(actual)} to be ${JSON.stringify(expected)}`); },
    toEqual(expected: unknown) { verify(JSON.stringify(actual) === JSON.stringify(expected), `Expected ${JSON.stringify(actual)} to equal ${JSON.stringify(expected)}`); },
    toContain(expected: unknown) { verify(Boolean((actual as { includes?: (value: unknown) => boolean })?.includes?.(expected)), `Expected value to contain ${JSON.stringify(expected)}`); },
    toBeTruthy() { verify(Boolean(actual), 'Expected value to be truthy'); },
    toBeLessThan(expected: number) { verify(Number(actual) < expected, `Expected ${actual} to be less than ${expected}`); },
    toBeGreaterThan(expected: number) { verify(Number(actual) > expected, `Expected ${actual} to be greater than ${expected}`); },
    equal(expected: unknown) { verify(actual === expected, 'Expected values to equal'); },
    eql(expected: unknown) { verify(JSON.stringify(actual) === JSON.stringify(expected), 'Expected values to deeply equal'); },
    include(expected: unknown) { verify(Boolean((actual as { includes?: (value: unknown) => boolean })?.includes?.(expected)), 'Expected value to include'); },
    above(expected: number) { verify(Number(actual) > expected, `Expected ${actual} to be above ${expected}`); },
    below(expected: number) { verify(Number(actual) < expected, `Expected ${actual} to be below ${expected}`); },
    a(expected: string) { verify(expected === 'array' ? Array.isArray(actual) : typeof actual === expected, `Expected value to be a ${expected}`); return api; },
    an(expected: string) { verify(expected === 'array' ? Array.isArray(actual) : typeof actual === expected, `Expected value to be an ${expected}`); return api; },
    lengthOf(expected: number) { verify((actual as { length?: number })?.length === expected, `Expected length ${expected}`); },
    oneOf(expected: unknown[]) { verify(expected.includes(actual), `Expected value to be one of ${JSON.stringify(expected)}`); },
    keys(...expected: unknown[]) { const values = expected.length === 1 && Array.isArray(expected[0]) ? expected[0] : expected; const keys = actual && typeof actual === 'object' ? Object.keys(actual) : []; verify(keyMode === 'any' ? values.some((key) => keys.includes(String(key))) : values.every((key) => keys.includes(String(key))), `Expected value to have ${keyMode} keys`); },
  };
  ['to', 'be', 'been', 'is', 'that', 'which', 'and', 'has', 'have', 'with', 'at', 'of', 'same'].forEach((name) => Object.defineProperty(api, name, { get: () => api }));
  Object.defineProperty(api, 'not', { get: () => expectApi(actual, !negated) });
  Object.defineProperty(api, 'all', { get: () => { keyMode = 'all'; return api; } });
  Object.defineProperty(api, 'any', { get: () => { keyMode = 'any'; return api; } });
  return api;
};

const runNodeScript = async (
  source: string,
  originalRequest: ApiRequest,
  originalEnvironment: Record<string, string>,
  response?: HttpResponse,
  timeoutMs = 10_000,
  originalLocalVariables: Record<string, string> = {},
  iterationData: Record<string, string> = {},
  options: ScriptRunOptions = {},
): Promise<ScriptRunResult> => {
  const request = structuredClone(originalRequest);
  const globalsAreBase = options.globalsAreBase === true;
  const collectionVariablesAreBase = options.collectionVariablesAreBase === true;
  const baseGlobals = { ...(options.baseGlobals ?? (globalsAreBase ? originalEnvironment : {})) };
  const environment = globalsAreBase ? baseGlobals : { ...originalEnvironment };
  const baseEnvironment = { ...(options.baseEnvironment ?? (collectionVariablesAreBase ? options.collectionVariables : {})) };
  const collectionVariables = collectionVariablesAreBase ? baseEnvironment : { ...(options.collectionVariables ?? {}) };
  const baseGlobalDisabled = [...(options.baseGlobalDisabled ?? [])];
  const globalDisabled = [...(options.globalDisabled ?? [])];
  const baseEnvironmentDisabled = [...(options.baseEnvironmentDisabled ?? [])];
  const collectionDisabled = [...(options.collectionDisabled ?? [])];
  const folders = structuredClone(options.folders ?? []);
  const localVariables = { ...originalLocalVariables };
  const logs: string[] = [];
  const tests: ScriptRunResult['tests'] = [];
  const pendingTests: Promise<unknown>[] = [];
  if (!source.trim()) return { request, environment, baseGlobals, baseGlobalDisabled, globalDisabled, collectionVariables, baseEnvironment, baseEnvironmentDisabled, collectionDisabled, folders, localVariables, logs, tests };
  const mergedVariables = () => {
    const values: Record<string, string> = {};
    const applyScope = (scope: Record<string, string>, disabled: string[] = []) => {
      disabled.forEach((name) => delete values[name]);
      Object.assign(values, scope);
    };
    applyScope(baseGlobals, baseGlobalDisabled);
    if (!globalsAreBase) applyScope(environment, globalDisabled);
    applyScope(baseEnvironment, baseEnvironmentDisabled);
    if (!collectionVariablesAreBase) applyScope(collectionVariables, collectionDisabled);
    folders.forEach((folder) => { (folder.disabled ?? []).forEach((name) => delete values[name]); Object.assign(values, folder.environment); });
    return { ...values, ...iterationData, ...localVariables };
  };
  const variableApi = (values: Record<string, string>, disabled: string[] = []) => ({
    get: (name: string) => values[name],
    set: (name: string, value: unknown) => { values[name] = String(value); const index = disabled.indexOf(name); if (index >= 0) disabled.splice(index, 1); },
    unset: (name: string) => { delete values[name]; const index = disabled.indexOf(name); if (index >= 0) disabled.splice(index, 1); },
    has: (name: string) => Object.hasOwn(values, name),
    clear: () => { Object.keys(values).forEach((name) => delete values[name]); disabled.splice(0); },
    toObject: () => ({ ...values }),
    replaceIn: (value: unknown) => String(value).replace(/{{\s*([^{}]+?)\s*}}/g, (match, name: string) => mergedVariables()[name] ?? match),
  });
  const requestWithHelpers = request as ApiRequest & {
    addHeader?: (header: { key?: string; name?: string; value: unknown }) => void;
    removeHeader?: (name: string) => void;
    setHeader?: (name: string, value: unknown) => void;
    getHeader?: (name: string) => string | undefined;
    hasHeader?: (name: string) => boolean;
    getUrl?: () => string;
    setUrl?: (url: unknown) => void;
    getMethod?: () => string;
    setMethod?: (method: unknown) => void;
    getBody?: () => string;
    setBody?: (body: unknown) => void;
    proxy?: { getProxyUrl: () => string; update: (proxy: Record<string, unknown>) => void };
    certificate?: { key: { src: string }; cert: { src: string }; pfx: { src: string }; passphrase: string; update: (certificate: Record<string, unknown>) => void };
  };
  requestWithHelpers.addHeader = ({ key, name, value }) => {
    request.headers.push({ id: `cli-script-${Date.now()}-${request.headers.length}`, name: key || name || '', value: String(value), enabled: true });
  };
  requestWithHelpers.removeHeader = (name) => {
    request.headers = request.headers.filter((header) => header.name.toLowerCase() !== name.toLowerCase());
  };
  requestWithHelpers.setHeader = (name, value) => {
    const existing = request.headers.find((header) => header.name.toLowerCase() === name.toLowerCase());
    if (existing) { existing.value = String(value); existing.enabled = true; }
    else request.headers.push({ id: `cli-script-${Date.now()}-${request.headers.length}`, name, value: String(value), enabled: true });
  };
  requestWithHelpers.getHeader = (name) => request.headers.find((header) => header.enabled && header.name.toLowerCase() === name.toLowerCase())?.value;
  requestWithHelpers.hasHeader = (name) => request.headers.some((header) => header.enabled && header.name.toLowerCase() === name.toLowerCase());
  let requestUrl = request.url;
  const urlApi = {
    addQueryParams: (items: string | Array<{ key?: string; name?: string; value?: unknown }> | Record<string, unknown>) => {
      const entries = typeof items === 'string'
        ? [...new URLSearchParams(items).entries()].map(([name, value]) => ({ name, value }))
        : Array.isArray(items) ? items : Object.entries(items ?? {}).map(([name, value]) => ({ name, value }));
      try {
        const parsed = new URL(requestUrl);
        entries.forEach((item) => { const name = item.name ?? item.key; if (name) parsed.searchParams.append(name, String(item.value ?? '')); });
        requestUrl = parsed.toString();
      } catch {
        const query = entries.flatMap((item) => { const name = item.name ?? item.key; return name ? [`${encodeURIComponent(name)}=${encodeURIComponent(String(item.value ?? ''))}`] : []; }).join('&');
        if (query) requestUrl += `${requestUrl.includes('?') ? '&' : '?'}${query}`;
      }
      return urlApi;
    },
    getQueryString: () => { try { return new URL(requestUrl).searchParams.toString(); } catch { return requestUrl.split('?')[1]?.split('#')[0] ?? ''; } },
    toString: () => requestUrl,
    valueOf: () => requestUrl,
    [Symbol.toPrimitive]: () => requestUrl,
  };
  let requestBody = request.body;
  const bodyApi = {
    update: (body: unknown) => {
      const input = typeof body === 'string' ? { mode: 'raw', raw: body } : (body && typeof body === 'object' ? body as Record<string, unknown> : {});
      const mode = String(input.mode ?? 'raw').toLowerCase();
      if (mode === 'raw') { request.bodyMode = 'text'; requestBody = String(input.raw ?? ''); }
      else if (mode === 'urlencoded') { request.bodyMode = 'form-urlencoded'; request.formBody = (Array.isArray(input.urlencoded) ? input.urlencoded : []).flatMap((item, index) => { const row = item as Record<string, unknown>; const name = String(row.key ?? row.name ?? ''); return name ? [{ id: `cli-form-${index}`, name, value: String(row.value ?? ''), enabled: row.enabled !== false }] : []; }); }
      else if (mode === 'graphql') { const graphql = (input.graphql && typeof input.graphql === 'object' ? input.graphql : input) as Record<string, unknown>; request.protocol = 'graphql'; request.method = 'POST'; request.graphql.query = String(graphql.query ?? ''); request.graphql.variables = typeof graphql.variables === 'string' ? graphql.variables : JSON.stringify(graphql.variables ?? {}, null, 2); request.graphql.operationName = String(graphql.operationName ?? ''); }
      else if (mode === 'formdata') { const parts = Array.isArray(input.formdata) ? input.formdata as Array<Record<string, unknown>> : []; if (parts.some((part) => part.type === 'file' || part.src !== undefined)) throw new Error('Scripts cannot read file paths.'); request.bodyMode = 'multipart'; request.multipartBody = parts.flatMap((part, index) => { const name = String(part.key ?? part.name ?? ''); return name ? [{ id: `cli-part-${index}`, name, value: String(part.value ?? ''), enabled: part.enabled !== false, kind: 'text' as const }] : []; }); }
      else if (mode === 'file') throw new Error('Scripts cannot read file paths.');
      else throw new Error(`Request body mode '${mode}' is not supported.`);
      return bodyApi;
    },
    toString: () => requestBody,
    valueOf: () => requestBody,
    [Symbol.toPrimitive]: () => requestBody,
  };
  Object.defineProperty(request, 'url', { configurable: true, enumerable: true, get: () => urlApi, set: (value) => { requestUrl = String(value); } });
  Object.defineProperty(request, 'body', { configurable: true, enumerable: true, get: () => bodyApi, set: (value) => { requestBody = typeof value === 'string' ? value : JSON.stringify(value); request.bodyMode = 'text'; } });
  requestWithHelpers.getUrl = () => requestUrl;
  requestWithHelpers.setUrl = (url) => { requestUrl = String(url); };
  requestWithHelpers.getMethod = () => request.method;
  requestWithHelpers.setMethod = (method) => { request.method = String(method).toUpperCase(); };
  requestWithHelpers.getBody = () => requestBody;
  requestWithHelpers.setBody = (body) => { requestBody = typeof body === 'string' ? body : JSON.stringify(body); request.bodyMode = 'text'; };
  const authWithUpdate = request.auth as AuthConfig & { update?: (auth: Record<string, unknown>, requestedType?: string) => void };
  authWithUpdate.update = (input, requestedType) => {
    const type = String(requestedType ?? input.type ?? 'none').toLowerCase();
    const keyed = (name: string, key: string, fallback: unknown) => Array.isArray(input[name]) ? (input[name] as Array<Record<string, unknown>>).find((item) => item.key === key)?.value ?? fallback : fallback;
    request.auth.disabled = false;
    if (type === 'basic') { request.auth.type = 'basic'; request.auth.username = String(keyed('basic', 'username', input.username ?? '')); request.auth.password = String(keyed('basic', 'password', input.password ?? '')); }
    else if (type === 'bearer') { request.auth.type = 'bearer'; request.auth.token = String(keyed('bearer', 'token', input.token ?? input.accessToken ?? '')); request.auth.prefix = String(keyed('bearer', 'prefix', input.prefix ?? 'Bearer')); }
    else if (type === 'apikey' || type === 'api-key') { request.auth.type = 'api-key'; request.auth.apiKeyName = String(keyed('apikey', 'key', input.key ?? input.name ?? '')); request.auth.apiKeyValue = String(keyed('apikey', 'value', input.value ?? '')); const location = keyed('apikey', 'in', input.in ?? input.location); request.auth.apiKeyLocation = location === 'query' ? 'query' : 'header'; }
    else if (type === 'none' || type === 'noauth') { request.auth.type = 'none'; request.auth.disabled = true; }
    else throw new Error(`Request auth type '${type}' is not supported by script mutation yet.`);
  };
  requestWithHelpers.proxy = { getProxyUrl: () => request.transport.proxyUrl, update: (input) => {
    if (input.url) request.transport.proxyUrl = String(input.url);
    else if (input.host) request.transport.proxyUrl = `${String(input.protocol ?? 'http')}://${String(input.host)}${input.port ? `:${String(input.port)}` : ''}`;
    request.transport.proxyExclusions = Array.isArray(input.exclusions) ? input.exclusions.join(',') : String(input.exclusions ?? request.transport.proxyExclusions);
  } };
  requestWithHelpers.certificate = { key: { src: '' }, cert: { src: '' }, pfx: { src: '' }, passphrase: '', update: (input) => {
    if (input.disabled === true) { request.transport.clientCertificatePem = ''; request.transport.clientKeyPem = ''; request.transport.clientCertificateDomains = ''; return; }
    const key = input.key as Record<string, unknown> | undefined;
    const cert = input.cert as Record<string, unknown> | undefined;
    const pfx = input.pfx as Record<string, unknown> | undefined;
    if (input.certPath || input.keyPath || input.path || key?.src || cert?.src || pfx?.src) throw new Error('Scripts cannot read certificate file paths. Paste PEM content in Transport settings instead.');
    request.transport.clientCertificatePem = String(cert?.pem ?? input.cert ?? input.certificate ?? '');
    request.transport.clientKeyPem = String(key?.pem ?? input.key ?? '');
    request.transport.clientCertificateDomains = Array.isArray(input.domains) ? input.domains.join(',') : String(input.domains ?? '');
  } };
  const baseGlobalApi = variableApi(baseGlobals, baseGlobalDisabled);
  const globalApi = variableApi(environment, globalsAreBase ? baseGlobalDisabled : globalDisabled);
  const baseEnvironmentApi = variableApi(baseEnvironment, baseEnvironmentDisabled);
  const collectionApi = variableApi(collectionVariables, collectionVariablesAreBase ? baseEnvironmentDisabled : collectionDisabled);
  const localApi = variableApi(localVariables) as ReturnType<typeof variableApi> & Record<string, unknown>;
  const iterationApi = variableApi(iterationData);
  const variablesApi = {
    get: (name: string) => mergedVariables()[name], set: localApi.set, unset: localApi.unset,
    has: (name: string) => Object.hasOwn(mergedVariables(), name), clear: localApi.clear, toObject: mergedVariables,
    replaceIn: localApi.replaceIn, baseGlobalVars: baseGlobalApi, globalVars: globalApi, collectionVars: baseEnvironmentApi,
    collectionVariables: baseEnvironmentApi, environmentVars: collectionApi, localVars: localApi, iterationDataVars: iterationApi,
  };
  const responseFacade = (candidate: HttpResponse | undefined) => {
    if (!candidate) return undefined;
    const headers = Object.entries(candidate.headers).map(([key, value]) => ({ key, value })) as Array<{ key: string; value: string }> & { get: (name: string) => string | undefined; has: (name: string) => boolean; toObject: () => Record<string, string> };
    headers.get = (name) => headers.find((header) => header.key.toLowerCase() === name.toLowerCase())?.value;
    headers.has = (name) => headers.some((header) => header.key.toLowerCase() === name.toLowerCase());
    headers.toObject = () => Object.fromEntries(headers.map(({ key, value }) => [key, value]));
    const cookieValues = (candidate.setCookies ?? []).map((header) => header.split(';')[0]);
    return {
      status: candidate.status,
      code: candidate.status,
      statusText: candidate.statusText,
      responseTime: candidate.durationMs,
      json: () => JSON.parse(candidate.body),
      text: () => candidate.body,
      headers,
      hasHeader: (name: string) => headers.has(name),
      getHeader: (name: string) => headers.get(name),
      cookies: {
        toObject: () => Object.fromEntries(cookieValues.flatMap((pair) => { const split = pair.indexOf('='); return split > 0 ? [[pair.slice(0, split).trim(), pair.slice(split + 1).trim()]] : []; })),
        get: (name: string) => { const pair = cookieValues.find((value) => value.slice(0, value.indexOf('=')).trim() === name); return pair ? pair.slice(pair.indexOf('=') + 1).trim() : undefined; },
      },
    };
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
    parentFolders: {
      get: (selector: string) => { const folder = [...folders].reverse().find((item) => item.id === selector || item.name === selector); return folder ? { id: folder.id, name: folder.name, environment: variableApi(folder.environment, folder.disabled) } : undefined; },
      getById: (id: string) => { const folder = folders.find((item) => item.id === id); return folder ? { id: folder.id, name: folder.name, environment: variableApi(folder.environment, folder.disabled) } : undefined; },
      getByName: (name: string) => { const folder = [...folders].reverse().find((item) => item.name === name); return folder ? { id: folder.id, name: folder.name, environment: variableApi(folder.environment, folder.disabled) } : undefined; },
      getEnvironments: () => [...folders].reverse().map((folder) => variableApi(folder.environment, folder.disabled)),
    },
    request,
    response: responseFacade(response),
    replaceIn: (value: unknown) => String(value).replace(/{{\s*([^{}]+?)\s*}}/g, (match, name: string) => mergedVariables()[name] ?? match),
    vault: { get: (name: string) => { if (!options.vault) throw new Error('Script vault access is disabled.'); return options.vault[name]; } },
    sendRequest: async (input: unknown, callback?: (error: Error | null, result?: ReturnType<typeof responseFacade>) => void) => {
      const run = async () => {
        if (!options.sendRequest) throw new Error('Script-initiated requests are disabled.');
        return responseFacade(await options.sendRequest(normalizeScriptSubrequest(input, request), mergedVariables()));
      };
      if (callback) { void run().then((result) => callback(null, result), (error) => callback(error instanceof Error ? error : new Error(String(error)))); return undefined; }
      return run();
    },
    expect: expectApi,
    test: (name: string, callback: () => unknown) => {
      const result: ScriptRunResult['tests'][number] = { name, passed: true };
      tests.push(result);
      try { const outcome = callback(); if (outcome && typeof (outcome as PromiseLike<unknown>).then === 'function') pendingTests.push(Promise.resolve(outcome).catch((error) => { result.passed = false; result.error = error instanceof Error ? error.message : String(error); })); }
      catch (error) { result.passed = false; result.error = error instanceof Error ? error.message : String(error); }
    },
  };
  const context = vm.createContext({
    insomnia,
    expect: expectApi,
    require: (name: string) => {
      const assertion = Object.assign((condition: unknown, message?: string) => { if (!condition) throw new Error(message || 'Assertion failed'); }, {
        equal: (actual: unknown, expected: unknown) => { if (actual != expected) throw new Error('Expected values to be equal'); },
        strictEqual: (actual: unknown, expected: unknown) => { if (actual !== expected) throw new Error('Expected values to be strictly equal'); },
        deepEqual: (actual: unknown, expected: unknown) => { if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error('Expected values to be deeply equal'); },
      });
      const modules: Record<string, unknown> = {
        assert: assertion,
        atob,
        btoa,
        chai: { expect: expectApi },
        lodash: { cloneDeep: structuredClone, get: (value: unknown, path: string, fallback: unknown) => path.split('.').filter(Boolean).reduce<unknown>((current, key) => (current as Record<string, unknown> | undefined)?.[key], value) ?? fallback },
        querystring: { parse: (value: string) => Object.fromEntries(new URLSearchParams(value)), stringify: (value: Record<string, unknown>) => new URLSearchParams(Object.entries(value).map(([key, item]) => [key, String(item)])).toString() },
        timers: { setTimeout, clearTimeout, setInterval, clearInterval },
        url: { URL, URLSearchParams },
        util: { format: (...values: unknown[]) => values.map(String).join(' ') },
        uuid: { v4: () => crypto.randomUUID() },
      };
      if (!Object.hasOwn(modules, name)) throw new Error(`Module '${name}' is not bundled in Brunomnia's script sandbox.`);
      return modules[name];
    },
    console: {
      log: (...values: unknown[]) => logs.push(values.map(String).join(' ')),
      info: (...values: unknown[]) => logs.push(values.map(String).join(' ')),
      warn: (...values: unknown[]) => logs.push(`[warn] ${values.map(String).join(' ')}`),
      error: (...values: unknown[]) => logs.push(`[error] ${values.map(String).join(' ')}`),
    },
    structuredClone,
    JSON,
    URL,
    URLSearchParams,
  }, { codeGeneration: { strings: false, wasm: false } });
  const script = new vm.Script(`(async () => { ${source}\n })()`, { filename: `${request.name}.script.js` });
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      Promise.resolve(script.runInContext(context, { timeout: timeoutMs })),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(`Script exceeded the ${timeoutMs} ms execution limit.`)), timeoutMs);
      }),
    ]);
    await Promise.all(pendingTests);
  } finally {
    if (timeout) clearTimeout(timeout);
    delete requestWithHelpers.addHeader;
    delete requestWithHelpers.removeHeader;
    delete requestWithHelpers.setHeader;
    delete requestWithHelpers.getHeader;
    delete requestWithHelpers.hasHeader;
    delete requestWithHelpers.getUrl;
    delete requestWithHelpers.setUrl;
    delete requestWithHelpers.getMethod;
    delete requestWithHelpers.setMethod;
    delete requestWithHelpers.getBody;
    delete requestWithHelpers.setBody;
    delete requestWithHelpers.proxy;
    delete requestWithHelpers.certificate;
    delete authWithUpdate.update;
    delete request.url;
    request.url = requestUrl;
    delete request.body;
    request.body = requestBody;
  }
  return { request, environment, baseGlobals, baseGlobalDisabled, globalDisabled, collectionVariables, baseEnvironment, baseEnvironmentDisabled, collectionDisabled, folders, localVariables, logs, tests };
};

const executeHttp = async (request: ApiRequest, variables: Record<string, string>): Promise<HttpResponse> => {
  if (request.protocol !== 'http' && request.protocol !== 'graphql') throw new Error(`CLI collection execution does not yet support ${request.protocol}.`);
  const url = buildRequestUrl(request, variables);
  const headers = buildHeaders(request, variables);
  let body: BodyInit | undefined;
  if (request.protocol === 'graphql') {
    body = JSON.stringify({ query: resolveTemplate(request.graphql.query, variables), variables: JSON.parse(resolveTemplate(request.graphql.variables || '{}', variables)), operationName: request.graphql.operationName || undefined });
    if (!headers.some((header) => header.name.toLowerCase() === 'content-type')) headers.push({ id: 'cli-graphql', name: 'Content-Type', value: 'application/json', enabled: true });
  } else if (request.bodyMode === 'json' || request.bodyMode === 'text') body = resolveTemplate(request.body, variables);
  else if (request.bodyMode === 'form-urlencoded') body = new URLSearchParams(Object.fromEntries(request.formBody.filter((row) => row.enabled).map((row) => [row.name, resolveTemplate(row.value, variables)])));
  else if (request.bodyMode === 'multipart') {
    const form = new FormData();
    request.multipartBody.filter((part) => part.enabled && part.name).forEach((part) => {
      if (part.kind === 'file' && part.file) {
        form.append(part.name, new Blob([Buffer.from(part.file.dataBase64, 'base64')], { type: part.contentType || part.file.mimeType }), part.fileName || part.file.fileName);
      } else {
        form.append(part.name, resolveTemplate(part.value, variables));
      }
    });
    body = form;
  }
  else if (request.bodyMode === 'binary' && request.binaryBody) body = Buffer.from(request.binaryBody.dataBase64, 'base64');
  const started = performance.now();
  const response = await fetch(url, {
    method: request.method,
    headers: Object.fromEntries(headers.filter((header) => header.enabled && header.name).map((header) => [header.name, header.value])),
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : body,
    redirect: request.transport.followRedirects ? 'follow' : 'manual',
    signal: AbortSignal.timeout(request.transport.timeoutMs),
  });
  const responseBody = await response.text();
  return { status: response.status, statusText: response.statusText, headers: Object.fromEntries(response.headers.entries()), body: responseBody, durationMs: Math.round(performance.now() - started), sizeBytes: Buffer.byteLength(responseBody) };
};

const usage = `Brunomnia CLI

  brunomnia lint spec <openapi-file> [--ruleset <spectral-yaml>] [--json]
  brunomnia generate collection <openapi-file> --output <file>
  brunomnia export spec <workspace> <design-name-or-id> [--output <file>]
  brunomnia run collection <workspace> <collection-name-or-id> [--env <name-or-id>] [--iterations N] [--retries N] [--data <json-or-csv>] [--allow-scripts] [--allow-script-requests]
  brunomnia run test <workspace> <collection-name-or-id> [same options]
`;

const main = async () => {
  const [command, subject] = args;
  if (!command || hasFlag('--help') || hasFlag('-h')) { console.log(usage); return; }

  if (command === 'lint' && subject === 'spec') {
    const path = args[2] ?? fail('Provide an OpenAPI file.');
    const rulesetPath = flag('--ruleset');
    const analysis = analyzeOpenApi(await loadText(path), rulesetPath ? await loadText(rulesetPath) : '');
    if (hasFlag('--json')) console.log(JSON.stringify(analysis.issues, null, 2));
    else analysis.issues.forEach((issue) => console.log(`${issue.severity.toUpperCase()} ${issue.path}: ${issue.message}`));
    console.log(`${analysis.operations.length} operations · ${analysis.issues.length} issues`);
    if (analysis.issues.some((issue) => issue.severity === 'error')) process.exitCode = 1;
    return;
  }

  if (command === 'generate' && subject === 'collection') {
    const path = args[2] ?? fail('Provide an OpenAPI file.');
    const output = flag('--output') ?? fail('Provide --output <file>.');
    const design: ApiDesign = { id: 'cli-design', name: path, contents: await loadText(path) };
    await writeFile(output, `${JSON.stringify(generateCollectionFromOpenApi(design), null, 2)}\n`);
    console.log(`Generated ${output}`);
    return;
  }

  if (command === 'export' && subject === 'spec') {
    const workspace = await loadWorkspace(args[2] ?? fail('Provide a workspace file.'));
    const identifier = args[3] ?? fail('Provide a design name or ID.');
    const design = workspace.apiDesigns.find((candidate) => candidate.id === identifier || candidate.name === identifier) ?? fail(`Design '${identifier}' was not found.`);
    const output = flag('--output');
    if (output) { await writeFile(output, design.contents); console.log(`Exported ${output}`); }
    else console.log(design.contents);
    return;
  }

  if (command === 'run' && (subject === 'collection' || subject === 'test')) {
    const workspace = await loadWorkspace(args[2] ?? fail('Provide a workspace file.'));
    const identifier = args[3] ?? fail('Provide a collection name or ID.');
    const collection = workspace.collections.find((candidate) => candidate.id === identifier || candidate.name === identifier) ?? fail(`Collection '${identifier}' was not found.`);
    const environmentIdentifier = flag('--env') ?? workspace.activeEnvironmentId;
    const selectedEnvironment: Environment = workspace.environments.find((candidate) => candidate.id === environmentIdentifier || candidate.name === environmentIdentifier) ?? workspace.environments[0] ?? fail('The workspace has no environment.');
    const environment = resolveEnvironment(workspace.environments, selectedEnvironment.id) ?? selectedEnvironment;
    const dataPath = flag('--data');
    const report = await runCollection(collection, environment, {
      iterations: Number(flag('--iterations') ?? 1), retries: Number(flag('--retries') ?? 0), delayMs: 0,
      scriptTimeoutMs: Math.min(60_000, Math.max(1_000, Number(flag('--script-timeout') ?? 10_000))),
      environmentScopes: scriptEnvironmentScopes(workspace.environments, selectedEnvironment.id),
      dataRows: dataPath ? parseRunnerData(await loadText(dataPath)) : [],
    }, executeHttp, (source, request, variables, response, timeoutMs, localVariables, iterationData, scriptOptions) => {
      if (source.trim() && !hasFlag('--allow-scripts')) throw new Error('CLI script execution is disabled. Re-run trusted workspaces with --allow-scripts.');
      return runNodeScript(source, request, variables, response, timeoutMs, localVariables, iterationData, {
        ...scriptOptions,
        sendRequest: hasFlag('--allow-script-requests') ? executeHttp : undefined,
      });
    });
    console.log(JSON.stringify(report, null, 2));
    if (report.failed > 0) process.exitCode = 1;
    return;
  }

  fail(`Unknown command.\n\n${usage}`);
};

void main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
