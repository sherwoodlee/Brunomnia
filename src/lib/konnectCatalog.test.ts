import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { KonnectControlPlane } from '../types';
import { createBlankWorkspace, createCatalogWorkspace, loadWorkspaceCatalog, openCatalogWorkspace, readCatalogWorkspace } from './workspaceCatalog';
import { planKonnectCatalogReconciliation, syncKonnectCatalog } from './konnectCatalog';

const transport = vi.hoisted(() => ({ sendRequest: vi.fn() }));
vi.mock('./http', () => ({ sendRequest: transport.sendRequest }));

class MemoryStorage implements Storage {
  readonly values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

const controlPlane = (id: string, region: string): KonnectControlPlane => ({
  id,
  name: `Control plane ${id}`,
  description: '',
  region,
  clusterType: 'CLUSTER_TYPE_CONTROL_PLANE',
  deploymentType: 'dedicatedCloud',
  proxyUrls: [{ host: `${id}.example.com`, port: 443, protocol: 'https' }],
});

const response = (data: unknown[]) => ({ status: 200, body: JSON.stringify({ data }) });

describe('Konnect catalog reconciliation', () => {
  beforeEach(() => {
    transport.sendRequest.mockReset();
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: new MemoryStorage() });
    Object.defineProperty(globalThis, 'isTauri', { configurable: true, value: false });
  });

  it('retains failed regions while deleting duplicates and stale projects only in successful regions', () => {
    const incoming = [controlPlane('current', 'us')];
    const existing = [
      { workspaceId: 'current', controlPlaneId: 'current', region: 'us' },
      { workspaceId: 'duplicate', controlPlaneId: 'current', region: 'us' },
      { workspaceId: 'stale-us', controlPlaneId: 'stale', region: 'us' },
      { workspaceId: 'stale-eu', controlPlaneId: 'stale', region: 'eu' },
    ];

    expect(planKonnectCatalogReconciliation(existing, incoming, new Set(['us']))).toEqual({
      upserts: [{ controlPlane: incoming[0], workspaceId: 'current' }],
      deleteWorkspaceIds: ['duplicate', 'stale-us'],
    });
    expect(planKonnectCatalogReconciliation(existing, incoming, new Set(['us', 'eu'])).deleteWorkspaceIds).toEqual(['duplicate', 'stale-us', 'stale-eu']);
  });

  it('creates credential-free inactive projects and retains them when a later region fetch fails', async () => {
    const initial = await loadWorkspaceCatalog();
    const coordinator = {
      ...initial.workspace,
      name: 'Coordinator',
      konnect: { ...initial.workspace.konnect, enabled: true, token: '{{ vault.konnect }}' },
    };
    transport.sendRequest.mockImplementation(async (request: { url: string }) => {
      const url = new URL(request.url);
      if (url.pathname.endsWith('/v2/control-planes')) return response([{
        id: 'cp-one',
        name: 'Gateway',
        description: 'Managed gateway',
        config: { cluster_type: 'CLUSTER_TYPE_CONTROL_PLANE', cloud_gateway: true },
        proxy_urls: [{ host: 'gateway.example.com', port: 443, protocol: 'https' }],
      }]);
      if (url.pathname.endsWith('/core-entities/services')) return response([{ id: 'service-one', name: 'Orders' }]);
      if (url.pathname.endsWith('/core-entities/services/service-one/routes')) return response([{
        id: 'route-one', name: 'List orders', service: { id: 'service-one' }, protocols: ['https'], methods: ['GET'], paths: ['/orders'],
      }]);
      throw new Error(`Unexpected Konnect URL: ${request.url}`);
    });

    const progress: string[] = [];
    const first = await syncKonnectCatalog({
      coordinator,
      coordinatorWorkspaceId: initial.activeWorkspaceId,
      environment: undefined,
      requestContext: {},
      regions: ['us'],
      onProgress: (message) => progress.push(message),
    });

    expect(first.catalog.activeWorkspaceId).toBe(initial.activeWorkspaceId);
    expect(first.controlPlanes).toMatchObject({ total: 1, created: 1, deleted: 0 });
    expect(first.services).toMatchObject({ total: 1, created: 1 });
    expect(first.routes).toMatchObject({ total: 1, created: 1, skipped: 0 });
    expect(progress).toEqual(expect.arrayContaining(['Fetching control planes in us…', 'Syncing Gateway in us…', 'Synced Gateway in us.']));
    const managedEntry = first.catalog.entries.find((entry) => entry.id !== initial.activeWorkspaceId)!;
    const managed = await readCatalogWorkspace(managedEntry.id);
    expect(managed).toMatchObject({
      name: 'Gateway',
      activeEnvironmentId: expect.stringContaining('konnect-environment-'),
      konnect: {
        enabled: false,
        token: '',
        managedByWorkspaceId: initial.activeWorkspaceId,
        managedControlPlaneId: 'cp-one',
        managedRegion: 'us',
        managedDeploymentType: 'dedicatedCloud',
      },
    });
    expect(managed.environments).toHaveLength(1);
    expect(managed.collections).toHaveLength(1);
    expect(managed.collections[0]).toMatchObject({ name: 'Konnect · Orders', source: { format: 'konnect', sourceId: 'service-one' } });
    expect(managed.collections[0].requests).toHaveLength(1);

    const unchanged = await syncKonnectCatalog({
      coordinator: first.coordinator,
      coordinatorWorkspaceId: initial.activeWorkspaceId,
      environment: undefined,
      requestContext: {},
      regions: ['us'],
    });
    expect(unchanged.catalog.entries).toHaveLength(2);
    expect(unchanged.controlPlanes).toMatchObject({ total: 1, created: 0, updated: 0, deleted: 0 });
    expect(unchanged.services).toMatchObject({ total: 1, created: 0, updated: 0, deleted: 0 });
    expect(unchanged.routes).toMatchObject({ total: 1, created: 0, updated: 0, deleted: 0 });

    transport.sendRequest.mockRejectedValue(new Error('Konnect API error 503 fetching control planes'));
    const failed = await syncKonnectCatalog({
      coordinator: unchanged.coordinator,
      coordinatorWorkspaceId: initial.activeWorkspaceId,
      environment: undefined,
      requestContext: {},
      regions: ['us'],
    });
    expect(failed.skippedRegions).toEqual(['us: Konnect API error 503 fetching control planes']);
    expect(failed.catalog.entries.some((entry) => entry.id === managedEntry.id)).toBe(true);
    expect(failed.coordinator.konnect.controlPlanes).toContainEqual(expect.objectContaining({ id: 'cp-one', region: 'us' }));

    transport.sendRequest.mockResolvedValue(response([]));
    const removed = await syncKonnectCatalog({
      coordinator: failed.coordinator,
      coordinatorWorkspaceId: initial.activeWorkspaceId,
      environment: undefined,
      requestContext: {},
      regions: ['us'],
    });
    expect(removed.controlPlanes.deleted).toBe(1);
    expect(removed.catalog.entries.map((entry) => entry.id)).toEqual([initial.activeWorkspaceId]);
  });

  it('refuses to reconcile through a coordinator that is no longer active', async () => {
    const initial = await loadWorkspaceCatalog();
    const coordinator = { ...initial.workspace, konnect: { ...initial.workspace.konnect, enabled: true, token: '{{ vault.konnect }}' } };
    await createCatalogWorkspace(createBlankWorkspace('Other', initial.workspace.preferences), 'other');
    expect((await openCatalogWorkspace('other')).activeWorkspaceId).toBe('other');

    await expect(syncKonnectCatalog({
      coordinator,
      coordinatorWorkspaceId: initial.activeWorkspaceId,
      environment: undefined,
      requestContext: {},
      regions: ['us'],
    })).rejects.toThrow('no longer the active');
    expect(transport.sendRequest).not.toHaveBeenCalled();
  });
});
