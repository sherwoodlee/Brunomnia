import { describe, expect, it } from 'vitest';
import { previewGrpcSchema } from './protocol';

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
