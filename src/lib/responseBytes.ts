import type { HttpResponse } from '../types';

const utf8Decoder = new TextDecoder();
const strictUtf8Decoder = new TextDecoder('utf-8', { fatal: true });
const utf8Encoder = new TextEncoder();
const BASE64_CHUNK_BYTES = 8_192;
const UTF8_BOM = [0xef, 0xbb, 0xbf];

const encodeBase64 = (bytes: Uint8Array) => {
  const chunks: string[] = [];
  for (let offset = 0; offset < bytes.byteLength; offset += BASE64_CHUNK_BYTES) {
    chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + BASE64_CHUNK_BYTES)));
  }
  return btoa(chunks.join(''));
};

const decodeBase64 = (value: string) => Uint8Array.from(atob(value), (character) => character.charCodeAt(0));

const charsetLabel = (value: string) => {
  const label = value.trim().toLowerCase();
  if (label === 'utf8') return 'utf-8';
  if (label === 'utf16le' || label === 'ucs2' || label === 'ucs-2') return 'utf-16le';
  if (label === 'latin1' || label === 'binary') return 'iso-8859-1';
  const windows = label.match(/^win(125[0-8])$/);
  return windows ? `windows-${windows[1]}` : label || 'utf-8';
};

export const responseCharset = (headers: Record<string, string>) => {
  const contentType = Object.entries(headers).find(([name]) => name.toLowerCase() === 'content-type')?.[1] ?? '';
  const match = contentType.match(/(?:^|;)\s*charset\s*=\s*(?:"([^"]+)"|'([^']+)'|([^;\s]+))/i);
  return charsetLabel((match?.[1] ?? match?.[2] ?? match?.[3] ?? 'utf-8').slice(0, 100));
};

const hasUtf8Bom = (bytes: Uint8Array) => UTF8_BOM.every((byte, index) => bytes[index] === byte);

const sameBytes = (left: Uint8Array, right: Uint8Array) => left.byteLength === right.byteLength
  && left.every((byte, index) => byte === right[index]);

export const responseBodyFromBytes = (bytes: Uint8Array, charset = 'utf-8'): Pick<HttpResponse, 'body' | 'bodyBase64'> => {
  const label = charsetLabel(charset);
  if (label === 'utf-8') {
    const body = utf8Decoder.decode(bytes);
    try {
      strictUtf8Decoder.decode(bytes);
      return hasUtf8Bom(bytes) ? { body, bodyBase64: encodeBase64(bytes) } : { body };
    } catch {
      return { body, bodyBase64: encodeBase64(bytes) };
    }
  }
  try {
    const body = new TextDecoder(label).decode(bytes);
    return sameBytes(utf8Encoder.encode(body), bytes) ? { body } : { body, bodyBase64: encodeBase64(bytes) };
  } catch {
    return responseBodyFromBytes(bytes);
  }
};

export const responseBodyBytes = (response: Pick<HttpResponse, 'body' | 'bodyBase64'>) => {
  if (response.bodyBase64 !== undefined) {
    try { return decodeBase64(response.bodyBase64); } catch { /* fall back to the inspectable text */ }
  }
  return utf8Encoder.encode(response.body);
};

export const decodeHttpResponseBody = <T extends Pick<HttpResponse, 'body' | 'bodyBase64' | 'headers'>>(
  response: T,
): T & Pick<HttpResponse, 'body' | 'bodyBase64'> => {
  const decoded = responseBodyFromBytes(responseBodyBytes(response), responseCharset(response.headers));
  return { ...response, body: decoded.body, bodyBase64: decoded.bodyBase64 };
};
