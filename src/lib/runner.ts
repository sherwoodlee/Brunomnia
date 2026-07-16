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

export type RequestExecutor = (request: ApiRequest, variables: Record<string, string>) => Promise<HttpResponse>;
export type ScriptExecutor = (
  script: string,
  request: ApiRequest,
  variables: Record<string, string>,
  response?: HttpResponse,
) => Promise<ScriptRunResult>;

export type RunnerOptions = {
  iterations: number;
  retries: number;
  delayMs: number;
  dataRows: Record<string, string>[];
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

  outer: for (let iteration = 0; iteration < iterations; iteration += 1) {
    let variables = { ...environmentMap(environment), ...(options.dataRows[iteration % Math.max(1, options.dataRows.length)] ?? {}) };
    for (const originalRequest of collection.requests) {
      if (options.shouldCancel?.()) { cancelled = true; break outer; }
      for (let attempt = 1; attempt <= retries + 1; attempt += 1) {
        let request = structuredClone(originalRequest);
        let response: HttpResponse | undefined;
        let tests: RunnerItemResult['tests'] = [];
        let error: string | undefined;
        const started = Date.now();
        try {
          const preRequest = await executeScript(request.preRequestScript, request, variables);
          request = preRequest.request;
          variables = preRequest.environment;
          response = await executeRequest(request, variables);
          const afterResponse = await executeScript(request.tests, request, variables, response);
          variables = afterResponse.environment;
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
