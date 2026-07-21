import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cloneSeedWorkspace } from '../data/seed';
import { cloneGitProject, discoverGitProviderRepositories, fetchGitRemote, gitCredentialInput, loadGitCredentials, probeGitRepository, readProject, saveGitCredentials, validateGitProviderCredential, writeProject } from './project';

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
    workspace.collections[0].subEnvironments = [{ id: 'private-collection', name: 'Private collection', private: true, variables: [{ id: 'private-secret', name: 'token', value: '', enabled: true, valueType: 'secret' }] }];
    workspace.collections[0].activeSubEnvironmentId = 'private-collection';
    tauri.invoke.mockResolvedValue({ path: '/tmp/project', filesWritten: 1, filesUnchanged: 0, filesRemoved: 0 });

    await writeProject('/tmp/project', workspace);

    const payload = tauri.invoke.mock.calls[0][1] as { input: { workspace: typeof workspace } };
    expect(payload.input.workspace.collections[0].requests[0].auth).toMatchObject({ code: '', codeVerifier: '', accessToken: '', identityToken: '', refreshToken: '', expiresAt: 0 });
    expect(payload.input.workspace.certificates).toEqual({ ca: { enabled: false, pem: '' }, clients: [] });
    expect(payload.input.workspace.fileState).toEqual({});
    expect(payload.input.workspace.collections[0].subEnvironments).toEqual([]);
    expect(payload.input.workspace.collections[0].activeSubEnvironmentId).toBe('');
    expect(workspace.collections[0].requests[0].auth.accessToken).toBe('access');
  });

  it('restores matching local OAuth credentials after a project reload', async () => {
    const current = cloneSeedWorkspace();
    const request = current.collections[0].requests[0];
    current.streamSessions = [{ id: 'stream', requestId: request.id, requestName: request.name, requestUrl: request.url, environmentId: current.activeEnvironmentId, protocol: 'socketio', startedAt: new Date().toISOString(), messages: [] }];
    current.collections[0].requests[0].auth = { ...current.collections[0].requests[0].auth, type: 'oauth2', clientId: 'local-client', accessToken: 'local-access', refreshToken: 'local-refresh', expiresAt: 123 };
    current.certificates = { ca: { enabled: true, pem: 'local-ca' }, clients: [{ id: 'cert', host: 'api.test', enabled: true, certificatePem: '', keyPem: '', pfxBase64: 'cGZ4', passphrase: 'secret' }] };
    current.fileState[current.collections[0].id] = { cookies: [], certificates: current.certificates };
    current.collections[0].subEnvironments = [{ id: 'local-private', name: 'Local private', private: true, variables: [] }];
    current.collections[0].activeSubEnvironmentId = 'local-private';
    const incoming = cloneSeedWorkspace();
    incoming.collections[0].requests[0].auth = { ...incoming.collections[0].requests[0].auth, type: 'oauth2', clientId: 'project-client' };
    incoming.collections[0].subEnvironments = [{ id: 'project-shared', name: 'Project shared', variables: [] }];
    incoming.collections[0].activeSubEnvironmentId = 'project-shared';
    tauri.invoke.mockResolvedValue(incoming);

    const loaded = await readProject('/tmp/project', current);

    expect(loaded.collections[0].requests[0].auth).toMatchObject({ clientId: 'project-client', accessToken: 'local-access', refreshToken: 'local-refresh', expiresAt: 123 });
    expect(loaded.streamSessions.map((session) => session.id)).toEqual(['stream']);
    expect(loaded.certificates).toEqual({ ca: { enabled: false, pem: '' }, clients: [] });
    expect(loaded.collections[0].subEnvironments?.map((environment) => environment.id)).toEqual(['project-shared', 'local-private']);
    expect(loaded.collections[0].activeSubEnvironmentId).toBe('local-private');
    expect(loaded.fileState[current.collections[0].id]).toEqual(current.fileState[current.collections[0].id]);
  });
});

describe('Git provider command boundaries', () => {
  it('passes only transient provider fields to native Git and discovery commands', async () => {
    const credential = gitCredentialInput({ id: 'github-one', name: 'Work GitHub', provider: 'github', username: '', token: 'secret' })!;
    tauri.invoke.mockResolvedValue({});

    await validateGitProviderCredential(credential);
    await discoverGitProviderRepositories(credential);
    await probeGitRepository('https://github.com/acme/orders.git', 'main', credential);
    await cloneGitProject('https://github.com/acme/orders.git', '/tmp/orders', 'main', credential);
    await fetchGitRemote('/tmp/orders', 'origin', credential);
    await loadGitCredentials();
    await saveGitCredentials([{ id: 'github-one', name: 'Work GitHub', provider: 'github', username: '', token: 'secret' }]);

    expect(tauri.invoke.mock.calls).toEqual([
      ['project_git_provider_validate', { credential }],
      ['project_git_provider_repositories', { credential }],
      ['project_git_repository_probe', { remote: 'https://github.com/acme/orders.git', branch: 'main', credential }],
      ['project_git_clone', { remote: 'https://github.com/acme/orders.git', path: '/tmp/orders', branch: 'main', credential }],
      ['project_git_fetch', { path: '/tmp/orders', remote: 'origin', credential }],
      ['project_git_credentials_load'],
      ['project_git_credentials_save', { credentials: [{ id: 'github-one', name: 'Work GitHub', provider: 'github', username: '', token: 'secret' }] }],
    ]);
    expect(JSON.stringify(tauri.invoke.mock.calls.slice(0, 5))).not.toContain('github-one');
    expect(JSON.stringify(tauri.invoke.mock.calls.slice(0, 5))).not.toContain('Work GitHub');
  });
});
