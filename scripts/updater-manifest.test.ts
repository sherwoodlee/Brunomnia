import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createUpdaterManifest } from './updater-manifest.mjs';

const temporaryDirectories: string[] = [];
const fixture = async () => {
  const root = await mkdtemp(join(tmpdir(), 'brunomnia-updater-'));
  temporaryDirectories.push(root);
  for (const directory of ['macos', 'windows', 'linux']) await mkdir(join(root, directory));
  const archives = [
    ['macos/Brunomnia.app.tar.gz', 'mac-signature'],
    ['windows/Brunomnia_1.2.3_x64-setup.exe.zip', 'windows-signature'],
    ['linux/Brunomnia_1.2.3_amd64.AppImage.tar.gz', 'linux-signature'],
  ];
  for (const [name, signature] of archives) {
    await writeFile(join(root, name), name);
    await writeFile(join(root, `${name}.sig`), signature);
  }
  return root;
};

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(path => rm(path, { force: true, recursive: true })));
});

describe('Tauri updater manifest', () => {
  it('maps one universal macOS archive and signed platform archives to both channels', async () => {
    const root = await fixture();
    const manifest = await createUpdaterManifest({ root, version: '1.2.3', channel: 'stable', repository: 'owner/repo', publishedAt: '2026-07-21T12:00:00Z', notes: 'Release notes' });
    expect(manifest.version).toBe('1.2.3');
    expect(manifest.pub_date).toBe('2026-07-21T12:00:00.000Z');
    expect(manifest.platforms['darwin-aarch64']).toEqual(manifest.platforms['darwin-x86_64']);
    expect(manifest.platforms['windows-x86_64'].url).toContain('/updater-stable/Brunomnia_1.2.3_x64-setup.exe.zip');
    expect(manifest.platforms['linux-x86_64'].signature).toBe('linux-signature');
  });

  it('rejects missing signatures and incomplete platform sets', async () => {
    const root = await fixture();
    await rm(join(root, 'windows/Brunomnia_1.2.3_x64-setup.exe.zip.sig'));
    await expect(createUpdaterManifest({ root, version: '1.2.3', channel: 'beta', repository: 'owner/repo', publishedAt: new Date().toISOString() })).rejects.toThrow('Missing updater signature');
  });
});
