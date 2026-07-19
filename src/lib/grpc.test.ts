import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBlankRequest } from '../data/seed';
import { loadGrpcSchema } from './grpc';

const tauri = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: tauri.invoke,
  isTauri: () => true,
}));

beforeEach(() => {
  tauri.invoke.mockReset();
  tauri.invoke.mockResolvedValue({ services: [], descriptorSetBase64: 'descriptor' });
});

describe('gRPC schema loading', () => {
  it('sends the complete proto tree and explicit entry to native compilation', async () => {
    const request = createBlankRequest('grpc-tree');
    request.protocol = 'grpc';
    request.grpc.descriptorSource = 'proto';
    request.grpc.protoFiles = [
      { id: 'service', path: 'services/api.proto', text: 'import "types.proto"; service API {}' },
      { id: 'types', path: 'types.proto', text: 'message Request {}' },
    ];
    request.grpc.protoEntryPath = 'services/api.proto';

    await loadGrpcSchema(request);

    expect(tauri.invoke).toHaveBeenCalledWith('grpc_load_schema', expect.objectContaining({ input: expect.objectContaining({
      protoEntryPath: 'services/api.proto',
      protoFiles: [
        { path: 'services/api.proto', text: 'import "types.proto"; service API {}' },
        { path: 'types.proto', text: 'message Request {}' },
      ],
    }) }));
  });
});
