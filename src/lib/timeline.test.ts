import { describe, expect, it } from 'vitest';
import { createBlankRequest } from '../data/seed';
import type { HttpResponse } from '../types';
import { buildResponseTimeline, describeTimelineBytes, formatResponseTimeline } from './timeline';

const response: HttpResponse = {
  status: 201,
  statusText: 'Created',
  headers: {},
  body: '{"ok":true}',
  durationMs: 42,
  sizeBytes: 11,
  httpVersion: 'HTTP/2.0',
};

describe('response timeline evidence', () => {
  it('shows outgoing text below the configured limit and records response evidence', () => {
    const request = createBlankRequest('visible-timeline');
    request.method = 'POST';
    request.bodyMode = 'json';
    request.body = '{"name":"Ada"}';

    const timeline = buildResponseTimeline(request, 'https://example.test/users', response, 10);
    expect(timeline[0]).toMatchObject({ name: 'Text', value: 'Preparing POST request to https://example.test/users', elapsedMs: 0 });
    expect(timeline[1]).toMatchObject({ name: 'DataOut', value: request.body, elapsedMs: 0 });
    expect(timeline.some((entry) => entry.value.includes('Response 201 Created; received 11 B decoded body'))).toBe(true);
    expect(timeline.some((entry) => entry.value === 'Negotiated HTTP/2.0')).toBe(true);
  });

  it('hides data exactly at the limit and treats zero as the upstream 1 KiB fallback', () => {
    const request = createBlankRequest('hidden-timeline');
    request.method = 'POST';
    request.bodyMode = 'text';
    request.body = 'x'.repeat(10 * 1_024);
    expect(buildResponseTimeline(request, 'https://example.test', response, 10)[1]).toMatchObject({ name: 'DataOut', value: '(10 KiB hidden)', hidden: true });

    request.body = 'x'.repeat(1_024);
    expect(buildResponseTimeline(request, 'https://example.test', response, 0)[1]).toMatchObject({ value: '(1.0 KiB hidden)', hidden: true });
    request.body = 'x'.repeat(1_023);
    expect(buildResponseTimeline(request, 'https://example.test', response, 0)[1]).toMatchObject({ value: request.body });
  });

  it('preserves repeated form fields and summarizes multipart file data', () => {
    const request = createBlankRequest('structured-timeline');
    request.method = 'POST';
    request.bodyMode = 'form-urlencoded';
    request.formBody = [
      { id: 'one', name: 'tag', value: 'first', enabled: true },
      { id: 'two', name: 'tag', value: 'second', enabled: true },
    ];
    expect(buildResponseTimeline(request, 'https://example.test', response, 10)[1].value).toBe('tag=first&tag=second');

    request.bodyMode = 'multipart';
    request.multipartBody = [{ id: 'file', name: 'upload', value: '', enabled: true, kind: 'file', fileName: 'hello.txt', contentType: 'text/plain', file: { fileName: 'source.txt', mimeType: 'text/plain', dataBase64: 'aGVsbG8=' } }];
    expect(buildResponseTimeline(request, 'https://example.test', response, 10)[1].value).toBe('upload=@hello.txt (5 B) (configured multipart data; wire framing excluded)');
  });

  it('uses the serialized GraphQL payload even though the request body mode is none', () => {
    const request = createBlankRequest('graphql-timeline');
    request.protocol = 'graphql';
    request.method = 'POST';
    request.bodyMode = 'none';
    const payload = '{"query":"query Viewer { viewer { id } }","variables":{}}';
    expect(buildResponseTimeline(request, 'https://example.test/graphql', response, 10, payload)[1]).toMatchObject({ name: 'DataOut', value: payload });
  });

  it('retains configured duplicate request headers and native redirect/response evidence', () => {
    const request = createBlankRequest('transport-timeline');
    const timeline = buildResponseTimeline(request, 'https://example.test/start', response, 10, undefined, {
      requestHeaders: [{ name: 'X-Trace', value: 'one' }, { name: 'X-Trace', value: 'two' }],
      responseHeaders: [{ name: 'set-cookie', value: 'first=1' }, { name: 'set-cookie', value: 'second=2' }],
      redirects: [{ status: 302, fromUrl: 'https://example.test/start', toUrl: 'https://example.test/final', elapsedMs: 12 }],
      redirectsTruncated: true,
      effectiveUrl: 'https://example.test/final',
    });

    expect(timeline).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'HeaderOut', value: 'X-Trace: one\nX-Trace: two' }),
      expect.objectContaining({ name: 'Text', value: 'Redirect 302: https://example.test/start -> https://example.test/final', elapsedMs: 12 }),
      expect.objectContaining({ name: 'Text', value: 'Redirect trace truncated after 100 hops' }),
      expect.objectContaining({ name: 'HeaderIn', value: 'HTTP/2.0 201 Created\nset-cookie: first=1\nset-cookie: second=2' }),
      expect.objectContaining({ name: 'Text', value: 'Effective URL https://example.test/final' }),
    ]));
  });

  it('formats byte evidence with IEC units', () => {
    expect(describeTimelineBytes(0)).toBe('0 B');
    expect(describeTimelineBytes(1_024)).toBe('1.0 KiB');
    expect(describeTimelineBytes(10_240)).toBe('10 KiB');
    expect(describeTimelineBytes(1_048_576)).toBe('1.0 MiB');
  });

  it('formats every pinned timeline category and prefixes each nonblank line', () => {
    expect(formatResponseTimeline([
      { name: 'HeaderIn', value: 'HTTP/1.1 200 OK\nContent-Type: text/plain\n', elapsedMs: 1 },
      { name: 'DataIn', value: 'Received 2 B chunk', elapsedMs: 2 },
      { name: 'SslDataIn', value: 'incoming TLS', elapsedMs: 2 },
      { name: 'HeaderOut', value: 'GET / HTTP/1.1', elapsedMs: 0 },
      { name: 'DataOut', value: 'one\n\ntwo', elapsedMs: 0 },
      { name: 'SslDataOut', value: 'outgoing TLS', elapsedMs: 0 },
      { name: 'Text', value: 'Connected', elapsedMs: 1 },
    ])).toBe('< HTTP/1.1 200 OK\n< Content-Type: text/plain\n\n| Received 2 B chunk\n\n<< incoming TLS\n\n> GET / HTTP/1.1\n\n| one\n| two\n\n>> outgoing TLS\n\n* Connected');
  });
});
