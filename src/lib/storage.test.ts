import { describe, expect, it } from 'vitest';
import { cloneSeedWorkspace } from '../data/seed';
import { migrateWorkspace, parseWorkspaceImport } from './storage';

describe('workspace migrations', () => {
  it('upgrades v1 requests with protocol defaults without changing request identity', () => {
    const legacy = cloneSeedWorkspace() as unknown as Record<string, unknown>;
    legacy.version = 1;
    const collections = legacy.collections as Array<{ requests: Array<Record<string, unknown>> }>;
    const first = collections[0].requests[0];
    delete first.protocol;
    delete first.bodyMode;
    delete first.graphql;
    delete first.grpc;
    delete first.transport;
    delete legacy.apiDesigns;
    delete legacy.mockServers;
    delete legacy.runnerReports;
    delete legacy.imports;

    const migrated = migrateWorkspace(legacy);
    expect(migrated.version).toBe(7);
    expect(migrated.collections[0].requests[0]).toMatchObject({ id: first.id, protocol: 'http', bodyMode: 'none' });
    expect(migrated.collections[0].requests[0].transport.timeoutMs).toBe(60000);
    expect(migrated.apiDesigns[0].name).toBe('Orders API');
    expect(migrated.mockServers[0].host).toBe('127.0.0.1');
    expect(migrated.imports).toEqual([]);
    expect(migrated.cookies).toEqual([]);
    expect(migrated.responses).toEqual([]);
  });

  it('repairs minimal exports with usable collections, environments, and active IDs', () => {
    const migrated = migrateWorkspace({
      format: 'brunomnia',
      version: 1,
      name: '',
      activeRequestId: 'missing-request',
      activeEnvironmentId: 'missing-environment',
      collections: [],
    });

    expect(migrated.name).toBe('Imported Workspace');
    expect(migrated.collections[0].requests[0].id).toBe(migrated.activeRequestId);
    expect(migrated.environments[0].id).toBe(migrated.activeEnvironmentId);
    expect(migrated.history).toEqual([]);
    expect(migrated.imports).toEqual([]);
  });

  it('normalizes malformed collaboration and governance data without removing the last owner', () => {
    const workspace = cloneSeedWorkspace() as unknown as Record<string, unknown>;
    workspace.collaboration = { mode: 'unknown', revision: -4, path: 42 };
    workspace.governance = {
      currentMemberId: 'missing',
      members: [{ id: 'viewer', name: 'Viewer', role: 'invalid', active: true }, null],
      policy: { allowedStorage: ['invalid'], auditRetention: 1_000_000 },
      audit: [{ id: 'event', timestamp: '2026-07-16T00:00:00Z', action: 'test' }, 'invalid'],
    };
    const migrated = migrateWorkspace(workspace);
    expect(migrated.collaboration).toMatchObject({ mode: 'off', revision: 0, path: '' });
    expect(migrated.governance.members[0]).toMatchObject({ id: 'viewer', role: 'owner', active: true });
    expect(migrated.governance.currentMemberId).toBe('viewer');
    expect(migrated.governance.policy.auditRetention).toBe(10_000);
    expect(migrated.governance.policy.allowedStorage).toContain('encrypted-file');
    expect(migrated.governance.audit).toHaveLength(1);
  });

  it('rejects unrelated JSON', () => {
    expect(() => migrateWorkspace({ hello: 'world' })).toThrow('not a Brunomnia');
  });

  it('disables imported plugin code and clears inherited authority', () => {
    const exported = cloneSeedWorkspace();
    exported.plugins = [{
      id: 'plugin-one', name: 'Imported', version: '1.0.0', description: '', source: 'module.exports = {};', sourceFormat: 'insomnia-commonjs', enabled: true,
      requestedPermissions: ['network'], grantedPermissions: ['network'], installedAt: new Date().toISOString(),
    }];
    exported.pluginData = { 'plugin-one': { token: 'secret' } };
    exported.activePluginTheme = 'plugin-one::theme:0';

    const imported = parseWorkspaceImport(JSON.stringify(exported));
    expect(imported.plugins[0]).toMatchObject({ enabled: false, grantedPermissions: [] });
    expect(imported.pluginData).toEqual({});
    expect(imported.activePluginTheme).toBe('');
  });
});
