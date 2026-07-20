import { responseBodyFromBytes, responseCharset } from './responseBytes';

export type MultipartPreviewPart = {
  id: number;
  title: string;
  name: string;
  filename: string;
  headers: Array<{ name: string; value: string }>;
  contentType: string;
  body: string;
  bodyBytes: Uint8Array;
  sizeBytes: number;
};

export type MultipartPreview = { error: string; parts: MultipartPreviewPart[]; truncated: boolean };
export type MultipartNestedPreviewBlock = '' | 'depth' | 'size';

export const MAX_MULTIPART_PREVIEW_DEPTH = 100;
export const MAX_NESTED_MULTIPART_BYTES = 100 * 1024 * 1024;

export const multipartNestedPreviewBlock = (depth: number, sizeBytes: number): MultipartNestedPreviewBlock => {
  if (depth >= MAX_MULTIPART_PREVIEW_DEPTH) return 'depth';
  return sizeBytes > MAX_NESTED_MULTIPART_BYTES ? 'size' : '';
};

const BYTE_STRING_CHUNK = 8_192;
const textEncoder = new TextEncoder();
const regexEscape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const byteString = (bytes: Uint8Array) => {
  const chunks: string[] = [];
  for (let offset = 0; offset < bytes.byteLength; offset += BYTE_STRING_CHUNK) {
    chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + BYTE_STRING_CHUNK)));
  }
  return chunks.join('');
};

const dispositionValue = (value: string, target: string) => {
  const match = value.match(new RegExp(`(?:^|;)\\s*${target}=(?:"((?:\\\\.|[^"])*)"|([^;]*))`, 'i'));
  return (match?.[1] ?? match?.[2] ?? '').trim().replace(/\\"/g, '"').replace(/\\\\/g, '\\');
};

export const parseMultipartPreview = (body: string | Uint8Array, contentType: string, maxParts = 100): MultipartPreview => {
  const bodyBytes = typeof body === 'string' ? textEncoder.encode(body) : body;
  const source = byteString(bodyBytes);
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;\s]+))/i);
  const boundary = (boundaryMatch?.[1] ?? boundaryMatch?.[2] ?? '').trim();
  if (!boundary) return { error: 'Multipart content type does not include a boundary.', parts: [], truncated: false };
  if (boundary.length > 200 || /[\r\n]/.test(boundary)) return { error: 'Multipart boundary is invalid or too long.', parts: [], truncated: false };

  const delimiter = new RegExp(`(?:^|\\r?\\n)--${regexEscape(boundary)}(--)?[ \\t]*(?:\\r?\\n|$)`, 'g');
  const matches: Array<{ start: number; end: number; closing: boolean }> = [];
  let match: RegExpExecArray | null;
  while ((match = delimiter.exec(source))) matches.push({ start: match.index, end: delimiter.lastIndex, closing: Boolean(match[1]) });
  if (matches.length < 2 || !matches.some(({ closing }) => closing)) return { error: 'Multipart body does not contain a complete closing boundary.', parts: [], truncated: false };

  const parts: MultipartPreviewPart[] = [];
  let truncated = false;
  for (let index = 0; index < matches.length - 1; index += 1) {
    const current = matches[index];
    if (current.closing) break;
    if (parts.length >= Math.max(1, Math.trunc(maxParts))) { truncated = true; break; }
    const raw = source.slice(current.end, matches[index + 1].start);
    const divider = raw.match(/\r?\n\r?\n/);
    if (!divider || divider.index === undefined) return { error: `Multipart part ${index + 1} does not contain a header separator.`, parts: [], truncated: false };
    const headerText = raw.slice(0, divider.index).replace(/\r?\n[ \\t]+/g, ' ');
    const partBodyStart = current.end + divider.index + divider[0].length;
    const partBodyBytes = bodyBytes.slice(partBodyStart, matches[index + 1].start);
    const headers = headerText.split(/\r?\n/).flatMap((line): Array<{ name: string; value: string }> => {
      const separator = line.indexOf(':');
      return separator > 0 ? [{ name: line.slice(0, separator).trim(), value: line.slice(separator + 1).trim() }] : [];
    }).slice(0, 100);
    const disposition = headers.find((header) => header.name.toLowerCase() === 'content-disposition')?.value ?? '';
    const name = dispositionValue(disposition, 'name') || `part-${index + 1}`;
    const filename = dispositionValue(disposition, 'filename');
    const partContentType = headers.find((header) => header.name.toLowerCase() === 'content-type')?.value.trim() || 'text/plain';
    const headerMap = Object.fromEntries(headers.map((header) => [header.name, header.value]));
    const partBody = responseBodyFromBytes(partBodyBytes, responseCharset(headerMap)).body;
    parts.push({
      id: index,
      title: filename ? `${name} (${filename})` : name,
      name,
      filename,
      headers,
      contentType: partContentType,
      body: partBody,
      bodyBytes: partBodyBytes,
      sizeBytes: partBodyBytes.byteLength,
    });
  }
  return { error: '', parts, truncated };
};

const safeName = (value: string) => value.trim().replace(/\s+/g, '_').replace(/[^a-z0-9._-]/gi, '_').replace(/_+/g, '_').slice(0, 120) || 'part';
const extension = (contentType: string) => contentType.includes('json') ? 'json'
  : contentType.includes('html') ? 'html'
    : contentType.includes('xml') ? 'xml'
      : contentType.includes('csv') ? 'csv'
        : contentType.includes('pdf') ? 'pdf'
          : contentType.includes('octet-stream') ? 'bin'
            : 'txt';

export const createMultipartPartArtifact = (part: MultipartPreviewPart, timestamp = Date.now()) => ({
  contents: part.bodyBytes,
  fileName: part.filename ? safeName(part.filename) : `${safeName(part.name)}-${timestamp}.${extension(part.contentType)}`,
  mimeType: part.contentType,
});
