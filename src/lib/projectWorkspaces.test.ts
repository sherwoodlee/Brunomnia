import { describe, expect, it } from 'vitest';
import { cloneSeedWorkspace } from '../data/seed';
import type { McpClient } from '../types';
import { duplicateProjectWorkspace, listProjectWorkspaces } from './projectWorkspaces';

const idFactory = () => {
  let sequence = 0;
  return (prefix: string) => `${prefix}-copy-${sequence += 1}`;
};

const mcpClient = (): McpClient => ({
  id: 'mcp-source', name: 'Tools', enabled: true, transport: 'http', url: 'https://mcp.example/rpc', command: '', args: [],
  env: [{ id: 'mcp-env', name: 'REGION', value: 'us', enabled: true }], headers: [{ id: 'mcp-header', name: 'X-Test', value: 'one', enabled: true }],
  authType: 'oauth2', token: 'runtime-access', username: '', password: '', oauthAuthorizationUrl: 'https://auth.example/authorize', oauthAccessTokenUrl: 'https://auth.example/token', oauthClientId: 'client', oauthClientSecret: '', oauthScope: '', oauthState: 'runtime-state', oauthRefreshToken: 'runtime-refresh', oauthIdentityToken: 'runtime-identity', oauthExpiresAt: 100, oauthTokenPrefix: 'Bearer', oauthRegisteredClientId: 'registered-client', oauthRegisteredClientSecret: 'registered-secret', oauthRegisteredClientIdIssuedAt: 1, oauthRegisteredClientSecretExpiresAt: 2, oauthRegisteredTokenEndpointAuthMethod: 'client_secret_post', roots: [], tools: [], prompts: [], resources: [], resourceTemplates: [],
});

describe('typed project workspaces', () => {
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
    source.cookies = [{ id: 'cookie', name: 'sid', value: 'secret', domain: 'api.example', path: '/', secure: true, httpOnly: true, sameSite: 'lax', hostOnly: true, createdAt: '2026-07-20T00:00:00.000Z' }];
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
    expect(result.workspace.cookies).toContainEqual(expect.objectContaining({ name: 'sid', value: 'secret' }));
    expect(source.collections[0].name).toBe(collection.name);

    const sameProject = duplicateProjectWorkspace(source, source, collection.id, 'Local Copy', idFactory()).workspace;
    expect(sameProject.collections).toHaveLength(source.collections.length + 1);
    expect(sameProject.cookies).toHaveLength(source.cookies.length);
  });

  it('duplicates a design with its generated collection and remapped suites', () => {
    const source = cloneSeedWorkspace();
    const collection = source.collections[0];
    const request = collection.requests[0];
    source.apiDesigns = [{ id: 'design', name: 'Orders API', contents: 'openapi: 3.1.0', generatedCollectionId: collection.id }];
    source.testSuites = [{ id: 'suite', name: 'Contract', collectionId: collection.id, sortKey: 0, tests: [{ id: 'test', name: 'Works', code: '', requestId: request.id, sortKey: 0 }] }];

    const result = duplicateProjectWorkspace(source, cloneSeedWorkspace(), 'design', 'Orders API Copy', idFactory());
    const design = result.workspace.apiDesigns.at(-1)!;
    const generated = result.workspace.collections.find((candidate) => candidate.id === design.generatedCollectionId)!;
    const suite = result.workspace.testSuites.at(-1)!;

    expect(design).toMatchObject({ name: 'Orders API Copy', contents: 'openapi: 3.1.0' });
    expect(generated.id).not.toBe(collection.id);
    expect(suite.collectionId).toBe(generated.id);
    expect(suite.tests[0].requestId).toBe(generated.requests[0].id);
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
});
