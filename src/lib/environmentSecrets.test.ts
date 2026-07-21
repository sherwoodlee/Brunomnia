import { describe, expect, it } from 'vitest';
import { cloneSeedWorkspace } from '../data/seed';
import type { KeyValue, Workspace } from '../types';
import {
  collectionEnvironmentSecretVariables,
  collectionWithoutPrivateEnvironments,
  directVaultEntries,
  duplicateEnvironmentSecrets,
  environmentSecretVariables,
  environmentSecretValue,
  mergePrivateCollectionEnvironments,
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
    const workspace: Workspace = {
      ...cloneSeedWorkspace(),
      collections: [{ id: 'collection', name: 'Collection', expanded: true, requests: [], subEnvironments: [{ id: 'private-collection', name: 'Private collection', private: true, variables: [secretRow('collection-secret', 'collectionToken')] }], activeSubEnvironmentId: 'private-collection' }],
      environments: [{ id: 'base', name: 'Base', variables: [{ id: 'plain', name: 'region', value: 'us', enabled: true }, secretRow('secret', 'token')], environmentEditorMode: 'table', parentId: '', private: true, color: '' }],
    };
    expect(withoutEnvironmentSecrets(workspace).environments[0].variables).toEqual([{ id: 'plain', name: 'region', value: 'us', enabled: true }]);
    expect(withoutEnvironmentSecrets(workspace).collections[0].subEnvironments?.[0].variables).toEqual([]);
  });

  it('scopes selected private collection aliases without leaking another collection', () => {
    const entries = upsertEnvironmentSecret([], 'collection-secret', 'collection-value', () => 'collection-entry');
    const session: VaultSession = { unlocked: true, passphrase: 'passphrase', entries };
    const collection = { id: 'one', name: 'One', expanded: true, requests: [], activeSubEnvironmentId: 'private', subEnvironments: [{ id: 'private', name: 'Private', private: true, variables: [secretRow('collection-secret', 'token')] }] };
    expect(collectionEnvironmentSecretVariables(collection, session)).toEqual({ 'vault.token': 'collection-value' });
    expect(collectionEnvironmentSecretVariables({ ...collection, id: 'two', activeSubEnvironmentId: '' }, session)).toEqual({});
    expect(collectionEnvironmentSecretVariables({ ...collection, subEnvironments: [{ ...collection.subEnvironments[0], private: false }] }, session)).toEqual({});
  });

  it('omits private collection environments from sharing and restores them after a pull', () => {
    const current = [{ id: 'collection', name: 'Local', expanded: true, requests: [], activeSubEnvironmentId: 'private', subEnvironments: [
      { id: 'shared', name: 'Shared', variables: [{ id: 'shared-row', name: 'region', value: 'west', enabled: true }] },
      { id: 'private', name: 'Private', private: true, variables: [secretRow('private-row', 'token')] },
    ] }];
    const shareable = collectionWithoutPrivateEnvironments(current[0]);
    expect(shareable.subEnvironments?.map((environment) => environment.id)).toEqual(['shared']);
    expect(shareable.activeSubEnvironmentId).toBe('');
    const consented = collectionWithoutPrivateEnvironments(current[0], true);
    expect(consented.subEnvironments?.map((environment) => environment.id)).toEqual(['shared', 'private']);
    expect(consented.subEnvironments?.[1].variables).toEqual([]);

    const remote = [{ id: 'collection', name: 'Remote', expanded: true, requests: [], activeSubEnvironmentId: 'remote', subEnvironments: [
      { id: 'remote', name: 'Remote shared', variables: [] },
      { id: 'private', name: 'Untrusted collision', variables: [] },
    ] }];
    const merged = mergePrivateCollectionEnvironments(current, remote);
    expect(merged[0].name).toBe('Remote');
    expect(merged[0].subEnvironments?.map((environment) => environment.name)).toEqual(['Remote shared', 'Private']);
    expect(merged[0].activeSubEnvironmentId).toBe('private');
  });
});
