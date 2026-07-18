import { describe, expect, it } from 'vitest';
import { createMultipartPartArtifact, parseMultipartPreview } from './multipartPreview';

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
    expect(createMultipartPartArtifact(parts[0], 42)).toEqual({ contents: '{"ok":true}', fileName: 'meta-42.json', mimeType: 'application/json' });
    expect(createMultipartPartArtifact({ ...parts[1], filename: '../unsafe report.csv' }, 42).fileName).toBe('.._unsafe_report.csv');
  });
});
