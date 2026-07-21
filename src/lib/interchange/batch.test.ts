import { describe, expect, it } from 'vitest';
import { importArtifactFiles, importMcpServerUrl } from './batch';

const encoder = new TextEncoder();

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

const concatenate = (parts: Uint8Array[]) => {
  const output = new Uint8Array(parts.reduce((total, part) => total + part.byteLength, 0));
  let offset = 0;
  parts.forEach((part) => { output.set(part, offset); offset += part.byteLength; });
  return output;
};

const storedZip = (entries: Array<{ name: string; contents: string }>) => {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let localOffset = 0;
  entries.forEach((entry) => {
    const name = encoder.encode(entry.name);
    const data = encoder.encode(entry.contents);
    const crc = crc32(data);
    const local = new Uint8Array(30 + name.byteLength + data.byteLength);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, data.byteLength, true);
    localView.setUint32(22, data.byteLength, true);
    localView.setUint16(26, name.byteLength, true);
    local.set(name, 30);
    local.set(data, 30 + name.byteLength);
    localParts.push(local);

    const central = new Uint8Array(46 + name.byteLength);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, data.byteLength, true);
    centralView.setUint32(24, data.byteLength, true);
    centralView.setUint16(28, name.byteLength, true);
    centralView.setUint32(42, localOffset, true);
    central.set(name, 46);
    centralParts.push(central);
    localOffset += local.byteLength;
  });
  const central = concatenate(centralParts);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, central.byteLength, true);
  endView.setUint32(16, localOffset, true);
  return concatenate([...localParts, central, end]);
};

describe('artifact import batches', () => {
  it('imports stored Postman data-dump ZIP collections and environments', async () => {
    const archive = storedZip([
      { name: 'archive.json', contents: JSON.stringify({ collection: { 'collection-one': {} }, environment: { 'environment-one': {} } }) },
      { name: 'collection-one.json', contents: JSON.stringify({ info: { name: 'ZIP collection', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' }, item: [{ name: 'List', request: { method: 'GET', url: 'https://api.example.com/items' } }] }) },
      { name: 'environment-one.json', contents: JSON.stringify({ id: 'environment-one', name: 'ZIP environment', values: [{ key: 'host', value: 'https://api.example.com', enabled: true }] }) },
    ]);

    const batch = await importArtifactFiles([{ name: 'postman-data.zip', bytes: archive }]);
    expect(batch.errors).toEqual([]);
    expect(batch.imports.map((result) => result.format)).toEqual(['postman-2', 'postman-environment']);
    expect(batch.imports[0].collections[0].requests[0].name).toBe('List');
    expect(batch.imports[1].environments[0].name).toBe('ZIP environment');
  });

  it('reports malformed archives and per-file failures without discarding valid files', async () => {
    const malformed = await importArtifactFiles([{ name: 'broken.zip', bytes: encoder.encode('not a zip') }]);
    expect(malformed.imports).toEqual([]);
    expect(malformed.errors[0].message).toContain('valid end record');

    const mixed = await importArtifactFiles([
      { name: 'valid.curl', bytes: encoder.encode("curl 'https://api.example.com/health'") },
      { name: 'invalid.json', bytes: encoder.encode('{not-json') },
    ]);
    expect(mixed.imports).toHaveLength(1);
    expect(mixed.imports[0].format).toBe('curl');
    expect(mixed.errors).toEqual([expect.objectContaining({ sourceName: 'invalid.json' })]);
  });

  it('creates a disabled HTTP MCP client from a bounded credential-free URL', () => {
    const result = importMcpServerUrl('https://mcp.example.com/rpc?tenant=one');
    expect(result.format).toBe('insomnia-v5');
    expect(result.mcpClients).toEqual([expect.objectContaining({ name: 'Imported MCP Client', url: 'https://mcp.example.com/rpc?tenant=one', transport: 'http', enabled: false })]);
    expect(() => importMcpServerUrl('file:///tmp/server')).toThrow('HTTP or HTTPS');
    expect(() => importMcpServerUrl('https://user:secret@mcp.example.com/rpc')).toThrow('embedded credentials');
  });
});
