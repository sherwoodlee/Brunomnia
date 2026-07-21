import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const platforms = new Set(['linux-x64', 'macos-arm64', 'windows-x64']);
const artifactLayouts = {
  'linux-x64': new Map([['appimage', '.AppImage'], ['deb', '.deb'], ['rpm', '.rpm']]),
  'macos-arm64': new Map([['dmg', '.dmg']]),
  'windows-x64': new Map([['msi', '.msi'], ['nsis', '.exe']]),
};
const scriptPath = fileURLToPath(import.meta.url);
const repositoryRoot = resolve(dirname(scriptPath), '..');

const normalizedRelativePath = (root, path) => relative(root, path).split(sep).join('/');

const artifactFiles = async (root, platform) => {
  const files = [];
  const layout = artifactLayouts[platform];
  const visit = async directory => {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile()) {
        const [bundleDirectory] = normalizedRelativePath(root, path).split('/');
        if (layout.get(bundleDirectory) === extname(entry.name)) files.push(path);
      }
    }
  };
  await visit(root);
  return files;
};

const sha256 = path => new Promise((resolveHash, reject) => {
  const hash = createHash('sha256');
  const stream = createReadStream(path);
  stream.on('data', chunk => hash.update(chunk));
  stream.on('error', reject);
  stream.on('end', () => resolveHash(hash.digest('hex')));
});

export const createDesktopArtifactManifest = async ({ root, platform, revision, appVersion }) => {
  if (!platforms.has(platform)) throw new Error("Unsupported desktop artifact platform '" + platform + "'.");
  if (!/^[0-9a-f]{40}$/.test(revision)) throw new Error('Desktop artifact revision must be a full lowercase Git commit SHA.');
  const absoluteRoot = resolve(root);
  if (!(await stat(absoluteRoot)).isDirectory()) throw new Error('Desktop artifact root must be a directory.');
  const files = await artifactFiles(absoluteRoot, platform);
  if (!files.length) throw new Error('No supported ' + platform + ' desktop installers were produced.');
  const artifacts = [];
  for (const path of files) {
    const name = normalizedRelativePath(absoluteRoot, path);
    if ([...name].some(character => character.charCodeAt(0) === 10 || character.charCodeAt(0) === 13)) throw new Error('Desktop artifact paths cannot contain line breaks.');
    const metadata = await stat(path);
    artifacts.push({ name, sizeBytes: metadata.size, sha256: await sha256(path) });
  }
  return {
    format: 'brunomnia-desktop-artifacts',
    manifestVersion: 1,
    appVersion,
    revision,
    platform,
    artifacts,
  };
};

const argumentValue = (argumentsList, name) => {
  const index = argumentsList.indexOf(name);
  if (index < 0 || !argumentsList[index + 1] || argumentsList[index + 1].startsWith('--')) throw new Error('Missing ' + name + ' value.');
  return argumentsList[index + 1];
};

export const writeDesktopArtifactManifest = async ({ root, platform, revision, appVersion }) => {
  const manifest = await createDesktopArtifactManifest({ root, platform, revision, appVersion });
  const manifestPath = resolve(root, 'brunomnia-desktop-' + platform + '.manifest.json');
  const checksumsPath = resolve(root, 'SHA256SUMS-' + platform + '.txt');
  const releaseNames = manifest.artifacts.map(artifact => basename(artifact.name));
  if (new Set(releaseNames).size !== releaseNames.length) throw new Error('Desktop release artifact names must be unique.');
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  await writeFile(checksumsPath, manifest.artifacts.map((artifact, index) => artifact.sha256 + '  ' + releaseNames[index]).join('\n') + '\n');
  return { manifestPath, checksumsPath, manifest };
};

const main = async () => {
  const root = argumentValue(process.argv.slice(2), '--root');
  const platform = argumentValue(process.argv.slice(2), '--platform');
  const revision = argumentValue(process.argv.slice(2), '--revision');
  const packageJson = JSON.parse(await readFile(resolve(repositoryRoot, 'package.json'), 'utf8'));
  const result = await writeDesktopArtifactManifest({ root, platform, revision, appVersion: packageJson.version });
  process.stdout.write(result.manifest.artifacts.length + ' installers recorded in ' + result.manifestPath + '\n');
};

if (resolve(process.argv[1] ?? '') === scriptPath) main().catch(error => {
  process.stderr.write((error instanceof Error ? error.message : String(error)) + '\n');
  process.exitCode = 1;
});
