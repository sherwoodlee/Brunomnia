import { beforeEach, describe, expect, it } from 'vitest';
import { cloneSeedWorkspace } from '../data/seed';
import { migrateWorkspace, parseWorkspaceImport } from './storage';
import { createBlankWorkspace, createCatalogWorkspace, createWorkspaceDuplicate, deleteCatalogWorkspace, listDeletedCatalogWorkspaces, loadWorkspaceCatalog, openCatalogWorkspace, readCatalogWorkspace, renameCatalogWorkspace, reorderCatalogWorkspace, restoreCatalogWorkspaceBackup, restoreDeletedCatalogWorkspace, saveCatalogWorkspace } from './workspaceCatalog';

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

  it('migrates the legacy browser workspace and manages project lifecycle', async () => {
    localStorage.setItem('brunomnia.workspace.v1', JSON.stringify({ ...cloneSeedWorkspace(), name: 'Legacy' }));
    const migrated = await loadWorkspaceCatalog();
    expect(migrated).toMatchObject({ activeWorkspaceId: 'local-workspace', workspace: { name: 'Legacy' } });

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
    expect(duplicate.collaboration).toMatchObject({ mode: 'off', path: '', revision: 0 });

    const copied = await createCatalogWorkspace(duplicate, 'second-copy');
    expect(copied.activeWorkspaceId).toBe('second-copy');
    expect(copied.entries.map((entry) => entry.id)).toEqual(['third', initial.activeWorkspaceId, 'second', 'second-copy']);
  });

  it('lists deleted projects and restores a valid browser backup', async () => {
    await loadWorkspaceCatalog();
    const created = await createCatalogWorkspace(createBlankWorkspace('Second', cloneSeedWorkspace().preferences), 'second');
    await saveCatalogWorkspace('second', { ...created.workspace, name: 'Saved' });
    localStorage.setItem('brunomnia.project.second.v1', '{ broken');

    await deleteCatalogWorkspace('second');
    const deleted = await listDeletedCatalogWorkspaces();
    expect(deleted).toHaveLength(1);
    expect(deleted[0]).toMatchObject({ workspaceId: 'second', name: 'Second', status: 'recoverable', hasBackup: true, hasVault: false });

    const restored = await restoreDeletedCatalogWorkspace('second', deleted[0].deletedAt);
    expect(restored.activeWorkspaceId).toBe('second');
    expect(restored.workspace.name).toBe('Second');
    expect(restored.entries).toHaveLength(2);
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
  it('upgrades v1 requests with protocol defaults without changing request identity', () => {
    const legacy = cloneSeedWorkspace() as unknown as Record<string, unknown>;
    legacy.version = 1;
    const collections = legacy.collections as Array<{ requests: Array<Record<string, unknown>> }>;
    const first = collections[0].requests[0];
    (first.auth as Record<string, unknown>).expiresAt = 'invalid';
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
    expect(migrated.version).toBe(33);
    expect(migrated.collections[0].requests[0]).toMatchObject({ id: first.id, protocol: 'http', bodyMode: 'none' });
    expect(migrated.collections[0].requests[0].renderBodyTemplates).toBe(true);
    expect(migrated.collections[0].requests[0].pathParams).toEqual([]);
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
    expect(migrated.responseFilters).toEqual({});
    expect(migrated.mcpClients).toEqual([]);
    expect(migrated.ai.enabled).toBe(false);
    expect(migrated.konnect.baseUrl).toBe('https://us.api.konghq.com');
    expect(migrated.preferences).toMatchObject({ theme: 'system', preferredHttpVersion: 'default', maxRedirects: 10, followRedirects: true, maxTimelineDataSizeKB: 10, maxHistoryResponses: 20, filterResponsesByEnv: false, requestTimeoutMs: 30_000, validateCertificates: true, validateAuthCertificates: true, proxyEnabled: false, httpProxy: '', httpsProxy: '', noProxy: '', autoFetchGraphqlSchema: true });
    expect(migrated.preferences).toMatchObject({ useBulkHeaderEditor: false, useBulkParametersEditor: false });
    expect(migrated.preferences).toMatchObject({ forceVerticalLayout: false, editorIndentWithTabs: true, editorIndentSize: 2, editorLineWrapping: true, fontVariantLigatures: false });
    expect(migrated.preferences).toMatchObject({ fontSize: 11, interfaceFontSize: 13, fontInterface: '', fontMonospace: '', showPasswords: false, allowHtmlPreviewRemoteResources: false, allowHtmlPreviewScripts: false, disableResponsePreviewLinks: false });
    expect(migrated.collections[0].requests[0].transport).toMatchObject({ followRedirects: true, followRedirectsMode: 'global', timeoutMode: 'global', validateCertificatesMode: 'global', proxyMode: 'global' });
    expect(migrated.preferences).toMatchObject({ scriptTimeoutMs: 10_000, allowScriptRequests: false, allowScriptFileAccess: false, dataFolders: [], enableVaultInScripts: false });
    expect(migrated.preferences.shortcuts['generate-code']).toBe('Mod+Shift+G');
    expect(migrated.collections[0].requests[0].graphql).toMatchObject({ schemaEndpoint: '', schemaFetchedAt: '' });
    expect(migrated.collections[0].requests[0].auth.expiresAt).toBe(0);
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
    expect(migrated.version).toBe(33);
    expect(migrated.collections[0].requests[0].renderBodyTemplates).toBe(false);
    expect(migrated.collections[0].requests[0].multipartBody).toEqual([
      expect.objectContaining({ id: 'multiline', multiline: true, contentType: '', fileName: '' }),
      expect.objectContaining({ id: 'legacy', multiline: false, contentType: '', fileName: '' }),
    ]);
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
    expect(migrated.version).toBe(33);
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
    expect(migrated.version).toBe(33);
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
    const migrated = migrateWorkspace(workspace);
    expect(migrated.version).toBe(33);
    expect(migrated.certificates).toEqual({
      ca: { enabled: true, pem: 'ca-pem' },
      clients: [
        { id: 'client', host: 'api.example.test:8443', enabled: true, certificatePem: 'cert-pem', keyPem: 'key-pem', pfxBase64: '', passphrase: '' },
        { id: 'pfx', host: '*.internal.test', enabled: true, certificatePem: '', keyPem: '', pfxBase64: 'cGZ4', passphrase: 'secret' },
      ],
    });
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
    collection.subEnvironments = [{ id: 'staging', name: 'Staging', variables: [{ name: 'host', value: 'staging.example', enabled: true }] }, null];
    collection.activeSubEnvironmentId = 'missing';
    const migrated = migrateWorkspace(workspace);
    expect(migrated.version).toBe(33);
    expect(migrated.collections[0].subEnvironments).toEqual([{ id: 'staging', name: 'Staging', variables: [{ id: 'staging-variable-0', name: 'host', value: 'staging.example', enabled: true, description: '' }] }]);
    expect(migrated.collections[0].activeSubEnvironmentId).toBe('');
  });

  it('sanitizes resource ordering while retaining every valid resource once', () => {
    const workspace = cloneSeedWorkspace() as unknown as Record<string, unknown>;
    const collection = (workspace.collections as Array<Record<string, unknown>>)[0];
    const requests = collection.requests as Array<Record<string, unknown>>;
    collection.folders = [{ id: 'folder', name: 'Folder', parentId: '', expanded: true, headers: [], environment: [], preRequestScript: '', tests: '', documentation: '' }];
    collection.resourceOrder = [requests[1].id, 'missing', 'folder', requests[1].id, 42];
    const migrated = migrateWorkspace(workspace);
    const order = migrated.collections[0].resourceOrder ?? [];
    expect(order.slice(0, 2)).toEqual([requests[1].id, 'folder']);
    expect(new Set(order).size).toBe(order.length);
    expect(order).toHaveLength(requests.length + 1);
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

  it('normalizes legacy MCP resource templates with derived variables', () => {
    const workspace = cloneSeedWorkspace() as unknown as Record<string, unknown>;
    workspace.mcpClients = [{
      id: 'template-client', name: 'Templates', enabled: false, transport: 'http', url: 'https://mcp.example', authType: 'none',
      resourceTemplates: [{ name: 'Search', uriTemplate: 'files://{/path}{?query,limit}', description: 'Search files' }],
    }];

    expect(migrateWorkspace(workspace).mcpClients[0].resourceTemplates[0]).toMatchObject({
      uri: 'files://{/path}{?query,limit}',
      uriTemplate: 'files://{/path}{?query,limit}',
      variables: ['path', 'query', 'limit'],
      name: 'Search',
    });
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
      id: 'mcp-one', name: 'Imported MCP', enabled: true, transport: 'http', url: 'https://mcp.example', command: '', args: [], headers: [], authType: 'oauth2', token: 'raw-token', username: '', password: 'raw-password', oauthAuthorizationUrl: 'https://identity.example/authorize', oauthAccessTokenUrl: 'https://identity.example/token', oauthClientId: 'client', oauthClientSecret: 'raw-client-secret', oauthScope: 'mcp', oauthState: 'state', oauthRefreshToken: 'raw-refresh', oauthIdentityToken: 'raw-identity', oauthExpiresAt: 123, oauthTokenPrefix: 'DPoP', oauthRegisteredClientId: 'registered-client', oauthRegisteredClientSecret: 'registered-secret', oauthRegisteredClientIdIssuedAt: 11, oauthRegisteredClientSecretExpiresAt: 22, oauthRegisteredTokenEndpointAuthMethod: 'client_secret_basic', roots: [], tools: [], prompts: [], resources: [], resourceTemplates: [],
    }];
    exported.ai = { ...exported.ai, enabled: true, apiKey: 'raw-ai-key', mockGeneration: true, commitSuggestions: true };
    exported.konnect = { ...exported.konnect, enabled: true, token: 'raw-konnect-token' };
    exported.preferences = { ...exported.preferences, theme: 'light', fontSize: 22, interfaceFontSize: 21, fontInterface: 'Imported UI', fontMonospace: 'Imported Mono', showPasswords: true, allowHtmlPreviewRemoteResources: true, allowHtmlPreviewScripts: true, disableResponsePreviewLinks: true, preferredHttpVersion: 'http2-prior-knowledge', maxRedirects: -1, followRedirects: false, maxTimelineDataSizeKB: 99, maxHistoryResponses: -1, filterResponsesByEnv: true, requestTimeoutMs: 123_000, allowScriptRequests: true, allowScriptFileAccess: true, dataFolders: ['/private/imported-authority'], enableVaultInScripts: true, forceVerticalLayout: true, editorIndentWithTabs: false, editorIndentSize: 8, editorLineWrapping: false, fontVariantLigatures: true };

    const imported = parseWorkspaceImport(JSON.stringify(exported));
    expect(imported.plugins[0]).toMatchObject({ enabled: false, grantedPermissions: [] });
    expect(imported.pluginData).toEqual({});
    expect(imported.activePluginTheme).toBe('');
    expect(imported.mcpClients[0]).toMatchObject({ enabled: false, token: '', password: '', oauthClientSecret: '', oauthRefreshToken: '', oauthIdentityToken: '', oauthExpiresAt: 0, oauthRegisteredClientId: '', oauthRegisteredClientSecret: '', oauthRegisteredClientIdIssuedAt: 0, oauthRegisteredClientSecretExpiresAt: 0, oauthRegisteredTokenEndpointAuthMethod: 'none' });
    expect(imported.ai).toMatchObject({ enabled: false, apiKey: '', mockGeneration: false, commitSuggestions: false });
    expect(imported.konnect).toMatchObject({ enabled: false, token: '' });
    expect(imported.preferences).toMatchObject({ theme: 'system', preferredHttpVersion: 'default', maxRedirects: 10, followRedirects: true, maxTimelineDataSizeKB: 10, maxHistoryResponses: 20, filterResponsesByEnv: false, requestTimeoutMs: 30_000, validateCertificates: true, validateAuthCertificates: true, proxyEnabled: false, httpProxy: '', httpsProxy: '', noProxy: '', allowScriptRequests: false, allowScriptFileAccess: false, dataFolders: [], enableVaultInScripts: false });
    expect(imported.preferences).toMatchObject({ useBulkHeaderEditor: false, useBulkParametersEditor: false });
    expect(imported.preferences).toMatchObject({ forceVerticalLayout: false, editorIndentWithTabs: true, editorIndentSize: 2, editorLineWrapping: true, fontVariantLigatures: false });
    expect(imported.preferences).toMatchObject({ fontSize: 11, interfaceFontSize: 13, fontInterface: '', fontMonospace: '', showPasswords: false, allowHtmlPreviewRemoteResources: false, allowHtmlPreviewScripts: false, disableResponsePreviewLinks: false });
  });

  it('normalizes preference bounds and shortcut values', () => {
    const workspace = cloneSeedWorkspace() as unknown as Record<string, unknown>;
    workspace.preferences = { theme: 'unknown', density: 'compact', fontSize: 99, interfaceFontSize: 2, fontInterface: 'Fancy\nUI', fontMonospace: 42, showPasswords: 'yes', allowHtmlPreviewRemoteResources: 'yes', allowHtmlPreviewScripts: 'yes', disableResponsePreviewLinks: 'yes', preferredHttpVersion: 'http3', maxRedirects: -99.8, followRedirects: 'sometimes', maxTimelineDataSizeKB: -400.2, maxHistoryResponses: -400.2, filterResponsesByEnv: 'yes', requestTimeoutMs: 1, validateCertificates: false, validateAuthCertificates: 'no', proxyEnabled: 'yes', httpProxy: 42, httpsProxy: false, noProxy: null, forceVerticalLayout: 'yes', editorIndentWithTabs: 0, editorIndentSize: 999, editorLineWrapping: null, fontVariantLigatures: 1, scriptTimeoutMs: 999_999, allowScriptRequests: 'yes', allowScriptFileAccess: 'yes', dataFolders: [' /tmp/fixtures ', '/tmp/fixtures', 42, '', 'x'.repeat(5_000)], enableVaultInScripts: 1, shortcuts: { palette: ' mod + shift + p ', send: 42 } };
    const migrated = migrateWorkspace(workspace);
    expect(migrated.preferences).toMatchObject({ theme: 'system', density: 'compact', fontSize: 24, interfaceFontSize: 8, fontInterface: 'Fancy UI', fontMonospace: '', showPasswords: false, allowHtmlPreviewRemoteResources: false, allowHtmlPreviewScripts: false, disableResponsePreviewLinks: false, preferredHttpVersion: 'default', maxRedirects: -1, followRedirects: true, maxTimelineDataSizeKB: 0, maxHistoryResponses: -1, filterResponsesByEnv: false, requestTimeoutMs: 1, validateCertificates: false, validateAuthCertificates: true, proxyEnabled: false, httpProxy: '', httpsProxy: '', noProxy: '', scriptTimeoutMs: 60_000, allowScriptRequests: false, allowScriptFileAccess: false, enableVaultInScripts: false });
    expect(migrated.preferences).toMatchObject({ useBulkHeaderEditor: false, useBulkParametersEditor: false });
    expect(migrated.preferences).toMatchObject({ forceVerticalLayout: false, editorIndentWithTabs: true, editorIndentSize: 16, editorLineWrapping: true, fontVariantLigatures: false });
    expect(migrated.preferences.dataFolders).toEqual(['/tmp/fixtures', 'x'.repeat(4_096)]);
    expect(migrated.preferences.shortcuts.palette).toBe('Mod+Shift+P');
    expect(migrated.preferences.shortcuts.send).toBe('Mod+Enter');
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
    workspace.preferences.proxyEnabled = true;
    workspace.preferences.httpProxy = 'http://http-proxy.test:8080';
    workspace.preferences.httpsProxy = 'http://https-proxy.test:8443';
    workspace.preferences.noProxy = 'localhost,.internal';
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
    expect(migrateWorkspace(workspace).preferences).toMatchObject({ preferredHttpVersion: 'http2-prior-knowledge', maxRedirects: -1, followRedirects: false, maxTimelineDataSizeKB: 77, maxHistoryResponses: -1, filterResponsesByEnv: true, validateCertificates: false, validateAuthCertificates: false, proxyEnabled: true, httpProxy: 'http://http-proxy.test:8080', httpsProxy: 'http://https-proxy.test:8443', noProxy: 'localhost,.internal', useBulkHeaderEditor: true, useBulkParametersEditor: true, forceVerticalLayout: true, editorIndentWithTabs: false, editorIndentSize: 8, editorLineWrapping: false, fontVariantLigatures: true, fontSize: 18, interfaceFontSize: 17, fontInterface: 'Avenir Next, sans-serif', fontMonospace: 'JetBrains Mono, monospace', showPasswords: true, allowHtmlPreviewRemoteResources: true, allowHtmlPreviewScripts: true, disableResponsePreviewLinks: true, dataFolders: ['/Users/example/fixtures', '/Volumes/shared/data'] });
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
    workspace.responses = [{ requestId: 'request', requestName: 'Legacy', requestUrl: 'https://example.test', requestSnapshot, receivedAt: '2026-07-17T00:00:00.000Z', status: 200, statusText: 'OK', headers: {}, body: '', durationMs: 1, sizeBytes: 0, timeline: [{ name: 'DataOut', value: '(12 KiB hidden)', elapsedMs: -3, hidden: true }, null] }];

    expect(migrateWorkspace(workspace).responses[0]).toMatchObject({ id: 'legacy-response-0', environmentId: '', requestId: 'request', timeline: [{ name: 'DataOut', value: '(12 KiB hidden)', elapsedMs: 0, hidden: true }] });
    expect(migrateWorkspace(workspace).responses[0].requestSnapshot?.url).toBe(requestSnapshot.url);
  });

  it('preserves optional exact response bytes and rejects non-string containers', () => {
    const workspace = cloneSeedWorkspace() as unknown as Record<string, unknown>;
    workspace.responses = [
      { id: 'binary', requestId: 'request', requestName: 'Binary', requestUrl: 'https://example.test/file', environmentId: '', receivedAt: '2026-07-17T00:00:00.000Z', status: 200, statusText: 'OK', headers: {}, body: 'f�o', bodyBase64: 'ZoBv', durationMs: 1, sizeBytes: 3 },
      { id: 'invalid', requestId: 'request', requestName: 'Invalid', requestUrl: 'https://example.test/file', environmentId: '', receivedAt: '2026-07-17T00:00:01.000Z', status: 200, statusText: 'OK', headers: {}, body: 'safe', bodyBase64: { bytes: [] }, durationMs: 1, sizeBytes: 4 },
    ];

    const responses = migrateWorkspace(workspace).responses;
    expect(responses[0]).toMatchObject({ id: 'binary', body: 'f�o', bodyBase64: 'ZoBv' });
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
