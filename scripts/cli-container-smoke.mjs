import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const run = (command, argumentsList) => new Promise((resolveRun, rejectRun) => {
  const child = spawn(command, argumentsList, { cwd: process.cwd() });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', chunk => { stdout += chunk; });
  child.stderr.on('data', chunk => { stderr += chunk; });
  child.on('error', rejectRun);
  child.on('close', code => code === 0
    ? resolveRun({ stdout, stderr })
    : rejectRun(new Error(`${command} ${argumentsList.join(' ')} exited ${code}:\n${stderr}${stdout}`)));
});

const packageVersion = JSON.parse(await readFile(resolve('package.json'), 'utf8')).version;
const image = `brunomnia-cli-smoke:${process.pid}`;
const temporary = await mkdtemp(join(process.cwd(), '.brunomnia-cli-container-'));
const workspace = JSON.parse(await readFile(resolve('examples', 'cli-workspace.json'), 'utf8'));
const pluginRequest = structuredClone(workspace.collections[0].requests[0]);
pluginRequest.id = 'container-plugin-request';
pluginRequest.name = 'Container plugin tag';
pluginRequest.url = "data:application/json,%7B%22value%22%3A%22{% cli_value 'fallback' %}%22%7D";
pluginRequest.preRequestScript = '';
pluginRequest.tests = '';
workspace.collections.push({
  ...structuredClone(workspace.collections[0]),
  id: 'container-plugin-collection',
  name: 'Container plugin collection',
  requests: [pluginRequest],
  folders: [],
  resourceOrder: [pluginRequest.id],
});
workspace.plugins = [{
  id: 'container-plugin', name: 'Container plugin', version: '1.0.0', description: '', sourceFormat: 'insomnia-commonjs', enabled: true,
  requestedPermissions: ['template', 'store'], grantedPermissions: ['template', 'store'], installedAt: '2026-07-19T00:00:00.000Z',
  source: "module.exports.templateTags = [{ name: 'cli_value', async run(context, fallback = 'fallback') { return (await context.store.getItem('value')) || fallback; } }];",
}];
workspace.pluginData = { 'container-plugin': { value: 'container' } };
const workspacePath = join(temporary, 'workspace.json');
const configPath = join(temporary, 'inso.config.ts');
const lintDirectory = join(temporary, 'lint');
await mkdir(join(lintDirectory, 'schemas'), { recursive: true });
await writeFile(workspacePath, JSON.stringify(workspace));
await writeFile(configPath, `type InsoConfig = { options: { ci: boolean } }; export default { options: { ci: true } } satisfies InsoConfig;`);
await writeFile(join(lintDirectory, 'openapi.yaml'), `openapi: 3.0.3
info:
  title: Container API
  version: 1.0.0
  description: Container lint fixture
  contact: { name: Brunomnia }
servers: [{ url: https://example.com }]
tags: [{ name: Health }]
paths:
  /health:
    get:
      operationId: getHealth
      description: Read service health
      tags: [Health]
      responses:
        '200':
          description: Healthy
          content:
            application/json:
              schema: { $ref: ./schemas/health.yaml#/Health }
components: { schemas: {} }
`);
await writeFile(join(lintDirectory, 'schemas', 'health.yaml'), 'Health: { type: object, properties: { ok: { type: boolean } } }\n');
await chmod(temporary, 0o755);
await chmod(workspacePath, 0o644);
await chmod(configPath, 0o644);

try {
  await run('docker', [
    'build', '--file', 'Dockerfile.cli', '--tag', image,
    '--build-arg', `VERSION=${packageVersion}`,
    '--build-arg', 'REVISION=local-smoke',
    '.',
  ]);
  const inspected = await run('docker', ['image', 'inspect', image, '--format', '{{.Config.User}}|{{json .Config.Entrypoint}}']);
  assert.equal(inspected.stdout.trim(), 'node|["node","/opt/brunomnia/brunomnia.cjs"]');
  const version = await run('docker', ['run', '--rm', image, '--version']);
  assert.equal(version.stdout.trim(), packageVersion);
  const suite = await run('docker', [
    'run', '--rm', '--network', 'none',
    '--volume', `${resolve('examples')}:/workspace:ro`,
    image, 'run', 'test', 'CLI Health', '--workingDir', '/workspace/cli-workspace.json',
    '--ci', '--allow-scripts', '--reporter', 'json',
  ]);
  const artifact = JSON.parse(suite.stdout);
  assert.equal(artifact.report.failed, 0);
  assert.equal(artifact.report.passed, 1);
  const lint = await run('docker', [
    'run', '--rm', '--network', 'none',
    '--volume', `${temporary}:/workspace:ro`,
    image, 'lint', 'spec', '/workspace/lint/openapi.yaml', '--allow-config-code',
  ]);
  assert.match(lint.stdout, /1 operations · 0 issues/);
  const pluginRun = await run('docker', [
    'run', '--rm', '--network', 'none',
    '--volume', `${temporary}:/workspace:ro`,
    image, 'run', 'collection', 'container-plugin-collection', '--workingDir', '/workspace/workspace.json',
    '--allow-config-code', '--allow-plugins', '--printOptions', '--reporter', 'json',
  ]);
  const pluginArtifact = JSON.parse(pluginRun.stdout);
  assert.deepEqual(pluginArtifact.report.results.map(result => [result.requestId, result.status]), [['container-plugin-request', 200]]);
  assert.match(pluginRun.stderr, /Loaded options.*"ci":true.*"allowConfigCode":true/);
  console.log('CLI container smoke passed: pinned image, non-root runtime, exact version, read-only workspace, no network, self-contained Spectral lint with local references, standalone suite execution, and explicit-grant TypeScript config/plugin tags.');
} finally {
  await run('docker', ['image', 'rm', '--force', image]).catch(() => undefined);
  await rm(temporary, { recursive: true, force: true });
}
