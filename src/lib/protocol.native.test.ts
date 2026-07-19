import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBlankRequest } from '../data/seed';
import type { CookieRecord, Protocol, StoredResponse } from '../types';
import { connectStream, runStreamSample } from './protocol';
import { sendSocketIoMessage } from './socketIo';

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
  it('disconnects an active runner stream when its signal aborts', async () => {
    const request = requestFor('sse');
    const controller = new AbortController();
    const pending = runStreamSample(request, { id: 'environment', name: 'Environment', variables: [] }, 30_000, 'default', 10, true, 30_000, true, undefined, [], undefined, {}, controller.signal);
    await vi.waitFor(() => expect(tauri.invoke).toHaveBeenCalledWith('connect_sse', expect.anything()));

    controller.abort();

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(tauri.invoke).toHaveBeenCalledWith('disconnect_sse', { sessionId: expect.stringMatching(/^runner-stream-/) });
  });

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

  it.each(['websocket', 'sse', 'socketio', 'graphql'] as const)('renders local tags for %s connection fields', async (protocol) => {
    const request = requestFor(protocol);
    request.url = `${protocol === 'websocket' ? 'wss' : 'https'}://example.test/{% hash 'md5', 'hex', 'connection' %}`;
    request.headers = [{ id: 'digest', name: 'X-Digest', value: "{% hash 'md5', 'hex', 'header' %}", enabled: true }];
    request.socketIo.path = "/{% base64 'encode', 'socket' %}";

    await connectStream(request, undefined, `local-tags-${protocol}`, vi.fn());

    expect(tauri.invoke.mock.calls.at(-1)?.[1].input).toMatchObject({
      url: `${protocol === 'websocket' || protocol === 'graphql' ? 'wss' : 'https'}://example.test/4717d53ebfdfea8477f780ec66151dcb`,
      headers: expect.arrayContaining([expect.objectContaining({ value: '099fb995346f31c749f6e40db0f395e3' })]),
      ...(protocol === 'socketio' ? { path: '/c29ja2V0' } : {}),
    });
  });

  it('renders local tags in Socket.IO event arguments', async () => {
    const request = requestFor('socketio');
    request.socketIo.eventName = "{% base64 'encode', 'event' %}";
    request.socketIo.args = [{ id: 'argument', mode: 'json', value: "{\"digest\":\"{% hash 'md5', 'hex', 'message' %}\"}" }];

    await sendSocketIoMessage(request, undefined, 'socket-message-tags', vi.fn());

    expect(tauri.invoke).toHaveBeenLastCalledWith('send_socket_io_message', {
      sessionId: 'socket-message-tags',
      eventName: 'ZXZlbnQ=',
      args: [{ digest: '78e731027d8fd50ed642340b7c9a63b3' }],
      ack: false,
    });
  });

  it('renders granted plugin tags without running realtime request hooks', async () => {
    const request = requestFor('websocket');
    request.url = "wss://example.test/{% plugin_value 'path' %}";
    const beforeRequest = vi.fn();
    const afterResponse = vi.fn();
    const pluginRuntime = {
      beforeRequest,
      afterResponse,
      templateTag: vi.fn(async () => 'plugin-path'),
    };

    await connectStream(request, undefined, 'plugin-tags', vi.fn(), 'default', 10, true, 30_000, true, undefined, [], undefined, { pluginRuntime });

    expect(tauri.invoke.mock.calls.at(-1)?.[1].input.url).toBe('wss://example.test/plugin-path');
    expect(pluginRuntime.templateTag).toHaveBeenCalledWith('plugin_value', ['path'], request);
    expect(beforeRequest).not.toHaveBeenCalled();
    expect(afterResponse).not.toHaveBeenCalled();
  });

  it.each(['websocket', 'socketio'] as const)('does not eagerly render unsent %s payload fields while connecting', async (protocol) => {
    const request = requestFor(protocol);
    request.body = "{% not_available 'websocket-body' %}";
    request.socketIo.args = [{ id: 'argument', mode: 'text', value: "{% not_available 'socket-argument' %}" }];
    request.socketIo.eventName = "{% not_available 'socket-event' %}";

    await expect(connectStream(request, undefined, `connection-only-${protocol}`, vi.fn())).resolves.toMatchObject({ status: 101 });
  });

  it('uses dependent-request cookies in the parent realtime handshake', async () => {
    const request = requestFor('websocket');
    request.headers = [{ id: 'dependency', name: 'X-Dependency', value: "{% response 'body', 'dependency', '$.id', 'always' %}", enabled: true }];
    const cookies: CookieRecord[] = [];
    const responses: StoredResponse[] = [];
    const resolveResponse = vi.fn(async (input: { cookies: CookieRecord[]; responses: StoredResponse[] }) => {
      const stored: StoredResponse = { id: 'dependency-response', requestId: 'dependency', requestName: 'Dependency', requestUrl: 'https://example.test/dependency', environmentId: 'development', receivedAt: new Date().toISOString(), status: 200, statusText: 'OK', headers: {}, body: '{"id":"dep-1"}', durationMs: 1, sizeBytes: 14 };
      input.responses.push(stored);
      input.cookies.push({ id: 'dependent-cookie', name: 'session', value: 'shared', domain: 'example.test', path: '/', secure: true, httpOnly: true, sameSite: 'lax', hostOnly: true, createdAt: new Date().toISOString() });
      return stored;
    });

    await connectStream(request, { id: 'development', name: 'Development', variables: [] }, 'dependent-cookie-stream', vi.fn(), 'default', 10, true, 30_000, true, undefined, [], undefined, { cookies, responses, resolveResponse });

    expect(tauri.invoke.mock.calls.at(-1)?.[1].input.headers).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'X-Dependency', value: 'dep-1' }),
      expect.objectContaining({ name: 'Cookie', value: 'session=shared' }),
    ]));
  });
});
