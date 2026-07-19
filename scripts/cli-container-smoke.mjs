import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

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
  console.log('CLI container smoke passed: pinned image, non-root runtime, exact version, read-only workspace, no network, and standalone suite execution.');
} finally {
  await run('docker', ['image', 'rm', '--force', image]).catch(() => undefined);
}
