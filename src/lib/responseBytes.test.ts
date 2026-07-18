import { describe, expect, it } from 'vitest';
import { decodeHttpResponseBody, responseBodyBytes, responseBodyFromBytes, responseCharset } from './responseBytes';

describe('response byte preservation', () => {
  it('uses the UTF-8 body as the lossless representation when possible', () => {
    const bytes = new TextEncoder().encode('héllo 🌍');
    const response = responseBodyFromBytes(bytes);

    expect(response).toEqual({ body: 'héllo 🌍' });
    expect(responseBodyBytes(response)).toEqual(bytes);
  });

  it('keeps exact decoded entity bytes when UTF-8 display text is lossy', () => {
    const bytes = Uint8Array.from([0x66, 0x80, 0x6f, 0x00]);
    const response = responseBodyFromBytes(bytes);

    expect(response.body).toBe('f�o\0');
    expect(response.bodyBase64).toBe('ZoBvAA==');
    expect(responseBodyBytes(response)).toEqual(bytes);
  });

  it('falls back to inspectable text when persisted Base64 is corrupt', () => {
    expect(responseBodyBytes({ body: 'safe', bodyBase64: 'not base64!' })).toEqual(new TextEncoder().encode('safe'));
  });

  it('honors quoted charset aliases while retaining the original entity bytes', () => {
    const bytes = Uint8Array.from([0x63, 0x61, 0x66, 0xe9]);
    const response = responseBodyFromBytes(bytes, 'win1252');

    expect(response).toEqual({ body: 'café', bodyBase64: 'Y2Fm6Q==' });
    expect(responseBodyBytes(response)).toEqual(bytes);
    expect(responseCharset({ 'CONTENT-TYPE': 'text/plain; charset="win1252"' })).toBe('windows-1252');
  });

  it('decodes UTF-16 response text even when its bytes are valid UTF-8 code units', () => {
    const response = decodeHttpResponseBody({ body: 'H\0i\0', headers: { 'Content-Type': 'text/plain; charset=ucs2' } });

    expect(response.body).toBe('Hi');
    expect(response.bodyBase64).toBe('SABpAA==');
    expect(responseBodyBytes(response)).toEqual(Uint8Array.from([0x48, 0x00, 0x69, 0x00]));
  });

  it('keeps a UTF-8 BOM byte-exact when the inspection decoder removes it', () => {
    const bytes = Uint8Array.from([0xef, 0xbb, 0xbf, 0x6f, 0x6b]);
    const response = responseBodyFromBytes(bytes);

    expect(response.body).toBe('ok');
    expect(response.bodyBase64).toBe('77u/b2s=');
    expect(responseBodyBytes(response)).toEqual(bytes);
  });
});
