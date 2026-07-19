import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const workspacePath = join(tmpdir(), `brunomnia-cli-template-${process.pid}.json`);
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
  await writeFile(workspacePath, JSON.stringify(workspace));
  const baseArgs = ['bin/brunomnia.cjs', 'run', 'test', workspacePath, 'CLI Template Smoke', '--allow-scripts', '--reporter', 'json'];
  const denied = await run(baseArgs);
  assert.equal(denied.code, 1, `File-denial smoke unexpectedly exited ${denied.code}. ${denied.stderr}`);
  const deniedReport = JSON.parse(denied.stdout);
  assert.match(deniedReport.report.results[0]?.error ?? '', /Template file access is disabled/);

  const allowed = await run([...baseArgs, '--allow-template-files']);
  assert.equal(allowed.code, 0, `Granted template smoke exited ${allowed.code}. ${allowed.stderr}\n${allowed.stdout}`);
  const allowedReport = JSON.parse(allowed.stdout);
  assert.equal(allowedReport.report.total, 1);
  assert.equal(allowedReport.report.passed, 1);
  assert.equal(allowedReport.report.failed, 0);
  assert.equal(allowedReport.report.matchedTests, 2);
  process.stdout.write('CLI template smoke passed: denial, file grant, OS/hash/time, response chaining, and cookies.\n');
} finally {
  server.kill('SIGTERM');
  await rm(workspacePath, { force: true });
}
