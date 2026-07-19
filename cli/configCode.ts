import { extname } from 'node:path';
import { Worker } from 'node:worker_threads';
import ts from 'typescript';

const configCodeLimit = 1_000_000;

type ConfigWorkerResult = {
  ok: boolean;
  error?: string;
  serialized?: string;
};

const prepareConfigCode = (source: string, path: string) => {
  if (Buffer.byteLength(source, 'utf8') > configCodeLimit) throw new Error(`Executable Inso config '${path}' exceeds the 1 MB limit.`);
  const withoutShebang = source.replace(/^#![^\n]*(?:\n|$)/, '');
  if (/\bimport\s*(?:\(|[\w*{])/m.test(withoutShebang) || /\brequire\s*\(/m.test(withoutShebang)) {
    throw new Error('Executable Inso config imports and require() are unavailable in the bounded config runtime.');
  }
  const extension = extname(path).toLowerCase();
  let code: string;
  if (extension === '.ts') {
    const transpiled = ts.transpileModule(withoutShebang, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
        isolatedModules: true,
      },
      fileName: path,
      reportDiagnostics: true,
    });
    const diagnostic = transpiled.diagnostics?.find(entry => entry.category === ts.DiagnosticCategory.Error);
    if (diagnostic) throw new Error(`Executable Inso TypeScript config '${path}' is invalid: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')}`);
    code = transpiled.outputText;
  } else {
    const defaultExports = withoutShebang.match(/\bexport\s+default\b/g) ?? [];
    if (defaultExports.length > 1 || /\bexport\s+(?!default\b)/m.test(withoutShebang)) {
      throw new Error('Executable Inso config supports only one default export.');
    }
    code = defaultExports.length
      ? withoutShebang.replace(/\bexport\s+default\b/, 'module.exports =')
      : withoutShebang;
  }
  if (Buffer.byteLength(code, 'utf8') > configCodeLimit) throw new Error(`Executable Inso config '${path}' exceeds the 1 MB compiled-code limit.`);
  return code;
};

export const evaluateRunnerConfigCode = async (source: string, path: string): Promise<unknown> => {
  const code = prepareConfigCode(source, path);
  const bootstrap = `
import vm from 'node:vm';
import { parentPort, workerData } from 'node:worker_threads';
const context = vm.createContext(Object.create(null), {
  codeGeneration: { strings: false, wasm: false },
  name: 'brunomnia-inso-config',
});
const script = new vm.Script(\`
'use strict';
const module = { exports: {} };
const exports = module.exports;
for (const name of ['ArrayBuffer', 'SharedArrayBuffer', 'DataView', 'Uint8Array', 'Uint8ClampedArray', 'Int8Array', 'Uint16Array', 'Int16Array', 'Uint32Array', 'Int32Array', 'Float32Array', 'Float64Array', 'BigInt64Array', 'BigUint64Array']) {
  Object.defineProperty(globalThis, name, { value: undefined, writable: false, configurable: false });
}
\${workerData.code}
const configValue = module.exports && module.exports.__esModule ? module.exports.default : module.exports;
globalThis.__brunomniaConfigJson = JSON.stringify(configValue, (_key, value) => {
  if (['undefined', 'function', 'symbol', 'bigint'].includes(typeof value)) throw new TypeError('Config contains a non-JSON value.');
  return value;
});
\`, { filename: workerData.path });
try {
  script.runInContext(context, { timeout: 500 });
  const serialized = context.__brunomniaConfigJson;
  if (typeof serialized !== 'string') throw new Error(\`Executable Inso config '\${workerData.path}' must export a JSON-compatible object.\`);
  if (Buffer.byteLength(serialized, 'utf8') > ${configCodeLimit}) throw new Error(\`Executable Inso config '\${workerData.path}' returned more than 1 MB.\`);
  parentPort.postMessage({ ok: true, serialized });
} catch (error) {
  parentPort.postMessage({ ok: false, error: error instanceof Error ? error.message : String(error) });
}
`;
  const workerUrl = new URL(`data:text/javascript;base64,${Buffer.from(bootstrap).toString('base64')}`);
  const worker = new Worker(workerUrl, {
    workerData: { code, path },
    resourceLimits: { maxOldGenerationSizeMb: 16, maxYoungGenerationSizeMb: 4, stackSizeMb: 2 },
  });
  try {
    const result = await new Promise<ConfigWorkerResult>((resolveWorker, rejectWorker) => {
      let settled = false;
      const finish = (callback: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        callback();
      };
      const timeout = setTimeout(() => finish(() => rejectWorker(new Error(`Executable Inso config '${path}' exceeded the 1000 ms worker limit.`))), 1_000);
      worker.on('error', error => finish(() => rejectWorker(error)));
      worker.on('exit', code => finish(() => rejectWorker(new Error(`Executable Inso config '${path}' worker exited with code ${code}.`))));
      worker.on('message', (message: ConfigWorkerResult) => finish(() => resolveWorker(message)));
    });
    if (!result.ok) throw new Error(result.error || `Executable Inso config '${path}' failed.`);
    const serialized = result.serialized;
    if (typeof serialized !== 'string') throw new Error(`Executable Inso config '${path}' must export a JSON-compatible object.`);
    if (Buffer.byteLength(serialized, 'utf8') > configCodeLimit) throw new Error(`Executable Inso config '${path}' returned more than 1 MB.`);
    const parsed = JSON.parse(serialized) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error(`Executable Inso config '${path}' must export an object.`);
    return parsed;
  } finally {
    await worker.terminate().catch(() => undefined);
  }
};
