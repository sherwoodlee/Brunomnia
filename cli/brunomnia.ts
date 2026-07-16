import { readFile, writeFile } from 'node:fs/promises';
import vm from 'node:vm';
import { analyzeOpenApi, generateCollectionFromOpenApi } from '../src/lib/openapi';
import { buildHeaders, buildRequestUrl, resolveTemplate } from '../src/lib/request';
import { parseRunnerData, runCollection } from '../src/lib/runner';
import type { ApiDesign, ApiRequest, Environment, HttpResponse, ScriptRunResult, Workspace } from '../src/types';

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

const expectApi = (actual: unknown) => ({
  toBe(expected: unknown) { if (actual !== expected) throw new Error(`Expected ${JSON.stringify(actual)} to be ${JSON.stringify(expected)}`); },
  toEqual(expected: unknown) { if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Expected ${JSON.stringify(actual)} to equal ${JSON.stringify(expected)}`); },
  toContain(expected: unknown) { if (!(actual as { includes?: (value: unknown) => boolean })?.includes?.(expected)) throw new Error(`Expected value to contain ${JSON.stringify(expected)}`); },
  toBeTruthy() { if (!actual) throw new Error('Expected value to be truthy'); },
  toBeLessThan(expected: number) { if (!(Number(actual) < expected)) throw new Error(`Expected ${actual} to be less than ${expected}`); },
  toBeGreaterThan(expected: number) { if (!(Number(actual) > expected)) throw new Error(`Expected ${actual} to be greater than ${expected}`); },
});

const runNodeScript = async (
  source: string,
  originalRequest: ApiRequest,
  originalEnvironment: Record<string, string>,
  response?: HttpResponse,
): Promise<ScriptRunResult> => {
  const request = structuredClone(originalRequest);
  const environment = { ...originalEnvironment };
  const logs: string[] = [];
  const tests: ScriptRunResult['tests'] = [];
  if (!source.trim()) return { request, environment, logs, tests };
  const requestWithHelpers = request as ApiRequest & {
    addHeader?: (header: { key?: string; name?: string; value: unknown }) => void;
    removeHeader?: (name: string) => void;
  };
  requestWithHelpers.addHeader = ({ key, name, value }) => {
    request.headers.push({ id: `cli-script-${Date.now()}-${request.headers.length}`, name: key || name || '', value: String(value), enabled: true });
  };
  requestWithHelpers.removeHeader = (name) => {
    request.headers = request.headers.filter((header) => header.name.toLowerCase() !== name.toLowerCase());
  };
  const insomnia = {
    environment: {
      get: (name: string) => environment[name],
      set: (name: string, value: unknown) => { environment[name] = String(value); },
      unset: (name: string) => { delete environment[name]; },
      toObject: () => ({ ...environment }),
    },
    request,
    response: response ? {
      status: response.status,
      responseTime: response.durationMs,
      json: () => JSON.parse(response.body),
      text: () => response.body,
      headers: Object.entries(response.headers).map(([key, value]) => ({ key, value })),
    } : undefined,
    test: (name: string, callback: () => void) => {
      try { callback(); tests.push({ name, passed: true }); }
      catch (error) { tests.push({ name, passed: false, error: error instanceof Error ? error.message : String(error) }); }
    },
  };
  const context = vm.createContext({
    insomnia,
    expect: expectApi,
    console: {
      log: (...values: unknown[]) => logs.push(values.map(String).join(' ')),
      info: (...values: unknown[]) => logs.push(values.map(String).join(' ')),
      warn: (...values: unknown[]) => logs.push(`[warn] ${values.map(String).join(' ')}`),
      error: (...values: unknown[]) => logs.push(`[error] ${values.map(String).join(' ')}`),
    },
    structuredClone,
    JSON,
  }, { codeGeneration: { strings: false, wasm: false } });
  const script = new vm.Script(`(async () => { ${source}\n })()`, { filename: `${request.name}.script.js` });
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      Promise.resolve(script.runInContext(context, { timeout: 2000 })),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error('Script exceeded the 2000 ms execution limit.')), 2000);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
    delete requestWithHelpers.addHeader;
    delete requestWithHelpers.removeHeader;
  }
  return { request, environment, logs, tests };
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
        form.append(part.name, new Blob([Buffer.from(part.file.dataBase64, 'base64')], { type: part.file.mimeType }), part.file.fileName);
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

  brunomnia lint spec <openapi-file> [--json]
  brunomnia generate collection <openapi-file> --output <file>
  brunomnia export spec <workspace> <design-name-or-id> [--output <file>]
  brunomnia run collection <workspace> <collection-name-or-id> [--env <name-or-id>] [--iterations N] [--retries N] [--data <json-or-csv>]
  brunomnia run test <workspace> <collection-name-or-id> [same options]
`;

const main = async () => {
  const [command, subject] = args;
  if (!command || hasFlag('--help') || hasFlag('-h')) { console.log(usage); return; }

  if (command === 'lint' && subject === 'spec') {
    const path = args[2] ?? fail('Provide an OpenAPI file.');
    const analysis = analyzeOpenApi(await loadText(path));
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
    const environmentIdentifier = flag('--env');
    const environment: Environment = workspace.environments.find((candidate) => candidate.id === environmentIdentifier || candidate.name === environmentIdentifier) ?? workspace.environments[0] ?? fail('The workspace has no environment.');
    const dataPath = flag('--data');
    const report = await runCollection(collection, environment, {
      iterations: Number(flag('--iterations') ?? 1), retries: Number(flag('--retries') ?? 0), delayMs: 0,
      dataRows: dataPath ? parseRunnerData(await loadText(dataPath)) : [],
    }, executeHttp, runNodeScript);
    console.log(JSON.stringify(report, null, 2));
    if (report.failed > 0) process.exitCode = 1;
    return;
  }

  fail(`Unknown command.\n\n${usage}`);
};

void main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
