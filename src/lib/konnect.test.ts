import { describe, expect, it } from 'vitest';
import { cloneSeedWorkspace, createBlankRequest } from '../data/seed';
import { loadKonnectControlPlanes, mapKonnectResources } from './konnect';

describe('Konnect pull mapping', () => {
  it('maps HTTP routes, preserves local request fields, and isolates unsupported protocols', () => {
    const workspace = cloneSeedWorkspace();
    workspace.konnect.controlPlaneId = 'cp-one';
    const existing = createBlankRequest('local-route');
    existing.source = { format: 'konnect-route', sourceId: 'route-one' };
    existing.params = [{ id: 'query', name: 'preview', value: 'true', enabled: true }];
    existing.body = '{"local":true}';
    existing.headers = [{ id: 'custom', name: 'X-Custom', value: 'keep', enabled: true }];
    workspace.collections = [{ id: 'local-service', name: 'Old', expanded: true, source: { format: 'konnect', sourceId: 'service-one' }, requests: [existing] }];

    const mapped = mapKonnectResources(workspace, [{ id: 'service-one', name: 'Orders' }], [
      { id: 'route-one', name: 'List orders', service: { id: 'service-one' }, protocols: ['http'], methods: ['GET'], paths: ['/orders'], hosts: ['api.example.com'], headers: { 'X-Route': ['one'] } },
      { id: 'route-tcp', name: 'TCP route', service: { id: 'service-one' }, protocols: ['tcp'] },
    ]);

    const request = mapped.collections.find((collection) => collection.source?.sourceId === 'service-one')!.requests[0];
    expect(request.url).toContain('{{ konnect_service_one_http_proxy_url }}');
    expect(request.params[0].name).toBe('preview');
    expect(request.body).toBe('{"local":true}');
    expect(request.headers.map((header) => header.name)).toEqual(['Host', 'X-Route', 'X-Custom']);
    expect(mapped.collections.find((collection) => collection.source?.sourceId === 'skipped-routes')?.requests).toHaveLength(1);
    expect(mapped.variables).toEqual(['konnect_service_one_http_proxy_url']);
    expect(mapped.variableDefaults).toEqual({ konnect_service_one_http_proxy_url: 'http://127.0.0.1:8000' });
  });

  it('expands supported protocols, methods, paths, and sanitizes remote templates', () => {
    const workspace = cloneSeedWorkspace();
    workspace.konnect.controlPlaneId = 'cp-one';
    workspace.collections = [];

    const mapped = mapKonnectResources(workspace, [{ id: 'service-one', name: 'Gateway' }], [
      {
        id: 'route-http',
        name: 'Users {{ vault.secret }}',
        service: { id: 'service-one' },
        protocols: ['http', 'https'],
        methods: ['GET', 'POST'],
        paths: ['/users', '~^/users/(?<userId>\\d+)$'],
        hosts: ['api.{{ hidden }}example.com'],
        headers: { 'X-Route': ['one{{ hidden }}'], '{{ remove }}': ['gone'] },
      },
      { id: 'route-ws', name: 'Events', service: { id: 'service-one' }, protocols: ['ws', 'wss'], paths: ['/events'] },
      { id: 'route-grpc', name: 'Greeter', service: { id: 'service-one' }, protocols: ['grpc', 'grpcs'], paths: ['/acme.Greeter/SayHello'], headers: { 'X-Tenant': ['team'] } },
      { id: 'route-sni', name: 'SNI', service: { id: 'service-one' }, protocols: ['https'], snis: ['api.example.com'] },
      { id: 'route-expression', name: 'Expression', service: { id: 'service-one' }, protocols: ['http'], expression: 'http.path == "/"' },
      { id: 'route-tcp', name: 'TCP', service: { id: 'service-one' }, protocols: ['tcp'] },
    ]);

    const collection = mapped.collections.find((candidate) => candidate.source?.sourceId === 'service-one')!;
    expect(collection.requests).toHaveLength(12);
    expect(collection.requests.filter((request) => request.protocol === 'http')).toHaveLength(8);
    expect(collection.requests.filter((request) => request.protocol === 'websocket')).toHaveLength(2);
    expect(collection.requests.filter((request) => request.protocol === 'grpc')).toHaveLength(2);
    const regexRequest = collection.requests.find((request) => request.url.includes('{userid}'))!;
    expect(regexRequest.pathParams).toEqual([expect.objectContaining({ name: 'userid', value: '' })]);
    expect(regexRequest.name).toBe('Users ');
    expect(regexRequest.headers).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Host', value: 'api.example.com' }),
      expect.objectContaining({ name: 'X-Route', value: 'one' }),
    ]));
    const grpc = collection.requests.find((request) => request.url.startsWith('{{ konnect_service_one_grpc_proxy_url }}'))!;
    expect(grpc.grpc).toMatchObject({ service: 'acme.Greeter', method: 'SayHello' });
    expect(grpc.grpc.metadata).toEqual([expect.objectContaining({ name: 'X-Tenant', value: 'team' })]);
    expect(mapped.variables).toHaveLength(6);
    expect(mapped.skipped).toBe(3);
    expect(mapped.collections.find((candidate) => candidate.source?.sourceId === 'skipped-routes')?.requests.map((request) => request.source?.unsupported?.reason)).toEqual(expect.arrayContaining([
      expect.stringContaining('SNI'),
      expect.stringContaining('expression'),
      expect.stringContaining('Unsupported protocol'),
    ]));
  });

  it('replaces only previously managed gRPC metadata on later pulls', () => {
    const workspace = cloneSeedWorkspace();
    workspace.konnect.controlPlaneId = 'cp-one';
    const previous = createBlankRequest('existing-grpc');
    previous.protocol = 'grpc';
    previous.source = { format: 'konnect-route', sourceId: 'route-grpc:grpc:/acme.Greeter/SayHello:grpc', unsupported: { managedHeaderNames: ['x-old'] } };
    previous.grpc.metadata = [
      { id: 'old', name: 'X-Old', value: 'remove', enabled: true },
      { id: 'custom', name: 'X-Custom', value: 'keep', enabled: true },
    ];
    workspace.collections = [{ id: 'service', name: 'Gateway', expanded: true, source: { format: 'konnect', sourceId: 'service-one' }, requests: [previous] }];

    const mapped = mapKonnectResources(workspace, [{ id: 'service-one', name: 'Gateway' }], [
      { id: 'route-grpc', service: { id: 'service-one' }, protocols: ['grpc'], paths: ['/acme.Greeter/SayHello'], headers: { 'X-Tenant': ['team'] } },
    ]);
    const request = mapped.collections[0].requests[0];
    expect(request.id).toBe('existing-grpc');
    expect(request.grpc.metadata.map(({ name, value }) => [name, value])).toEqual([
      ['X-Tenant', 'team'],
      ['X-Custom', 'keep'],
    ]);
    expect(request.source?.unsupported?.managedHeaderNames).toEqual(['x-tenant']);
  });

  it('preserves collection hierarchy and appends each new route combination once', () => {
    const workspace = cloneSeedWorkspace();
    workspace.konnect.controlPlaneId = 'cp-one';
    const previous = createBlankRequest('existing-route');
    previous.folderId = 'route-folder';
    previous.source = { format: 'konnect-route', sourceId: 'route-one' };
    workspace.collections = [{
      id: 'service',
      name: 'Gateway',
      expanded: false,
      source: { format: 'konnect', sourceId: 'service-one' },
      requests: [previous],
      folders: [{ id: 'route-folder', name: 'Saved routes', parentId: '', expanded: true, headers: [], environment: [], preRequestScript: '', tests: '', documentation: 'Folder notes' }],
      resourceOrder: ['route-folder', 'existing-route', 'missing', 'route-folder'],
      environment: [{ id: 'collection-variable', name: 'tenant', value: 'local', enabled: true }],
      subEnvironments: [{ id: 'collection-sub-environment', name: 'Staging', variables: [] }],
      activeSubEnvironmentId: 'collection-sub-environment',
      documentation: 'Collection notes',
    }];

    const mapped = mapKonnectResources(workspace, [{ id: 'service-one', name: 'Gateway' }], [
      { id: 'route-one', service: { id: 'service-one' }, protocols: ['http'], methods: ['GET'], paths: ['/existing'] },
      { id: 'route-two', service: { id: 'service-one' }, protocols: ['http'], methods: ['GET', 'get'], paths: ['/new', '/new'] },
      { id: 'route-three', service: { id: 'service-one' }, protocols: ['http'], methods: ['GET'], paths: ['/new:value', '/new/value'] },
    ]);

    const collection = mapped.collections[0];
    const added = collection.requests.filter((request) => request.id !== 'existing-route');
    expect(collection.requests).toHaveLength(4);
    expect(new Set(added.map((request) => request.id)).size).toBe(3);
    expect(collection.requests[0]).toMatchObject({ id: 'existing-route', folderId: 'route-folder' });
    expect(collection.folders).toEqual([expect.objectContaining({ id: 'route-folder', documentation: 'Folder notes' })]);
    expect(collection.resourceOrder).toEqual(['route-folder', 'existing-route', ...added.map((request) => request.id)]);
    expect(collection.environment).toEqual([expect.objectContaining({ name: 'tenant', value: 'local' })]);
    expect(collection.subEnvironments).toEqual([expect.objectContaining({ id: 'collection-sub-environment' })]);
    expect(collection.activeSubEnvironmentId).toBe('collection-sub-environment');
    expect(collection.documentation).toBe('Collection notes');
  });

  it('rejects plaintext tokens before a Konnect request', async () => {
    await expect(loadKonnectControlPlanes({ enabled: true, baseUrl: 'https://us.api.konghq.com', token: 'plaintext', controlPlaneId: '', controlPlanes: [] }, undefined, {})).rejects.toThrow('complete local-vault');
  });
});
