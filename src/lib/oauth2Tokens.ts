import type { AuthConfig, Collection, McpClient, Workspace } from '../types';

const runtimeFields = (auth: AuthConfig): Pick<AuthConfig, 'code' | 'codeVerifier' | 'accessToken' | 'identityToken' | 'refreshToken' | 'expiresAt'> => ({
  code: auth.code,
  codeVerifier: auth.codeVerifier,
  accessToken: auth.accessToken,
  identityToken: auth.identityToken,
  refreshToken: auth.refreshToken,
  expiresAt: auth.expiresAt,
});

const clearRuntimeFields = (auth: AuthConfig): AuthConfig => auth.type === 'oauth2' ? {
  ...auth,
  code: '',
  codeVerifier: '',
  accessToken: '',
  identityToken: '',
  refreshToken: '',
  expiresAt: 0,
} : auth;

const withoutCollectionTokens = (collection: Collection): Collection => ({
  ...collection,
  requests: collection.requests.map((request) => ({ ...request, auth: clearRuntimeFields(request.auth) })),
  folders: (collection.folders ?? []).map((folder) => ({ ...folder, auth: folder.auth ? clearRuntimeFields(folder.auth) : undefined })),
});

const mcpRuntimeFields = (client: McpClient): Pick<McpClient, 'token' | 'oauthRefreshToken' | 'oauthIdentityToken' | 'oauthExpiresAt' | 'oauthTokenPrefix' | 'oauthRegisteredClientId' | 'oauthRegisteredClientSecret' | 'oauthRegisteredClientIdIssuedAt' | 'oauthRegisteredClientSecretExpiresAt' | 'oauthRegisteredTokenEndpointAuthMethod'> => ({
  token: client.token,
  oauthRefreshToken: client.oauthRefreshToken,
  oauthIdentityToken: client.oauthIdentityToken,
  oauthExpiresAt: client.oauthExpiresAt,
  oauthTokenPrefix: client.oauthTokenPrefix,
  oauthRegisteredClientId: client.oauthRegisteredClientId,
  oauthRegisteredClientSecret: client.oauthRegisteredClientSecret,
  oauthRegisteredClientIdIssuedAt: client.oauthRegisteredClientIdIssuedAt,
  oauthRegisteredClientSecretExpiresAt: client.oauthRegisteredClientSecretExpiresAt,
  oauthRegisteredTokenEndpointAuthMethod: client.oauthRegisteredTokenEndpointAuthMethod,
});

const withoutMcpTokens = (client: McpClient): McpClient => ({
  ...client,
  token: client.authType === 'oauth2' ? '' : client.token,
  oauthRefreshToken: '',
  oauthIdentityToken: '',
  oauthExpiresAt: 0,
  oauthRegisteredClientId: '',
  oauthRegisteredClientSecret: '',
  oauthRegisteredClientIdIssuedAt: 0,
  oauthRegisteredClientSecretExpiresAt: 0,
  oauthRegisteredTokenEndpointAuthMethod: 'none',
});

export const withoutOAuth2RuntimeCredentials = (workspace: Workspace): Workspace => ({
  ...workspace,
  collections: workspace.collections.map(withoutCollectionTokens),
  mcpClients: workspace.mcpClients.map(withoutMcpTokens),
});

export const mergeLocalOAuth2RuntimeCredentials = (local: Workspace, incoming: Workspace): Workspace => {
  const sanitizedIncoming = withoutOAuth2RuntimeCredentials(incoming);
  const localAuth = new Map<string, AuthConfig>();
  local.collections.forEach((collection) => {
    collection.requests.forEach((request) => localAuth.set(`${collection.id}:request:${request.id}`, request.auth));
    (collection.folders ?? []).forEach((folder) => { if (folder.auth) localAuth.set(`${collection.id}:folder:${folder.id}`, folder.auth); });
  });
  const localMcp = new Map(local.mcpClients.map((client) => [client.id, client]));
  const mergeAuth = (key: string, auth: AuthConfig) => {
    const localValue = localAuth.get(key);
    return auth.type === 'oauth2' && localValue?.type === 'oauth2'
      ? { ...auth, ...runtimeFields(localValue) }
      : auth;
  };
  return {
    ...sanitizedIncoming,
    mcpClients: sanitizedIncoming.mcpClients.map((client) => {
      const localValue = localMcp.get(client.id);
      return client.authType === 'oauth2' && localValue?.authType === 'oauth2'
        ? { ...client, ...mcpRuntimeFields(localValue) }
        : client;
    }),
    collections: sanitizedIncoming.collections.map((collection) => ({
      ...collection,
      requests: collection.requests.map((request) => ({ ...request, auth: mergeAuth(`${collection.id}:request:${request.id}`, request.auth) })),
      folders: (collection.folders ?? []).map((folder) => ({ ...folder, auth: folder.auth ? mergeAuth(`${collection.id}:folder:${folder.id}`, folder.auth) : undefined })),
    })),
  };
};
