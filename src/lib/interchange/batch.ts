import type { ArtifactImport } from './types';
import { asRecord } from './common';
import { importArtifact } from './index';

const MAX_IMPORT_FILE_BYTES = 20_000_000;
const MAX_IMPORT_FILES = 100;
const MAX_IMPORT_BATCH_BYTES = 100_000_000;
const MAX_ARCHIVE_ENTRIES = 1_000;
const MAX_ARCHIVE_OUTPUT_BYTES = 50_000_000;
const ZIP_LOCAL_FILE = 0x04034b50;
const ZIP_CENTRAL_FILE = 0x02014b50;
const ZIP_END = 0x06054b50;

export const supportedImportExtensions = ['sh', 'txt', 'json', 'har', 'curl', 'bash', 'shell', 'yaml', 'yml', 'wsdl', 'xml', 'zip'];

export type ArtifactImportFile = {
  name: string;
  bytes: Uint8Array;
};

export type ArtifactImportBatch = {
  imports: ArtifactImport[];
  errors: Array<{ sourceName: string; message: string }>;
};

type ArchiveEntry = { name: string; bytes: Uint8Array };

const basename = (value: string) => value.replace(/\\/g, '/').split('/').pop() ?? value;
const extension = (value: string) => basename(value).toLowerCase().split('.').pop() ?? '';
const fileStem = (value: string) => basename(value).replace(/\.json$/i, '');
const decodeText = (bytes: Uint8Array) => new TextDecoder().decode(bytes);

export const isSupportedImportFile = (name: string) => supportedImportExtensions.includes(extension(name));

const crcTable = Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit += 1) crc = (crc & 1) ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  return crc >>> 0;
});

const crc32 = (bytes: Uint8Array) => {
  let crc = 0xffffffff;
  bytes.forEach((byte) => { crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8); });
  return (crc ^ 0xffffffff) >>> 0;
};

const inflateRaw = async (bytes: Uint8Array, maximumBytes: number) => {
  if (typeof DecompressionStream === 'undefined') throw new Error('This WebView cannot decompress ZIP entries.');
  const stream = new Blob([bytes.slice().buffer]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const result = await reader.read();
    if (result.done) break;
    total += result.value.byteLength;
    if (total > maximumBytes) {
      await reader.cancel();
      throw new Error('A ZIP entry expands beyond its declared or permitted size.');
    }
    chunks.push(result.value);
  }
  const output = new Uint8Array(total);
  let offset = 0;
  chunks.forEach((chunk) => { output.set(chunk, offset); offset += chunk.byteLength; });
  return output;
};

const findZipEnd = (view: DataView) => {
  const minimum = Math.max(0, view.byteLength - 65_557);
  for (let offset = view.byteLength - 22; offset >= minimum; offset -= 1) {
    if (view.getUint32(offset, true) === ZIP_END) return offset;
  }
  return -1;
};

const extractZipEntries = async (bytes: Uint8Array): Promise<ArchiveEntry[]> => {
  if (bytes.byteLength > MAX_IMPORT_FILE_BYTES) throw new Error('The ZIP archive exceeds the 20 MB import limit.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const endOffset = findZipEnd(view);
  if (endOffset < 0) throw new Error('The ZIP archive has no valid end record.');
  const disk = view.getUint16(endOffset + 4, true);
  const centralDisk = view.getUint16(endOffset + 6, true);
  const entries = view.getUint16(endOffset + 10, true);
  const centralSize = view.getUint32(endOffset + 12, true);
  const centralOffset = view.getUint32(endOffset + 16, true);
  if (disk !== 0 || centralDisk !== 0) throw new Error('Multi-disk ZIP archives are not supported.');
  if (entries > MAX_ARCHIVE_ENTRIES) throw new Error(`The ZIP archive exceeds ${MAX_ARCHIVE_ENTRIES} entries.`);
  if (centralOffset + centralSize > endOffset) throw new Error('The ZIP central directory is out of bounds.');

  const output: ArchiveEntry[] = [];
  let totalBytes = 0;
  let offset = centralOffset;
  for (let index = 0; index < entries; index += 1) {
    if (offset + 46 > endOffset || view.getUint32(offset, true) !== ZIP_CENTRAL_FILE) throw new Error('The ZIP central directory is malformed.');
    const flags = view.getUint16(offset + 8, true);
    const compression = view.getUint16(offset + 10, true);
    const expectedCrc = view.getUint32(offset + 16, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const uncompressedSize = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff || localOffset === 0xffffffff) throw new Error('ZIP64 archives are not supported.');
    if (flags & 1) throw new Error('Encrypted ZIP entries are not supported.');
    if (compression !== 0 && compression !== 8) throw new Error(`ZIP compression method ${compression} is not supported.`);
    if (offset + 46 + nameLength + extraLength + commentLength > endOffset) throw new Error('A ZIP directory entry is out of bounds.');
    const name = new TextDecoder().decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
    offset += 46 + nameLength + extraLength + commentLength;
    if (!name.toLowerCase().endsWith('.json') || name.endsWith('/')) continue;
    if (localOffset + 30 > centralOffset || view.getUint32(localOffset, true) !== ZIP_LOCAL_FILE) throw new Error(`ZIP entry '${name}' has an invalid local header.`);
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
    if (dataOffset + compressedSize > centralOffset) throw new Error(`ZIP entry '${name}' data is out of bounds.`);
    totalBytes += uncompressedSize;
    if (totalBytes > MAX_ARCHIVE_OUTPUT_BYTES) throw new Error('The ZIP archive exceeds the 50 MB extracted-data limit.');
    const compressed = bytes.subarray(dataOffset, dataOffset + compressedSize);
    const data = compression === 0 ? compressed.slice() : await inflateRaw(compressed, uncompressedSize);
    if (data.byteLength !== uncompressedSize || crc32(data) !== expectedCrc) throw new Error(`ZIP entry '${name}' failed its size or CRC check.`);
    output.push({ name, bytes: data });
  }
  if (!output.length) throw new Error('The ZIP archive contains no JSON files.');
  return output;
};

const postmanArchiveImports = (entries: ArchiveEntry[], sourceName: string): ArtifactImportBatch => {
  const archive = entries.find((entry) => basename(entry.name).toLowerCase() === 'archive.json');
  if (!archive) return { imports: [], errors: [{ sourceName, message: 'The Postman ZIP archive has no archive.json file.' }] };
  let manifest: Record<string, unknown>;
  try {
    manifest = JSON.parse(decodeText(archive.bytes)) as Record<string, unknown>;
  } catch {
    return { imports: [], errors: [{ sourceName, message: 'The Postman archive.json file is invalid.' }] };
  }
  const collections = asRecord(manifest.collection) ?? {};
  const environments = asRecord(manifest.environment) ?? {};
  const imports: ArtifactImport[] = [];
  const errors: ArtifactImportBatch['errors'] = [];
  entries.filter((entry) => entry !== archive).forEach((entry) => {
    const identity = fileStem(entry.name);
    if (!(identity in collections) && !(identity in environments)) return;
    try {
      const text = decodeText(entry.bytes);
      const contents = identity in environments
        ? JSON.stringify({ ...(JSON.parse(text) as Record<string, unknown>), _postman_variable_scope: 'environment' })
        : text;
      imports.push(importArtifact(contents, `${basename(entry.name)} in ${sourceName}`));
    } catch (error) {
      errors.push({ sourceName: entry.name, message: error instanceof Error ? error.message : String(error) });
    }
  });
  if (!imports.length && !errors.length) errors.push({ sourceName, message: 'The Postman archive lists no importable collections or environments.' });
  return { imports, errors };
};

const loosePostmanManifest = (files: ArtifactImportFile[]) => {
  const archive = files.find((file) => basename(file.name).toLowerCase() === 'archive.json');
  if (!archive) return undefined;
  try {
    const manifest = JSON.parse(decodeText(archive.bytes)) as Record<string, unknown>;
    return { archive, collections: asRecord(manifest.collection) ?? {}, environments: asRecord(manifest.environment) ?? {} };
  } catch {
    return undefined;
  }
};

export const importArtifactFiles = async (files: ArtifactImportFile[]): Promise<ArtifactImportBatch> => {
  if (!files.length) return { imports: [], errors: [{ sourceName: 'files', message: 'Choose at least one import file.' }] };
  if (files.length > MAX_IMPORT_FILES) return { imports: [], errors: [{ sourceName: 'files', message: `Choose at most ${MAX_IMPORT_FILES} files at once.` }] };
  if (files.reduce((total, file) => total + file.bytes.byteLength, 0) > MAX_IMPORT_BATCH_BYTES) return { imports: [], errors: [{ sourceName: 'files', message: 'The selected files exceed the 100 MB batch limit.' }] };
  const manifest = loosePostmanManifest(files);
  const imports: ArtifactImport[] = [];
  const errors: ArtifactImportBatch['errors'] = [];
  for (const file of files) {
    if (file.bytes.byteLength > MAX_IMPORT_FILE_BYTES) {
      errors.push({ sourceName: file.name, message: 'The import exceeds the 20 MB per-file limit.' });
      continue;
    }
    if (!isSupportedImportFile(file.name)) {
      errors.push({ sourceName: file.name, message: 'The file extension is not supported.' });
      continue;
    }
    if (extension(file.name) === 'zip') {
      try {
        const batch = postmanArchiveImports(await extractZipEntries(file.bytes), file.name);
        imports.push(...batch.imports);
        errors.push(...batch.errors);
      } catch (error) {
        errors.push({ sourceName: file.name, message: error instanceof Error ? error.message : String(error) });
      }
      continue;
    }
    if (manifest?.archive === file) continue;
    try {
      const identity = fileStem(file.name);
      const text = decodeText(file.bytes);
      const contents = manifest && identity in manifest.environments
        ? JSON.stringify({ ...(JSON.parse(text) as Record<string, unknown>), _postman_variable_scope: 'environment' })
        : text;
      imports.push(importArtifact(contents, file.name));
    } catch (error) {
      errors.push({ sourceName: file.name, message: error instanceof Error ? error.message : String(error) });
    }
  }
  if (imports.some((result) => result.replacement) && imports.length > 1) {
    return { imports: [], errors: [{ sourceName: 'files', message: 'A Brunomnia workspace replacement must be imported by itself.' }, ...errors] };
  }
  return { imports, errors };
};

export const importMcpServerUrl = (value: string): ArtifactImport => {
  const trimmed = value.trim();
  if (trimmed.length > 8_192) throw new Error('The MCP server URL exceeds 8,192 characters.');
  const url = new URL(trimmed);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('MCP server URLs must use HTTP or HTTPS.');
  if (url.username || url.password) throw new Error('MCP server URLs cannot contain embedded credentials.');
  return importArtifact(JSON.stringify({
    type: 'mcpClient.insomnia/5.0',
    schema_version: '5.1',
    name: 'Imported MCP Client',
    mcpRequest: { name: 'Imported MCP Client', url: trimmed, transportType: 'streamable-http' },
  }), trimmed);
};
