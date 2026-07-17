import { describe, expect, it } from 'vitest';
import { createBlankRequest } from '../data/seed';
import type { Collection, Environment, RequestFolder } from '../types';
import { applyCollectionConfiguration, folderAncestors, publicEnvironments, resolveEnvironment } from './resources';

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
    const collection: Collection = { id: 'collection', name: 'Collection', expanded: true, requests: [request], folders, environment: [row('collection-env', 'collection', 'yes')] };
    const environment: Environment = { id: 'env', name: 'Environment', variables: [row('global-env', 'scope', 'global')] };
    const configured = applyCollectionConfiguration(collection, request, environment);
    expect(folderAncestors(collection, 'leaf').map((folder) => folder.id)).toEqual(['root', 'leaf']);
    expect(Object.fromEntries(configured.environment.variables.map((item) => [item.name, item.value]))).toEqual({ scope: 'leaf', collection: 'yes' });
    expect(Object.fromEntries(configured.request.headers.map((item) => [item.name, item.value]))).toEqual({ 'X-Root': 'yes', 'X-Level': 'request' });
    expect(configured.request.auth).toMatchObject({ type: 'bearer', token: 'folder-token' });
    expect(configured.request.preRequestScript).toBe('rootPre();\n\nleafPre();\n\nrequestPre();');
    expect(configured.request.tests).toBe('requestAfter();\n\nleafAfter();\n\nrootAfter();');
  });

  it('removes private environments from shareable sets', () => {
    expect(publicEnvironments([
      { id: 'base', name: 'Base', variables: [] },
      { id: 'private', name: 'Private', parentId: 'base', private: true, variables: [] },
      { id: 'descendant', name: 'Descendant', parentId: 'private', variables: [] },
    ]).map((environment) => environment.id)).toEqual(['base']);
  });
});
