import { describe, expect, it } from 'vitest';
import { cloneSeedWorkspace } from '../data/seed';
import { emptyWorkspaceCertificates } from './certificates';
import { listProjectWorkspaces } from './projectWorkspaces';
import { assembleWorkspacePhysicalStore, splitWorkspacePhysicalStore, workspacePhysicalStoreFormat } from './workspacePhysicalStore';

describe('physical project file storage', () => {
  it('round-trips every typed file and its local state through independent records', () => {
    const workspace = cloneSeedWorkspace();
    const collectionId = workspace.collections.find((collection) => !workspace.apiDesigns.some((design) => design.generatedCollectionId === collection.id))!.id;
    const designId = workspace.apiDesigns[0].id;
    workspace.fileState[collectionId] = { cookies: [{ id: 'cookie', name: 'session', value: 'value', domain: 'example.test', path: '/', secure: true, httpOnly: true, sameSite: 'lax', hostOnly: true, createdAt: '2026-07-20T00:00:00.000Z' }], certificates: emptyWorkspaceCertificates() };
    workspace.fileState[designId] = { cookies: [], certificates: { ...emptyWorkspaceCertificates(), ca: { enabled: true, pem: 'design-ca' } } };

    const split = splitWorkspacePhysicalStore(workspace, (scope, _id, index) => `${scope}-${index}.json`);
    const byKey = new Map(split.records.map(({ key, record }) => [key, record]));
    const assembled = assembleWorkspacePhysicalStore(split.manifest, (key) => byKey.get(key));

    expect(split.manifest).toMatchObject({ format: workspacePhysicalStoreFormat, version: 1, workspace: { collections: [], environments: [], apiDesigns: [], mockServers: [], mcpClients: [] } });
    expect(split.records.map(({ record }) => ({ id: record.id, scope: record.scope }))).toEqual(listProjectWorkspaces(workspace).map(({ id, scope }) => ({ id, scope })));
    expect(assembled).toEqual(workspace);
  });

  it('rejects missing, mismatched, and duplicated physical records', () => {
    const workspace = cloneSeedWorkspace();
    const split = splitWorkspacePhysicalStore(workspace, (_scope, _id, index) => `record-${index}.json`);
    const byKey = new Map(split.records.map(({ key, record }) => [key, record]));
    expect(() => assembleWorkspacePhysicalStore(split.manifest, (key) => key === split.records[0].key ? undefined : byKey.get(key))).toThrow('invalid');

    const mismatched = structuredClone(split.records[0].record);
    mismatched.id = 'another-file';
    expect(() => assembleWorkspacePhysicalStore(split.manifest, (key) => key === split.records[0].key ? mismatched : byKey.get(key))).toThrow('invalid');

    const mismatchedPayload = structuredClone(split.records[0].record);
    mismatchedPayload.collection!.value.id = 'another-collection';
    expect(() => assembleWorkspacePhysicalStore(split.manifest, (key) => key === split.records[0].key ? mismatchedPayload : byKey.get(key))).toThrow('invalid');

    const duplicated = structuredClone(split.manifest);
    duplicated.records[1].id = duplicated.records[0].id;
    expect(() => assembleWorkspacePhysicalStore(duplicated, (key) => byKey.get(key))).toThrow('manifest');
  });
});
