import { describe, expect, it } from 'vitest';
import { cloneSeedWorkspace, createBlankRequest } from '../data/seed';
import type { McpClient } from '../types';
import { mergeLocalOAuth2RuntimeCredentials, withoutOAuth2RuntimeCredentials } from './oauth2Tokens';

const mcpOAuthClient = (): McpClient => ({
  id: 'mcp-oauth', name: 'MCP OAuth', enabled: true, transport: 'http', url: 'https://mcp.example', command: '', args: [], headers: [], authType: 'oauth2', token: 'mcp-access', username: '', password: '',
  oauthAuthorizationUrl: 'https://identity.example/authorize', oauthAccessTokenUrl: 'https://identity.example/token', oauthClientId: 'local-client', oauthClientSecret: '{{ vault.mcp_client_secret }}', oauthScope: 'mcp', oauthState: '', oauthRefreshToken: 'mcp-refresh', oauthIdentityToken: 'mcp-identity', oauthExpiresAt: 789, oauthTokenPrefix: 'DPoP', oauthRegisteredClientId: 'registered-client', oauthRegisteredClientSecret: 'registered-secret', oauthRegisteredClientIdIssuedAt: 111, oauthRegisteredClientSecretExpiresAt: 222, oauthRegisteredTokenEndpointAuthMethod: 'client_secret_post',
  roots: [], tools: [], prompts: [], resources: [], resourceTemplates: [],
});

describe('local-only OAuth 2 runtime credentials', () => {
  it('strips request and folder runtime fields without mutating local state', () => {
    const workspace = cloneSeedWorkspace();
    const request = workspace.collections[0].requests[0];
    request.auth = {
      ...request.auth,
      type: 'oauth2',
      code: 'code',
      codeVerifier: 'verifier',
      accessToken: 'access',
      identityToken: 'identity',
      refreshToken: 'refresh',
      expiresAt: 123,
      clientSecret: 'configured-secret',
    };
    workspace.collections[0].folders = [{
      id: 'oauth-folder', name: 'OAuth', parentId: '', expanded: true, headers: [], environment: [],
      auth: { ...request.auth, accessToken: 'folder-access' }, preRequestScript: '', tests: '', documentation: '',
    }];

    const shared = withoutOAuth2RuntimeCredentials(workspace);

    expect(shared.collections[0].requests[0].auth).toMatchObject({ code: '', codeVerifier: '', accessToken: '', identityToken: '', refreshToken: '', expiresAt: 0, clientSecret: 'configured-secret' });
    expect(shared.collections[0].folders?.[0].auth?.accessToken).toBe('');
    expect(workspace.collections[0].requests[0].auth.accessToken).toBe('access');
    expect(workspace.collections[0].folders?.[0].auth?.accessToken).toBe('folder-access');
  });

  it('restores matching local owner credentials over incoming configuration', () => {
    const local = cloneSeedWorkspace();
    const request = local.collections[0].requests[0];
    request.auth = { ...request.auth, type: 'oauth2', clientId: 'old-client', accessToken: 'local-access', refreshToken: 'local-refresh', expiresAt: 999 };
    local.collections[0].folders = [{
      id: 'oauth-folder', name: 'OAuth', parentId: '', expanded: true, headers: [], environment: [],
      auth: { ...request.auth, accessToken: 'folder-local' }, preRequestScript: '', tests: '', documentation: '',
    }];
    const incoming = withoutOAuth2RuntimeCredentials(structuredClone(local));
    incoming.collections[0].requests[0].auth.clientId = 'incoming-client';
    incoming.collections[0].folders![0].auth!.clientId = 'incoming-folder-client';
    incoming.collections[0].requests.push(createBlankRequest('new-request'));

    const merged = mergeLocalOAuth2RuntimeCredentials(local, incoming);

    expect(merged.collections[0].requests[0].auth).toMatchObject({ clientId: 'incoming-client', accessToken: 'local-access', refreshToken: 'local-refresh', expiresAt: 999 });
    expect(merged.collections[0].folders?.[0].auth).toMatchObject({ clientId: 'incoming-folder-client', accessToken: 'folder-local' });
    expect(merged.collections[0].requests.find((candidate) => candidate.id === 'new-request')?.auth.accessToken).toBe('');
  });

  it('does not attach OAuth runtime fields after the incoming auth type changes', () => {
    const local = cloneSeedWorkspace();
    local.collections[0].requests[0].auth = { ...local.collections[0].requests[0].auth, type: 'oauth2', accessToken: 'local-access' };
    const incoming = structuredClone(local);
    incoming.collections[0].requests[0].auth = { ...incoming.collections[0].requests[0].auth, type: 'basic', accessToken: '' };
    expect(mergeLocalOAuth2RuntimeCredentials(local, incoming).collections[0].requests[0].auth).toMatchObject({ type: 'basic', accessToken: '' });
  });

  it('rejects runtime credentials supplied only by incoming project data', () => {
    const local = cloneSeedWorkspace();
    const incoming = cloneSeedWorkspace();
    incoming.collections[0].requests[0].auth = { ...incoming.collections[0].requests[0].auth, type: 'oauth2', accessToken: 'untrusted-access', refreshToken: 'untrusted-refresh', expiresAt: 123 };
    expect(mergeLocalOAuth2RuntimeCredentials(local, incoming).collections[0].requests[0].auth).toMatchObject({ accessToken: '', refreshToken: '', expiresAt: 0 });
  });

  it('strips and restores MCP OAuth runtime credentials by client owner', () => {
    const local = cloneSeedWorkspace();
    local.mcpClients = [mcpOAuthClient()];
    const shared = withoutOAuth2RuntimeCredentials(local);
    expect(shared.mcpClients[0]).toMatchObject({ token: '', oauthRefreshToken: '', oauthIdentityToken: '', oauthExpiresAt: 0, oauthClientSecret: '{{ vault.mcp_client_secret }}', oauthRegisteredClientId: '', oauthRegisteredClientSecret: '', oauthRegisteredClientIdIssuedAt: 0, oauthRegisteredClientSecretExpiresAt: 0, oauthRegisteredTokenEndpointAuthMethod: 'none' });
    expect(local.mcpClients[0].token).toBe('mcp-access');

    shared.mcpClients[0].oauthClientId = 'incoming-client';
    const merged = mergeLocalOAuth2RuntimeCredentials(local, shared);
    expect(merged.mcpClients[0]).toMatchObject({ oauthClientId: 'incoming-client', token: 'mcp-access', oauthRefreshToken: 'mcp-refresh', oauthIdentityToken: 'mcp-identity', oauthExpiresAt: 789, oauthTokenPrefix: 'DPoP', oauthRegisteredClientId: 'registered-client', oauthRegisteredClientSecret: 'registered-secret', oauthRegisteredTokenEndpointAuthMethod: 'client_secret_post' });
  });

  it('rejects injected MCP OAuth tokens and does not restore across auth changes', () => {
    const local = cloneSeedWorkspace();
    const incoming = cloneSeedWorkspace();
    incoming.mcpClients = [mcpOAuthClient()];
    expect(mergeLocalOAuth2RuntimeCredentials(local, incoming).mcpClients[0]).toMatchObject({ token: '', oauthRefreshToken: '', oauthIdentityToken: '', oauthExpiresAt: 0 });

    local.mcpClients = [mcpOAuthClient()];
    incoming.mcpClients[0].authType = 'bearer';
    incoming.mcpClients[0].token = '{{ vault.mcp_pat }}';
    expect(mergeLocalOAuth2RuntimeCredentials(local, incoming).mcpClients[0].token).toBe('{{ vault.mcp_pat }}');
  });
});
