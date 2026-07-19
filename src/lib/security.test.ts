import { describe, expect, it } from 'vitest';
import { cloneSeedWorkspace } from '../data/seed';
import { appendAudit, externalSecretReferenceKey, isProtectedSecretReference, mergeSyncedWorkspace, plaintextSecretCandidates, resolveAuthorizedExternalSecret, shareableWorkspace, vaultVariables } from './security';

describe('encrypted collaboration boundaries', () => {
  it('keeps local response, credential, Git, and plugin state out of shared payloads', () => {
    const workspace = cloneSeedWorkspace();
    workspace.history = [{ id: 'history', requestId: 'request', name: 'Private', method: 'GET', url: 'https://private.example', status: 200, durationMs: 1, createdAt: new Date().toISOString() }];
    const request = workspace.collections[0].requests[0];
    workspace.streamSessions = [{ id: 'stream', requestId: request.id, requestName: request.name, requestUrl: request.url, environmentId: workspace.activeEnvironmentId, protocol: 'socketio', startedAt: new Date().toISOString(), messages: [] }];
    workspace.cookies = [{ id: 'cookie', name: 'session', value: 'secret', domain: 'private.example', path: '/', secure: true, httpOnly: true, sameSite: 'strict', hostOnly: true, createdAt: new Date().toISOString() }];
    workspace.project.path = '/private/repository';
    workspace.plugins = [{ id: 'plugin', name: 'Private plugin', version: '1', description: '', source: 'module.exports = {};', sourceFormat: 'insomnia-commonjs', enabled: true, requestedPermissions: [], grantedPermissions: [], installedAt: new Date().toISOString() }];
    workspace.collaboration.path = '/private/share.enc.json';
    workspace.certificates = { ca: { enabled: true, pem: 'private-ca' }, clients: [{ id: 'cert', host: 'private.example', enabled: true, certificatePem: '', keyPem: '', pfxBase64: 'cGZ4', passphrase: 'secret' }] };
    workspace.collections[0].requests[0].auth = { ...workspace.collections[0].requests[0].auth, type: 'oauth2', code: 'code', codeVerifier: 'verifier', accessToken: 'access', identityToken: 'identity', refreshToken: 'refresh', expiresAt: 123 };

    const shared = shareableWorkspace(workspace);
    expect(shared.history).toEqual([]);
    expect(shared.cookies).toEqual([]);
    expect(shared.streamSessions).toEqual([]);
    expect(shared.project.path).toBe('');
    expect(shared.plugins).toEqual([]);
    expect(shared.collaboration.path).toBe('');
    expect(shared.certificates).toEqual({ ca: { enabled: false, pem: '' }, clients: [] });
    expect(shared.collections).toHaveLength(workspace.collections.length);
    expect(shared.collections[0].requests[0].auth).toMatchObject({ code: '', codeVerifier: '', accessToken: '', identityToken: '', refreshToken: '', expiresAt: 0 });
    expect(workspace.collections[0].requests[0].auth.accessToken).toBe('access');
  });

  it('removes private environment trees and repairs the shared active environment', () => {
    const workspace = cloneSeedWorkspace();
    workspace.environments.push(
      { id: 'private-child', name: 'Private child', parentId: 'base-environment', private: true, variables: [] },
      { id: 'private-descendant', name: 'Private descendant', parentId: 'private-child', variables: [] },
    );
    workspace.activeEnvironmentId = 'private-descendant';
    const shared = shareableWorkspace(workspace);
    expect(shared.environments.map((environment) => environment.id)).not.toContain('private-child');
    expect(shared.environments.map((environment) => environment.id)).not.toContain('private-descendant');
    expect(shared.environments.some((environment) => environment.id === shared.activeEnvironmentId)).toBe(true);
  });

  it('preserves device-local data and the current actor while applying a pulled revision', () => {
    const current = cloneSeedWorkspace();
    const request = current.collections[0].requests[0];
    current.streamSessions = [{ id: 'stream', requestId: request.id, requestName: request.name, requestUrl: request.url, environmentId: current.activeEnvironmentId, protocol: 'sse', startedAt: new Date().toISOString(), messages: [] }];
    current.history = [{ id: 'history', requestId: 'request', name: 'Keep', method: 'GET', url: 'https://local.example', status: 200, durationMs: 1, createdAt: new Date().toISOString() }];
    current.collaboration.path = '/local/team.enc.json';
    current.certificates = { ca: { enabled: true, pem: 'local-ca' }, clients: [{ id: 'cert', host: 'local.test', enabled: true, certificatePem: '', keyPem: '', pfxBase64: 'cGZ4', passphrase: 'secret' }] };
    current.collections[0].requests[0].auth = { ...current.collections[0].requests[0].auth, type: 'oauth2', accessToken: 'local-access', refreshToken: 'local-refresh', expiresAt: 123 };
    const remote = cloneSeedWorkspace();
    remote.name = 'Remote workspace';
    remote.collections[0].requests[0].auth = { ...remote.collections[0].requests[0].auth, type: 'oauth2', clientId: 'remote-client' };
    remote.governance.members.push({ id: 'remote-editor', name: 'Remote editor', email: '', role: 'editor', active: true });
    remote.governance.currentMemberId = 'remote-editor';

    const merged = mergeSyncedWorkspace(current, { revision: 4, actor: 'Remote editor', savedAt: new Date().toISOString(), workspace: remote });
    expect(merged.name).toBe('Remote workspace');
    expect(merged.history[0].name).toBe('Keep');
    expect(merged.streamSessions.map((session) => session.id)).toEqual(['stream']);
    expect(merged.collaboration.path).toBe('/local/team.enc.json');
    expect(merged.collaboration.revision).toBe(4);
    expect(merged.certificates).toEqual(current.certificates);
    expect(merged.governance.currentMemberId).toBe('local-owner');
    expect(merged.collections[0].requests[0].auth).toMatchObject({ accessToken: 'local-access', refreshToken: 'local-refresh', expiresAt: 123 });
  });

  it('exposes vault-prefixed variables only while the vault is unlocked and bounds audit retention', () => {
    expect(vaultVariables({ unlocked: false, passphrase: '', entries: [{ id: 'one', name: 'token', value: 'secret', updatedAt: '' }] })).toEqual({});
    expect(vaultVariables({ unlocked: true, passphrase: '', entries: [{ id: 'one', name: 'token', value: 'secret', updatedAt: '' }] })).toEqual({ 'vault.token': 'secret' });
    let workspace = cloneSeedWorkspace();
    workspace.governance.policy.auditRetention = 2;
    workspace = appendAudit(workspace, 'one', 'first');
    workspace = appendAudit(workspace, 'two', 'second');
    workspace = appendAudit(workspace, 'three', 'third');
    expect(workspace.governance.audit.map((event) => event.action)).toEqual(['three', 'two']);
  });

  it('blocks likely plaintext credentials but accepts vault and external-vault references', () => {
    const workspace = cloneSeedWorkspace();
    workspace.environments[0].variables.push({ id: 'token', name: 'apiToken', value: 'plaintext', enabled: false });
    workspace.collections[0].requests[0].auth.token = 'plaintext-bearer';
    workspace.collections[0].requests[0].headers.push({ id: 'auth-header', name: 'Authorization', value: 'Bearer plaintext', enabled: false });
    workspace.ai.apiKey = 'plaintext-ai';
    workspace.konnect.token = 'plaintext-konnect';
    workspace.mcpClients.push({ id: 'mcp', name: 'Local tools', transport: 'http', enabled: true, url: 'https://mcp.example', command: '', args: [], authType: 'bearer', username: '', password: '', token: 'plaintext-mcp', oauthAuthorizationUrl: '', oauthAccessTokenUrl: '', oauthClientId: '', oauthClientSecret: '', oauthScope: '', oauthState: '', oauthRefreshToken: '', oauthIdentityToken: '', oauthExpiresAt: 0, oauthTokenPrefix: 'Bearer', oauthRegisteredClientId: '', oauthRegisteredClientSecret: '', oauthRegisteredClientIdIssuedAt: 0, oauthRegisteredClientSecretExpiresAt: 0, oauthRegisteredTokenEndpointAuthMethod: 'none', headers: [], roots: [], tools: [], prompts: [], resources: [], resourceTemplates: [], lastSyncedAt: '' });
    expect(plaintextSecretCandidates(workspace)).toHaveLength(6);
    workspace.environments[0].variables.at(-1)!.value = '{{ vault.api_token }}';
    workspace.collections[0].requests[0].auth.token = "{% external 'aws', 'orders-token' %}";
    workspace.collections[0].requests[0].headers.at(-1)!.value = '{{ vault.bearer_header }}';
    workspace.ai.apiKey = '{{ vault.ai_key }}';
    workspace.konnect.token = "{% external 'aws', 'konnect-token' %}";
    workspace.mcpClients[0].token = '{{ vault.mcp_token }}';
    expect(plaintextSecretCandidates(workspace)).toEqual([]);
    workspace.mcpClients[0].authType = 'oauth2';
    workspace.mcpClients[0].token = 'device-local-runtime-token';
    workspace.mcpClients[0].oauthClientSecret = 'plaintext-oauth-secret';
    expect(plaintextSecretCandidates(workspace)).toEqual(['MCP Local tools: OAuth client secret']);
    workspace.mcpClients[0].oauthClientSecret = '{{ vault.mcp_client_secret }}';
    expect(plaintextSecretCandidates(workspace)).toEqual([]);
  });

  it('flags request-local PFX identities and passphrases before plaintext publication', () => {
    const workspace = cloneSeedWorkspace();
    const request = workspace.collections[0].requests[0];
    request.transport.clientCertificatePfxBase64 = 'cGZ4';
    request.transport.clientCertificatePassphrase = 'secret';
    expect(plaintextSecretCandidates(workspace)).toEqual([
      'Orders / List Orders: client PFX/PKCS#12 identity',
      'Orders / List Orders: client-certificate passphrase',
    ]);
  });

  it('flags plaintext Buf API keys and accepts protected references', () => {
    const workspace = cloneSeedWorkspace();
    const collection = workspace.collections.find((candidate) => candidate.requests.some((request) => request.protocol === 'grpc'))!;
    const request = collection.requests.find((candidate) => candidate.protocol === 'grpc')!;
    request.grpc.reflectionApiKey = 'plaintext-buf-key';
    expect(plaintextSecretCandidates(workspace)).toEqual([`${collection.name} / ${request.name}: Buf reflection API key`]);
    request.grpc.reflectionApiKey = '{{ vault.buf_api_key }}';
    expect(plaintextSecretCandidates(workspace)).toEqual([]);
  });

  it('checks inherited collection and folder configuration for plaintext credentials', () => {
    const workspace = cloneSeedWorkspace();
    workspace.collections[0].environment = [{ id: 'collection-token', name: 'clientSecret', value: 'plaintext', enabled: true }];
    workspace.collections[0].folders = [{
      id: 'folder', name: 'Secured', parentId: '', expanded: true,
      headers: [{ id: 'folder-auth', name: 'Authorization', value: 'Bearer plaintext', enabled: true }],
      environment: [], auth: { ...workspace.collections[0].requests[0].auth, type: 'bearer', token: 'plaintext-folder' },
      preRequestScript: '', tests: '', documentation: '',
    }];
    expect(plaintextSecretCandidates(workspace)).toEqual([
      'Orders: variable clientSecret',
      'Orders / Secured: auth.token',
      'Orders / Secured: header Authorization',
    ]);
  });

  it('treats OAuth codes, verifiers, and identity tokens as plaintext secrets', () => {
    const workspace = cloneSeedWorkspace();
    workspace.collections[0].requests[0].auth = {
      ...workspace.collections[0].requests[0].auth,
      code: 'authorization-code',
      codeVerifier: 'pkce-verifier',
      identityToken: 'identity-token',
    };
    expect(plaintextSecretCandidates(workspace)).toEqual([
      'Orders / List Orders: auth.code',
      'Orders / List Orders: auth.codeVerifier',
      'Orders / List Orders: auth.identityToken',
    ]);
  });

  it('accepts only complete protected references for credential fields', () => {
    expect(isProtectedSecretReference('{{ vault.api_token }}')).toBe(true);
    expect(isProtectedSecretReference("{% external 'aws', 'orders-token' %}")).toBe(true);
    expect(isProtectedSecretReference('Bearer {{ vault.api_token }}')).toBe(false);
    expect(isProtectedSecretReference('plaintext {{ vault.api_token }}')).toBe(false);
  });

  it('rejects unapproved external vault references before invoking a provider CLI', async () => {
    const workspace = cloneSeedWorkspace();
    await expect(resolveAuthorizedExternalSecret(workspace, { provider: 'aws', reference: 'orders-token' })).rejects.toThrow('is not approved');
  });

  it('binds external-vault approvals to the complete provider reference tuple', () => {
    const base = externalSecretReferenceKey({ provider: 'aws', reference: 'orders-token', scope: 'us-west-2', version: 'AWSCURRENT' });
    expect(base).not.toBe(externalSecretReferenceKey({ provider: 'aws', reference: 'orders-token', scope: 'us-east-1', version: 'AWSCURRENT' }));
    expect(base).not.toBe(externalSecretReferenceKey({ provider: 'aws', reference: 'orders-token', scope: 'us-west-2', version: 'AWSPREVIOUS' }));
  });
});
