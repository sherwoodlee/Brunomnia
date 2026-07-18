import { describe, expect, it } from 'vitest';
import type { StoredResponse } from '../types';
import { createMockRouteFromResponse } from './mockRouteFromResponse';

const response = (patch: Partial<StoredResponse> = {}): StoredResponse => ({
  id: 'response-one', requestId: 'request-one', requestName: 'Create order', requestUrl: 'https://api.example.test/orders/ord_1?expand=items', environmentId: 'environment-one', receivedAt: '2026-07-18T00:00:00.000Z',
  status: 201, statusText: 'Created', headers: { 'Content-Type': 'application/json', 'Content-Length': '15', 'X-Trace': 'trace-one' }, body: '{"ok":true}', durationMs: 12, sizeBytes: 11,
  ...patch,
});

describe('response-to-mock route conversion', () => {
  it('copies editable response data and derives the request method and URL path', () => {
    const stored = response({ requestSnapshot: { method: 'POST' } as StoredResponse['requestSnapshot'] });
    const route = createMockRouteFromResponse(stored, 'route-one');
    expect(route).toMatchObject({ id: 'route-one', name: 'POST /orders/ord_1 · 201', method: 'POST', path: '/orders/ord_1', status: 201, body: '{"ok":true}', delayMs: 0 });
    expect(route.headers).toEqual([
      { id: 'route-one-header-0', name: 'Content-Type', value: 'application/json', enabled: true },
      { id: 'route-one-header-1', name: 'X-Trace', value: 'trace-one', enabled: true },
    ]);
  });

  it('removes decoded-body transport headers and falls back safely for invalid URLs and methods', () => {
    const stored = response({
      requestUrl: 'not a URL',
      requestSnapshot: { method: 'CUSTOM' } as StoredResponse['requestSnapshot'],
      headers: { 'Content-Type': 'text/plain; charset=windows-1252', 'Content-Encoding': 'gzip', Connection: 'close', 'Transfer-Encoding': 'chunked' },
      body: 'café', bodyBase64: 'Y2Fm6Q==',
    });
    expect(createMockRouteFromResponse(stored, 'route-two')).toMatchObject({ method: 'GET', path: '/new-route', body: 'café', headers: [{ name: 'Content-Type' }] });
  });

  it('accepts relative response paths and empty bodies', () => {
    expect(createMockRouteFromResponse(response({ requestUrl: '/health?verbose=true', headers: {}, body: '', status: 204 }), 'route-three')).toMatchObject({ path: '/health', status: 204, body: '' });
  });

  it('refuses binary and oversized bodies instead of corrupting saved bytes', () => {
    expect(() => createMockRouteFromResponse(response({ headers: { 'Content-Type': 'image/png' }, body: '�PNG', bodyBase64: 'iVBORw==' }))).toThrow('response is binary');
    expect(() => createMockRouteFromResponse(response({ body: 'x'.repeat(10_000_001) }))).toThrow('10,000,000-character');
  });
});
