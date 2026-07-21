import { beforeEach, describe, expect, it, vi } from 'vitest';

const tauri = vi.hoisted(() => ({
  invoke: vi.fn(),
  isTauri: vi.fn(() => true),
}));

vi.mock('@tauri-apps/api/core', () => tauri);

import {
  autoUnlockSavedVault,
  forgetVaultKey,
  retainVaultKey,
  saveVaultWithSavedKey,
  unlockVaultWithSavedKey,
  vaultKeyStatus,
  type VaultEntry,
} from './security';

describe('native saved vault-key bridge', () => {
  beforeEach(() => {
    tauri.invoke.mockReset();
    tauri.isTauri.mockReturnValue(true);
  });

  it('uses operation-specific commands without a renderer key-read path', async () => {
    const entries: VaultEntry[] = [{ id: 'secret', name: 'token', value: 'value', updatedAt: 'now' }];
    tauri.invoke.mockImplementation(async (command: string) => {
      if (command === 'secure_vault_key_status') return { supported: true, retained: true };
      if (command === 'secure_vault_key_retain') return { supported: true, retained: true };
      if (command === 'secure_vault_key_forget') return { supported: true, retained: false };
      if (command === 'secure_vault_unlock_saved') return entries;
      if (command === 'secure_vault_save_saved') return { exists: true, updatedAt: 'later' };
      throw new Error(`Unexpected command ${command}`);
    });

    await expect(vaultKeyStatus('workspace-one')).resolves.toEqual({ supported: true, retained: true });
    await expect(retainVaultKey('workspace-one', 'local passphrase')).resolves.toEqual({ supported: true, retained: true });
    await expect(unlockVaultWithSavedKey('workspace-one')).resolves.toEqual(entries);
    await expect(saveVaultWithSavedKey('workspace-one', entries)).resolves.toEqual({ exists: true, updatedAt: 'later' });
    await expect(forgetVaultKey('workspace-one')).resolves.toEqual({ supported: true, retained: false });

    expect(tauri.invoke.mock.calls).toEqual([
      ['secure_vault_key_status', { workspaceId: 'workspace-one' }],
      ['secure_vault_key_retain', { workspaceId: 'workspace-one', passphrase: 'local passphrase' }],
      ['secure_vault_unlock_saved', { workspaceId: 'workspace-one' }],
      ['secure_vault_save_saved', { workspaceId: 'workspace-one', entries }],
      ['secure_vault_key_forget', { workspaceId: 'workspace-one' }],
    ]);
  });

  it('auto-unlocks only an existing vault with a retained supported key', async () => {
    const entries: VaultEntry[] = [{ id: 'secret', name: 'token', value: 'value', updatedAt: 'now' }];
    tauri.invoke.mockImplementation(async (command: string) => {
      if (command === 'secure_vault_status') return { exists: true, updatedAt: 'now' };
      if (command === 'secure_vault_key_status') return { supported: true, retained: true };
      if (command === 'secure_vault_unlock_saved') return entries;
      throw new Error(`Unexpected command ${command}`);
    });
    await expect(autoUnlockSavedVault('workspace-one')).resolves.toEqual(entries);
    expect(tauri.invoke).toHaveBeenLastCalledWith('secure_vault_unlock_saved', { workspaceId: 'workspace-one' });

    tauri.invoke.mockReset();
    tauri.invoke.mockImplementation(async (command: string) => command === 'secure_vault_status'
      ? { exists: true, updatedAt: 'now' }
      : { supported: true, retained: false });
    await expect(autoUnlockSavedVault('workspace-two')).resolves.toBeUndefined();
    expect(tauri.invoke).toHaveBeenCalledTimes(2);
  });
});
