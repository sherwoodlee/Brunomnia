import { describe, expect, it } from 'vitest';
import { cloneSeedWorkspace } from '../data/seed';
import { previewGrpcSchema } from './grpc';
import { graphqlSubscriptionHeaders, graphqlSubscriptionUrl, isStreamingRequest, sseConnectConfig, streamTransportConfig } from './protocol';
import { socketIoArgs } from './socketIo';

describe('socketIoArgs', () => {
  it('renders and parses ordered JSON/text arguments with string fallback', () => {
    const workspace = cloneSeedWorkspace();
    const request = workspace.collections[0].requests[0];
    request.socketIo.args = [
      { id: 'one', mode: 'json', value: '{"id":"{{ orderId }}"}' },
      { id: 'two', mode: 'text', value: 'status={{ status }}' },
      { id: 'three', mode: 'json', value: '{ invalid' },
    ];
    const environment = { ...workspace.environments[0], variables: [
      { id: 'order', name: 'orderId', value: 'ord_42', enabled: true },
      { id: 'status', name: 'status', value: 'ready', enabled: true },
    ] };

    expect(socketIoArgs(request, environment)).toEqual([{ id: 'ord_42' }, 'status=ready', '{ invalid']);
  });
});

describe('previewGrpcSchema', () => {
  it('discovers unary and streaming RPC shapes from proto source', () => {
    const schema = previewGrpcSchema(`
      syntax = "proto3";
      service Events {
        rpc Get (GetRequest) returns (Event);
        rpc Sync (stream Event) returns (stream Event);
      }
    `);

    expect(schema.services[0].name).toBe('Events');
    expect(schema.services[0].methods).toEqual([
      expect.objectContaining({ name: 'Get', clientStreaming: false, serverStreaming: false }),
      expect.objectContaining({ name: 'Sync', clientStreaming: true, serverStreaming: true }),
    ]);
  });
});

describe('sseConnectConfig', () => {
  it('preserves explicit reconnect controls and clamps numeric bounds', () => {
    const request = cloneSeedWorkspace().collections[0].requests[0];
    request.sse = {
      autoReconnect: false,
      reconnectDelayMs: 1,
      maxReconnects: 50_000,
      respectServerRetry: false,
      sendLastEventId: false,
    };

    expect(sseConnectConfig(request)).toEqual({
      autoReconnect: false,
      reconnectDelayMs: 100,
      maxReconnects: 1_000,
      respectServerRetry: false,
      sendLastEventId: false,
    });
  });

  it('uses safe reconnect defaults for incomplete imported requests', () => {
    const request = cloneSeedWorkspace().collections[0].requests[0];
    request.sse = undefined as unknown as typeof request.sse;

    expect(sseConnectConfig(request)).toEqual({
      autoReconnect: true,
      reconnectDelayMs: 1_000,
      maxReconnects: 0,
      respectServerRetry: true,
      sendLastEventId: true,
    });
  });
});

describe('streamTransportConfig', () => {
  it('adds device HTTP and redirect preferences without mutating request transport', () => {
    const request = cloneSeedWorkspace().collections[0].requests[0];
    const transport = streamTransportConfig(request, 'http2-prior-knowledge', 3, false, 12_345, false, { enabled: true, httpProxy: 'http://http-proxy', httpsProxy: 'http://https-proxy', noProxy: 'localhost' });

    expect(transport).toMatchObject({ timeoutMs: 12_345, validateCertificates: false, proxyMode: 'custom', proxyUrl: 'http://https-proxy', proxyExclusions: 'localhost', preferredHttpVersion: 'http2-prior-knowledge', maxRedirects: 3, followRedirects: false });
    expect(request.transport).not.toHaveProperty('preferredHttpVersion');
    expect(request.transport).not.toHaveProperty('maxRedirects');
  });

  it('lets an explicit stream request override the global redirect preference', () => {
    const request = cloneSeedWorkspace().collections[0].requests[0];
    request.transport.followRedirectsMode = 'on';
    expect(streamTransportConfig(request, 'default', 10, false).followRedirects).toBe(true);
    request.transport.followRedirectsMode = 'off';
    expect(streamTransportConfig(request, 'default', 10, true).followRedirects).toBe(false);
  });

  it('preserves a custom stream timeout over the device preference', () => {
    const request = cloneSeedWorkspace().collections[0].requests[0];
    request.transport.timeoutMode = 'custom';
    request.transport.timeoutMs = 7_654;
    expect(streamTransportConfig(request, 'default', 10, true, 30_000).timeoutMs).toBe(7_654);
  });

  it('preserves an explicit stream validation mode over the device preference', () => {
    const request = cloneSeedWorkspace().collections[0].requests[0];
    request.transport.validateCertificatesMode = 'on';
    expect(streamTransportConfig(request, 'default', 10, true, 30_000, false).validateCertificates).toBe(true);
    request.transport.validateCertificatesMode = 'off';
    expect(streamTransportConfig(request, 'default', 10, true, 30_000, true).validateCertificates).toBe(false);
  });

  it('preserves explicit stream proxy modes over the device preference', () => {
    const request = cloneSeedWorkspace().collections[0].requests[0];
    request.transport.proxyMode = 'custom';
    request.transport.proxyUrl = 'http://request-proxy';
    expect(streamTransportConfig(request, 'default', 10, true, 30_000, true, { enabled: false, httpProxy: '', httpsProxy: '', noProxy: '' }).proxyUrl).toBe('http://request-proxy');
    request.transport.proxyMode = 'disabled';
    expect(streamTransportConfig(request, 'default', 10, true, 30_000, true, { enabled: true, httpProxy: 'http://global', httpsProxy: 'http://global', noProxy: '' }).proxyMode).toBe('disabled');
  });

  it('applies workspace certificate authority and host-matched stream identity', () => {
    const request = cloneSeedWorkspace().collections[0].requests[0];
    request.url = 'wss://events.example.test/socket';
    const transport = streamTransportConfig(request, 'default', 10, true, 30_000, true, undefined, request.url, {
      ca: { enabled: true, pem: 'workspace-ca' },
      clients: [{ id: 'client', host: '*.example.test', enabled: true, certificatePem: 'workspace-cert', keyPem: 'workspace-key' }],
    });
    expect(transport).toMatchObject({ caCertificatePem: 'workspace-ca', clientCertificatePem: 'workspace-cert', clientKeyPem: 'workspace-key' });
  });
});

describe('GraphQL subscription transport routing', () => {
  it('converts HTTP schemes without changing the endpoint and rejects ambient schemes', () => {
    expect(graphqlSubscriptionUrl('http://api.example.test/graphql?token=one')).toBe('ws://api.example.test/graphql?token=one');
    expect(graphqlSubscriptionUrl('https://api.example.test/graphql')).toBe('wss://api.example.test/graphql');
    expect(graphqlSubscriptionUrl('wss://api.example.test/graphql')).toBe('wss://api.example.test/graphql');
    expect(() => graphqlSubscriptionUrl('file:///tmp/graphql')).toThrow(/HTTP\(S\)/);
  });

  it('replaces authored subprotocol rows with the required GraphQL transport protocol', () => {
    expect(graphqlSubscriptionHeaders([
      { id: 'auth', name: 'Authorization', value: 'Bearer token', enabled: true },
      { id: 'old', name: 'sec-websocket-protocol', value: 'graphql-ws', enabled: true },
    ])).toEqual([
      { id: 'auth', name: 'Authorization', value: 'Bearer token', enabled: true },
      { id: 'graphql-transport-ws', name: 'Sec-WebSocket-Protocol', value: 'graphql-transport-ws', enabled: true },
    ]);
  });

  it('routes only the selected GraphQL subscription operation as a stream', () => {
    const request = cloneSeedWorkspace().collections[0].requests[0];
    request.protocol = 'graphql';
    request.graphql.query = 'query Viewer { viewer { id } } subscription Events { event { id } }';
    request.graphql.operationName = 'Events';
    expect(isStreamingRequest(request)).toBe(true);
    request.graphql.operationName = 'Viewer';
    expect(isStreamingRequest(request)).toBe(false);
  });
});
