import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = process.cwd();
const temporary = await mkdtemp(join(tmpdir(), 'brunomnia-cli-physical-'));
const manifestPath = join(temporary, 'workspace.json');
const recordsPath = join(temporary, 'workspace.records');
const source = JSON.parse(await readFile(join(root, 'examples', 'cli-workspace.json'), 'utf8'));

const shell = structuredClone(source);
shell.collections = [];
shell.environments = [];
shell.apiDesigns = [];
shell.mockServers = [];
shell.mcpClients = [];
shell.fileState = { ...(shell.fileState ?? {}) };
const records = [];
const add = (scope, id, payload) => {
  const key = `record-${String(records.length).padStart(5, '0')}.json`;
  const fileState = source.fileState?.[id];
  if (fileState) delete shell.fileState[id];
  records.push({
    key,
    reference: { key, scope, id },
    value: { format: 'brunomnia-project-file', version: 1, scope, id, ...(fileState ? { fileState } : {}), ...payload },
  });
};

source.collections.forEach((collection, index) => add('collection', collection.id, { collection: { index, value: collection } }));
const environmentIds = new Set(source.environments.map((environment) => environment.id));
source.environments.forEach((environment, index) => {
  if (environment.parentId && environmentIds.has(environment.parentId)) return;
  const branch = source.environments.flatMap((candidate, candidateIndex) => candidate.id === environment.id || candidate.parentId === environment.id ? [{ index: candidateIndex, value: candidate }] : []);
  add('environment', environment.id, { environments: branch });
});

await mkdir(recordsPath);
await Promise.all(records.map(({ key, value }) => writeFile(join(recordsPath, key), JSON.stringify(value))));
await writeFile(manifestPath, JSON.stringify({ format: 'brunomnia-project-store', version: 1, workspace: shell, records: records.map(({ reference }) => reference) }));

const run = () => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [
    join(root, 'bin', 'brunomnia.cjs'),
    'run', 'collection', manifestPath, 'CLI Health', '--ci', '--item', 'cli-health-request',
    '--allow-scripts', '--allow-script-files', '-f', join(root, 'examples'), '--reporter', 'json',
  ], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => { stdout += chunk; });
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  child.once('error', reject);
  child.once('close', (code) => resolve({ code, stdout, stderr }));
});

try {
  const result = await run();
  assert.equal(result.code, 0, `Physical-store CLI smoke exited ${result.code}. ${result.stderr}\n${result.stdout}`);
  const report = JSON.parse(result.stdout);
  assert.deepEqual(report.report.results.map((item) => [item.requestId, item.status, item.passed]), [['cli-health-request', 200, true]]);
  process.stdout.write('CLI physical-store smoke passed: packaged manifest detection, sibling record assembly, environment hierarchy, scripts, and data-URL execution.\n');
} finally {
  await rm(temporary, { recursive: true, force: true });
}
