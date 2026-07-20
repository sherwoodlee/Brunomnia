import { Worker } from 'node:worker_threads';

import type { ApiRequest, HttpResponse, ScriptRunResult } from '../src/types';
import {
  buildScriptWorkerSource,
  hydrateScriptFileReferences,
  prepareScriptSubrequest,
  type ScriptFileBudget,
  type ScriptFileReference,
  type ScriptRunOptions,
  validateScriptSource,
} from '../src/lib/scriptSandbox';

type NodeScriptOutput = {
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
  folders: NonNullable<ScriptRunOptions['folders']>;
  logs: string[];
  tests: ScriptRunResult['tests'];
  localVariables: Record<string, string>;
  fileReferences: ScriptFileReference[];
  execution: NonNullable<ScriptRunResult['execution']>;
};

type NodeScriptSubrequest = {
  type: 'subrequest';
  id: string;
  input?: unknown;
  requestId?: string;
  mode?: 'request-id';
  variables: Record<string, string>;
};

const workerBootstrap = String.raw`
import vm from 'node:vm';
import { parentPort, workerData } from 'node:worker_threads';

const listeners = [];
const sandbox = Object.create(null);
sandbox.self = sandbox;
sandbox.atob = atob;
sandbox.btoa = btoa;
sandbox.crypto = crypto;
sandbox.structuredClone = structuredClone;
sandbox.TextDecoder = TextDecoder;
sandbox.TextEncoder = TextEncoder;
sandbox.URL = URL;
sandbox.URLSearchParams = URLSearchParams;
sandbox.performance = performance;
sandbox.setTimeout = setTimeout;
sandbox.clearTimeout = clearTimeout;
sandbox.setInterval = setInterval;
sandbox.clearInterval = clearInterval;
sandbox.postMessage = value => parentPort.postMessage(value);
sandbox.addEventListener = (type, listener) => { if (type === 'message') listeners.push(listener); };
const context = vm.createContext(sandbox, {
  name: 'Brunomnia CLI script worker',
  codeGeneration: { strings: false, wasm: false },
});
new vm.Script(workerData.source, { filename: workerData.filename }).runInContext(context, { timeout: 1000 });
parentPort.on('message', data => {
  const event = { data };
  for (const listener of listeners) listener(event);
  if (typeof sandbox.onmessage === 'function') void sandbox.onmessage(event);
});
`;

const workerUrl = new URL(`data:text/javascript,${encodeURIComponent(workerBootstrap)}`);
const responseBytes = (response: HttpResponse) => response.bodyBase64
  ? Math.max(0, Math.floor(response.bodyBase64.length * 3 / 4) - (response.bodyBase64.endsWith('==') ? 2 : response.bodyBase64.endsWith('=') ? 1 : 0))
  : Buffer.byteLength(response.body);

export const runNodeScriptWorker = async (
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
  const execution = {
    location: (options.execution?.location ?? options.executionLocation ?? [...folders.map((folder) => folder.name), request.name]).map((part) => String(part).slice(0, 1_000)).slice(0, 100),
    skipRequest: Boolean(options.execution?.skipRequest),
    nextRequestIdOrName: String(options.execution?.nextRequestIdOrName ?? '').slice(0, 10_000),
  };
  if (!script.trim()) return {
    request: structuredClone(request),
    environment: globalVariables,
    baseGlobals,
    baseGlobalDisabled: [...(options.baseGlobalDisabled ?? [])],
    globalDisabled: [...(options.globalDisabled ?? [])],
    collectionVariables,
    baseEnvironment,
    baseEnvironmentDisabled: [...(options.baseEnvironmentDisabled ?? [])],
    collectionDisabled: [...(options.collectionDisabled ?? [])],
    folders,
    localVariables: { ...localVariables },
    logs: [],
    tests: [],
    execution,
  };

  validateScriptSource(script);
  const maxSubrequests = Math.min(20, Math.max(1, options.maxSubrequests ?? 5));
  const maxSubrequestBytes = Math.min(20_000_000, Math.max(1_024, options.maxSubrequestBytes ?? 5_000_000));
  const fileBudget: ScriptFileBudget = { files: 0, bytes: 0 };
  const worker = new Worker(workerUrl, {
    name: 'Brunomnia CLI script',
    resourceLimits: { maxOldGenerationSizeMb: 64, maxYoungGenerationSizeMb: 16, stackSizeMb: 4 },
    workerData: { source: buildScriptWorkerSource(script), filename: `${request.name}.script.js` },
  });
  try {
    const output = await new Promise<NodeScriptOutput>((resolve, reject) => {
      let settled = false;
      const finish = (callback: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        callback();
      };
      const timeout = setTimeout(() => finish(() => reject(new Error(`Script exceeded the ${timeoutMs} ms execution limit.`))), timeoutMs);
      const reply = (id: string, value: { response?: HttpResponse; error?: string }) => worker.postMessage({ type: 'subresponse', id, ...value });
      const boundedReply = (id: string, subresponse: HttpResponse) => {
        if (responseBytes(subresponse) > maxSubrequestBytes) throw new Error(`Script response exceeds the ${Math.round(maxSubrequestBytes / 1_000_000)} MB bridge limit.`);
        reply(id, { response: subresponse });
      };
      worker.once('error', (error) => finish(() => reject(error)));
      worker.once('exit', (code) => finish(() => reject(new Error(`Script worker exited with code ${code}.`))));
      worker.on('message', (message: NodeScriptOutput | NodeScriptSubrequest) => {
        if (message.type === 'result') {
          finish(() => resolve(message));
          return;
        }
        if (message.mode === 'request-id') {
          if (!options.sendRequestById) {
            reply(message.id, { error: 'Standalone test request execution is unavailable.' });
            return;
          }
          void options.sendRequestById(message.requestId)
            .then((subresponse) => boundedReply(message.id, subresponse))
            .catch((error) => reply(message.id, { error: error instanceof Error ? error.message : String(error) }));
          return;
        }
        if (!options.sendRequest) {
          reply(message.id, { error: 'Script-initiated requests are disabled. Re-run trusted workspaces with --allow-script-requests.' });
          return;
        }
        void prepareScriptSubrequest(message.input, request, message.variables, options.readFile, fileBudget)
          .then((subrequest) => options.sendRequest!(subrequest, message.variables))
          .then((subresponse) => boundedReply(message.id, subresponse))
          .catch((error) => reply(message.id, { error: error instanceof Error ? error.message : String(error) }));
      });
      worker.once('online', () => worker.postMessage({
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
          testNamePattern: options.testNamePattern,
          testCategory: options.testCategory ?? 'unknown',
          execution,
          executionLocation: execution.location,
          vault: options.vault ?? {},
          permissions: { network: Boolean(options.sendRequest), sendById: Boolean(options.sendRequestById), files: Boolean(options.readFile), vault: Boolean(options.vault), maxSubrequests },
        },
      }));
    });
    if (!output.ok) throw new Error(output.error || 'Script execution failed.');
    const hydratedRequest = await hydrateScriptFileReferences(output.request, output.fileReferences ?? [], options.readFile, fileBudget);
    return {
      request: hydratedRequest,
      environment: output.environment,
      baseGlobals: output.baseGlobals,
      baseGlobalDisabled: output.baseGlobalDisabled,
      globalDisabled: output.globalDisabled,
      collectionVariables: output.collectionVariables,
      baseEnvironment: output.baseEnvironment,
      baseEnvironmentDisabled: output.baseEnvironmentDisabled,
      collectionDisabled: output.collectionDisabled,
      folders: output.folders,
      localVariables: output.localVariables,
      logs: output.logs,
      tests: output.tests,
      execution: output.execution,
    };
  } finally {
    await worker.terminate();
  }
};
