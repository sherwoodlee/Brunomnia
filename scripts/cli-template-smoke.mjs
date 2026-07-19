import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const temporary = await mkdtemp(join(tmpdir(), 'brunomnia-cli-template-'));
const workspacePath = join(temporary, 'workspace.json');
const run = (args) => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => { stdout += chunk; });
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  child.once('error', reject);
  child.once('close', (code, signal) => resolve({ code, signal, stdout, stderr }));
});

const server = spawn(process.execPath, ['examples/cli-template-smoke-server.cjs'], {
  cwd: root,
  env: { ...process.env, BRUNOMNIA_CLI_SMOKE_PORT: '0' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverError = '';
server.stderr.on('data', (chunk) => { serverError += chunk; });

const ready = new Promise((resolve, reject) => {
  let output = '';
  const timeout = setTimeout(() => reject(new Error(`CLI template smoke server did not start. ${serverError}`)), 5_000);
  server.stdout.on('data', (chunk) => {
    output += chunk;
    const match = output.match(/READY (http:\/\/[^\s]+)/);
    if (match) { clearTimeout(timeout); resolve(match[1]); }
  });
  server.once('error', (error) => { clearTimeout(timeout); reject(error); });
  server.once('exit', (code) => {
    if (!output.includes('READY ')) { clearTimeout(timeout); reject(new Error(`CLI template smoke server exited ${code}. ${serverError}`)); }
  });
});

try {
  const serverUrl = await ready;
  const workspace = JSON.parse(await readFile(new URL('../examples/cli-template-workspace.json', import.meta.url), 'utf8'));
  const baseUrl = workspace.environments[0]?.variables.find((variable) => variable.name === 'baseUrl');
  assert.ok(baseUrl, 'CLI template smoke workspace has no baseUrl variable.');
  baseUrl.value = serverUrl;
  const fileRequest = workspace.collections.flatMap((collection) => collection.requests).find((request) => request.body?.includes("{% file 'examples/cli-template-file.json' %}"));
  assert.ok(fileRequest, 'CLI template smoke workspace has no File-tag request.');
  const originalBody = fileRequest.body;
  await writeFile(workspacePath, JSON.stringify(workspace));
  const baseArgs = ['bin/brunomnia.cjs', 'run', 'test', workspacePath, 'CLI Template Smoke', '--allow-scripts', '--reporter', 'json'];
  const denied = await run(baseArgs);
  assert.equal(denied.code, 1, `File-denial smoke unexpectedly exited ${denied.code}. ${denied.stderr}`);
  const deniedReport = JSON.parse(denied.stdout);
  assert.match(deniedReport.report.results[0]?.tests[0]?.error ?? deniedReport.report.results[0]?.error ?? '', /Template file access is disabled/);

  const rootless = await run([...baseArgs, '--allow-template-files']);
  assert.equal(rootless.code, 1, `Rootless file grant unexpectedly exited ${rootless.code}. ${rootless.stderr}`);
  const rootlessReport = JSON.parse(rootless.stdout);
  assert.match(rootlessReport.report.results[0]?.tests[0]?.error ?? rootlessReport.report.results[0]?.error ?? '', /requires at least one -f\/--dataFolders root/);

  const outside = await run([...baseArgs, '--allow-template-files', '--dataFolders', join(root, 'src')]);
  assert.equal(outside.code, 1, `Outside-root file grant unexpectedly exited ${outside.code}. ${outside.stderr}`);
  const outsideReport = JSON.parse(outside.stdout);
  assert.match(outsideReport.report.results[0]?.tests[0]?.error ?? outsideReport.report.results[0]?.error ?? '', /outside the allowed --dataFolders roots/);

  const escapePath = join(temporary, 'escape.json');
  await symlink(join(root, 'examples', 'cli-template-file.json'), escapePath);
  fileRequest.body = originalBody.replace('examples/cli-template-file.json', escapePath);
  await writeFile(workspacePath, JSON.stringify(workspace));
  const escaped = await run([...baseArgs, '--allow-template-files', '-f', temporary]);
  assert.equal(escaped.code, 1, `Symlink-escape file grant unexpectedly exited ${escaped.code}. ${escaped.stderr}`);
  const escapedReport = JSON.parse(escaped.stdout);
  assert.match(escapedReport.report.results[0]?.tests[0]?.error ?? escapedReport.report.results[0]?.error ?? '', /outside the allowed --dataFolders roots/);

  fileRequest.body = originalBody;
  await writeFile(workspacePath, JSON.stringify(workspace));
  const allowed = await run([...baseArgs, '--allow-template-files', '-f', join(root, 'examples')]);
  assert.equal(allowed.code, 0, `Granted template smoke exited ${allowed.code}. ${allowed.stderr}\n${allowed.stdout}`);
  const allowedReport = JSON.parse(allowed.stdout);
  assert.equal(allowedReport.report.total, 1);
  assert.equal(allowedReport.report.passed, 1);
  assert.equal(allowedReport.report.failed, 0);
  assert.equal(allowedReport.report.matchedTests, 1);
  const scriptFile = await run([
    'bin/brunomnia.cjs', 'run', 'collection', join(root, 'examples', 'cli-workspace.json'), 'CLI Health',
    '--item', 'cli-health-request', '--allow-scripts', '--allow-script-files', '-f', join(root, 'examples'), '--reporter', 'json',
  ]);
  assert.equal(scriptFile.code, 0, `Granted script-file smoke exited ${scriptFile.code}. ${scriptFile.stderr}\n${scriptFile.stdout}`);
  const scriptFileReport = JSON.parse(scriptFile.stdout);
  assert.deepEqual(scriptFileReport.report.results.map((result) => [result.requestId, result.status, result.passed]), [['cli-health-request', 200, true]]);
  process.stdout.write('CLI template smoke passed: default denial, required roots, outside-root and symlink rejection, valid template/script file grants, OS/hash/time, response chaining, and cookies.\n');
} finally {
  server.kill('SIGTERM');
  await rm(temporary, { recursive: true, force: true });
}
