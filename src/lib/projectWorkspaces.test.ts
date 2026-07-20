import { describe, expect, it } from 'vitest';
import { cloneSeedWorkspace } from '../data/seed';
import type { McpClient } from '../types';
import { duplicateProjectWorkspace, isProjectWorkspaceEmpty, listProjectWorkspaces, moveProjectWorkspace } from './projectWorkspaces';

const idFactory = () => {
  let sequence = 0;
  return (prefix: string) => `${prefix}-copy-${sequence += 1}`;
};

const mcpClient = (): McpClient => ({
  id: 'mcp-source', name: 'Tools', enabled: true, transport: 'http', url: 'https://mcp.example/rpc', command: '', args: [],
  env: [{ id: 'mcp-env', name: 'REGION', value: 'us', enabled: true }], headers: [{ id: 'mcp-header', name: 'X-Test', value: 'one', enabled: true }],
  authType: 'oauth2', token: 'runtime-access', username: '', password: '', oauthAuthorizationUrl: 'https://auth.example/authorize', oauthAccessTokenUrl: 'https://auth.example/token', oauthClientId: 'client', oauthClientSecret: '', oauthScope: '', oauthState: 'runtime-state', oauthRefreshToken: 'runtime-refresh', oauthIdentityToken: 'runtime-identity', oauthExpiresAt: 100, oauthTokenPrefix: 'Bearer', oauthRegisteredClientId: 'registered-client', oauthRegisteredClientSecret: 'registered-secret', oauthRegisteredClientIdIssuedAt: 1, oauthRegisteredClientSecretExpiresAt: 2, oauthRegisteredTokenEndpointAuthMethod: 'client_secret_post', roots: [], tools: [], prompts: [], resources: [], resourceTemplates: [],
});

const emptyTarget = () => {
  const workspace = cloneSeedWorkspace();
  workspace.collections = [];
  workspace.activeRequestId = '';
  workspace.environments = [];
  workspace.activeEnvironmentId = '';
  workspace.history = [];
  workspace.apiDesigns = [];
  workspace.mockServers = [];
  workspace.testSuites = [];
  workspace.unitTestResults = [];
  workspace.runnerReports = [];
  workspace.cookies = [];
  workspace.fileState = {};
  workspace.responses = [];
  workspace.streamSessions = [];
  workspace.mcpClients = [];
  workspace.mcpSessions = [];
  workspace.responseFilters = {};
  return workspace;
};

describe('typed project workspaces', () => {
  it('recognizes a project with no typed files or standalone suites as empty', () => {
    const workspace = emptyTarget();
    expect(listProjectWorkspaces(workspace)).toEqual([]);
    expect(isProjectWorkspaceEmpty(workspace)).toBe(true);
    workspace.testSuites.push({ id: 'suite', name: 'Standalone', collectionId: '', sortKey: 0, tests: [] });
    expect(isProjectWorkspaceEmpty(workspace)).toBe(false);
  });

  it('lists every pinned workspace scope from top-level project resources', () => {
    const workspace = cloneSeedWorkspace();
    workspace.apiDesigns = [{ id: 'design', name: 'Orders API', contents: '{}' }];
    workspace.mockServers = [{ id: 'mock', name: 'Orders mock', host: '127.0.0.1', port: 4010, routes: [] }];
    workspace.environments = [
      { id: 'global', name: 'Global', variables: [] },
      { id: 'child', name: 'Development', parentId: 'global', variables: [] },
      { id: 'detached', name: 'Detached', parentId: 'missing', variables: [] },
    ];
    workspace.mcpClients = [mcpClient()];

    expect(listProjectWorkspaces(workspace)).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: workspace.collections[0].id, scope: 'collection', label: 'Collection' }),
      { id: 'design', name: 'Orders API', scope: 'design', label: 'Document' },
      { id: 'mock', name: 'Orders mock', scope: 'mock-server', label: 'Mock Server' },
      { id: 'global', name: 'Global', scope: 'environment', label: 'Environment' },
      { id: 'detached', name: 'Detached', scope: 'environment', label: 'Environment' },
      { id: 'mcp-source', name: 'Tools', scope: 'mcp', label: 'MCP Client' },
    ]));
  });

  it('duplicates a collection with collision-safe nested identities and its cookie jar', () => {
    const source = cloneSeedWorkspace();
    const collection = source.collections[0];
    const request = collection.requests[0];
    collection.folders = [{ id: 'folder', name: 'Nested', parentId: '', expanded: true, headers: [{ id: 'folder-header', name: 'X-Folder', value: 'one', enabled: true }], environment: [], preRequestScript: '', tests: '', documentation: '' }];
    collection.resourceOrder = ['folder', request.id];
    request.folderId = 'folder';
    request.grpc.protoFiles = [{ id: 'proto', path: 'service.proto', text: 'syntax = "proto3";' }];
    request.socketIo.args = [{ id: 'socket-arg', value: '{}', mode: 'json' }];
    source.fileState[collection.id] = {
      cookies: [{ id: 'cookie', name: 'sid', value: 'secret', domain: 'api.example', path: '/', secure: true, httpOnly: true, sameSite: 'lax', hostOnly: true, createdAt: '2026-07-20T00:00:00.000Z' }],
      certificates: { ca: { enabled: true, pem: 'collection-ca' }, clients: [] },
    };
    const target = cloneSeedWorkspace();

    const result = duplicateProjectWorkspace(source, target, collection.id, 'Copied Collection', idFactory());
    const copied = result.workspace.collections.at(-1)!;

    expect(result.projectWorkspace).toMatchObject({ id: copied.id, name: 'Copied Collection', scope: 'collection' });
    expect(copied.id).not.toBe(collection.id);
    expect(copied.folders?.[0].id).not.toBe('folder');
    expect(copied.requests[0]).toMatchObject({ folderId: copied.folders?.[0].id });
    expect(copied.requests[0].id).not.toBe(request.id);
    expect(copied.requests[0].grpc.protoFiles[0].id).not.toBe('proto');
    expect(copied.requests[0].socketIo.args[0].id).not.toBe('socket-arg');
    expect(result.workspace.fileState[copied.id]).toEqual(source.fileState[collection.id]);
    expect(source.collections[0].name).toBe(collection.name);

    const sameProject = duplicateProjectWorkspace(source, source, collection.id, 'Local Copy', idFactory());
    expect(sameProject.workspace.collections).toHaveLength(source.collections.length + 1);
    expect(sameProject.workspace.fileState[sameProject.projectWorkspace.id]).toEqual(source.fileState[collection.id]);
  });

  it('duplicates a design with its generated collection and remapped suites', () => {
    const source = cloneSeedWorkspace();
    const collection = source.collections[0];
    const request = collection.requests[0];
    source.apiDesigns = [{ id: 'design', name: 'Orders API', contents: 'openapi: 3.1.0', generatedCollectionId: collection.id }];
    source.fileState.design = { cookies: [], certificates: { ca: { enabled: true, pem: 'design-ca' }, clients: [] } };
    source.testSuites = [{ id: 'suite', name: 'Contract', collectionId: collection.id, sortKey: 0, tests: [{ id: 'test', name: 'Works', code: '', requestId: request.id, sortKey: 0 }] }];

    const result = duplicateProjectWorkspace(source, cloneSeedWorkspace(), 'design', 'Orders API Copy', idFactory());
    const design = result.workspace.apiDesigns.at(-1)!;
    const generated = result.workspace.collections.find((candidate) => candidate.id === design.generatedCollectionId)!;
    const suite = result.workspace.testSuites.at(-1)!;

    expect(design).toMatchObject({ name: 'Orders API Copy', contents: 'openapi: 3.1.0' });
    expect(generated.id).not.toBe(collection.id);
    expect(suite.collectionId).toBe(generated.id);
    expect(suite.tests[0].requestId).toBe(generated.requests[0].id);
    expect(result.workspace.fileState[design.id]).toEqual(source.fileState.design);
  });

  it('duplicates only the selected global environment tree', () => {
    const source = cloneSeedWorkspace();
    source.environments = [
      { id: 'root', name: 'Root', variables: [{ id: 'root-row', name: 'base', value: 'one', enabled: true }] },
      { id: 'child', name: 'Child', parentId: 'root', variables: [{ id: 'child-row', name: 'child', value: 'two', enabled: true }] },
      { id: 'other', name: 'Other', variables: [] },
    ];

    const result = duplicateProjectWorkspace(source, cloneSeedWorkspace(), 'root', 'Shared Environment', idFactory());
    const copiedRoot = result.workspace.environments.find((environment) => environment.id === result.projectWorkspace.id)!;
    const copiedChild = result.workspace.environments.find((environment) => environment.parentId === copiedRoot.id)!;

    expect(copiedRoot.name).toBe('Shared Environment');
    expect(copiedRoot.variables[0].id).not.toBe('root-row');
    expect(copiedChild).toMatchObject({ name: 'Child', variables: [expect.objectContaining({ name: 'child', value: 'two' })] });
    expect(result.workspace.environments.filter((environment) => environment.name === 'Other')).toHaveLength(0);
    expect(result.workspace.activeEnvironmentId).toBe(copiedRoot.id);
  });

  it('duplicates mock and MCP workspaces while clearing runtime MCP authorization', () => {
    const source = cloneSeedWorkspace();
    source.mockServers = [{ id: 'mock', name: 'Mock', host: '127.0.0.1', port: 4010, routes: [{ id: 'route', name: 'List', enabled: true, method: 'GET', path: '/items', status: 200, headers: [{ id: 'route-header', name: 'X-Test', value: 'one', enabled: true }], body: '[]', delayMs: 0 }] }];
    source.mcpClients = [mcpClient()];
    const target = cloneSeedWorkspace();

    const withMock = duplicateProjectWorkspace(source, target, 'mock', 'Mock Copy', idFactory()).workspace;
    const withMcp = duplicateProjectWorkspace(source, withMock, 'mcp-source', 'Tools Copy', idFactory()).workspace;
    const mock = withMcp.mockServers.at(-1)!;
    const client = withMcp.mcpClients.at(-1)!;

    expect(mock).toMatchObject({ name: 'Mock Copy', routes: [expect.objectContaining({ name: 'List' })] });
    expect(mock.routes[0].id).not.toBe('route');
    expect(mock.routes[0].headers[0].id).not.toBe('route-header');
    expect(client).toMatchObject({ name: 'Tools Copy', enabled: false, token: '', oauthState: '', oauthRefreshToken: '', oauthIdentityToken: '', oauthExpiresAt: 0, oauthRegisteredClientId: '', oauthRegisteredClientSecret: '', oauthRegisteredClientIdIssuedAt: 0, oauthRegisteredClientSecretExpiresAt: 0, oauthRegisteredTokenEndpointAuthMethod: 'none' });
    expect(client.env[0].id).not.toBe('mcp-env');
    expect(client.headers[0].id).not.toBe('mcp-header');
  });

  it('moves a collection with owned evidence while preserving identities', () => {
    const source = cloneSeedWorkspace();
    const collection = source.collections[0];
    const request = collection.requests[0];
    source.collections = [collection];
    source.activeRequestId = request.id;
    source.testSuites = [{ id: 'suite', name: 'Suite', collectionId: collection.id, sortKey: 0, tests: [{ id: 'test', name: 'Test', code: '', requestId: request.id, sortKey: 0 }] }];
    source.unitTestResults = [{ id: 'test-result', suiteId: 'suite', startedAt: '2026-07-20T00:00:00.000Z', finishedAt: '2026-07-20T00:00:01.000Z', tests: [] }];
    source.runnerReports = [{ id: 'runner', collectionId: collection.id, collectionName: collection.name, environmentId: source.activeEnvironmentId, startedAt: '2026-07-20T00:00:00.000Z', finishedAt: '2026-07-20T00:00:01.000Z', iterations: 1, retries: 0, total: 1, passed: 1, failed: 0, cancelled: false, results: [] }];
    source.history = [{ id: 'history', requestId: request.id, name: request.name, method: request.method, url: request.url, status: 200, durationMs: 1, createdAt: '2026-07-20T00:00:00.000Z' }];
    source.responses = [{ id: 'response', requestId: request.id, requestName: request.name, requestUrl: request.url, environmentId: source.activeEnvironmentId, receivedAt: '2026-07-20T00:00:00.000Z', status: 200, statusText: 'OK', headers: {}, body: '', durationMs: 1, sizeBytes: 0 }];
    source.streamSessions = [{ id: 'stream', requestId: request.id, requestName: request.name, requestUrl: request.url, environmentId: source.activeEnvironmentId, protocol: 'websocket', startedAt: '2026-07-20T00:00:00.000Z', messages: [] }];
    source.responseFilters = { [request.id]: { filter: '$.id', history: ['$.id'], previewMode: 'source' } };
    source.fileState[collection.id] = {
      cookies: [{ id: 'cookie', name: 'sid', value: 'secret', domain: 'api.example', path: '/', secure: true, httpOnly: true, sameSite: 'lax', hostOnly: true, createdAt: '2026-07-20T00:00:00.000Z' }],
      certificates: { ca: { enabled: true, pem: 'collection-ca' }, clients: [] },
    };

    const result = moveProjectWorkspace(source, emptyTarget(), collection.id);

    expect(result.target.collections[0].id).toBe(collection.id);
    expect(result.target.testSuites[0]).toMatchObject({ id: 'suite', collectionId: collection.id, tests: [expect.objectContaining({ id: 'test', requestId: request.id })] });
    expect(result.target.unitTestResults[0].id).toBe('test-result');
    expect(result.target.runnerReports[0].id).toBe('runner');
    expect(result.target.history[0].id).toBe('history');
    expect(result.target.responses[0].id).toBe('response');
    expect(result.target.streamSessions[0].id).toBe('stream');
    expect(result.target.responseFilters?.[request.id].filter).toBe('$.id');
    expect(result.target.fileState[collection.id]).toEqual(source.fileState[collection.id]);
    expect(result.source.fileState[collection.id]).toBeUndefined();
    expect(result.source.collections).toEqual([]);
    expect(result.source.activeRequestId).toBe('');
    expect(result.source.history).toEqual([]);
    expect(source.collections[0].id).toBe(collection.id);
  });

  it('moves a design with its hidden generated collection and suites', () => {
    const source = cloneSeedWorkspace();
    const generated = source.collections[0];
    source.collections = [generated];
    source.apiDesigns = [{ id: 'design', name: 'Orders API', contents: 'openapi: 3.1.0', generatedCollectionId: generated.id }];
    source.testSuites = [{ id: 'suite', name: 'Contract', collectionId: generated.id, sortKey: 0, tests: [] }];

    expect(listProjectWorkspaces(source)).not.toContainEqual(expect.objectContaining({ id: generated.id, scope: 'collection' }));
    const result = moveProjectWorkspace(source, emptyTarget(), 'design');

    expect(result.target.apiDesigns).toContainEqual(expect.objectContaining({ id: 'design', generatedCollectionId: generated.id }));
    expect(result.target.collections).toContainEqual(expect.objectContaining({ id: generated.id }));
    expect(result.target.testSuites).toContainEqual(expect.objectContaining({ id: 'suite', collectionId: generated.id }));
    expect(result.source.apiDesigns).toEqual([]);
    expect(result.source.collections).toEqual([]);
    expect(result.source.activeRequestId).toBe('');
  });

  it('moves mock, environment, and MCP scopes with their owned children', () => {
    const source = cloneSeedWorkspace();
    source.mockServers = [{ id: 'mock', name: 'Mock', host: '127.0.0.1', port: 4010, routes: [{ id: 'route', name: 'Route', enabled: true, method: 'GET', path: '/', status: 200, headers: [], body: '', delayMs: 0 }] }];
    source.environments = [{ id: 'root', name: 'Root', variables: [] }, { id: 'child', name: 'Child', parentId: 'root', variables: [] }];
    source.activeEnvironmentId = 'root';
    source.mcpClients = [mcpClient()];
    source.mcpSessions = [{ id: 'mcp-session', clientId: 'mcp-source', clientName: 'Tools', endpoint: 'https://mcp.example/rpc', environmentId: 'root', transport: 'http', startedAt: '2026-07-20T00:00:00.000Z', status: 'connected', events: [], timeline: [] }];

    const movedMock = moveProjectWorkspace(source, emptyTarget(), 'mock');
    expect(movedMock.target.mockServers[0]).toMatchObject({ id: 'mock', routes: [expect.objectContaining({ id: 'route' })] });
    expect(movedMock.source.mockServers).toEqual([]);

    const movedEnvironment = moveProjectWorkspace(source, emptyTarget(), 'root');
    expect(movedEnvironment.target.environments).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'root' }), expect.objectContaining({ id: 'child', parentId: 'root' })]));
    expect(movedEnvironment.source.environments).toEqual([]);
    expect(movedEnvironment.source.activeEnvironmentId).toBe('');

    const movedMcp = moveProjectWorkspace(source, emptyTarget(), 'mcp-source');
    expect(movedMcp.target.mcpClients[0].id).toBe('mcp-source');
    expect(movedMcp.target.mcpSessions[0].id).toBe('mcp-session');
    expect(movedMcp.source.mcpClients).toEqual([]);
    expect(movedMcp.source.mcpSessions).toEqual([]);
  });

  it('refuses cross-project identity collisions and same-project moves', () => {
    const source = cloneSeedWorkspace();
    const collectionId = source.collections[0].id;
    expect(() => moveProjectWorkspace(source, structuredClone(source), collectionId)).toThrow('already contains resource identity');
    expect(() => moveProjectWorkspace(source, source, collectionId)).toThrow('different destination');
  });
});
