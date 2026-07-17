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
    delete first.pathParams;
    delete first.graphql;
    delete first.grpc;
    delete first.transport;
    delete legacy.apiDesigns;
    delete legacy.mockServers;
    delete legacy.runnerReports;
    delete legacy.imports;

    const migrated = migrateWorkspace(legacy);
    expect(migrated.version).toBe(11);
    expect(migrated.collections[0].requests[0]).toMatchObject({ id: first.id, protocol: 'http', bodyMode: 'none' });
    expect(migrated.collections[0].requests[0].pathParams).toEqual([]);
    expect(migrated.collections[0].requests[0].transport.timeoutMs).toBe(60000);
    expect(migrated.apiDesigns[0].name).toBe('Orders API');
    expect(migrated.mockServers[0].host).toBe('127.0.0.1');
    expect(migrated.imports).toEqual([]);
    expect(migrated.cookies).toEqual([]);
    expect(migrated.responses).toEqual([]);
    expect(migrated.mcpClients).toEqual([]);
    expect(migrated.ai.enabled).toBe(false);
    expect(migrated.konnect.baseUrl).toBe('https://us.api.konghq.com');
    expect(migrated.preferences).toMatchObject({ theme: 'system', requestTimeoutMs: 30_000, autoFetchGraphqlSchema: true });
    expect(migrated.preferences.shortcuts['generate-code']).toBe('Mod+Shift+G');
    expect(migrated.collections[0].requests[0].graphql).toMatchObject({ schemaEndpoint: '', schemaFetchedAt: '' });
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

  it('normalizes v11 custom methods and described path rows', () => {
    const workspace = cloneSeedWorkspace() as unknown as Record<string, unknown>;
    workspace.version = 10;
    const first = (workspace.collections as Array<{ requests: Array<Record<string, unknown>> }>)[0].requests[0];
    first.method = ' propfind ';
    first.pathParams = [{ id: 'path', name: 'path', value: 'team docs', enabled: true, description: 'File path' }];
    const migrated = migrateWorkspace(workspace);
    expect(migrated.collections[0].requests[0].method).toBe('PROPFIND');
    expect(migrated.collections[0].requests[0].pathParams[0]).toMatchObject({ name: 'path', value: 'team docs', description: 'File path' });
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
    exported.mcpClients = [{
      id: 'mcp-one', name: 'Imported MCP', enabled: true, transport: 'stdio', url: '', command: '/tmp/server', args: [], headers: [], authType: 'bearer', token: 'raw-token', username: '', password: 'raw-password', roots: [], tools: [], prompts: [], resources: [], resourceTemplates: [],
    }];
    exported.ai = { ...exported.ai, enabled: true, apiKey: 'raw-ai-key', mockGeneration: true, commitSuggestions: true };
    exported.konnect = { ...exported.konnect, enabled: true, token: 'raw-konnect-token' };
    exported.preferences = { ...exported.preferences, theme: 'light', requestTimeoutMs: 123_000 };

    const imported = parseWorkspaceImport(JSON.stringify(exported));
    expect(imported.plugins[0]).toMatchObject({ enabled: false, grantedPermissions: [] });
    expect(imported.pluginData).toEqual({});
    expect(imported.activePluginTheme).toBe('');
    expect(imported.mcpClients[0]).toMatchObject({ enabled: false, token: '', password: '' });
    expect(imported.ai).toMatchObject({ enabled: false, apiKey: '', mockGeneration: false, commitSuggestions: false });
    expect(imported.konnect).toMatchObject({ enabled: false, token: '' });
    expect(imported.preferences).toMatchObject({ theme: 'system', requestTimeoutMs: 30_000 });
  });

  it('normalizes preference bounds and shortcut values', () => {
    const workspace = cloneSeedWorkspace() as unknown as Record<string, unknown>;
    workspace.preferences = { theme: 'unknown', density: 'compact', fontSize: 99, requestTimeoutMs: 1, shortcuts: { palette: ' mod + shift + p ', send: 42 } };
    const migrated = migrateWorkspace(workspace);
    expect(migrated.preferences).toMatchObject({ theme: 'system', density: 'compact', fontSize: 20, requestTimeoutMs: 1_000 });
    expect(migrated.preferences.shortcuts.palette).toBe('Mod+Shift+P');
    expect(migrated.preferences.shortcuts.send).toBe('Mod+Enter');
  });

  it('breaks malformed resource cycles and keeps private descendants device-local', () => {
    const workspace = cloneSeedWorkspace();
    workspace.collections[0].folders = [
      { id: 'folder-a', name: 'A', parentId: 'folder-b', expanded: true, headers: [], environment: [], preRequestScript: '', tests: '', documentation: '' },
      { id: 'folder-b', name: 'B', parentId: 'folder-a', expanded: true, headers: [], environment: [], preRequestScript: '', tests: '', documentation: '' },
    ];
    workspace.environments.push(
      { id: 'private', name: 'Private', parentId: 'base-environment', private: true, variables: [] },
      { id: 'descendant', name: 'Descendant', parentId: 'private', variables: [] },
      { id: 'cycle-a', name: 'Cycle A', parentId: 'cycle-b', variables: [] },
      { id: 'cycle-b', name: 'Cycle B', parentId: 'cycle-a', variables: [] },
    );
    const migrated = migrateWorkspace(workspace);
    const folderA = migrated.collections[0].folders?.find((folder) => folder.id === 'folder-a');
    const folderB = migrated.collections[0].folders?.find((folder) => folder.id === 'folder-b');
    expect(folderA?.parentId === 'folder-b' && folderB?.parentId === 'folder-a').toBe(false);
    const cycleA = migrated.environments.find((environment) => environment.id === 'cycle-a');
    const cycleB = migrated.environments.find((environment) => environment.id === 'cycle-b');
    expect(cycleA?.parentId === 'cycle-b' && cycleB?.parentId === 'cycle-a').toBe(false);
    expect(migrated.environments.find((environment) => environment.id === 'descendant')?.private).toBe(true);
  });
});
