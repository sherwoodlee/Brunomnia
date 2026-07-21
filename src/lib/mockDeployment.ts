import type { MockServer } from '../types';

export const MOCK_DEPLOYMENT_FORMAT = 'brunomnia-mock-deployment';
export const MOCK_DEPLOYMENT_VERSION = 1;

export type MockDeployment = {
  format: typeof MOCK_DEPLOYMENT_FORMAT;
  version: typeof MOCK_DEPLOYMENT_VERSION;
  name: string;
  server: {
    serverId: string;
    host: '0.0.0.0';
    port: number;
    routes: MockServer['routes'];
  };
};

export const createMockDeployment = (server: MockServer): MockDeployment => ({
  format: MOCK_DEPLOYMENT_FORMAT,
  version: MOCK_DEPLOYMENT_VERSION,
  name: server.name,
  server: {
    serverId: server.id,
    host: '0.0.0.0',
    port: server.port,
    routes: structuredClone(server.routes),
  },
});

export const mockDeploymentFileName = (server: Pick<MockServer, 'id' | 'name'>) => {
  const name = server.name.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
  const fallback = server.id.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 80) || 'mock';
  return `${name || fallback}.brunomnia-mock.json`;
};

export const mockDeploymentJson = (server: MockServer) => `${JSON.stringify(createMockDeployment(server), null, 2)}\n`;

export const downloadMockDeployment = (server: MockServer) => {
  const url = URL.createObjectURL(new Blob([mockDeploymentJson(server)], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = mockDeploymentFileName(server);
  anchor.click();
  URL.revokeObjectURL(url);
};
