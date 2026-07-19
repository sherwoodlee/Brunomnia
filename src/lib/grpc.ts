import { Channel, invoke, isTauri } from '@tauri-apps/api/core';
import type { ApiRequest, Environment, GrpcSchema, StreamMessage, WorkspaceCertificates } from '../types';
import { applyWorkspaceCertificates } from './certificates';
import { grpcProtoSource } from './grpcProto';
import { environmentMap, resolveTemplate } from './request';
import { resolveCertificateValidation, resolveRequestTimeout } from './transport';

export type GrpcCallOutput = {
  status: string;
  callType: string;
  messages: unknown[];
  durationMs: number;
};

export type GrpcSessionStartOutput = {
  sessionId: string;
  callType: string;
  durationMs: number;
};

type NativeGrpcEvent = Omit<StreamMessage, 'id'>;

type BrowserGrpcSession = {
  clientStreaming: boolean;
  serverStreaming: boolean;
  committed: boolean;
  onEvent: (message: StreamMessage) => void;
  timers: number[];
};

const browserSessions = new Map<string, BrowserGrpcSession>();

const grpcEvent = (sessionId: string, direction: StreamMessage['direction'], kind: string, text: string): StreamMessage => ({
  id: `${sessionId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  sessionId,
  direction,
  kind,
  text,
  timestamp: new Date().toISOString(),
});

const grpcStatusEvent = (
  sessionId: string,
  statusCode: number,
  statusName: string,
  statusDetails: string,
  metadata: Record<string, string[]> = {},
): StreamMessage => ({
  ...grpcEvent(sessionId, 'system', 'status', statusDetails === statusName ? `${statusCode} ${statusName}` : `${statusCode} ${statusName}: ${statusDetails}`),
  statusCode,
  statusName,
  statusDetails,
  metadata,
});

const normalizedGrpcEvent = (message: NativeGrpcEvent): StreamMessage => ({
  ...message,
  id: `${message.sessionId}-${message.timestamp}-${Math.random().toString(36).slice(2, 7)}`,
});

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
      example: {},
    }));
  return {
    descriptorSetBase64: btoa(protoText || 'browser-reflection-descriptor'),
    services: [{
      name: service,
      fullName: service,
      methods: methods.length ? methods : [{
        name: 'ListOrders', fullName: `${service}.ListOrders`, clientStreaming: false,
        serverStreaming: true, inputType: 'ListOrdersRequest', outputType: 'Order', example: {},
      }],
    }],
  };
};

const mockGrpcSchema = (request: ApiRequest): GrpcSchema => previewGrpcSchema(grpcProtoSource(request.grpc));

const grpcCallInput = (
  request: ApiRequest,
  environment: Environment | undefined,
  requestTimeoutMs: number,
  validateCertificates: boolean,
  certificates?: WorkspaceCertificates,
) => {
  const variables = environmentMap(environment);
  const endpoint = resolveTemplate(request.url, variables);
  return {
    endpoint,
    service: resolveTemplate(request.grpc.service, variables),
    method: resolveTemplate(request.grpc.method, variables),
    descriptorSetBase64: request.grpc.descriptorSetBase64,
    messagesJson: resolveTemplate(request.grpc.input, variables),
    metadata: request.grpc.metadata.map((item) => ({
      ...item,
      name: resolveTemplate(item.name, variables),
      value: resolveTemplate(item.value, variables),
    })),
    transport: applyWorkspaceCertificates({ ...request.transport, timeoutMs: resolveRequestTimeout(request.transport, requestTimeoutMs), validateCertificates: resolveCertificateValidation(request.transport, validateCertificates) }, endpoint, certificates),
  };
};

export const loadGrpcSchema = async (request: ApiRequest, environment?: Environment, requestTimeoutMs = 30_000, validateCertificates = true, certificates?: WorkspaceCertificates): Promise<GrpcSchema> => {
  const variables = environmentMap(environment);
  const endpoint = resolveTemplate(request.url, variables);
  const reflectionApi = {
    url: resolveTemplate(request.grpc.reflectionApiUrl, variables),
    apiKey: resolveTemplate(request.grpc.reflectionApiKey, variables),
    module: resolveTemplate(request.grpc.reflectionApiModule, variables),
    disableUserAgentHeader: request.grpc.disableUserAgentHeader,
  };
  const schemaEndpoint = request.grpc.descriptorSource === 'buf' ? reflectionApi.url : endpoint;
  if (!isTauri()) {
    await new Promise((resolve) => window.setTimeout(resolve, 300));
    return mockGrpcSchema(request);
  }
  return invoke<GrpcSchema>('grpc_load_schema', {
    input: {
      endpoint,
      source: request.grpc.descriptorSource,
      protoText: request.grpc.protoText,
      protoFiles: request.grpc.protoFiles.map(({ path, text }) => ({ path, text })),
      protoEntryPath: request.grpc.protoEntryPath,
      metadata: request.grpc.metadata.map((item) => ({
        ...item,
        name: resolveTemplate(item.name, variables),
        value: resolveTemplate(item.value, variables),
      })),
      reflectionApi,
      transport: applyWorkspaceCertificates({ ...request.transport, timeoutMs: resolveRequestTimeout(request.transport, requestTimeoutMs), validateCertificates: resolveCertificateValidation(request.transport, validateCertificates) }, schemaEndpoint, certificates),
    },
  });
};

export const invokeGrpc = async (request: ApiRequest, environment?: Environment, requestTimeoutMs = 30_000, validateCertificates = true, certificates?: WorkspaceCertificates): Promise<GrpcCallOutput> => {
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
    input: grpcCallInput(request, environment, requestTimeoutMs, validateCertificates, certificates),
  });
};

export const startGrpcSession = async (
  request: ApiRequest,
  environment: Environment | undefined,
  sessionId: string,
  onEvent: (message: StreamMessage) => void,
  requestTimeoutMs = 30_000,
  validateCertificates = true,
  certificates?: WorkspaceCertificates,
): Promise<GrpcSessionStartOutput> => {
  const service = request.grpc.service;
  const method = request.grpc.method;
  if (!service || !method || !request.grpc.descriptorSetBase64) throw new Error('Load a gRPC schema and select a method first.');
  if (isTauri()) {
    const channel = new Channel<NativeGrpcEvent>();
    channel.onmessage = (message) => onEvent(normalizedGrpcEvent(message));
    return invoke<GrpcSessionStartOutput>('grpc_start_session', {
      input: {
        sessionId,
        call: grpcCallInput(request, environment, requestTimeoutMs, validateCertificates, certificates),
      },
      onEvent: channel,
    });
  }

  const selectedService = mockGrpcSchema(request).services.find((candidate) => candidate.fullName === service);
  const selectedMethod = selectedService?.methods.find((candidate) => candidate.name === method);
  const clientStreaming = selectedMethod?.clientStreaming ?? false;
  const serverStreaming = selectedMethod?.serverStreaming ?? false;
  if (browserSessions.has(sessionId)) throw new Error('This gRPC session is already active.');
  const session: BrowserGrpcSession = { clientStreaming, serverStreaming, committed: false, onEvent, timers: [] };
  browserSessions.set(sessionId, session);
  onEvent(grpcEvent(sessionId, 'system', 'start', `${clientStreaming ? serverStreaming ? 'bidirectional-streaming' : 'client-streaming' : serverStreaming ? 'server-streaming' : 'unary'} call started`));
  if (!clientStreaming) {
    const message = resolveTemplate(request.grpc.input, environmentMap(environment));
    session.timers.push(window.setTimeout(() => onEvent(grpcEvent(sessionId, 'outgoing', 'message', message)), 60));
    session.timers.push(window.setTimeout(() => onEvent(grpcEvent(sessionId, 'incoming', 'message', JSON.stringify({ browserSimulation: true, method }, null, 2))), 180));
    session.timers.push(window.setTimeout(() => {
      onEvent(grpcStatusEvent(sessionId, 0, 'OK', 'OK', { 'x-brunomnia-simulation': ['true'] }));
      onEvent(grpcEvent(sessionId, 'system', 'end', 'Call ended'));
      browserSessions.delete(sessionId);
    }, 260));
  }
  return {
    sessionId,
    callType: clientStreaming ? serverStreaming ? 'bidirectional-streaming' : 'client-streaming' : serverStreaming ? 'server-streaming' : 'unary',
    durationMs: 0,
  };
};

export const sendGrpcSessionMessage = async (sessionId: string, messageJson: string, environment?: Environment) => {
  const resolved = resolveTemplate(messageJson, environmentMap(environment));
  if (isTauri()) {
    await invoke('grpc_send_message', { sessionId, messageJson: resolved });
    return;
  }
  const session = browserSessions.get(sessionId);
  if (!session) throw new Error('Start the gRPC call before sending a message.');
  if (!session.clientStreaming) throw new Error('This gRPC method does not accept a request stream.');
  if (session.committed) throw new Error('The gRPC request stream is already committed.');
  JSON.parse(resolved);
  session.onEvent(grpcEvent(sessionId, 'outgoing', 'message', resolved));
  if (session.serverStreaming) {
    session.timers.push(window.setTimeout(() => session.onEvent(grpcEvent(sessionId, 'incoming', 'message', resolved)), 120));
  }
};

export const commitGrpcSession = async (sessionId: string) => {
  if (isTauri()) {
    await invoke('grpc_commit_session', { sessionId });
    return;
  }
  const session = browserSessions.get(sessionId);
  if (!session) throw new Error('The gRPC call is not active.');
  if (!session.clientStreaming) throw new Error('This gRPC method does not have a request stream to commit.');
  if (session.committed) throw new Error('The gRPC request stream is already committed.');
  session.committed = true;
  session.onEvent(grpcEvent(sessionId, 'system', 'commit', 'Request stream committed'));
  session.timers.push(window.setTimeout(() => {
    if (!session.serverStreaming) session.onEvent(grpcEvent(sessionId, 'incoming', 'message', JSON.stringify({ accepted: true }, null, 2)));
    session.onEvent(grpcStatusEvent(sessionId, 0, 'OK', 'OK', { 'x-brunomnia-simulation': ['true'] }));
    session.onEvent(grpcEvent(sessionId, 'system', 'end', 'Call ended'));
    browserSessions.delete(sessionId);
  }, 180));
};

export const cancelGrpcSession = async (sessionId: string) => {
  if (isTauri()) {
    await invoke('grpc_cancel_session', { sessionId });
    return;
  }
  const session = browserSessions.get(sessionId);
  if (!session) throw new Error('The gRPC call is not active.');
  session.timers.forEach((timer) => window.clearTimeout(timer));
  session.onEvent(grpcEvent(sessionId, 'system', 'cancel', 'Call cancelled'));
  session.onEvent(grpcStatusEvent(sessionId, 1, 'CANCELLED', 'Call cancelled'));
  session.onEvent(grpcEvent(sessionId, 'system', 'end', 'Call ended'));
  browserSessions.delete(sessionId);
};

export const closeAllGrpcSessions = async () => {
  if (isTauri()) {
    await invoke('grpc_close_all_sessions');
    return;
  }
  await Promise.all([...browserSessions].map(([sessionId]) => cancelGrpcSession(sessionId)));
};
