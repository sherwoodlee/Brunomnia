import { describe, expect, it } from 'vitest';
import { cloneSeedWorkspace } from '../data/seed';
import {
  activeCollaborationBranch,
  checkoutCollaborationBranch,
  collaborationCommits,
  collaborationResourceSnapshot,
  collaborationResources,
  commitCollaborationResources,
  createCollaborationBranch,
  dirtyCollaborationResources,
  emptyCollaborationRepository,
  planCollaborationBranchMerge,
  resolveCollaborationBranchMerge,
  restoreCollaborationCommit,
} from './collaboration';

const sequence = (...values: string[]) => {
  let index = 0;
  return () => values[index++] ?? `generated-${index}`;
};

describe('encrypted collaboration repository', () => {
  it('enumerates object-scoped resources and strips private or runtime-only authority', () => {
    const workspace = cloneSeedWorkspace();
    const collection = workspace.collections[0];
    collection.subEnvironments = [{ id: 'private', name: 'Private', private: true, variables: [{ id: 'secret', name: 'token', value: '', enabled: true, valueType: 'secret' }] }];
    collection.activeSubEnvironmentId = 'private';
    collection.requests[0].auth = { ...collection.requests[0].auth, type: 'oauth2', accessToken: 'runtime-token', refreshToken: 'runtime-refresh' };
    workspace.mcpClients = [{ id: 'mcp', name: 'MCP', enabled: true, transport: 'http', url: 'https://mcp.example', command: '', args: [], env: [], headers: [], authType: 'oauth2', token: 'mcp-runtime', username: '', password: '', oauthAuthorizationUrl: '', oauthAccessTokenUrl: '', oauthClientId: '', oauthClientSecret: '', oauthScope: '', oauthState: '', oauthRefreshToken: 'mcp-refresh', oauthIdentityToken: 'mcp-identity', oauthExpiresAt: 123, oauthTokenPrefix: 'Bearer', oauthRegisteredClientId: 'registered', oauthRegisteredClientSecret: 'registered-secret', oauthRegisteredClientIdIssuedAt: 1, oauthRegisteredClientSecretExpiresAt: 2, oauthRegisteredTokenEndpointAuthMethod: 'client_secret_post', roots: [], tools: [], prompts: [], resources: [], resourceTemplates: [] }];
    const resources = collaborationResources(workspace);

    expect(resources.map((resource) => resource.kind)).toEqual(expect.arrayContaining(['collection', 'environment', 'api-design', 'mock-server', 'mcp-client']));
    const snapshot = collaborationResourceSnapshot(workspace, `collection:${collection.id}`);
    const collectionSnapshot = snapshot as unknown as { collection: { subEnvironments: unknown[] } };
    expect(JSON.stringify(snapshot)).not.toContain('runtime-token');
    expect(JSON.stringify(snapshot)).not.toContain('runtime-refresh');
    expect(collectionSnapshot.collection.subEnvironments).toEqual([]);
    expect(JSON.stringify(snapshot)).not.toContain('"valueType":"secret"');
    expect(JSON.stringify(collaborationResourceSnapshot(workspace, 'mcp-client:mcp'))).not.toContain('mcp-runtime');
    expect(JSON.stringify(collaborationResourceSnapshot(workspace, 'mcp-client:mcp'))).not.toContain('registered-secret');
  });

  it('commits, branches, checks out, and restores one collection without changing siblings', () => {
    const workspace = cloneSeedWorkspace();
    const key = `collection:${workspace.collections[0].id}`;
    const sibling = structuredClone(workspace.collections[1]);
    const initial = commitCollaborationResources(workspace, emptyCollaborationRepository(), [key], 'Avery', 'Initial', sequence('2026-01-01T00:00:00Z'), sequence('base'));
    expect(initial.committed.map((commit) => commit.id)).toEqual(['base']);
    expect(dirtyCollaborationResources(workspace, initial.repository)).not.toContain(key);

    let repository = createCollaborationBranch(initial.repository, key, 'feature/orders', sequence('2026-01-02T00:00:00Z'));
    const featureWorkspace = structuredClone(workspace);
    featureWorkspace.collections[0].name = 'Feature collection';
    repository = commitCollaborationResources(featureWorkspace, repository, [key], 'Avery', 'Rename collection', sequence('2026-01-03T00:00:00Z'), sequence('feature')).repository;
    expect(activeCollaborationBranch(repository, key)).toBe('feature/orders');

    const checkedOut = checkoutCollaborationBranch(featureWorkspace, repository, key, 'main');
    expect(checkedOut.workspace.collections[0].name).toBe(workspace.collections[0].name);
    expect(checkedOut.workspace.collections[1]).toEqual(sibling);
    expect(collaborationCommits(checkedOut.repository, key)).toHaveLength(2);

    const restored = restoreCollaborationCommit(checkedOut.workspace, checkedOut.repository, 'feature', 'Avery', sequence('2026-01-04T00:00:00Z'), sequence('restore'));
    expect(restored.workspace.collections[0].name).toBe('Feature collection');
    expect(restored.commit).toMatchObject({ id: 'restore', branch: 'main', parentId: 'base' });
  });

  it('three-way merges disjoint edits and requires explicit resolution for conflicts', () => {
    const workspace = cloneSeedWorkspace();
    const key = `collection:${workspace.collections[0].id}`;
    let repository = commitCollaborationResources(workspace, emptyCollaborationRepository(), [key], 'Avery', 'Initial', sequence('2026-01-01T00:00:00Z'), sequence('base')).repository;
    repository = createCollaborationBranch(repository, key, 'feature', sequence('2026-01-02T00:00:00Z'));
    const feature = structuredClone(workspace);
    feature.collections[0].name = 'Feature name';
    repository = commitCollaborationResources(feature, repository, [key], 'Avery', 'Feature', sequence('2026-01-03T00:00:00Z'), sequence('feature')).repository;
    let main = checkoutCollaborationBranch(feature, repository, key, 'main');
    main.workspace.collections[0].documentation = 'Main documentation';
    repository = commitCollaborationResources(main.workspace, main.repository, [key], 'Blake', 'Main docs', sequence('2026-01-04T00:00:00Z'), sequence('main')).repository;

    const cleanPlan = planCollaborationBranchMerge(repository, key, 'feature');
    expect(cleanPlan.conflicts).toEqual([]);
    const merged = resolveCollaborationBranchMerge(main.workspace, repository, cleanPlan, {}, 'Blake', 'Merge feature', sequence('2026-01-05T00:00:00Z'), sequence('merge'));
    expect(merged.workspace.collections[0]).toMatchObject({ name: 'Feature name', documentation: 'Main documentation' });
    expect(merged.commit).toMatchObject({ parentId: 'main', mergeParentId: 'feature' });

    let conflictRepository = createCollaborationBranch(merged.repository, key, 'rename-again', sequence('2026-01-06T00:00:00Z'));
    const theirs = structuredClone(merged.workspace);
    theirs.collections[0].name = 'Theirs';
    conflictRepository = commitCollaborationResources(theirs, conflictRepository, [key], 'Avery', 'Theirs', sequence('2026-01-07T00:00:00Z'), sequence('theirs')).repository;
    main = checkoutCollaborationBranch(theirs, conflictRepository, key, 'main');
    main.workspace.collections[0].name = 'Mine';
    conflictRepository = commitCollaborationResources(main.workspace, main.repository, [key], 'Blake', 'Mine', sequence('2026-01-08T00:00:00Z'), sequence('mine')).repository;
    const conflictPlan = planCollaborationBranchMerge(conflictRepository, key, 'rename-again');
    expect(conflictPlan.conflicts.map((conflict) => conflict.path)).toContain('/collection/name');
    expect(() => resolveCollaborationBranchMerge(main.workspace, conflictRepository, conflictPlan, {}, 'Blake', 'Resolve')).toThrow(/Resolve collaboration conflict/);
    const resolved = resolveCollaborationBranchMerge(main.workspace, conflictRepository, conflictPlan, { '/collection/name': 'theirs' }, 'Blake', 'Resolve', sequence('2026-01-09T00:00:00Z'), sequence('resolved'));
    expect(resolved.workspace.collections[0].name).toBe('Theirs');
  });
});
