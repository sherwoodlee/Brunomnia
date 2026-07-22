import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const repositoryRoot = resolve(dirname(scriptPath), '..');
const releaseVersionPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

export const createTauriReleaseConfig = ({ version, repository = repositoryRoot }) => {
  if (!releaseVersionPattern.test(version)) throw new Error('Release version must be a valid SemVer value without a leading v.');
  return {
    version,
    bundle: {
      createUpdaterArtifacts: true,
      macOS: {
        hardenedRuntime: true,
      },
      windows: {
        signCommand: {
          cmd: 'pwsh',
          args: [
            '-NoProfile',
            '-ExecutionPolicy',
            'Bypass',
            '-File',
            resolve(repository, 'scripts/windows-sign.ps1'),
            '%1',
          ],
        },
      },
    },
  };
};

const argumentValue = (argumentsList, name) => {
  const index = argumentsList.indexOf(name);
  if (index < 0 || !argumentsList[index + 1] || argumentsList[index + 1].startsWith('--')) throw new Error(`Missing ${name} value.`);
  return argumentsList[index + 1];
};

const main = async () => {
  const argumentsList = process.argv.slice(2);
  const version = argumentValue(argumentsList, '--version');
  const output = resolve(argumentValue(argumentsList, '--output'));
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(createTauriReleaseConfig({ version }), null, 2)}\n`);
  process.stdout.write(`${output}\n`);
};

if (resolve(process.argv[1] ?? '') === scriptPath) main().catch(error => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
