import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
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
await writeFile(join(temporary, 'workspace.json'), JSON.stringify(workspace));

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
  const pluginRun = await run('docker', [
    'run', '--rm', '--network', 'none',
    '--volume', `${temporary}:/workspace:ro`,
    image, 'run', 'collection', 'container-plugin-collection', '--workingDir', '/workspace/workspace.json',
    '--ci', '--allow-plugins', '--reporter', 'json',
  ]);
  const pluginArtifact = JSON.parse(pluginRun.stdout);
  assert.deepEqual(pluginArtifact.report.results.map(result => [result.requestId, result.status]), [['container-plugin-request', 200]]);
  console.log('CLI container smoke passed: pinned image, non-root runtime, exact version, read-only workspace, no network, standalone suite execution, and explicit-grant plugin tags.');
} finally {
  await run('docker', ['image', 'rm', '--force', image]).catch(() => undefined);
  await rm(temporary, { recursive: true, force: true });
}
