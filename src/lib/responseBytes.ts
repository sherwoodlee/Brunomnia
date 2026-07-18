import type { HttpResponse } from '../types';

const utf8Decoder = new TextDecoder();
const strictUtf8Decoder = new TextDecoder('utf-8', { fatal: true });
const utf8Encoder = new TextEncoder();
const BASE64_CHUNK_BYTES = 8_192;

const encodeBase64 = (bytes: Uint8Array) => {
  const chunks: string[] = [];
  for (let offset = 0; offset < bytes.byteLength; offset += BASE64_CHUNK_BYTES) {
    chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + BASE64_CHUNK_BYTES)));
  }
  return btoa(chunks.join(''));
};

const decodeBase64 = (value: string) => Uint8Array.from(atob(value), (character) => character.charCodeAt(0));

export const responseBodyFromBytes = (bytes: Uint8Array): Pick<HttpResponse, 'body' | 'bodyBase64'> => {
  const body = utf8Decoder.decode(bytes);
  try {
    strictUtf8Decoder.decode(bytes);
    return { body };
  } catch {
    return { body, bodyBase64: encodeBase64(bytes) };
  }
};

export const responseBodyBytes = (response: Pick<HttpResponse, 'body' | 'bodyBase64'>) => {
  if (response.bodyBase64 !== undefined) {
    try { return decodeBase64(response.bodyBase64); } catch { /* fall back to the inspectable text */ }
  }
  return utf8Encoder.encode(response.body);
};
