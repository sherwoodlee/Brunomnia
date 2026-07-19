import { describe, expect, it } from 'vitest';
import { parseAllDocuments } from 'yaml';
import { cloneSeedWorkspace } from '../../data/seed';
import { exportArtifact } from './exporters';
import { importArtifact } from './index';

describe('artifact export adapters', () => {
  it('round-trips Insomnia v4 and v5 compatibility exports', () => {
    const workspace = cloneSeedWorkspace();
    workspace.collections[0].requests[0].auth = { ...workspace.collections[0].requests[0].auth, type: 'hawk', hawkId: 'client', hawkKey: 'secret', hawkAlgorithm: 'sha256' };
    workspace.collections[0].requests[0].documentation = 'Request docs';
    workspace.collections[0].requests[0].transport = { ...workspace.collections[0].requests[0].transport, followRedirects: false, followRedirectsMode: 'off' };
    workspace.collections[0].requests[0].method = 'PROPFIND';
    workspace.collections[0].requests[0].url = 'https://api.acme.dev/v1/orders/{orderId}';
    workspace.collections[0].requests[0].pathParams = [{ id: 'order-id', name: 'orderId', value: 'ord/one', enabled: true, description: 'Order identifier' }];
    workspace.collections[0].requests[0].headers[0].description = 'Payload type';
    workspace.collections[0].folders = [{ id: 'orders-folder', name: 'Secured orders', parentId: '', expanded: true, headers: [{ id: 'folder-header', name: 'X-Team', value: 'orders', enabled: true }], environment: [{ id: 'folder-variable', name: 'scope', value: 'orders', enabled: true }], auth: { ...workspace.collections[0].requests[0].auth, type: 'bearer', token: '{{ vault.orders }}' }, preRequestScript: 'folderPre();', tests: 'folderAfter();', documentation: 'Folder docs' }];
    workspace.collections[0].environment = [{ id: 'collection-base', name: 'region', value: 'base', enabled: true }];
    workspace.collections[0].subEnvironments = [{ id: 'collection-staging', name: 'Staging', variables: [{ id: 'collection-selected', name: 'region', value: 'staging', enabled: true }] }];
    workspace.collections[0].activeSubEnvironmentId = 'collection-staging';
    workspace.collections[0].requests[0].folderId = 'orders-folder';
    workspace.cookies = [{ id: 'cookie-session', name: 'session', value: 'abc', domain: 'api.acme.dev', path: '/', secure: true, httpOnly: true, sameSite: 'lax', hostOnly: true, createdAt: '2026-07-16T12:00:00.000Z' }];
    const v4Export = exportArtifact(workspace, { format: 'insomnia-v4', scope: 'all' });
    const v4Import = importArtifact(v4Export.contents, v4Export.fileName);
    expect(v4Import.format).toBe('insomnia-v4');
    expect(v4Import.collections).toHaveLength(workspace.collections.length);
    expect(v4Import.collections.reduce((total, collection) => total + collection.requests.length, 0)).toBe(workspace.collections.reduce((total, collection) => total + collection.requests.length, 0));
    expect(new Set(v4Import.collections.flatMap((collection) => collection.requests.map((request) => request.id))).size).toBe(workspace.collections.reduce((total, collection) => total + collection.requests.length, 0));
    expect(v4Import.collections[0].requests[0].auth).toMatchObject({ type: 'hawk', hawkId: 'client' });
    expect(v4Import.collections[0].requests[0].documentation).toBe('Request docs');
    expect(v4Import.collections[0].requests[0].transport.followRedirectsMode).toBe('off');
    expect(v4Import.collections[0].requests[0]).toMatchObject({ method: 'PROPFIND', url: 'https://api.acme.dev/v1/orders/{orderId}' });
    expect(v4Import.collections[0].requests[0].pathParams[0]).toMatchObject({ name: 'orderId', value: 'ord/one', description: 'Order identifier' });
    expect(v4Import.collections[0].requests[0].headers[0].description).toBe('Payload type');
    expect(v4Import.collections[0].folders?.[0]).toMatchObject({ name: 'Secured orders', documentation: 'Folder docs' });
    expect(v4Import.collections[0].requests[0].folderId).toBe(v4Import.collections[0].folders?.[0].id);
    expect(v4Import.cookies[0]).toMatchObject({ name: 'session', sameSite: 'lax' });
    expect(v4Import.cookies).toHaveLength(1);
    expect(v4Import.collections[0].environment?.[0]).toMatchObject({ name: 'region', value: 'base' });
    expect(v4Import.collections[0].subEnvironments?.[0]).toMatchObject({ name: 'Staging', variables: [expect.objectContaining({ name: 'region', value: 'staging' })] });
    expect(v4Import.collections.flatMap((collection) => collection.requests).find((request) => request.protocol === 'socketio')).toMatchObject({ socketIo: { path: '/socket.io', eventName: 'message', ack: true, eventListeners: [expect.objectContaining({ eventName: 'order.updated', enabled: true })] } });

    const v5Export = exportArtifact(workspace, { format: 'insomnia-v5', scope: 'all' });
    const v5Import = importArtifact(v5Export.contents, v5Export.fileName);
    expect(v5Import.format).toBe('insomnia-v5');
    expect(v5Import.collections.length).toBeGreaterThanOrEqual(workspace.collections.length);
    const v5RequestIds = v5Import.collections.flatMap((collection) => collection.requests.map((request) => request.id));
    expect(new Set(v5RequestIds).size).toBe(v5RequestIds.length);
    expect(v5Import.mockServers[0].routes[0].status).toBe(200);
    expect(v5Import.collections[0].requests[0].auth).toMatchObject({ type: 'hawk', hawkId: 'client' });
    expect(v5Import.collections[0].requests[0].documentation).toBe('Request docs');
    expect(v5Import.collections[0].requests[0].transport.followRedirectsMode).toBe('off');
    expect(v5Import.collections[0].requests[0].pathParams[0]).toMatchObject({ name: 'orderId', value: 'ord/one', description: 'Order identifier' });
    expect(v5Import.collections[0].folders?.[0]).toMatchObject({ name: 'Secured orders', documentation: 'Folder docs' });
    expect(v5Import.collections[0].requests[0].folderId).toBe(v5Import.collections[0].folders?.[0].id);
    expect(v5Import.cookies[0]).toMatchObject({ name: 'session', sameSite: 'lax' });
    expect(v5Import.collections[0].environment?.[0]).toMatchObject({ name: 'region', value: 'base' });
    expect(v5Import.collections[0].subEnvironments?.[0]).toMatchObject({ name: 'Staging', variables: [expect.objectContaining({ name: 'region', value: 'staging' })] });
    expect(v5Import.environments.length).toBeGreaterThan(0);
    expect(v5Import.collections.flatMap((collection) => collection.requests).find((request) => request.protocol === 'socketio')).toMatchObject({ socketIo: { path: '/socket.io', eventName: 'message', ack: true, eventListeners: [expect.objectContaining({ eventName: 'order.updated', enabled: true })] } });
  });

  it('exports and reimports HAR while warning about streaming protocols', () => {
    const workspace = cloneSeedWorkspace();
    const exported = exportArtifact(workspace, { format: 'har', scope: 'all' });
    const imported = importArtifact(exported.contents, exported.fileName);
    expect(imported.format).toBe('har');
    expect(imported.collections[0].requests).toHaveLength(11);
    expect(exported.warnings.filter((warning) => warning.code === 'unsupported-protocol')).toHaveLength(4);
  });

  it('creates scoped Brunomnia and raw OpenAPI exports', () => {
    const workspace = cloneSeedWorkspace();
    const collection = workspace.collections[1];
    const scoped = exportArtifact(workspace, { format: 'brunomnia', scope: 'collection', collectionId: collection.id });
    const parsed = JSON.parse(scoped.contents);
    expect(parsed.collections).toHaveLength(1);
    expect(parsed.collections[0].name).toBe(collection.name);
    expect(parsed.version).toBe(26);

    const design = workspace.apiDesigns[0];
    const spec = exportArtifact(workspace, { format: 'openapi', scope: 'design', designId: design.id });
    expect(spec.contents).toContain('openapi: 3.1.0');
    expect(spec.fileName).toBe('orders-api.yaml');

    const designV5 = exportArtifact(workspace, { format: 'insomnia-v5', scope: 'design', designId: design.id });
    const documents = parseAllDocuments(designV5.contents);
    expect(documents.map((document) => document.toJSON())).toContainEqual(expect.objectContaining({ type: 'spec.insomnia.rest/5.0', name: 'Orders API' }));
  });
});
