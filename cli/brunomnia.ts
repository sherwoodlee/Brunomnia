import { constants as fsConstants } from 'node:fs';
import { access, mkdir, mkdtemp, readFile, readdir, realpath, stat, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { arch, cpus, freemem, hostname, platform, release, tmpdir, userInfo } from 'node:os';
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { rootCertificates } from 'node:tls';
import vm from 'node:vm';
import { Agent, EnvHttpProxyAgent, fetch as undiciFetch } from 'undici';
import { parse as parseYaml, parseAllDocuments } from 'yaml';
import { analyzeOpenApi, exportOpenApiSpecification, generateCollectionFromOpenApi } from '../src/lib/openapi';
import { createBlankRequest } from '../src/data/seed';
import packageJson from '../package.json';
import { buildHeaders, buildRequestUrl, environmentMap } from '../src/lib/request';
import { renderApiRequest } from '../src/lib/requestRender';
import { parseRunnerData, runCollection, validateTestNamePattern } from '../src/lib/runner';
import { createRunnerReportArtifact, parseRunnerReporter } from '../src/lib/runnerReport';
import type { ApiDesign, ApiRequest, AuthConfig, CookieRecord, Environment, HttpResponse, RunnerItemResult, RunnerReport, ScriptRunResult, StoredResponse, Workspace } from '../src/types';
import { applyCollectionConfiguration, collectionEnvironmentScopes, requestAncestorNames, scriptEnvironmentScopes, variableScope } from '../src/lib/resources';
import { hydrateScriptFileReferences, prepareScriptSubrequest, type ScriptFileBudget, type ScriptFileReference, type ScriptRunOptions } from '../src/lib/scriptSandbox';
import { createScriptExpect } from '../src/lib/scriptExpect';
import { createScriptModules } from '../src/lib/scriptModules';
import { scriptTestFailed } from '../src/lib/scriptTests';
import { applyWorkspaceCertificates } from '../src/lib/certificates';
import { resolveCertificateValidation, resolveProxyTransport, resolveRequestTimeout, type ProxyPreferences } from '../src/lib/transport';
import { migrateWorkspace } from '../src/lib/storage';
import { applyDefaultUserAgentHeader } from '../src/lib/userAgent';
import { applyDefaultAcceptHeader } from '../src/lib/calculatedHeaders';
import { cookieHeaderForUrl, storeResponseCookies } from '../src/lib/cookies';
import { createRequestSnapshot, retainResponseHistory } from '../src/lib/responseHistory';
import { generateUnitTestCliArtifact, orderedTestSuites, orderedUnitTests, selectUnitTestSuites, unitTestScript } from '../src/lib/unitTests';
import { createCliExternalSecretResolver } from './externalVault';
import { evaluateRunnerConfigCode } from './configCode';
import { createCliPluginTemplateRuntime } from './pluginRuntime';
import { collectCliApiDesignSources, fetchPublicSpecificationSourceNode } from './apiSpecSources';
import { applyRunnerEnvironmentOverrides, loadRunnerIterationData, normalizeRunnerInsoConfig, parseRunnerInsoScript, parseRunnerRequestTimeout, resolveRunnerItemRequestIds, runnerCliPositionalArguments, runnerCliVariadicOptionValues, runnerRequestIdsMatchingPattern, selectRunnerCollectionEnvironment, selectRunnerGlobalEnvironment, selectRunnerResource, type RunnerInsoConfig } from '../src/lib/runnerCli';
import { getWorkspaceFileState, workspaceFileIdForCollection, workspaceFileIdForRequest } from '../src/lib/workspaceFileState';

const args = process.argv.slice(2);
const cliVersion = process.env.VERSION || packageJson.version;
const flag = (name: string) => {
  const index = args.findIndex((argument) => argument === name || argument.startsWith(`${name}=`));
  if (index < 0) return undefined;
  return args[index] === name ? args[index + 1] : args[index].slice(name.length + 1);
};
const firstFlag = (...names: string[]) => names.map(flag).find((value) => value !== undefined);
const flagValues = (...names: string[]) => args.flatMap((argument, index) => {
  const name = names.find((candidate) => argument === candidate || argument.startsWith(`${candidate}=`));
  if (!name) return [];
  return argument === name ? args[index + 1] === undefined ? [] : [args[index + 1]] : [argument.slice(name.length + 1)];
});
const hasFlag = (name: string) => args.includes(name);
const cliWorkingDirectoryBase = async (workingDir?: string) => workingDir
  ? (await stat(workingDir)).isDirectory() ? resolve(workingDir) : dirname(resolve(workingDir))
  : process.cwd();
const fail = (message: string, code = 1): never => {
  console.error(message);
  process.exit(code);
};
const cliCollectionEnvironmentIdentifier = async (collection: Workspace['collections'][number], identifier: string | undefined, ci: boolean) => {
  if (identifier) return identifier;
  const environments = collection.subEnvironments ?? [];
  if (!environments.length) return undefined;
  if (ci) {
    if (environments.length === 1) return environments[0].id;
    fail(`Multiple collection environments found in CI mode (${environments.map((environment) => environment.name).join(', ')}). Select one using --env <identifier>.`);
  }
  if (!process.stdin.isTTY || !process.stderr.isTTY) fail('Collection environment selection requires an interactive terminal. Use --env <identifier> or --ci for non-interactive execution.');
  const activeIndex = Math.max(0, environments.findIndex((environment) => environment.id === collection.activeSubEnvironmentId));
  console.error(`Select a collection environment for ${collection.name}:`);
  environments.forEach((environment, index) => console.error(`  ${index + 1}) ${environment.name} (${environment.id.slice(0, 14)})`));
  const readline = createInterface({ input: process.stdin, output: process.stderr });
  try {
    const answer = (await readline.question(`Environment [${activeIndex + 1}]: `)).trim();
    const selectedIndex = answer ? Number(answer) - 1 : activeIndex;
    if (!Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex >= environments.length) fail('Select a valid collection environment number.');
    return environments[selectedIndex].id;
  } finally {
    readline.close();
  }
};
const cliPromptResourceIdentifier = async (resources: Array<{ id: string; name: string }>, entity: string) => {
  if (!resources.length) fail(`No ${entity} choices are available.`);
  if (!process.stdin.isTTY || !process.stderr.isTTY) fail(`${entity[0].toUpperCase()}${entity.slice(1)} selection requires an interactive terminal. Provide an identifier or use --ci for non-interactive execution.`);
  console.error(`Select ${/^[aeiou]/i.test(entity) ? 'an' : 'a'} ${entity}:`);
  resources.forEach((resource, index) => console.error(`  ${index + 1}) ${resource.name} (${resource.id.slice(0, 14)})`));
  const readline = createInterface({ input: process.stdin, output: process.stderr });
  try {
    const answer = (await readline.question('Selection [1]: ')).trim();
    const selectedIndex = answer ? Number(answer) - 1 : 0;
    if (!Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex >= resources.length) fail(`Select a valid ${entity} number.`);
    return resources[selectedIndex].id;
  } finally {
    readline.close();
  }
};
const loadText = async (path: string) => readFile(path, 'utf8').catch((error) => fail(`Unable to read ${path}: ${error.message}`));
const scriptFileMime = (path: string) => ({
  '.cer': 'application/x-pem-file', '.crt': 'application/x-pem-file', '.csv': 'text/csv', '.gif': 'image/gif', '.htm': 'text/html', '.html': 'text/html', '.jpeg': 'image/jpeg', '.jpg': 'image/jpeg', '.json': 'application/json', '.key': 'application/x-pem-file', '.pdf': 'application/pdf', '.pem': 'application/x-pem-file', '.png': 'image/png', '.txt': 'text/plain', '.xml': 'application/xml',
} as Record<string, string>)[extname(path).toLowerCase()] ?? 'application/octet-stream';
const canonicalCliDataFolders = async (paths: string[]) => {
  if (paths.length > 20) throw new Error('CLI data folders cannot exceed 20 roots.');
  const roots = await Promise.all(paths.map(async (path) => {
    if (!path || path.length > 4_096) throw new Error('CLI data-folder paths must contain 1–4,096 characters.');
    const canonical = await realpath(resolve(path)).catch(() => { throw new Error(`CLI data folder '${path}' does not exist.`); });
    if (!(await stat(canonical)).isDirectory()) throw new Error(`CLI data folder '${path}' is not a directory.`);
    return canonical;
  }));
  return [...new Set(roots)];
};
const readCliFile = async (path: string, roots: string[]) => {
  if (!roots.length) throw new Error('CLI file access requires at least one -f/--dataFolders root.');
  if (!path || path.length > 4_096) throw new Error('CLI file paths must contain 1–4,096 characters.');
  const canonical = await realpath(resolve(path)).catch(() => { throw new Error(`CLI file '${path}' does not exist.`); });
  const allowed = roots.some((root) => {
    const child = relative(root, canonical);
    return child === '' || (child !== '..' && !child.startsWith(`..${sep}`) && !isAbsolute(child));
  });
  if (!allowed) throw new Error(`CLI file '${path}' is outside the allowed --dataFolders roots.`);
  if (!(await stat(canonical)).isFile()) throw new Error(`CLI file '${path}' is not a regular file.`);
  return readFile(canonical);
};
const readCliScriptFile = async (path: string, roots: string[]) => {
  const bytes = await readCliFile(path, roots);
  if (bytes.byteLength > 5_000_000) throw new Error(`Script file '${path}' exceeds the 5 MB per-file limit.`);
  return { fileName: basename(path) || 'attachment.bin', mimeType: scriptFileMime(path), dataBase64: bytes.toString('base64') };
};
const readCliTemplateFile = async (path: string, roots: string[]) => {
  const bytes = await readCliFile(path, roots);
  if (bytes.byteLength > 5_000_000) throw new Error(`Template file '${path}' exceeds the 5 MB per-file limit.`);
  return bytes.toString('utf8');
};
const loadYamlDirectory = async (root: string, directory: string) => {
  const path = join(root, directory);
  const entries = await readdir(path, { withFileTypes: true }).catch((error) => error?.code === 'ENOENT' ? [] : fail(`Unable to list ${path}: ${error.message}`));
  return Promise.all(entries
    .filter((entry) => entry.isFile() && ['.yaml', '.yml'].includes(extname(entry.name).toLowerCase()))
    .sort((left, right) => left.name.localeCompare(right.name))
    .map(async (entry) => parseYaml(await loadText(join(path, entry.name)))));
};
const loadSplitProject = async (path: string) => {
  const metadata = parseYaml(await loadText(join(path, '.brunomnia', 'project.yaml')));
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) fail('Project metadata must be an object.');
  return {
    ...metadata,
    collections: await loadYamlDirectory(path, 'collections'),
    environments: await loadYamlDirectory(path, 'environments'),
    apiDesigns: await loadYamlDirectory(path, 'designs'),
    mockServers: await loadYamlDirectory(path, 'mocks'),
    mcpClients: await loadYamlDirectory(path, 'mcp-clients'),
  };
};
const loadWorkspace = async (path: string): Promise<Workspace> => {
  const input = await stat(path).catch((error) => fail(`Unable to inspect ${path}: ${error.message}`));
  const parsed = input.isDirectory() ? await loadSplitProject(path) : JSON.parse(await loadText(path)) as unknown;
  try { return migrateWorkspace(parsed); }
  catch { return fail('The input is not a Brunomnia workspace.'); }
};
const runnerEnvironmentRows = (value: unknown, prefix: string) => {
  const record = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  return Object.entries(record).slice(0, 1_000).map(([name, rowValue], index) => ({
    id: `${prefix}-${index}`,
    name: name.slice(0, 500),
    value: (typeof rowValue === 'string' ? rowValue : JSON.stringify(rowValue) ?? String(rowValue)).slice(0, 1_000_000),
    enabled: true,
    valueType: rowValue !== null && typeof rowValue === 'object' ? 'json' as const : 'string' as const,
  }));
};
const loadRunnerGlobalEnvironments = async (path: string): Promise<Environment[]> => {
  const bytes = await readFile(path);
  if (bytes.byteLength > 20_000_000) throw new Error(`Global environment file '${path}' exceeds 20 MB.`);
  const documents = parseAllDocuments(bytes.toString('utf8')).filter((document) => document.errors.length === 0).map((document) => document.toJSON() as unknown);
  const first = documents[0];
  const firstRecord = first && typeof first === 'object' && !Array.isArray(first) ? first as Record<string, unknown> : {};
  const directValues = Array.isArray(firstRecord.environments) ? firstRecord.environments : Array.isArray(firstRecord.variables) ? [firstRecord] : [];
  const direct = directValues.flatMap((value, environmentIndex): Environment[] => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
    const environment = value as Record<string, unknown>;
    const id = String(environment.id ?? `global-brunomnia-${environmentIndex}`).slice(0, 500);
    const variables = Array.isArray(environment.variables) ? environment.variables.flatMap((rowValue, rowIndex) => {
      if (!rowValue || typeof rowValue !== 'object' || Array.isArray(rowValue)) return [];
      const row = rowValue as Record<string, unknown>;
      return [{ id: String(row.id ?? `${id}-${rowIndex}`).slice(0, 500), name: String(row.name ?? '').slice(0, 500), value: String(row.value ?? '').slice(0, 1_000_000), enabled: row.enabled !== false, valueType: row.valueType === 'json' ? 'json' as const : 'string' as const }];
    }).slice(0, 1_000) : [];
    return [{ id, name: String(environment.name ?? `Environment ${environmentIndex + 1}`).slice(0, 500), variables, ...(typeof environment.parentId === 'string' ? { parentId: environment.parentId.slice(0, 500) } : {}) }];
  }).slice(0, 100);
  if (direct.length) return direct;
  const resources = Array.isArray(firstRecord.resources) ? firstRecord.resources : [];
  const v4 = resources.filter((value): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value) && (value as Record<string, unknown>)._type === 'environment')).slice(0, 100);
  if (v4.length) {
    const ids = new Set(v4.map((environment) => String(environment._id ?? '')));
    return v4.map((environment, index) => {
      const rawPairs = Array.isArray(environment.kvPairData) ? environment.kvPairData : [];
      const pairs = rawPairs.flatMap((value, pairIndex) => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
        const pair = value as Record<string, unknown>;
        const pairValue = pair.value;
        return [{ id: String(pair.id ?? `global-v4-${index}-${pairIndex}`).slice(0, 500), name: String(pair.name ?? '').slice(0, 500), value: (typeof pairValue === 'string' ? pairValue : JSON.stringify(pairValue) ?? String(pairValue ?? '')).slice(0, 1_000_000), enabled: pair.enabled !== false, valueType: pair.type === 'json' ? 'json' as const : 'string' as const }];
      }).slice(0, 1_000);
      const id = String(environment._id ?? `global-v4-${index}`).slice(0, 500);
      const parentId = String(environment.parentId ?? '').slice(0, 500);
      return { id, name: String(environment.name ?? `Environment ${index + 1}`).slice(0, 500), variables: environment.environmentType === 'kv' && pairs.length ? pairs : runnerEnvironmentRows(environment.data, `global-v4-${index}`), ...(ids.has(parentId) ? { parentId } : {}) };
    });
  }
  const v5 = documents.flatMap((value, documentIndex): Environment[] => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
    const document = value as Record<string, unknown>;
    if (!String(document.type ?? '').startsWith('environment.')) return [];
    const root = document.environment && typeof document.environment === 'object' && !Array.isArray(document.environment) ? document.environment as Record<string, unknown> : {};
    const metadata = root.meta && typeof root.meta === 'object' && !Array.isArray(root.meta) ? root.meta as Record<string, unknown> : {};
    const baseId = String(metadata.id ?? `global-v5-${documentIndex}`).slice(0, 500);
    const environments: Environment[] = [{ id: baseId, name: String(root.name ?? 'Base Environment').slice(0, 500), variables: runnerEnvironmentRows(root.data, `${baseId}-base`) }];
    if (Array.isArray(root.subEnvironments)) root.subEnvironments.slice(0, 99).forEach((value, environmentIndex) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return;
      const environment = value as Record<string, unknown>;
      const environmentMetadata = environment.meta && typeof environment.meta === 'object' && !Array.isArray(environment.meta) ? environment.meta as Record<string, unknown> : {};
      const id = String(environmentMetadata.id ?? `${baseId}-${environmentIndex}`).slice(0, 500);
      environments.push({ id, name: String(environment.name ?? `Environment ${environmentIndex + 1}`).slice(0, 500), variables: runnerEnvironmentRows(environment.data, `${id}-data`), parentId: baseId });
    });
    return environments;
  }).slice(0, 100);
  if (v5.length) return v5;
  throw new Error(`No global environment found in ${path}.`);
};

type LoadedRunnerInsoConfig = RunnerInsoConfig & { filePath?: string };
const runnerConfigSearchPlaces = [
  'package.json',
  '.insorc', '.insorc.json', '.insorc.yaml', '.insorc.yml', '.insorc.js', '.insorc.ts', '.insorc.cjs', '.insorc.mjs',
  '.config/insorc', '.config/insorc.json', '.config/insorc.yaml', '.config/insorc.yml', '.config/insorc.js', '.config/insorc.ts', '.config/insorc.cjs', '.config/insorc.mjs',
  'inso.config.js', 'inso.config.ts', 'inso.config.cjs', 'inso.config.mjs',
];
const runnerConfigCodeExtensions = new Set(['.js', '.ts', '.cjs', '.mjs']);
const readRunnerConfigFile = async (path: string, packageProperty = false, allowConfigCode = false): Promise<LoadedRunnerInsoConfig> => {
  const bytes = await readFile(path);
  if (bytes.byteLength > 1_000_000) throw new Error(`Inso config '${path}' exceeds the 1 MB limit.`);
  const source = bytes.toString('utf8');
  const isCode = runnerConfigCodeExtensions.has(extname(path).toLowerCase());
  if (isCode && !allowConfigCode) throw new Error(`Executable Inso config '${path}' is disabled. Re-run trusted workspaces with --allow-config-code.`);
  const parsed = isCode ? await evaluateRunnerConfigCode(source, path) : parseYaml(source) as unknown;
  const value = packageProperty && parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>).inso
    : parsed;
  return { ...normalizeRunnerInsoConfig(value), filePath: resolve(path) };
};
const findRunnerConfig = async (start: string, allowConfigCode = false): Promise<LoadedRunnerInsoConfig> => {
  const absoluteStart = resolve(start);
  const startStat = await stat(absoluteStart).catch(() => undefined);
  let directory = startStat?.isFile() ? dirname(absoluteStart) : absoluteStart;
  while (true) {
    for (const name of runnerConfigSearchPlaces) {
      const candidate = join(directory, name);
      if (!(await stat(candidate).catch(() => undefined))?.isFile()) continue;
      const config = await readRunnerConfigFile(candidate, name === 'package.json', allowConfigCode);
      if (name !== 'package.json' || Object.keys(config.options).length || Object.keys(config.scripts).length) return config;
    }
    const parent = dirname(directory);
    if (parent === directory) return { options: {}, scripts: {} };
    directory = parent;
  }
};
const loadRunnerConfig = async (configPath: string | undefined, searchStart: string | undefined, allowConfigCode = false): Promise<LoadedRunnerInsoConfig> => {
  if (configPath) {
    const absolutePath = resolve(configPath);
    if (!(await stat(absolutePath).catch(() => undefined))?.isFile()) throw new Error(`Could not find config file at ${configPath}.`);
    return readRunnerConfigFile(absolutePath, basename(absolutePath) === 'package.json', allowConfigCode);
  }
  return findRunnerConfig(searchStart ?? process.cwd(), allowConfigCode);
};
const resolveRunnerGlobalOptions = async (cliWorkingDir?: string) => {
  const allowConfigCode = hasFlag('--allow-config-code');
  const config = await loadRunnerConfig(flag('--config'), cliWorkingDir, allowConfigCode);
  const workingDir = cliWorkingDir ?? config.options.workingDir;
  const ci = hasFlag('--ci') || config.options.ci === true;
  const verbose = hasFlag('--verbose') || config.options.verbose === true;
  const printOptions = hasFlag('--printOptions') || hasFlag('--print-options') || config.options.printOptions === true;
  if (verbose && config.filePath) console.error(`Found config file at ${config.filePath}.`);
  if (printOptions) console.error('Loaded options', JSON.stringify({ workingDir: workingDir ?? '', ci, verbose, printOptions, config: config.filePath ?? '', allowConfigCode }));
  return { config, workingDir, ci, verbose, printOptions };
};
const runCliChild = (childArgs: string[]) => new Promise<number>((resolveChild, rejectChild) => {
  const depth = Math.max(0, Number.parseInt(process.env.BRUNOMNIA_SCRIPT_DEPTH ?? '0', 10) || 0);
  if (depth >= 10) throw new Error('Inso script recursion exceeds 10 nested invocations.');
  const child = spawn(process.execPath, [process.argv[1], ...childArgs], {
    cwd: process.cwd(),
    env: { ...process.env, BRUNOMNIA_SCRIPT_DEPTH: String(depth + 1) },
    stdio: 'inherit',
  });
  child.on('error', rejectChild);
  child.on('close', (code) => resolveChild(code ?? 1));
});

const expectApi = createScriptExpect();

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
  const testNamePattern = options.testNamePattern === undefined ? undefined : new RegExp(options.testNamePattern);
  let registeredTests = 0;
  let subrequestCount = 0;
  const maxSubrequests = Math.min(20, Math.max(1, options.maxSubrequests ?? 5));
  const fileReferences: ScriptFileReference[] = [];
  const fileBudget: ScriptFileBudget = { files: 0, bytes: 0 };
  const execution = {
    location: (options.execution?.location ?? options.executionLocation ?? [...folders.map((folder) => folder.name), request.name]).map((part) => String(part).slice(0, 1_000)).slice(0, 100),
    skipRequest: Boolean(options.execution?.skipRequest),
    nextRequestIdOrName: String(options.execution?.nextRequestIdOrName ?? '').slice(0, 10_000),
  };
  if (!source.trim()) return { request, environment, baseGlobals, baseGlobalDisabled, globalDisabled, collectionVariables, baseEnvironment, baseEnvironmentDisabled, collectionDisabled, folders, localVariables, logs, tests, execution };
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
  const removeFileReferences = (...kinds: ScriptFileReference['kind'][]) => {
    for (let index = fileReferences.length - 1; index >= 0; index -= 1) if (kinds.includes(fileReferences[index].kind)) fileReferences.splice(index, 1);
  };
  const addFileReference = (reference: ScriptFileReference) => {
    if (!options.readFile) throw new Error('Script file access is disabled. Re-run trusted workspaces with --allow-script-files.');
    const path = reference.path.replace(/{{\s*([^{}]+?)\s*}}/g, (match, name: string) => mergedVariables()[name] ?? match).trim();
    if (!path) throw new Error('Script file path cannot be empty.');
    if (path.length > 10_000) throw new Error('Script file path exceeds 10,000 characters.');
    if (fileReferences.length >= 20) throw new Error('Script request exceeds the 20-file attachment limit.');
    fileReferences.push({ ...reference, path });
    return path;
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
      if (mode === 'raw') { removeFileReferences('body', 'multipart'); delete request.binaryBody; request.bodyMode = 'text'; requestBody = String(input.raw ?? ''); }
      else if (mode === 'urlencoded') { removeFileReferences('body', 'multipart'); delete request.binaryBody; request.bodyMode = 'form-urlencoded'; request.formBody = (Array.isArray(input.urlencoded) ? input.urlencoded : []).flatMap((item, index) => { const row = item as Record<string, unknown>; const name = String(row.key ?? row.name ?? ''); return name ? [{ id: `cli-form-${index}`, name, value: String(row.value ?? ''), enabled: row.enabled !== false }] : []; }); }
      else if (mode === 'graphql') { removeFileReferences('body', 'multipart'); delete request.binaryBody; const graphql = (input.graphql && typeof input.graphql === 'object' ? input.graphql : input) as Record<string, unknown>; request.protocol = 'graphql'; request.method = 'POST'; request.graphql.query = String(graphql.query ?? ''); request.graphql.variables = typeof graphql.variables === 'string' ? graphql.variables : JSON.stringify(graphql.variables ?? {}, null, 2); request.graphql.operationName = String(graphql.operationName ?? ''); }
      else if (mode === 'formdata') {
        removeFileReferences('body', 'multipart'); delete request.binaryBody; request.bodyMode = 'multipart';
        const parts = (Array.isArray(input.formdata) ? input.formdata as Array<Record<string, unknown>> : []).slice(0, 1_000);
        request.multipartBody = parts.flatMap((part, index) => {
          const id = `cli-part-${index}`; const name = String(part.key ?? part.name ?? ''); if (!name) return [];
          const isFile = part.type === 'file' || part.src !== undefined;
          if (isFile) { addFileReference({ kind: 'multipart', path: String(part.src ?? part.value ?? ''), partId: id, fileName: String(part.fileName ?? part.filename ?? ''), contentType: String(part.contentType ?? '') }); return [{ id, name, value: '', enabled: part.enabled !== false, kind: 'file' as const, fileName: String(part.fileName ?? part.filename ?? ''), contentType: String(part.contentType ?? '') }]; }
          return [{ id, name, value: String(part.value ?? ''), enabled: part.enabled !== false, kind: 'text' as const }];
        });
      }
      else if (mode === 'file') { removeFileReferences('body', 'multipart'); const file = input.file; const path = file && typeof file === 'object' ? (file as Record<string, unknown>).src : file ?? input.src; addFileReference({ kind: 'body', path: String(path ?? '') }); request.bodyMode = 'binary'; delete request.binaryBody; requestBody = ''; }
      else throw new Error(`Request body mode '${mode}' is not supported.`);
      return bodyApi;
    },
    toString: () => requestBody,
    valueOf: () => requestBody,
    [Symbol.toPrimitive]: () => requestBody,
  };
  Object.defineProperty(request, 'url', { configurable: true, enumerable: true, get: () => urlApi, set: (value) => { requestUrl = String(value); } });
  Object.defineProperty(request, 'body', { configurable: true, enumerable: true, get: () => bodyApi, set: (value) => { removeFileReferences('body', 'multipart'); delete request.binaryBody; requestBody = typeof value === 'string' ? value : JSON.stringify(value); request.bodyMode = 'text'; } });
  requestWithHelpers.getUrl = () => requestUrl;
  requestWithHelpers.setUrl = (url) => { requestUrl = String(url); };
  requestWithHelpers.getMethod = () => request.method;
  requestWithHelpers.setMethod = (method) => { request.method = String(method).toUpperCase(); };
  requestWithHelpers.getBody = () => requestBody;
  requestWithHelpers.setBody = (body) => { removeFileReferences('body', 'multipart'); delete request.binaryBody; requestBody = typeof body === 'string' ? body : JSON.stringify(body); request.bodyMode = 'text'; };
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
    request.transport.proxyMode = 'custom';
    if (input.url) request.transport.proxyUrl = String(input.url);
    else if (input.host) request.transport.proxyUrl = `${String(input.protocol ?? 'http')}://${String(input.host)}${input.port ? `:${String(input.port)}` : ''}`;
    request.transport.proxyExclusions = Array.isArray(input.exclusions) ? input.exclusions.join(',') : String(input.exclusions ?? request.transport.proxyExclusions);
  } };
  const certificateApi = requestWithHelpers.certificate = { key: { src: '' }, cert: { src: '' }, pfx: { src: '' }, passphrase: request.transport.clientCertificatePassphrase || '', update: (input) => {
    removeFileReferences('certificate-cert', 'certificate-key', 'certificate-pfx');
    if (input.disabled === true) { request.transport.clientCertificatePem = ''; request.transport.clientKeyPem = ''; request.transport.clientCertificatePfxBase64 = ''; request.transport.clientCertificatePassphrase = ''; request.transport.clientCertificateDomains = ''; certificateApi.key.src = ''; certificateApi.cert.src = ''; certificateApi.pfx.src = ''; certificateApi.passphrase = ''; return; }
    const key = input.key as Record<string, unknown> | undefined;
    const cert = input.cert as Record<string, unknown> | undefined;
    const pfx = input.pfx && typeof input.pfx === 'object' ? input.pfx as Record<string, unknown> : undefined;
    const certPath = input.certPath ?? cert?.src; const keyPath = input.keyPath ?? key?.src;
    const pfxPath = input.pfxPath ?? input.path ?? pfx?.src;
    if (pfxPath && (certPath || keyPath || input.cert || input.key || input.certificate)) throw new Error('Script certificates must use either PFX/PKCS#12 or PEM certificate and key material.');
    if (pfxPath) { certificateApi.pfx.src = addFileReference({ kind: 'certificate-pfx', path: String(pfxPath) }); certificateApi.cert.src = ''; certificateApi.key.src = ''; request.transport.clientCertificatePfxBase64 = ''; request.transport.clientCertificatePem = ''; request.transport.clientKeyPem = ''; }
    else {
      if (certPath) { certificateApi.cert.src = addFileReference({ kind: 'certificate-cert', path: String(certPath) }); request.transport.clientCertificatePem = ''; }
      else request.transport.clientCertificatePem = String(cert?.pem ?? input.cert ?? input.certificate ?? '');
      if (keyPath) { certificateApi.key.src = addFileReference({ kind: 'certificate-key', path: String(keyPath) }); request.transport.clientKeyPem = ''; }
      else request.transport.clientKeyPem = String(key?.pem ?? input.key ?? '');
      certificateApi.pfx.src = ''; request.transport.clientCertificatePfxBase64 = '';
    }
    certificateApi.passphrase = String(input.passphrase ?? ''); request.transport.clientCertificatePassphrase = certificateApi.passphrase;
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
  const claimSubrequest = () => {
    if (subrequestCount >= maxSubrequests) throw new Error('Script exceeded the secondary-request limit.');
    subrequestCount += 1;
  };
  const savedResponseFacade = (candidate: HttpResponse) => ({
    status: candidate.status,
    statusMessage: candidate.statusText,
    data: candidate.body,
    headers: Object.fromEntries(Object.entries(candidate.headers).map(([name, value]) => [name.toLowerCase(), value])),
    responseTime: candidate.durationMs,
  });
  const testCategory = options.testCategory ?? 'unknown';
  const finishTest = (result: ScriptRunResult['tests'][number], startedAt: number) => { result.durationMs = Math.max(0, performance.now() - startedAt); };
  const failTest = (result: ScriptRunResult['tests'][number], error: unknown) => { result.passed = false; result.status = 'failed'; result.error = error instanceof Error ? error.message : String(error); };
  const test = (name: string, callback: () => unknown) => {
    registeredTests += 1;
    if (registeredTests > 1_000) throw new Error('Script exceeds 1,000 test registrations.');
    const testName = String(name);
    if (testNamePattern && !testNamePattern.test(testName)) return;
    const result: ScriptRunResult['tests'][number] = { name: testName, passed: true, status: 'passed', category: testCategory, durationMs: 0 };
    tests.push(result);
    const startedAt = performance.now();
    try {
      const outcome = callback();
      if (outcome && typeof (outcome as PromiseLike<unknown>).then === 'function') {
        const pending = Promise.resolve(outcome).then(() => finishTest(result, startedAt), (error) => { failTest(result, error); finishTest(result, startedAt); });
        pendingTests.push(pending);
        return pending;
      }
      finishTest(result, startedAt);
    } catch (error) {
      failTest(result, error);
      finishTest(result, startedAt);
    }
    return Promise.resolve();
  };
  test.skip = async (name: string) => {
    registeredTests += 1;
    if (registeredTests > 1_000) throw new Error('Script exceeds 1,000 test registrations.');
    const testName = String(name);
    if (testNamePattern && !testNamePattern.test(testName)) return;
    tests.push({ name: testName, passed: false, status: 'skipped', category: testCategory, durationMs: 0 });
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
    execution: {
      location: new Proxy(execution.location, { get: (target, property, receiver) => property === 'current' ? target[target.length - 1] || '' : Reflect.get(target, property, receiver) }),
      skipRequest: () => { execution.skipRequest = true; },
      setNextRequest: (requestIdOrName: unknown) => {
        const next = String(requestIdOrName ?? '');
        if (next.length > 10_000) throw new Error('Next request name or ID exceeds 10,000 characters.');
        execution.nextRequestIdOrName = next;
      },
    },
    request,
    response: responseFacade(response),
    replaceIn: (value: unknown) => String(value).replace(/{{\s*([^{}]+?)\s*}}/g, (match, name: string) => mergedVariables()[name] ?? match),
    vault: { get: (name: string) => { if (!options.vault) throw new Error('Script vault access is disabled.'); return options.vault[name]; } },
    send: async (requestId?: string) => {
      if (!options.sendRequestById) throw new Error('Standalone test request execution is unavailable.');
      claimSubrequest();
      return savedResponseFacade(await options.sendRequestById(requestId));
    },
    sendRequest: async (input: unknown, callback?: (error: Error | null, result?: ReturnType<typeof responseFacade>) => void) => {
      const run = async () => {
        if (!options.sendRequest) throw new Error('Script-initiated requests are disabled.');
        claimSubrequest();
        const variables = mergedVariables();
        const subrequest = await prepareScriptSubrequest(input, request, variables, options.readFile, fileBudget);
        return responseFacade(await options.sendRequest(subrequest, variables));
      };
      if (callback) { void run().then((result) => callback(null, result), (error) => callback(error instanceof Error ? error : new Error(String(error)))); return undefined; }
      return run();
    },
    expect: expectApi,
    test,
  };
  const scriptModules = createScriptModules({
    atob,
    btoa,
    crypto,
    expect: expectApi,
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
  const context = vm.createContext({
    insomnia,
    expect: expectApi,
    require: (name: string) => {
      if (!Object.hasOwn(scriptModules, name)) throw new Error(`Module '${name}' is not bundled in Brunomnia's script sandbox.`);
      return scriptModules[name];
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
  const hydratedRequest = await hydrateScriptFileReferences(request, fileReferences, options.readFile, fileBudget);
  return { request: hydratedRequest, environment, baseGlobals, baseGlobalDisabled, globalDisabled, collectionVariables, baseEnvironment, baseEnvironmentDisabled, collectionDisabled, folders, localVariables, logs, tests, execution };
};

type CliRequestContext = {
  environmentId: string;
  cookies: CookieRecord[];
  responses: StoredResponse[];
  certificates: Workspace['certificates'];
  readFile?: (path: string) => Promise<string>;
  externalSecret?: ReturnType<typeof createCliExternalSecretResolver>;
  resolveResponse?: Parameters<typeof renderApiRequest>[2]['resolveResponse'];
  requestAncestors?: string[];
  requestChain?: string[];
  pluginTemplate?: (name: string, args: string[], request: ApiRequest) => Promise<string | undefined>;
};

type CliFullExecution = {
  request: ApiRequest;
  response: HttpResponse;
  environment: Record<string, string>;
  tests: RunnerItemResult['tests'];
  iteration: number;
  attempt: number;
};

const fullDataRedaction = '<Redacted by Insomnia>';
const sensitiveReportHeaders = new Set(['cookie', 'set-cookie', 'authorization', 'auth', 'x-auth-token', 'x-api-key', 'api-key', 'x-csrf-token', 'x-xsrf-token', 'x-access-token', 'x-refresh-token', 'bearer', 'basic', 'x-forwarded-for', 'x-real-ip', 'x-client-ip', 'proxy-authorization']);
const redactProxyUrl = (value: string) => {
  try {
    const url = new URL(value);
    if (url.username) url.username = fullDataRedaction;
    if (url.password) url.password = fullDataRedaction;
    return url.toString();
  } catch {
    return value;
  }
};
const redactCliExecution = (execution: CliFullExecution): CliFullExecution => ({
  ...execution,
  environment: Object.fromEntries(Object.keys(execution.environment).map((name) => [name, fullDataRedaction])),
  request: {
    ...execution.request,
    headers: execution.request.headers.map((header) => sensitiveReportHeaders.has(header.name.toLowerCase()) ? { ...header, value: fullDataRedaction } : header),
    auth: Object.fromEntries(Object.entries(execution.request.auth).map(([name, value]) => [name, ['type', 'disabled', 'oauth2GrantType'].includes(name) ? value : fullDataRedaction])) as ApiRequest['auth'],
    transport: {
      ...execution.request.transport,
      proxyUrl: redactProxyUrl(execution.request.transport.proxyUrl),
      clientCertificatePem: execution.request.transport.clientCertificatePem ? fullDataRedaction : '',
      clientKeyPem: execution.request.transport.clientKeyPem ? fullDataRedaction : '',
      clientCertificatePfxBase64: execution.request.transport.clientCertificatePfxBase64 ? fullDataRedaction : '',
      clientCertificatePassphrase: execution.request.transport.clientCertificatePassphrase ? fullDataRedaction : '',
      caCertificatePem: execution.request.transport.caCertificatePem ? fullDataRedaction : '',
    },
  },
  response: {
    ...execution.response,
    headers: Object.fromEntries(Object.entries(execution.response.headers).map(([name, value]) => [name, sensitiveReportHeaders.has(name.toLowerCase()) ? fullDataRedaction : value])),
    setCookies: execution.response.setCookies?.map(() => fullDataRedaction),
  },
});
const createCliFullDataReport = (
  report: RunnerReport,
  collection: Workspace['collections'][number],
  environment: Environment,
  proxy: ProxyPreferences,
  executions: CliFullExecution[],
  mode: 'redact' | 'plaintext',
) => {
  const selectedExecutions = mode === 'redact' ? executions.map(redactCliExecution) : executions;
  const responseTimes = selectedExecutions.map((execution) => Math.max(0, execution.response.durationMs));
  return {
    format: 'brunomnia-inso-full-report',
    version: 1,
    mode,
    collection: { id: collection.id, name: collection.name, documentation: collection.documentation ?? '' },
    environment: mode === 'redact'
      ? { ...environment, variables: environment.variables.map((variable) => ({ ...variable, value: fullDataRedaction })) }
      : environment,
    proxy: { enabled: proxy.enabled, httpProxy: mode === 'redact' ? redactProxyUrl(proxy.httpProxy) : proxy.httpProxy, httpsProxy: mode === 'redact' ? redactProxyUrl(proxy.httpsProxy) : proxy.httpsProxy, noProxy: proxy.noProxy },
    executions: selectedExecutions,
    timing: {
      started: report.startedAt,
      completed: report.finishedAt,
      responseAverage: responseTimes.length ? responseTimes.reduce((total, value) => total + value, 0) / responseTimes.length : 0,
      responseMin: responseTimes.length ? Math.min(...responseTimes) : 0,
      responseMax: responseTimes.length ? Math.max(...responseTimes) : 0,
    },
    stats: {
      iterations: { total: report.iterations, failed: new Set(report.results.filter((result) => !result.passed).map((result) => result.iteration)).size },
      requests: { total: report.total, failed: report.failed },
      tests: { total: report.results.reduce((total, result) => total + result.tests.length, 0), failed: report.results.reduce((total, result) => total + result.tests.filter(scriptTestFailed).length, 0) },
    },
    error: report.flowError ?? null,
  };
};
const createCliSafeDataReport = (
  report: RunnerReport,
  collection: Workspace['collections'][number],
  environment: Environment,
  proxy: ProxyPreferences,
  executions: CliFullExecution[],
) => {
  const responseTimes = executions.map((execution) => Math.max(0, execution.response.durationMs));
  return {
    format: 'brunomnia-inso-safe-report',
    version: 1,
    mode: 'safe',
    collection: { id: collection.id, name: collection.name, documentation: collection.documentation ?? '' },
    environment: {
      id: environment.id,
      name: environment.name,
      ...(environment.parentId ? { parentId: environment.parentId } : {}),
      ...(environment.private === undefined ? {} : { private: environment.private }),
      ...(environment.color === undefined ? {} : { color: environment.color }),
    },
    proxy: { enabled: proxy.enabled, httpProxy: redactProxyUrl(proxy.httpProxy), httpsProxy: redactProxyUrl(proxy.httpsProxy), noProxy: proxy.noProxy },
    executions: executions.map((execution) => ({
      request: { id: execution.request.id, name: execution.request.name, documentation: execution.request.documentation ?? '' },
      response: { status: execution.response.status, statusText: execution.response.statusText, durationMs: execution.response.durationMs },
      tests: execution.tests,
      iteration: execution.iteration,
      attempt: execution.attempt,
    })),
    timing: {
      started: report.startedAt,
      completed: report.finishedAt,
      responseAverage: responseTimes.length ? responseTimes.reduce((total, value) => total + value, 0) / responseTimes.length : 0,
      responseMin: responseTimes.length ? Math.min(...responseTimes) : 0,
      responseMax: responseTimes.length ? Math.max(...responseTimes) : 0,
    },
    stats: {
      iterations: { total: report.iterations, failed: new Set(report.results.filter((result) => !result.passed).map((result) => result.iteration)).size },
      requests: { total: report.total, failed: report.failed },
      tests: { total: report.results.reduce((total, result) => total + result.tests.length, 0), failed: report.results.reduce((total, result) => total + result.tests.filter(scriptTestFailed).length, 0) },
    },
    error: report.flowError ?? null,
  };
};

const executeHttp = async (
  request: ApiRequest,
  variables: Record<string, string>,
  requestTimeoutMs = 30_000,
  validateCertificates = true,
  proxyPreferences?: ProxyPreferences,
  context?: CliRequestContext,
): Promise<{ result: HttpResponse; request: ApiRequest }> => {
  if (request.protocol !== 'http' && request.protocol !== 'graphql') throw new Error(`CLI collection execution does not yet support ${request.protocol}.`);
  request = await renderApiRequest(request, variables, {
    cookies: context?.cookies,
    responses: context?.responses,
    environmentId: context?.environmentId,
    externalSecret: context?.externalSecret,
    readFile: context?.readFile,
    requestAncestors: context?.requestAncestors,
    renderPurpose: 'send',
    resolveResponse: context?.resolveResponse,
    requestChain: context?.requestChain,
    osInfo: async () => ({ arch: arch(), cpus: cpus(), freemem: freemem(), hostname: hostname(), platform: platform(), release: release(), userInfo: userInfo() }),
    customTag: context?.pluginTemplate ? (name, args) => context.pluginTemplate!(name, args, request) : undefined,
  });
  let url = buildRequestUrl(request, {});
  request = { ...request, transport: applyWorkspaceCertificates(request.transport, url, context?.certificates) };
  let headers = buildHeaders(request, {});
  let body: BodyInit | undefined;
  if (request.protocol === 'graphql') {
    body = JSON.stringify({ query: request.graphql.query, variables: JSON.parse(request.graphql.variables || '{}'), operationName: request.graphql.operationName || undefined });
    if (!headers.some((header) => header.name.toLowerCase() === 'content-type')) headers.push({ id: 'cli-graphql', name: 'Content-Type', value: 'application/json', enabled: true });
  } else if (request.bodyMode === 'json' || request.bodyMode === 'text') body = request.body;
  else if (request.bodyMode === 'form-urlencoded') body = new URLSearchParams(request.formBody.filter((row) => row.enabled).map((row) => [row.name, row.value]));
  else if (request.bodyMode === 'multipart') {
    const form = new FormData();
    request.multipartBody.filter((part) => part.enabled && part.name).forEach((part) => {
      if (part.kind === 'file' && part.file) {
        form.append(part.name, new Blob([Buffer.from(part.file.dataBase64, 'base64')], { type: part.contentType || part.file.mimeType }), part.fileName || part.file.fileName);
      } else {
        form.append(part.name, part.value);
      }
    });
    body = form;
  }
  else if (request.bodyMode === 'binary' && request.binaryBody) {
    body = Buffer.from(request.binaryBody.dataBase64, 'base64');
    if (!headers.some((header) => header.enabled && header.name.toLowerCase() === 'content-type')) headers.push({ id: 'cli-binary', name: 'Content-Type', value: request.binaryBody.mimeType, enabled: true });
  }
  if (request.transport.sendCookies && !headers.some((header) => header.enabled && header.name.toLowerCase() === 'cookie')) {
    const cookie = cookieHeaderForUrl(context?.cookies ?? [], url);
    if (cookie) headers.push({ id: 'cli-cookie-jar', name: 'Cookie', value: cookie, enabled: true });
  }
  headers = applyDefaultUserAgentHeader(applyDefaultAcceptHeader(headers), request.disableUserAgentHeader);
  const started = performance.now();
  const timeoutMs = resolveRequestTimeout(request.transport, requestTimeoutMs);
  const requestTls = {
    rejectUnauthorized: validateCertificates && resolveCertificateValidation(request.transport, true),
    ...(request.transport.caCertificatePem ? { ca: [...rootCertificates, request.transport.caCertificatePem] } : {}),
    ...(request.transport.clientCertificatePem ? { cert: request.transport.clientCertificatePem } : {}),
    ...(request.transport.clientKeyPem ? { key: request.transport.clientKeyPem } : {}),
    ...(request.transport.clientCertificatePfxBase64 ? { pfx: Buffer.from(request.transport.clientCertificatePfxBase64, 'base64') } : {}),
    ...(request.transport.clientCertificatePassphrase ? { passphrase: request.transport.clientCertificatePassphrase } : {}),
  };
  const resolvedProxy = resolveProxyTransport(request.transport, url, proxyPreferences);
  const dispatcher = resolvedProxy.proxyMode === 'custom'
    ? new EnvHttpProxyAgent({ httpProxy: resolvedProxy.proxyUrl, httpsProxy: resolvedProxy.proxyUrl, noProxy: resolvedProxy.proxyExclusions, connect: requestTls, requestTls })
    : new Agent({ connect: requestTls });
  try {
    const response = await undiciFetch(url, {
      method: request.method,
      headers: Object.fromEntries(headers.filter((header) => header.enabled && header.name).map((header) => [header.name, header.value])),
      body: request.method === 'GET' || request.method === 'HEAD' ? undefined : body,
      redirect: request.transport.followRedirects ? 'follow' : 'manual',
      signal: timeoutMs > 0 ? AbortSignal.timeout(timeoutMs) : undefined,
      dispatcher,
    });
    const responseBody = await response.text();
    const getSetCookie = response.headers.getSetCookie;
    return { request, result: { status: response.status, statusText: response.statusText, headers: Object.fromEntries(response.headers.entries()), body: responseBody, durationMs: Math.round(performance.now() - started), sizeBytes: Buffer.byteLength(responseBody), requestUrl: url, setCookies: getSetCookie.call(response.headers) } };
  } finally {
    await dispatcher.close();
  }
};

const usage = `Brunomnia CLI

  brunomnia -v, --version
  brunomnia lint spec <design-name-id-prefix-or-file> [-w <workspace-or-project>] [-r, --ruleset <spectral-yaml>] [--json]
  brunomnia generate collection <openapi-file> --output <file>
  brunomnia export spec <design-name-or-id-prefix> -w <workspace-or-project> [-s, --skipAnnotations] [--output <file>]
  brunomnia run collection <workspace-or-project> <collection-name-or-id-prefix> [-g, --globals <name-id-prefix-or-file>] [-e, --env <name-or-id-prefix>] [-t, --requestNamePattern <regex>] [-i, --item <name-or-id>]... [--requestTimeout MS] [--env-var <key=value>]... [-n, --iteration-count N] [--retries N] [--delay-request MS] [-d, --iteration-data <json-or-csv>] [-b, --bail] [--reporter <name>] [--output <file>] [--includeFullData <redact|plaintext> --acceptRisk] [-f, --dataFolders <folder...>] [--httpProxy URL] [--httpsProxy URL] [--noProxy HOSTS] [--disableCertValidation] [--allow-scripts] [--allow-script-requests] [--allow-script-files] [--allow-template-files] [--allow-external-vaults] [--allow-plugins]
  brunomnia run test <workspace> <suite-name-or-id-prefix|spec-name-or-id-prefix> [-g, --globals <name-id-prefix-or-file>] [-e, --env <name-or-id-prefix>] [-t, --testNamePattern <regex>] [--requestTimeout MS] [--keepFile] [-f, --dataFolders <folder...>] [-k, --disableCertValidation] [same transport/trust options]
  brunomnia script <name> [arguments...] [--config <path>]

Pinned input shape: use -w, --workingDir <workspace-or-project> and provide only the optional collection, suite, or API-spec identifier positionally. Omission prompts in a terminal; use --ci for deterministic non-interactive fallback. Use --env or --ci when collection sub-environments exist.
Config: --config <path> or discovered Cosmiconfig-compatible package/.insorc/.config/inso.config files support workingDir, ci, verbose, printOptions, and bounded script definitions. Executable JS/CJS/MJS/TS needs --allow-config-code.

Reporters: dot, list, min, progress, spec, tap, json, junit
`;

const globalHelp = `Global options:
  -w, --workingDir <path>  Workspace file or managed project directory
  --config <path>          Explicit .insorc/JSON/YAML/package config
  --ci                     Disable prompts and use deterministic fallbacks
  --verbose                Report discovered config details
  --printOptions           Print merged supported options to stderr
  --allow-config-code      Execute bounded JS/CJS/MJS/TS config
  -v, --version            Print the bundled CLI version
  -h, --help               Show command help`;

const cliHelp = (command?: string, subject?: string) => {
  const key = [command, subject].filter(Boolean).join(' ');
  const topics: Record<string, string> = {
    run: `Usage: brunomnia run <command>\n\nExecution utilities\n\nCommands:\n  collection [identifier]  Run a request collection\n  test [identifier]        Run standalone unit test suites\n\n${globalHelp}`,
    'run test': `Usage: brunomnia run test [identifier] [options]\n\nRun standalone unit test suites selected by suite or API-design name/ID.\n\nOptions:\n  -e, --env <identifier>  -g, --globals <identifier-or-file>\n  -t, --testNamePattern <regex>\n  -n, --iteration-count <count>  -d, --iteration-data <path-or-url>\n  --retries <count>  --script-timeout <milliseconds>\n  -r, --reporter <name>  -b, --bail\n  --keepFile  --requestTimeout <milliseconds>\n  -k, --disableCertValidation\n  --httpProxy <url>  --httpsProxy <url>  --noProxy <hosts>\n  -f, --dataFolders <folders...>  --output <file>\n  --allow-scripts  --allow-script-requests  --allow-script-files\n  --allow-template-files  --allow-external-vaults  --allow-plugins\n\n${globalHelp}`,
    'run collection': `Usage: brunomnia run collection [identifier] [options]\n\nRun a request collection selected by name or ID.\n\nOptions:\n  -t, --requestNamePattern <regex>\n  -i, --item <request-or-folder>\n  -e, --env <identifier>  -g, --globals <identifier-or-file>\n  --delay-request <milliseconds>  --requestTimeout <milliseconds>\n  --env-var <key=value>\n  -n, --iteration-count <count>  -d, --iteration-data <path-or-url>\n  --retries <count>  --script-timeout <milliseconds>\n  -r, --reporter <name>  -b, --bail\n  --disableCertValidation\n  --httpProxy <url>  --httpsProxy <url>  --noProxy <hosts>\n  -f, --dataFolders <folders...>\n  --output <file>  --includeFullData <redact|plaintext>  --acceptRisk\n  --allow-scripts  --allow-script-requests  --allow-script-files\n  --allow-template-files  --allow-external-vaults  --allow-plugins\n\n${globalHelp}`,
    lint: `Usage: brunomnia lint spec [identifier]\n\nLint a local file or stored API specification.\n\n${globalHelp}`,
    'lint spec': `Usage: brunomnia lint spec [identifier] [options]\n\nLint an API specification selected by file, name, or ID.\n\nOptions:\n  -r, --ruleset <path>\n  --json\n\n${globalHelp}`,
    export: `Usage: brunomnia export spec [identifier]\n\nExport a stored API specification.\n\n${globalHelp}`,
    'export spec': `Usage: brunomnia export spec [identifier] [options]\n\nExport an API specification selected by name or ID.\n\nOptions:\n  -o, --output <path>\n  -s, --skipAnnotations\n\n${globalHelp}`,
    generate: `Usage: brunomnia generate collection <openapi-file> --output <file>\n\nGenerate a Brunomnia collection from OpenAPI.\n\n${globalHelp}`,
    'generate collection': `Usage: brunomnia generate collection <openapi-file> --output <file>\n\nGenerate a Brunomnia collection from OpenAPI.\n\nOptions:\n  --output <file>\n\n${globalHelp}`,
    script: `Usage: brunomnia script <name> [arguments...] [options]\n\nRun a bounded command alias defined in .insorc.\n\n${globalHelp}`,
  };
  return topics[key] ?? topics[command ?? ''] ?? usage;
};

const main = async () => {
  const [command, subject] = args;
  if (hasFlag('--version') || hasFlag('-v')) { console.log(cliVersion); return; }
  if (command === 'help') { console.log(cliHelp(subject, args[2])); return; }
  if (!command) { console.log(usage); return; }
  if (hasFlag('--help') || hasFlag('-h')) { console.log(cliHelp(command, subject?.startsWith('-') ? undefined : subject)); return; }

  if (command === 'lint' && subject === 'spec') {
    const positionals = runnerCliPositionalArguments(args.slice(2));
    let identifier = positionals[0];
    const cliWorkingDir = firstFlag('--workingDir', '--working-dir', '-w');
    const { workingDir, ci } = await resolveRunnerGlobalOptions(cliWorkingDir);
    const inputBase = await cliWorkingDirectoryBase(workingDir);
    const candidatePath = identifier ? resolve(inputBase, identifier) : '';
    const candidateStats = candidatePath ? await stat(candidatePath).catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return undefined;
      return fail(`Unable to inspect specification path '${candidatePath}': ${error.message}`);
    }) : undefined;
    const explicitRuleset = firstFlag('--ruleset', '-r');
    let contents = '';
    let ruleset = '';
    let sourceFiles: ApiDesign['sourceFiles'] = [];
    let rulesetFiles: ApiDesign['sourceFiles'] = [];
    if (candidateStats?.isFile()) {
      const specificationSources = await collectCliApiDesignSources(candidatePath, 'specification').catch((error) => fail(error instanceof Error ? error.message : String(error)));
      contents = specificationSources.contents;
      sourceFiles = specificationSources.files;
      let rulesetPath = '';
      if (explicitRuleset) {
        rulesetPath = resolve(inputBase, explicitRuleset);
      } else {
        const sibling = (await readdir(dirname(candidatePath), { withFileTypes: true }))
          .filter((entry) => entry.isFile() && entry.name.startsWith('.spectral'))
          .sort((left, right) => left.name.localeCompare(right.name))[0];
        if (sibling) rulesetPath = join(dirname(candidatePath), sibling.name);
      }
      if (rulesetPath) {
        const rulesetSources = await collectCliApiDesignSources(rulesetPath, 'ruleset').catch((error) => fail(error instanceof Error ? error.message : String(error)));
        ruleset = rulesetSources.contents;
        rulesetFiles = rulesetSources.files;
      }
    } else {
      const workspace = await loadWorkspace(workingDir ?? fail('Provide an OpenAPI file or use --workingDir with a stored API design.'));
      if (!identifier) identifier = ci
        ? workspace.apiDesigns[0]?.id
        : await cliPromptResourceIdentifier(workspace.apiDesigns, 'API design');
      const design = identifier ? selectRunnerResource(workspace.apiDesigns, identifier, 'API design') : undefined;
      if (!design) fail(identifier ? `Design '${identifier}' was not found.` : 'Provide a design name or ID.');
      contents = design.contents;
      sourceFiles = design.sourceFiles ?? [];
      if (explicitRuleset) {
        const rulesetSources = await collectCliApiDesignSources(resolve(inputBase, explicitRuleset), 'ruleset').catch((error) => fail(error instanceof Error ? error.message : String(error)));
        ruleset = rulesetSources.contents;
        rulesetFiles = rulesetSources.files;
      } else {
        ruleset = design.ruleset;
        rulesetFiles = design.sourceFiles ?? [];
      }
    }
    const { analyzeOpenApiDesign } = await import('../src/lib/openapiSpectral');
    const analysis = await analyzeOpenApiDesign({ contents, ruleset, sourceFiles, rulesetFiles }, fetchPublicSpecificationSourceNode);
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
    const positionals = runnerCliPositionalArguments(args.slice(2));
    const cliWorkingDir = firstFlag('--workingDir', '--working-dir', '-w');
    const { workingDir, ci } = await resolveRunnerGlobalOptions(cliWorkingDir);
    const workspace = await loadWorkspace(workingDir ?? positionals[0] ?? fail('Provide a workspace file or use --workingDir.'));
    let identifier = positionals[workingDir ? 0 : 1];
    if (!identifier) identifier = ci
      ? workspace.apiDesigns[0]?.id
      : await cliPromptResourceIdentifier(workspace.apiDesigns, 'API design');
    if (!identifier) fail('Provide a design name or ID.');
    const design = selectRunnerResource(workspace.apiDesigns, identifier, 'API design');
    const contents = exportOpenApiSpecification(design.contents, hasFlag('--skipAnnotations') || hasFlag('--skip-annotations') || hasFlag('-s'));
    const output = firstFlag('--output', '-o');
    if (output) {
      const outputBase = await cliWorkingDirectoryBase(workingDir);
      const outputPath = resolve(outputBase, output);
      await mkdir(dirname(outputPath), { recursive: true });
      await writeFile(outputPath, contents);
      console.log(`Exported ${outputPath}`);
    } else {
      process.stdout.write(contents.endsWith('\n') ? contents : `${contents}\n`);
    }
    return;
  }

  if (command === 'script') {
    const positionals = runnerCliPositionalArguments(args.slice(1));
    const scriptName = positionals[0] ?? fail('Provide an Inso script name.');
    const cliWorkingDir = firstFlag('--workingDir', '--working-dir', '-w');
    const { config } = await resolveRunnerGlobalOptions(cliWorkingDir);
    const task = config.scripts[scriptName];
    if (!task) fail(`Could not find inso script "${scriptName}" in the config file. Available scripts: ${Object.keys(config.scripts).join(', ') || 'none'}.`);
    const taskArgs = parseRunnerInsoScript(task);
    const scriptNameIndex = args.indexOf(scriptName, 1);
    const passThroughArgs = args.slice(scriptNameIndex + 1).flatMap((value, index, values) => {
      if (['--config', '--workingDir', '--working-dir', '-w'].includes(value)) return [];
      if (index > 0 && ['--config', '--workingDir', '--working-dir', '-w'].includes(values[index - 1])) return [];
      if (['--ci', '--verbose', '--printOptions', '--print-options'].includes(value)) return [];
      return [value];
    });
    if (config.filePath && !taskArgs.includes('--config')) taskArgs.push('--config', config.filePath);
    if (cliWorkingDir && !taskArgs.some((value) => ['--workingDir', '--working-dir', '-w'].includes(value))) taskArgs.push('--workingDir', cliWorkingDir);
    if (hasFlag('--ci') && !taskArgs.includes('--ci')) taskArgs.push('--ci');
    if (hasFlag('--verbose') && !taskArgs.includes('--verbose')) taskArgs.push('--verbose');
    const code = await runCliChild([...taskArgs, ...passThroughArgs]);
    process.exitCode = code;
    return;
  }

  if (command === 'run' && (subject === 'collection' || subject === 'test')) {
    const positionals = runnerCliPositionalArguments(args.slice(2));
    const cliWorkingDir = firstFlag('--workingDir', '--working-dir', '-w');
    const { workingDir, ci } = await resolveRunnerGlobalOptions(cliWorkingDir);
    const workspace = await loadWorkspace(workingDir ?? positionals[0] ?? fail('Provide a workspace file or use --workingDir.'));
    let identifier = positionals[workingDir ? 0 : 1];
    if (!identifier && ci) identifier = subject === 'test' ? orderedTestSuites(workspace.testSuites)[0]?.id : workspace.collections[0]?.id;
    if (!identifier && ci) fail(subject === 'test' ? 'No test suites found; cannot run tests.' : 'No collections found; cannot run requests.');
    if (!identifier) identifier = subject === 'test'
      ? await cliPromptResourceIdentifier([
        ...workspace.apiDesigns.map((design) => ({ id: design.id, name: `${design.name} · API design` })),
        ...orderedTestSuites(workspace.testSuites).map((suite) => ({ id: suite.id, name: `${suite.name} · test suite` })),
      ], 'test suite or API design')
      : await cliPromptResourceIdentifier(workspace.collections, 'collection');
    const suites = subject === 'test' ? selectUnitTestSuites(workspace, identifier) : [];
    if (subject === 'test' && !suites.length) fail(`No test suites were found for '${identifier}'.`);
    const sourceCollection = subject === 'test'
      ? workspace.collections.find((candidate) => candidate.id === suites[0].collectionId) ?? fail(`The selected test suite's collection was not found.`)
      : selectRunnerResource(workspace.collections, identifier, 'collection');
    const collectionEnvironmentIdentifier = await cliCollectionEnvironmentIdentifier(sourceCollection, firstFlag('--env', '-e'), ci);
    const collection = selectRunnerCollectionEnvironment(sourceCollection, collectionEnvironmentIdentifier);
    const globalIdentifier = firstFlag('--globals', '-g');
    const globalPath = globalIdentifier ? await stat(globalIdentifier).catch(() => undefined) : undefined;
    const globalEnvironments = globalPath?.isFile() ? await loadRunnerGlobalEnvironments(globalIdentifier!) : workspace.environments;
    const environment = selectRunnerGlobalEnvironment(globalEnvironments, globalPath?.isFile() ? globalEnvironments[0]?.id ?? '' : workspace.activeEnvironmentId, globalPath?.isFile() ? undefined : globalIdentifier);
    const selectedEnvironment = environment;
    const dataPath = firstFlag('--iteration-data', '--data', '-d');
    const requestedRequests = flagValues('--item', '--request', '-i');
    const environmentOverrides = flagValues('--env-var');
    const requestedDelay = firstFlag('--delay-request', '--delay');
    const keepTestFile = hasFlag('--keepFile') || hasFlag('--keep-file');
    const requestTimeoutMs = parseRunnerRequestTimeout(firstFlag('--requestTimeout', '--request-timeout'), workspace.preferences.requestTimeoutMs);
    if (subject === 'test' && requestedRequests.length) fail('--item/--request is only available for run collection.');
    if (subject === 'test' && environmentOverrides.length) fail('--env-var is only available for run collection.');
    if (subject === 'test' && requestedDelay !== undefined) fail('--delay-request is only available for run collection.');
    if (subject === 'collection' && keepTestFile) fail('--keepFile is only available for run test.');
    const selectedRequestIds = resolveRunnerItemRequestIds(collection, requestedRequests);
    const explicitRequestNamePattern = firstFlag('--requestNamePattern', '--request-name-pattern');
    const explicitTestNamePattern = firstFlag('--testNamePattern', '--test-name-pattern');
    if (subject === 'test' && explicitRequestNamePattern !== undefined) fail('--requestNamePattern is only available for run collection.');
    if (subject === 'collection' && explicitTestNamePattern !== undefined) fail('--testNamePattern is only available for run test.');
    const requestedRequestNamePattern = subject === 'collection' ? explicitRequestNamePattern ?? flag('-t') : undefined;
    const requestedTestNamePattern = subject === 'test' ? explicitTestNamePattern ?? flag('-t') : undefined;
    const requestIds = requestedRequestNamePattern === undefined
      ? selectedRequestIds
      : runnerRequestIdsMatchingPattern(collection.requests, requestedRequests.length ? selectedRequestIds : undefined, requestedRequestNamePattern);
    if ((requestedRequests.length || requestedRequestNamePattern !== undefined) && !requestIds.length) fail('No requests identified; nothing to run.');
    const testNamePattern = subject === 'test' ? validateTestNamePattern(requestedTestNamePattern) : undefined;
    const includeFullDataValue = firstFlag('--includeFullData', '--include-full-data');
    const includeFullData = includeFullDataValue === 'redact' || includeFullDataValue === 'plaintext' ? includeFullDataValue : undefined;
    const outputOption = firstFlag('--output', '-o');
    if (includeFullDataValue !== undefined && !includeFullData) fail('--includeFullData must be either redact or plaintext.');
    if (subject === 'test' && includeFullData) fail('--includeFullData is only available for run collection.');
    if (includeFullData && !outputOption) fail('--includeFullData requires --output <file>.');
    if (includeFullData && !hasFlag('--acceptRisk') && !hasFlag('--accept-risk')) fail('Full-data reports may contain secrets. Re-run with --acceptRisk after reviewing the output destination.');
    let reportOutputPath = '';
    if (outputOption) {
      const outputBase = await cliWorkingDirectoryBase(workingDir);
      reportOutputPath = resolve(outputBase, outputOption);
      const outputStats = await stat(reportOutputPath).catch((error: NodeJS.ErrnoException) => {
        if (error.code === 'ENOENT') return undefined;
        return fail(`Unable to inspect output path '${reportOutputPath}': ${error.message}`);
      });
      if (outputStats && !outputStats.isFile()) fail(`Output path '${reportOutputPath}' is not a file.`);
      if (outputStats) await access(reportOutputPath, fsConstants.W_OK).catch(() => fail(`Output file '${reportOutputPath}' is not writable.`));
    }
    const cliFileId = workspaceFileIdForCollection(workspace, collection.id);
    const fileCookies = new Map<string, CookieRecord[]>();
    const cookiesForFile = (fileId: string) => {
      const current = fileCookies.get(fileId);
      if (current) return current;
      const cookies = structuredClone(getWorkspaceFileState(workspace, fileId).cookies);
      fileCookies.set(fileId, cookies);
      return cookies;
    };
    const cliCookies = cookiesForFile(cliFileId);
    let cliResponses = [...workspace.responses];
    const dataFolders = await canonicalCliDataFolders(runnerCliVariadicOptionValues(args, '--dataFolders', '--data-folders', '-f'));
    const templateFileReader = hasFlag('--allow-template-files') || hasFlag('--allow-script-files')
      ? (path: string) => readCliTemplateFile(path, dataFolders)
      : async (_path: string) => { throw new Error('Template file access is disabled. Re-run trusted workspaces with --allow-template-files.'); };
    const scriptFileReader = hasFlag('--allow-script-files') ? (path: string) => readCliScriptFile(path, dataFolders) : undefined;
    const externalSecret = hasFlag('--allow-external-vaults')
      ? createCliExternalSecretResolver(workspace.governance.policy.externalVaultAllowlist)
      : async () => { throw new Error('External vault access is disabled. Re-run trusted workspaces with --allow-external-vaults.'); };
    const pluginTemplateRuntime = hasFlag('--allow-plugins')
      ? createCliPluginTemplateRuntime(workspace.plugins, workspace.pluginData)
      : undefined;
    const httpProxy = firstFlag('--httpProxy', '--http-proxy') ?? process.env.HTTP_PROXY ?? process.env.http_proxy ?? '';
    const httpsProxy = firstFlag('--httpsProxy', '--https-proxy') ?? process.env.HTTPS_PROXY ?? process.env.https_proxy ?? '';
    const noProxy = firstFlag('--noProxy', '--no-proxy') ?? process.env.NO_PROXY ?? process.env.no_proxy ?? '';
    const proxyPreferences = { enabled: Boolean(httpProxy || httpsProxy), httpProxy, httpsProxy, noProxy };
    const validateCertificates = !hasFlag('--disableCertValidation') && !hasFlag('--disable-cert-validation') && !hasFlag('-k');
    const captureCollectionReport = subject === 'collection' && Boolean(reportOutputPath);
    let retainedTestFilePath = '';
    if (subject === 'test' && keepTestFile) {
      const retainedDirectory = await mkdtemp(join(tmpdir(), 'brunomnia-testing-'));
      retainedTestFilePath = join(retainedDirectory, `${crypto.randomUUID()}-test.ts`);
      await writeFile(retainedTestFilePath, generateUnitTestCliArtifact(suites), { mode: 0o600 });
    }
    const reportExecutions: CliFullExecution[] = [];
    const pendingReportExecutions = new Map<string, Omit<CliFullExecution, 'tests' | 'iteration' | 'attempt'>>();
    const fullExecutionKey = (key: string, attempt: number) => `${key}\n${attempt}`;
    let resolveResponse: NonNullable<CliRequestContext['resolveResponse']>;
    const executeAndStore = async (
      request: ApiRequest,
      variables: Record<string, string>,
      environmentId: string,
      requestChain: string[] = [],
      cookies?: CookieRecord[],
      responses: StoredResponse[] = cliResponses,
      collectionEnvironmentId = collection.activeSubEnvironmentId ?? '',
    ): Promise<{ result: HttpResponse; stored: StoredResponse; request: ApiRequest }> => {
      const requestFileId = workspaceFileIdForRequest(workspace, request.id) || cliFileId;
      const requestCookies = cookies ?? cookiesForFile(requestFileId);
      const executed = await executeHttp(request, variables, requestTimeoutMs, validateCertificates, proxyPreferences, {
        environmentId,
        cookies: requestCookies,
        responses,
        certificates: getWorkspaceFileState(workspace, requestFileId).certificates,
        readFile: templateFileReader,
        externalSecret,
        resolveResponse,
        requestAncestors: requestAncestorNames(workspace.collections, request),
        requestChain,
        pluginTemplate: pluginTemplateRuntime?.render,
      });
      const { result } = executed;
      request = executed.request;
      const requestUrl = result.requestUrl ?? request.url;
      if (request.transport.storeCookies) {
        const updatedCookies = storeResponseCookies(requestCookies, requestUrl, result.setCookies ?? []);
        requestCookies.splice(0, requestCookies.length, ...updatedCookies);
      }
      const stored: StoredResponse = {
        ...result,
        id: `cli-response-${crypto.randomUUID()}`,
        requestId: request.id,
        requestName: request.name,
        requestUrl,
        environmentId,
        globalEnvironmentId: selectedEnvironment.id,
        collectionEnvironmentId,
        receivedAt: new Date().toISOString(),
        requestSnapshot: createRequestSnapshot(request),
        requestTestResults: [],
        settingSendCookies: request.transport.sendCookies,
        settingStoreCookies: request.transport.storeCookies,
      };
      const updatedResponses = retainResponseHistory(responses, stored, workspace.preferences.maxHistoryResponses, workspace.preferences.filterResponsesByEnv);
      responses.splice(0, responses.length, ...updatedResponses);
      cliResponses = responses;
      return { result, stored, request };
    };
    resolveResponse = async ({ requestId, requestChain, responses }) => {
      const dependencyCollection = subject === 'test'
        ? collection
        : workspace.collections.find((candidate) => candidate.requests.some((request) => request.id === requestId || request.name === requestId));
      const dependency = dependencyCollection?.requests.find((request) => request.id === requestId || request.name === requestId);
      if (!dependencyCollection || !dependency) throw new Error(`Could not find request ${requestId}`);
      const configured = applyCollectionConfiguration(dependencyCollection, dependency, environment);
      const dependencyCookies = cookiesForFile(workspaceFileIdForCollection(workspace, dependencyCollection.id));
      const { stored } = await executeAndStore(configured.request, environmentMap(configured.environment), configured.environment.id, [...new Set([...requestChain, dependency.id])], dependencyCookies, responses, dependencyCollection.activeSubEnvironmentId ?? '');
      return stored;
    };
    const executeWorkspaceHttp = async (request: ApiRequest, variables: Record<string, string>) => (await executeAndStore(request, variables, environment.id)).result;
    const iterations = Math.min(1_000, Math.max(1, Math.floor(Number(firstFlag('--iteration-count', '--iterations', '-n') ?? 1) || 1)));
    const retries = Math.min(10, Math.max(0, Math.floor(Number(flag('--retries') ?? 0) || 0)));
    const delayMs = Math.min(30_000, Math.max(0, Math.floor(Number(requestedDelay ?? 0) || 0)));
    const scriptTimeoutMs = Math.min(60_000, Math.max(1_000, Number(flag('--script-timeout') ?? 10_000)));
    const dataRows = applyRunnerEnvironmentOverrides(dataPath ? parseRunnerData(await loadRunnerIterationData(dataPath, loadText)) : [], environmentOverrides);
    let report: RunnerReport;
    if (subject === 'collection') {
      report = await runCollection(collection, environment, {
        iterations, retries, bail: hasFlag('--bail') || hasFlag('-b'), delayMs,
        scriptTimeoutMs,
        environmentScopes: scriptEnvironmentScopes(globalEnvironments, selectedEnvironment.id),
        dataRows,
        ...(requestedRequests.length || requestedRequestNamePattern !== undefined ? { requestIds } : {}),
        onResult: (result) => {
          if (captureCollectionReport && result.key) {
            const key = fullExecutionKey(result.key, result.attempt);
            const execution = pendingReportExecutions.get(key);
            if (execution) {
              reportExecutions.push({ ...execution, tests: structuredClone(result.tests), iteration: result.iteration, attempt: result.attempt });
              pendingReportExecutions.delete(key);
            }
          }
          const responseIndex = cliResponses.findIndex((response) => response.requestId === result.requestId);
          if (responseIndex < 0) return;
          const requestTestResults = result.tests.slice(0, 1_000).map((test) => ({ ...test, name: test.name.slice(0, 2_000), ...(test.error ? { error: test.error.slice(0, 20_000) } : {}) }));
          cliResponses[responseIndex] = { ...cliResponses[responseIndex], requestTestResults };
        },
      }, async (request, variables, execution) => {
        const executed = await executeAndStore(request, variables, environment.id);
        if (captureCollectionReport) {
          pendingReportExecutions.set(fullExecutionKey(execution.key, execution.attempt), {
            request: structuredClone(executed.request),
            response: structuredClone(executed.result),
            environment: { ...variables },
          });
        }
        return executed.result;
      }, (source, request, variables, response, timeoutMs, localVariables, iterationData, scriptOptions) => {
        if (source.trim() && !hasFlag('--allow-scripts')) throw new Error('CLI script execution is disabled. Re-run trusted workspaces with --allow-scripts.');
        return runNodeScript(source, request, variables, response, timeoutMs, localVariables, iterationData, {
          ...scriptOptions,
          sendRequest: hasFlag('--allow-script-requests') ? executeWorkspaceHttp : undefined,
          readFile: scriptFileReader,
        });
      });
    } else {
      const startedAt = new Date().toISOString();
      const results: RunnerItemResult[] = [];
      const pattern = testNamePattern === undefined ? undefined : new RegExp(testNamePattern);
      const globalScopes = scriptEnvironmentScopes(globalEnvironments, selectedEnvironment.id);
      const collectionScopes = collectionEnvironmentScopes(collection);
      let bailed = false;
      outer: for (let iteration = 0; iteration < iterations; iteration += 1) {
        const iterationData = dataRows[iteration % Math.max(1, dataRows.length)] ?? {};
        for (const suite of suites) {
          for (const test of orderedUnitTests(suite.tests)) {
            if (pattern && !pattern.test(test.name)) continue;
            for (let attempt = 1; attempt <= retries + 1; attempt += 1) {
              const started = performance.now();
              const target = collection.requests.find((request) => request.id === test.requestId || request.name === test.requestId);
              const configured = target ? applyCollectionConfiguration(collection, target, environment) : undefined;
              const scriptRequest = configured?.request ?? createBlankRequest(`cli-unit-test-${test.id}`);
              let response: HttpResponse | undefined;
              let tests: RunnerItemResult['tests'] = [];
              let error: string | undefined;
              try {
                if (!hasFlag('--allow-scripts')) throw new Error('CLI script execution is disabled. Re-run trusted workspaces with --allow-scripts.');
                const output = await runNodeScript(unitTestScript(test), scriptRequest, globalScopes?.globals.values ?? environmentMap(environment), undefined, scriptTimeoutMs, {}, iterationData, {
                  baseGlobals: globalScopes?.baseGlobals.values ?? environmentMap(environment),
                  baseGlobalDisabled: globalScopes?.baseGlobals.disabled ?? [],
                  globalDisabled: globalScopes?.globals.disabled ?? [],
                  globalsAreBase: globalScopes?.globalsAreBase ?? true,
                  baseEnvironment: collectionScopes.baseEnvironment.values,
                  baseEnvironmentDisabled: collectionScopes.baseEnvironment.disabled,
                  collectionVariables: collectionScopes.environment.values,
                  collectionDisabled: collectionScopes.environment.disabled,
                  collectionVariablesAreBase: collectionScopes.environmentIsBase,
                  folders: (configured?.folders ?? []).map((folder) => { const scope = variableScope([folder.environment]); return { id: folder.id, name: folder.name, environment: scope.values, disabled: scope.disabled }; }),
                  testNamePattern,
                  sendRequestById: async (requestId) => {
                    const sourceRequest = collection.requests.find((request) => request.id === (requestId ?? test.requestId) || request.name === (requestId ?? test.requestId));
                    if (!sourceRequest) throw new Error(requestId || test.requestId ? `Could not find request ${requestId ?? test.requestId}` : 'Select a request before calling insomnia.send().');
                    if (sourceRequest.protocol !== 'http' && sourceRequest.protocol !== 'graphql') throw new Error('Standalone unit tests can send HTTP and GraphQL requests.');
                    const prepared = applyCollectionConfiguration(collection, sourceRequest, environment);
                    response = (await executeAndStore(prepared.request, environmentMap(prepared.environment), prepared.environment.id, [], cliCookies, cliResponses, collection.activeSubEnvironmentId ?? '')).result;
                    return response;
                  },
                  sendRequest: hasFlag('--allow-script-requests') ? async (request, variables) => {
                    response = await executeWorkspaceHttp(request, variables);
                    return response;
                  } : undefined,
                  readFile: scriptFileReader,
                  maxSubrequests: 20,
                });
                tests = output.tests;
                if (!tests.length) error = 'The test did not report a result.';
              } catch (caught) {
                error = caught instanceof Error ? caught.message : String(caught);
              }
              const passed = !error && tests.length > 0 && tests.every((testResult) => !scriptTestFailed(testResult));
              results.push({
                id: `run-${crypto.randomUUID()}`,
                requestId: test.requestId ?? test.id,
                requestName: suites.length === 1 ? test.name : `${suite.name} › ${test.name}`,
                iteration: iteration + 1,
                attempt,
                status: response?.status ?? 0,
                durationMs: Math.max(0, Math.round(performance.now() - started)),
                passed,
                error,
                tests,
              });
              if (passed || attempt > retries) {
                if (!passed && (hasFlag('--bail') || hasFlag('-b'))) { bailed = true; break outer; }
                break;
              }
            }
          }
        }
      }
      report = {
        id: `run-${crypto.randomUUID()}`,
        collectionId: collection.id,
        collectionName: suites.length === 1 ? suites[0].name : `${collection.name} test suites`,
        environmentId: environment.id,
        startedAt,
        finishedAt: new Date().toISOString(),
        iterations,
        retries,
        testNamePattern,
        matchedTests: results.reduce((total, result) => total + result.tests.length, 0),
        total: results.length,
        passed: results.filter((result) => result.passed).length,
        failed: results.filter((result) => !result.passed).length,
        cancelled: false,
        bailed,
        results,
      };
    }
    const reporter = parseRunnerReporter(flag('--reporter') ?? flag('-r'), 'spec');
    const reporterArtifact = createRunnerReportArtifact(report, reporter);
    const artifact = subject === 'collection' && reportOutputPath
      ? includeFullData
        ? { contents: `${JSON.stringify(createCliFullDataReport(report, collection, environment, proxyPreferences, reportExecutions, includeFullData), null, 2)}\n`, label: `${includeFullData} full-data` }
        : { contents: `${JSON.stringify(createCliSafeDataReport(report, collection, environment, proxyPreferences, reportExecutions), null, 2)}\n`, label: 'safe collection' }
      : { contents: reporterArtifact.contents, label: reporter };
    if (reportOutputPath) {
      await mkdir(dirname(reportOutputPath), { recursive: true });
      await writeFile(reportOutputPath, artifact.contents);
      if (subject === 'collection') {
        console.error(`Wrote ${artifact.label} report to ${reportOutputPath}`);
        process.stdout.write(reporterArtifact.contents);
      } else {
        console.log(`Wrote ${artifact.label} report to ${reportOutputPath}`);
      }
    } else {
      process.stdout.write(artifact.contents);
    }
    if (retainedTestFilePath) console.log(`Test files: ${JSON.stringify([retainedTestFilePath])}.`);
    if (report.failed > 0) process.exitCode = 1;
    return;
  }

  fail(`Unknown command.\n\n${usage}`);
};

void main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
