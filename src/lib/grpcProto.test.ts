import { describe, expect, it } from 'vitest';
import { GRPC_PROTO_MAX_FILE_BYTES, normalizeGrpcProtoPath, normalizeGrpcProtoTree } from './grpcProto';
import { importGrpcProtoFiles } from './grpcProtoImport';

describe('gRPC proto trees', () => {
  it('normalizes relative paths and rejects traversal or non-proto files', () => {
    expect(normalizeGrpcProtoPath('./orders\\v1//orders.proto')).toBe('orders/v1/orders.proto');
    expect(() => normalizeGrpcProtoPath('../secret.proto')).toThrow('parent');
    expect(() => normalizeGrpcProtoPath('/tmp/schema.proto')).toThrow('relative');
    expect(() => normalizeGrpcProtoPath('schema.json')).toThrow('.proto');
  });

  it('selects a service-bearing entry and keeps legacy proto text synchronized', () => {
    const tree = normalizeGrpcProtoTree([
      { id: 'message', path: 'types/message.proto', text: 'syntax = "proto3"; message Request {}' },
      { id: 'service', path: 'api.proto', text: 'syntax = "proto3"; service API {}' },
    ]);
    expect(tree.protoEntryPath).toBe('api.proto');
    expect(tree.protoActivePath).toBe('api.proto');
    expect(tree.protoText).toContain('service API');
  });

  it('migrates a legacy source and bounds malformed persisted trees', () => {
    const legacy = normalizeGrpcProtoTree(undefined, 'syntax = "proto3"; service Legacy {}');
    expect(legacy).toMatchObject({ protoEntryPath: 'schema.proto', protoActivePath: 'schema.proto' });
    expect(legacy.protoFiles).toHaveLength(1);

    const bounded = normalizeGrpcProtoTree([
      { path: '../escape.proto', text: 'bad' },
      { path: 'valid.proto', text: 'x'.repeat(GRPC_PROTO_MAX_FILE_BYTES + 100) },
      { path: 'VALID.proto', text: 'duplicate' },
    ]);
    expect(bounded.protoFiles).toHaveLength(1);
    expect(new Blob([bounded.protoFiles[0].text]).size).toBe(GRPC_PROTO_MAX_FILE_BYTES);

    const unicode = normalizeGrpcProtoTree([{ path: 'unicode.proto', text: `abc${'🙂'.repeat(GRPC_PROTO_MAX_FILE_BYTES)}` }]);
    expect(new Blob([unicode.protoFiles[0].text]).size).toBeLessThanOrEqual(GRPC_PROTO_MAX_FILE_BYTES);
  });

  it('strips one selected directory root and preserves nested import paths', async () => {
    const file = (path: string, text: string) => ({
      name: path.split('/').at(-1),
      webkitRelativePath: path,
      size: new Blob([text]).size,
      text: async () => text,
    }) as File;
    const tree = await importGrpcProtoFiles([
      file('example/services/api.proto', 'syntax = "proto3"; import "types/message.proto"; service API {}'),
      file('example/types/message.proto', 'syntax = "proto3"; message Request {}'),
    ]);
    expect(tree.protoFiles.map((item) => item.path)).toEqual(['services/api.proto', 'types/message.proto']);
    expect(tree.protoEntryPath).toBe('services/api.proto');
  });
});
