import { describe, expect, it } from 'vitest';
import { cloneSeedWorkspace } from '../data/seed';
import { migrateWorkspace } from './storage';

describe('workspace migrations', () => {
  it('upgrades v1 requests with protocol defaults without changing request identity', () => {
    const legacy = cloneSeedWorkspace() as unknown as Record<string, unknown>;
    legacy.version = 1;
    const collections = legacy.collections as Array<{ requests: Array<Record<string, unknown>> }>;
    const first = collections[0].requests[0];
    delete first.protocol;
    delete first.bodyMode;
    delete first.graphql;
    delete first.grpc;
    delete first.transport;
    delete legacy.apiDesigns;
    delete legacy.mockServers;
    delete legacy.runnerReports;

    const migrated = migrateWorkspace(legacy);
    expect(migrated.version).toBe(3);
    expect(migrated.collections[0].requests[0]).toMatchObject({ id: first.id, protocol: 'http', bodyMode: 'none' });
    expect(migrated.collections[0].requests[0].transport.timeoutMs).toBe(60000);
    expect(migrated.apiDesigns[0].name).toBe('Orders API');
    expect(migrated.mockServers[0].host).toBe('127.0.0.1');
  });

  it('rejects unrelated JSON', () => {
    expect(() => migrateWorkspace({ hello: 'world' })).toThrow('not a Brunomnia');
  });
});
