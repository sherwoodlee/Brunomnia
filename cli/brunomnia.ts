import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { arch, cpus, freemem, hostname, platform, release, userInfo } from 'node:os';
import { basename, extname, join } from 'node:path';
import vm from 'node:vm';
import { parse as parseYaml } from 'yaml';
import { analyzeOpenApi, generateCollectionFromOpenApi } from '../src/lib/openapi';
import { createBlankRequest } from '../src/data/seed';
import { buildHeaders, buildRequestUrl, environmentMap } from '../src/lib/request';
import { renderApiRequest } from '../src/lib/requestRender';
import { parseRunnerData, runCollection, validateTestNamePattern } from '../src/lib/runner';
import { createRunnerReportArtifact, parseRunnerReporter } from '../src/lib/runnerReport';
import type { ApiDesign, ApiRequest, AuthConfig, CookieRecord, Environment, HttpResponse, RunnerItemResult, RunnerReport, ScriptRunResult, StoredResponse, Workspace } from '../src/types';
import { applyCollectionConfiguration, collectionEnvironmentScopes, requestAncestorNames, resolveEnvironment, scriptEnvironmentScopes, variableScope } from '../src/lib/resources';
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
import { orderedUnitTests, selectUnitTestSuites, unitTestScript } from '../src/lib/unitTests';
import { createCliExternalSecretResolver } from './externalVault';
import { applyRunnerEnvironmentOverrides, resolveRunnerItemRequestIds, runnerRequestIdsMatchingPattern } from '../src/lib/runnerCli';

const args = process.argv.slice(2);
const flag = (name: string) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const firstFlag = (...names: string[]) => names.map(flag).find((value) => value !== undefined);
const flagValues = (...names: string[]) => args.flatMap((argument, index) => names.includes(argument) && args[index + 1] !== undefined ? [args[index + 1]] : []);
const hasFlag = (name: string) => args.includes(name);
const fail = (message: string, code = 1): never => {
  console.error(message);
  process.exit(code);
};
const loadText = async (path: string) => readFile(path, 'utf8').catch((error) => fail(`Unable to read ${path}: ${error.message}`));
const scriptFileMime = (path: string) => ({
  '.cer': 'application/x-pem-file', '.crt': 'application/x-pem-file', '.csv': 'text/csv', '.gif': 'image/gif', '.htm': 'text/html', '.html': 'text/html', '.jpeg': 'image/jpeg', '.jpg': 'image/jpeg', '.json': 'application/json', '.key': 'application/x-pem-file', '.pdf': 'application/pdf', '.pem': 'application/x-pem-file', '.png': 'image/png', '.txt': 'text/plain', '.xml': 'application/xml',
} as Record<string, string>)[extname(path).toLowerCase()] ?? 'application/octet-stream';
const readCliScriptFile = async (path: string) => {
  const bytes = await readFile(path);
  if (bytes.byteLength > 5_000_000) throw new Error(`Script file '${path}' exceeds the 5 MB per-file limit.`);
  return { fileName: basename(path) || 'attachment.bin', mimeType: scriptFileMime(path), dataBase64: bytes.toString('base64') };
};
const readCliTemplateFile = async (path: string) => {
  const bytes = await readFile(path);
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
};

const executeHttp = async (
  request: ApiRequest,
  variables: Record<string, string>,
  requestTimeoutMs = 30_000,
  validateCertificates = true,
  proxyPreferences?: ProxyPreferences,
  context?: CliRequestContext,
): Promise<HttpResponse> => {
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
  if (resolveProxyTransport(request.transport, url, proxyPreferences).proxyMode === 'custom') {
    throw new Error('The CLI cannot use a manual proxy because Node Fetch does not expose per-request proxy configuration. Use the native desktop transport or configure a supported runner-level proxy.');
  }
  if (request.transport.caCertificatePem || request.transport.clientCertificatePem || request.transport.clientKeyPem || request.transport.clientCertificatePfxBase64) {
    throw new Error('The CLI cannot attach custom CA or client-certificate material because Node Fetch does not expose per-request TLS configuration. Use the native desktop transport for workspace CA, PEM, or PFX/PKCS#12 identities.');
  }
  if (!resolveCertificateValidation(request.transport, validateCertificates)) {
    throw new Error('The CLI cannot disable TLS certificate validation because Node Fetch does not expose that authority. Use the native desktop transport for explicitly untrusted development certificates.');
  }
  const response = await fetch(url, {
    method: request.method,
    headers: Object.fromEntries(headers.filter((header) => header.enabled && header.name).map((header) => [header.name, header.value])),
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : body,
    redirect: request.transport.followRedirects ? 'follow' : 'manual',
    signal: timeoutMs > 0 ? AbortSignal.timeout(timeoutMs) : undefined,
  });
  const responseBody = await response.text();
  const getSetCookie = (response.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
  return { status: response.status, statusText: response.statusText, headers: Object.fromEntries(response.headers.entries()), body: responseBody, durationMs: Math.round(performance.now() - started), sizeBytes: Buffer.byteLength(responseBody), requestUrl: url, setCookies: getSetCookie?.call(response.headers) ?? [] };
};

const usage = `Brunomnia CLI

  brunomnia lint spec <openapi-file> [--ruleset <spectral-yaml>] [--json]
  brunomnia generate collection <openapi-file> --output <file>
  brunomnia export spec <workspace> <design-name-or-id> [--output <file>]
  brunomnia run collection <workspace-or-project> <collection-name-or-id> [-e, --env <name-or-id>] [-t, --requestNamePattern <regex>] [-i, --item <name-or-id>]... [--env-var <key=value>]... [-n, --iteration-count N] [--retries N] [--delay-request MS] [-d, --iteration-data <json-or-csv>] [-b, --bail] [--reporter <name>] [--output <file>] [--allow-scripts] [--allow-script-requests] [--allow-script-files] [--allow-template-files] [--allow-external-vaults]
  brunomnia run test <workspace> <suite-name-or-id|spec-name-or-id> [-t, --testNamePattern <regex>] [same options except --item/--env-var/--delay-request]

Reporters: dot, list, min, progress, spec, tap, json, junit
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
    const identifier = args[3] ?? fail(subject === 'test' ? 'Provide a test suite or API specification name or ID.' : 'Provide a collection name or ID.');
    const suites = subject === 'test' ? selectUnitTestSuites(workspace, identifier) : [];
    if (subject === 'test' && !suites.length) fail(`No test suites were found for '${identifier}'.`);
    const collection = subject === 'test'
      ? workspace.collections.find((candidate) => candidate.id === suites[0].collectionId) ?? fail(`The selected test suite's collection was not found.`)
      : workspace.collections.find((candidate) => candidate.id === identifier || candidate.name === identifier) ?? fail(`Collection '${identifier}' was not found.`);
    const environmentIdentifier = firstFlag('--env', '-e') ?? workspace.activeEnvironmentId;
    const selectedEnvironment: Environment = workspace.environments.find((candidate) => candidate.id === environmentIdentifier || candidate.name === environmentIdentifier) ?? workspace.environments[0] ?? fail('The workspace has no environment.');
    const environment = resolveEnvironment(workspace.environments, selectedEnvironment.id) ?? selectedEnvironment;
    const dataPath = firstFlag('--iteration-data', '--data', '-d');
    const requestedRequests = flagValues('--item', '--request', '-i');
    const environmentOverrides = flagValues('--env-var');
    const requestedDelay = firstFlag('--delay-request', '--delay');
    if (subject === 'test' && requestedRequests.length) fail('--item/--request is only available for run collection.');
    if (subject === 'test' && environmentOverrides.length) fail('--env-var is only available for run collection.');
    if (subject === 'test' && requestedDelay !== undefined) fail('--delay-request is only available for run collection.');
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
    let cliCookies = [...workspace.cookies];
    let cliResponses = [...workspace.responses];
    const templateFileReader = hasFlag('--allow-template-files') || hasFlag('--allow-script-files')
      ? readCliTemplateFile
      : async (_path: string) => { throw new Error('Template file access is disabled. Re-run trusted workspaces with --allow-template-files.'); };
    const externalSecret = hasFlag('--allow-external-vaults')
      ? createCliExternalSecretResolver(workspace.governance.policy.externalVaultAllowlist)
      : async () => { throw new Error('External vault access is disabled. Re-run trusted workspaces with --allow-external-vaults.'); };
    const proxyPreferences = {
        enabled: workspace.preferences.proxyEnabled,
        httpProxy: workspace.preferences.httpProxy,
        httpsProxy: workspace.preferences.httpsProxy,
        noProxy: workspace.preferences.noProxy,
      };
    let resolveResponse: NonNullable<CliRequestContext['resolveResponse']>;
    const executeAndStore = async (
      request: ApiRequest,
      variables: Record<string, string>,
      environmentId: string,
      requestChain: string[] = [],
      cookies: CookieRecord[] = cliCookies,
      responses: StoredResponse[] = cliResponses,
      collectionEnvironmentId = collection.activeSubEnvironmentId ?? '',
    ): Promise<{ result: HttpResponse; stored: StoredResponse }> => {
      const result = await executeHttp(request, variables, workspace.preferences.requestTimeoutMs, workspace.preferences.validateCertificates, proxyPreferences, {
        environmentId,
        cookies,
        responses,
        certificates: workspace.certificates,
        readFile: templateFileReader,
        externalSecret,
        resolveResponse,
        requestAncestors: requestAncestorNames(workspace.collections, request),
        requestChain,
      });
      const requestUrl = result.requestUrl ?? request.url;
      if (request.transport.storeCookies) {
        const updatedCookies = storeResponseCookies(cookies, requestUrl, result.setCookies ?? []);
        cookies.splice(0, cookies.length, ...updatedCookies);
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
      cliCookies = cookies;
      cliResponses = responses;
      return { result, stored };
    };
    resolveResponse = async ({ requestId, requestChain, cookies, responses }) => {
      const dependencyCollection = subject === 'test'
        ? collection
        : workspace.collections.find((candidate) => candidate.requests.some((request) => request.id === requestId || request.name === requestId));
      const dependency = dependencyCollection?.requests.find((request) => request.id === requestId || request.name === requestId);
      if (!dependencyCollection || !dependency) throw new Error(`Could not find request ${requestId}`);
      const configured = applyCollectionConfiguration(dependencyCollection, dependency, environment);
      const { stored } = await executeAndStore(configured.request, environmentMap(configured.environment), configured.environment.id, [...new Set([...requestChain, dependency.id])], cookies, responses, dependencyCollection.activeSubEnvironmentId ?? '');
      return stored;
    };
    const executeWorkspaceHttp = async (request: ApiRequest, variables: Record<string, string>) => (await executeAndStore(request, variables, environment.id)).result;
    const iterations = Math.min(1_000, Math.max(1, Math.floor(Number(firstFlag('--iteration-count', '--iterations', '-n') ?? 1) || 1)));
    const retries = Math.min(10, Math.max(0, Math.floor(Number(flag('--retries') ?? 0) || 0)));
    const delayMs = Math.min(30_000, Math.max(0, Math.floor(Number(requestedDelay ?? 0) || 0)));
    const scriptTimeoutMs = Math.min(60_000, Math.max(1_000, Number(flag('--script-timeout') ?? 10_000)));
    const dataRows = applyRunnerEnvironmentOverrides(dataPath ? parseRunnerData(await loadText(dataPath)) : [], environmentOverrides);
    let report: RunnerReport;
    if (subject === 'collection') {
      report = await runCollection(collection, environment, {
        iterations, retries, bail: hasFlag('--bail') || hasFlag('-b'), delayMs,
        scriptTimeoutMs,
        environmentScopes: scriptEnvironmentScopes(workspace.environments, selectedEnvironment.id),
        dataRows,
        ...(requestedRequests.length || requestedRequestNamePattern !== undefined ? { requestIds } : {}),
        onResult: (result) => {
          const responseIndex = cliResponses.findIndex((response) => response.requestId === result.requestId);
          if (responseIndex < 0) return;
          const requestTestResults = result.tests.slice(0, 1_000).map((test) => ({ ...test, name: test.name.slice(0, 2_000), ...(test.error ? { error: test.error.slice(0, 20_000) } : {}) }));
          cliResponses[responseIndex] = { ...cliResponses[responseIndex], requestTestResults };
        },
      }, executeWorkspaceHttp, (source, request, variables, response, timeoutMs, localVariables, iterationData, scriptOptions) => {
        if (source.trim() && !hasFlag('--allow-scripts')) throw new Error('CLI script execution is disabled. Re-run trusted workspaces with --allow-scripts.');
        return runNodeScript(source, request, variables, response, timeoutMs, localVariables, iterationData, {
          ...scriptOptions,
          sendRequest: hasFlag('--allow-script-requests') ? executeWorkspaceHttp : undefined,
          readFile: hasFlag('--allow-script-files') ? readCliScriptFile : undefined,
        });
      });
    } else {
      const startedAt = new Date().toISOString();
      const results: RunnerItemResult[] = [];
      const pattern = testNamePattern === undefined ? undefined : new RegExp(testNamePattern);
      const globalScopes = scriptEnvironmentScopes(workspace.environments, selectedEnvironment.id);
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
                  readFile: hasFlag('--allow-script-files') ? readCliScriptFile : undefined,
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
    const reporter = parseRunnerReporter(flag('--reporter') ?? flag('-r'), subject === 'test' ? 'spec' : 'json');
    const artifact = createRunnerReportArtifact(report, reporter);
    const output = flag('--output') ?? flag('-o');
    if (output) {
      await writeFile(output, artifact.contents);
      console.log(`Wrote ${reporter} report to ${output}`);
    } else {
      process.stdout.write(artifact.contents);
    }
    if (report.failed > 0) process.exitCode = 1;
    return;
  }

  fail(`Unknown command.\n\n${usage}`);
};

void main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
