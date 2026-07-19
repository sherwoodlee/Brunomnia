import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBlankRequest } from '../data/seed';
import type { Protocol } from '../types';
import { connectStream } from './protocol';

const tauri = vi.hoisted(() => ({ channels: [] as Array<{ onmessage?: (message: unknown) => void }>, invoke: vi.fn() }));

vi.mock('@tauri-apps/api/core', () => ({
  Channel: class {
    onmessage?: (message: unknown) => void;

    constructor() {
      tauri.channels.push(this);
    }
  },
  invoke: tauri.invoke,
  isTauri: () => true,
}));

beforeEach(() => {
  tauri.channels.length = 0;
  tauri.invoke.mockReset();
  tauri.invoke.mockResolvedValue({ status: 101, statusText: 'Connected', headers: {}, httpVersion: 'HTTP/1.1', durationMs: 1, transport: 'native' });
});

const requestFor = (protocol: Protocol) => {
  const request = createBlankRequest(`native-${protocol}`);
  request.protocol = protocol;
  request.headers = [];
  request.url = protocol === 'websocket' ? 'wss://example.test/socket' : 'https://example.test/events';
  if (protocol === 'graphql') {
    request.graphql.query = 'subscription Events { event { id } }';
    request.graphql.operationName = 'Events';
  }
  return request;
};

describe('native realtime User-Agent policy', () => {
  it.each(['websocket', 'sse', 'socketio', 'graphql'] as const)('adds the default for %s connections', async (protocol) => {
    await connectStream(requestFor(protocol), undefined, `session-${protocol}`, vi.fn());

    expect(tauri.invoke).toHaveBeenLastCalledWith(
      protocol === 'socketio' ? 'connect_socket_io' : protocol === 'sse' ? 'connect_sse' : 'connect_websocket',
      expect.objectContaining({ input: expect.objectContaining({ headers: expect.arrayContaining([expect.objectContaining({ name: 'User-Agent', value: 'brunomnia/0.1.0', enabled: true })]) }) }),
    );
  });

  it('suppresses the default for explicit opt-out and disabled authored rows', async () => {
    const request = requestFor('websocket');
    request.disableUserAgentHeader = true;
    await connectStream(request, undefined, 'session-opt-out', vi.fn());
    expect(tauri.invoke.mock.calls.at(-1)?.[1].input.headers).toEqual([]);

    request.disableUserAgentHeader = false;
    request.headers = [{ id: 'custom-agent', name: 'User-Agent', value: 'custom/1.0', enabled: false }];
    await connectStream(request, undefined, 'session-disabled-row', vi.fn());
    expect(tauri.invoke.mock.calls.at(-1)?.[1].input.headers).toEqual([expect.objectContaining({ value: 'custom/1.0', enabled: false })]);
  });
});
