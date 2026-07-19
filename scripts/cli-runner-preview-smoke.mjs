import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import http from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { stringify } from 'yaml';

const run = (args) => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [join(process.cwd(), 'bin', 'brunomnia.cjs'), ...args], { cwd: process.cwd() });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => { stdout += chunk; });
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  child.on('error', reject);
  child.on('close', (code) => code === 0 ? resolve(stdout) : reject(new Error(`CLI exited ${code}: ${stderr || stdout}`)));
});

const runFailure = (args) => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [join(process.cwd(), 'bin', 'brunomnia.cjs'), ...args], { cwd: process.cwd() });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => { stdout += chunk; });
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  child.on('error', reject);
  child.on('close', (code) => resolve({ code, stdout, stderr }));
});

const listen = (server) => new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', () => resolve(server.address()));
});

const close = (server) => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
const temporary = await mkdtemp(join(tmpdir(), 'brunomnia-cli-runner-'));
const arrivals = [];
const server = http.createServer((request, response) => {
  arrivals.push({ path: request.url, at: performance.now() });
  const status = request.url?.startsWith('/second') ? 500 : 200;
  response.writeHead(status, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify({ ok: status === 200 }));
});

try {
  const address = await listen(server);
  assert.equal(typeof address, 'object');
  const source = JSON.parse(await readFile(join(process.cwd(), 'examples', 'cli-workspace.json'), 'utf8'));
  const baseRequest = source.collections[0].requests[0];
  const request = (id, name, path) => ({
    ...structuredClone(baseRequest),
    id,
    name,
    url: `http://127.0.0.1:${address.port}/${path}?row={{ row }}&region={{ region }}`,
    preRequestScript: '',
    tests: '',
  });
  const scripted = request('request-third', 'Third', 'third');
  scripted.tests = "await insomnia.test.skip('production only', () => { throw new Error('skipped callback executed'); }); await insomnia.test('status is 200', () => insomnia.expect(insomnia.response.status).to.equal(200));";
  const second = request('request-second', 'Second', 'second');
  second.folderId = 'folder-selected';
  scripted.folderId = 'folder-nested';
  const collection = {
    ...source.collections[0],
    id: 'preview-collection',
    name: 'Preview collection',
    requests: [
      request('request-first', 'First', 'first'),
      second,
      scripted,
    ],
    folders: [
      { id: 'folder-selected', name: 'Selected folder', parentId: '', expanded: true, headers: [], environment: [], preRequestScript: '', tests: '', documentation: '' },
      { id: 'folder-nested', name: 'Nested folder', parentId: 'folder-selected', expanded: true, headers: [], environment: [], preRequestScript: '', tests: '', documentation: '' },
      { id: 'folder-empty', name: 'Empty folder', parentId: '', expanded: true, headers: [], environment: [], preRequestScript: '', tests: '', documentation: '' },
    ],
    resourceOrder: ['request-first', 'folder-selected', 'request-second', 'folder-nested', 'request-third', 'folder-empty'],
  };
  const environment = { id: 'preview-environment', name: 'Preview environment', variables: [] };
  await mkdir(join(temporary, '.brunomnia'), { recursive: true });
  await mkdir(join(temporary, 'collections'));
  await mkdir(join(temporary, 'environments'));
  await writeFile(join(temporary, '.brunomnia', 'project.yaml'), stringify({
    format: 'brunomnia', version: 37, name: 'CLI preview project', activeRequestId: 'request-first', activeEnvironmentId: environment.id,
  }));
  await writeFile(join(temporary, 'collections', 'preview.yaml'), stringify(collection));
  await writeFile(join(temporary, 'environments', 'preview.yaml'), stringify(environment));
  await writeFile(join(temporary, 'iterations.csv'), 'row,region\n1,file\n2,file\n');

  const output = await run([
    'run', 'collection', temporary, collection.id,
    '--env', environment.id,
    '--item', 'folder-selected',
    '--item', 'request-first',
    '--requestNamePattern', '^(Third|First)$',
    '--iteration-count', '2',
    '--delay-request', '35',
    '--iteration-data', join(temporary, 'iterations.csv'),
    '--env-var', 'region=override',
    '--allow-scripts',
    '-b',
    '--reporter', 'json',
  ]);
  const artifact = JSON.parse(output);
  assert.equal(artifact.format, 'brunomnia-run-report');
  assert.equal(artifact.report.iterations, 2);
  assert.deepEqual(artifact.report.results.map((result) => result.requestId), [
    'request-third', 'request-first', 'request-third', 'request-first',
  ]);
  assert.deepEqual(arrivals.map((arrival) => arrival.path), [
    '/third?row=1&region=override', '/first?row=1&region=override',
    '/third?row=2&region=override', '/first?row=2&region=override',
  ]);
  const scriptedResults = artifact.report.results.filter((result) => result.requestId === 'request-third');
  assert.equal(scriptedResults.length, 2);
  scriptedResults.forEach((result) => {
    assert.equal(result.passed, true);
    assert.deepEqual(result.tests.map((test) => test.status), ['skipped', 'passed']);
    assert.deepEqual(result.tests.map((test) => test.category), ['after-response', 'after-response']);
    assert.equal(result.tests[0].durationMs, 0);
    assert.equal(typeof result.tests[1].durationMs, 'number');
  });
  for (let index = 1; index < arrivals.length; index += 1) assert.ok(arrivals[index].at - arrivals[index - 1].at >= 20, 'request delay was not applied');
  const rejected = await runFailure(['run', 'test', join(process.cwd(), 'examples', 'cli-workspace.json'), 'CLI Health', '--env-var', 'region=override']);
  assert.equal(rejected.code, 1);
  assert.match(rejected.stderr, /--env-var is only available for run collection/);
  const rejectedPattern = await runFailure(['run', 'test', join(process.cwd(), 'examples', 'cli-workspace.json'), 'CLI Health', '--requestNamePattern', '^First$']);
  assert.equal(rejectedPattern.code, 1);
  assert.match(rejectedPattern.stderr, /--requestNamePattern is only available for run collection/);
  const rejectedEmptyPlan = await runFailure(['run', 'collection', temporary, collection.id, '--requestNamePattern', '^Missing$']);
  assert.equal(rejectedEmptyPlan.code, 1);
  assert.match(rejectedEmptyPlan.stderr, /No requests identified; nothing to run/);
  const rejectedEmptyFolder = await runFailure(['run', 'collection', temporary, collection.id, '--item', 'folder-empty']);
  assert.equal(rejectedEmptyFolder.code, 1);
  assert.match(rejectedEmptyFolder.stderr, /No requests identified; nothing to run/);
  const bailed = await runFailure([
    'run', 'collection', temporary, collection.id,
    '--item', 'request-second', '--item', 'request-first',
    '--env-var', 'row=bail', '--env-var', 'region=bail',
    '-b', '--reporter', 'json',
  ]);
  assert.equal(bailed.code, 1);
  const bailedArtifact = JSON.parse(bailed.stdout);
  assert.equal(bailedArtifact.report.bailed, true);
  assert.deepEqual(bailedArtifact.report.results.map((result) => result.requestId), ['request-second']);
  console.log('CLI runner preview smoke passed: split project, folder items, pinned aliases, request-name filtering, selected order, data, environment overrides, delay, bail, and assertion evidence.');
} finally {
  await close(server).catch(() => undefined);
  await rm(temporary, { recursive: true, force: true });
}
