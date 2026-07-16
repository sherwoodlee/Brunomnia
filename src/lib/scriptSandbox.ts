import type { ApiRequest, HttpResponse, ScriptRunResult } from '../types';

type WorkerOutput = {
  ok: boolean;
  error?: string;
  request: ApiRequest;
  environment: Record<string, string>;
  logs: string[];
  tests: ScriptRunResult['tests'];
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
  const expect = (actual) => ({
    toBe: (expected) => { if (actual !== expected) throw new Error('Expected ' + JSON.stringify(actual) + ' to be ' + JSON.stringify(expected)); },
    toEqual: (expected) => { if (!same(actual, expected)) throw new Error('Expected ' + JSON.stringify(actual) + ' to equal ' + JSON.stringify(expected)); },
    toContain: (expected) => { if (!actual?.includes?.(expected)) throw new Error('Expected value to contain ' + JSON.stringify(expected)); },
    toBeTruthy: () => { if (!actual) throw new Error('Expected value to be truthy'); },
    toBeLessThan: (expected) => { if (!(actual < expected)) throw new Error('Expected ' + actual + ' to be less than ' + expected); },
    toBeGreaterThan: (expected) => { if (!(actual > expected)) throw new Error('Expected ' + actual + ' to be greater than ' + expected); },
  });
  const headerApi = {
    add: ({ key, name, value }) => state.request.headers.push({ id: 'script-' + Date.now() + '-' + state.request.headers.length, name: key || name, value: String(value), enabled: true }),
    remove: (name) => { state.request.headers = state.request.headers.filter((header) => header.name.toLowerCase() !== String(name).toLowerCase()); },
    get: (name) => state.request.headers.find((header) => header.enabled && header.name.toLowerCase() === String(name).toLowerCase())?.value,
  };
  const insomnia = {
    environment: {
      get: (name) => state.environment[name],
      set: (name, value) => { state.environment[name] = String(value); },
      unset: (name) => { delete state.environment[name]; },
      toObject: () => ({ ...state.environment }),
    },
    request: state.request,
    response: state.response ? {
      status: state.response.status,
      responseTime: state.response.durationMs,
      json: () => JSON.parse(state.response.body),
      text: () => state.response.body,
      headers: Object.entries(state.response.headers).map(([key, value]) => ({ key, value })),
    } : undefined,
    test: (name, callback) => {
      try { callback(); tests.push({ name, passed: true }); }
      catch (error) { tests.push({ name, passed: false, error: error instanceof Error ? error.message : String(error) }); }
    },
  };
  insomnia.request.headersApi = headerApi;
  insomnia.request.addHeader = headerApi.add;
  insomnia.request.removeHeader = headerApi.remove;
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
    self.postMessage({ ok: true, request: state.request, environment: state.environment, logs, tests });
  } catch (error) {
    delete state.request.headersApi;
    delete state.request.addHeader;
    delete state.request.removeHeader;
    self.postMessage({ ok: false, error: error instanceof Error ? error.message : String(error), request: state.request, environment: state.environment, logs, tests });
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
): Promise<ScriptRunResult> => {
  if (!script.trim()) return { request: structuredClone(request), environment: { ...environment }, logs: [], tests: [] };
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
      worker.postMessage({ request, environment, response });
    });
    if (!output.ok) throw new Error(output.error || 'Script execution failed.');
    return { request: output.request, environment: output.environment, logs: output.logs, tests: output.tests };
  } finally {
    worker.terminate();
    URL.revokeObjectURL(workerUrl);
  }
};
