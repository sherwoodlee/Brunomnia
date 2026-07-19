import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
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
  child.on('close', (code) => code === 0 ? resolve(stdout) : reject(new Error(`CLI exited ${code}: ${stderr}${stdout}`)));
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
const secureArrivals = [];
const mutualArrivals = [];
const proxyArrivals = [];
const proxyConnects = [];
const tlsKey = await readFile(join(process.cwd(), 'src-tauri', 'tests', 'fixtures', 'tls', 'server.key.pem'));
const tlsCertificate = await readFile(join(process.cwd(), 'src-tauri', 'tests', 'fixtures', 'tls', 'server.cert.pem'));
const tlsCa = await readFile(join(process.cwd(), 'src-tauri', 'tests', 'fixtures', 'tls', 'ca.cert.pem'), 'utf8');
const clientCertificate = await readFile(join(process.cwd(), 'src-tauri', 'tests', 'fixtures', 'tls', 'client.cert.pem'), 'utf8');
const clientKey = await readFile(join(process.cwd(), 'src-tauri', 'tests', 'fixtures', 'tls', 'client.key.pem'), 'utf8');
const clientPfxBase64 = (await readFile(join(process.cwd(), 'src-tauri', 'tests', 'fixtures', 'tls', 'client.openssl-modern.p12.b64'), 'utf8')).trim();
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
const secureServer = https.createServer({ key: tlsKey, cert: tlsCertificate }, (request, response) => {
  secureArrivals.push(request.url);
  response.writeHead(200, { 'Content-Type': 'application/json' });
  response.end('{"secure":true}');
});
const mutualServer = https.createServer({ key: tlsKey, cert: tlsCertificate, ca: tlsCa, requestCert: true, rejectUnauthorized: true }, (request, response) => {
  mutualArrivals.push({ path: request.url, authorized: request.socket.authorized });
  response.writeHead(200, { 'Content-Type': 'application/json' });
  response.end('{"mutual":true}');
});
const proxyServer = http.createServer((request, response) => {
  proxyArrivals.push(request.url);
  response.writeHead(200, { 'Content-Type': 'application/json' });
  response.end('{"proxy":true}');
});
proxyServer.on('connect', (request, clientSocket, head) => {
  proxyConnects.push(request.url);
  const [host, rawPort] = String(request.url).split(':');
  const upstream = net.connect(Number(rawPort) || 443, host, () => {
    clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
    if (head.length) upstream.write(head);
    upstream.pipe(clientSocket);
    clientSocket.pipe(upstream);
  });
  upstream.on('error', () => clientSocket.destroy());
});

try {
  const address = await listen(server);
  const secureAddress = await listen(secureServer);
  const mutualAddress = await listen(mutualServer);
  const proxyAddress = await listen(proxyServer);
  assert.equal(typeof address, 'object');
  assert.equal(typeof secureAddress, 'object');
  assert.equal(typeof mutualAddress, 'object');
  assert.equal(typeof proxyAddress, 'object');
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
  const secure = request('request-secure', 'Secure', 'secure');
  secure.url = `https://127.0.0.1:${secureAddress.port}/secure?row={{ row }}&region={{ region }}`;
  const mutual = request('request-mutual', 'Mutual TLS', 'mutual');
  mutual.url = `https://127.0.0.1:${mutualAddress.port}/mutual?row={{ row }}&region={{ region }}`;
  mutual.auth = { ...mutual.auth, type: 'basic', username: 'full-report-user', password: 'full-report-password' };
  mutual.headers = [
    ...mutual.headers,
    { id: 'full-report-sensitive-header', name: 'X-API-Key', value: 'full-report-header-secret', enabled: true },
    { id: 'full-report-visible-header', name: 'X-Report-Label', value: 'full-report-visible', enabled: true },
  ];
  const customProxy = request('request-custom-proxy', 'Custom proxy', 'custom-proxy');
  customProxy.transport = { ...customProxy.transport, proxyMode: 'custom', proxyUrl: `http://127.0.0.1:${proxyAddress.port}`, proxyExclusions: '' };
  const direct = request('request-direct', 'Direct', 'direct');
  direct.transport = { ...direct.transport, proxyMode: 'disabled' };
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
      secure,
      mutual,
      customProxy,
      direct,
    ],
    folders: [
      { id: 'folder-selected', name: 'Selected folder', parentId: '', expanded: true, headers: [], environment: [], preRequestScript: '', tests: '', documentation: '' },
      { id: 'folder-nested', name: 'Nested folder', parentId: 'folder-selected', expanded: true, headers: [], environment: [], preRequestScript: '', tests: '', documentation: '' },
      { id: 'folder-empty', name: 'Empty folder', parentId: '', expanded: true, headers: [], environment: [], preRequestScript: '', tests: '', documentation: '' },
    ],
    resourceOrder: ['request-first', 'folder-selected', 'request-second', 'folder-nested', 'request-third', 'request-slow', 'request-secure', 'request-mutual', 'request-custom-proxy', 'request-direct', 'folder-empty'],
  };
  const environment = {
    id: 'preview-environment',
    name: 'Preview environment',
    variables: [
      { id: 'preview-global-default-row', name: 'globalChoice', value: 'default', enabled: true },
      { id: 'preview-full-report-secret', name: 'fullReportSecret', value: 'full-report-environment-secret', enabled: true },
    ],
  };
  const selectedGlobals = { id: 'preview-selected-globals', name: 'Selected globals', variables: [{ id: 'preview-global-selected-row', name: 'globalChoice', value: 'selected', enabled: true }] };
  const globalFile = join(temporary, 'global-environment.yaml');
  const brunomniaGlobalFile = join(temporary, 'brunomnia-global-environment.yaml');
  const v5GlobalFile = join(temporary, 'v5-global-environment.yaml');
  await mkdir(join(temporary, '.brunomnia'), { recursive: true });
  await mkdir(join(temporary, 'collections'));
  await mkdir(join(temporary, 'environments'));
  const metadataPath = join(temporary, '.brunomnia', 'project.yaml');
  const metadata = {
    format: 'brunomnia', version: 37, name: 'CLI preview project', activeRequestId: 'request-first', activeEnvironmentId: environment.id,
  };
  await writeFile(metadataPath, stringify(metadata));
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
  const proxyOutput = JSON.parse(await run([
    'run', 'collection', collection.id, '-w', temporary, '--item', 'request-first',
    '--httpProxy', `http://127.0.0.1:${proxyAddress.port}`, '--env-var', 'row=proxy', '--env-var', 'region=proxy', '--reporter', 'json',
  ]));
  assert.deepEqual(proxyOutput.report.results.map((result) => [result.requestId, result.status]), [['request-first', 200]]);
  assert.equal(proxyArrivals.length, 1);
  assert.match(proxyArrivals[0], new RegExp(`^http://127\\.0\\.0\\.1:${address.port}/first`));
  const bypassOutput = JSON.parse(await run([
    'run', 'collection', collection.id, '-w', temporary, '--item', 'request-first',
    '--httpProxy', `http://127.0.0.1:${proxyAddress.port}`, '--noProxy', '127.0.0.1', '--env-var', 'row=bypass', '--env-var', 'region=bypass', '--reporter', 'json',
  ]));
  assert.deepEqual(bypassOutput.report.results.map((result) => [result.requestId, result.status]), [['request-first', 200]]);
  assert.equal(proxyArrivals.length, 1);
  assert.equal(arrivals.at(-1).path, '/first?row=bypass&region=bypass&global=default&collection=selected');
  const customProxyOutput = JSON.parse(await run([
    'run', 'collection', collection.id, '-w', temporary, '--item', 'request-custom-proxy',
    '--env-var', 'row=custom', '--env-var', 'region=custom', '--reporter', 'json',
  ]));
  assert.deepEqual(customProxyOutput.report.results.map((result) => [result.requestId, result.status]), [['request-custom-proxy', 200]]);
  assert.equal(proxyArrivals.length, 2);
  const directOutput = JSON.parse(await run([
    'run', 'collection', collection.id, '-w', temporary, '--item', 'request-direct',
    '--httpProxy', `http://127.0.0.1:${proxyAddress.port}`, '--env-var', 'row=direct', '--env-var', 'region=direct', '--reporter', 'json',
  ]));
  assert.deepEqual(directOutput.report.results.map((result) => [result.requestId, result.status]), [['request-direct', 200]]);
  assert.equal(proxyArrivals.length, 2);
  assert.equal(arrivals.at(-1).path, '/direct?row=direct&region=direct&global=default&collection=selected');
  const rejectedTls = await runFailure([
    'run', 'collection', collection.id, '-w', temporary, '--item', 'request-secure',
    '--env-var', 'row=tls', '--env-var', 'region=tls', '--reporter', 'json',
  ]);
  assert.equal(rejectedTls.code, 1);
  assert.deepEqual(JSON.parse(rejectedTls.stdout).report.results.map((result) => [result.requestId, result.status, result.passed]), [['request-secure', 0, false]]);
  const insecureTls = JSON.parse(await run([
    'run', 'collection', collection.id, '-w', temporary, '--item', 'request-secure', '--disableCertValidation',
    '--env-var', 'row=tls', '--env-var', 'region=tls', '--reporter', 'json',
  ]));
  assert.deepEqual(insecureTls.report.results.map((result) => [result.requestId, result.status]), [['request-secure', 200]]);
  assert.deepEqual(secureArrivals, ['/secure?row=tls&region=tls']);
  const proxiedTls = JSON.parse(await run([
    'run', 'collection', collection.id, '-w', temporary, '--item', 'request-secure', '-k',
    '--httpsProxy', `http://127.0.0.1:${proxyAddress.port}`, '--env-var', 'row=tls-proxy', '--env-var', 'region=tls-proxy', '--reporter', 'json',
  ]));
  assert.deepEqual(proxiedTls.report.results.map((result) => [result.requestId, result.status]), [['request-secure', 200]]);
  assert.equal(proxyConnects.length, 1);
  assert.equal(proxyConnects[0], `127.0.0.1:${secureAddress.port}`);
  assert.deepEqual(secureArrivals.at(-1), '/secure?row=tls-proxy&region=tls-proxy');
  metadata.certificates = {
    ca: { enabled: true, pem: tlsCa },
    clients: [{ id: 'cli-client', host: '127.0.0.1', enabled: true, certificatePem: clientCertificate, keyPem: clientKey, pfxBase64: '', passphrase: '' }],
  };
  await writeFile(metadataPath, stringify(metadata));
  const mutualTls = JSON.parse(await run([
    'run', 'collection', collection.id, '-w', temporary, '--item', 'request-mutual',
    '--env-var', 'row=mutual', '--env-var', 'region=mutual', '--reporter', 'json',
  ]));
  assert.deepEqual(mutualTls.report.results.map((result) => [result.requestId, result.status]), [['request-mutual', 200]]);
  assert.deepEqual(mutualArrivals, [{ path: '/mutual?row=mutual&region=mutual', authorized: true }]);
  metadata.certificates.clients = [{ id: 'cli-client-pfx', host: '127.0.0.1', enabled: true, certificatePem: '', keyPem: '', pfxBase64: clientPfxBase64, passphrase: 'openssl-secret' }];
  await writeFile(metadataPath, stringify(metadata));
  const mutualPfx = JSON.parse(await run([
    'run', 'collection', collection.id, '-w', temporary, '--item', 'request-mutual',
    '--env-var', 'row=pfx', '--env-var', 'region=pfx', '--reporter', 'json',
  ]));
  assert.deepEqual(mutualPfx.report.results.map((result) => [result.requestId, result.status]), [['request-mutual', 200]]);
  assert.deepEqual(mutualArrivals.at(-1), { path: '/mutual?row=pfx&region=pfx', authorized: true });
  const fullReportProxy = `http://proxy-user:proxy-password@127.0.0.1:${proxyAddress.port}`;
  const rejectedOutputDirectory = join(temporary, 'reports', 'existing-directory');
  await mkdir(rejectedOutputDirectory, { recursive: true });
  const arrivalsBeforeRejectedOutput = mutualArrivals.length;
  const rejectedOutput = await runFailure([
    'run', 'collection', collection.id, '-w', temporary, '--item', 'request-mutual',
    '--env-var', 'row=output', '--env-var', 'region=output', '--output', 'reports/existing-directory',
  ]);
  assert.equal(rejectedOutput.code, 1);
  assert.match(rejectedOutput.stderr, /Output path .* is not a file/);
  assert.equal(mutualArrivals.length, arrivalsBeforeRejectedOutput, 'output validation happened after transport');
  const safeReporterOutput = await run([
    'run', 'collection', collection.id, '-w', temporary, '--item', 'request-mutual', '--reporter', 'junit',
    '--env-var', 'row=safe', '--env-var', 'region=safe', '--httpsProxy', fullReportProxy, '--noProxy', '127.0.0.1',
    '--output', 'reports/nested/safe.json',
  ]);
  assert.match(safeReporterOutput, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  const safeReportText = await readFile(join(temporary, 'reports', 'nested', 'safe.json'), 'utf8');
  const safeReport = JSON.parse(safeReportText);
  assert.equal(safeReport.format, 'brunomnia-inso-safe-report');
  assert.equal(safeReport.version, 1);
  assert.equal(safeReport.mode, 'safe');
  assert.deepEqual(Object.keys(safeReport.environment).sort(), ['color', 'id', 'name', 'private']);
  assert.equal('variables' in safeReport.environment, false);
  assert.equal(safeReport.executions.length, 1);
  assert.deepEqual(Object.keys(safeReport.executions[0].request).sort(), ['documentation', 'id', 'name']);
  assert.deepEqual(Object.keys(safeReport.executions[0].response).sort(), ['durationMs', 'status', 'statusText']);
  assert.equal(safeReport.executions[0].iteration, 1);
  assert.equal(safeReport.executions[0].attempt, 1);
  assert.deepEqual(safeReport.stats.requests, { total: 1, failed: 0 });
  for (const secret of ['full-report-environment-secret', 'full-report-user', 'full-report-password', 'full-report-header-secret', 'proxy-user', 'proxy-password', clientPfxBase64, 'openssl-secret', tlsCa]) {
    assert.equal(safeReportText.includes(secret), false, `safe report leaked ${secret.slice(0, 40)}`);
  }
  const arrivalsBeforeRejectedReport = mutualArrivals.length;
  const rejectedFullReport = await runFailure([
    'run', 'collection', collection.id, '-w', temporary, '--item', 'request-mutual',
    '--env-var', 'row=report', '--env-var', 'region=report', '--includeFullData=redact', '--output', 'reports/rejected.json',
  ]);
  assert.equal(rejectedFullReport.code, 1);
  assert.match(rejectedFullReport.stderr, /Full-data reports may contain secrets.*--acceptRisk/);
  assert.equal(mutualArrivals.length, arrivalsBeforeRejectedReport, 'risk rejection happened after transport');
  const redactedReporterOutput = await run([
    'run', 'collection', collection.id, '-w', temporary, '--item', 'request-mutual',
    '--env-var', 'row=redacted', '--env-var', 'region=redacted', '--httpsProxy', fullReportProxy, '--noProxy', '127.0.0.1',
    '--includeFullData', 'redact', '--acceptRisk', '--output', 'reports/nested/redacted.json',
  ]);
  assert.match(redactedReporterOutput, /^Preview collection\n  ✓ Mutual TLS \(iteration 1, attempt 1\)/);
  const redactedReportText = await readFile(join(temporary, 'reports', 'nested', 'redacted.json'), 'utf8');
  const redactedReport = JSON.parse(redactedReportText);
  assert.equal(redactedReport.format, 'brunomnia-inso-full-report');
  assert.equal(redactedReport.version, 1);
  assert.equal(redactedReport.mode, 'redact');
  assert.equal(redactedReport.executions.length, 1);
  assert.equal(redactedReport.executions[0].iteration, 1);
  assert.equal(redactedReport.executions[0].attempt, 1);
  assert.equal(redactedReport.executions[0].environment.fullReportSecret, '<Redacted by Insomnia>');
  assert.equal(redactedReport.environment.variables.find((variable) => variable.name === 'fullReportSecret').value, '<Redacted by Insomnia>');
  assert.equal(redactedReport.executions[0].request.auth.type, 'basic');
  assert.equal(redactedReport.executions[0].request.auth.disabled, false);
  assert.equal(redactedReport.executions[0].request.auth.username, '<Redacted by Insomnia>');
  assert.equal(redactedReport.executions[0].request.auth.password, '<Redacted by Insomnia>');
  assert.equal(redactedReport.executions[0].request.headers.find((header) => header.name === 'X-API-Key').value, '<Redacted by Insomnia>');
  assert.equal(redactedReport.executions[0].request.headers.find((header) => header.name === 'X-Report-Label').value, 'full-report-visible');
  assert.equal(redactedReport.executions[0].request.transport.clientCertificatePfxBase64, '<Redacted by Insomnia>');
  assert.equal(redactedReport.executions[0].request.transport.clientCertificatePassphrase, '<Redacted by Insomnia>');
  assert.equal(redactedReport.executions[0].request.transport.caCertificatePem, '<Redacted by Insomnia>');
  for (const secret of ['full-report-environment-secret', 'full-report-user', 'full-report-password', 'full-report-header-secret', 'proxy-user', 'proxy-password', clientPfxBase64, 'openssl-secret']) {
    assert.equal(redactedReportText.includes(secret), false, `redacted report leaked ${secret.slice(0, 40)}`);
  }
  await run([
    'run', 'collection', collection.id, '--workingDir', temporary, '--item', 'request-mutual',
    '--env-var', 'row=plaintext', '--env-var', 'region=plaintext', '--httpsProxy', fullReportProxy, '--noProxy', '127.0.0.1',
    '--includeFullData=plaintext', '--acceptRisk', '--output', 'reports/plaintext.json',
  ]);
  const plaintextReport = JSON.parse(await readFile(join(temporary, 'reports', 'plaintext.json'), 'utf8'));
  assert.equal(plaintextReport.mode, 'plaintext');
  assert.equal(plaintextReport.executions[0].environment.fullReportSecret, 'full-report-environment-secret');
  assert.equal(plaintextReport.environment.variables.find((variable) => variable.name === 'fullReportSecret').value, 'full-report-environment-secret');
  assert.equal(plaintextReport.executions[0].request.auth.username, 'full-report-user');
  assert.equal(plaintextReport.executions[0].request.auth.password, 'full-report-password');
  assert.equal(plaintextReport.executions[0].request.headers.find((header) => header.name === 'X-API-Key').value, 'full-report-header-secret');
  assert.equal(plaintextReport.executions[0].request.transport.clientCertificatePfxBase64, clientPfxBase64);
  assert.equal(plaintextReport.executions[0].request.transport.clientCertificatePassphrase, 'openssl-secret');
  assert.equal(plaintextReport.executions[0].request.transport.caCertificatePem, tlsCa);
  assert.equal(plaintextReport.proxy.httpsProxy, fullReportProxy);
  assert.deepEqual(plaintextReport.stats.requests, { total: 1, failed: 0 });
  assert.equal(typeof plaintextReport.timing.responseAverage, 'number');
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
  console.log('CLI runner preview smoke passed: pinned default spec reporting, metadata-safe default reports, pre-transport output validation, explicit-risk redacted/plaintext full reports, working-directory report output, HTTP/HTTPS proxy and no-proxy routing, TLS validation override, workspace CA and client identity, global and collection environment selection, standalone global files, config scripts, config, CI fallback, split project, folder items, pinned aliases, request-name filtering, selected order, remote data, environment overrides, delay, timeout, bail, and assertion evidence.');
} finally {
  await close(server).catch(() => undefined);
  await close(secureServer).catch(() => undefined);
  await close(mutualServer).catch(() => undefined);
  await close(proxyServer).catch(() => undefined);
  await rm(temporary, { recursive: true, force: true });
}
