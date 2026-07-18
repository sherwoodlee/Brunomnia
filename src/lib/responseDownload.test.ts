import { describe, expect, it } from 'vitest';
import { createBlankRequest } from '../data/seed';
import type { HttpResponse } from '../types';
import { createResponseBodyArtifact, createResponseDebugArtifact, createResponseHarArtifact } from './responseDownload';

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

  it('exports the exact decoded entity bytes when display text was lossy', () => {
    const artifact = createResponseBodyArtifact('Binary', {
      ...response('f�o\0', 'application/octet-stream'),
      bodyBase64: 'ZoBvAA==',
      sizeBytes: 4,
    }, false, 42);

    expect(artifact.contents).toEqual(Uint8Array.from([0x66, 0x80, 0x6f, 0x00]));
  });

  it('prettifies decoded JSON text instead of emitting its byte container', () => {
    expect(createResponseBodyArtifact('Orders', {
      ...response('{"items":[1]}', 'application/json'),
      bodyBase64: 'eyJpdGVtcyI6WzFdfQ==',
    }, true, 42).contents).toBe('{\n  "items": [\n    1\n  ]\n}');
  });

  it('uses a text fallback for missing or unknown content types', () => {
    expect(createResponseBodyArtifact('', response('hello'), false, 42)).toMatchObject({ fileName: 'response-42.txt', mimeType: 'text/plain' });
  });

  it('creates a deterministic HTTP debug transcript from the displayed response', () => {
    const result = createResponseDebugArtifact('Get /orders', {
      ...response('hello'),
      status: 201,
      statusText: 'Created',
      httpVersion: 'HTTP/2',
      headers: { Zebra: 'last', 'Content-Type': 'text/plain' },
    }, 42);
    expect(result).toEqual({
      contents: 'HTTP/2 201 Created\r\nContent-Type: text/plain\r\nZebra: last\r\n\r\nhello',
      fileName: 'Get_orders-42.txt',
      mimeType: 'text/plain',
    });
  });

  it('exports the selected response and request version as a single-entry HAR 1.2 document', () => {
    const request = {
      ...createBlankRequest('request-historical'),
      name: 'Historical orders',
      method: 'POST' as const,
      url: 'https://old.example/orders?view=full&view=compact',
      headers: [{ id: 'content-type', name: 'Content-Type', value: 'application/json', enabled: true }],
      bodyMode: 'json' as const,
      body: '{"name":"Ada"}',
    };
    const artifact = createResponseHarArtifact(request, {
      ...response('{"id":7}', 'application/json'),
      status: 201,
      statusText: 'Created',
      durationMs: 83,
      sizeBytes: 8,
      requestUrl: 'https://old.example/orders?view=full&view=compact',
      httpVersion: 'HTTP/2',
      headers: { 'Content-Type': 'application/json', Location: '/orders/7' },
    }, 42, '2026-07-01T12:00:00.000Z');
    const har = JSON.parse(artifact.contents);
    expect(artifact).toMatchObject({ fileName: 'Historical_orders-42.har', mimeType: 'application/json' });
    expect(har.log.version).toBe('1.2');
    expect(har.log.entries).toHaveLength(1);
    expect(har.log.entries[0]).toMatchObject({
      startedDateTime: '2026-07-01T12:00:00.000Z',
      time: 83,
      request: {
        method: 'POST',
        url: 'https://old.example/orders?view=full&view=compact',
        httpVersion: 'HTTP/2',
        queryString: [{ name: 'view', value: 'full' }, { name: 'view', value: 'compact' }],
        bodySize: 14,
        postData: { mimeType: 'application/json', text: '{"name":"Ada"}' },
      },
      response: {
        status: 201,
        statusText: 'Created',
        httpVersion: 'HTTP/2',
        content: { size: 8, mimeType: 'application/json', text: '{"id":7}' },
        redirectURL: '/orders/7',
        bodySize: 8,
      },
      timings: { send: 0, wait: 83, receive: 0 },
      comment: 'Historical orders',
    });
  });

  it('falls back to configured query rows and a stable timestamp for an unresolved URL', () => {
    const request = {
      ...createBlankRequest('request-template'),
      name: 'Templated',
      url: '{{ base_url }}/orders',
      params: [{ id: 'query', name: 'page', value: '2', enabled: true }],
    };
    const har = JSON.parse(createResponseHarArtifact(request, response('ok'), 42, 'not-a-date').contents);
    expect(har.log.entries[0].startedDateTime).toBe('1970-01-01T00:00:00.042Z');
    expect(har.log.entries[0].request.queryString).toEqual([{ name: 'page', value: '2' }]);
  });
});
