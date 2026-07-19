import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBlankRequest } from '../data/seed';
import { cancelGrpcSession, commitGrpcSession, loadGrpcSchema, sendGrpcSessionMessage, startGrpcSession } from './grpc';

const tauri = vi.hoisted(() => ({ channels: [] as Array<{ onmessage?: (message: unknown) => void }>, invoke: vi.fn() }));

vi.mock('@tauri-apps/api/core', () => ({
  Channel: class {
    onmessage?: (message: unknown) => void;

    constructor() {
      tauri.channels.push(this);
    }
  },
  invoke: tauri.invoke,
  isTauri: () => true,
}));

beforeEach(() => {
  tauri.channels.length = 0;
  tauri.invoke.mockReset();
  tauri.invoke.mockResolvedValue({ services: [], descriptorSetBase64: 'descriptor' });
});

describe('gRPC schema loading', () => {
  it('sends the complete proto tree and explicit entry to native compilation', async () => {
    const request = createBlankRequest('grpc-tree');
    request.protocol = 'grpc';
    request.url = 'grpcs://localhost:50051';
    request.grpc.descriptorSource = 'proto';
    request.grpc.protoFiles = [
      { id: 'service', path: 'services/api.proto', text: 'import "types.proto"; service API {}' },
      { id: 'types', path: 'types.proto', text: 'message Request {}' },
    ];
    request.grpc.protoEntryPath = 'services/api.proto';

    await loadGrpcSchema(request, undefined, 30_000, true, {
      ca: { enabled: true, pem: 'workspace-ca' },
      clients: [{ id: 'client', host: 'localhost', enabled: true, certificatePem: '', keyPem: '', pfxBase64: 'cGZ4', passphrase: 'secret' }],
    });

    expect(tauri.invoke).toHaveBeenCalledWith('grpc_load_schema', expect.objectContaining({ input: expect.objectContaining({
      protoEntryPath: 'services/api.proto',
      protoFiles: [
        { path: 'services/api.proto', text: 'import "types.proto"; service API {}' },
        { path: 'types.proto', text: 'message Request {}' },
      ],
      transport: expect.objectContaining({ caCertificatePem: 'workspace-ca', clientCertificatePfxBase64: 'cGZ4', clientCertificatePassphrase: 'secret' }),
    }) }));
  });

  it('resolves Buf registry settings and selects certificates for the registry host', async () => {
    const request = createBlankRequest('grpc-buf');
    request.protocol = 'grpc';
    request.url = 'grpcs://service.internal:50051';
    request.grpc.descriptorSource = 'buf';
    request.grpc.reflectionApiUrl = 'https://{{ registry }}/tenant';
    request.grpc.reflectionApiKey = '{{ token }}';
    request.grpc.reflectionApiModule = 'buf.build/{{ organization }}/payments';
    request.grpc.disableUserAgentHeader = true;

    await loadGrpcSchema(request, {
      id: 'environment',
      name: 'Development',
      variables: [
        { id: 'registry', name: 'registry', value: 'registry.internal', enabled: true },
        { id: 'token', name: 'token', value: 'buf-secret', enabled: true },
        { id: 'organization', name: 'organization', value: 'acme', enabled: true },
      ],
    }, 6_000, true, {
      ca: { enabled: true, pem: 'workspace-ca' },
      clients: [
        { id: 'service', host: 'service.internal', enabled: true, certificatePem: 'service-certificate', keyPem: 'service-key', pfxBase64: '', passphrase: '' },
        { id: 'registry', host: 'registry.internal', enabled: true, certificatePem: 'registry-certificate', keyPem: 'registry-key', pfxBase64: '', passphrase: '' },
      ],
    });

    expect(tauri.invoke).toHaveBeenCalledWith('grpc_load_schema', { input: expect.objectContaining({
      endpoint: 'grpcs://service.internal:50051',
      source: 'buf',
      reflectionApi: {
        url: 'https://registry.internal/tenant',
        apiKey: 'buf-secret',
        module: 'buf.build/acme/payments',
        disableUserAgentHeader: true,
      },
      transport: expect.objectContaining({
        timeoutMs: 6_000,
        caCertificatePem: 'workspace-ca',
        clientCertificatePem: 'registry-certificate',
        clientKeyPem: 'registry-key',
      }),
    }) });
  });

  it('starts a channel-backed session with resolved metadata and workspace TLS', async () => {
    const request = createBlankRequest('grpc-session');
    request.protocol = 'grpc';
    request.url = 'grpcs://{{ host }}:50051';
    request.grpc.service = 'brunomnia.test.Greeter';
    request.grpc.method = 'Chat';
    request.grpc.descriptorSetBase64 = 'descriptor';
    request.grpc.input = '{"name":"{{ person }}"}';
    request.grpc.metadata = [{ id: 'metadata', name: 'x-tenant', value: '{{ tenant }}', enabled: true }];
    tauri.invoke.mockResolvedValue({ sessionId: 'session-1', callType: 'bidirectional-streaming', durationMs: 4 });
    const onEvent = vi.fn();

    await startGrpcSession(request, {
      id: 'environment',
      name: 'Development',
      variables: [
        { id: 'host', name: 'host', value: 'localhost', enabled: true },
        { id: 'tenant', name: 'tenant', value: 'acme', enabled: true },
        { id: 'person', name: 'person', value: 'Ada', enabled: true },
      ],
    }, 'session-1', onEvent, 4_000, false, {
      ca: { enabled: true, pem: 'workspace-ca' },
      clients: [{ id: 'client', host: 'localhost', enabled: true, certificatePem: 'certificate', keyPem: 'key', pfxBase64: '', passphrase: '' }],
    });

    expect(tauri.invoke).toHaveBeenCalledWith('grpc_start_session', expect.objectContaining({
      input: expect.objectContaining({
        sessionId: 'session-1',
        call: expect.objectContaining({
          endpoint: 'grpcs://localhost:50051',
          messagesJson: '{"name":"Ada"}',
          metadata: [expect.objectContaining({ value: 'acme' })],
          transport: expect.objectContaining({
            timeoutMs: 4_000,
            validateCertificates: false,
            caCertificatePem: 'workspace-ca',
            clientCertificatePem: 'certificate',
          }),
        }),
      }),
      onEvent: tauri.channels[0],
    }));
    tauri.channels[0].onmessage?.({ sessionId: 'session-1', direction: 'system', kind: 'status', text: '3 INVALID_ARGUMENT: name is required', timestamp: '2026-07-18T00:00:00Z', statusCode: 3, statusName: 'INVALID_ARGUMENT', statusDetails: 'name is required', metadata: { 'x-error-id': ['reject-1'] } });
    expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({ id: expect.any(String), sessionId: 'session-1', kind: 'status', statusCode: 3, metadata: { 'x-error-id': ['reject-1'] } }));
  });

  it('maps send, commit, and cancel to independent lifecycle commands', async () => {
    tauri.invoke.mockResolvedValue(undefined);
    const environment = { id: 'environment', name: 'Development', variables: [{ id: 'name', name: 'name', value: 'Grace', enabled: true }] };

    await sendGrpcSessionMessage('session-2', '{"name":"{{ name }}"}', environment);
    await commitGrpcSession('session-2');
    await cancelGrpcSession('session-2');

    expect(tauri.invoke.mock.calls).toEqual([
      ['grpc_send_message', { sessionId: 'session-2', messageJson: '{"name":"Grace"}' }],
      ['grpc_commit_session', { sessionId: 'session-2' }],
      ['grpc_cancel_session', { sessionId: 'session-2' }],
    ]);
  });
});
