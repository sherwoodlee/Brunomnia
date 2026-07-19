import { Channel, invoke, isTauri } from '@tauri-apps/api/core';
import type {
  ApiRequest,
  CookieRecord,
  Environment,
  HttpResponse,
  KeyValue,
  PreferredHttpVersion,
  StreamConnectionMetadata,
  StreamMessage,
  WorkspaceCertificates,
} from '../types';
import { applyWorkspaceCertificates } from './certificates';
import { cookieHeaderForUrl } from './cookies';
import { isGraphqlSubscriptionRequest } from './graphql';
import { graphqlBody } from './http';
import { buildHeaders, buildRequestUrl, environmentMap, resolveTemplate } from './request';
import { renderRealtimeConnectionRequest, renderRequestValue, type RequestSendRenderContext } from './requestRender';
import { resolveCertificateValidation, resolveFollowRedirects, resolveProxyTransport, resolveRequestTimeout, type ProxyPreferences } from './transport';
import { applyDefaultUserAgentHeader } from './userAgent';

const mockTimers = new Map<string, number[]>();

export const isStreamingRequest = (request: ApiRequest) => request.protocol === 'websocket'
  || request.protocol === 'socketio'
  || request.protocol === 'sse'
  || isGraphqlSubscriptionRequest(request);

export const graphqlSubscriptionUrl = (value: string) => {
  const url = new URL(value);
  if (url.protocol === 'http:') url.protocol = 'ws:';
  else if (url.protocol === 'https:') url.protocol = 'wss:';
  else if (url.protocol !== 'ws:' && url.protocol !== 'wss:') throw new Error('GraphQL subscription URLs must use HTTP(S) or WS(S).');
  return url.toString();
};

export const graphqlSubscriptionHeaders = (headers: KeyValue[]): KeyValue[] => [
  ...headers.filter((header) => header.name.toLowerCase() !== 'sec-websocket-protocol'),
  { id: 'graphql-transport-ws', name: 'Sec-WebSocket-Protocol', value: 'graphql-transport-ws', enabled: true },
];

const resolvedHeaders = (request: ApiRequest, environment?: Environment): KeyValue[] => {
  const variables = environmentMap(environment);
  const headers = buildHeaders(request, variables).map((header) => ({
    ...header,
    name: resolveTemplate(header.name, variables),
    value: resolveTemplate(header.value, variables),
  }));
  if (!request.auth.disabled && request.auth.type === 'oauth2' && request.auth.accessToken) {
    const token = resolveTemplate(request.auth.accessToken, variables);
    const prefix = resolveTemplate(request.auth.tokenPrefix, variables) || 'Bearer';
    headers.push({ id: 'auth-oauth2', name: 'Authorization', value: prefix === 'NO_PREFIX' ? token : `${prefix} ${token}`.trim(), enabled: true });
  }
  return headers;
};

const streamHeaders = (request: ApiRequest, environment: Environment | undefined, url: string, cookies: CookieRecord[]) => {
  let headers = resolvedHeaders(request, environment);
  if (request.transport.sendCookies && !headers.some((header) => header.enabled && header.name.toLowerCase() === 'cookie')) {
    const cookie = cookieHeaderForUrl(cookies, url);
    if (cookie) headers.push({ id: 'cookie-jar', name: 'Cookie', value: cookie, enabled: true });
  }
  return applyDefaultUserAgentHeader(headers, request.disableUserAgentHeader);
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

export const streamTransportConfig = (request: ApiRequest, preferredHttpVersion: PreferredHttpVersion, maxRedirects = 10, followRedirects = true, requestTimeoutMs = 30_000, validateCertificates = true, proxy?: ProxyPreferences, requestUrl = request.url, certificates?: WorkspaceCertificates) => applyWorkspaceCertificates({
  ...request.transport,
  followRedirects: resolveFollowRedirects(request.transport, followRedirects),
  timeoutMs: resolveRequestTimeout(request.transport, requestTimeoutMs),
  validateCertificates: resolveCertificateValidation(request.transport, validateCertificates),
  ...resolveProxyTransport(request.transport, requestUrl, proxy),
  preferredHttpVersion,
  maxRedirects,
}, requestUrl, certificates);

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
  certificates?: WorkspaceCertificates,
  renderContext: RequestSendRenderContext = {},
): Promise<StreamConnectionMetadata> => {
  if (request.protocol === 'socketio') {
    const { connectSocketIo } = await import('./socketIo');
    return connectSocketIo(request, environment, sessionId, onEvent, preferredHttpVersion, maxRedirects, followRedirects, requestTimeoutMs, validateCertificates, proxy, cookies, certificates, renderContext);
  }
  request = await renderRealtimeConnectionRequest(request, environment, renderContext);
  const requestCookies = renderContext.cookies ?? cookies;
  const variables = environmentMap(environment);
  const graphqlSubscription = isGraphqlSubscriptionRequest(request);
  if (request.protocol === 'graphql' && !graphqlSubscription) throw new Error('Only GraphQL subscription operations use the streaming transport.');
  let resolvedUrl = buildRequestUrl(request, variables);
  if (!request.auth.disabled && request.auth.type === 'api-key' && request.auth.apiKeyLocation === 'query' && request.auth.apiKeyName) {
    const parsedUrl = new URL(resolvedUrl);
    parsedUrl.searchParams.set(resolveTemplate(request.auth.apiKeyName, variables), resolveTemplate(request.auth.apiKeyValue, variables));
    resolvedUrl = parsedUrl.toString();
  }
  const url = graphqlSubscription ? graphqlSubscriptionUrl(resolvedUrl) : resolvedUrl;
  const headers = graphqlSubscription
    ? graphqlSubscriptionHeaders(streamHeaders(request, environment, url, requestCookies))
    : streamHeaders(request, environment, url, requestCookies);
  const input = {
    sessionId,
    url,
    headers,
    transport: streamTransportConfig(request, preferredHttpVersion, maxRedirects, followRedirects, requestTimeoutMs, validateCertificates, proxy, url, certificates),
    sse: sseConnectConfig(request),
    ...(graphqlSubscription ? { graphqlSubscription: graphqlBody(request, variables) } : {}),
  };
  if (isTauri()) {
    const channel = new Channel<StreamMessage>();
    channel.onmessage = onEvent;
    const command = request.protocol === 'websocket' || graphqlSubscription ? 'connect_websocket' : 'connect_sse';
    return invoke<StreamConnectionMetadata>(command, {
      input,
      onEvent: channel,
    });
  }

  onEvent(event(sessionId, 'system', 'open', request.protocol === 'sse' ? 'Listening · HTTP 200' : 'Connected · HTTP 101'));
  const timers: number[] = [];
  const samples = graphqlSubscription
    ? [
      ['connection_ack', '{"type":"connection_ack"}'],
      ['next', '{"id":"browser-simulation","type":"next","payload":{"data":{"event":{"id":"evt_201"}}}}'],
      ['complete', '{"id":"browser-simulation","type":"complete"}'],
    ]
    : request.protocol === 'websocket'
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
  return {
    status: request.protocol === 'sse' ? 200 : 101,
    statusText: request.protocol === 'sse' ? 'OK' : 'Switching Protocols',
    headers: {},
    httpVersion: 'HTTP/1.1',
    durationMs: 0,
    transport: 'Browser simulation',
  };
};

export const disconnectStream = async (protocol: ApiRequest['protocol'], sessionId: string) => {
  if (protocol === 'socketio') {
    await (await import('./socketIo')).disconnectSocketIo(sessionId);
    return;
  }
  if (isTauri()) {
    const command = protocol === 'websocket' || protocol === 'graphql' ? 'disconnect_websocket' : 'disconnect_sse';
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
  certificates?: WorkspaceCertificates,
  renderContext: RequestSendRenderContext = {},
  signal?: AbortSignal,
): Promise<HttpResponse> => {
  if (!isStreamingRequest(request)) throw new Error('Stream sampling only supports WebSocket, Socket.IO, SSE, and GraphQL subscription requests.');
  if (signal?.aborted) throw signal.reason instanceof Error ? signal.reason : new DOMException('Request canceled.', 'AbortError');
  const preparedRequest = await renderRealtimeConnectionRequest(request, environment, renderContext);
  if (signal?.aborted) throw signal.reason instanceof Error ? signal.reason : new DOMException('Request canceled.', 'AbortError');
  const sessionId = `runner-stream-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const messages: StreamMessage[] = [];
  let resolveIncoming: (() => void) | undefined;
  const firstIncoming = new Promise<void>((resolve) => { resolveIncoming = resolve; });
  const started = performance.now();
  const onEvent = (message: StreamMessage) => {
    messages.push(message);
    if (message.direction === 'incoming' && (request.protocol !== 'graphql' || message.kind === 'next' || message.kind === 'error' || message.kind === 'complete')) resolveIncoming?.();
  };
  let rejectAbort: ((reason: unknown) => void) | undefined;
  const aborted = new Promise<never>((_resolve, reject) => { rejectAbort = reject; });
  const onAbort = () => {
    void disconnectStream(request.protocol, sessionId).catch(() => undefined);
    rejectAbort?.(signal?.reason instanceof Error ? signal.reason : new DOMException('Request canceled.', 'AbortError'));
  };
  signal?.addEventListener('abort', onAbort, { once: true });
  let sampleTimeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      connectStream(preparedRequest, environment, sessionId, onEvent, preferredHttpVersion, maxRedirects, followRedirects, requestTimeoutMs, validateCertificates, proxy, cookies, certificates),
      aborted,
    ]);
    if (preparedRequest.protocol === 'websocket') {
      const startupFrame = request.renderBodyTemplates !== false
        ? await renderRequestValue(request.body, request, environment, renderContext)
        : request.body;
      if (startupFrame.trim()) await sendWebSocketMessage(sessionId, startupFrame, 'text', onEvent);
    }
    if (preparedRequest.protocol === 'socketio') await (await import('./socketIo')).sendSocketIoMessage(request, environment, sessionId, onEvent, renderContext);
    await Promise.race([
      firstIncoming,
      new Promise<void>((resolve) => { sampleTimeout = setTimeout(resolve, Math.max(100, Math.min(30_000, windowMs))); }),
      aborted,
    ]);
  } finally {
    if (sampleTimeout !== undefined) clearTimeout(sampleTimeout);
    signal?.removeEventListener('abort', onAbort);
    await disconnectStream(request.protocol, sessionId).catch(() => undefined);
  }
  const body = JSON.stringify(messages.map(({ direction, kind, text, timestamp }) => ({ direction, kind, text, timestamp })), null, 2);
  return {
    status: preparedRequest.protocol === 'sse' ? 200 : 101,
    statusText: preparedRequest.protocol === 'websocket' ? 'WebSocket sample' : preparedRequest.protocol === 'socketio' ? 'Socket.IO sample' : preparedRequest.protocol === 'graphql' ? 'GraphQL subscription sample' : 'SSE sample',
    headers: { 'content-type': 'application/json', 'x-brunomnia-stream-events': String(messages.length) },
    body,
    durationMs: Math.round(performance.now() - started),
    sizeBytes: new Blob([body]).size,
    requestUrl: buildRequestUrl(preparedRequest, environmentMap(environment)),
  };
};
