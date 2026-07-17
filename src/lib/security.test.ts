import { describe, expect, it } from 'vitest';
import { cloneSeedWorkspace } from '../data/seed';
import { appendAudit, externalSecretReferenceKey, isProtectedSecretReference, mergeSyncedWorkspace, plaintextSecretCandidates, resolveAuthorizedExternalSecret, shareableWorkspace, vaultVariables } from './security';

describe('encrypted collaboration boundaries', () => {
  it('keeps local response, credential, Git, and plugin state out of shared payloads', () => {
    const workspace = cloneSeedWorkspace();
    workspace.history = [{ id: 'history', requestId: 'request', name: 'Private', method: 'GET', url: 'https://private.example', status: 200, durationMs: 1, createdAt: new Date().toISOString() }];
    workspace.cookies = [{ id: 'cookie', name: 'session', value: 'secret', domain: 'private.example', path: '/', secure: true, httpOnly: true, sameSite: 'strict', hostOnly: true, createdAt: new Date().toISOString() }];
    workspace.project.path = '/private/repository';
    workspace.plugins = [{ id: 'plugin', name: 'Private plugin', version: '1', description: '', source: 'module.exports = {};', sourceFormat: 'insomnia-commonjs', enabled: true, requestedPermissions: [], grantedPermissions: [], installedAt: new Date().toISOString() }];
    workspace.collaboration.path = '/private/share.enc.json';

    const shared = shareableWorkspace(workspace);
    expect(shared.history).toEqual([]);
    expect(shared.cookies).toEqual([]);
    expect(shared.project.path).toBe('');
    expect(shared.plugins).toEqual([]);
    expect(shared.collaboration.path).toBe('');
    expect(shared.collections).toHaveLength(workspace.collections.length);
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
    current.history = [{ id: 'history', requestId: 'request', name: 'Keep', method: 'GET', url: 'https://local.example', status: 200, durationMs: 1, createdAt: new Date().toISOString() }];
    current.collaboration.path = '/local/team.enc.json';
    const remote = cloneSeedWorkspace();
    remote.name = 'Remote workspace';
    remote.governance.members.push({ id: 'remote-editor', name: 'Remote editor', email: '', role: 'editor', active: true });
    remote.governance.currentMemberId = 'remote-editor';

    const merged = mergeSyncedWorkspace(current, { revision: 4, actor: 'Remote editor', savedAt: new Date().toISOString(), workspace: remote });
    expect(merged.name).toBe('Remote workspace');
    expect(merged.history[0].name).toBe('Keep');
    expect(merged.collaboration.path).toBe('/local/team.enc.json');
    expect(merged.collaboration.revision).toBe(4);
    expect(merged.governance.currentMemberId).toBe('local-owner');
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
    workspace.mcpClients.push({ id: 'mcp', name: 'Local tools', transport: 'http', enabled: true, url: 'https://mcp.example', command: '', args: [], authType: 'bearer', username: '', password: '', token: 'plaintext-mcp', headers: [], roots: [], tools: [], prompts: [], resources: [], resourceTemplates: [], lastSyncedAt: '' });
    expect(plaintextSecretCandidates(workspace)).toHaveLength(6);
    workspace.environments[0].variables.at(-1)!.value = '{{ vault.api_token }}';
    workspace.collections[0].requests[0].auth.token = "{% external 'aws', 'orders-token' %}";
    workspace.collections[0].requests[0].headers.at(-1)!.value = '{{ vault.bearer_header }}';
    workspace.ai.apiKey = '{{ vault.ai_key }}';
    workspace.konnect.token = "{% external 'aws', 'konnect-token' %}";
    workspace.mcpClients[0].token = '{{ vault.mcp_token }}';
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
