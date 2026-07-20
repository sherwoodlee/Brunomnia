import { describe, expect, it } from 'vitest';
import { createMultipartPartArtifact, MAX_MULTIPART_PREVIEW_DEPTH, MAX_NESTED_MULTIPART_BYTES, multipartNestedPreviewBlock, parseMultipartPreview } from './multipartPreview';

const body = [
  '--AaB03x',
  'Content-Disposition: form-data; name="meta"',
  'Content-Type: application/json',
  '',
  '{"ok":true}',
  '--AaB03x',
  'Content-Disposition: attachment; name="report"; filename="report.csv"',
  'X-Trace: one',
  '',
  'a,b\r\n1,2',
  '--AaB03x--',
  '',
].join('\r\n');

describe('multipart response preview', () => {
  it('parses quoted boundaries, metadata, headers, and textual part bodies', () => {
    const result = parseMultipartPreview(body, 'multipart/mixed; boundary="AaB03x"');
    expect(result).toMatchObject({ error: '', truncated: false });
    expect(result.parts).toHaveLength(2);
    expect(result.parts[0]).toMatchObject({ title: 'meta', name: 'meta', filename: '', contentType: 'application/json', body: '{"ok":true}' });
    expect(result.parts[1]).toMatchObject({ title: 'report (report.csv)', filename: 'report.csv', contentType: 'text/plain', body: 'a,b\r\n1,2' });
    expect(result.parts[1].headers).toContainEqual({ name: 'X-Trace', value: 'one' });
  });

  it('accepts LF framing and folded header values', () => {
    const result = parseMultipartPreview('--b\nContent-Disposition: form-data;\n name="value"\n\nhello\n--b--\n', 'multipart/form-data; boundary=b');
    expect(result.parts[0]).toMatchObject({ name: 'value', body: 'hello' });
  });

  it('returns bounded errors for missing and incomplete boundaries', () => {
    expect(parseMultipartPreview('hello', 'multipart/mixed')).toMatchObject({ error: 'Multipart content type does not include a boundary.', parts: [] });
    expect(parseMultipartPreview('--x\r\n\r\nhello', 'multipart/mixed; boundary=x')).toMatchObject({ error: 'Multipart body does not contain a complete closing boundary.', parts: [] });
  });

  it('caps the number of accepted parts and reports truncation', () => {
    expect(parseMultipartPreview(body, 'multipart/mixed; boundary=AaB03x', 1)).toMatchObject({ truncated: true, parts: [{ name: 'meta' }] });
  });

  it('creates safe exact-text artifacts for named and unnamed files', () => {
    const parts = parseMultipartPreview(body, 'multipart/mixed; boundary=AaB03x').parts;
    expect(new TextDecoder().decode(createMultipartPartArtifact(parts[0], 42).contents)).toBe('{"ok":true}');
    expect(createMultipartPartArtifact(parts[0], 42)).toMatchObject({ fileName: 'meta-42.json', mimeType: 'application/json' });
    expect(createMultipartPartArtifact({ ...parts[1], filename: '../unsafe report.csv' }, 42).fileName).toBe('.._unsafe_report.csv');
  });

  it('retains exact binary part bytes and decodes declared part charsets', () => {
    const prefix = new TextEncoder().encode('--bin\r\nContent-Disposition: attachment; name="payload"\r\nContent-Type: application/octet-stream\r\n\r\n');
    const suffix = new TextEncoder().encode('\r\n--bin\r\nContent-Disposition: form-data; name="legacy"\r\nContent-Type: text/plain; charset=windows-1252\r\n\r\ncaf');
    const closing = new TextEncoder().encode('\r\n--bin--\r\n');
    const bytes = Uint8Array.from([...prefix, 0x00, 0xff, 0x80, ...suffix, 0xe9, ...closing]);

    const parts = parseMultipartPreview(bytes, 'multipart/mixed; boundary=bin').parts;
    expect(parts[0]).toMatchObject({ name: 'payload', contentType: 'application/octet-stream', sizeBytes: 3 });
    expect(parts[0].bodyBytes).toEqual(Uint8Array.from([0x00, 0xff, 0x80]));
    expect(createMultipartPartArtifact(parts[0], 42)).toMatchObject({ contents: Uint8Array.from([0x00, 0xff, 0x80]), fileName: 'payload-42.bin' });
    expect(parts[1]).toMatchObject({ name: 'legacy', contentType: 'text/plain; charset=windows-1252', body: 'café', sizeBytes: 4 });
    expect(parts[1].bodyBytes).toEqual(Uint8Array.from([0x63, 0x61, 0x66, 0xe9]));
  });

  it('preserves case-sensitive nested boundaries for recursive parsing', () => {
    const nested = [
      '--Outer',
      'Content-Disposition: form-data; name="nested"',
      'Content-Type: multipart/mixed; boundary=InnerCase',
      '',
      '--InnerCase',
      'Content-Type: application/json',
      '',
      '{"nested":true}',
      '--InnerCase--',
      '--Outer--',
      '',
    ].join('\r\n');

    const outer = parseMultipartPreview(nested, 'Multipart/Mixed; boundary=Outer').parts[0];
    expect(outer.contentType).toBe('multipart/mixed; boundary=InnerCase');
    expect(parseMultipartPreview(outer.bodyBytes, outer.contentType).parts[0]).toMatchObject({ contentType: 'application/json', body: '{"nested":true}' });
  });

  it('expands practical nested multipart bodies up to the response preview ceiling', () => {
    expect(multipartNestedPreviewBlock(5, 5 * 1024 * 1024 + 1)).toBe('');
    expect(multipartNestedPreviewBlock(MAX_MULTIPART_PREVIEW_DEPTH - 1, MAX_NESTED_MULTIPART_BYTES)).toBe('');
    expect(multipartNestedPreviewBlock(MAX_MULTIPART_PREVIEW_DEPTH, 1)).toBe('depth');
    expect(multipartNestedPreviewBlock(0, MAX_NESTED_MULTIPART_BYTES + 1)).toBe('size');
  });
});
