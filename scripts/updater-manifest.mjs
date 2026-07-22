import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const semverPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const channels = new Set(['stable', 'beta']);
const normalizedRelativePath = (root, path) => relative(root, path).split(sep).join('/');

const filesUnder = async root => {
  const files = [];
  const visit = async directory => {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile()) files.push(path);
    }
  };
  await visit(root);
  return files;
};

const updaterKind = name => {
  const lower = name.toLowerCase();
  if (lower.endsWith('.app.tar.gz')) return 'macos';
  if (lower.endsWith('.appimage.tar.gz')) return 'linux';
  if (lower.endsWith('.exe.zip')) return 'windows-nsis';
  if (lower.endsWith('.msi.zip')) return 'windows-msi';
  return undefined;
};

const releaseAssetUrl = (repository, rollingTag, name) => `https://github.com/${repository}/releases/download/${rollingTag}/${encodeURIComponent(name)}`;

export const createUpdaterManifest = async ({ root, version, channel, repository, publishedAt, notes = '' }) => {
  if (!semverPattern.test(version)) throw new Error('Updater version must be valid SemVer without a leading v.');
  if (!channels.has(channel)) throw new Error(`Unsupported updater channel '${channel}'.`);
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) throw new Error('Updater repository must use owner/name syntax.');
  const parsedPublishedAt = new Date(publishedAt);
  if (Number.isNaN(parsedPublishedAt.valueOf())) throw new Error('Updater publication date must be valid.');
  const absoluteRoot = resolve(root);
  if (!(await stat(absoluteRoot)).isDirectory()) throw new Error('Updater artifact root must be a directory.');
  const files = await filesUnder(absoluteRoot);
  const archives = files.filter(path => updaterKind(basename(path)));
  const selected = new Map();
  for (const archive of archives) {
    const kind = updaterKind(basename(archive));
    if (kind === 'windows-msi' && selected.has('windows')) continue;
    const target = kind?.startsWith('windows') ? 'windows' : kind;
    const signaturePath = `${archive}.sig`;
    if (!files.includes(signaturePath)) throw new Error(`Missing updater signature for ${normalizedRelativePath(absoluteRoot, archive)}.`);
    const signature = (await readFile(signaturePath, 'utf8')).trim();
    if (!signature) throw new Error(`Updater signature is empty for ${basename(archive)}.`);
    const name = basename(archive);
    const value = { signature, url: releaseAssetUrl(repository, `updater-${channel}`, name) };
    selected.set(target, value);
  }
  for (const required of ['macos', 'windows', 'linux']) {
    if (!selected.has(required)) throw new Error(`Missing signed ${required} updater archive.`);
  }
  const platforms = {
    'darwin-aarch64': selected.get('macos'),
    'darwin-x86_64': selected.get('macos'),
    'windows-x86_64': selected.get('windows'),
    'linux-x86_64': selected.get('linux'),
  };
  return {
    version,
    notes,
    pub_date: parsedPublishedAt.toISOString(),
    platforms,
  };
};

export const writeUpdaterManifest = async options => {
  const output = resolve(options.output);
  const manifest = await createUpdaterManifest(options);
  await writeFile(output, `${JSON.stringify(manifest, null, 2)}\n`);
  return { output, manifest };
};

const argumentValue = (argumentsList, name) => {
  const index = argumentsList.indexOf(name);
  if (index < 0 || !argumentsList[index + 1] || argumentsList[index + 1].startsWith('--')) throw new Error(`Missing ${name} value.`);
  return argumentsList[index + 1];
};

const main = async () => {
  const argumentsList = process.argv.slice(2);
  const result = await writeUpdaterManifest({
    root: argumentValue(argumentsList, '--root'),
    output: argumentValue(argumentsList, '--output'),
    version: argumentValue(argumentsList, '--version'),
    channel: argumentValue(argumentsList, '--channel'),
    repository: argumentValue(argumentsList, '--repository'),
    publishedAt: argumentValue(argumentsList, '--published-at'),
    notes: process.env.BRUNOMNIA_RELEASE_NOTES ?? '',
  });
  process.stdout.write(`${Object.keys(result.manifest.platforms).length} updater targets recorded in ${result.output}\n`);
};

if (resolve(process.argv[1] ?? '') === scriptPath) main().catch(error => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
