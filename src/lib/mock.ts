import { invoke, isTauri } from '@tauri-apps/api/core';
import type { MockServer } from '../types';

export type RunningMock = { baseUrl: string; routeCount: number };

export const startMockServer = async (server: MockServer): Promise<RunningMock> => {
  if (!isTauri()) {
    await new Promise((resolve) => window.setTimeout(resolve, 220));
    return { baseUrl: `http://${server.host}:${server.port}`, routeCount: server.routes.filter((route) => route.enabled).length };
  }
  return invoke<RunningMock>('start_mock_server', {
    input: {
      serverId: server.id,
      host: server.host,
      port: server.port,
      routes: server.routes,
    },
  });
};

export const stopMockServer = async (serverId: string): Promise<void> => {
  if (!isTauri()) {
    await new Promise((resolve) => window.setTimeout(resolve, 120));
    return;
  }
  await invoke('stop_mock_server', { serverId });
};
