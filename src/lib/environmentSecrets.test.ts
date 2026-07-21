import { describe, expect, it } from 'vitest';
import type { KeyValue, Workspace } from '../types';
import {
  directVaultEntries,
  duplicateEnvironmentSecrets,
  environmentSecretVariables,
  environmentSecretValue,
  removeEnvironmentSecrets,
  upsertEnvironmentSecret,
  withoutEnvironmentSecrets,
} from './environmentSecrets';
import type { VaultEntry, VaultSession } from './security';

const secretRow = (id: string, name: string, enabled = true): KeyValue => ({ id, name, value: '', enabled, valueType: 'secret' });
const direct: VaultEntry = { id: 'direct', name: 'api_token', value: 'direct-value', updatedAt: '2026-01-01T00:00:00Z' };

describe('private environment secret vault mapping', () => {
  it('upserts hidden owner-bound entries without exposing them as direct vault entries', () => {
    const created = upsertEnvironmentSecret([direct], 'row-one', 'first', () => 'hidden', '2026-01-02T00:00:00Z');
    expect(environmentSecretValue(created, 'row-one')).toBe('first');
    expect(directVaultEntries(created)).toEqual([direct]);
    const updated = upsertEnvironmentSecret(created, 'row-one', 'second', () => 'unused', '2026-01-03T00:00:00Z');
    expect(updated).toHaveLength(2);
    expect(updated[1]).toMatchObject({ id: 'hidden', name: '__brunomnia_environment__:row-one', value: 'second', kind: 'environment', ownerId: 'row-one' });
    expect(removeEnvironmentSecrets(updated, ['row-one'])).toEqual([direct]);
  });

  it('resolves enabled selected rows only beneath vault and clones independent owners', () => {
    const entries = upsertEnvironmentSecret([direct], 'source', 'private-value', () => 'source-entry');
    const session: VaultSession = { unlocked: true, passphrase: 'passphrase', entries };
    expect(environmentSecretVariables([secretRow('source', 'token'), secretRow('disabled', 'off', false)], session)).toEqual({ 'vault.token': 'private-value' });
    expect(environmentSecretVariables([secretRow('source', 'token')], { ...session, unlocked: false })).toEqual({});
    const cloned = duplicateEnvironmentSecrets([secretRow('source', 'token')], [secretRow('copy', 'token')], entries, () => 'copy-entry');
    expect(environmentSecretValue(cloned, 'copy')).toBe('private-value');
    expect(cloned.find((entry) => entry.ownerId === 'copy')).toMatchObject({ id: 'copy-entry', name: '__brunomnia_environment__:copy' });
  });

  it('removes secret metadata from a workspace when its vault is reset', () => {
    const workspace = {
      environments: [{ id: 'base', name: 'Base', variables: [{ id: 'plain', name: 'region', value: 'us', enabled: true }, secretRow('secret', 'token')], environmentEditorMode: 'table', parentId: '', private: true, color: '' }],
    } as Workspace;
    expect(withoutEnvironmentSecrets(workspace).environments[0].variables).toEqual([{ id: 'plain', name: 'region', value: 'us', enabled: true }]);
  });
});
