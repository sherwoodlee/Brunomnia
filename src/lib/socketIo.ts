import { Channel, invoke, isTauri } from '@tauri-apps/api/core';
import type { ApiRequest, CookieRecord, Environment, KeyValue, PreferredHttpVersion, StreamConnectionMetadata, StreamMessage, WorkspaceCertificates } from '../types';
import { cookieHeaderForUrl } from './cookies';
import { streamTransportConfig } from './protocol';
import { buildHeaders, buildRequestUrl, environmentMap, resolveTemplate } from './request';
import type { ProxyPreferences } from './transport';
import { applyDefaultUserAgentHeader } from './userAgent';

const mockTimers = new Map<string, number[]>();

const event = (sessionId: string, direction: StreamMessage['direction'], kind: string, text: string): StreamMessage => ({
  id: `${sessionId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  sessionId,
  direction,
  kind,
  text,
  timestamp: new Date().toISOString(),
});

const resolvedHeaders = (request: ApiRequest, environment?: Environment): KeyValue[] => {
  const variables = environmentMap(environment);
  return buildHeaders(request, variables)
    .filter((header) => header.id !== 'auth-bearer')
    .map((header) => ({
      ...header,
      name: resolveTemplate(header.name, variables),
      value: resolveTemplate(header.value, variables),
    }));
};

export const connectSocketIo = async (
  request: ApiRequest,
  environment: Environment | undefined,
  sessionId: string,
  onEvent: (message: StreamMessage) => void,
  preferredHttpVersion: PreferredHttpVersion = 'default',
  maxRedirects = 10,
  followRedirects = true,
  requestTimeoutMs = 30_000,
  validateCertificates = true,
  proxy?: ProxyPreferences,
  cookies: CookieRecord[] = [],
  certificates?: WorkspaceCertificates,
): Promise<StreamConnectionMetadata> => {
  const variables = environmentMap(environment);
  const url = buildRequestUrl(request, variables);
  let headers = resolvedHeaders(request, environment);
  if (request.transport.sendCookies && !headers.some((header) => header.enabled && header.name.toLowerCase() === 'cookie')) {
    const cookie = cookieHeaderForUrl(cookies, url);
    if (cookie) headers.push({ id: 'cookie-jar', name: 'Cookie', value: cookie, enabled: true });
  }
  headers = applyDefaultUserAgentHeader(headers, request.disableUserAgentHeader);
  if (isTauri()) {
    const channel = new Channel<StreamMessage>();
    channel.onmessage = onEvent;
    return invoke<StreamConnectionMetadata>('connect_socket_io', {
      input: {
        sessionId,
        url,
        headers,
        transport: streamTransportConfig(request, preferredHttpVersion, maxRedirects, followRedirects, requestTimeoutMs, validateCertificates, proxy, url, certificates),
        path: resolveTemplate(request.socketIo.path, variables),
        authToken: request.auth.type === 'bearer' && !request.auth.disabled ? resolveTemplate(request.auth.token, variables) : '',
        eventListeners: request.socketIo.eventListeners
          .filter((listener) => listener.enabled && listener.eventName.trim())
          .map((listener) => resolveTemplate(listener.eventName, variables)),
      },
      onEvent: channel,
    });
  }

  onEvent(event(sessionId, 'system', 'open', `Connected · Socket.IO · path ${request.socketIo.path || '/socket.io'}`));
  const timers = request.socketIo.eventListeners
    .filter((listener) => listener.enabled && listener.eventName.trim())
    .slice(0, 2)
    .map((listener, index) => window.setTimeout(
      () => onEvent(event(sessionId, 'incoming', listener.eventName, '[{"id":"evt_socket_201"}]')),
      450 + index * 650,
    ));
  mockTimers.set(sessionId, timers);
  return {
    status: 200,
    statusText: 'OK',
    headers: {},
    httpVersion: 'HTTP/1.1',
    durationMs: 0,
    transport: 'Browser simulation',
  };
};

export const disconnectSocketIo = async (sessionId: string) => {
  if (isTauri()) {
    await invoke('disconnect_socket_io', { sessionId });
    return;
  }
  mockTimers.get(sessionId)?.forEach((timer) => window.clearTimeout(timer));
  mockTimers.delete(sessionId);
};

export const socketIoArgs = (request: ApiRequest, environment?: Environment): unknown[] => {
  const variables = environmentMap(environment);
  return request.socketIo.args.slice(0, 100).map((arg) => {
    const value = resolveTemplate(arg.value, variables);
    if (arg.mode === 'json') {
      try { return JSON.parse(value); } catch { return value; }
    }
    return value;
  });
};

export const sendSocketIoMessage = async (
  request: ApiRequest,
  environment: Environment | undefined,
  sessionId: string,
  onEvent: (message: StreamMessage) => void,
) => {
  const variables = environmentMap(environment);
  const eventName = resolveTemplate(request.socketIo.eventName, variables).trim() || 'message';
  const args = socketIoArgs(request, environment);
  if (isTauri()) {
    await invoke('send_socket_io_message', { sessionId, eventName, args, ack: request.socketIo.ack });
  } else {
    const text = JSON.stringify(args, null, 2);
    onEvent(event(sessionId, 'outgoing', eventName, text));
    if (request.socketIo.ack) window.setTimeout(() => onEvent(event(sessionId, 'incoming', `${eventName} · ack`, '["acknowledged"]')), 180);
  }
};

export const setSocketIoListener = async (sessionId: string, eventName: string, enabled: boolean) => {
  if (isTauri()) await invoke('set_socket_io_listener', { sessionId, eventName, enabled });
};
