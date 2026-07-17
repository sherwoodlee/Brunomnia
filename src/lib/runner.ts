import type {
  ApiRequest,
  Collection,
  Environment,
  HttpResponse,
  RunnerItemResult,
  RunnerReport,
  ScriptRunResult,
} from '../types';
import { environmentMap } from './request';
import { applyCollectionConfiguration, collectionEnvironmentScopes, type ScriptEnvironmentScopes } from './resources';
import type { ScriptRunOptions } from './scriptSandbox';

export type RequestExecutor = (request: ApiRequest, variables: Record<string, string>) => Promise<HttpResponse>;
export type ScriptExecutor = (
  script: string,
  request: ApiRequest,
  variables: Record<string, string>,
  response?: HttpResponse,
  timeoutMs?: number,
  localVariables?: Record<string, string>,
  iterationData?: Record<string, string>,
  options?: ScriptRunOptions,
) => Promise<ScriptRunResult>;

export type RunnerOptions = {
  iterations: number;
  retries: number;
  delayMs: number;
  dataRows: Record<string, string>[];
  scriptTimeoutMs?: number;
  environmentScopes?: ScriptEnvironmentScopes;
  shouldCancel?: () => boolean;
  onResult?: (result: RunnerItemResult) => void;
};

const runId = () => `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const boundedInteger = (value: number, minimum: number, maximum: number) => {
  if (!Number.isFinite(value)) return minimum;
  return Math.max(minimum, Math.min(maximum, Math.floor(value)));
};

export const runCollection = async (
  collection: Collection,
  environment: Environment,
  options: RunnerOptions,
  executeRequest: RequestExecutor,
  executeScript: ScriptExecutor,
): Promise<RunnerReport> => {
  const startedAt = new Date().toISOString();
  const results: RunnerItemResult[] = [];
  let cancelled = false;
  const iterations = boundedInteger(options.iterations, 1, 1000);
  const retries = boundedInteger(options.retries, 0, 10);
  const configuredGlobalScopes = options.environmentScopes;
  const globalsAreBase = configuredGlobalScopes?.globalsAreBase ?? true;
  let baseGlobalVariables = { ...(configuredGlobalScopes?.baseGlobals.values ?? environmentMap(environment)) };
  let globalVariables = globalsAreBase ? baseGlobalVariables : { ...(configuredGlobalScopes?.globals.values ?? {}) };
  let baseGlobalDisabled = [...(configuredGlobalScopes?.baseGlobals.disabled ?? [])];
  let globalDisabled = [...(configuredGlobalScopes?.globals.disabled ?? [])];
  const configuredCollectionScopes = collectionEnvironmentScopes(collection);
  const collectionVariablesAreBase = configuredCollectionScopes.environmentIsBase;
  let baseEnvironment = { ...configuredCollectionScopes.baseEnvironment.values };
  let collectionVariables = collectionVariablesAreBase ? baseEnvironment : { ...configuredCollectionScopes.environment.values };
  let baseEnvironmentDisabled = [...configuredCollectionScopes.baseEnvironment.disabled];
  let collectionDisabled = [...configuredCollectionScopes.environment.disabled];
  const folderVariables = new Map((collection.folders ?? []).map((folder) => [folder.id, Object.fromEntries(folder.environment.filter((row) => row.enabled && row.name).map((row) => [row.name, row.value]))]));
  const folderDisabled = new Map((collection.folders ?? []).map((folder) => [folder.id, new Set(folder.environment.filter((row) => !row.enabled && row.name).map((row) => row.name))]));

  outer: for (let iteration = 0; iteration < iterations; iteration += 1) {
    const iterationData = options.dataRows[iteration % Math.max(1, options.dataRows.length)] ?? {};
    for (const originalRequest of collection.requests) {
      if (options.shouldCancel?.()) { cancelled = true; break outer; }
      for (let attempt = 1; attempt <= retries + 1; attempt += 1) {
        const configured = applyCollectionConfiguration(collection, originalRequest, environment);
        let request = structuredClone(configured.request);
        let response: HttpResponse | undefined;
        let tests: RunnerItemResult['tests'] = [];
        let error: string | undefined;
        const started = Date.now();
        try {
          const scriptFolders = configured.folders.map((folder) => ({ id: folder.id, name: folder.name, environment: { ...(folderVariables.get(folder.id) ?? {}) }, disabled: [...(folderDisabled.get(folder.id) ?? [])] }));
          const scriptScopes: ScriptRunOptions = {
            baseGlobals: baseGlobalVariables,
            baseGlobalDisabled,
            globalDisabled,
            globalsAreBase,
            baseEnvironment,
            baseEnvironmentDisabled,
            collectionVariables,
            collectionDisabled,
            collectionVariablesAreBase,
            folders: scriptFolders,
          };
          const preRequest = await executeScript(request.preRequestScript, request, globalVariables, undefined, options.scriptTimeoutMs ?? 10_000, {}, iterationData, scriptScopes);
          request = preRequest.request;
          baseGlobalVariables = preRequest.baseGlobals ?? (globalsAreBase ? preRequest.environment : baseGlobalVariables);
          globalVariables = preRequest.environment;
          baseGlobalDisabled = preRequest.baseGlobalDisabled ?? baseGlobalDisabled;
          globalDisabled = preRequest.globalDisabled ?? globalDisabled;
          baseEnvironment = preRequest.baseEnvironment ?? (collectionVariablesAreBase ? preRequest.collectionVariables : undefined) ?? baseEnvironment;
          collectionVariables = collectionVariablesAreBase ? baseEnvironment : preRequest.collectionVariables ?? collectionVariables;
          baseEnvironmentDisabled = preRequest.baseEnvironmentDisabled ?? baseEnvironmentDisabled;
          collectionDisabled = preRequest.collectionDisabled ?? collectionDisabled;
          preRequest.folders?.forEach((folder) => { folderVariables.set(folder.id, folder.environment); folderDisabled.set(folder.id, new Set(folder.disabled ?? [])); });
          const localVariables = preRequest.localVariables ?? {};
          const requestVariables: Record<string, string> = {};
          const applyScope = (scope: Record<string, string>, disabled: string[]) => { disabled.forEach((name) => delete requestVariables[name]); Object.assign(requestVariables, scope); };
          applyScope(baseGlobalVariables, baseGlobalDisabled);
          if (!globalsAreBase) applyScope(globalVariables, globalDisabled);
          applyScope(baseEnvironment, baseEnvironmentDisabled);
          if (!collectionVariablesAreBase) applyScope(collectionVariables, collectionDisabled);
          scriptFolders.forEach((folder) => {
            folderDisabled.get(folder.id)?.forEach((name) => delete requestVariables[name]);
            Object.assign(requestVariables, folderVariables.get(folder.id) ?? {});
          });
          Object.assign(requestVariables, iterationData, localVariables);
          response = await executeRequest(request, requestVariables);
          const afterResponse = await executeScript(request.tests, request, globalVariables, response, options.scriptTimeoutMs ?? 10_000, localVariables, iterationData, {
            baseGlobals: baseGlobalVariables,
            baseGlobalDisabled,
            globalDisabled,
            globalsAreBase,
            baseEnvironment,
            baseEnvironmentDisabled,
            collectionVariables,
            collectionDisabled,
            collectionVariablesAreBase,
            folders: scriptFolders.map((folder) => ({ ...folder, environment: { ...(folderVariables.get(folder.id) ?? {}) }, disabled: [...(folderDisabled.get(folder.id) ?? [])] })),
          });
          baseGlobalVariables = afterResponse.baseGlobals ?? (globalsAreBase ? afterResponse.environment : baseGlobalVariables);
          globalVariables = afterResponse.environment;
          baseGlobalDisabled = afterResponse.baseGlobalDisabled ?? baseGlobalDisabled;
          globalDisabled = afterResponse.globalDisabled ?? globalDisabled;
          baseEnvironment = afterResponse.baseEnvironment ?? (collectionVariablesAreBase ? afterResponse.collectionVariables : undefined) ?? baseEnvironment;
          collectionVariables = collectionVariablesAreBase ? baseEnvironment : afterResponse.collectionVariables ?? collectionVariables;
          baseEnvironmentDisabled = afterResponse.baseEnvironmentDisabled ?? baseEnvironmentDisabled;
          collectionDisabled = afterResponse.collectionDisabled ?? collectionDisabled;
          afterResponse.folders?.forEach((folder) => { folderVariables.set(folder.id, folder.environment); folderDisabled.set(folder.id, new Set(folder.disabled ?? [])); });
          tests = afterResponse.tests;
        } catch (caught) {
          error = caught instanceof Error ? caught.message : String(caught);
        }
        const passed = !error && response !== undefined && response.status > 0 && response.status < 400 && tests.every((test) => test.passed);
        const result: RunnerItemResult = {
          id: runId(),
          requestId: request.id,
          requestName: request.name,
          iteration: iteration + 1,
          attempt,
          status: response?.status ?? 0,
          durationMs: response?.durationMs ?? Date.now() - started,
          passed,
          error,
          tests,
        };
        results.push(result);
        options.onResult?.(result);
        if (passed || attempt > retries) break;
        if (options.delayMs > 0) await wait(options.delayMs);
      }
      if (options.delayMs > 0) await wait(options.delayMs);
    }
  }

  return {
    id: runId(),
    collectionId: collection.id,
    collectionName: collection.name,
    environmentId: environment.id,
    startedAt,
    finishedAt: new Date().toISOString(),
    iterations,
    retries,
    total: results.length,
    passed: results.filter((result) => result.passed).length,
    failed: results.filter((result) => !result.passed).length,
    cancelled,
    results,
  };
};

const parseCsvLine = (line: string): string[] => {
  const values: string[] = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"' && quoted && line[index + 1] === '"') {
      value += '"'; index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === ',' && !quoted) {
      values.push(value); value = '';
    } else {
      value += character;
    }
  }
  values.push(value);
  return values;
};

export const parseRunnerData = (contents: string): Record<string, string>[] => {
  if (!contents.trim()) return [];
  if (contents.trimStart().startsWith('[') || contents.trimStart().startsWith('{')) {
    const parsed: unknown = JSON.parse(contents);
    const rows = Array.isArray(parsed) ? parsed : [parsed];
    return rows.map((row) => Object.fromEntries(Object.entries(row as Record<string, unknown>).map(([key, value]) => [key, String(value ?? '')])));
  }
  const lines = contents.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]).map((header) => header.trim());
  return lines.slice(1).map((line) => Object.fromEntries(headers.map((header, index) => [header, parseCsvLine(line)[index] ?? ''])));
};
