import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cloneSeedWorkspace, createBlankRequest } from '../data/seed';
import { applyKonnectVariableDefaults, loadKonnectControlPlaneResources, loadKonnectControlPlanes, mapKonnectResources } from './konnect';

const transport = vi.hoisted(() => ({ sendRequest: vi.fn() }));

vi.mock('./http', () => ({ sendRequest: transport.sendRequest }));

beforeEach(() => transport.sendRequest.mockReset());

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
      { id: 'route-expression', name: 'Expression', service: { id: 'service-one' }, protocols: ['http', 'https'], expression: 'http.method == "GET" && http.path ^= "/expression" && http.host == "expression.example.com" && http.headers.x_tenant == "acme"' },
      { id: 'route-expression-path-only', name: 'Path only expression', service: { id: 'service-one' }, protocols: ['http'], expression: 'http.path == "/path-only"' },
      { id: 'route-expression-method-only', name: 'Method only expression', service: { id: 'service-one' }, protocols: ['http'], expression: 'http.method == "GET"' },
      { id: 'route-expression-unsupported', name: 'Unsupported expression', service: { id: 'service-one' }, protocols: ['http'], expression: 'net.src.ip in 10.0.0.0/8' },
      { id: 'route-expression-sni', name: 'Expression SNI', service: { id: 'service-one' }, protocols: ['https'], expression: 'tls.sni == "secure.example.com" && http.method == "GET"' },
      { id: 'route-tcp', name: 'TCP', service: { id: 'service-one' }, protocols: ['tcp'] },
      { name: 'Missing ID', service: { id: 'service-one' }, protocols: ['http'], paths: ['/missing'] },
    ]);

    const collection = mapped.collections.find((candidate) => candidate.source?.sourceId === 'service-one')!;
    expect(collection.requests).toHaveLength(20);
    expect(collection.requests.filter((request) => request.protocol === 'http')).toHaveLength(16);
    expect(collection.requests.filter((request) => request.protocol === 'websocket')).toHaveLength(2);
    expect(collection.requests.filter((request) => request.protocol === 'grpc')).toHaveLength(2);
    const regexRequest = collection.requests.find((request) => request.url.includes('{userid}'))!;
    expect(regexRequest.pathParams).toEqual([expect.objectContaining({ name: 'userid', value: '' })]);
    expect(regexRequest.name).toBe('/users/{userid}');
    expect(regexRequest.headers).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Host', value: 'api.example.com' }),
      expect.objectContaining({ name: 'X-Route', value: 'one' }),
    ]));
    const grpc = collection.requests.find((request) => request.url.startsWith('{{ konnect_service_one_grpc_proxy_url }}'))!;
    expect(grpc.grpc).toMatchObject({ service: 'acme.Greeter', method: 'SayHello' });
    expect(grpc.grpc.metadata).toEqual([expect.objectContaining({ name: 'X-Tenant', value: 'team' })]);
    expect(collection.folders).toHaveLength(16);
    const httpFolder = collection.folders?.find((folder) => folder.source?.sourceId === 'route-http:folder:HTTP /users')!;
    const httpParent = collection.folders?.find((folder) => folder.source?.sourceId === 'route-http:route')!;
    expect(httpFolder).toMatchObject({ name: 'HTTP /users', parentId: httpParent.id });
    expect(collection.requests.find((request) => request.source?.sourceId === 'route-http:GET:/users:http')?.folderId).toBe(httpFolder.id);
    const wssFolder = collection.folders?.find((folder) => folder.source?.sourceId === 'route-ws:folder:WSS /events')!;
    expect(wssFolder.name).toBe('WSS /events');
    expect(collection.requests.find((request) => request.source?.sourceId === 'route-ws:ws:/events:wss')?.folderId).toBe(wssFolder.id);
    const grpcsFolder = collection.folders?.find((folder) => folder.source?.sourceId === 'route-grpc:folder:GRPCS /acme.Greeter/SayHello')!;
    expect(grpcsFolder.name).toBe('GRPCS /acme.Greeter/SayHello');
    expect(collection.requests.find((request) => request.source?.sourceId === 'route-grpc:grpc:/acme.Greeter/SayHello:grpcs')?.folderId).toBe(grpcsFolder.id);
    const expressionRequests = collection.requests.filter((request) => request.source?.unsupported?.routeId === 'route-expression');
    expect(expressionRequests).toHaveLength(2);
    expect(expressionRequests).toEqual(expect.arrayContaining([
      expect.objectContaining({ method: 'GET', name: '/expression', url: expect.stringContaining('/expression') }),
    ]));
    expect(expressionRequests[0].headers).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Host', value: 'expression.example.com' }),
      expect.objectContaining({ name: 'x-tenant', value: 'acme' }),
    ]));
    expect(collection.requests.filter((request) => request.source?.unsupported?.routeId === 'route-expression-path-only')).toHaveLength(5);
    expect(collection.requests.find((request) => request.source?.unsupported?.routeId === 'route-expression-method-only')).toMatchObject({
      method: 'GET',
      name: 'Method only expression',
      url: '{{ konnect_service_one_http_proxy_url }}',
    });
    expect(mapped.variables).toHaveLength(6);
    expect(mapped.skipped).toBe(5);
    expect(mapped.collections.find((candidate) => candidate.source?.sourceId === 'skipped-routes')?.requests.map((request) => request.source?.unsupported?.reason)).toEqual(expect.arrayContaining([
      expect.stringContaining('SNI'),
      expect.stringContaining('Unsupported protocol'),
      expect.stringContaining('identifier'),
      expect.stringContaining('no extractable'),
      expect.stringContaining('tls.sni'),
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
    const managedFolders = collection.folders!.filter((folder) => folder.source?.format === 'konnect-route-folder');
    expect(collection.requests).toHaveLength(4);
    expect(new Set(added.map((request) => request.id)).size).toBe(3);
    expect(collection.requests[0]).toMatchObject({ id: 'existing-route', folderId: 'route-folder' });
    expect(collection.folders).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'route-folder', documentation: 'Folder notes' })]));
    expect(collection.resourceOrder).toEqual(['route-folder', 'existing-route', ...managedFolders.map((folder) => folder.id), ...added.map((request) => request.id)]);
    expect(collection.environment).toEqual([expect.objectContaining({ name: 'tenant', value: 'local' })]);
    expect(collection.subEnvironments).toEqual([expect.objectContaining({ id: 'collection-sub-environment' })]);
    expect(collection.activeSubEnvironmentId).toBe('collection-sub-environment');
    expect(collection.documentation).toBe('Collection notes');
  });

  it('reconciles only managed folders and preserves their local state', () => {
    const workspace = cloneSeedWorkspace();
    workspace.konnect.controlPlaneId = 'cp-one';
    workspace.collections = [];
    const services = [{ id: 'service-one', name: 'Gateway' }];
    const initial = mapKonnectResources(workspace, services, [
      { id: 'route-one', name: 'Original', service: { id: 'service-one' }, protocols: ['http'], methods: ['GET'], paths: ['~^/one/(?<id>\\d+)$', '/other'] },
      { id: 'route-stale', name: 'Stale', service: { id: 'service-one' }, protocols: ['http'], methods: ['GET'], paths: ['/stale'] },
    ]).collections[0];
    const routeFolder = initial.folders!.find((folder) => folder.source?.sourceId === 'route-one:route')!;
    const equivalentRegexFolder = initial.folders!.find((folder) => folder.source?.sourceId === 'route-one:folder:/one/{id}')!;
    const staleFolder = initial.folders!.find((folder) => folder.source?.sourceId === 'route-stale:route')!;
    routeFolder.expanded = false;
    routeFolder.documentation = 'Keep folder notes';
    routeFolder.headers = [{ id: 'folder-header', name: 'X-Folder', value: 'keep', enabled: true }];
    routeFolder.environment = [{ id: 'folder-variable', name: 'folder_value', value: 'keep', enabled: true }];
    routeFolder.auth = { ...createBlankRequest('folder-auth').auth, type: 'basic', username: 'local' };
    routeFolder.preRequestScript = 'console.log("before")';
    routeFolder.tests = 'insomnia.test("after", () => {})';
    equivalentRegexFolder.documentation = 'Keep equivalent regex folder';
    initial.folders!.push({ id: 'local-folder', name: 'Local', parentId: routeFolder.id, expanded: true, headers: [], environment: [], preRequestScript: '', tests: '', documentation: 'Local notes' });
    initial.folders!.push({ id: 'orphaned-local-folder', name: 'Orphaned local', parentId: staleFolder.id, expanded: true, headers: [], environment: [], preRequestScript: '', tests: '', documentation: '' });
    workspace.collections = [initial];

    const updated = mapKonnectResources(workspace, services, [
      { id: 'route-one', name: 'Renamed', service: { id: 'service-one' }, protocols: ['http'], methods: ['GET'], paths: ['~^/one/(?<id>[0-9]+)$', '/other'] },
    ]).collections[0];
    const updatedRouteFolder = updated.folders!.find((folder) => folder.source?.sourceId === 'route-one:route')!;
    const updatedRegexFolder = updated.folders!.find((folder) => folder.source?.sourceId === 'route-one:folder:/one/{id}')!;
    expect(updatedRouteFolder).toMatchObject({
      id: routeFolder.id,
      name: 'Renamed',
      expanded: false,
      documentation: 'Keep folder notes',
      headers: [expect.objectContaining({ name: 'X-Folder', value: 'keep' })],
      environment: [expect.objectContaining({ name: 'folder_value', value: 'keep' })],
      auth: expect.objectContaining({ type: 'basic', username: 'local' }),
      preRequestScript: 'console.log("before")',
      tests: 'insomnia.test("after", () => {})',
    });
    expect(updated.folders).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'local-folder', parentId: routeFolder.id, documentation: 'Local notes' })]));
    expect(updated.folders).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'orphaned-local-folder', parentId: '' })]));
    expect(updatedRegexFolder).toMatchObject({ id: equivalentRegexFolder.id, documentation: 'Keep equivalent regex folder' });
    expect(updated.folders?.some((folder) => folder.source?.sourceId?.startsWith('route-stale:'))).toBe(false);
  });

  it('derives protocol URLs from the selected control plane and preserves edited variables', () => {
    const workspace = cloneSeedWorkspace();
    workspace.konnect.controlPlaneId = 'cp-one';
    workspace.konnect.controlPlanes = [{
      id: 'cp-one',
      name: 'Cloud Gateway',
      description: '',
      region: 'us',
      clusterType: 'CLUSTER_TYPE_CONTROL_PLANE',
      deploymentType: 'dedicatedCloud',
      proxyUrls: [
        { host: 'gateway.example.com', port: 443, protocol: 'https' },
        { host: '2001:db8::1', port: 9000, protocol: 'grpc' },
        { host: 'secure-grpc.example.com', port: 443, protocol: 'grpcs' },
      ],
    }];
    workspace.collections = [];

    const mapped = mapKonnectResources(workspace, [{ id: 'service-one', name: 'Gateway' }], [
      { id: 'route-http', service: { id: 'service-one' }, protocols: ['http', 'https'], methods: ['GET'], paths: ['/'] },
      { id: 'route-ws', service: { id: 'service-one' }, protocols: ['ws', 'wss'], paths: ['/events'] },
      { id: 'route-grpc', service: { id: 'service-one' }, protocols: ['grpc', 'grpcs'], paths: ['/acme.Greeter/SayHello'] },
    ]);

    expect(mapped.variableDefaults).toEqual({
      konnect_service_one_http_proxy_url: 'http://gateway.example.com',
      konnect_service_one_https_proxy_url: 'https://gateway.example.com',
      konnect_service_one_ws_proxy_url: 'ws://gateway.example.com',
      konnect_service_one_wss_proxy_url: 'wss://gateway.example.com',
      konnect_service_one_grpc_proxy_url: 'grpc://[2001:db8::1]:9000',
      konnect_service_one_grpcs_proxy_url: 'grpcs://secure-grpc.example.com:443',
    });

    const variables = applyKonnectVariableDefaults([
      { id: 'konnect-variable-http', name: 'konnect_service_one_http_proxy_url', value: 'http://127.0.0.1:8000', enabled: true },
      { id: 'konnect-variable-https', name: 'konnect_service_one_https_proxy_url', value: '', enabled: true },
      { id: 'konnect-variable-grpc', name: 'konnect_service_one_grpc_proxy_url', value: 'grpc://custom.example:9443', enabled: true },
      { id: 'custom-wss', name: 'konnect_service_one_wss_proxy_url', value: '', enabled: true },
    ], mapped.variableDefaults, mapped.variableProtocols);
    expect(Object.fromEntries(variables.map((variable) => [variable.name, variable.value]))).toMatchObject({
      konnect_service_one_http_proxy_url: 'http://gateway.example.com',
      konnect_service_one_https_proxy_url: 'https://gateway.example.com',
      konnect_service_one_ws_proxy_url: 'ws://gateway.example.com',
      konnect_service_one_wss_proxy_url: '',
      konnect_service_one_grpc_proxy_url: 'grpc://custom.example:9443',
      konnect_service_one_grpcs_proxy_url: 'grpcs://secure-grpc.example.com:443',
    });
  });

  it('retains only bounded safe proxy URLs from control-plane discovery', async () => {
    transport.sendRequest.mockResolvedValue({
      status: 200,
      body: JSON.stringify({
        data: [{
          id: 'cp-one',
          name: 'Gateway {{ vault.hidden }}',
          description: 'Remote {% secret %}',
          proxy_urls: [
            { host: 'gateway.example.com', port: 443, protocol: 'HTTPS' },
            { host: '{{ vault.proxy }}', port: 443, protocol: 'https' },
            { host: 'bad.example.com/path', port: 443, protocol: 'https' },
            { host: 'bad.example.com:443', port: 443, protocol: 'https' },
            { host: 'grpc.example.com', port: 70_000, protocol: 'grpc' },
          ],
        }],
      }),
    });

    const controlPlanes = await loadKonnectControlPlanes({ enabled: true, baseUrl: 'https://us.api.konghq.com', token: '{{ vault.konnect }}', controlPlaneId: '', controlPlanes: [] }, undefined, {});
    expect(controlPlanes).toEqual([{
      id: 'cp-one',
      name: 'Gateway ',
      description: 'Remote ',
      region: 'us',
      clusterType: '',
      deploymentType: 'selfManaged',
      proxyUrls: [{ host: 'gateway.example.com', port: 443, protocol: 'https' }],
    }]);
  });

  it('follows pinned page-number and offset pagination', async () => {
    const requestedUrls: string[] = [];
    let emptyCalls = 0;
    transport.sendRequest.mockImplementation(async (request?: { url: string }) => {
      if (!request) {
        emptyCalls += 1;
        return { status: 200, body: JSON.stringify({ data: [] }) };
      }
      requestedUrls.push(request.url);
      const url = new URL(request.url);
      if (url.pathname.endsWith('/v2/control-planes')) {
        const page = url.searchParams.get('page[number]');
        return {
          status: 200,
          body: JSON.stringify({
            data: [{ id: `cp-${page}`, name: `Plane ${page}`, config: {} }],
            meta: { page: { total: 101 } },
          }),
        };
      }
      if (url.pathname.endsWith('/core-entities/services')) {
        return url.searchParams.get('offset') === 'next-services'
          ? { status: 200, body: JSON.stringify({ data: [{ id: 'service-two', name: 'Two' }], offset: null }) }
          : { status: 200, body: JSON.stringify({ data: [{ id: 'service-one', name: 'One' }], offset: 'next-services' }) };
      }
      if (url.pathname.endsWith('/routes')) return { status: 200, body: JSON.stringify({ data: [], offset: null }) };
      throw new Error(`Unexpected URL: ${request.url}`);
    });
    const config = { enabled: true, baseUrl: 'https://us.api.konghq.com', token: '{{ vault.konnect }}', controlPlaneId: '', controlPlanes: [] };

    const controlPlanes = await loadKonnectControlPlanes(config, undefined, {});
    expect(controlPlanes.map((plane) => plane.id)).toEqual(['cp-1', 'cp-2']);
    const resources = await loadKonnectControlPlaneResources(config, controlPlanes[0], undefined, {});
    expect(resources.services).toEqual([{ id: 'service-one', name: 'One' }, { id: 'service-two', name: 'Two' }]);
    expect(requestedUrls.filter((url) => new URL(url).pathname.endsWith('/routes'))).toHaveLength(2);
    expect(emptyCalls).toBe(0);
  });

  it('retries rate limits with bounded exponential backoff', async () => {
    vi.useFakeTimers();
    try {
      transport.sendRequest
        .mockResolvedValueOnce({ status: 429, headers: {}, body: 'rate limited' })
        .mockResolvedValueOnce({ status: 200, headers: {}, body: JSON.stringify({ data: [] }) });
      const pending = loadKonnectControlPlanes({ enabled: true, baseUrl: 'https://us.api.konghq.com', token: '{{ vault.konnect }}', controlPlaneId: '', controlPlanes: [] }, undefined, {});
      await vi.advanceTimersByTimeAsync(1_000);
      await expect(pending).resolves.toEqual([]);
      expect(transport.sendRequest).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('rejects plaintext tokens before a Konnect request', async () => {
    await expect(loadKonnectControlPlanes({ enabled: true, baseUrl: 'https://us.api.konghq.com', token: 'plaintext', controlPlaneId: '', controlPlanes: [] }, undefined, {})).rejects.toThrow('complete local-vault');
  });
});
