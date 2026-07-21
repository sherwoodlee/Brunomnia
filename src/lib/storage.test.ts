import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cloneSeedWorkspace } from '../data/seed';
import { normalizeGraphqlSchema } from './graphql';
import { migrateWorkspace, parseWorkspaceImport, secureImportedWorkspace } from './storage';
import { createBlankWorkspace, createCatalogWorkspace, createCatalogWorkspaceInactive, createCatalogWorkspaceSnapshot, createWorkspaceDuplicate, deleteCatalogWorkspace, duplicateCatalogProjectWorkspace, emptyDeletedCatalogWorkspaces, listCatalogProjectWorkspaces, listCatalogWorkspaceSnapshots, listDeletedCatalogWorkspaces, loadWorkspaceCatalog, moveCatalogProjectWorkspace, openCatalogWorkspace, purgeDeletedCatalogWorkspace, readCatalogWorkspace, renameCatalogWorkspace, reorderCatalogWorkspace, restoreCatalogWorkspaceBackup, restoreCatalogWorkspaceSnapshot, restoreDeletedCatalogWorkspace, saveCatalogWorkspace } from './workspaceCatalog';

class MemoryStorage implements Storage {
  readonly values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

describe('local project catalog', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: new MemoryStorage() });
    Object.defineProperty(globalThis, 'isTauri', { configurable: true, value: false });
  });

  const seedActiveCatalog = async () => {
    const initial = await loadWorkspaceCatalog();
    await saveCatalogWorkspace(initial.activeWorkspaceId, { ...cloneSeedWorkspace(), name: initial.workspace.name, preferences: initial.workspace.preferences });
    return openCatalogWorkspace(initial.activeWorkspaceId);
  };

  it('creates initial and named local projects with no typed files', async () => {
    const initial = await loadWorkspaceCatalog();
    expect(initial.workspace).toMatchObject({ name: 'Local Workspace', version: 48, activeRequestId: '', activeEnvironmentId: '', collections: [], environments: [], fileState: {} });
    expect(await listCatalogProjectWorkspaces(initial.activeWorkspaceId)).toEqual([]);
    expect(JSON.parse(localStorage.getItem(`brunomnia.project.${initial.activeWorkspaceId}.v1`)!)).toMatchObject({ format: 'brunomnia-project-store', version: 1, records: [] });

    const created = await createCatalogWorkspace(createBlankWorkspace('Empty Project', initial.workspace.preferences), 'empty-project');
    expect(created.workspace).toMatchObject({ name: 'Empty Project', collections: [], environments: [], apiDesigns: [], mockServers: [], mcpClients: [] });
    expect(await listCatalogProjectWorkspaces('empty-project')).toEqual([]);
    expect((await createCatalogWorkspaceSnapshot('empty-project', 'Empty baseline')).fileCount).toBe(0);
  });

  it('creates inactive projects without switching or overwriting the active project', async () => {
    const initial = await loadWorkspaceCatalog();
    const active = { ...initial.workspace, name: 'Active coordinator' };
    await saveCatalogWorkspace(initial.activeWorkspaceId, active);

    const created = await createCatalogWorkspaceInactive(createBlankWorkspace('Managed control plane', initial.workspace.preferences), 'managed-control-plane');

    expect(created.activeWorkspaceId).toBe(initial.activeWorkspaceId);
    expect(created.workspace.name).toBe('Active coordinator');
    expect((await readCatalogWorkspace('managed-control-plane')).name).toBe('Managed control plane');
  });

  it('migrates the legacy browser workspace and manages project lifecycle', async () => {
    localStorage.setItem('brunomnia.workspace.v1', JSON.stringify({ ...cloneSeedWorkspace(), name: 'Legacy' }));
    const migrated = await loadWorkspaceCatalog();
    expect(migrated).toMatchObject({ activeWorkspaceId: 'local-workspace', workspace: { name: 'Legacy' } });
    const manifest = JSON.parse(localStorage.getItem('brunomnia.project.local-workspace.v1')!);
    expect(manifest).toMatchObject({ format: 'brunomnia-project-store', version: 1 });
    expect(manifest.records.length).toBeGreaterThan(0);
    expect(manifest.records.every((record: { key: string }) => localStorage.getItem(record.key) !== null)).toBe(true);

    const created = await createCatalogWorkspace(createBlankWorkspace('Second', cloneSeedWorkspace().preferences), 'second');
    expect(created.entries.map((entry) => entry.name)).toEqual(['Legacy', 'Second']);
    expect(created.activeWorkspaceId).toBe('second');

    const renamed = await renameCatalogWorkspace('second', 'Renamed');
    expect(renamed.workspace.name).toBe('Renamed');
    const opened = await openCatalogWorkspace('local-workspace');
    expect(opened.workspace.name).toBe('Legacy');
    const deleted = await deleteCatalogWorkspace('second');
    expect(deleted.entries).toHaveLength(1);
    await expect(deleteCatalogWorkspace('local-workspace')).rejects.toThrow('last local project');
  });

  it('opens the last valid backup and requires explicit restoration', async () => {
    const initial = await loadWorkspaceCatalog();
    const saved = { ...initial.workspace, name: 'Saved' };
    await saveCatalogWorkspace(initial.activeWorkspaceId, saved);
    localStorage.setItem(`brunomnia.project.${initial.activeWorkspaceId}.v1`, '{ broken');

    const recovered = await openCatalogWorkspace(initial.activeWorkspaceId);
    expect(recovered.entries[0].status).toBe('recoverable');
    expect(recovered.recovery?.kind).toBe('workspace-backup');
    expect(recovered.workspace.name).toBe('Local Workspace');

    const restored = await restoreCatalogWorkspaceBackup(initial.activeWorkspaceId);
    expect(restored.entries[0].status).toBe('ready');
    expect(restored.recovery).toBeUndefined();
    expect([...((localStorage as MemoryStorage).values.keys())].some((key) => key.startsWith('brunomnia.recovery.'))).toBe(true);
  });

  it('reads inactive projects, duplicates their resources, and persists manual order', async () => {
    const initial = await loadWorkspaceCatalog();
    const second = createBlankWorkspace('Second', initial.workspace.preferences);
    second.environments.push({ id: 'private-environment', name: 'Private', variables: [], parentId: '', private: true });
    second.konnect = { ...second.konnect, managedByWorkspaceId: initial.activeWorkspaceId, managedControlPlaneId: 'cp-one', managedRegion: 'us', managedClusterType: 'CLUSTER_TYPE_CONTROL_PLANE', managedDeploymentType: 'dedicatedCloud' };
    await createCatalogWorkspace(second, 'second');
    await createCatalogWorkspace(createBlankWorkspace('Third', initial.workspace.preferences), 'third');
    await openCatalogWorkspace(initial.activeWorkspaceId);

    const inactive = await readCatalogWorkspace('second');
    expect(inactive.name).toBe('Second');
    const reordered = await reorderCatalogWorkspace('third', initial.activeWorkspaceId, 'before');
    expect(reordered.entries.map((entry) => entry.id)).toEqual(['third', initial.activeWorkspaceId, 'second']);
    expect(reordered.activeWorkspaceId).toBe(initial.activeWorkspaceId);

    const duplicate = createWorkspaceDuplicate(inactive, 'Second Clone', initial.workspace.preferences);
    expect(duplicate.name).toBe('Second Clone');
    expect(duplicate.collections).toEqual(inactive.collections);
    expect(duplicate.collections).not.toBe(inactive.collections);
    expect(duplicate.environments).toContainEqual(expect.objectContaining({ id: 'private-environment', private: true }));
    expect(duplicate.history).toEqual([]);
    expect(duplicate.responses).toEqual([]);
    expect(duplicate.streamSessions).toEqual([]);
    expect(duplicate.runnerReports).toEqual([]);
    expect(duplicate.project).toMatchObject({ mode: 'local', path: '', remoteUrl: '' });
    expect(duplicate.konnect).toMatchObject({ enabled: false, token: '' });
    expect(duplicate.konnect.managedControlPlaneId).toBeUndefined();
    expect(duplicate.collaboration).toMatchObject({ mode: 'off', path: '', revision: 0 });

    const copied = await createCatalogWorkspace(duplicate, 'second-copy');
    expect(copied.activeWorkspaceId).toBe('second-copy');
    expect(copied.entries.map((entry) => entry.id)).toEqual(['third', initial.activeWorkspaceId, 'second', 'second-copy']);
  });

  it('duplicates one typed project file into another local project', async () => {
    const initial = await seedActiveCatalog();
    const sourceCollectionId = initial.workspace.collections[0].id;
    const sourceCollectionCount = initial.workspace.collections.length;
    await createCatalogWorkspace(createBlankWorkspace('Destination', initial.workspace.preferences), 'destination');
    await openCatalogWorkspace(initial.activeWorkspaceId);

    expect(await listCatalogProjectWorkspaces(initial.activeWorkspaceId)).toContainEqual(expect.objectContaining({ id: sourceCollectionId, scope: 'collection' }));
    const duplicated = await duplicateCatalogProjectWorkspace(initial.activeWorkspaceId, sourceCollectionId, 'destination', 'Copied requests');

    expect(duplicated.activeWorkspaceId).toBe('destination');
    expect(duplicated.workspace.collections).toContainEqual(expect.objectContaining({ name: 'Copied requests' }));
    expect((await readCatalogWorkspace(initial.activeWorkspaceId)).collections).toHaveLength(sourceCollectionCount);
  });

  it('moves one typed project file between local projects without changing its identity', async () => {
    const initial = await seedActiveCatalog();
    const mockServerId = initial.workspace.mockServers[0].id;
    await createCatalogWorkspace(createBlankWorkspace('Destination', initial.workspace.preferences), 'destination');
    await openCatalogWorkspace(initial.activeWorkspaceId);

    const moved = await moveCatalogProjectWorkspace(initial.activeWorkspaceId, mockServerId, 'destination');

    expect(moved.activeWorkspaceId).toBe('destination');
    expect(moved.workspace.mockServers).toContainEqual(expect.objectContaining({ id: mockServerId }));
    expect((await readCatalogWorkspace(initial.activeWorkspaceId)).mockServers).not.toContainEqual(expect.objectContaining({ id: mockServerId }));
    await expect(moveCatalogProjectWorkspace('destination', mockServerId, 'destination')).rejects.toThrow('different destination');
  });

  it('creates, restores, bounds, and reparents browser project snapshots', async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-07-20T10:00:00.000Z'));
      const initial = await seedActiveCatalog();
      const workspaceId = initial.activeWorkspaceId;
      await createCatalogWorkspaceSnapshot(workspaceId, 'Baseline');
      await saveCatalogWorkspace(workspaceId, { ...initial.workspace, name: 'Changed' });
      vi.setSystemTime(new Date('2026-07-20T10:01:00.000Z'));
      await createCatalogWorkspaceSnapshot(workspaceId, 'Changed version');

      expect(await listCatalogWorkspaceSnapshots(workspaceId)).toEqual([
        expect.objectContaining({ message: 'Changed version', fileCount: 8, sizeBytes: expect.any(Number) }),
        expect.objectContaining({ message: 'Baseline', fileCount: 8, sizeBytes: expect.any(Number) }),
      ]);
      const baseline = (await listCatalogWorkspaceSnapshots(workspaceId)).find((snapshot) => snapshot.message === 'Baseline')!;
      expect((await restoreCatalogWorkspaceSnapshot(workspaceId, baseline.id)).workspace.name).toBe('Local Workspace');

      await createCatalogWorkspace(createBlankWorkspace('Other', initial.workspace.preferences), 'other');
      await openCatalogWorkspace(workspaceId);
      await deleteCatalogWorkspace(workspaceId);
      const deleted = (await listDeletedCatalogWorkspaces()).find((entry) => entry.workspaceId === workspaceId)!;
      expect(deleted.hasSnapshots).toBe(true);
      const orphanKey = `brunomnia.snapshot.${workspaceId}.snapshot-orphan.v1`;
      localStorage.setItem(orphanKey, '{}');
      await expect(restoreDeletedCatalogWorkspace(workspaceId, deleted.deletedAt)).rejects.toThrow('snapshot history conflicts');
      localStorage.removeItem(orphanKey);
      await restoreDeletedCatalogWorkspace(workspaceId, deleted.deletedAt);
      expect(await listCatalogWorkspaceSnapshots(workspaceId)).toHaveLength(2);

      for (let index = 0; index < 51; index += 1) {
        vi.setSystemTime(new Date(Date.UTC(2026, 6, 20, 11, index)));
        await createCatalogWorkspaceSnapshot(workspaceId, `Retained ${index}`);
      }
      const retained = await listCatalogWorkspaceSnapshots(workspaceId);
      expect(retained).toHaveLength(50);
      expect(retained[0].message).toBe('Retained 50');
      expect(retained.some((snapshot) => snapshot.message === 'Baseline')).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('lists deleted projects and restores a valid browser backup', async () => {
    await loadWorkspaceCatalog();
    const created = await createCatalogWorkspace(createBlankWorkspace('Second', cloneSeedWorkspace().preferences), 'second');
    await saveCatalogWorkspace('second', { ...created.workspace, name: 'Saved' });
    const beforeDelete = (await openCatalogWorkspace('second')).entries.find((entry) => entry.id === 'second')!;
    localStorage.setItem('brunomnia.project.second.v1', '{ broken');

    await deleteCatalogWorkspace('second');
    const deleted = await listDeletedCatalogWorkspaces();
    expect(deleted).toHaveLength(1);
    expect(deleted[0]).toMatchObject({ workspaceId: 'second', name: 'Saved', status: 'recoverable', hasBackup: true, hasVault: false });

    const restored = await restoreDeletedCatalogWorkspace('second', deleted[0].deletedAt);
    expect(restored.activeWorkspaceId).toBe('second');
    expect(restored.workspace.name).toBe('Second');
    expect(restored.entries).toHaveLength(2);
    expect(restored.entries.find((entry) => entry.id === 'second')).toMatchObject({ createdAt: beforeDelete.createdAt, updatedAt: beforeDelete.updatedAt });
    expect(await listDeletedCatalogWorkspaces()).toEqual([]);
    expect([...((localStorage as MemoryStorage).values.keys())].some((key) => key.includes('.deleted-workspace.invalid.v1'))).toBe(true);
  });

  it('refuses deleted-project restoration after its ID is reused', async () => {
    await loadWorkspaceCatalog();
    await createCatalogWorkspace(createBlankWorkspace('Deleted', cloneSeedWorkspace().preferences), 'second');
    await deleteCatalogWorkspace('second');
    const [deleted] = await listDeletedCatalogWorkspaces();

    await createCatalogWorkspace(createBlankWorkspace('Replacement', cloneSeedWorkspace().preferences), 'second');
    await expect(restoreDeletedCatalogWorkspace('second', deleted.deletedAt)).rejects.toThrow('already uses');
    expect((await openCatalogWorkspace('second')).workspace.name).toBe('Replacement');
    expect(await listDeletedCatalogWorkspaces()).toHaveLength(1);
  });

  it('permanently deletes exact browser recovery copies and empties recognized trash only', async () => {
    await loadWorkspaceCatalog();
    const secondWorkspace = createBlankWorkspace('Second', cloneSeedWorkspace().preferences);
    secondWorkspace.mockServers.push({ id: 'second-mock', name: 'Second mock', host: '127.0.0.1', port: 4010, routes: [] });
    await createCatalogWorkspace(secondWorkspace, 'second');
    await createCatalogWorkspaceSnapshot('second', 'Second snapshot');
    await deleteCatalogWorkspace('second');
    const thirdWorkspace = createBlankWorkspace('Third', cloneSeedWorkspace().preferences);
    thirdWorkspace.environments.push({ id: 'third-environment', name: 'Third environment', variables: [], parentId: '' });
    await createCatalogWorkspace(thirdWorkspace, 'third');
    await deleteCatalogWorkspace('third');
    localStorage.setItem('brunomnia.trash.keep.txt', 'keep');

    const deleted = await listDeletedCatalogWorkspaces();
    expect(deleted).toHaveLength(2);
    const second = deleted.find((entry) => entry.workspaceId === 'second')!;
    expect(second.hasSnapshots).toBe(true);
    const secondRecordKeys = [...((localStorage as MemoryStorage).values.keys())].filter((key) => key.startsWith('brunomnia.project-file.second.'));
    expect(secondRecordKeys.length).toBeGreaterThan(0);
    await purgeDeletedCatalogWorkspace(second.workspaceId, second.deletedAt);
    expect(secondRecordKeys.every((key) => localStorage.getItem(key) === null)).toBe(true);
    expect((await listDeletedCatalogWorkspaces()).map((entry) => entry.workspaceId)).toEqual(['third']);
    await expect(purgeDeletedCatalogWorkspace(second.workspaceId, second.deletedAt)).rejects.toThrow('no longer exists');
    await expect(restoreDeletedCatalogWorkspace(second.workspaceId, second.deletedAt)).rejects.toThrow('valid workspace or backup');

    expect([...((localStorage as MemoryStorage).values.keys())].some((key) => key.startsWith('brunomnia.project-file.third.'))).toBe(true);
    await emptyDeletedCatalogWorkspaces();
    expect(await listDeletedCatalogWorkspaces()).toEqual([]);
    expect([...((localStorage as MemoryStorage).values.keys())].some((key) => key.startsWith('brunomnia.project-file.third.'))).toBe(false);
    expect(localStorage.getItem('brunomnia.trash.keep.txt')).toBe('keep');
  });

  it('restores a valid browser project when optional trash metadata is corrupt', async () => {
    await loadWorkspaceCatalog();
    await createCatalogWorkspace(createBlankWorkspace('Second', cloneSeedWorkspace().preferences), 'second');
    await deleteCatalogWorkspace('second');
    const [deleted] = await listDeletedCatalogWorkspaces();
    const metadataKey = [...((localStorage as MemoryStorage).values.keys())].find((key) => key.endsWith('.metadata.v1'))!;
    localStorage.setItem(metadataKey, '{ broken');

    const restored = await restoreDeletedCatalogWorkspace('second', deleted.deletedAt);
    expect(restored.workspace.name).toBe('Second');
    expect([...((localStorage as MemoryStorage).values.keys())].some((key) => key.includes('.deleted-metadata.invalid.v1'))).toBe(true);
  });

  it('restores a corrupt browser catalog from its rotating backup', async () => {
    await loadWorkspaceCatalog();
    await createCatalogWorkspace(createBlankWorkspace('Second', cloneSeedWorkspace().preferences), 'second');
    localStorage.setItem('brunomnia.projects.v1', '{ broken');

    const restored = await loadWorkspaceCatalog();
    expect(restored.entries.map((entry) => entry.name)).toContain('Local Workspace');
    expect(restored.recovery?.kind).toBe('catalog-backup');
  });
});

  describe('workspace migrations', () => {
    it('retains only metadata for private Secret rows and rejects them outside private global environments', () => {
      const workspace = cloneSeedWorkspace();
      workspace.environments = [
        { id: 'base', name: 'Base', variables: [{ id: 'public-secret', name: 'token', value: 'must-drop', valueType: 'secret', enabled: true }], environmentEditorMode: 'table', parentId: '', private: false, color: '' },
        { id: 'private', name: 'Private', variables: [{ id: 'private-secret', name: 'token', value: 'must-never-persist', valueType: 'secret', enabled: true }], environmentEditorMode: 'raw', parentId: 'base', private: true, color: '' },
      ];
      workspace.collections[0].environment = [{ id: 'collection-secret', name: 'token', value: 'must-drop', valueType: 'secret', enabled: true }];
      const migrated = migrateWorkspace(workspace);
      expect(migrated.version).toBe(48);
      expect(migrated.environments[0].variables).toEqual([]);
      expect(migrated.environments[1]).toMatchObject({ environmentEditorMode: 'table', variables: [{ id: 'private-secret', name: 'token', value: '', valueType: 'secret', enabled: true }] });
      expect(migrated.collections[0].environment).toEqual([]);
      expect(secureImportedWorkspace(workspace).environments[1].variables).toEqual([]);
    });

  it('preserves explicit v42 empty projects while repairing legacy empty documents', () => {
    const empty = createBlankWorkspace('Empty', cloneSeedWorkspace().preferences);
    expect(migrateWorkspace(empty)).toMatchObject({ version: 48, activeRequestId: '', activeEnvironmentId: '', collections: [], environments: [], fileState: {} });

    const legacy = { ...empty, version: 41 };
    const migratedLegacy = migrateWorkspace(legacy);
    expect(migratedLegacy.collections.length).toBeGreaterThan(0);
    expect(migratedLegacy.environments.length).toBeGreaterThan(0);
  });

  it('normalizes the device-local Git credential selection and strips imported authority', () => {
    const workspace = cloneSeedWorkspace() as unknown as Record<string, unknown>;
    workspace.project = {
      mode: 'git',
      path: '/private/repository',
      remoteUrl: 'https://github.com/acme/orders.git',
      remoteName: 'origin',
      authorName: 'Developer',
      authorEmail: 'developer@example.com',
      autoSave: true,
      gitCredentialId: 'github-one',
    };

    const migrated = migrateWorkspace(workspace);
    expect(migrated.project.gitCredentialId).toBe('github-one');

    expect(secureImportedWorkspace(workspace).project).toEqual(cloneSeedWorkspace().project);
  });

  it('normalizes persisted GGUF settings with Insomnia-compatible defaults and bounds', () => {
    const workspace = cloneSeedWorkspace() as unknown as Record<string, unknown>;
    workspace.version = 39;
    workspace.ai = {
      enabled: true,
      provider: 'gguf',
      baseUrl: 'ignored',
      model: 'local.gguf',
      apiKey: '',
      temperature: 5,
      topP: -1,
      topK: 42.9,
      seed: false,
      repeatPenalty: Number.NaN,
      mockGeneration: true,
      commitSuggestions: true,
    };

    expect(migrateWorkspace(workspace).ai).toEqual({
      enabled: true,
      provider: 'gguf',
      baseUrl: 'ignored',
      model: 'local.gguf',
      apiKey: '',
      temperature: 2,
      topP: 0,
      topK: 42,
      seed: false,
      repeatPenalty: 1.1,
      mockGeneration: true,
      commitSuggestions: true,
    });
    const legacy = cloneSeedWorkspace() as unknown as Record<string, unknown>;
    legacy.ai = { enabled: false, provider: 'openai-compatible', baseUrl: '', model: '', apiKey: '' };
    expect(migrateWorkspace(legacy).ai).toMatchObject({ temperature: 0.6, topP: 0.9, topK: 40, seed: true, repeatPenalty: 1.1 });
  });

  it('upgrades v1 requests with protocol defaults without changing request identity', () => {
    const legacy = cloneSeedWorkspace() as unknown as Record<string, unknown>;
    legacy.version = 1;
    const collections = legacy.collections as Array<{ requests: Array<Record<string, unknown>> }>;
    const first = collections[0].requests[0];
    (first.auth as Record<string, unknown>).expiresAt = 'invalid';
    delete (first.auth as Record<string, unknown>).useDefaultBrowser;
    (collections[0].requests[1].auth as Record<string, unknown>).useDefaultBrowser = true;
    delete first.protocol;
    delete first.bodyMode;
    delete first.renderBodyTemplates;
    delete first.pathParams;
    delete first.graphql;
    delete first.grpc;
    delete first.transport;
    delete first.socketIo;
    delete legacy.apiDesigns;
    delete legacy.mockServers;
    delete legacy.runnerReports;
    delete legacy.imports;

    const migrated = migrateWorkspace(legacy);
    expect(migrated.version).toBe(48);
    expect(migrated.collections[0].requests[0]).toMatchObject({ id: first.id, protocol: 'http', bodyMode: 'none' });
    expect(migrated.collections[0].requests[0].encodeUrl).toBe(true);
    expect(migrated.collections[0].requests[0].renderBodyTemplates).toBe(true);
    expect(migrated.collections[0].requests[0].pathParams).toEqual([]);
    expect(migrated.collections[0].requests[0].graphql).toMatchObject({ schemaSource: 'remote', schemaFileName: '', includeInputValueDeprecation: false, schemaIncludesInputValueDeprecation: false });
    expect(migrated.collections[0].requests[0].transport.timeoutMs).toBe(60000);
    expect(migrated.collections[0].requests[0].sse).toEqual({
      autoReconnect: true,
      reconnectDelayMs: 1_000,
      maxReconnects: 0,
      respectServerRetry: true,
      sendLastEventId: true,
    });
    expect(migrated.collections[0].requests[0].socketIo).toEqual({
      path: '/socket.io', eventName: 'message', ack: false, eventListeners: [],
      args: [{ id: `${first.id}-socketio-arg`, value: '{}', mode: 'json' }],
    });
    expect(migrated.apiDesigns[0].name).toBe('Orders API');
    expect(migrated.mockServers[0].host).toBe('127.0.0.1');
    expect(migrated.imports).toEqual([]);
    expect(migrated.cookies).toEqual([]);
    expect(migrated.responses).toEqual([]);
    expect(migrated.streamSessions).toEqual([]);
    expect(migrated.mcpSessions).toEqual([]);
    expect(migrated.responseFilters).toEqual({});
    expect(migrated.mcpClients).toEqual([]);
    expect(migrated.ai.enabled).toBe(false);
    expect(migrated.konnect.baseUrl).toBe('https://us.api.konghq.com');
    expect(migrated.preferences).toMatchObject({ theme: 'system', preferredHttpVersion: 'default', maxRedirects: 10, followRedirects: true, maxTimelineDataSizeKB: 10, maxHistoryResponses: 20, filterResponsesByEnv: false, requestTimeoutMs: 30_000, validateCertificates: true, validateAuthCertificates: true, proxyEnabled: false, httpProxy: '', httpsProxy: '', noProxy: '', pluginRegistryUrl: 'https://registry.npmjs.org/', autoFetchGraphqlSchema: true });
    expect(migrated.preferences).toMatchObject({ useBulkHeaderEditor: false, useBulkParametersEditor: false });
    expect(migrated.preferences).toMatchObject({ forceVerticalLayout: false, editorIndentWithTabs: true, editorIndentSize: 2, editorLineWrapping: true, fontVariantLigatures: false });
    expect(migrated.preferences).toMatchObject({ fontSize: 11, interfaceFontSize: 13, fontInterface: '', fontMonospace: '', showPasswords: false, allowHtmlPreviewRemoteResources: true, allowHtmlPreviewScripts: true, disableResponsePreviewLinks: false });
    expect(migrated.collections[0].requests[0].transport).toMatchObject({ followRedirects: true, followRedirectsMode: 'global', timeoutMode: 'global', validateCertificatesMode: 'global', proxyMode: 'global' });
    expect(migrated.preferences).toMatchObject({ scriptTimeoutMs: 10_000, allowScriptRequests: false, allowScriptFileAccess: false, dataFolders: [], enableVaultInScripts: false });
    expect(migrated.preferences.shortcuts['generate-code']).toEqual(['Mod+Shift+G']);
    expect(migrated.collections[0].requests[0].graphql).toMatchObject({ schemaEndpoint: '', schemaFetchedAt: '' });
    expect(migrated.collections[0].requests[0].auth.expiresAt).toBe(0);
    expect(migrated.collections[0].requests[0].auth.useDefaultBrowser).toBe(false);
    expect(migrated.collections[0].requests[1].auth.useDefaultBrowser).toBe(true);
  });

  it('preserves body rendering policy and normalizes multipart editor modes', () => {
    const workspace = cloneSeedWorkspace() as unknown as Record<string, unknown>;
    workspace.version = 26;
    const request = ((workspace.collections as Array<{ requests: Array<Record<string, unknown>> }>)[0].requests[0]);
    request.renderBodyTemplates = false;
    request.multipartBody = [
      { id: 'multiline', name: 'payload', value: 'one\ntwo', enabled: true, kind: 'text', multiline: true },
      { id: 'legacy', name: 'legacy', value: 'value', enabled: true, kind: 'text', multiline: 'invalid' },
    ];

    const migrated = migrateWorkspace(workspace);
    expect(migrated.version).toBe(48);
    expect(migrated.collections[0].requests[0].renderBodyTemplates).toBe(false);
    expect(migrated.collections[0].requests[0].multipartBody).toEqual([
      expect.objectContaining({ id: 'multiline', multiline: true, contentType: '', fileName: '' }),
      expect.objectContaining({ id: 'legacy', multiline: false, contentType: '', fileName: '' }),
    ]);
  });

  it('normalizes bounded standalone test suites and their saved results', () => {
    const workspace = cloneSeedWorkspace() as unknown as Record<string, unknown>;
    const requestId = cloneSeedWorkspace().activeRequestId;
    workspace.testSuites = [{
      id: 'suite-one', name: 'Contract tests', sortKey: -10,
      tests: [
        { id: 'test-one', name: 'Returns 200', code: 'const response = await insomnia.send();', requestId, sortKey: 2 },
        { id: 'test-two', name: 'Missing request', code: '', requestId: 'deleted', sortKey: 1 },
      ],
    }, { id: 'suite-one', name: 'Duplicate', tests: [] }, null];
    workspace.unitTestResults = [{
      id: 'result-one', suiteId: 'suite-one', startedAt: '2026-07-19T00:00:00.000Z', finishedAt: '2026-07-19T00:00:01.000Z',
      tests: [{ testId: 'test-one', name: 'Returns 200', requestId, passed: true, durationMs: 12.8, logs: ['sent'] }],
    }, { id: 'orphan', suiteId: 'missing', tests: [] }];

    const migrated = migrateWorkspace(workspace);
    expect(migrated.version).toBe(48);
    expect(migrated.testSuites).toHaveLength(1);
    expect(migrated.testSuites[0].collectionId).toBe(migrated.collections[0].id);
    expect(migrated.testSuites[0].tests.map((test) => [test.id, test.requestId])).toEqual([['test-two', null], ['test-one', requestId]]);
    expect(migrated.unitTestResults).toEqual([expect.objectContaining({ id: 'result-one', suiteId: 'suite-one', tests: [expect.objectContaining({ passed: true, durationMs: 12, logs: ['sent'] })] })]);
  });

  it('preserves v34 GraphQL schema origin and complete normalized metadata', () => {
    const workspace = cloneSeedWorkspace();
    workspace.collections[0].requests[0].graphql = {
      ...workspace.collections[0].requests[0].graphql,
      schema: normalizeGraphqlSchema({
        queryType: { name: 'Query' }, mutationType: null, subscriptionType: null,
        directives: [{ name: 'live', description: 'Live query', isRepeatable: true, locations: ['QUERY'], args: [] }],
        types: [
          { kind: 'OBJECT', name: 'Query', fields: [{ name: 'viewer', args: [], type: { kind: 'SCALAR', name: 'String' } }], interfaces: [] },
          { kind: 'SCALAR', name: 'String', specifiedByURL: 'https://spec.example/string' },
        ],
      }),
      schemaEndpoint: '',
      schemaFetchedAt: '2026-07-19T12:00:00.000Z',
      schemaSource: 'local',
      schemaFileName: 'schema.json',
      includeInputValueDeprecation: true,
      schemaIncludesInputValueDeprecation: true,
    };
    const graphql = migrateWorkspace(workspace).collections[0].requests[0].graphql;
    expect(graphql).toMatchObject({ schemaSource: 'local', schemaFileName: 'schema.json', includeInputValueDeprecation: true, schemaIncludesInputValueDeprecation: true });
    expect(graphql.schema).toMatchObject({ queryType: 'Query', directives: [{ name: 'live', isRepeatable: true }], types: expect.arrayContaining([expect.objectContaining({ name: 'String', specifiedByUrl: 'https://spec.example/string' })]) });
  });

  it('marks pre-v34 GraphQL caches stale so complete metadata is refreshed', () => {
    const workspace = cloneSeedWorkspace() as unknown as { version: number; collections: Array<{ requests: Array<{ graphql: Record<string, unknown> }> }> };
    workspace.version = 33;
    workspace.collections[0].requests[0].graphql.schemaEndpoint = 'https://api.example/graphql';
    workspace.collections[0].requests[0].graphql.schemaSource = 'local';
    workspace.collections[0].requests[0].graphql.schemaFileName = 'legacy.json';
    workspace.collections[0].requests[0].graphql.schemaIncludesInputValueDeprecation = true;
    expect(migrateWorkspace(workspace).collections[0].requests[0].graphql).toMatchObject({ schemaEndpoint: '', schemaSource: 'remote', schemaFileName: '', schemaIncludesInputValueDeprecation: false });
  });

  it('migrates legacy gRPC text into a bounded persisted proto tree', () => {
    const workspace = cloneSeedWorkspace() as unknown as Record<string, unknown>;
    workspace.version = 28;
    const request = (workspace.collections as Array<{ requests: Array<Record<string, unknown>> }>)[0].requests[0];
    request.grpc = {
      ...(request.grpc as Record<string, unknown>),
      protoText: 'syntax = "proto3"; service Legacy {}',
      protoFiles: [{ path: '../escape.proto', text: 'invalid' }],
      protoEntryPath: '../escape.proto',
      protoActivePath: 'missing.proto',
    };

    const migrated = migrateWorkspace(workspace);
    expect(migrated.version).toBe(48);
    expect(migrated.collections[0].requests[0].grpc).toMatchObject({
      protoText: 'syntax = "proto3"; service Legacy {}',
      protoEntryPath: 'schema.proto',
      protoActivePath: 'schema.proto',
      protoFiles: [expect.objectContaining({ path: 'schema.proto', text: 'syntax = "proto3"; service Legacy {}' })],
    });
  });

  it('migrates bounded Buf Schema Registry configuration and the legacy gRPC User-Agent flag', () => {
    const workspace = cloneSeedWorkspace() as unknown as Record<string, unknown>;
    workspace.version = 31;
    const request = (workspace.collections as Array<{ requests: Array<Record<string, unknown>> }>)[0].requests[0];
    delete request.disableUserAgentHeader;
    request.grpc = {
      ...(request.grpc as Record<string, unknown>),
      descriptorSource: 'buf',
      reflectionApiUrl: `https://registry.example/${'u'.repeat(9_000)}`,
      reflectionApiKey: 'k'.repeat(70_000),
      reflectionApiModule: `buf.build/acme/${'m'.repeat(3_000)}`,
      disableUserAgentHeader: true,
    };

    const migrated = migrateWorkspace(workspace);
    const grpc = migrated.collections[0].requests[0].grpc;
    expect(migrated.version).toBe(48);
    expect(grpc.descriptorSource).toBe('buf');
    expect(grpc.reflectionApiUrl).toHaveLength(8_192);
    expect(grpc.reflectionApiKey).toHaveLength(65_536);
    expect(grpc.reflectionApiModule).toHaveLength(2_048);
    expect(migrated.collections[0].requests[0].disableUserAgentHeader).toBe(true);
    expect(grpc).not.toHaveProperty('disableUserAgentHeader');
  });

  it('migrates workspace certificates into bounded device-local records', () => {
    const workspace = cloneSeedWorkspace() as unknown as Record<string, unknown>;
    workspace.version = 29;
    workspace.certificates = {
      ca: { enabled: true, pem: 'ca-pem' },
      clients: [null, { id: 'client', host: 'api.example.test:8443', enabled: true, certificatePem: 'cert-pem', keyPem: 'key-pem' }, { id: 'pfx', host: '*.internal.test', enabled: true, pfxBase64: 'cGZ4', passphrase: 'secret' }],
    };
    workspace.cookies = [{ id: 'legacy-cookie', name: 'sid', value: 'legacy', domain: 'api.example.test', path: '/', secure: true, httpOnly: true, sameSite: 'lax', hostOnly: true, createdAt: '2026-07-20T00:00:00.000Z' }];
    const migrated = migrateWorkspace(workspace);
    expect(migrated.version).toBe(48);
    expect(migrated.certificates).toEqual({ ca: { enabled: false, pem: '' }, clients: [] });
    expect(Object.values(migrated.fileState)).not.toHaveLength(0);
    expect(Object.values(migrated.fileState)).toEqual(expect.arrayContaining([{
      ca: { enabled: true, pem: 'ca-pem' },
      clients: [
        { id: 'client', host: 'api.example.test:8443', enabled: true, certificatePem: 'cert-pem', keyPem: 'key-pem', pfxBase64: '', passphrase: '' },
        { id: 'pfx', host: '*.internal.test', enabled: true, certificatePem: '', keyPem: '', pfxBase64: 'cGZ4', passphrase: 'secret' },
      ],
    }].map((certificates) => expect.objectContaining({ certificates }))));
    const states = Object.values(migrated.fileState);
    expect(states.every((state) => state.cookies[0]?.value === 'legacy')).toBe(true);
    states[0].cookies[0].value = 'changed';
    expect(states[1].cookies[0].value).toBe('legacy');
  });

  it('preserves normalized v43 file state while ignoring legacy project-global values', () => {
    const workspace = cloneSeedWorkspace();
    const fileId = workspace.collections[1].id;
    workspace.cookies = [{ id: 'legacy', name: 'legacy', value: 'ignored', domain: 'legacy.test', path: '/', secure: false, httpOnly: false, sameSite: '', hostOnly: true, createdAt: '' }];
    workspace.certificates = { ca: { enabled: true, pem: 'legacy-ca' }, clients: [] };
    workspace.fileState[fileId] = {
      cookies: [{ id: 'owned', name: 'owned', value: 'kept', domain: 'owned.test', path: '/', secure: true, httpOnly: true, sameSite: 'strict', hostOnly: true, createdAt: '2026-07-20T00:00:00.000Z' }],
      certificates: { ca: { enabled: true, pem: 'owned-ca' }, clients: [] },
    };

    const migrated = migrateWorkspace(workspace);
    expect(migrated.cookies).toEqual([]);
    expect(migrated.certificates).toEqual({ ca: { enabled: false, pem: '' }, clients: [] });
    expect(migrated.fileState[fileId]).toMatchObject({ cookies: [expect.objectContaining({ name: 'owned', value: 'kept' })], certificates: { ca: { enabled: true, pem: 'owned-ca' } } });
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

  it('normalizes imported SSE reconnect controls', () => {
    const workspace = cloneSeedWorkspace() as unknown as Record<string, unknown>;
    const first = (workspace.collections as Array<{ requests: Array<Record<string, unknown>> }>)[0].requests[0];
    first.sse = {
      autoReconnect: false,
      reconnectDelayMs: 90_000,
      maxReconnects: -20,
      respectServerRetry: false,
      sendLastEventId: false,
    };

    const migrated = migrateWorkspace(workspace);
    expect(migrated.collections[0].requests[0].sse).toEqual({
      autoReconnect: false,
      reconnectDelayMs: 60_000,
      maxReconnects: 0,
      respectServerRetry: false,
      sendLastEventId: false,
    });
  });

  it('bounds per-request response filters and discards stale request metadata', () => {
    const workspace = cloneSeedWorkspace();
    const requestId = workspace.collections[0].requests[0].id;
    const secondRequestId = workspace.collections[0].requests[1].id;
    workspace.responseFilters = {
      [requestId]: { filter: `  ${'$'.repeat(2_100)}  `, history: [' $.items[*] ', '$.items[*]', ...Array.from({ length: 15 }, (_, index) => `$.item${index}`)], previewMode: 'raw' },
      [secondRequestId]: { filter: '', history: [], previewMode: 'invalid' as 'source' },
      missing: { filter: '$.secret', history: ['$.secret'], previewMode: 'friendly' },
    };

    const migrated = migrateWorkspace(workspace);
    expect(migrated.responseFilters?.[requestId].filter).toHaveLength(2_000);
    expect(migrated.responseFilters?.[requestId].history).toHaveLength(10);
    expect(migrated.responseFilters?.[requestId].history[0]).toBe('$.items[*]');
    expect(migrated.responseFilters?.[requestId].previewMode).toBe('raw');
    expect(migrated.responseFilters?.[secondRequestId].previewMode).toBe('source');
    expect(migrated.responseFilters?.missing).toBeUndefined();
  });

  it('normalizes collection sub-environments and repairs a stale selection', () => {
    const workspace = cloneSeedWorkspace() as unknown as Record<string, unknown>;
    const collection = (workspace.collections as Array<Record<string, unknown>>)[0];
    collection.environmentEditorMode = 'raw';
    collection.environment = [{ id: 'config', name: 'config', value: '{"region":"us"}', valueType: 'json', enabled: true }];
    collection.subEnvironments = [{ id: 'staging', name: 'Staging', environmentEditorMode: 'raw', variables: [{ name: 'host', value: 'staging.example', enabled: true }] }, null];
    collection.activeSubEnvironmentId = 'missing';
    collection.folders = [{ id: 'folder', name: 'Folder', parentId: '', expanded: true, headers: [], environment: [], preRequestScript: '', tests: '', documentation: '' }];
    const folder = ((collection.folders as Array<Record<string, unknown>>)[0]);
    folder.environmentEditorMode = 'raw';
    folder.environment = [{ id: 'folder-config', name: 'folderConfig', value: '[1,2]', valueType: 'json', enabled: true }];
    const environments = workspace.environments as Array<Record<string, unknown>>;
    environments[0].environmentEditorMode = 'raw';
    (environments[0].variables as Array<Record<string, unknown>>).push({ id: 'global-config', name: 'globalConfig', value: '{"enabled":true}', valueType: 'json', enabled: true });
    const migrated = migrateWorkspace(workspace);
    expect(migrated.version).toBe(48);
    expect(migrated.collections[0]).toMatchObject({ environmentEditorMode: 'raw', environment: [expect.objectContaining({ name: 'config', valueType: 'json' })] });
    expect(migrated.collections[0].subEnvironments).toEqual([{ id: 'staging', name: 'Staging', environmentEditorMode: 'raw', variables: [{ id: 'staging-variable-0', name: 'host', value: 'staging.example', enabled: true, description: '' }] }]);
    expect(migrated.collections[0].activeSubEnvironmentId).toBe('');
    expect(migrated.collections[0].folders?.[0]).toMatchObject({ environmentEditorMode: 'raw', environment: [expect.objectContaining({ name: 'folderConfig', valueType: 'json' })] });
    expect(migrated.environments[0]).toMatchObject({ environmentEditorMode: 'raw', variables: expect.arrayContaining([expect.objectContaining({ name: 'globalConfig', valueType: 'json' })]) });
  });

  it('sanitizes resource ordering while retaining every valid resource once', () => {
    const workspace = cloneSeedWorkspace() as unknown as Record<string, unknown>;
    const collection = (workspace.collections as Array<Record<string, unknown>>)[0];
    const requests = collection.requests as Array<Record<string, unknown>>;
    collection.folders = [{ id: 'folder', name: 'Folder', parentId: '', expanded: true, headers: [], environment: [], preRequestScript: '', tests: '', documentation: '', source: { format: 'konnect-route-folder', sourceId: 'route-one:route' } }];
    collection.resourceOrder = [requests[1].id, 'missing', 'folder', requests[1].id, 42];
    const migrated = migrateWorkspace(workspace);
    const order = migrated.collections[0].resourceOrder ?? [];
    expect(order.slice(0, 2)).toEqual([requests[1].id, 'folder']);
    expect(new Set(order).size).toBe(order.length);
    expect(order).toHaveLength(requests.length + 1);
    expect(migrated.collections[0].folders?.[0].source).toEqual({ format: 'konnect-route-folder', sourceId: 'route-one:route' });
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

  it('bounds and validates persisted Konnect proxy URLs', () => {
    const workspace = cloneSeedWorkspace() as unknown as Record<string, unknown>;
    workspace.konnect = {
      enabled: true,
      baseUrl: 'https://us.api.konghq.com',
      token: '',
      controlPlaneId: 'cp-one',
      controlPlanes: [{
        id: 'cp-one',
        name: 'Gateway',
        proxy_urls: [
          { host: 'gateway.example.com', port: 443, protocol: 'HTTPS' },
          { host: '{{ vault.host }}', port: 443, protocol: 'https' },
          { host: 'bad.example.com/path', port: 443, protocol: 'https' },
          { host: 'bad.example.com:443', port: 443, protocol: 'https' },
          { host: 'grpc.example.com', port: 70_000, protocol: 'grpc' },
          { host: 'tcp.example.com', port: 9000, protocol: 'tcp' },
        ],
      }],
    };

    expect(migrateWorkspace(workspace).konnect.controlPlanes[0].proxyUrls).toEqual([
      { host: 'gateway.example.com', port: 443, protocol: 'https' },
    ]);
  });

  it('rejects unrelated JSON', () => {
    expect(() => migrateWorkspace({ hello: 'world' })).toThrow('not a Brunomnia');
  });

  it('normalizes legacy MCP resource templates with derived variables', () => {
    const workspace = cloneSeedWorkspace() as unknown as Record<string, unknown>;
    workspace.mcpClients = [{
      id: 'template-client', name: 'Templates', enabled: false, transport: 'http', url: 'https://mcp.example', authType: 'none',
      env: [{ id: 'stdio-env', name: 'MODE', value: 'review', enabled: false }],
      resourceTemplates: [{ name: 'Search', uriTemplate: 'files://{/path}{?query,limit}', description: 'Search files' }],
    }];

    const migrated = migrateWorkspace(workspace);
    expect(migrated.version).toBe(48);
    expect(migrated.mcpClients[0].env).toEqual([{ id: 'stdio-env', name: 'MODE', value: 'review', enabled: false, description: '' }]);
    expect(migrated.mcpClients[0].resourceTemplates[0]).toMatchObject({
      uri: 'files://{/path}{?query,limit}',
      uriTemplate: 'files://{/path}{?query,limit}',
      variables: ['path', 'query', 'limit'],
      name: 'Search',
    });
  });

  it('disables imported plugin code and clears inherited authority', () => {
    const exported = cloneSeedWorkspace();
    exported.plugins = [{
      id: 'plugin-one', name: 'Imported', version: '1.0.0', description: '', source: "require('events'); module.exports = {};", sourceFormat: 'insomnia-commonjs', enabled: true,
      registryPackageName: 'insomnia-plugin-imported',
      requestedModules: ['node:events'], grantedModules: ['node:events'],
      requestedPermissions: ['network'], grantedPermissions: ['network'], installedAt: new Date().toISOString(),
    }];
    exported.pluginData = { 'plugin-one': { token: 'secret' } };
    exported.activePluginTheme = 'plugin-one::theme:0';
    exported.mcpClients = [{
      id: 'mcp-one', name: 'Imported MCP', enabled: true, transport: 'http', url: 'https://mcp.example', command: '', args: [], env: [{ id: 'mode', name: 'MODE', value: 'review', enabled: true }], headers: [], authType: 'oauth2', token: 'raw-token', username: '', password: 'raw-password', oauthAuthorizationUrl: 'https://identity.example/authorize', oauthAccessTokenUrl: 'https://identity.example/token', oauthClientId: 'client', oauthClientSecret: 'raw-client-secret', oauthScope: 'mcp', oauthState: 'state', oauthRefreshToken: 'raw-refresh', oauthIdentityToken: 'raw-identity', oauthExpiresAt: 123, oauthTokenPrefix: 'DPoP', oauthRegisteredClientId: 'registered-client', oauthRegisteredClientSecret: 'registered-secret', oauthRegisteredClientIdIssuedAt: 11, oauthRegisteredClientSecretExpiresAt: 22, oauthRegisteredTokenEndpointAuthMethod: 'client_secret_basic', roots: [], tools: [], prompts: [], resources: [], resourceTemplates: [],
    }];
    exported.ai = { ...exported.ai, enabled: true, apiKey: 'raw-ai-key', mockGeneration: true, commitSuggestions: true };
    exported.konnect = { ...exported.konnect, enabled: true, token: 'raw-konnect-token', managedByWorkspaceId: 'coordinator', managedControlPlaneId: 'cp-one', managedRegion: 'us', managedClusterType: 'CLUSTER_TYPE_CONTROL_PLANE', managedDeploymentType: 'dedicatedCloud' };
    exported.preferences = { ...exported.preferences, theme: 'light', fontSize: 22, interfaceFontSize: 21, fontInterface: 'Imported UI', fontMonospace: 'Imported Mono', showPasswords: true, allowHtmlPreviewRemoteResources: true, allowHtmlPreviewScripts: true, disableResponsePreviewLinks: true, preferredHttpVersion: 'http2-prior-knowledge', maxRedirects: -1, followRedirects: false, maxTimelineDataSizeKB: 99, maxHistoryResponses: -1, filterResponsesByEnv: true, requestTimeoutMs: 123_000, allowScriptRequests: true, allowScriptFileAccess: true, dataFolders: ['/private/imported-authority'], enableVaultInScripts: true, forceVerticalLayout: true, editorIndentWithTabs: false, editorIndentSize: 8, editorLineWrapping: false, fontVariantLigatures: true };

    const imported = parseWorkspaceImport(JSON.stringify(exported));
    expect(imported.plugins[0]).toMatchObject({ registryPackageName: 'insomnia-plugin-imported', enabled: false, grantedPermissions: [], requestedModules: ['events'], grantedModules: [] });
    expect(imported.pluginData).toEqual({});
    expect(imported.activePluginTheme).toBe('');
    expect(imported.mcpClients[0]).toMatchObject({ enabled: false, token: '', password: '', oauthClientSecret: '', oauthRefreshToken: '', oauthIdentityToken: '', oauthExpiresAt: 0, oauthRegisteredClientId: '', oauthRegisteredClientSecret: '', oauthRegisteredClientIdIssuedAt: 0, oauthRegisteredClientSecretExpiresAt: 0, oauthRegisteredTokenEndpointAuthMethod: 'none' });
    expect(imported.mcpClients[0].env).toEqual([{ id: 'mode', name: 'MODE', value: 'review', enabled: true, description: '' }]);
    expect(imported.ai).toMatchObject({ enabled: false, apiKey: '', mockGeneration: false, commitSuggestions: false });
    expect(imported.konnect).toMatchObject({ enabled: false, token: '' });
    expect(imported.konnect.managedControlPlaneId).toBeUndefined();
    expect(imported.preferences).toMatchObject({ theme: 'system', preferredHttpVersion: 'default', maxRedirects: 10, followRedirects: true, maxTimelineDataSizeKB: 10, maxHistoryResponses: 20, filterResponsesByEnv: false, requestTimeoutMs: 30_000, validateCertificates: true, validateAuthCertificates: true, proxyEnabled: false, httpProxy: '', httpsProxy: '', noProxy: '', allowScriptRequests: false, allowScriptFileAccess: false, dataFolders: [], enableVaultInScripts: false });
    expect(imported.preferences).toMatchObject({ useBulkHeaderEditor: false, useBulkParametersEditor: false });
    expect(imported.preferences).toMatchObject({ forceVerticalLayout: false, editorIndentWithTabs: true, editorIndentSize: 2, editorLineWrapping: true, fontVariantLigatures: false });
    expect(imported.preferences).toMatchObject({ fontSize: 11, interfaceFontSize: 13, fontInterface: '', fontMonospace: '', showPasswords: false, allowHtmlPreviewRemoteResources: false, allowHtmlPreviewScripts: false, disableResponsePreviewLinks: false });
  });

  it('retains bounded multi-file plugin package maps', () => {
    const exported = cloneSeedWorkspace();
    exported.plugins = [{
      id: 'plugin-package', name: 'Package', version: '1.0.0', description: '', source: `module.exports = require('./lib/value');`, sourcePath: '/plugins/package', registryPackageName: 'insomnia-plugin-package',
      moduleFiles: { 'index.js': `module.exports = require('./lib/value');`, 'lib/value.js': 'module.exports = {};', '../escape.js': 'unsafe' }, entryModuleKey: 'index.js',
      dependencyModuleFiles: { 'node_modules/left-pad/package.json': '{"name":"left-pad"}', 'node_modules/left-pad/index.js': 'module.exports = true;', '../dependency-escape.js': 'unsafe' },
      dependencyPackages: { 'left-pad': { version: '1.3.0', entryModuleKey: 'node_modules/left-pad/index.js' }, '../unsafe': { version: '1.0.0', entryModuleKey: '../dependency-escape.js' } },
      sourceFormat: 'insomnia-commonjs', enabled: false, requestedPermissions: [], grantedPermissions: [], installedAt: '2026-07-20T00:00:00.000Z',
    }];
    const imported = migrateWorkspace(exported);
    expect(imported.plugins[0]).toMatchObject({ registryPackageName: 'insomnia-plugin-package', entryModuleKey: 'index.js', moduleFiles: { 'index.js': expect.any(String), 'lib/value.js': 'module.exports = {};' }, dependencyPackages: { 'left-pad': { version: '1.3.0', entryModuleKey: 'node_modules/left-pad/index.js' } }, dependencyModuleFiles: { 'node_modules/left-pad/index.js': 'module.exports = true;' } });
    expect(imported.plugins[0].moduleFiles).not.toHaveProperty('../escape.js');
    expect(imported.plugins[0].dependencyPackages).not.toHaveProperty('../unsafe');
    expect(imported.plugins[0].dependencyModuleFiles).not.toHaveProperty('../dependency-escape.js');
    exported.plugins[0].registryPackageName = '../unsafe';
    expect(migrateWorkspace(exported).plugins[0].registryPackageName).toBeUndefined();
  });

  it('normalizes inferred and manifest module requests while constraining grants', () => {
    const exported = cloneSeedWorkspace();
    exported.plugins = [{
      id: 'plugin-modules', name: 'Modules', version: '1.0.0', description: '', source: "require('node:events'); require('uuid'); module.exports = {};",
      requestedModules: ['node:events', 'ajv', 'uuid'], grantedModules: ['node:events', 'uuid', 'fs'], moduleWarnings: ['', 'manifest warning'],
      sourceFormat: 'insomnia-commonjs', enabled: false, requestedPermissions: [], grantedPermissions: [], installedAt: '2026-07-20T00:00:00.000Z',
    }];
    const imported = migrateWorkspace(exported);
    expect(imported.plugins[0]).toMatchObject({ requestedModules: ['events', 'ajv', 'uuid'], grantedModules: ['events', 'uuid'], moduleWarnings: ['manifest warning'] });
  });

  it('normalizes preference bounds and shortcut values', () => {
    const workspace = cloneSeedWorkspace() as unknown as Record<string, unknown>;
    workspace.preferences = { theme: 'unknown', density: 'compact', fontSize: 99, interfaceFontSize: 2, fontInterface: 'Fancy\nUI', fontMonospace: 42, showPasswords: 'yes', allowHtmlPreviewRemoteResources: 'yes', allowHtmlPreviewScripts: 'yes', disableResponsePreviewLinks: 'yes', preferredHttpVersion: 'http3', maxRedirects: -99.8, followRedirects: 'sometimes', maxTimelineDataSizeKB: -400.2, maxHistoryResponses: -400.2, filterResponsesByEnv: 'yes', requestTimeoutMs: 1, validateCertificates: false, validateAuthCertificates: 'no', proxyEnabled: 'yes', httpProxy: 42, httpsProxy: false, noProxy: null, forceVerticalLayout: 'yes', editorIndentWithTabs: 0, editorIndentSize: 999, editorLineWrapping: null, fontVariantLigatures: 1, scriptTimeoutMs: 999_999, allowScriptRequests: 'yes', allowScriptFileAccess: 'yes', dataFolders: [' /tmp/fixtures ', '/tmp/fixtures', 42, '', 'x'.repeat(5_000)], enableVaultInScripts: 1, shortcuts: { palette: ' mod + shift + p ', send: 42 } };
    const migrated = migrateWorkspace(workspace);
    expect(migrated.preferences).toMatchObject({ theme: 'system', density: 'compact', fontSize: 24, interfaceFontSize: 8, fontInterface: 'Fancy UI', fontMonospace: '', showPasswords: false, allowHtmlPreviewRemoteResources: true, allowHtmlPreviewScripts: true, disableResponsePreviewLinks: false, preferredHttpVersion: 'default', maxRedirects: -1, followRedirects: true, maxTimelineDataSizeKB: 0, maxHistoryResponses: -1, filterResponsesByEnv: false, requestTimeoutMs: 1, validateCertificates: false, validateAuthCertificates: true, proxyEnabled: false, httpProxy: '', httpsProxy: '', noProxy: '', pluginRegistryUrl: 'https://registry.npmjs.org/', scriptTimeoutMs: 60_000, allowScriptRequests: false, allowScriptFileAccess: false, enableVaultInScripts: false });
    expect(migrated.preferences).toMatchObject({ useBulkHeaderEditor: false, useBulkParametersEditor: false });
    expect(migrated.preferences).toMatchObject({ forceVerticalLayout: false, editorIndentWithTabs: true, editorIndentSize: 16, editorLineWrapping: true, fontVariantLigatures: false });
    expect(migrated.preferences.dataFolders).toEqual(['/tmp/fixtures', 'x'.repeat(4_096)]);
    expect(migrated.preferences.shortcuts.palette).toEqual(['Mod+Shift+P']);
    expect(migrated.preferences.shortcuts.send).toEqual(['Mod+Enter', 'Mod+R', 'F5']);
  });

  it('migrates bounded multi-bindings and preserves explicitly cleared shortcuts', () => {
    const workspace = cloneSeedWorkspace() as unknown as Record<string, unknown>;
    workspace.preferences = {
      ...(workspace.preferences as Record<string, unknown>),
      shortcuts: {
        palette: [' mod + shift + p ', 'F5', 'F5', 42, ...Array.from({ length: 10 }, (_, index) => `Alt+${index}`)],
        send: '',
      },
    };
    const migrated = migrateWorkspace(workspace);
    expect(migrated.preferences.shortcuts.palette).toEqual(['Mod+Shift+P', 'F5', 'Alt+0', 'Alt+1', 'Alt+2', 'Alt+3', 'Alt+4', 'Alt+5']);
    expect(migrated.preferences.shortcuts.send).toEqual([]);
    expect(migrated.preferences.shortcuts['close-tab']).toEqual(['Mod+W']);
  });

  it('splits the legacy create request binding from the new create menu', () => {
    const workspace = cloneSeedWorkspace() as unknown as { version: number; preferences: { shortcuts: Record<string, unknown> } };
    workspace.version = 47;
    workspace.preferences.shortcuts['new-request'] = ['Mod+N'];
    delete workspace.preferences.shortcuts['create-menu'];
    const migrated = migrateWorkspace(workspace);
    expect(migrated.version).toBe(48);
    expect(migrated.preferences.shortcuts['create-menu']).toEqual(['Mod+N']);
    expect(migrated.preferences.shortcuts['new-request']).toEqual(['Mod+Alt+N']);
  });

  it('preserves supported device-local preferences', () => {
    const workspace = cloneSeedWorkspace();
    workspace.preferences.preferredHttpVersion = 'http2-prior-knowledge';
    workspace.preferences.maxRedirects = -1;
    workspace.preferences.followRedirects = false;
    workspace.preferences.maxTimelineDataSizeKB = 77;
    workspace.preferences.maxHistoryResponses = -1;
    workspace.preferences.filterResponsesByEnv = true;
    workspace.preferences.validateCertificates = false;
    workspace.preferences.validateAuthCertificates = false;
    workspace.preferences.clearOAuth2SessionOnRestart = true;
    workspace.preferences.proxyEnabled = true;
    workspace.preferences.httpProxy = 'http://http-proxy.test:8080';
    workspace.preferences.httpsProxy = 'http://https-proxy.test:8443';
    workspace.preferences.noProxy = 'localhost,.internal';
    workspace.preferences.pluginRegistryUrl = 'https://registry.example.test/npm/';
    workspace.preferences.useBulkHeaderEditor = true;
    workspace.preferences.useBulkParametersEditor = true;
    workspace.preferences.forceVerticalLayout = true;
    workspace.preferences.editorIndentWithTabs = false;
    workspace.preferences.editorIndentSize = 8;
    workspace.preferences.editorLineWrapping = false;
    workspace.preferences.fontVariantLigatures = true;
    workspace.preferences.fontSize = 18;
    workspace.preferences.interfaceFontSize = 17;
    workspace.preferences.fontInterface = 'Avenir Next, sans-serif';
    workspace.preferences.fontMonospace = 'JetBrains Mono, monospace';
    workspace.preferences.showPasswords = true;
    workspace.preferences.allowHtmlPreviewRemoteResources = true;
    workspace.preferences.allowHtmlPreviewScripts = true;
    workspace.preferences.disableResponsePreviewLinks = true;
    workspace.preferences.dataFolders = ['/Users/example/fixtures', '/Volumes/shared/data'];
    expect(migrateWorkspace(workspace).preferences).toMatchObject({ preferredHttpVersion: 'http2-prior-knowledge', maxRedirects: -1, followRedirects: false, maxTimelineDataSizeKB: 77, maxHistoryResponses: -1, filterResponsesByEnv: true, validateCertificates: false, validateAuthCertificates: false, clearOAuth2SessionOnRestart: true, proxyEnabled: true, httpProxy: 'http://http-proxy.test:8080', httpsProxy: 'http://https-proxy.test:8443', noProxy: 'localhost,.internal', pluginRegistryUrl: 'https://registry.example.test/npm/', useBulkHeaderEditor: true, useBulkParametersEditor: true, forceVerticalLayout: true, editorIndentWithTabs: false, editorIndentSize: 8, editorLineWrapping: false, fontVariantLigatures: true, fontSize: 18, interfaceFontSize: 17, fontInterface: 'Avenir Next, sans-serif', fontMonospace: 'JetBrains Mono, monospace', showPasswords: true, allowHtmlPreviewRemoteResources: true, allowHtmlPreviewScripts: true, disableResponsePreviewLinks: true, dataFolders: ['/Users/example/fixtures', '/Volumes/shared/data'] });
  });

  it('migrates legacy redirect booleans and preserves supported three-state overrides', () => {
    const workspace = cloneSeedWorkspace() as unknown as Record<string, unknown>;
    const requests = (workspace.collections as Array<{ requests: Array<{ transport: Record<string, unknown> }> }>)[0].requests;
    delete requests[0].transport.followRedirectsMode;
    requests[0].transport.followRedirects = false;
    requests[1].transport.followRedirectsMode = 'on';
    requests[1].transport.followRedirects = false;
    requests[2].transport.followRedirectsMode = 'global';

    const migrated = migrateWorkspace(workspace);
    expect(migrated.collections[0].requests[0].transport).toMatchObject({ followRedirects: false, followRedirectsMode: 'off' });
    expect(migrated.collections[0].requests[1].transport).toMatchObject({ followRedirects: true, followRedirectsMode: 'on' });
    expect(migrated.collections[0].requests[2].transport).toMatchObject({ followRedirects: true, followRedirectsMode: 'global' });
  });

  it('preserves legacy saved timeouts as custom overrides and keeps explicit inheritance', () => {
    const workspace = cloneSeedWorkspace() as unknown as Record<string, unknown>;
    const requests = (workspace.collections as Array<{ requests: Array<{ transport: Record<string, unknown> }> }>)[0].requests;
    delete requests[0].transport.timeoutMode;
    requests[0].transport.timeoutMs = 12_345;
    requests[1].transport.timeoutMode = 'global';

    const migrated = migrateWorkspace(workspace);
    expect(migrated.collections[0].requests[0].transport).toMatchObject({ timeoutMode: 'custom', timeoutMs: 12_345 });
    expect(migrated.collections[0].requests[1].transport.timeoutMode).toBe('global');
  });

  it('preserves legacy certificate choices as explicit modes and keeps inheritance', () => {
    const workspace = cloneSeedWorkspace() as unknown as Record<string, unknown>;
    const requests = (workspace.collections as Array<{ requests: Array<{ transport: Record<string, unknown> }> }>)[0].requests;
    delete requests[0].transport.validateCertificatesMode;
    requests[0].transport.validateCertificates = false;
    delete requests[1].transport.validateCertificatesMode;
    requests[1].transport.validateCertificates = true;
    requests[2].transport.validateCertificatesMode = 'global';

    const migrated = migrateWorkspace(workspace);
    expect(migrated.collections[0].requests[0].transport).toMatchObject({ validateCertificates: false, validateCertificatesMode: 'off' });
    expect(migrated.collections[0].requests[1].transport).toMatchObject({ validateCertificates: true, validateCertificatesMode: 'on' });
    expect(migrated.collections[0].requests[2].transport.validateCertificatesMode).toBe('global');
  });

  it('preserves legacy request proxies as custom and keeps empty requests inherited', () => {
    const workspace = cloneSeedWorkspace() as unknown as Record<string, unknown>;
    const requests = (workspace.collections as Array<{ requests: Array<{ transport: Record<string, unknown> }> }>)[0].requests;
    delete requests[0].transport.proxyMode;
    requests[0].transport.proxyUrl = 'http://legacy-proxy.test:8080';
    requests[0].transport.proxyExclusions = 'localhost';
    delete requests[1].transport.proxyMode;
    requests[1].transport.proxyUrl = '';
    requests[1].transport.proxyExclusions = '';
    requests[2].transport.proxyMode = 'disabled';

    const migrated = migrateWorkspace(workspace);
    expect(migrated.collections[0].requests[0].transport).toMatchObject({ proxyMode: 'custom', proxyUrl: 'http://legacy-proxy.test:8080', proxyExclusions: 'localhost' });
    expect(migrated.collections[0].requests[1].transport.proxyMode).toBe('global');
    expect(migrated.collections[0].requests[2].transport.proxyMode).toBe('disabled');
  });

  it('adds stable local identity fields to legacy stored responses', () => {
    const workspace = cloneSeedWorkspace() as unknown as Record<string, unknown>;
    const requestSnapshot = cloneSeedWorkspace().collections[0].requests[0];
    workspace.responses = [{ requestId: 'request', requestName: 'Legacy', requestUrl: 'https://example.test', requestSnapshot, receivedAt: '2026-07-17T00:00:00.000Z', status: 200, statusText: 'OK', headers: {}, body: '', durationMs: 1, sizeBytes: 0, timeline: [{ name: 'DataOut', value: '(12 KiB hidden)', elapsedMs: -3, hidden: true }, { name: 'HeaderOut', value: 'GET / HTTP/1.1', elapsedMs: 1 }, null], requestTestResults: [{ name: 'status is 200', passed: true }, { name: 'production only', passed: false, status: 'skipped', category: 'after-response', durationMs: 1.25 }, null], settingSendCookies: false, settingStoreCookies: true, globalEnvironmentId: 'global', collectionEnvironmentId: 'collection-env' }];

    expect(migrateWorkspace(workspace).responses[0]).toMatchObject({ id: 'legacy-response-0', environmentId: '', requestId: 'request', timeline: [{ name: 'DataOut', value: '(12 KiB hidden)', elapsedMs: 0, hidden: true }, { name: 'HeaderOut', value: 'GET / HTTP/1.1', elapsedMs: 1 }], requestTestResults: [{ name: 'status is 200', passed: true, status: 'passed', category: 'unknown' }, { name: 'production only', passed: false, status: 'skipped', category: 'after-response', durationMs: 1.25 }], settingSendCookies: false, settingStoreCookies: true, globalEnvironmentId: 'global', collectionEnvironmentId: 'collection-env' });
    expect(migrateWorkspace(workspace).responses[0].requestSnapshot?.url).toBe(requestSnapshot.url);
  });

  it('preserves optional exact response bytes and rejects non-string containers', () => {
    const workspace = cloneSeedWorkspace() as unknown as Record<string, unknown>;
    workspace.responses = [
      { id: 'binary', requestId: 'request', requestName: 'Binary', requestUrl: 'https://example.test/file', environmentId: '', receivedAt: '2026-07-17T00:00:00.000Z', status: 200, statusText: 'OK', headers: {}, body: 'f�o', bodyBase64: 'ZoBv', durationMs: 1, sizeBytes: 3, wireSizeBytes: 2 },
      { id: 'invalid', requestId: 'request', requestName: 'Invalid', requestUrl: 'https://example.test/file', environmentId: '', receivedAt: '2026-07-17T00:00:01.000Z', status: 200, statusText: 'OK', headers: {}, body: 'safe', bodyBase64: { bytes: [] }, durationMs: 1, sizeBytes: 4 },
    ];

    const responses = migrateWorkspace(workspace).responses;
    expect(responses[0]).toMatchObject({ id: 'binary', body: 'f�o', bodyBase64: 'ZoBv', wireSizeBytes: 2 });
    expect(responses[1]).not.toHaveProperty('bodyBase64');
  });

  it('normalizes bounded stream session history and removes orphaned requests', () => {
    const workspace = cloneSeedWorkspace() as unknown as Record<string, unknown>;
    const requestSnapshot = structuredClone(((workspace.collections as Array<{ requests: Array<Record<string, unknown>> }>)[0].requests)[0]);
    const requestId = String(requestSnapshot.id);
    workspace.streamSessions = [
      { requestId, requestName: 'Socket events', requestUrl: 'https://example.test/events', environmentId: 'environment', protocol: 'socketio', startedAt: '2026-07-18T00:00:00.000Z', messages: [{ direction: 'incoming', kind: 'order.created', text: '{"id":42}', timestamp: '2026-07-18T00:00:01.000Z' }, null], requestSnapshot, status: 101.9, statusText: 'Switching Protocols', headers: { upgrade: 'websocket' }, httpVersion: 'HTTP/1.1', durationMs: 42.8, transport: 'WebSocket', timeline: [{ name: 'Text', value: 'Connected', elapsedMs: 42 }] },
      { id: 'graphql', requestId, requestName: 'GraphQL events', requestUrl: 'https://example.test/graphql', environmentId: 'environment', protocol: 'graphql', startedAt: '2026-07-18T00:00:02.000Z', messages: [] },
      { id: 'orphan', requestId: 'missing', protocol: 'sse', messages: [] },
    ];

    expect(migrateWorkspace(workspace).streamSessions).toEqual([{
      id: 'legacy-stream-0',
      requestId,
      requestName: 'Socket events',
      requestUrl: 'https://example.test/events',
      environmentId: 'environment',
      protocol: 'socketio',
      startedAt: '2026-07-18T00:00:00.000Z',
      messages: [{ id: 'legacy-stream-0-event-0', sessionId: 'legacy-stream-0', direction: 'incoming', kind: 'order.created', text: '{"id":42}', timestamp: '2026-07-18T00:00:01.000Z' }],
      requestSnapshot,
      status: 101,
      statusText: 'Switching Protocols',
      headers: { upgrade: 'websocket' },
      httpVersion: 'HTTP/1.1',
      durationMs: 42,
      transport: 'WebSocket',
      timeline: [{ name: 'Text', value: 'Connected', elapsedMs: 42 }],
    }, {
      id: 'graphql',
      requestId,
      requestName: 'GraphQL events',
      requestUrl: 'https://example.test/graphql',
      environmentId: 'environment',
      protocol: 'graphql',
      startedAt: '2026-07-18T00:00:02.000Z',
      messages: [],
    }]);
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
