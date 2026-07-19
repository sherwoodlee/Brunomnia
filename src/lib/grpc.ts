import { invoke, isTauri } from '@tauri-apps/api/core';
import type { ApiRequest, Environment, GrpcSchema } from '../types';
import { grpcProtoSource } from './grpcProto';
import { environmentMap, resolveTemplate } from './request';
import { resolveCertificateValidation, resolveRequestTimeout } from './transport';

type GrpcCallOutput = {
  status: string;
  callType: string;
  messages: unknown[];
  durationMs: number;
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

const mockGrpcSchema = (request: ApiRequest): GrpcSchema => previewGrpcSchema(grpcProtoSource(request.grpc));

export const loadGrpcSchema = async (request: ApiRequest, environment?: Environment, requestTimeoutMs = 30_000, validateCertificates = true): Promise<GrpcSchema> => {
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
      protoFiles: request.grpc.protoFiles.map(({ path, text }) => ({ path, text })),
      protoEntryPath: request.grpc.protoEntryPath,
      metadata: request.grpc.metadata,
      transport: { ...request.transport, timeoutMs: resolveRequestTimeout(request.transport, requestTimeoutMs), validateCertificates: resolveCertificateValidation(request.transport, validateCertificates) },
    },
  });
};

export const invokeGrpc = async (request: ApiRequest, environment?: Environment, requestTimeoutMs = 30_000, validateCertificates = true): Promise<GrpcCallOutput> => {
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
      transport: { ...request.transport, timeoutMs: resolveRequestTimeout(request.transport, requestTimeoutMs), validateCertificates: resolveCertificateValidation(request.transport, validateCertificates) },
    },
  });
};
