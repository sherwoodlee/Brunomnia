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
    expect(request.url).toContain('{{ konnect_service_one_proxy_host }}');
    expect(request.params[0].name).toBe('preview');
    expect(request.body).toBe('{"local":true}');
    expect(request.headers.map((header) => header.name)).toEqual(['Host', 'X-Route', 'X-Custom']);
    expect(mapped.collections.find((collection) => collection.source?.sourceId === 'skipped-routes')?.requests).toHaveLength(1);
    expect(mapped.variables).toEqual(['konnect_service_one_proxy_host']);
  });

  it('rejects plaintext tokens before a Konnect request', async () => {
    await expect(loadKonnectControlPlanes({ enabled: true, baseUrl: 'https://us.api.konghq.com', token: 'plaintext', controlPlaneId: '', controlPlanes: [] }, undefined, {})).rejects.toThrow('complete local-vault');
  });
});
