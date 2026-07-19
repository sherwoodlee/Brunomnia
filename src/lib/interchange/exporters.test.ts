import { describe, expect, it } from 'vitest';
import { parseAllDocuments, stringify } from 'yaml';
import { cloneSeedWorkspace } from '../../data/seed';
import { orderedCollectionChildren } from '../resources';
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
    workspace.collections[0].requests[0].disableUserAgentHeader = true;
    workspace.collections[0].requests[0].renderBodyTemplates = false;
    workspace.collections[0].requests[0].bodyMode = 'multipart';
    workspace.collections[0].requests[0].multipartBody = [
      { id: 'multiline', name: 'payload', value: '{\n  "ok": true\n}', enabled: true, description: 'JSON document', kind: 'text', multiline: true, contentType: 'application/json' },
      { id: 'disabled', name: 'optional', value: 'off', enabled: false, description: 'Disabled field', kind: 'text', multiline: false, contentType: '' },
    ];
    workspace.collections[0].requests[1].name = 'Form controls';
    workspace.collections[0].requests[1].bodyMode = 'form-urlencoded';
    workspace.collections[0].requests[1].formBody = [{ id: 'form-value', name: 'notes', value: 'one\ntwo', enabled: false, description: 'Multiline notes', multiline: true }];
    workspace.collections[0].folders = [{ id: 'orders-folder', name: 'Secured orders', parentId: '', expanded: true, headers: [{ id: 'folder-header', name: 'X-Team', value: 'orders', enabled: true }], environment: [{ id: 'folder-variable', name: 'scope', value: 'orders', enabled: true }], auth: { ...workspace.collections[0].requests[0].auth, type: 'bearer', token: '{{ vault.orders }}' }, preRequestScript: 'folderPre();', tests: 'folderAfter();', documentation: 'Folder docs' }];
    workspace.collections[0].environment = [{ id: 'collection-base', name: 'region', value: 'base', enabled: true }];
    workspace.collections[0].subEnvironments = [{ id: 'collection-staging', name: 'Staging', variables: [{ id: 'collection-selected', name: 'region', value: 'staging', enabled: true }] }];
    workspace.collections[0].activeSubEnvironmentId = 'collection-staging';
    workspace.collections[0].requests[0].folderId = 'orders-folder';
    const grpcRequest = workspace.collections.flatMap((collection) => collection.requests).find((request) => request.protocol === 'grpc')!;
    grpcRequest.grpc.descriptorSource = 'buf';
    grpcRequest.grpc.reflectionApiUrl = 'https://buf.example.com';
    grpcRequest.grpc.reflectionApiKey = '{{ vault.buf }}';
    grpcRequest.grpc.reflectionApiModule = 'buf.build/acme/greeter';
    grpcRequest.disableUserAgentHeader = true;
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
    expect(v4Import.collections[0].requests[0].renderBodyTemplates).toBe(false);
    expect(v4Import.collections[0].requests[0].disableUserAgentHeader).toBe(true);
    expect(v4Import.collections[0].requests[0].multipartBody).toEqual([
      expect.objectContaining({ name: 'payload', multiline: true, contentType: 'application/json', description: 'JSON document', enabled: true }),
      expect.objectContaining({ name: 'optional', multiline: false, description: 'Disabled field', enabled: false }),
    ]);
    expect(v4Import.collections[0].requests.find((request) => request.name === 'Form controls')?.formBody[0]).toMatchObject({ name: 'notes', value: 'one\ntwo', enabled: false, description: 'Multiline notes', multiline: true });
    expect(v4Import.collections[0].folders?.[0]).toMatchObject({ name: 'Secured orders', documentation: 'Folder docs' });
    expect(v4Import.collections[0].requests[0].folderId).toBe(v4Import.collections[0].folders?.[0].id);
    expect(v4Import.cookies[0]).toMatchObject({ name: 'session', sameSite: 'lax' });
    expect(v4Import.cookies).toHaveLength(1);
    expect(v4Import.collections[0].environment?.[0]).toMatchObject({ name: 'region', value: 'base' });
    expect(v4Import.collections[0].subEnvironments?.[0]).toMatchObject({ name: 'Staging', variables: [expect.objectContaining({ name: 'region', value: 'staging' })] });
    expect(v4Import.collections.flatMap((collection) => collection.requests).find((request) => request.protocol === 'socketio')).toMatchObject({ socketIo: { path: '/socket.io', eventName: 'message', ack: true, eventListeners: [expect.objectContaining({ eventName: 'order.updated', enabled: true })] } });
    expect(v4Import.collections.flatMap((collection) => collection.requests).find((request) => request.protocol === 'grpc')).toMatchObject({ disableUserAgentHeader: true, grpc: { descriptorSource: 'buf', reflectionApiUrl: 'https://buf.example.com', reflectionApiKey: '{{ vault.buf }}', reflectionApiModule: 'buf.build/acme/greeter' } });

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
    expect(v5Import.collections[0].requests[0].renderBodyTemplates).toBe(false);
    expect(v5Import.collections[0].requests[0].disableUserAgentHeader).toBe(true);
    expect(v5Import.collections[0].requests[0].multipartBody[0]).toMatchObject({ multiline: true, contentType: 'application/json', description: 'JSON document' });
    expect(v5Import.collections.flatMap((collection) => collection.requests).find((request) => request.name === 'Form controls')?.formBody[0]).toMatchObject({ enabled: false, description: 'Multiline notes', multiline: true });
    expect(v5Import.collections[0].folders?.[0]).toMatchObject({ name: 'Secured orders', documentation: 'Folder docs' });
    expect(v5Import.collections[0].requests[0].folderId).toBe(v5Import.collections[0].folders?.[0].id);
    expect(v5Import.cookies[0]).toMatchObject({ name: 'session', sameSite: 'lax' });
    expect(v5Import.collections[0].environment?.[0]).toMatchObject({ name: 'region', value: 'base' });
    expect(v5Import.collections[0].subEnvironments?.[0]).toMatchObject({ name: 'Staging', variables: [expect.objectContaining({ name: 'region', value: 'staging' })] });
    expect(v5Import.environments.length).toBeGreaterThan(0);
    expect(v5Import.collections.flatMap((collection) => collection.requests).find((request) => request.protocol === 'socketio')).toMatchObject({ socketIo: { path: '/socket.io', eventName: 'message', ack: true, eventListeners: [expect.objectContaining({ eventName: 'order.updated', enabled: true })] } });
    expect(v5Import.collections.flatMap((collection) => collection.requests).find((request) => request.protocol === 'grpc')).toMatchObject({ disableUserAgentHeader: true, grpc: { descriptorSource: 'buf', reflectionApiUrl: 'https://buf.example.com', reflectionApiKey: '{{ vault.buf }}', reflectionApiModule: 'buf.build/acme/greeter' } });
  });

  it('exports and reimports HAR while warning about streaming protocols', () => {
    const workspace = cloneSeedWorkspace();
    const exported = exportArtifact(workspace, { format: 'har', scope: 'all' });
    const imported = importArtifact(exported.contents, exported.fileName);
    expect(imported.format).toBe('har');
    expect(imported.collections[0].requests).toHaveLength(11);
    expect(exported.warnings.filter((warning) => warning.code === 'unsupported-protocol')).toHaveLength(4);
  });

  it('round-trips arbitrary mixed request and folder sibling order through Insomnia v4 and v5', () => {
    const workspace = cloneSeedWorkspace();
    const collection = workspace.collections[0];
    collection.requests = collection.requests.slice(0, 4);
    collection.requests[0].name = 'Root first';
    collection.requests[1].name = 'Folder request';
    collection.requests[2].name = 'Root last';
    collection.requests[3].name = 'Nested request';
    collection.folders = [
      { id: 'root-folder', name: 'Root folder', parentId: '', expanded: true, headers: [], environment: [], preRequestScript: '', tests: '', documentation: '' },
      { id: 'nested-folder', name: 'Nested folder', parentId: 'root-folder', expanded: true, headers: [], environment: [], preRequestScript: '', tests: '', documentation: '' },
    ];
    collection.requests[1].folderId = 'root-folder';
    collection.requests[3].folderId = 'nested-folder';
    collection.resourceOrder = [collection.requests[0].id, 'root-folder', collection.requests[2].id, collection.requests[1].id, 'nested-folder', collection.requests[3].id];

    const childNames = (candidate: typeof collection, parentId = '') => orderedCollectionChildren(candidate, parentId).map((resource) => resource.kind === 'folder'
      ? candidate.folders?.find((folder) => folder.id === resource.id)?.name
      : candidate.requests.find((request) => request.id === resource.id)?.name);

    for (const format of ['insomnia-v4', 'insomnia-v5'] as const) {
      const exported = exportArtifact(workspace, { format, scope: 'collection', collectionId: collection.id });
      const imported = importArtifact(exported.contents, exported.fileName).collections[0];
      const importedRoot = imported.folders?.find((folder) => folder.name === 'Root folder')!;
      const importedNested = imported.folders?.find((folder) => folder.name === 'Nested folder')!;
      expect(childNames(imported)).toEqual(['Root first', 'Root folder', 'Root last']);
      expect(childNames(imported, importedRoot.id)).toEqual(['Folder request', 'Nested folder']);
      expect(childNames(imported, importedNested.id)).toEqual(['Nested request']);
    }

    const v4 = JSON.parse(exportArtifact(workspace, { format: 'insomnia-v4', scope: 'collection', collectionId: collection.id }).contents) as { resources: Array<Record<string, unknown>> };
    const v4Workspace = v4.resources.find((resource) => resource._type === 'workspace')!;
    const v4RootResources = v4.resources.filter((resource) => resource.parentId === v4Workspace._id && ['request', 'request_group'].includes(String(resource._type)));
    expect([...v4RootResources].sort((left, right) => Number(left.metaSortKey) - Number(right.metaSortKey)).map((resource) => resource.name)).toEqual(['Root first', 'Root folder', 'Root last']);
    const reorderedV4Root = [structuredClone(v4RootResources[2]), structuredClone(v4RootResources[0]), structuredClone(v4RootResources[1])];
    delete reorderedV4Root[0].metaSortKey;
    const partialV4 = { ...v4, resources: [...v4.resources.filter((resource) => !v4RootResources.includes(resource)), ...reorderedV4Root] };
    const partialV4Import = importArtifact(JSON.stringify(partialV4), 'partial-insomnia-v4.json').collections[0];
    expect(childNames(partialV4Import)).toEqual(['Root last', 'Root first', 'Root folder']);

    const v5 = parseAllDocuments(exportArtifact(workspace, { format: 'insomnia-v5', scope: 'collection', collectionId: collection.id }).contents)[0].toJSON() as { collection: Array<{ name: string; meta: { sortKey?: number } }> };
    expect(v5.collection.map((resource) => [resource.name, resource.meta.sortKey])).toEqual([['Root first', 0], ['Root folder', 1], ['Root last', 2]]);
    const partialV5 = structuredClone(v5);
    partialV5.collection = [partialV5.collection[2], partialV5.collection[0], partialV5.collection[1]];
    delete partialV5.collection[0].meta.sortKey;
    const partialV5Import = importArtifact(stringify(partialV5), 'partial-insomnia-v5.yaml').collections[0];
    expect(childNames(partialV5Import)).toEqual(['Root last', 'Root first', 'Root folder']);
  });

  it('round-trips complete gRPC proto trees through Insomnia v4 resources', () => {
    const workspace = cloneSeedWorkspace();
    const request = workspace.collections.flatMap((collection) => collection.requests).find((candidate) => candidate.protocol === 'grpc')!;
    request.grpc.descriptorSource = 'proto';
    request.grpc.protoFiles = [
      { id: 'messages', path: 'types/messages.proto', text: 'syntax = "proto3"; package acme; message HelloRequest { string name = 1; }' },
      { id: 'service', path: 'services/greeter.proto', text: 'syntax = "proto3"; package acme; import "types/messages.proto"; service Greeter { rpc SayHello (HelloRequest) returns (HelloRequest); }' },
    ];
    request.grpc.protoEntryPath = 'services/greeter.proto';
    request.grpc.protoActivePath = 'types/messages.proto';
    request.grpc.protoText = request.grpc.protoFiles[1].text;

    const exported = exportArtifact(workspace, { format: 'insomnia-v4', scope: 'all' });
    const raw = JSON.parse(exported.contents) as { resources: Array<Record<string, unknown>> };
    const grpcResource = raw.resources.find((resource) => resource._type === 'grpc_request' && resource.name === request.name)!;
    const entry = raw.resources.find((resource) => resource._id === grpcResource.protoFileId)!;
    expect(entry).toMatchObject({ _type: 'proto_file', name: 'greeter.proto', protoText: request.grpc.protoFiles[1].text });
    expect(raw.resources.filter((resource) => resource._type === 'proto_file')).toHaveLength(2);
    expect(raw.resources.filter((resource) => resource._type === 'proto_directory')).toHaveLength(3);

    const imported = importArtifact(exported.contents, exported.fileName);
    const roundTripped = imported.collections.flatMap((collection) => collection.requests).find((candidate) => candidate.name === request.name)!;
    expect(roundTripped.grpc).toMatchObject({
      descriptorSource: 'proto',
      protoEntryPath: 'services/greeter.proto',
      protoActivePath: 'services/greeter.proto',
      protoText: request.grpc.protoFiles[1].text,
    });
    expect(roundTripped.grpc.protoFiles.map((file) => [file.path, file.text])).toEqual([
      ['types/messages.proto', request.grpc.protoFiles[0].text],
      ['services/greeter.proto', request.grpc.protoFiles[1].text],
    ]);

    const v5 = exportArtifact(workspace, { format: 'insomnia-v5', scope: 'all' });
    expect(v5.warnings).toContainEqual(expect.objectContaining({ code: 'external-schema', resource: request.name }));
  });

  it('creates scoped Brunomnia and raw OpenAPI exports', () => {
    const workspace = cloneSeedWorkspace();
    workspace.certificates.clients = [{ id: 'pfx', host: 'api.example.test', enabled: true, certificatePem: '', keyPem: '', pfxBase64: 'cGZ4', passphrase: 'secret' }];
    const collection = workspace.collections[1];
    workspace.testSuites = [{ id: 'suite', name: 'Scoped suite', sortKey: 0, tests: [
      { id: 'included', name: 'Included', code: '', requestId: collection.requests[0].id, sortKey: 0 },
      { id: 'excluded', name: 'Excluded', code: '', requestId: workspace.collections[0].requests[0].id, sortKey: 1 },
    ] }];
    workspace.unitTestResults = [{ id: 'run', suiteId: 'suite', startedAt: '2026-07-19T00:00:00.000Z', finishedAt: '2026-07-19T00:00:01.000Z', tests: [
      { testId: 'included', name: 'Included', requestId: collection.requests[0].id, passed: true, durationMs: 1, logs: [] },
      { testId: 'excluded', name: 'Excluded', requestId: workspace.collections[0].requests[0].id, passed: true, durationMs: 1, logs: [] },
    ] }];
    const scoped = exportArtifact(workspace, { format: 'brunomnia', scope: 'collection', collectionId: collection.id });
    const parsed = JSON.parse(scoped.contents);
    expect(parsed.collections).toHaveLength(1);
    expect(parsed.collections[0].name).toBe(collection.name);
    expect(parsed.version).toBe(35);
    expect(parsed.testSuites).toEqual([expect.objectContaining({ id: 'suite', tests: [expect.objectContaining({ id: 'included' })] })]);
    expect(parsed.unitTestResults).toEqual([expect.objectContaining({ id: 'run', suiteId: 'suite', tests: [expect.objectContaining({ testId: 'included' })] })]);
    expect(parsed.certificates.clients[0]).toMatchObject({ pfxBase64: 'cGZ4', passphrase: 'secret' });

    const design = workspace.apiDesigns[0];
    const spec = exportArtifact(workspace, { format: 'openapi', scope: 'design', designId: design.id });
    expect(spec.contents).toContain('openapi: 3.1.0');
    expect(spec.fileName).toBe('orders-api.yaml');

    const designV5 = exportArtifact(workspace, { format: 'insomnia-v5', scope: 'design', designId: design.id });
    const documents = parseAllDocuments(designV5.contents);
    expect(documents.map((document) => document.toJSON())).toContainEqual(expect.objectContaining({ type: 'spec.insomnia.rest/5.0', name: 'Orders API' }));
  });
});
