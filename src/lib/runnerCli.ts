import type { Collection, Environment } from '../types';
import { orderedCollectionChildren, resolveEnvironment } from './resources';
import { normalizeRequestTimeout } from './transport';

export type RunnerCliCommandOptions = {
  workspacePath: string;
  collectionId: string;
  globalEnvironmentId: string;
  collectionEnvironmentId?: string;
  requestIds: string[];
  iterations: number;
  retries: number;
  delayMs: number;
  dataPath?: string;
  bail: boolean;
};

const runnerCliValueOptions = new Set([
  '--env', '-e', '--globals', '-g', '--requestNamePattern', '--request-name-pattern', '--testNamePattern', '--test-name-pattern', '-t',
  '--item', '--request', '-i', '--requestTimeout', '--request-timeout', '--env-var', '--iteration-count', '--iterations', '-n',
  '--retries', '--delay-request', '--delay', '--iteration-data', '--data', '-d', '--script-timeout', '--reporter', '-r',
  '--output', '-o', '--workingDir', '--working-dir', '-w', '--config', '--httpProxy', '--http-proxy', '--httpsProxy', '--https-proxy', '--noProxy', '--no-proxy',
]);

const runnerCliVariadicValueOptions = new Set(['--dataFolders', '--data-folders', '-f']);

const runnerCliBooleanOptions = new Set([
  '--bail', '-b', '--allow-scripts', '--allow-script-requests', '--allow-script-files', '--allow-template-files',
  '--allow-external-vaults', '--disableCertValidation', '--disable-cert-validation', '-k', '--ci', '--verbose', '--printOptions', '--print-options', '--help', '-h',
]);

export const runnerCliPositionalArguments = (values: string[]) => {
  const positionals: string[] = [];
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (runnerCliBooleanOptions.has(value)) continue;
    if (runnerCliVariadicValueOptions.has(value)) {
      while (index + 1 < values.length && !values[index + 1].startsWith('-')) index += 1;
      continue;
    }
    if (runnerCliValueOptions.has(value)) {
      index += 1;
      continue;
    }
    positionals.push(value);
  }
  return positionals;
};

export const runnerCliVariadicOptionValues = (values: string[], ...names: string[]) => {
  const output: string[] = [];
  for (let index = 0; index < values.length; index += 1) {
    if (!names.includes(values[index])) continue;
    while (index + 1 < values.length && !values[index + 1].startsWith('-')) {
      output.push(values[index + 1]);
      index += 1;
    }
  }
  return output;
};

export const selectRunnerGlobalEnvironment = (environments: Environment[], activeId: string, identifier?: string) => {
  const selected = identifier
    ? environments.find((environment) => environment.id === identifier || environment.name === identifier)
    : environments.find((environment) => environment.id === activeId) ?? environments[0];
  if (!selected) throw new Error(identifier
    ? `No global environment found with ID or name "${identifier}".`
    : 'The workspace has no global environment.');
  return resolveEnvironment(environments, selected.id) ?? selected;
};

export const selectRunnerCollectionEnvironment = (collection: Collection, identifier?: string) => {
  if (!identifier) return collection;
  const selected = (collection.subEnvironments ?? []).find((environment) => environment.id === identifier || environment.name === identifier);
  if (!selected) throw new Error(`No collection environment found with ID or name "${identifier}".`);
  return { ...collection, activeSubEnvironmentId: selected.id };
};

export type RunnerInsoConfig = {
  options: { workingDir?: string; ci?: boolean; verbose?: boolean; printOptions?: boolean };
  scripts: Record<string, string>;
};

export const normalizeRunnerInsoConfig = (value: unknown): RunnerInsoConfig => {
  const document = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const rawOptions = document.options && typeof document.options === 'object' && !Array.isArray(document.options) ? document.options as Record<string, unknown> : {};
  const rawScripts = document.scripts && typeof document.scripts === 'object' && !Array.isArray(document.scripts) ? document.scripts as Record<string, unknown> : {};
  const options: RunnerInsoConfig['options'] = {};
  if (typeof rawOptions.workingDir === 'string' && rawOptions.workingDir.trim()) options.workingDir = rawOptions.workingDir;
  if (typeof rawOptions.ci === 'boolean') options.ci = rawOptions.ci;
  if (typeof rawOptions.verbose === 'boolean') options.verbose = rawOptions.verbose;
  if (typeof rawOptions.printOptions === 'boolean') options.printOptions = rawOptions.printOptions;
  const scripts = Object.fromEntries(Object.entries(rawScripts)
    .filter(([name, command]) => name.length <= 200 && typeof command === 'string' && command.length <= 10_000)
    .slice(0, 100)) as Record<string, string>;
  return { options, scripts };
};

export const parseRunnerInsoScript = (command: string) => {
  if (command.length > 10_000) throw new Error('Inso script exceeds 10,000 characters.');
  const tokens: string[] = [];
  let current = '';
  let quote = '';
  let escaped = false;
  let started = false;
  for (const character of command) {
    if (escaped) {
      current += character;
      escaped = false;
      started = true;
    } else if (character === '\\' && quote !== "'") {
      escaped = true;
      started = true;
    } else if (quote) {
      if (character === quote) quote = '';
      else current += character;
      started = true;
    } else if (character === '"' || character === "'") {
      quote = character;
      started = true;
    } else if (/\s/.test(character)) {
      if (started) {
        tokens.push(current);
        current = '';
        started = false;
      }
    } else {
      current += character;
      started = true;
    }
  }
  if (escaped || quote) throw new Error('Inso script contains an unterminated quote or escape.');
  if (started) tokens.push(current);
  if (tokens[0] !== 'inso') throw new Error('Tasks in a script should start with `inso`.');
  if (tokens.length < 2) throw new Error('Inso script does not contain a command.');
  return tokens.slice(1);
};

const shellSafeToken = /^[A-Za-z0-9_@%+=:,./-]+$/;

export const quotePosixShellArgument = (value: string) => {
  if (value && shellSafeToken.test(value)) return value;
  return `'${value.replace(/'/g, `'"'"'`)}'`;
};

export const applyRunnerEnvironmentOverrides = (rows: Record<string, string>[], values: string[]) => {
  if (!values.length) return rows;
  const overrides = values.reduce<Record<string, string>>((current, value) => ({
    ...current,
    ...Object.fromEntries(new URLSearchParams(value).entries()),
  }), {});
  return (rows.length ? rows : [{}]).map((row) => ({ ...row, ...overrides }));
};

export const validateRunnerRequestNamePattern = (value: string) => {
  if (value.length > 1_000) throw new Error('Request name pattern exceeds 1,000 characters.');
  try {
    new RegExp(value);
  } catch (error) {
    throw new Error(`Invalid request name pattern: ${error instanceof Error ? error.message : String(error)}`);
  }
  return value;
};

export const runnerRequestIdsMatchingPattern = (
  requests: { id: string; name: string }[],
  selectedIds: string[] | undefined,
  value: string,
) => {
  const pattern = new RegExp(validateRunnerRequestNamePattern(value));
  const requestsById = new Map(requests.map((request) => [request.id, request]));
  const candidates = selectedIds === undefined
    ? requests
    : selectedIds.flatMap((id) => requestsById.get(id) ?? []);
  return candidates.filter((request) => pattern.test(request.name)).map((request) => request.id);
};

const runnerFolderRequestIds = (collection: Collection, folderId: string): string[] => {
  const requestIds: string[] = [];
  const visited = new Set([folderId]);
  const pending = orderedCollectionChildren(collection, folderId).reverse();
  while (pending.length) {
    const child = pending.pop()!;
    if (child.kind === 'request') {
      requestIds.push(child.id);
    } else if (!visited.has(child.id)) {
      visited.add(child.id);
      pending.push(...orderedCollectionChildren(collection, child.id).reverse());
    }
  }
  return requestIds;
};

export const resolveRunnerItemRequestIds = (collection: Collection, identifiers: string[]) => {
  const folderIds = new Set((collection.folders ?? []).map((folder) => folder.id));
  const requestsById = new Map(collection.requests.map((request) => [request.id, request]));
  const seen = new Set<string>();
  return identifiers.flatMap((identifier) => {
    if (folderIds.has(identifier)) return runnerFolderRequestIds(collection, identifier);
    const idMatch = requestsById.get(identifier);
    if (idMatch) return [idMatch.id];
    const nameMatches = collection.requests.filter((request) => request.name === identifier);
    if (!nameMatches.length) throw new Error(`Item '${identifier}' was not found in collection '${collection.name}'.`);
    if (nameMatches.length > 1) throw new Error(`Request name '${identifier}' is ambiguous in collection '${collection.name}'. Use its ID.`);
    return [nameMatches[0].id];
  }).filter((id) => !seen.has(id) && Boolean(seen.add(id)));
};

export const parseRunnerRequestTimeout = (value: string | undefined, fallback: number) => {
  if (value === undefined) return normalizeRequestTimeout(fallback);
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid request timeout '${value}'. Provide milliseconds as an integer.`);
  return normalizeRequestTimeout(parsed);
};

export const loadRunnerIterationData = async (
  source: string,
  readLocal: (path: string) => Promise<string>,
  fetchSource: (input: string, init?: RequestInit) => Promise<Response> = fetch,
  maximumBytes = 5_000_000,
) => {
  if (!/^https?:\/\//i.test(source)) {
    const contents = await readLocal(source);
    if (new TextEncoder().encode(contents).byteLength > maximumBytes) throw new Error('Runner data files cannot exceed 5 MB.');
    return contents;
  }
  const response = await fetchSource(source, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`Unable to read iteration data URL ${source}: HTTP ${response.status}.`);
  const declaredBytes = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredBytes) && declaredBytes > maximumBytes) throw new Error('Runner data files cannot exceed 5 MB.');
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > maximumBytes) {
      await reader.cancel();
      throw new Error('Runner data files cannot exceed 5 MB.');
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  chunks.forEach((chunk) => { bytes.set(chunk, offset); offset += chunk.byteLength; });
  return new TextDecoder().decode(bytes);
};

const boundedInteger = (value: number, minimum: number, maximum: number) => {
  if (!Number.isFinite(value)) return minimum;
  return Math.max(minimum, Math.min(maximum, Math.floor(value)));
};

export const buildRunnerCliCommand = (options: RunnerCliCommandOptions) => {
  const command = [
    'brunomnia',
    'run',
    'collection',
    options.collectionId,
    '--workingDir',
    options.workspacePath,
    '--globals',
    options.globalEnvironmentId,
  ];
  if (options.collectionEnvironmentId) command.push('--env', options.collectionEnvironmentId);
  options.requestIds.forEach((requestId) => command.push('--item', requestId));
  const iterations = boundedInteger(options.iterations, 1, 1_000);
  const retries = boundedInteger(options.retries, 0, 10);
  const delayMs = boundedInteger(options.delayMs, 0, 30_000);
  if (iterations > 1) command.push('--iteration-count', String(iterations));
  if (retries > 0) command.push('--retries', String(retries));
  if (delayMs > 0) command.push('--delay-request', String(delayMs));
  if (options.dataPath) command.push('--iteration-data', options.dataPath);
  if (options.bail) command.push('--bail');
  return command.map(quotePosixShellArgument).join(' ');
};
