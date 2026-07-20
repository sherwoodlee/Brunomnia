import { lstat, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { assembleWorkspacePhysicalStore, isWorkspacePhysicalManifest } from '../src/lib/workspacePhysicalStore';

export const loadPhysicalWorkspaceFromPath = async (path: string, manifest: unknown) => {
  if (!isWorkspacePhysicalManifest(manifest)) return manifest;
  const manifestPath = resolve(path);
  const recordsPath = manifestPath.endsWith('.json') ? `${manifestPath.slice(0, -5)}.records` : `${manifestPath}.records`;
  const recordsMetadata = await lstat(recordsPath).catch((error) => { throw new Error(`Unable to inspect physical project records: ${error.message}`); });
  if (!recordsMetadata.isDirectory() || recordsMetadata.isSymbolicLink()) throw new Error('Physical project records must use a regular sibling directory.');
  const values = new Map<string, unknown>();
  let totalBytes = 0;
  for (const reference of manifest.records) {
    if (!/^record-\d{5}\.json$/.test(reference.key)) throw new Error(`Physical project record key '${reference.key}' is invalid.`);
    const recordPath = join(recordsPath, reference.key);
    const metadata = await lstat(recordPath).catch((error) => { throw new Error(`Unable to inspect physical project record '${reference.key}': ${error.message}`); });
    if (!metadata.isFile() || metadata.isSymbolicLink()) throw new Error(`Physical project record '${reference.key}' must be a regular file.`);
    totalBytes += metadata.size;
    if (metadata.size > 20_000_000 || totalBytes > 100_000_000) throw new Error('Physical project records exceed the 20 MB per-file or 100 MB aggregate limit.');
    values.set(reference.key, JSON.parse(await readFile(recordPath, 'utf8')) as unknown);
  }
  return assembleWorkspacePhysicalStore(manifest, (key) => values.get(key));
};
