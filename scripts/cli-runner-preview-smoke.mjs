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
  if (request.url === '/iterations.csv') {
    response.writeHead(200, { 'Content-Type': 'text/csv' });
    response.end('row,region\n1,file\n2,file\n');
    return;
  }
  arrivals.push({ path: request.url, at: performance.now() });
  const status = request.url?.startsWith('/second') ? 500 : 200;
  const finish = () => {
    response.writeHead(status, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ ok: status === 200 }));
  };
  if (request.url?.startsWith('/slow')) setTimeout(finish, 120);
  else finish();
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
    url: `http://127.0.0.1:${address.port}/${path}?row={{ row }}&region={{ region }}&global={{ globalChoice }}&collection={{ collectionChoice }}`,
    preRequestScript: '',
    tests: '',
  });
  const scripted = request('request-third', 'Third', 'third');
  scripted.tests = "await insomnia.test.skip('production only', () => { throw new Error('skipped callback executed'); }); await insomnia.test('status is 200', () => insomnia.expect(insomnia.response.status).to.equal(200));";
  const second = request('request-second', 'Second', 'second');
  const slow = request('request-slow', 'Slow', 'slow');
  second.folderId = 'folder-selected';
  scripted.folderId = 'folder-nested';
  slow.transport = { ...slow.transport, timeoutMode: 'global', timeoutMs: 0 };
  const collection = {
    ...source.collections[0],
    id: 'preview-collection',
    name: 'Preview collection',
    environment: [{ id: 'preview-collection-base-row', name: 'collectionChoice', value: 'base', enabled: true }],
    subEnvironments: [{ id: 'preview-collection-selected', name: 'Selected collection environment', variables: [{ id: 'preview-collection-selected-row', name: 'collectionChoice', value: 'selected', enabled: true }] }],
    activeSubEnvironmentId: 'preview-collection-selected',
    requests: [
      request('request-first', 'First', 'first'),
      second,
      scripted,
      slow,
    ],
    folders: [
      { id: 'folder-selected', name: 'Selected folder', parentId: '', expanded: true, headers: [], environment: [], preRequestScript: '', tests: '', documentation: '' },
      { id: 'folder-nested', name: 'Nested folder', parentId: 'folder-selected', expanded: true, headers: [], environment: [], preRequestScript: '', tests: '', documentation: '' },
      { id: 'folder-empty', name: 'Empty folder', parentId: '', expanded: true, headers: [], environment: [], preRequestScript: '', tests: '', documentation: '' },
    ],
    resourceOrder: ['request-first', 'folder-selected', 'request-second', 'folder-nested', 'request-third', 'request-slow', 'folder-empty'],
  };
  const environment = { id: 'preview-environment', name: 'Preview environment', variables: [{ id: 'preview-global-default-row', name: 'globalChoice', value: 'default', enabled: true }] };
  const selectedGlobals = { id: 'preview-selected-globals', name: 'Selected globals', variables: [{ id: 'preview-global-selected-row', name: 'globalChoice', value: 'selected', enabled: true }] };
  const globalFile = join(temporary, 'global-environment.yaml');
  const brunomniaGlobalFile = join(temporary, 'brunomnia-global-environment.yaml');
  const v5GlobalFile = join(temporary, 'v5-global-environment.yaml');
  await mkdir(join(temporary, '.brunomnia'), { recursive: true });
  await mkdir(join(temporary, 'collections'));
  await mkdir(join(temporary, 'environments'));
  await writeFile(join(temporary, '.brunomnia', 'project.yaml'), stringify({
    format: 'brunomnia', version: 37, name: 'CLI preview project', activeRequestId: 'request-first', activeEnvironmentId: environment.id,
  }));
  await writeFile(join(temporary, 'collections', 'preview.yaml'), stringify(collection));
  await writeFile(join(temporary, 'environments', 'preview.yaml'), stringify(environment));
  await writeFile(join(temporary, 'environments', 'selected.yaml'), stringify(selectedGlobals));
  await writeFile(globalFile, stringify({
    _type: 'export', __export_format: 4,
    resources: [
      { _id: 'wrk_globals', _type: 'workspace', name: 'Standalone globals', scope: 'environment' },
      { _id: 'env_globals', _type: 'environment', parentId: 'wrk_globals', name: 'Base Environment', data: { globalChoice: 'file' } },
    ],
  }));
  await writeFile(brunomniaGlobalFile, stringify({ id: 'file-brunomnia', name: 'Brunomnia globals', variables: [{ id: 'file-brunomnia-row', name: 'globalChoice', value: 'brunomnia', enabled: true }] }));
  await writeFile(v5GlobalFile, stringify({
    type: 'environment.insomnia.rest/5.0', schema_version: '5.1', name: 'V5 globals', meta: { id: 'v5-globals-document' },
    environment: { name: 'Base Environment', meta: { id: 'v5-globals' }, data: { globalChoice: 'v5' }, subEnvironments: [] },
  }));
  await writeFile(join(temporary, '.insorc'), stringify({
    options: { workingDir: temporary, ci: true, verbose: true, printOptions: false },
    scripts: {
      preview: `inso run collection ${collection.id} --item request-first --env-var row=script --env-var region=script --reporter json`,
      invalid: 'echo unsafe',
    },
  }));

  const output = await run([
    'run', 'collection', collection.id, '--config', join(temporary, '.insorc'),
    '--globals', selectedGlobals.name,
    '--env', 'preview-collection-selected',
    '--item', 'folder-selected',
    '--item', 'request-first',
    '--requestNamePattern', '^(Third|First)$',
    '--iteration-count', '2',
    '--delay-request', '35',
    '--iteration-data', `http://127.0.0.1:${address.port}/iterations.csv`,
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
    '/third?row=1&region=override&global=selected&collection=selected', '/first?row=1&region=override&global=selected&collection=selected',
    '/third?row=2&region=override&global=selected&collection=selected', '/first?row=2&region=override&global=selected&collection=selected',
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
  const fileGlobals = JSON.parse(await run([
    'run', 'collection', collection.id, '-w', temporary, '--item', 'request-first',
    '--globals', globalFile, '--env', 'Selected collection environment',
    '--env-var', 'row=file', '--env-var', 'region=file', '--reporter', 'json',
  ]));
  assert.deepEqual(fileGlobals.report.results.map((result) => [result.requestId, result.status]), [['request-first', 200]]);
  assert.equal(arrivals.at(-1).path, '/first?row=file&region=file&global=file&collection=selected');
  for (const [file, label, globalChoice] of [[brunomniaGlobalFile, 'brunomnia', 'brunomnia'], [v5GlobalFile, 'v5', 'v5']]) {
    const fileOutput = JSON.parse(await run([
      'run', 'collection', collection.id, '-w', temporary, '--item', 'request-first',
      '-g', file, '-e', 'Selected collection environment',
      '--env-var', `row=${label}`, '--env-var', `region=${label}`, '--reporter', 'json',
    ]));
    assert.deepEqual(fileOutput.report.results.map((result) => [result.requestId, result.status]), [['request-first', 200]]);
    assert.equal(arrivals.at(-1).path, `/first?row=${label}&region=${label}&global=${globalChoice}&collection=selected`);
  }
  const rejectedGlobals = await runFailure(['run', 'collection', collection.id, '-w', temporary, '--globals', 'missing', '--item', 'request-first']);
  assert.equal(rejectedGlobals.code, 1);
  assert.match(rejectedGlobals.stderr, /No global environment found/);
  const rejectedEnvironment = await runFailure(['run', 'collection', collection.id, '-w', temporary, '--env', 'missing', '--item', 'request-first']);
  assert.equal(rejectedEnvironment.code, 1);
  assert.match(rejectedEnvironment.stderr, /No collection environment found/);
  const rejected = await runFailure(['run', 'test', join(process.cwd(), 'examples', 'cli-workspace.json'), 'CLI Health', '--env-var', 'region=override']);
  assert.equal(rejected.code, 1);
  assert.match(rejected.stderr, /--env-var is only available for run collection/);
  const rejectedPattern = await runFailure(['run', 'test', join(process.cwd(), 'examples', 'cli-workspace.json'), 'CLI Health', '--requestNamePattern', '^First$']);
  assert.equal(rejectedPattern.code, 1);
  assert.match(rejectedPattern.stderr, /--requestNamePattern is only available for run collection/);
  const rejectedEmptyPlan = await runFailure(['run', 'collection', collection.id, '-w', temporary, '--requestNamePattern', '^Missing$']);
  assert.equal(rejectedEmptyPlan.code, 1);
  assert.match(rejectedEmptyPlan.stderr, /No requests identified; nothing to run/);
  const rejectedEmptyFolder = await runFailure(['run', 'collection', collection.id, '-w', temporary, '--item', 'folder-empty']);
  assert.equal(rejectedEmptyFolder.code, 1);
  assert.match(rejectedEmptyFolder.stderr, /No requests identified; nothing to run/);
  const bailed = await runFailure([
    'run', 'collection', collection.id, '-w', temporary,
    '--item', 'request-second', '--item', 'request-first',
    '--env-var', 'row=bail', '--env-var', 'region=bail',
    '-b', '--reporter', 'json',
  ]);
  assert.equal(bailed.code, 1);
  const bailedArtifact = JSON.parse(bailed.stdout);
  assert.equal(bailedArtifact.report.bailed, true);
  assert.deepEqual(bailedArtifact.report.results.map((result) => result.requestId), ['request-second']);
  const timeoutSuccess = JSON.parse(await run([
    'run', 'collection', collection.id, '-w', temporary, '--item', 'request-slow',
    '--env-var', 'row=timeout', '--env-var', 'region=timeout', '--requestTimeout', '500', '--reporter', 'json',
  ]));
  assert.deepEqual(timeoutSuccess.report.results.map((result) => [result.requestId, result.status, result.passed]), [['request-slow', 200, true]]);
  const timeoutFailure = await runFailure([
    'run', 'collection', collection.id, '-w', temporary, '--item', 'request-slow',
    '--env-var', 'row=timeout', '--env-var', 'region=timeout', '--requestTimeout', '20', '--reporter', 'json',
  ]);
  assert.equal(timeoutFailure.code, 1);
  const timeoutArtifact = JSON.parse(timeoutFailure.stdout);
  assert.deepEqual(timeoutArtifact.report.results.map((result) => [result.requestId, result.status, result.passed]), [['request-slow', 0, false]]);
  const ciFallback = JSON.parse(await run([
    'run', 'collection', '--config', join(temporary, '.insorc'), '--item', 'request-first',
    '--env-var', 'row=ci', '--env-var', 'region=ci', '--reporter', 'json',
  ]));
  assert.deepEqual(ciFallback.report.results.map((result) => [result.requestId, result.status]), [['request-first', 200]]);
  const discovered = await runFailure([
    'run', 'collection', collection.id, '-w', temporary, '--item', 'request-first', '--printOptions',
    '--env-var', 'row=discovery', '--env-var', 'region=discovery', '--reporter', 'json',
  ]);
  assert.equal(discovered.code, 0);
  assert.match(discovered.stderr, /Found config file at .*\.insorc/);
  assert.match(discovered.stderr, /Loaded options.*"printOptions":true/);
  assert.deepEqual(JSON.parse(discovered.stdout).report.results.map((result) => result.requestId), ['request-first']);
  const missingConfig = await runFailure(['run', 'collection', collection.id, '--config', join(temporary, 'missing.insorc')]);
  assert.equal(missingConfig.code, 1);
  assert.match(missingConfig.stderr, /Could not find config file/);
  const scriptOutput = JSON.parse(await run(['script', '--config', join(temporary, '.insorc'), 'preview', '--requestTimeout', '500']));
  assert.deepEqual(scriptOutput.report.results.map((result) => [result.requestId, result.status]), [['request-first', 200]]);
  const invalidScript = await runFailure(['script', '--config', join(temporary, '.insorc'), 'invalid']);
  assert.equal(invalidScript.code, 1);
  assert.match(invalidScript.stderr, /start with `inso`/);
  const missingScript = await runFailure(['script', '--config', join(temporary, '.insorc'), 'missing']);
  assert.equal(missingScript.code, 1);
  assert.match(missingScript.stderr, /Available scripts: preview, invalid/);
  console.log('CLI runner preview smoke passed: global and collection environment selection, standalone global files, config scripts, config, CI fallback, working directory, split project, folder items, pinned aliases, request-name filtering, selected order, remote data, environment overrides, delay, timeout, bail, and assertion evidence.');
} finally {
  await close(server).catch(() => undefined);
  await rm(temporary, { recursive: true, force: true });
}
