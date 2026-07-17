import { Channel, invoke, isTauri } from '@tauri-apps/api/core';
import type {
  ApiRequest,
  Environment,
  GrpcSchema,
  HttpResponse,
  KeyValue,
  PreferredHttpVersion,
  StreamMessage,
} from '../types';
import { buildHeaders, environmentMap, resolveTemplate } from './request';

type GrpcCallOutput = {
  status: string;
  callType: string;
  messages: unknown[];
  durationMs: number;
};

const mockTimers = new Map<string, number[]>();

const resolvedHeaders = (request: ApiRequest, environment?: Environment): KeyValue[] => {
  const variables = environmentMap(environment);
  return buildHeaders(request, variables).map((header) => ({
    ...header,
    name: resolveTemplate(header.name, variables),
    value: resolveTemplate(header.value, variables),
  }));
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

export const streamTransportConfig = (request: ApiRequest, preferredHttpVersion: PreferredHttpVersion) => ({
  ...request.transport,
  preferredHttpVersion,
});

export const connectStream = async (
  request: ApiRequest,
  environment: Environment | undefined,
  sessionId: string,
  onEvent: (message: StreamMessage) => void,
  preferredHttpVersion: PreferredHttpVersion = 'default',
) => {
  const variables = environmentMap(environment);
  const input = {
    sessionId,
    url: resolveTemplate(request.url, variables),
    headers: resolvedHeaders(request, environment),
    transport: streamTransportConfig(request, preferredHttpVersion),
    sse: sseConnectConfig(request),
  };
  if (isTauri()) {
    const channel = new Channel<StreamMessage>();
    channel.onmessage = onEvent;
    await invoke(request.protocol === 'websocket' ? 'connect_websocket' : 'connect_sse', {
      input,
      onEvent: channel,
    });
    return;
  }

  onEvent(event(sessionId, 'system', 'open', request.protocol === 'websocket' ? 'Connected · HTTP 101' : 'Listening · HTTP 200'));
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
  if (isTauri()) {
    await invoke(protocol === 'websocket' ? 'disconnect_websocket' : 'disconnect_sse', { sessionId });
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
): Promise<HttpResponse> => {
  if (request.protocol !== 'websocket' && request.protocol !== 'sse') throw new Error('Stream sampling only supports WebSocket and SSE requests.');
  const sessionId = `runner-stream-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const messages: StreamMessage[] = [];
  let resolveIncoming: (() => void) | undefined;
  const firstIncoming = new Promise<void>((resolve) => { resolveIncoming = resolve; });
  const started = performance.now();
  const onEvent = (message: StreamMessage) => {
    messages.push(message);
    if (message.direction === 'incoming') resolveIncoming?.();
  };
  await connectStream(request, environment, sessionId, onEvent, preferredHttpVersion);
  try {
    const variables = environmentMap(environment);
    const startupFrame = resolveTemplate(request.body, variables);
    if (request.protocol === 'websocket' && startupFrame.trim()) await sendWebSocketMessage(sessionId, startupFrame, 'text', onEvent);
    await Promise.race([
      firstIncoming,
      new Promise<void>((resolve) => window.setTimeout(resolve, Math.max(100, Math.min(30_000, windowMs)))),
    ]);
  } finally {
    await disconnectStream(request.protocol, sessionId).catch(() => undefined);
  }
  const body = JSON.stringify(messages.map(({ direction, kind, text, timestamp }) => ({ direction, kind, text, timestamp })), null, 2);
  return {
    status: request.protocol === 'websocket' ? 101 : 200,
    statusText: request.protocol === 'websocket' ? 'WebSocket sample' : 'SSE sample',
    headers: { 'content-type': 'application/json', 'x-brunomnia-stream-events': String(messages.length) },
    body,
    durationMs: Math.round(performance.now() - started),
    sizeBytes: new Blob([body]).size,
    requestUrl: resolveTemplate(request.url, environmentMap(environment)),
  };
};

export const previewGrpcSchema = (protoText: string): GrpcSchema => {
  const serviceMatch = protoText.match(/service\s+(\w+)/);
  const service = serviceMatch?.[1] ?? 'OrdersService';
  const methods = [...protoText.matchAll(/rpc\s+(\w+)\s*\(\s*(stream\s+)?([\w.]+)\s*\)\s*returns\s*\(\s*(stream\s+)?([\w.]+)/g)]
    .map((match) => ({
      name: match[1],
      fullName: `${service}.${match[1]}`,
      clientStreaming: Boolean(match[2]),
      serverStreaming: Boolean(match[4]),
      inputType: match[3],
      outputType: match[5],
    }));
  return {
    descriptorSetBase64: btoa(protoText || 'browser-reflection-descriptor'),
    services: [{
      name: service,
      fullName: service,
      methods: methods.length ? methods : [{
        name: 'ListOrders', fullName: `${service}.ListOrders`, clientStreaming: false,
        serverStreaming: true, inputType: 'ListOrdersRequest', outputType: 'Order',
      }],
    }],
  };
};

const mockGrpcSchema = (request: ApiRequest): GrpcSchema => previewGrpcSchema(request.grpc.protoText);

export const loadGrpcSchema = async (request: ApiRequest, environment?: Environment): Promise<GrpcSchema> => {
  const variables = environmentMap(environment);
  if (!isTauri()) {
    await new Promise((resolve) => window.setTimeout(resolve, 300));
    return mockGrpcSchema(request);
  }
  return invoke<GrpcSchema>('grpc_load_schema', {
    input: {
      endpoint: resolveTemplate(request.url, variables),
      source: request.grpc.descriptorSource,
      protoText: request.grpc.protoText,
      metadata: request.grpc.metadata,
      transport: request.transport,
    },
  });
};

export const invokeGrpc = async (request: ApiRequest, environment?: Environment): Promise<GrpcCallOutput> => {
  const variables = environmentMap(environment);
  if (!isTauri()) {
    await new Promise((resolve) => window.setTimeout(resolve, 420));
    return {
      status: 'OK',
      callType: 'server-streaming',
      messages: [
        { id: 'ord_201', status: 'PROCESSING', total: 119.97 },
        { id: 'ord_202', status: 'FULFILLED', total: 49.99 },
      ],
      durationMs: 418,
    };
  }
  return invoke<GrpcCallOutput>('send_grpc_request', {
    input: {
      endpoint: resolveTemplate(request.url, variables),
      service: request.grpc.service,
      method: request.grpc.method,
      descriptorSetBase64: request.grpc.descriptorSetBase64,
      messagesJson: resolveTemplate(request.grpc.input, variables),
      metadata: request.grpc.metadata,
      transport: request.transport,
    },
  });
};
