import { describe, expect, it } from 'vitest';
import { detectedResponseContentType } from './responseContentType';

const bytes = (value: string) => new TextEncoder().encode(value);

describe('response content-type detection', () => {
  it('routes valid JSON before a misleading declared type', () => {
    expect(detectedResponseContentType('image/png', bytes(' {"ok":true}\n'))).toBe('application/json');
    expect(detectedResponseContentType('text/plain', bytes('42'))).toBe('application/json');
  });

  it('detects an HTML doctype in the first 100 bytes', () => {
    expect(detectedResponseContentType('text/plain', bytes('  <!DOCTYPE html><html></html>'))).toBe('text/html');
    expect(detectedResponseContentType('application/octet-stream', bytes(`${' '.repeat(101)}<!doctype html>`))).toBe('application/octet-stream');
    expect(detectedResponseContentType('text/plain', bytes('<html></html>'))).toBe('text/plain');
  });

  it('preserves declared parameters and case-sensitive boundaries when detection does not apply', () => {
    const contentType = 'Multipart/Mixed; boundary=InnerCase';
    expect(detectedResponseContentType(contentType, bytes('--InnerCase--'))).toBe(contentType);
    expect(detectedResponseContentType(contentType, new Uint8Array())).toBe(contentType);
  });
});
