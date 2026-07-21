import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { createDesktopArtifactManifest, writeDesktopArtifactManifest } from './desktop-artifact-manifest.mjs';

const temporaryDirectories: string[] = [];
const fixture = async () => {
  const root = await mkdtemp(join(tmpdir(), 'brunomnia-desktop-artifacts-'));
  temporaryDirectories.push(root);
  return root;
};
const digest = (value: string) => createHash('sha256').update(value).digest('hex');

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(path => rm(path, { force: true, recursive: true })));
});

describe('desktop artifact manifest', () => {
  it('records supported installers in stable path order with exact hashes', async () => {
    const root = await fixture();
    await mkdir(join(root, 'dmg'));
    await mkdir(join(root, 'macos', 'Brunomnia.app', 'Contents'), { recursive: true });
    await writeFile(join(root, 'dmg', 'Brunomnia.dmg'), 'disk-image');
    await writeFile(join(root, 'macos', 'rw.123.Brunomnia.dmg'), 'temporary-image');
    await writeFile(join(root, 'macos', 'Brunomnia.app', 'Contents', 'Info.plist'), 'ignored-app-file');
    const manifest = await createDesktopArtifactManifest({ root, platform: 'macos-arm64', revision: 'a'.repeat(40), appVersion: '0.1.0' });
    expect(manifest).toEqual({
      format: 'brunomnia-desktop-artifacts',
      manifestVersion: 1,
      appVersion: '0.1.0',
      revision: 'a'.repeat(40),
      platform: 'macos-arm64',
      artifacts: [{ name: 'dmg/Brunomnia.dmg', sizeBytes: 10, sha256: digest('disk-image') }],
    });
  });

  it('writes matching JSON and SHA256SUMS evidence', async () => {
    const root = await fixture();
    await mkdir(join(root, 'nsis'));
    await mkdir(join(root, 'msi'));
    await writeFile(join(root, 'nsis', 'Brunomnia-setup.exe'), 'nsis');
    await writeFile(join(root, 'msi', 'Brunomnia.msi'), 'msi');
    const result = await writeDesktopArtifactManifest({ root, platform: 'windows-x64', revision: 'b'.repeat(40), appVersion: '0.1.0' });
    expect(JSON.parse(await readFile(result.manifestPath, 'utf8'))).toEqual(result.manifest);
    expect(await readFile(result.checksumsPath, 'utf8')).toBe(digest('msi') + '  Brunomnia.msi\n' + digest('nsis') + '  Brunomnia-setup.exe\n');
  });

  it('rejects unsupported platforms, revisions, empty roots, and duplicate release names', async () => {
    const root = await fixture();
    await expect(createDesktopArtifactManifest({ root, platform: 'freebsd-x64', revision: 'a'.repeat(40), appVersion: '0.1.0' })).rejects.toThrow('Unsupported');
    await expect(createDesktopArtifactManifest({ root, platform: 'linux-x64', revision: 'short', appVersion: '0.1.0' })).rejects.toThrow('full lowercase');
    await expect(createDesktopArtifactManifest({ root, platform: 'linux-x64', revision: 'a'.repeat(40), appVersion: '0.1.0' })).rejects.toThrow('No supported');
    await mkdir(join(root, 'msi', 'first'), { recursive: true });
    await mkdir(join(root, 'msi', 'second'), { recursive: true });
    await writeFile(join(root, 'msi', 'first', 'Brunomnia.msi'), 'first');
    await writeFile(join(root, 'msi', 'second', 'Brunomnia.msi'), 'second');
    await expect(writeDesktopArtifactManifest({ root, platform: 'windows-x64', revision: 'a'.repeat(40), appVersion: '0.1.0' })).rejects.toThrow('unique');
  });

  it('pins actions and preserves unsigned cross-platform release provenance', async () => {
    const workflow = parse(await readFile('.github/workflows/desktop-release.yml', 'utf8')) as { jobs: { build: { env: Record<string, unknown>; strategy: { matrix: { include: Array<{ platform: string; runner: string; bundles: string }> } }; steps: Array<{ name?: string; run?: string; uses?: string; with?: Record<string, string | number> }> }; release: { steps: Array<{ name?: string; run?: string; uses?: string }> } } };
    const tauriConfig = JSON.parse(await readFile('src-tauri/tauri.conf.json', 'utf8')) as { bundle: { icon: string[] } };
    const icon = await readFile('src-tauri/icons/icon.png');
    const windowsIcon = await readFile('src-tauri/icons/icon.ico');
    expect(workflow.jobs.build.strategy.matrix.include.map(item => item.platform)).toEqual(['macos-arm64', 'windows-x64', 'linux-x64']);
    expect(workflow.jobs.build.strategy.matrix.include.map(item => item.runner)).toEqual(['macos-15', 'windows-2022', 'ubuntu-22.04']);
    expect(workflow.jobs.build.strategy.matrix.include.map(item => item.bundles)).toEqual(['app,dmg', 'nsis,msi', 'appimage,deb,rpm']);
    const actions = [...workflow.jobs.build.steps, ...workflow.jobs.release.steps].flatMap(step => step.uses ? [step.uses] : []);
    expect(actions.length).toBeGreaterThan(0);
    expect(actions.every(action => /@[0-9a-f]{40}$/.test(action))).toBe(true);
    expect(workflow.jobs.build.env.CI).toBe(true);
    expect(workflow.jobs.build.steps.find(step => step.name === 'Build desktop installers')?.run).toContain('--no-sign');
    expect(workflow.jobs.build.steps.find(step => step.name === 'Attest desktop installers')?.with).toEqual({
      'subject-checksums': 'src-tauri/target/release/bundle/SHA256SUMS-${{ matrix.platform }}.txt',
    });
    const upload = workflow.jobs.build.steps.find(step => step.name === 'Upload desktop installers')?.with;
    expect(upload?.['retention-days']).toBe(30);
    expect(upload?.path).toContain('bundle/dmg/*.dmg');
    expect(upload?.path).not.toContain('**/*.dmg');
    const release = workflow.jobs.release.steps.find(step => step.name === 'Publish tagged desktop installers')?.run;
    expect(release).toContain('test "${#files[@]}"');
    expect(release).not.toContain('${{#');
    expect(release).not.toContain('${{files');
    expect(release).toContain('gh release create');
    expect(tauriConfig.bundle.icon).toContain('icons/icon.png');
    expect(tauriConfig.bundle.icon).toContain('icons/icon.ico');
    expect([icon.readUInt32BE(16), icon.readUInt32BE(20)]).toEqual([512, 512]);
    expect([...windowsIcon.subarray(0, 4)]).toEqual([0, 0, 1, 0]);
    expect(windowsIcon.readUInt16LE(4)).toBe(6);
  });
});
