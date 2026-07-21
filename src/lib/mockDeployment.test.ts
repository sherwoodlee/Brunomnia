import { describe, expect, it } from 'vitest';
import type { MockServer } from '../types';
import { createMockDeployment, MOCK_DEPLOYMENT_FORMAT, mockDeploymentFileName, mockDeploymentJson } from './mockDeployment';

const server: MockServer = {
  id: 'mock-orders',
  name: 'Orders / Public API',
  host: '127.0.0.1',
  port: 8080,
  routes: [{ id: 'route-orders', name: 'Orders', enabled: true, method: 'GET', path: '/orders', status: 200, headers: [], body: '[]', delayMs: 0 }],
};

describe('mock deployments', () => {
  it('exports the bounded headless runtime contract without local-only bind state', () => {
    expect(createMockDeployment(server)).toEqual({
      format: MOCK_DEPLOYMENT_FORMAT,
      version: 1,
      name: 'Orders / Public API',
      server: {
        serverId: 'mock-orders',
        host: '0.0.0.0',
        port: 8080,
        routes: server.routes,
      },
    });
    expect(JSON.parse(mockDeploymentJson(server))).toMatchObject({ server: { host: '0.0.0.0', routes: [{ path: '/orders' }] } });
  });

  it('creates portable bounded deployment filenames', () => {
    expect(mockDeploymentFileName(server)).toBe('orders-public-api.brunomnia-mock.json');
    expect(mockDeploymentFileName({ id: 'mock/fallback', name: ' 🔒 ' })).toBe('mock-fallback.brunomnia-mock.json');
  });
});
