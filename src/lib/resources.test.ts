import { describe, expect, it } from 'vitest';
import { cloneSeedWorkspace, createBlankRequest } from '../data/seed';
import type { Collection, Environment, RequestFolder } from '../types';
import { applyCollectionConfiguration, collectionEnvironmentScopes, folderAncestors, moveWorkspaceResource, orderedCollectionChildren, persistEffectiveAuthentication, publicEnvironments, resolveEnvironment, scriptEnvironmentScopes } from './resources';

const row = (id: string, name: string, value: string) => ({ id, name, value, enabled: true });

describe('resource hierarchy', () => {
  it('resolves bounded parent environments with child overrides', () => {
    const environments: Environment[] = [
      { id: 'base', name: 'Base', variables: [row('base-url', 'url', 'base'), row('base-token', 'token', 'base')] },
      { id: 'child', name: 'Child', parentId: 'base', variables: [row('child-url', 'url', 'child')] },
    ];
    expect(resolveEnvironment(environments, 'child')?.variables.map(({ name, value }) => [name, value])).toEqual([['url', 'child'], ['token', 'base']]);
  });

  it('applies root-to-leaf folder variables, headers, auth, and scripts', () => {
    const request = createBlankRequest('request');
    request.folderId = 'leaf';
    request.inheritFolderAuth = true;
    request.headers = [row('request-header', 'X-Level', 'request')];
    request.preRequestScript = 'requestPre();';
    request.tests = 'requestAfter();';
    const auth = { ...request.auth, type: 'bearer' as const, token: 'folder-token' };
    const folders: RequestFolder[] = [
      { id: 'root', name: 'Root', parentId: '', expanded: true, headers: [row('root-header', 'X-Root', 'yes'), row('root-level', 'X-Level', 'root')], environment: [row('root-env', 'scope', 'root')], auth, preRequestScript: 'rootPre();', tests: 'rootAfter();', documentation: '' },
      { id: 'leaf', name: 'Leaf', parentId: 'root', expanded: true, headers: [], environment: [row('leaf-env', 'scope', 'leaf')], preRequestScript: 'leafPre();', tests: 'leafAfter();', documentation: '' },
    ];
    const collection: Collection = { id: 'collection', name: 'Collection', expanded: true, requests: [request], folders, environment: [row('collection-env', 'collection', 'yes')], subEnvironments: [{ id: 'selected', name: 'Selected', variables: [row('selected-env', 'selected', 'yes')] }], activeSubEnvironmentId: 'selected' };
    const environment: Environment = { id: 'env', name: 'Environment', variables: [row('global-env', 'scope', 'global')] };
    const configured = applyCollectionConfiguration(collection, request, environment);
    expect(folderAncestors(collection, 'leaf').map((folder) => folder.id)).toEqual(['root', 'leaf']);
    expect(Object.fromEntries(configured.environment.variables.map((item) => [item.name, item.value]))).toEqual({ scope: 'leaf', collection: 'yes', selected: 'yes' });
    expect(Object.fromEntries(configured.request.headers.map((item) => [item.name, item.value]))).toEqual({ 'X-Root': 'yes', 'X-Level': 'request' });
    expect(configured.request.auth).toMatchObject({ type: 'bearer', token: 'folder-token' });
    expect(configured.request.preRequestScript).toBe('rootPre();\n\nleafPre();\n\nrequestPre();');
    expect(configured.request.tests).toBe('requestAfter();\n\nleafAfter();\n\nrootAfter();');
  });

  it('persists acquired authentication to the effective folder or request owner', () => {
    const inherited = createBlankRequest('inherited');
    inherited.folderId = 'leaf';
    inherited.inheritFolderAuth = true;
    const direct = createBlankRequest('direct');
    const folderAuth = { ...inherited.auth, type: 'oauth2' as const, accessToken: 'old-folder-token' };
    const collection: Collection = {
      id: 'collection', name: 'Collection', expanded: true, requests: [inherited, direct],
      folders: [
        { id: 'root', name: 'Root', parentId: '', expanded: true, headers: [], environment: [], auth: folderAuth, preRequestScript: '', tests: '', documentation: '' },
        { id: 'leaf', name: 'Leaf', parentId: 'root', expanded: true, headers: [], environment: [], preRequestScript: '', tests: '', documentation: '' },
      ],
    };
    const acquired = { ...folderAuth, accessToken: 'new-token' };
    const folderUpdated = persistEffectiveAuthentication(collection, inherited.id, acquired);
    expect(folderUpdated.folders?.find((folder) => folder.id === 'root')?.auth?.accessToken).toBe('new-token');
    expect(folderUpdated.requests.find((request) => request.id === inherited.id)?.auth.accessToken).toBe('');

    const requestUpdated = persistEffectiveAuthentication(folderUpdated, direct.id, acquired);
    expect(requestUpdated.requests.find((request) => request.id === direct.id)?.auth.accessToken).toBe('new-token');
  });

  it('keeps global and collection base and selected script stores distinct', () => {
    const environments: Environment[] = [
      { id: 'base', name: 'Base', variables: [row('base-shared', 'shared', 'base'), { ...row('base-disabled', 'hidden', 'base'), enabled: false }] },
      { id: 'selected', name: 'Selected', parentId: 'base', variables: [row('selected-shared', 'shared', 'global')] },
    ];
    const collection: Collection = {
      id: 'collection', name: 'Collection', expanded: true, requests: [], environment: [row('collection-base', 'shared', 'collection-base')],
      subEnvironments: [{ id: 'collection-selected', name: 'Selected', variables: [row('collection-selected-row', 'shared', 'collection-selected')] }], activeSubEnvironmentId: 'collection-selected',
    };
    expect(scriptEnvironmentScopes(environments, 'selected')).toMatchObject({
      baseId: 'base', selectedId: 'selected', globalsAreBase: false,
      baseGlobals: { values: { shared: 'base' }, disabled: ['hidden'] },
      globals: { values: { shared: 'global' }, disabled: [] },
    });
    expect(collectionEnvironmentScopes(collection)).toMatchObject({
      environmentIsBase: false,
      baseEnvironment: { values: { shared: 'collection-base' } },
      environment: { values: { shared: 'collection-selected' } },
    });
  });

  it('removes private environments from shareable sets', () => {
    expect(publicEnvironments([
      { id: 'base', name: 'Base', variables: [] },
      { id: 'private', name: 'Private', parentId: 'base', private: true, variables: [] },
      { id: 'descendant', name: 'Descendant', parentId: 'private', variables: [] },
    ]).map((environment) => environment.id)).toEqual(['base']);
  });

  it('renders mixed folder and request siblings from a persisted order', () => {
    const rootRequest = createBlankRequest('root-request');
    const nestedRequest = { ...createBlankRequest('nested-request'), folderId: 'folder-a' };
    const collection: Collection = {
      id: 'collection', name: 'Collection', expanded: true, requests: [rootRequest, nestedRequest],
      folders: [
        { id: 'folder-a', name: 'A', parentId: '', expanded: true, headers: [], environment: [], preRequestScript: '', tests: '', documentation: '' },
        { id: 'folder-b', name: 'B', parentId: '', expanded: true, headers: [], environment: [], preRequestScript: '', tests: '', documentation: '' },
      ],
      resourceOrder: ['root-request', 'folder-a', 'nested-request', 'folder-b'],
    };
    expect(orderedCollectionChildren(collection).map((resource) => resource.id)).toEqual(['root-request', 'folder-a', 'folder-b']);
    expect(orderedCollectionChildren(collection, 'folder-a').map((resource) => resource.id)).toEqual(['nested-request']);
  });

  it('reorders and reparents mixed resources without changing their identities', () => {
    const workspace = cloneSeedWorkspace();
    const first = createBlankRequest('first');
    const second = createBlankRequest('second');
    workspace.collections = [{
      id: 'source', name: 'Source', expanded: true, requests: [first, second],
      folders: [{ id: 'folder', name: 'Folder', parentId: '', expanded: false, headers: [], environment: [], preRequestScript: '', tests: '', documentation: '' }],
      resourceOrder: ['folder', 'first', 'second'],
    }];

    const reordered = moveWorkspaceResource(workspace, {
      kind: 'request', collectionId: 'source', resourceId: 'second', targetCollectionId: 'source', targetParentId: '', targetResourceId: 'folder', placement: 'before',
    });
    expect(orderedCollectionChildren(reordered.collections[0]).map((resource) => resource.id)).toEqual(['second', 'folder', 'first']);

    const reparented = moveWorkspaceResource(reordered, {
      kind: 'request', collectionId: 'source', resourceId: 'first', targetCollectionId: 'source', targetParentId: 'folder',
    });
    expect(reparented.collections[0].requests.find((request) => request.id === 'first')?.folderId).toBe('folder');
    expect(reparented.collections[0].folders?.[0].expanded).toBe(true);
    expect(orderedCollectionChildren(reparented.collections[0], 'folder').map((resource) => resource.id)).toEqual(['first']);
  });

  it('moves a folder subtree across collections and rejects descendant cycles', () => {
    const workspace = cloneSeedWorkspace();
    const nestedRequest = { ...createBlankRequest('nested-request'), folderId: 'child' };
    workspace.collections = [
      {
        id: 'source', name: 'Source', expanded: true, requests: [nestedRequest],
        folders: [
          { id: 'root', name: 'Root', parentId: '', expanded: true, headers: [], environment: [], preRequestScript: '', tests: '', documentation: '' },
          { id: 'child', name: 'Child', parentId: 'root', expanded: true, headers: [], environment: [], preRequestScript: '', tests: '', documentation: '' },
        ],
        resourceOrder: ['root', 'child', 'nested-request'],
      },
      {
        id: 'target', name: 'Target', expanded: false, requests: [],
        folders: [{ id: 'destination', name: 'Destination', parentId: '', expanded: false, headers: [], environment: [], preRequestScript: '', tests: '', documentation: '' }],
        resourceOrder: ['destination'],
      },
    ];
    const cycle = moveWorkspaceResource(workspace, {
      kind: 'folder', collectionId: 'source', resourceId: 'root', targetCollectionId: 'source', targetParentId: 'child',
    });
    expect(cycle).toBe(workspace);

    const moved = moveWorkspaceResource(workspace, {
      kind: 'folder', collectionId: 'source', resourceId: 'root', targetCollectionId: 'target', targetParentId: 'destination',
    });
    expect(moved.collections[0].folders).toEqual([]);
    expect(moved.collections[0].requests).toEqual([]);
    expect(moved.collections[1].folders?.find((folder) => folder.id === 'root')?.parentId).toBe('destination');
    expect(moved.collections[1].folders?.find((folder) => folder.id === 'child')?.parentId).toBe('root');
    expect(moved.collections[1].requests[0]).toMatchObject({ id: 'nested-request', folderId: 'child' });
    expect(moved.collections[1].folders?.find((folder) => folder.id === 'destination')?.expanded).toBe(true);
  });

  it('reorders collections around the requested target', () => {
    const workspace = cloneSeedWorkspace();
    const first = workspace.collections[0].id;
    const second = workspace.collections[1].id;
    const moved = moveWorkspaceResource(workspace, { kind: 'collection', collectionId: first, targetCollectionId: second, placement: 'after' });
    expect(moved.collections.slice(0, 2).map((collection) => collection.id)).toEqual([second, first]);
  });
});
