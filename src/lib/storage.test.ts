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
    expect(migrated.version).toBe(22);
    expect(migrated.collections[0].requests[0]).toMatchObject({ id: first.id, protocol: 'http', bodyMode: 'none' });
    expect(migrated.collections[0].requests[0].pathParams).toEqual([]);
    expect(migrated.collections[0].requests[0].transport.timeoutMs).toBe(60000);
    expect(migrated.collections[0].requests[0].sse).toEqual({
      autoReconnect: true,
      reconnectDelayMs: 1_000,
      maxReconnects: 0,
      respectServerRetry: true,
      sendLastEventId: true,
    });
    expect(migrated.apiDesigns[0].name).toBe('Orders API');
    expect(migrated.mockServers[0].host).toBe('127.0.0.1');
    expect(migrated.imports).toEqual([]);
    expect(migrated.cookies).toEqual([]);
    expect(migrated.responses).toEqual([]);
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
    expect(migrated.version).toBe(22);
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
    exported.preferences = { ...exported.preferences, theme: 'light', fontSize: 22, interfaceFontSize: 21, fontInterface: 'Imported UI', fontMonospace: 'Imported Mono', showPasswords: true, allowHtmlPreviewRemoteResources: true, allowHtmlPreviewScripts: true, disableResponsePreviewLinks: true, preferredHttpVersion: 'http2-prior-knowledge', maxRedirects: -1, followRedirects: false, maxTimelineDataSizeKB: 99, maxHistoryResponses: -1, filterResponsesByEnv: true, requestTimeoutMs: 123_000, allowScriptRequests: true, allowScriptFileAccess: true, dataFolders: ['/private/imported-authority'], enableVaultInScripts: true, forceVerticalLayout: true, editorIndentWithTabs: false, editorIndentSize: 8, editorLineWrapping: false, fontVariantLigatures: true };

    const imported = parseWorkspaceImport(JSON.stringify(exported));
    expect(imported.plugins[0]).toMatchObject({ enabled: false, grantedPermissions: [] });
    expect(imported.pluginData).toEqual({});
    expect(imported.activePluginTheme).toBe('');
    expect(imported.mcpClients[0]).toMatchObject({ enabled: false, token: '', password: '' });
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
