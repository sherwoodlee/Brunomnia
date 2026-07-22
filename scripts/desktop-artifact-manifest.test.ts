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
    const workflow = parse(await readFile('.github/workflows/desktop-release.yml', 'utf8')) as any;
    const tauriConfig = JSON.parse(await readFile('src-tauri/tauri.conf.json', 'utf8')) as { bundle: { createUpdaterArtifacts: boolean; icon: string[] }; plugins: { updater: { pubkey: string } } };
    const icon = await readFile('src-tauri/icons/icon.png');
    const windowsIcon = await readFile('src-tauri/icons/icon.ico');
    expect(workflow.jobs.build.strategy.matrix.include.map(item => item.platform)).toEqual(['macos-arm64', 'windows-x64', 'linux-x64']);
    expect(workflow.jobs.build.strategy.matrix.include.map(item => item.runner)).toEqual(['macos-15', 'windows-2022', 'ubuntu-22.04']);
    expect(workflow.jobs.build.strategy.matrix.include.map(item => item.bundles)).toEqual(['app,dmg', 'nsis,msi', 'appimage,deb,rpm']);
    expect(workflow.jobs.build.strategy.matrix.include.map(item => item.attestationPaths.trim().split('\n').length)).toEqual([1, 2, 3]);
    const trusted = workflow.jobs['trusted-release-build'];
    const actions = [...workflow.jobs.build.steps, ...trusted.steps, ...workflow.jobs.release.steps].flatMap((step: { uses?: string }) => step.uses ? [step.uses] : []);
    expect(actions.length).toBeGreaterThan(0);
    expect(actions.every(action => /@[0-9a-f]{40}$/.test(action))).toBe(true);
    expect(workflow.jobs.build.env.CI).toBe(true);
    expect(workflow.jobs.build.steps.find(step => step.name === 'Build desktop installers')?.run).toContain('--no-sign');
    expect(workflow.jobs.build.steps.find(step => step.name === 'Attest desktop installers')?.with).toEqual({
      'subject-path': '${{ matrix.attestationPaths }}',
    });
    const upload = workflow.jobs.build.steps.find(step => step.name === 'Upload desktop installers')?.with;
    expect(upload?.['retention-days']).toBe(30);
    expect(upload?.path).toContain('bundle/dmg/*.dmg');
    expect(upload?.path).not.toContain('**/*.dmg');
    expect(trusted.strategy.matrix.include.map((item: { platform: string }) => item.platform)).toEqual(['macos-universal', 'windows-x64', 'linux-x64']);
    expect(trusted.strategy.matrix.include[0].buildArgs).toContain('universal-apple-darwin');
    expect(trusted.steps.find((step: { name?: string }) => step.name === 'Build signed desktop installers and updater archives')?.run).not.toContain('--no-sign');
    expect(trusted.steps.find((step: { name?: string }) => step.name === 'Setup DigiCert Software Trust Manager')?.uses).toBe('digicert/code-signing-software-trust-action@fae23a455ba4bde62b64fd7cb2f81ade788f5a95');
    expect(trusted.steps.find((step: { name?: string }) => step.name === 'Verify Apple signatures and notarization')?.run).toContain('stapler validate');
    expect(trusted.steps.find((step: { name?: string }) => step.name === 'Verify Windows Authenticode signatures')?.run).toContain('Get-AuthenticodeSignature');
    const release = workflow.jobs.release.steps.find(step => step.name === 'Publish tagged desktop installers')?.run;
    const trustedRelease = workflow.jobs.release.steps.find((step: { name?: string }) => step.name === 'Publish tagged and rolling-channel releases')?.run;
    expect(trustedRelease).toContain('test "${#files[@]}"');
    expect(trustedRelease).not.toContain('${{#');
    expect(trustedRelease).not.toContain('${{files');
    expect(trustedRelease).toContain('gh release create');
    expect(trustedRelease).toContain('gh release upload');
    expect(release).toBeUndefined();
    expect(tauriConfig.bundle.icon).toContain('icons/icon.png');
    expect(tauriConfig.bundle.icon).toContain('icons/icon.ico');
    expect(tauriConfig.bundle.createUpdaterArtifacts).toBe(true);
    expect(tauriConfig.plugins.updater.pubkey).toMatch(/^[A-Za-z0-9+/=\n]+$/);
    expect([icon.readUInt32BE(16), icon.readUInt32BE(20)]).toEqual([512, 512]);
    expect([...windowsIcon.subarray(0, 4)]).toEqual([0, 0, 1, 0]);
    expect(windowsIcon.readUInt16LE(4)).toBe(6);
  });
});
