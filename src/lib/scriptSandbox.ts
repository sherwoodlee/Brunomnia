import type { ApiRequest, HttpResponse, ScriptRunResult } from '../types';

type WorkerOutput = {
  ok: boolean;
  error?: string;
  request: ApiRequest;
  environment: Record<string, string>;
  logs: string[];
  tests: ScriptRunResult['tests'];
  localVariables: Record<string, string>;
};

const sandboxPrefix = `
self.onmessage = async ({ data }) => {
  const state = structuredClone(data);
  const logs = [];
  const tests = [];
  const constructors = [Function, (async () => {}).constructor, (function* () {}).constructor, (async function* () {}).constructor];
  constructors.forEach((constructor) => {
    try { Object.defineProperty(constructor.prototype, 'constructor', { value: undefined, writable: false, configurable: false }); }
    catch { /* The worker CSP remains the outer permission boundary. */ }
  });
  const denied = (capability) => () => { throw new Error(capability + ' is not available in the script sandbox.'); };
  const fetch = denied('Network access');
  const XMLHttpRequest = undefined;
  const WebSocket = undefined;
  const EventSource = undefined;
  const Worker = undefined;
  const importScripts = denied('Module imports');
  const indexedDB = undefined;
  const caches = undefined;
  const navigator = undefined;
  const document = undefined;
  const window = undefined;
  const console = {
    log: (...values) => logs.push(values.map((value) => typeof value === 'string' ? value : JSON.stringify(value)).join(' ')),
    info: (...values) => logs.push(values.map(String).join(' ')),
    warn: (...values) => logs.push('[warn] ' + values.map(String).join(' ')),
    error: (...values) => logs.push('[error] ' + values.map(String).join(' ')),
  };
  const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
  const variableApi = (values) => ({
    get: (name) => values[name],
    set: (name, value) => { values[name] = String(value); },
    unset: (name) => { delete values[name]; },
    has: (name) => Object.prototype.hasOwnProperty.call(values, name),
    clear: () => { Object.keys(values).forEach((name) => delete values[name]); },
    toObject: () => ({ ...values }),
    replaceIn: (value) => String(value).replace(/{{\\s*([^{}]+?)\\s*}}/g, (match, name) => values[name] ?? state.localVariables[name] ?? match),
  });
  const expect = (actual, negated = false) => {
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
      a: (expected) => verify(expected === 'array' ? Array.isArray(actual) : typeof actual === expected, 'Expected value to be a ' + expected),
      an: (expected) => verify(expected === 'array' ? Array.isArray(actual) : typeof actual === expected, 'Expected value to be an ' + expected),
      property(name, expected) {
        const exists = actual !== null && actual !== undefined && Object.prototype.hasOwnProperty.call(Object(actual), name);
        verify(exists && (arguments.length < 2 || same(actual[name], expected)), 'Expected value to have property ' + name);
        return expect(actual?.[name], negated);
      },
      length: (expected) => verify(actual?.length === expected, 'Expected length ' + expected + ' but got ' + actual?.length),
    };
    ['to', 'be', 'been', 'is', 'that', 'which', 'and', 'has', 'have', 'with', 'at', 'of', 'same'].forEach((name) => Object.defineProperty(api, name, { get: () => api }));
    Object.defineProperty(api, 'not', { get: () => expect(actual, !negated) });
    Object.defineProperty(api, 'ok', { get: () => { verify(Boolean(actual), 'Expected value to be truthy'); return api; } });
    Object.defineProperty(api, 'true', { get: () => { verify(actual === true, 'Expected value to be true'); return api; } });
    Object.defineProperty(api, 'false', { get: () => { verify(actual === false, 'Expected value to be false'); return api; } });
    Object.defineProperty(api, 'empty', { get: () => { verify(actual?.length === 0 || Object.keys(actual || {}).length === 0, 'Expected value to be empty'); return api; } });
    return api;
  };
  const headerApi = {
    add: ({ key, name, value }) => state.request.headers.push({ id: 'script-' + Date.now() + '-' + state.request.headers.length, name: key || name, value: String(value), enabled: true }),
    remove: (name) => { state.request.headers = state.request.headers.filter((header) => header.name.toLowerCase() !== String(name).toLowerCase()); },
    get: (name) => state.request.headers.find((header) => header.enabled && header.name.toLowerCase() === String(name).toLowerCase())?.value,
    has: (name) => state.request.headers.some((header) => header.enabled && header.name.toLowerCase() === String(name).toLowerCase()),
    set: (name, value) => {
      const existing = state.request.headers.find((header) => header.name.toLowerCase() === String(name).toLowerCase());
      if (existing) { existing.value = String(value); existing.enabled = true; }
      else state.request.headers.push({ id: 'script-' + Date.now() + '-' + state.request.headers.length, name: String(name), value: String(value), enabled: true });
    },
  };
  const responseHeaders = state.response ? Object.entries(state.response.headers).map(([key, value]) => ({ key, value })) : [];
  responseHeaders.get = (name) => responseHeaders.find((header) => header.key.toLowerCase() === String(name).toLowerCase())?.value;
  responseHeaders.has = (name) => responseHeaders.some((header) => header.key.toLowerCase() === String(name).toLowerCase());
  responseHeaders.toObject = () => Object.fromEntries(responseHeaders.map(({ key, value }) => [key, value]));
  const insomnia = {
    environment: variableApi(state.environment),
    baseEnvironment: variableApi(state.environment),
    collectionVariables: variableApi(state.environment),
    variables: variableApi(state.localVariables),
    localVars: variableApi(state.localVariables),
    iterationData: variableApi(state.iterationData),
    request: state.request,
    response: state.response ? {
      status: state.response.status,
      responseTime: state.response.durationMs,
      json: () => JSON.parse(state.response.body),
      text: () => state.response.body,
      headers: responseHeaders,
      hasHeader: (name) => responseHeaders.has(name),
      getHeader: (name) => responseHeaders.get(name),
      cookies: {
        toObject: () => Object.fromEntries((state.response.setCookies || []).map((header) => {
          const pair = header.split(';')[0]; const split = pair.indexOf('=');
          return split > 0 ? [pair.slice(0, split).trim(), pair.slice(split + 1).trim()] : ['', ''];
        }).filter(([name]) => name)),
        get: (name) => {
          const pair = (state.response.setCookies || []).map((header) => header.split(';')[0]).find((value) => value.slice(0, value.indexOf('=')).trim() === String(name));
          return pair ? pair.slice(pair.indexOf('=') + 1).trim() : undefined;
        },
      },
    } : undefined,
    test: (name, callback) => {
      try { callback(); tests.push({ name, passed: true }); }
      catch (error) { tests.push({ name, passed: false, error: error instanceof Error ? error.message : String(error) }); }
    },
  };
  insomnia.request.headersApi = headerApi;
  insomnia.request.addHeader = headerApi.add;
  insomnia.request.removeHeader = headerApi.remove;
  insomnia.request.setHeader = headerApi.set;
  insomnia.request.getHeader = headerApi.get;
  insomnia.request.hasHeader = headerApi.has;
  insomnia.request.getUrl = () => insomnia.request.url;
  insomnia.request.setUrl = (url) => { insomnia.request.url = String(url); };
  insomnia.request.getMethod = () => insomnia.request.method;
  insomnia.request.setMethod = (method) => { insomnia.request.method = String(method).toUpperCase(); };
  insomnia.request.getBody = () => insomnia.request.body;
  insomnia.request.setBody = (body) => { insomnia.request.body = typeof body === 'string' ? body : JSON.stringify(body); };
  try {
    await (async () => {
      const globalThis = undefined;
      const self = undefined;
      const Function = undefined;
      const eval = undefined;
      const WebAssembly = undefined;
      const postMessage = undefined;
      const onmessage = undefined;
`;

const sandboxSuffix = `
    })();
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
    self.postMessage({ ok: true, request: state.request, environment: state.environment, localVariables: state.localVariables, logs, tests });
  } catch (error) {
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
    self.postMessage({ ok: false, error: error instanceof Error ? error.message : String(error), request: state.request, environment: state.environment, localVariables: state.localVariables, logs, tests });
  }
};
`;

export const validateScriptSource = (script: string) => {
  if (/\bimport\s*(?:\/\*[\s\S]*?\*\/\s*)?\(/.test(script)) {
    throw new Error('Module imports are not available in the script sandbox.');
  }
};

export const buildScriptWorkerSource = (script: string) => `${sandboxPrefix}${script}${sandboxSuffix}`;

export const runBrowserScript = async (
  script: string,
  request: ApiRequest,
  environment: Record<string, string>,
  response?: HttpResponse,
  timeoutMs = 2000,
  localVariables: Record<string, string> = {},
  iterationData: Record<string, string> = {},
): Promise<ScriptRunResult> => {
  if (!script.trim()) return { request: structuredClone(request), environment: { ...environment }, localVariables: { ...localVariables }, logs: [], tests: [] };
  validateScriptSource(script);
  const blob = new Blob([buildScriptWorkerSource(script)], { type: 'text/javascript' });
  const workerUrl = URL.createObjectURL(blob);
  const worker = new Worker(workerUrl);
  try {
    const output = await new Promise<WorkerOutput>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error(`Script exceeded the ${timeoutMs} ms execution limit.`)), timeoutMs);
      worker.onerror = (event) => {
        window.clearTimeout(timeout);
        reject(new Error(event.message || 'Script worker failed.'));
      };
      worker.onmessage = (event: MessageEvent<WorkerOutput>) => {
        window.clearTimeout(timeout);
        resolve(event.data);
      };
      worker.postMessage({ request, environment, response, localVariables, iterationData });
    });
    if (!output.ok) throw new Error(output.error || 'Script execution failed.');
    return { request: output.request, environment: output.environment, localVariables: output.localVariables, logs: output.logs, tests: output.tests };
  } finally {
    worker.terminate();
    URL.revokeObjectURL(workerUrl);
  }
};
