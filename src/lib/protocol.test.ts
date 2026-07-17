import { describe, expect, it } from 'vitest';
import { cloneSeedWorkspace } from '../data/seed';
import { previewGrpcSchema, sseConnectConfig, streamTransportConfig } from './protocol';

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
    const transport = streamTransportConfig(request, 'http2-prior-knowledge', 3, false, 12_345, false);

    expect(transport).toMatchObject({ timeoutMs: 12_345, validateCertificates: false, preferredHttpVersion: 'http2-prior-knowledge', maxRedirects: 3, followRedirects: false });
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
});
