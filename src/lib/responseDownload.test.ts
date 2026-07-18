import { describe, expect, it } from 'vitest';
import type { HttpResponse } from '../types';
import { createResponseBodyArtifact } from './responseDownload';

const response = (body: string, contentType?: string): HttpResponse => ({
  status: 200,
  statusText: 'OK',
  headers: contentType ? { 'Content-Type': contentType } : {},
  body,
  durationMs: 1,
  sizeBytes: body.length,
});

describe('response body downloads', () => {
  it('derives a safe content-type filename for the raw body', () => {
    expect(createResponseBodyArtifact('Get /orders', response('{"ok":true}', 'application/problem+json; charset=utf-8'), false, 42)).toEqual({
      contents: '{"ok":true}',
      fileName: 'Get_orders-42.json',
      mimeType: 'application/problem+json',
    });
  });

  it('prettifies valid JSON without changing its meaning', () => {
    expect(createResponseBodyArtifact('Orders', response('{"items":[1]}', 'application/json'), true, 42).contents).toBe('{\n  "items": [\n    1\n  ]\n}');
  });

  it('keeps invalid JSON raw when prettification is requested', () => {
    expect(createResponseBodyArtifact('Orders', response('{invalid', 'application/json'), true, 42).contents).toBe('{invalid');
  });

  it('uses a text fallback for missing or unknown content types', () => {
    expect(createResponseBodyArtifact('', response('hello'), false, 42)).toMatchObject({ fileName: 'response-42.txt', mimeType: 'text/plain' });
  });
});
