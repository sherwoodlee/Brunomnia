import { describe, expect, it } from 'vitest';
import { parseAllDocuments } from 'yaml';
import { cloneSeedWorkspace } from '../../data/seed';
import { exportArtifact } from './exporters';
import { importArtifact } from './index';

describe('artifact export adapters', () => {
  it('round-trips Insomnia v4 and v5 compatibility exports', () => {
    const workspace = cloneSeedWorkspace();
    workspace.collections[0].requests[0].auth = { ...workspace.collections[0].requests[0].auth, type: 'hawk', hawkId: 'client', hawkKey: 'secret', hawkAlgorithm: 'sha256' };
    workspace.cookies = [{ id: 'cookie-session', name: 'session', value: 'abc', domain: 'api.acme.dev', path: '/', secure: true, httpOnly: true, sameSite: 'lax', hostOnly: true, createdAt: '2026-07-16T12:00:00.000Z' }];
    const v4Export = exportArtifact(workspace, { format: 'insomnia-v4', scope: 'all' });
    const v4Import = importArtifact(v4Export.contents, v4Export.fileName);
    expect(v4Import.format).toBe('insomnia-v4');
    expect(v4Import.collections).toHaveLength(workspace.collections.length);
    expect(v4Import.collections.reduce((total, collection) => total + collection.requests.length, 0)).toBe(14);
    expect(v4Import.collections[0].requests[0].auth).toMatchObject({ type: 'hawk', hawkId: 'client' });
    expect(v4Import.cookies[0]).toMatchObject({ name: 'session', sameSite: 'lax' });
    expect(v4Import.cookies).toHaveLength(1);

    const v5Export = exportArtifact(workspace, { format: 'insomnia-v5', scope: 'all' });
    const v5Import = importArtifact(v5Export.contents, v5Export.fileName);
    expect(v5Import.format).toBe('insomnia-v5');
    expect(v5Import.collections.length).toBeGreaterThanOrEqual(workspace.collections.length);
    expect(v5Import.mockServers[0].routes[0].status).toBe(200);
    expect(v5Import.collections[0].requests[0].auth).toMatchObject({ type: 'hawk', hawkId: 'client' });
    expect(v5Import.cookies[0]).toMatchObject({ name: 'session', sameSite: 'lax' });
  });

  it('exports and reimports HAR while warning about streaming protocols', () => {
    const workspace = cloneSeedWorkspace();
    const exported = exportArtifact(workspace, { format: 'har', scope: 'all' });
    const imported = importArtifact(exported.contents, exported.fileName);
    expect(imported.format).toBe('har');
    expect(imported.collections[0].requests).toHaveLength(11);
    expect(exported.warnings.filter((warning) => warning.code === 'unsupported-protocol')).toHaveLength(3);
  });

  it('creates scoped Brunomnia and raw OpenAPI exports', () => {
    const workspace = cloneSeedWorkspace();
    const collection = workspace.collections[1];
    const scoped = exportArtifact(workspace, { format: 'brunomnia', scope: 'collection', collectionId: collection.id });
    const parsed = JSON.parse(scoped.contents);
    expect(parsed.collections).toHaveLength(1);
    expect(parsed.collections[0].name).toBe(collection.name);
    expect(parsed.version).toBe(5);

    const design = workspace.apiDesigns[0];
    const spec = exportArtifact(workspace, { format: 'openapi', scope: 'design', designId: design.id });
    expect(spec.contents).toContain('openapi: 3.1.0');
    expect(spec.fileName).toBe('orders-api.yaml');

    const designV5 = exportArtifact(workspace, { format: 'insomnia-v5', scope: 'design', designId: design.id });
    const documents = parseAllDocuments(designV5.contents);
    expect(documents).toHaveLength(1);
    expect(documents[0].toJSON()).toMatchObject({ type: 'spec.insomnia.rest/5.0', name: 'Orders API' });
  });
});
