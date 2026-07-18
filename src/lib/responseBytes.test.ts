import { describe, expect, it } from 'vitest';
import { responseBodyBytes, responseBodyFromBytes } from './responseBytes';

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
});
