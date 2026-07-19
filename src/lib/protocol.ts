import { Channel, invoke, isTauri } from '@tauri-apps/api/core';
import type {
  ApiRequest,
  CookieRecord,
  Environment,
  HttpResponse,
  KeyValue,
  PreferredHttpVersion,
  StreamMessage,
} from '../types';
import { cookieHeaderForUrl } from './cookies';
import { buildHeaders, buildRequestUrl, environmentMap, resolveTemplate } from './request';
import { resolveCertificateValidation, resolveFollowRedirects, resolveProxyTransport, resolveRequestTimeout, type ProxyPreferences } from './transport';

const mockTimers = new Map<string, number[]>();

const resolvedHeaders = (request: ApiRequest, environment?: Environment): KeyValue[] => {
  const variables = environmentMap(environment);
  return buildHeaders(request, variables).map((header) => ({
    ...header,
    name: resolveTemplate(header.name, variables),
    value: resolveTemplate(header.value, variables),
  }));
};

const streamHeaders = (request: ApiRequest, environment: Environment | undefined, url: string, cookies: CookieRecord[]) => {
  let headers = resolvedHeaders(request, environment);
  if (request.transport.sendCookies && !headers.some((header) => header.enabled && header.name.toLowerCase() === 'cookie')) {
    const cookie = cookieHeaderForUrl(cookies, url);
    if (cookie) headers.push({ id: 'cookie-jar', name: 'Cookie', value: cookie, enabled: true });
  }
  return headers;
};

const event = (sessionId: string, direction: StreamMessage['direction'], kind: string, text: string): StreamMessage => ({
  id: `${sessionId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  sessionId,
  direction,
  kind,
  text,
  timestamp: new Date().toISOString(),
});

export const sseConnectConfig = (request: ApiRequest) => ({
  autoReconnect: request.sse?.autoReconnect !== false,
  reconnectDelayMs: Math.min(60_000, Math.max(100, Number(request.sse?.reconnectDelayMs) || 1000)),
  maxReconnects: Math.min(1_000, Math.max(0, Number(request.sse?.maxReconnects) || 0)),
  respectServerRetry: request.sse?.respectServerRetry !== false,
  sendLastEventId: request.sse?.sendLastEventId !== false,
});

export const streamTransportConfig = (request: ApiRequest, preferredHttpVersion: PreferredHttpVersion, maxRedirects = 10, followRedirects = true, requestTimeoutMs = 30_000, validateCertificates = true, proxy?: ProxyPreferences, requestUrl = request.url) => ({
  ...request.transport,
  followRedirects: resolveFollowRedirects(request.transport, followRedirects),
  timeoutMs: resolveRequestTimeout(request.transport, requestTimeoutMs),
  validateCertificates: resolveCertificateValidation(request.transport, validateCertificates),
  ...resolveProxyTransport(request.transport, requestUrl, proxy),
  preferredHttpVersion,
  maxRedirects,
});

export const connectStream = async (
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
) => {
  if (request.protocol === 'socketio') {
    const { connectSocketIo } = await import('./socketIo');
    await connectSocketIo(request, environment, sessionId, onEvent, preferredHttpVersion, maxRedirects, followRedirects, requestTimeoutMs, validateCertificates, proxy, cookies);
    return;
  }
  const variables = environmentMap(environment);
  const url = buildRequestUrl(request, variables);
  const input = {
    sessionId,
    url,
    headers: streamHeaders(request, environment, url, cookies),
    transport: streamTransportConfig(request, preferredHttpVersion, maxRedirects, followRedirects, requestTimeoutMs, validateCertificates, proxy, url),
    sse: sseConnectConfig(request),
  };
  if (isTauri()) {
    const channel = new Channel<StreamMessage>();
    channel.onmessage = onEvent;
    const command = request.protocol === 'websocket' ? 'connect_websocket' : 'connect_sse';
    await invoke(command, {
      input,
      onEvent: channel,
    });
    return;
  }

  onEvent(event(sessionId, 'system', 'open', request.protocol === 'sse' ? 'Listening · HTTP 200' : 'Connected · HTTP 101'));
  const timers: number[] = [];
  const samples = request.protocol === 'websocket'
    ? [
      ['order.created', '{"id":"ord_live_201","total":119.97}'],
      ['inventory.updated', '{"productId":"prod_98765","available":42}'],
    ]
    : [
      ['order.created', '{"id":"ord_evt_401","status":"created"}'],
      ['order.fulfilled', '{"id":"ord_evt_398","status":"fulfilled"}'],
    ];
  samples.forEach(([kind, text], index) => {
    timers.push(window.setTimeout(() => onEvent(event(sessionId, 'incoming', kind, text)), 450 + index * 650));
  });
  mockTimers.set(sessionId, timers);
};

export const disconnectStream = async (protocol: ApiRequest['protocol'], sessionId: string) => {
  if (protocol === 'socketio') {
    await (await import('./socketIo')).disconnectSocketIo(sessionId);
    return;
  }
  if (isTauri()) {
    const command = protocol === 'websocket' ? 'disconnect_websocket' : 'disconnect_sse';
    await invoke(command, { sessionId });
  } else {
    mockTimers.get(sessionId)?.forEach((timer) => window.clearTimeout(timer));
    mockTimers.delete(sessionId);
  }
};

export const sendWebSocketMessage = async (
  sessionId: string,
  message: string,
  kind: 'text' | 'binary',
  onEvent: (message: StreamMessage) => void,
) => {
  if (isTauri()) {
    await invoke('send_websocket_message', { sessionId, message, kind });
  } else {
    onEvent(event(sessionId, 'outgoing', kind, message));
    window.setTimeout(() => onEvent(event(sessionId, 'incoming', kind === 'binary' ? 'binary echo' : 'echo', message)), 220);
  }
};

export const runStreamSample = async (
  request: ApiRequest,
  environment: Environment,
  windowMs = 1000,
  preferredHttpVersion: PreferredHttpVersion = 'default',
  maxRedirects = 10,
  followRedirects = true,
  requestTimeoutMs = 30_000,
  validateCertificates = true,
  proxy?: ProxyPreferences,
  cookies: CookieRecord[] = [],
): Promise<HttpResponse> => {
  if (request.protocol !== 'websocket' && request.protocol !== 'socketio' && request.protocol !== 'sse') throw new Error('Stream sampling only supports WebSocket, Socket.IO, and SSE requests.');
  const sessionId = `runner-stream-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const messages: StreamMessage[] = [];
  let resolveIncoming: (() => void) | undefined;
  const firstIncoming = new Promise<void>((resolve) => { resolveIncoming = resolve; });
  const started = performance.now();
  const onEvent = (message: StreamMessage) => {
    messages.push(message);
    if (message.direction === 'incoming') resolveIncoming?.();
  };
  await connectStream(request, environment, sessionId, onEvent, preferredHttpVersion, maxRedirects, followRedirects, requestTimeoutMs, validateCertificates, proxy, cookies);
  try {
    const variables = environmentMap(environment);
    const startupFrame = resolveTemplate(request.body, variables);
    if (request.protocol === 'websocket' && startupFrame.trim()) await sendWebSocketMessage(sessionId, startupFrame, 'text', onEvent);
    if (request.protocol === 'socketio') await (await import('./socketIo')).sendSocketIoMessage(request, environment, sessionId, onEvent);
    await Promise.race([
      firstIncoming,
      new Promise<void>((resolve) => window.setTimeout(resolve, Math.max(100, Math.min(30_000, windowMs)))),
    ]);
  } finally {
    await disconnectStream(request.protocol, sessionId).catch(() => undefined);
  }
  const body = JSON.stringify(messages.map(({ direction, kind, text, timestamp }) => ({ direction, kind, text, timestamp })), null, 2);
  return {
    status: request.protocol === 'sse' ? 200 : 101,
    statusText: request.protocol === 'websocket' ? 'WebSocket sample' : request.protocol === 'socketio' ? 'Socket.IO sample' : 'SSE sample',
    headers: { 'content-type': 'application/json', 'x-brunomnia-stream-events': String(messages.length) },
    body,
    durationMs: Math.round(performance.now() - started),
    sizeBytes: new Blob([body]).size,
    requestUrl: resolveTemplate(request.url, environmentMap(environment)),
  };
};
