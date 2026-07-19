import { describe, expect, it } from 'vitest';
import type { MockServer, StoredResponse } from '../types';
import { applyResponseToMockTarget, createMockRouteFromResponse, overwriteMockRouteFromResponse } from './mockRouteFromResponse';

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

  it('overwrites only response fields on an existing route', () => {
    const existing = createMockRouteFromResponse(response(), 'existing-route');
    const customized = { ...existing, name: 'Reviewed scenario', method: 'PATCH' as const, path: '/reviewed/{id}', enabled: false, delayMs: 450 };
    const updated = overwriteMockRouteFromResponse(customized, response({ status: 202, body: '{"queued":true}', headers: { 'Content-Type': 'application/json', 'X-Revision': 'two' } }));
    expect(updated).toMatchObject({ id: 'existing-route', name: 'Reviewed scenario', method: 'PATCH', path: '/reviewed/{id}', enabled: false, delayMs: 450, status: 202, body: '{"queued":true}' });
    expect(updated.headers).toEqual([
      { id: 'existing-route-header-0', name: 'Content-Type', value: 'application/json', enabled: true },
      { id: 'existing-route-header-1', name: 'X-Revision', value: 'two', enabled: true },
    ]);
  });

  it('applies binary refusal to existing-route overwrite too', () => {
    const existing = createMockRouteFromResponse(response(), 'existing-route');
    expect(() => overwriteMockRouteFromResponse(existing, response({ headers: { 'Content-Type': 'application/zip' }, body: 'PK�', bodyBase64: 'UEsD' }))).toThrow('response is binary');
  });

  it('creates an account-free local server on the first available port', () => {
    const existing: MockServer = { id: 'server-one', name: 'Existing', host: '127.0.0.1', port: 4010, routes: [] };
    const applied = applyResponseToMockTarget([existing], response({ requestSnapshot: { method: 'POST' } as StoredResponse['requestSnapshot'] }), {
      newServerId: 'server-two', newRouteId: 'route-two', newServerName: 'Orders mock', path: '/orders', method: 'PATCH',
    });
    expect(applied).toMatchObject({ serverId: 'server-two', routeId: 'route-two', action: 'created-server' });
    expect(applied.mockServers[1]).toMatchObject({ id: 'server-two', name: 'Orders mock', host: '127.0.0.1', port: 4011 });
    expect(applied.mockServers[1].routes[0]).toMatchObject({ id: 'route-two', method: 'PATCH', path: '/orders', status: 201, body: '{"ok":true}' });
  });

  it('creates a route in an existing server and rejects shadowing method-path conflicts', () => {
    const existingRoute = createMockRouteFromResponse(response(), 'route-one');
    const server: MockServer = { id: 'server-one', name: 'Orders', host: '127.0.0.1', port: 4010, routes: [existingRoute] };
    const applied = applyResponseToMockTarget([server], response(), {
      serverId: server.id, newServerId: 'unused', newRouteId: 'route-two', path: '/health', method: 'GET',
    });
    expect(applied).toMatchObject({ serverId: 'server-one', routeId: 'route-two', action: 'created-route' });
    expect(applied.mockServers[0].routes).toHaveLength(2);
    expect(() => applyResponseToMockTarget([server], response(), {
      serverId: server.id, newServerId: 'unused', newRouteId: 'route-two', path: existingRoute.path, method: existingRoute.method,
    })).toThrow('Select that route to overwrite it');
  });

  it('overwrites the selected route while preserving its authored match fields', () => {
    const route = { ...createMockRouteFromResponse(response(), 'route-one'), name: 'Reviewed', path: '/reviewed/{id}', method: 'PUT' as const, delayMs: 250 };
    const server: MockServer = { id: 'server-one', name: 'Orders', host: '127.0.0.1', port: 4010, routes: [route] };
    const applied = applyResponseToMockTarget([server], response({ status: 202, body: '{"queued":true}' }), {
      serverId: server.id, routeId: route.id, newServerId: 'unused', newRouteId: 'unused', path: '/ignored', method: 'GET',
    });
    expect(applied).toMatchObject({ serverId: 'server-one', routeId: 'route-one', action: 'overwritten-route' });
    expect(applied.mockServers[0].routes[0]).toMatchObject({ name: 'Reviewed', path: '/reviewed/{id}', method: 'PUT', delayMs: 250, status: 202, body: '{"queued":true}' });
  });

  it('rejects stale server and route selections without mutating data', () => {
    const server: MockServer = { id: 'server-one', name: 'Orders', host: '127.0.0.1', port: 4010, routes: [] };
    expect(() => applyResponseToMockTarget([server], response(), { serverId: 'missing', newServerId: 'unused', newRouteId: 'route' })).toThrow('server no longer exists');
    expect(() => applyResponseToMockTarget([server], response(), { serverId: server.id, routeId: 'missing', newServerId: 'unused', newRouteId: 'route' })).toThrow('route no longer exists');
  });
});
