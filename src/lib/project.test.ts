import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cloneSeedWorkspace } from '../data/seed';
import { readProject, writeProject } from './project';

const tauri = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: tauri.invoke,
  isTauri: () => true,
}));

beforeEach(() => tauri.invoke.mockReset());

describe('filesystem project OAuth boundaries', () => {
  it('omits runtime OAuth credentials from split-project writes', async () => {
    const workspace = cloneSeedWorkspace();
    workspace.collections[0].requests[0].auth = {
      ...workspace.collections[0].requests[0].auth,
      type: 'oauth2',
      code: 'code',
      codeVerifier: 'verifier',
      accessToken: 'access',
      identityToken: 'identity',
      refreshToken: 'refresh',
      expiresAt: 123,
    };
    workspace.certificates = { ca: { enabled: true, pem: 'local-ca' }, clients: [{ id: 'cert', host: 'api.test', enabled: true, certificatePem: '', keyPem: '', pfxBase64: 'cGZ4', passphrase: 'secret' }] };
    workspace.fileState[workspace.collections[0].id] = { cookies: [], certificates: workspace.certificates };
    tauri.invoke.mockResolvedValue({ path: '/tmp/project', filesWritten: 1, filesUnchanged: 0, filesRemoved: 0 });

    await writeProject('/tmp/project', workspace);

    const payload = tauri.invoke.mock.calls[0][1] as { input: { workspace: typeof workspace } };
    expect(payload.input.workspace.collections[0].requests[0].auth).toMatchObject({ code: '', codeVerifier: '', accessToken: '', identityToken: '', refreshToken: '', expiresAt: 0 });
    expect(payload.input.workspace.certificates).toEqual({ ca: { enabled: false, pem: '' }, clients: [] });
    expect(payload.input.workspace.fileState).toEqual({});
    expect(workspace.collections[0].requests[0].auth.accessToken).toBe('access');
  });

  it('restores matching local OAuth credentials after a project reload', async () => {
    const current = cloneSeedWorkspace();
    const request = current.collections[0].requests[0];
    current.streamSessions = [{ id: 'stream', requestId: request.id, requestName: request.name, requestUrl: request.url, environmentId: current.activeEnvironmentId, protocol: 'socketio', startedAt: new Date().toISOString(), messages: [] }];
    current.collections[0].requests[0].auth = { ...current.collections[0].requests[0].auth, type: 'oauth2', clientId: 'local-client', accessToken: 'local-access', refreshToken: 'local-refresh', expiresAt: 123 };
    current.certificates = { ca: { enabled: true, pem: 'local-ca' }, clients: [{ id: 'cert', host: 'api.test', enabled: true, certificatePem: '', keyPem: '', pfxBase64: 'cGZ4', passphrase: 'secret' }] };
    current.fileState[current.collections[0].id] = { cookies: [], certificates: current.certificates };
    const incoming = cloneSeedWorkspace();
    incoming.collections[0].requests[0].auth = { ...incoming.collections[0].requests[0].auth, type: 'oauth2', clientId: 'project-client' };
    tauri.invoke.mockResolvedValue(incoming);

    const loaded = await readProject('/tmp/project', current);

    expect(loaded.collections[0].requests[0].auth).toMatchObject({ clientId: 'project-client', accessToken: 'local-access', refreshToken: 'local-refresh', expiresAt: 123 });
    expect(loaded.streamSessions.map((session) => session.id)).toEqual(['stream']);
    expect(loaded.certificates).toEqual({ ca: { enabled: false, pem: '' }, clients: [] });
    expect(loaded.fileState[current.collections[0].id]).toEqual(current.fileState[current.collections[0].id]);
  });
});
