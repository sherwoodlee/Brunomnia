import { describe, expect, it } from 'vitest';
import { createTauriReleaseConfig } from './create-tauri-release-config.mjs';

describe('Tauri trusted release config', () => {
  it('enables hardened updater artifacts and delegates every Windows binary to the pinned signer', () => {
    const config = createTauriReleaseConfig({ version: '1.2.3-beta.4', repository: '/repo' });
    expect(config.version).toBe('1.2.3-beta.4');
    expect(config.bundle.createUpdaterArtifacts).toBe(true);
    expect(config.bundle.macOS.hardenedRuntime).toBe(true);
    expect(config.bundle.windows.signCommand).toEqual({
      cmd: 'pwsh',
      args: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', '/repo/scripts/windows-sign.ps1', '%1'],
    });
  });

  it('rejects tags and malformed versions', () => {
    expect(() => createTauriReleaseConfig({ version: 'v1.2.3' })).toThrow('without a leading v');
    expect(() => createTauriReleaseConfig({ version: 'latest' })).toThrow('SemVer');
  });
});
