import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { cloneSeedWorkspace } from '../src/data/seed';
import { splitWorkspacePhysicalStore } from '../src/lib/workspacePhysicalStore';
import { loadPhysicalWorkspaceFromPath } from './physicalStore';

describe('CLI physical workspace loading', () => {
  const temporaryDirectories: string[] = [];
  afterEach(async () => {
    await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
  });

  const fixture = async () => {
    const root = await mkdtemp(join(tmpdir(), 'brunomnia-physical-cli-'));
    temporaryDirectories.push(root);
    const manifestPath = join(root, 'workspace.json');
    const recordsPath = join(root, 'workspace.records');
    await mkdir(recordsPath);
    const workspace = cloneSeedWorkspace();
    const split = splitWorkspacePhysicalStore(workspace, (_scope, _id, index) => `record-${String(index).padStart(5, '0')}.json`);
    await writeFile(manifestPath, JSON.stringify(split.manifest));
    await Promise.all(split.records.map(({ key, record }) => writeFile(join(recordsPath, key), JSON.stringify(record))));
    return { root, manifestPath, recordsPath, workspace, split };
  };

  it('assembles the native manifest and every sibling record', async () => {
    const { manifestPath, workspace, split } = await fixture();
    await expect(loadPhysicalWorkspaceFromPath(manifestPath, split.manifest)).resolves.toEqual(workspace);
  });

  it('rejects missing records and record-directory symlinks', async () => {
    const { root, manifestPath, recordsPath, split } = await fixture();
    await rm(join(recordsPath, split.records[0].key));
    await expect(loadPhysicalWorkspaceFromPath(manifestPath, split.manifest)).rejects.toThrow('Unable to inspect physical project record');

    const linkedManifestPath = join(root, 'linked.json');
    await symlink(recordsPath, join(root, 'linked.records'));
    await expect(loadPhysicalWorkspaceFromPath(linkedManifestPath, split.manifest)).rejects.toThrow('regular sibling directory');
  });
});
