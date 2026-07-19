import type {
  ApiRequest,
  Collection,
  Environment,
  HttpResponse,
  RunnerItemResult,
  RunnerLiveItem,
  RunnerReport,
  RunnerRequestSnapshot,
  RunnerResponseSnapshot,
  RunnerTimelineSnapshot,
  ResponseTimelineEntry,
  ScriptRunResult,
  Workspace,
} from '../types';
import { buildHeaders, buildRequestUrl, environmentMap, resolveTemplate } from './request';
import { isRunnerItemFinished } from './runnerFeedback';
import { applyCollectionConfiguration, collectionEnvironmentScopes, folderAncestors, type ScriptEnvironmentScopes } from './resources';
import type { ScriptRunOptions } from './scriptSandbox';
import { scriptTestFailed } from './scriptTests';

export type RunnerExecutionContext = { key: string; attempt: number; signal: AbortSignal };

export type RequestExecutor = (request: ApiRequest, variables: Record<string, string>, execution: RunnerExecutionContext) => Promise<HttpResponse>;
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
  requestIds?: string[];
  sourceName?: string;
  folderId?: string;
  testNamePattern?: string;
  bail?: boolean;
  keepLog?: boolean;
  flowStepLimit?: number;
  shouldCancel?: () => boolean;
  shouldSkip?: (key: string) => boolean;
  onLiveItems?: (items: RunnerLiveItem[]) => void;
  onActiveItem?: (key: string | undefined, cancel?: () => void, signal?: AbortSignal) => void;
  onResult?: (result: RunnerItemResult) => void;
};

export type RunnerTarget = { collectionId?: string; folderId?: string };

export type RunnerWorkbenchDraft = {
  collectionId: string;
  environmentId: string;
  iterations: number;
  retries: number;
  bail: boolean;
  keepLog: boolean;
  delayMs: number;
  streamWindowMs: number;
  data: string;
  dataFileName: string;
  dataFileEncoding: string;
  dataFileBytesBase64: string;
  requestPlan: Array<{ id: string; enabled: boolean }>;
};

export const runnerDraftKey = (workspaceId: string, documentId: string) => `${workspaceId}\n${documentId}`;

export const discardRunnerDraftEntries = (drafts: Record<string, RunnerWorkbenchDraft>, workspaceId: string, documentIds: string[]) => {
  const next = { ...drafts };
  let changed = false;
  documentIds.forEach((documentId) => {
    const key = runnerDraftKey(workspaceId, documentId);
    if (key in next) {
      delete next[key];
      changed = true;
    }
  });
  return changed ? next : drafts;
};

export const runnerReportsForTarget = (reports: RunnerReport[], collectionId: string, folderId = '') => reports.filter((report) => report.collectionId === collectionId && (report.folderId ?? '') === folderId);

export const discardRunnerReport = (reports: RunnerReport[], reportId: string) => {
  const next = reports.filter((report) => report.id !== reportId);
  return next.length === reports.length ? reports : next;
};

export const runnerResultForLiveItem = (item: RunnerLiveItem, results: RunnerItemResult[]) => {
  for (let index = results.length - 1; index >= 0; index -= 1) {
    const result = results[index];
    if (result.key === item.key || (!result.key && result.requestId === item.requestId && result.iteration === item.iteration)) return result;
  }
  return undefined;
};

export const resolveRunnerTarget = (workspace: Workspace, target?: RunnerTarget) => {
  const collection = workspace.collections.find((candidate) => candidate.id === target?.collectionId) ?? workspace.collections[0];
  const folder = target?.folderId ? collection?.folders?.find((candidate) => candidate.id === target.folderId) : undefined;
  const requests = target?.folderId
    ? folder && collection ? collection.requests.filter((request) => folderAncestors(collection, request.folderId).some((candidate) => candidate.id === folder.id)) : []
    : collection?.requests ?? [];
  return { collection, folder, requests };
};

const runId = () => `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

const wait = (milliseconds: number, signal?: AbortSignal) => new Promise<void>((resolve, reject) => {
  if (signal?.aborted) { reject(signal.reason); return; }
  const onAbort = () => { clearTimeout(timeout); reject(signal?.reason); };
  const timeout = setTimeout(() => { signal?.removeEventListener('abort', onAbort); resolve(); }, milliseconds);
  signal?.addEventListener('abort', onAbort, { once: true });
});
const boundedInteger = (value: number, minimum: number, maximum: number) => {
  if (!Number.isFinite(value)) return minimum;
  return Math.max(minimum, Math.min(maximum, Math.floor(value)));
};

export const validateTestNamePattern = (value: string | undefined): string | undefined => {
  if (value === undefined) return undefined;
  if (value.length > 1_000) throw new Error('Test name pattern exceeds 1,000 characters.');
  try {
    new RegExp(value);
  } catch (error) {
    throw new Error(`Invalid test name pattern: ${error instanceof Error ? error.message : String(error)}`);
  }
  return value;
};

export const RUNNER_RESPONSE_PER_RESULT_BYTES = 32_000;
export const RUNNER_RESPONSE_REPORT_BYTES = 1_000_000;
export const RUNNER_REQUEST_PER_RESULT_BYTES = 16_000;
export const RUNNER_REQUEST_REPORT_BYTES = 500_000;
export const RUNNER_TIMELINE_PER_RESULT_BYTES = 64_000;
export const RUNNER_TIMELINE_REPORT_BYTES = 1_000_000;
export const RUNNER_DATA_FILE_BYTES = 5_000_000;
export const RUNNER_DATA_FILE_ROWS = 1_000;
export const RUNNER_DATA_FILE_HEADERS = 100;
export const RUNNER_DATA_ENCODINGS = [
  { key: 'utf-8', label: 'utf8' },
  { key: 'utf-16le', label: 'UTF-16 LE' },
  { key: 'utf-16be', label: 'UTF-16 BE' },
  { key: 'utf-32le', label: 'UTF-32 LE' },
  { key: 'utf-32be', label: 'UTF-32 BE' },
  { key: 'ascii', label: 'ascii' },
  { key: 'iso-8859-1', label: 'Western European (Latin-1)' },
  { key: 'iso-8859-2', label: 'Central European (Latin-2)' },
  { key: 'iso-8859-3', label: 'South European (Latin-3)' },
  { key: 'iso-8859-4', label: 'North European (Latin-4)' },
  { key: 'iso-8859-5', label: 'Cyrillic' },
  { key: 'iso-8859-6', label: 'Arabic' },
  { key: 'iso-8859-7', label: 'Greek' },
  { key: 'iso-8859-8', label: 'Hebrew' },
  { key: 'iso-8859-9', label: 'Turkish (Latin-5)' },
  { key: 'iso-8859-10', label: 'Nordic (Latin-6)' },
  { key: 'iso-8859-11', label: 'Thai' },
  { key: 'iso-8859-12', label: 'Ethiopic' },
  { key: 'iso-8859-13', label: 'Baltic (Latin-7)' },
  { key: 'iso-8859-14', label: 'Celtic (Latin-8)' },
  { key: 'iso-8859-15', label: 'Western European (Latin-9)' },
  { key: 'iso-8859-16', label: 'Southeastern European (Latin-10)' },
  { key: 'windows-1250', label: 'Windows-1250' },
  { key: 'windows-1251', label: 'Windows-1251' },
  { key: 'windows-1252', label: 'Windows-1252' },
  { key: 'windows-1253', label: 'Windows-1253' },
  { key: 'windows-1254', label: 'Windows-1254' },
  { key: 'windows-1255', label: 'Windows-1255' },
  { key: 'windows-1256', label: 'Windows-1256' },
  { key: 'windows-1257', label: 'Windows-1257' },
  { key: 'windows-1258', label: 'Windows-1258' },
  { key: 'gb18030', label: 'GB 18030' },
  { key: 'euc-jp', label: 'EUC-JP' },
  { key: 'euc-kr', label: 'EUC-KR' },
  { key: 'euc-cn', label: 'EUC-CN' },
  { key: 'big5', label: 'Big5' },
  { key: 'shift_jis', label: 'Shift_JIS' },
  { key: 'koi8-r', label: 'KOI8-R' },
  { key: 'koi8-u', label: 'KOI8-U' },
  { key: 'koi8-ru', label: 'KOI8-RU' },
  { key: 'koi8-t', label: 'KOI8-T' },
] as const;
const RUNNER_RESPONSE_BODY_BYTES = 16_000;
const RUNNER_RESPONSE_HEADERS = 64;
const RUNNER_TIMELINE_ENTRIES = 1_000;

export const buildRunnerItemKey = (iteration: number, index: number, requestId: string) => `${iteration}-${index}-${requestId}`;

type ResponseSnapshotBudget = { remaining: number };

const takeUtf8 = (value: string, maximumBytes: number) => {
  const encoded = new TextEncoder().encode(value);
  if (encoded.byteLength <= maximumBytes) return { value, bytes: encoded.byteLength, truncated: false };
  let end = Math.max(0, maximumBytes);
  const decoder = new TextDecoder('utf-8', { fatal: true });
  while (end > 0) {
    try {
      return { value: decoder.decode(encoded.slice(0, end)), bytes: end, truncated: true };
    } catch {
      end -= 1;
    }
  }
  return { value: '', bytes: 0, truncated: encoded.byteLength > 0 };
};

export const captureRunnerResponse = (response: HttpResponse, budget: ResponseSnapshotBudget): RunnerResponseSnapshot => {
  let remaining = Math.min(RUNNER_RESPONSE_PER_RESULT_BYTES, Math.max(0, budget.remaining));
  let storedBytes = 0;
  const take = (value: string, limit: number) => {
    const result = takeUtf8(value, Math.min(limit, remaining));
    remaining -= result.bytes;
    budget.remaining -= result.bytes;
    storedBytes += result.bytes;
    return result;
  };

  const statusText = take(response.statusText, 512);
  const headers: Record<string, string> = {};
  let headersTruncated = Object.keys(response.headers).length > RUNNER_RESPONSE_HEADERS;
  for (const [rawName, rawValue] of Object.entries(response.headers).slice(0, RUNNER_RESPONSE_HEADERS)) {
    if (remaining <= 0) { headersTruncated = true; break; }
    const name = take(rawName, 256);
    const value = take(rawValue, 2_048);
    headersTruncated ||= name.truncated || value.truncated;
    if (name.value) headers[name.value] = value.value;
  }
  const body = take(response.body, RUNNER_RESPONSE_BODY_BYTES);
  return {
    statusText: statusText.value,
    statusTextTruncated: statusText.truncated,
    headers,
    headersTruncated,
    bodyPreview: body.value,
    bodyTruncated: body.truncated,
    sizeBytes: response.sizeBytes,
    storedBytes,
  };
};

const sensitiveName = (name: string) => /(^|[-_])(authorization|cookie|token|secret|password|passphrase|api[-_]?key)([-_]|$)/i.test(name);
const redactSensitiveQuery = (value: string) => {
  try {
    const url = new URL(value);
    [...url.searchParams.keys()].forEach((name) => { if (sensitiveName(name)) url.searchParams.set(name, '[redacted]'); });
    return url.toString();
  } catch {
    return value;
  }
};
const base64Bytes = (value: string) => {
  const source = value.replace(/\s/g, '');
  return Math.max(0, Math.floor((source.length * 3) / 4) - (source.endsWith('==') ? 2 : source.endsWith('=') ? 1 : 0));
};

const redactTimelineValue = (entry: ResponseTimelineEntry) => {
  if (entry.name === 'Text') return entry.value.replace(/https?:\/\/[^\s]+/gi, (url) => redactSensitiveQuery(url));
  if (entry.name !== 'HeaderIn' && entry.name !== 'HeaderOut') return entry.value;
  return entry.value.split('\n').map((line) => {
    const separator = line.indexOf(':');
    if (separator <= 0 || !sensitiveName(line.slice(0, separator).trim())) return line;
    return `${line.slice(0, separator)}: [redacted]`;
  }).join('\n');
};

export const captureRunnerTimeline = (timeline: ResponseTimelineEntry[], budget: ResponseSnapshotBudget): RunnerTimelineSnapshot => {
  let remaining = Math.min(RUNNER_TIMELINE_PER_RESULT_BYTES, Math.max(0, budget.remaining));
  let storedBytes = 0;
  let truncated = timeline.length > RUNNER_TIMELINE_ENTRIES;
  const entries: ResponseTimelineEntry[] = [];
  for (const entry of timeline.slice(0, RUNNER_TIMELINE_ENTRIES)) {
    if (remaining <= 0) { truncated = true; break; }
    const value = takeUtf8(redactTimelineValue(entry), remaining);
    remaining -= value.bytes;
    budget.remaining -= value.bytes;
    storedBytes += value.bytes;
    truncated ||= value.truncated;
    entries.push({ ...entry, value: value.value, elapsedMs: Number.isFinite(entry.elapsedMs) ? Math.max(0, entry.elapsedMs) : 0 });
    if (value.truncated) break;
  }
  return { entries, truncated, storedBytes };
};

export const aggregateRunnerTimeline = (results: RunnerItemResult[], flowError?: string): ResponseTimelineEntry[] => {
  const entries: ResponseTimelineEntry[] = [];
  results.forEach((result) => {
    if (!result.timeline?.entries.length && !result.error) return;
    entries.push({ name: 'Text', value: `------ Start of request (${result.requestName}) ------`, elapsedMs: 0 });
    if (result.timeline?.entries.length) entries.push(...result.timeline.entries);
    if (result.error) entries.push({ name: 'Text', value: result.error, elapsedMs: result.durationMs });
  });
  if (flowError && !results.some((result) => result.error === flowError)) entries.push({ name: 'Text', value: flowError, elapsedMs: 0 });
  return entries;
};
const requestBodyMetadata = (request: ApiRequest, variables: Record<string, string>) => {
  if (request.protocol === 'graphql') {
    const variablesText = resolveTemplate(request.graphql.variables || '{}', variables);
    const body = JSON.stringify({ query: request.graphql.query, variables: variablesText, operationName: request.graphql.operationName || undefined });
    return { mode: 'graphql', summary: 'GraphQL query and variables', bytes: new TextEncoder().encode(body).byteLength, estimated: false };
  }
  if (request.protocol === 'grpc') {
    const input = resolveTemplate(request.grpc.input, variables);
    return { mode: 'grpc', summary: `${request.grpc.service}/${request.grpc.method}`, bytes: new TextEncoder().encode(input).byteLength, estimated: false };
  }
  if (request.protocol === 'websocket') {
    const body = resolveTemplate(request.body, variables);
    return { mode: 'websocket', summary: body ? 'Startup text frame' : 'No startup frame', bytes: new TextEncoder().encode(body).byteLength, estimated: false };
  }
  if (request.protocol === 'socketio') {
    const args = request.socketIo.args.map((arg) => resolveTemplate(arg.value, variables));
    return { mode: 'socketio', summary: `${request.socketIo.eventName || 'message'} · ${args.length} args${request.socketIo.ack ? ' · ack' : ''}`, bytes: new TextEncoder().encode(JSON.stringify(args)).byteLength, estimated: false };
  }
  if (request.bodyMode === 'json' || request.bodyMode === 'text') {
    const body = resolveTemplate(request.body, variables);
    return { mode: request.bodyMode, summary: `${request.bodyMode === 'json' ? 'JSON' : 'Text'} body`, bytes: new TextEncoder().encode(body).byteLength, estimated: false };
  }
  if (request.bodyMode === 'form-urlencoded') {
    const fields = request.formBody.filter((row) => row.enabled && row.name);
    const body = new URLSearchParams(fields.map((row) => [resolveTemplate(row.name, variables), resolveTemplate(row.value, variables)])).toString();
    return { mode: request.bodyMode, summary: `${fields.length} fields: ${fields.map((row) => row.name).join(', ')}`, bytes: new TextEncoder().encode(body).byteLength, estimated: false };
  }
  if (request.bodyMode === 'multipart') {
    const parts = request.multipartBody.filter((part) => part.enabled && part.name);
    const bytes = parts.reduce((total, part) => total + (part.kind === 'file' && part.file ? base64Bytes(part.file.dataBase64) : new TextEncoder().encode(resolveTemplate(part.value, variables)).byteLength), 0);
    return { mode: request.bodyMode, summary: `${parts.length} parts: ${parts.map((part) => part.kind === 'file' ? `${part.name} (${part.fileName || part.file?.fileName || 'file'})` : part.name).join(', ')}`, bytes, estimated: true };
  }
  if (request.bodyMode === 'binary' && request.binaryBody) return { mode: request.bodyMode, summary: request.binaryBody.fileName || 'Binary file', bytes: base64Bytes(request.binaryBody.dataBase64), estimated: false };
  return { mode: request.bodyMode, summary: 'No request body', bytes: 0, estimated: false };
};

export const captureRunnerRequest = (request: ApiRequest, variables: Record<string, string>, requestUrl: string | undefined, budget: ResponseSnapshotBudget): RunnerRequestSnapshot => {
  let remaining = Math.min(RUNNER_REQUEST_PER_RESULT_BYTES, Math.max(0, budget.remaining));
  let storedBytes = 0;
  const take = (value: string, limit: number) => {
    const result = takeUtf8(value, Math.min(limit, remaining));
    remaining -= result.bytes;
    budget.remaining -= result.bytes;
    storedBytes += result.bytes;
    return result;
  };
  let resolvedUrl = requestUrl ?? request.url;
  try { resolvedUrl = requestUrl ?? buildRequestUrl(request, variables); } catch { /* retain the editable URL */ }
  const url = take(redactSensitiveQuery(resolvedUrl), 4_000);
  let configuredHeaders: ReturnType<typeof buildHeaders> = [];
  try { configuredHeaders = buildHeaders(request, variables).filter((header) => header.enabled && header.name); } catch { /* retain an empty header snapshot */ }
  const headers: RunnerRequestSnapshot['headers'] = [];
  let headersTruncated = configuredHeaders.length > 64;
  for (const header of configuredHeaders.slice(0, 64)) {
    if (remaining <= 0) { headersTruncated = true; break; }
    const name = take(header.name, 256);
    const redacted = sensitiveName(header.name);
    const value = take(redacted ? '[redacted]' : header.value, 2_048);
    headersTruncated ||= name.truncated || value.truncated;
    if (name.value) headers.push({ name: name.value, value: value.value, redacted });
  }
  const body = requestBodyMetadata(request, variables);
  const bodySummary = take(body.summary, 2_000);
  return { protocol: request.protocol, method: request.method, url: url.value, urlTruncated: url.truncated, headers, headersTruncated, bodyMode: body.mode, bodySummary: bodySummary.value, bodySizeBytes: body.bytes, bodySizeEstimated: body.estimated, storedBytes };
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
  let bailed = false;
  let flowError: string | undefined;
  let responseDurationMs = 0;
  const responseSnapshotBudget: ResponseSnapshotBudget = { remaining: RUNNER_RESPONSE_REPORT_BYTES };
  const requestSnapshotBudget: ResponseSnapshotBudget = { remaining: RUNNER_REQUEST_REPORT_BYTES };
  const timelineSnapshotBudget: ResponseSnapshotBudget = { remaining: RUNNER_TIMELINE_REPORT_BYTES };
  const keepLog = options.keepLog !== false;
  const iterations = boundedInteger(options.iterations, 1, 1000);
  const retries = boundedInteger(options.retries, 0, 10);
  const delayMs = boundedInteger(options.delayMs, 0, 30_000);
  const testNamePattern = validateTestNamePattern(options.testNamePattern);
  const requestsById = new Map(collection.requests.map((request) => [request.id, request]));
  const plannedRequests = options.requestIds === undefined
    ? collection.requests
    : [...new Set(options.requestIds)].flatMap((id) => requestsById.get(id) ?? []);
  const flowStepLimit = boundedInteger(options.flowStepLimit ?? plannedRequests.length + 10_000, 1, 100_000);
  const liveItems = Array.from({ length: iterations }, (_, iteration) => plannedRequests.map((request, index): RunnerLiveItem => ({
    key: buildRunnerItemKey(iteration + 1, index, request.id),
    iteration: iteration + 1,
    requestId: request.id,
    requestName: request.name,
    requestUrl: request.url,
    status: 'pending',
  }))).flat();
  const publishLiveItems = () => options.onLiveItems?.(liveItems.map((item) => ({ ...item, tests: item.tests?.map((test) => ({ ...test })) })));
  const updateLiveItem = (key: string, patch: Partial<RunnerLiveItem>) => {
    const index = liveItems.findIndex((item) => item.key === key);
    if (index < 0) return;
    const current = liveItems[index];
    const status = patch.status && !isRunnerItemFinished(current.status) ? patch.status : current.status;
    liveItems[index] = { ...current, ...patch, status };
    publishLiveItems();
  };
  const finishUnfinished = (status: 'canceled' | 'skipped', errorMessage: string) => {
    let changed = false;
    liveItems.forEach((item, index) => {
      if (isRunnerItemFinished(item.status)) return;
      liveItems[index] = { ...item, status, errorMessage };
      changed = true;
    });
    if (changed) publishLiveItems();
  };
  publishLiveItems();
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
    let requestIndex = 0;
    let flowSteps = 0;
    let nextRequestIdOrName = '';
    const lastRequestNameIndex = (target: string) => {
      for (let index = plannedRequests.length - 1; index >= 0; index -= 1) if (plannedRequests[index].name.trim() === target.trim()) return index;
      return -1;
    };
    const matchesNextRequest = (request: ApiRequest, index: number, target: string) => request.id === target
      || (request.name.trim() === target.trim() && index === lastRequestNameIndex(target));
    while (requestIndex < plannedRequests.length) {
      const originalRequest = plannedRequests[requestIndex];
      const key = buildRunnerItemKey(iteration + 1, requestIndex, originalRequest.id);
      flowSteps += 1;
      if (flowSteps > flowStepLimit) {
        flowError = `Runner request flow exceeded the ${flowStepLimit}-step safety limit in iteration ${iteration + 1}.`;
        const result: RunnerItemResult = { id: runId(), key, requestId: originalRequest.id, requestName: originalRequest.name, iteration: iteration + 1, attempt: 0, status: 0, durationMs: 0, passed: false, error: flowError, tests: [] };
        results.push(result);
        options.onResult?.(result);
        updateLiveItem(key, { status: 'failed', errorMessage: flowError });
        finishUnfinished('skipped', 'Skipped after the runner flow safety limit was exceeded.');
        break outer;
      }
      if (nextRequestIdOrName) {
        if (matchesNextRequest(originalRequest, requestIndex, nextRequestIdOrName)) nextRequestIdOrName = '';
        else {
          updateLiveItem(key, { status: 'skipped', errorMessage: `Skipped while seeking '${nextRequestIdOrName}'.` });
          requestIndex += 1;
          continue;
        }
      }
      if (options.shouldCancel?.()) {
        cancelled = true;
        finishUnfinished('canceled', 'Canceled by user.');
        break outer;
      }
      if (options.shouldSkip?.(key)) {
        updateLiveItem(key, { status: 'skipped', errorMessage: 'Skipped by user.' });
        requestIndex += 1;
        continue;
      }

      const controller = new AbortController();
      const interruption = (): 'canceled' | 'skipped' | undefined => {
        if (options.shouldSkip?.(key)) return 'skipped';
        if (options.shouldCancel?.() || controller.signal.aborted) return 'canceled';
        return undefined;
      };
      options.onActiveItem?.(key, () => controller.abort(), controller.signal);
      let itemFinished = false;
      let itemNextRequestIdOrName = '';
      try {
        for (let attempt = 1; attempt <= retries + 1; attempt += 1) {
          const beforeAttempt = interruption();
          if (beforeAttempt) {
            cancelled ||= beforeAttempt === 'canceled';
            updateLiveItem(key, { status: beforeAttempt, attempt, errorMessage: beforeAttempt === 'skipped' ? 'Skipped by user.' : 'Canceled by user.' });
            itemFinished = true;
            break;
          }

          const configured = applyCollectionConfiguration(collection, originalRequest, environment);
          let request = structuredClone(configured.request);
          let liveRequestUrl = request.url;
          try { liveRequestUrl = buildRequestUrl(request, environmentMap(configured.environment)); } catch { /* retain the editable URL */ }
          liveRequestUrl = redactSensitiveQuery(liveRequestUrl);
          updateLiveItem(key, { status: 'running', attempt, requestName: request.name, requestUrl: liveRequestUrl, errorMessage: undefined });
          if (delayMs > 0) {
            try {
              await wait(delayMs, controller.signal);
            } catch {
              const control = interruption() ?? 'canceled';
              cancelled ||= control === 'canceled';
              updateLiveItem(key, { status: control, attempt, errorMessage: control === 'skipped' ? 'Skipped by user.' : 'Canceled by user.' });
              itemFinished = true;
              break;
            }
          }
          let response: HttpResponse | undefined;
          let tests: RunnerItemResult['tests'] = [];
          let error: string | undefined;
          let failureTimeline: ResponseTimelineEntry[] | undefined;
          let failureDurationMs: number | undefined;
          let requestVariables: Record<string, string> = {};
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
              testCategory: 'pre-request',
              executionLocation: [collection.name, ...configured.folders.map((folder) => folder.name), request.name],
            };
            const preRequest = await executeScript(request.preRequestScript, request, globalVariables, undefined, options.scriptTimeoutMs ?? 10_000, {}, iterationData, scriptScopes);
            const afterPreRequest = interruption();
            if (afterPreRequest) throw new Error(afterPreRequest);
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
            requestVariables = {};
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
            try { liveRequestUrl = redactSensitiveQuery(buildRequestUrl(request, requestVariables)); } catch { liveRequestUrl = redactSensitiveQuery(request.url); }
            updateLiveItem(key, { requestName: request.name, requestUrl: liveRequestUrl });
            itemNextRequestIdOrName = preRequest.execution?.nextRequestIdOrName ?? '';
            if (preRequest.execution?.skipRequest) {
              updateLiveItem(key, {
                status: 'skipped',
                attempt,
                requestName: request.name,
                requestUrl: liveRequestUrl,
                errorMessage: 'Skipped by pre-request script.',
                tests: preRequest.tests,
              });
              itemFinished = true;
              break;
            }
            response = await executeRequest(request, requestVariables, { key, attempt, signal: controller.signal });
            const afterRequest = interruption();
            if (afterRequest) throw new Error(afterRequest);
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
              testNamePattern,
              testCategory: 'after-response',
              execution: preRequest.execution,
              executionLocation: [collection.name, ...configured.folders.map((folder) => folder.name), request.name],
            });
            const afterTests = interruption();
            if (afterTests) throw new Error(afterTests);
            baseGlobalVariables = afterResponse.baseGlobals ?? (globalsAreBase ? afterResponse.environment : baseGlobalVariables);
            globalVariables = afterResponse.environment;
            baseGlobalDisabled = afterResponse.baseGlobalDisabled ?? baseGlobalDisabled;
            globalDisabled = afterResponse.globalDisabled ?? globalDisabled;
            baseEnvironment = afterResponse.baseEnvironment ?? (collectionVariablesAreBase ? afterResponse.collectionVariables : undefined) ?? baseEnvironment;
            collectionVariables = collectionVariablesAreBase ? baseEnvironment : afterResponse.collectionVariables ?? collectionVariables;
            baseEnvironmentDisabled = afterResponse.baseEnvironmentDisabled ?? baseEnvironmentDisabled;
            collectionDisabled = afterResponse.collectionDisabled ?? collectionDisabled;
            afterResponse.folders?.forEach((folder) => { folderVariables.set(folder.id, folder.environment); folderDisabled.set(folder.id, new Set(folder.disabled ?? [])); });
            tests = [...preRequest.tests, ...afterResponse.tests];
            itemNextRequestIdOrName = afterResponse.execution?.nextRequestIdOrName ?? itemNextRequestIdOrName;
          } catch (caught) {
            const control = interruption();
            if (control) {
              cancelled ||= control === 'canceled';
              updateLiveItem(key, {
                status: control,
                attempt,
                requestName: request.name,
                requestUrl: response?.requestUrl ? redactSensitiveQuery(response.requestUrl) : liveRequestUrl,
                statusCode: response?.status,
                statusMessage: response?.statusText,
                responseTime: response?.durationMs ?? Date.now() - started,
                responseSize: response?.sizeBytes,
                errorMessage: control === 'skipped' ? 'Skipped by user.' : 'Canceled by user.',
                tests,
              });
              itemFinished = true;
              break;
            }
            itemNextRequestIdOrName = '';
            const caughtTimeline = caught && typeof caught === 'object' ? (caught as { timeline?: unknown }).timeline : undefined;
            failureTimeline = Array.isArray(caughtTimeline) ? caughtTimeline as ResponseTimelineEntry[] : undefined;
            const caughtDuration = caught && typeof caught === 'object' ? Number((caught as { durationMs?: unknown }).durationMs) : Number.NaN;
            failureDurationMs = Number.isFinite(caughtDuration) ? Math.max(0, caughtDuration) : undefined;
            error = (caught instanceof Error ? caught.message : String(caught)).replace(/https?:\/\/[^\s]+/gi, (url) => redactSensitiveQuery(url));
          }
          if (!error && response && response.status > 0 && Number.isFinite(response.durationMs)) responseDurationMs = Math.min(Number.MAX_SAFE_INTEGER, responseDurationMs + Math.max(0, response.durationMs));
          const passed = !error && response !== undefined && response.status > 0 && response.status < 400 && tests.every((test) => !scriptTestFailed(test));
          const retainResult = testNamePattern === undefined || tests.length > 0 || !passed;
          const result: RunnerItemResult = {
            id: runId(),
            key,
            requestId: request.id,
            requestName: request.name,
            iteration: iteration + 1,
            attempt,
            status: response?.status ?? 0,
            durationMs: response?.durationMs ?? failureDurationMs ?? Date.now() - started,
            passed,
            error,
            tests,
            request: retainResult ? captureRunnerRequest(request, requestVariables, response?.requestUrl, requestSnapshotBudget) : undefined,
            response: retainResult && response ? captureRunnerResponse(response, responseSnapshotBudget) : undefined,
            timeline: retainResult && keepLog && (response?.timeline?.length || failureTimeline?.length) ? captureRunnerTimeline(response?.timeline ?? failureTimeline ?? [], timelineSnapshotBudget) : undefined,
          };
          if (retainResult) {
            results.push(result);
            options.onResult?.(result);
          }
          const exhausted = passed || attempt > retries;
          const liveStatus = error || !response ? 'failed' : 'completed';
          updateLiveItem(key, {
            status: exhausted ? liveStatus : 'running',
            attempt,
            requestName: request.name,
            requestUrl: response?.requestUrl ? redactSensitiveQuery(response.requestUrl) : liveRequestUrl,
            statusCode: response?.status,
            statusMessage: response?.statusText,
            responseTime: result.durationMs,
            responseSize: response?.sizeBytes,
            errorMessage: error,
            tests,
          });
          if (exhausted) {
            itemFinished = true;
            if (!passed && options.bail) {
              bailed = true;
              finishUnfinished('skipped', 'Skipped after the runner bailed.');
            }
            break;
          }
        }
        if (bailed) break outer;
        if (cancelled) {
          finishUnfinished('canceled', 'Canceled by user.');
          break outer;
        }
        if (!itemFinished) updateLiveItem(key, { status: 'failed', errorMessage: 'The runner stopped before this item completed.' });
      } finally {
        options.onActiveItem?.(undefined);
      }
      nextRequestIdOrName = itemNextRequestIdOrName;
      if (!nextRequestIdOrName || !matchesNextRequest(originalRequest, requestIndex, nextRequestIdOrName)) requestIndex += 1;
    }
  }

  return {
    id: runId(),
    collectionId: collection.id,
    collectionName: collection.name,
    ...(options.sourceName ? { sourceName: options.sourceName } : {}),
    ...(options.folderId ? { folderId: options.folderId } : {}),
    environmentId: environment.id,
    startedAt,
    finishedAt: new Date().toISOString(),
    durationMs: responseDurationMs,
    iterations,
    retries,
    keepLog,
    testNamePattern,
    matchedTests: results.reduce((total, result) => total + result.tests.length, 0),
    total: results.length,
    passed: results.filter((result) => result.passed).length,
    failed: results.filter((result) => !result.passed).length,
    cancelled,
    bailed,
    planned: liveItems.length,
    completed: liveItems.filter((item) => item.status === 'completed').length,
    skipped: liveItems.filter((item) => item.status === 'skipped').length,
    canceled: liveItems.filter((item) => item.status === 'canceled').length,
    flowError,
    liveItems,
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
    return rows.map((row) => Object.fromEntries(Object.entries(row as Record<string, unknown>).map(([key, value]) => [key, value === null || value === undefined ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value)])));
  }
  const lines = contents.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]).map((header) => header.trim());
  return lines.slice(1).map((line) => Object.fromEntries(headers.map((header, index) => [header, parseCsvLine(line)[index] ?? ''])));
};

export type RunnerDataFilePreview = { rows: Record<string, string>[]; headers: string[] };

export const detectRunnerDataEncoding = (bytes: Uint8Array) => {
  if (bytes[0] === 0xff && bytes[1] === 0xfe && bytes[2] === 0x00 && bytes[3] === 0x00) return 'utf-32le';
  if (bytes[0] === 0x00 && bytes[1] === 0x00 && bytes[2] === 0xfe && bytes[3] === 0xff) return 'utf-32be';
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return 'utf-16le';
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return 'utf-16be';
  try { new TextDecoder('utf-8', { fatal: true }).decode(bytes); return 'utf-8'; } catch { return 'windows-1252'; }
};

const decodeUtf32 = (bytes: Uint8Array, littleEndian: boolean) => {
  let offset = littleEndian && bytes[0] === 0xff && bytes[1] === 0xfe && bytes[2] === 0x00 && bytes[3] === 0x00
    ? 4
    : !littleEndian && bytes[0] === 0x00 && bytes[1] === 0x00 && bytes[2] === 0xfe && bytes[3] === 0xff
      ? 4
      : 0;
  if ((bytes.byteLength - offset) % 4 !== 0) throw new Error('Invalid UTF-32 byte length.');
  let output = '';
  let codePoints: number[] = [];
  for (; offset < bytes.byteLength; offset += 4) {
    const codePoint = littleEndian
      ? ((bytes[offset]) | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0
      : ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
    if (codePoint > 0x10ffff || (codePoint >= 0xd800 && codePoint <= 0xdfff)) throw new Error('Invalid UTF-32 code point.');
    codePoints.push(codePoint);
    if (codePoints.length === 4_096) {
      output += String.fromCodePoint(...codePoints);
      codePoints = [];
    }
  }
  return output + String.fromCodePoint(...codePoints);
};

const decodeLatin1 = (bytes: Uint8Array) => {
  let output = '';
  for (let offset = 0; offset < bytes.byteLength; offset += 8_192) output += String.fromCharCode(...bytes.subarray(offset, offset + 8_192));
  return output;
};

const koi8RuCharacters = '─│┌┐└┘├┤┬┴┼▀▄█▌▐░▒▓⌠■∙√≈≤≥\u00a0⌡°²·÷═║╒ёє╔ії╗╘╙╚╛ґў╞╟╠╡ЁЄ╣ІЇ╦╧╨╩╪ҐЎ©юабцдефгхийклмнопярстужвьызшэщчъЮАБЦДЕФГХИЙКЛМНОПЯРСТУЖВЬЫЗШЭЩЧЪ';
const koi8TCharacters = 'қғ‚Ғ„…†‡�‰ҳ‹ҲҷҶ�Қ‘’“”•–—�™�›�����ӯӮё¤ӣ¦§���«¬\u00ad®�°±²Ё�Ӣ¶·�№�»���©юабцдефгхийклмнопярстужвьызшэщчъЮАБЦДЕФГХИЙКЛМНОПЯРСТУЖВЬЫЗШЭЩЧЪ';

const decodeKoi8 = (bytes: Uint8Array, characters: string) => {
  let output = '';
  let chunk = '';
  for (const byte of bytes) {
    const character = byte < 0x80 ? String.fromCharCode(byte) : characters[byte - 0x80];
    if (!character || character === '�') throw new Error('Undefined KOI8 byte.');
    chunk += character;
    if (chunk.length === 4_096) {
      output += chunk;
      chunk = '';
    }
  }
  return output + chunk;
};

export const decodeRunnerDataBytes = (bytes: Uint8Array, encoding: string) => {
  if (bytes.byteLength > RUNNER_DATA_FILE_BYTES) throw new Error('Runner data files cannot exceed 5 MB.');
  if (!RUNNER_DATA_ENCODINGS.some((candidate) => candidate.key === encoding)) throw new Error(`Runner data encoding '${encoding}' is not supported on this device.`);
  try {
    if (encoding === 'utf-32le' || encoding === 'utf-32be') return decodeUtf32(bytes, encoding === 'utf-32le');
    if (encoding === 'ascii') {
      if (bytes.some((byte) => byte > 0x7f)) throw new Error('Invalid ASCII byte.');
      return decodeLatin1(bytes);
    }
    if (encoding === 'iso-8859-1') return decodeLatin1(bytes);
    if (encoding === 'koi8-ru' || encoding === 'koi8-t') return decodeKoi8(bytes, encoding === 'koi8-ru' ? koi8RuCharacters : koi8TCharacters);
    const decoderEncoding = encoding === 'euc-cn' ? 'gbk' : encoding;
    let decoder: TextDecoder;
    try { decoder = new TextDecoder(decoderEncoding, { fatal: true }); } catch { throw new Error(`Runner data encoding '${encoding}' is not supported on this device.`); }
    return decoder.decode(bytes);
  } catch (caught) {
    if (caught instanceof Error && caught.message.includes('not supported on this device')) throw caught;
    throw new Error(`The Runner data file is not valid ${encoding}.`);
  }
};

export const runnerDataBytesToBase64 = (bytes: Uint8Array) => {
  if (bytes.byteLength > RUNNER_DATA_FILE_BYTES) throw new Error('Runner data files cannot exceed 5 MB.');
  let binary = '';
  for (let offset = 0; offset < bytes.byteLength; offset += 8_192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8_192));
  return btoa(binary);
};

export const runnerDataBytesFromBase64 = (value: string) => {
  if (!value) return undefined;
  try {
    const binary = atob(value);
    if (binary.length > RUNNER_DATA_FILE_BYTES) return undefined;
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return undefined;
  }
};

export const parseRunnerDataFile = (contents: string, fileName: string): RunnerDataFilePreview => {
  if (new TextEncoder().encode(contents).byteLength > RUNNER_DATA_FILE_BYTES) throw new Error('Runner data files cannot exceed 5 MB.');
  const extension = fileName.trim().toLowerCase().split('.').at(-1);
  let rows: Record<string, string>[];
  if (extension === 'json') {
    const parsed: unknown = JSON.parse(contents);
    if (!Array.isArray(parsed)) throw new Error('Runner JSON data must be an array of key-value objects.');
    rows = parsed.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object' && !Array.isArray(row)).map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, value === null || value === undefined ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value)])));
  } else if (extension === 'csv') {
    rows = parseRunnerData(contents);
  } else {
    throw new Error('Choose a JSON or CSV Runner data file.');
  }
  if (!rows.length) throw new Error(extension === 'json' ? 'Runner JSON data must contain at least one key-value object.' : 'Runner CSV data must include a header row and at least one data row.');
  if (rows.length > RUNNER_DATA_FILE_ROWS) throw new Error('Runner data files cannot exceed 1,000 iterations.');
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)).filter(Boolean))];
  if (!headers.length) throw new Error('Runner data must contain at least one named variable.');
  if (headers.length > RUNNER_DATA_FILE_HEADERS) throw new Error('Runner data files cannot exceed 100 variables.');
  return { rows, headers };
};
