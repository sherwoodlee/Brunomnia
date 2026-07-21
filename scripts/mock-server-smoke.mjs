import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline';

const binary = resolve(process.argv[2] || 'mock-server/target/debug/brunomnia-mock-server');
const binaryArguments = process.argv.slice(3);
const fixture = resolve('examples/mock-deployment.json');
const directory = join(tmpdir(), `brunomnia-mock-smoke-${process.pid}-${Date.now()}`);
const configPath = join(directory, 'mock.json');

const reservePort = () => new Promise((resolvePort, reject) => {
  const server = createServer();
  server.once('error', reject);
  server.listen(0, '127.0.0.1', () => {
    const address = server.address();
    server.close((error) => error ? reject(error) : resolvePort(address.port));
  });
});

const waitFor = async (callback, timeoutMs = 10_000) => {
  const started = Date.now();
  let lastError;
  while (Date.now() - started < timeoutMs) {
    try {
      return await callback();
    } catch (error) {
      lastError = error;
      await new Promise((resolveWait) => setTimeout(resolveWait, 100));
    }
  }
  throw lastError ?? new Error('Timed out waiting for mock deployment.');
};

await mkdir(directory, { recursive: true });
let child;
let lines;
try {
  const deployment = JSON.parse(await readFile(fixture, 'utf8'));
  deployment.server.host = '127.0.0.1';
  deployment.server.port = await reservePort();
  await writeFile(configPath, `${JSON.stringify(deployment, null, 2)}\n`);

  child = spawn(binary, [...binaryArguments, configPath], { stdio: ['ignore', 'pipe', 'pipe'] });
  let stderr = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  lines = createInterface({ input: child.stdout });
  const readiness = await Promise.race([
    new Promise((resolveLine, reject) => {
      lines.once('line', (line) => {
        try { resolveLine(JSON.parse(line)); } catch (error) { reject(error); }
      });
      child.once('exit', (code) => reject(new Error(`Mock runtime exited ${code}: ${stderr}`)));
    }),
    new Promise((_, reject) => setTimeout(() => reject(new Error(`Mock runtime did not become ready: ${stderr}`)), 10_000)),
  ]);
  assert.equal(readiness.status, 'ready');
  assert.equal(readiness.routeCount, 1);

  const endpoint = `http://127.0.0.1:${deployment.server.port}/orders/42?role=admin`;
  const initial = await waitFor(async () => {
    const response = await fetch(endpoint);
    assert.equal(response.status, 200);
    return response.json();
  });
  assert.deepEqual(initial, { id: '42', role: 'admin' });

  await writeFile(configPath, '{"format":');
  await new Promise((resolveWait) => setTimeout(resolveWait, 750));
  const preserved = await fetch(endpoint);
  assert.equal(preserved.status, 200);
  assert.deepEqual(await preserved.json(), initial);

  deployment.server.routes[0].body = '{"updated":true,"id":"{{ request.path.id }}"}';
  await writeFile(configPath, `${JSON.stringify(deployment, null, 2)}\n`);
  const updated = await waitFor(async () => {
    const response = await fetch(endpoint);
    const body = await response.json();
    assert.deepEqual(body, { updated: true, id: '42' });
    return body;
  });
  assert.equal(updated.updated, true);
  child.kill('SIGTERM');
  const exitCode = await Promise.race([
    new Promise((resolveExit) => child.once('exit', resolveExit)),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Mock runtime did not stop after SIGTERM.')), 10_000)),
  ]);
  assert.equal(exitCode, 0, stderr);
  console.log('Mock server smoke passed: bounded deployment loading, readiness, dynamic request rendering, invalid-file preservation, live file reload, and SIGTERM shutdown.');
} finally {
  lines?.close();
  if (child && child.exitCode === null && child.signalCode === null) {
    const exited = new Promise((resolveExit) => child.once('exit', resolveExit));
    child.kill('SIGTERM');
    const stopped = await Promise.race([
      exited.then(() => true),
      new Promise((resolveStopped) => setTimeout(() => resolveStopped(false), 2_000)),
    ]);
    if (!stopped) {
      child.kill('SIGKILL');
      await exited;
    }
  }
  await rm(directory, { recursive: true, force: true });
}
