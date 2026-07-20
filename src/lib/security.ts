import { invoke, isTauri } from '@tauri-apps/api/core';
import type { AuditEvent, Workspace } from '../types';
import { migrateWorkspace } from './storage';
import { defaultPreferences } from './preferences';
import { emptyWorkspaceCertificates } from './certificates';
import { mergeLocalOAuth2RuntimeCredentials, withoutOAuth2RuntimeCredentials } from './oauth2Tokens';
import { publicEnvironments } from './resources';

export type VaultEntry = { id: string; name: string; value: string; updatedAt: string };
export type VaultSession = { unlocked: boolean; passphrase: string; entries: VaultEntry[] };
export type SecureFileStatus = { exists: boolean; updatedAt: string };
export type SyncPayload = { revision: number; actor: string; savedAt: string; workspace: unknown };
export type ExternalSecretInput = { provider: 'aws' | 'gcp' | 'azure' | 'hashicorp'; reference: string; scope?: string; field?: string; version?: string; cacheSeconds?: number };

const nativeOnly = () => {
  if (!isTauri()) throw new Error('Encrypted vault and sync files require the Tauri desktop app.');
};

export const vaultStatus = async (workspaceId: string) => {
  nativeOnly();
  return invoke<SecureFileStatus>('secure_vault_status', { workspaceId });
};

export const unlockVault = async (workspaceId: string, passphrase: string) => {
  nativeOnly();
  return invoke<VaultEntry[]>('secure_vault_unlock', { workspaceId, passphrase });
};

export const saveVault = async (workspaceId: string, passphrase: string, entries: VaultEntry[]) => {
  nativeOnly();
  return invoke<SecureFileStatus>('secure_vault_save', { workspaceId, input: { passphrase, entries } });
};

export const resetVault = async (workspaceId: string) => {
  nativeOnly();
  return invoke<void>('secure_vault_reset', { workspaceId });
};

export const encryptedSyncStatus = async (path: string) => {
  nativeOnly();
  return invoke<SecureFileStatus>('secure_sync_status', { path });
};

export const pullEncryptedSync = async (path: string, passphrase: string) => {
  nativeOnly();
  return invoke<SyncPayload>('secure_sync_pull', { path, passphrase });
};

export const pushEncryptedSync = async (input: { path: string; passphrase: string; actor: string; baseRevision: number; force: boolean; workspace: Workspace }) => {
  nativeOnly();
  return invoke<SyncPayload>('secure_sync_push', { input });
};

export const resolveExternalSecret = async (input: ExternalSecretInput) => {
  nativeOnly();
  return invoke<string>('secure_external_secret', { input: { cacheSeconds: 1800, ...input } });
};

export const externalSecretReferenceKey = (input: ExternalSecretInput) => {
  const fields = [input.provider, input.reference, input.scope, input.field, input.version]
    .map((value) => encodeURIComponent(value?.trim() ?? ''));
  return `v1:${fields.join(':')}`;
};

export const resolveAuthorizedExternalSecret = async (workspace: Workspace, input: ExternalSecretInput) => {
  const key = externalSecretReferenceKey(input);
  if (!workspace.governance.policy.externalVaultAllowlist.includes(key)) throw new Error(`External vault reference '${key}' is not approved by workspace policy. Approve it in Security & Sync first.`);
  return resolveExternalSecret(input);
};

export const clearExternalSecretCache = async () => {
  nativeOnly();
  return invoke<void>('secure_external_cache_clear');
};

export const vaultVariables = (session: VaultSession) => session.unlocked
  ? Object.fromEntries(session.entries.map((entry) => [`vault.${entry.name}`, entry.value]))
  : {};

export const isProtectedSecretReference = (value: string) => /^\s*\{\{\s*vault\.[^{}]+\s*\}\}\s*$/.test(value)
  || /^\s*\{%\s*external\b[\s\S]*%\}\s*$/.test(value);
const sensitiveVariable = /(secret|password|token|api.?key|private.?key|client.?secret)/i;
export const isSensitiveSecretName = (value: string) => /(authorization|api[-_]?key|token|secret|password|private[-_]?key)/i.test(value);
const embeddedUrlCredential = /^[a-z][a-z0-9+.-]*:\/\/[^/\s:@]+:[^@\s]+@/i;
const sensitiveAuthFields = ['token', 'password', 'apiKeyValue', 'consumerSecret', 'tokenSecret', 'privateKey', 'clientSecret', 'code', 'codeVerifier', 'accessToken', 'identityToken', 'refreshToken', 'awsSecretAccessKey', 'awsSessionToken', 'hawkKey', 'asapPrivateKey', 'netrc'] as const;

export const plaintextSecretCandidates = (workspace: Workspace): string[] => {
  const candidates = publicEnvironments(workspace.environments).flatMap((environment) => environment.variables
    .filter((variable) => variable.value && sensitiveVariable.test(variable.name) && !isProtectedSecretReference(variable.value))
    .map((variable) => `Environment ${environment.name}: ${variable.name}`));
  const scanAuth = (label: string, auth: Workspace['collections'][number]['requests'][number]['auth']) => sensitiveAuthFields.forEach((field) => {
    const value = auth[field];
    if (typeof value === 'string' && value && !isProtectedSecretReference(value)) candidates.push(`${label}: auth.${field}`);
  });
  const scanRows = (label: string, kind: string, rows: Workspace['environments'][number]['variables']) => rows
    .filter((row) => row.value && (kind === 'variable' ? sensitiveVariable.test(row.name) : isSensitiveSecretName(row.name)) && !isProtectedSecretReference(row.value))
    .forEach((row) => candidates.push(`${label}: ${kind} ${row.name}`));
  workspace.collections.forEach((collection) => {
    scanRows(collection.name, 'variable', collection.environment ?? []);
    (collection.subEnvironments ?? []).forEach((environment) => scanRows(`${collection.name} / ${environment.name}`, 'variable', environment.variables));
    (collection.folders ?? []).forEach((folder) => {
      const label = `${collection.name} / ${folder.name}`;
      if (folder.auth) scanAuth(label, folder.auth);
      scanRows(label, 'header', folder.headers);
      scanRows(label, 'variable', folder.environment);
    });
    collection.requests.forEach((request) => {
      const label = `${collection.name} / ${request.name}`;
      scanAuth(label, request.auth);
      request.headers.filter((header) => header.value && isSensitiveSecretName(header.name) && !isProtectedSecretReference(header.value))
        .forEach((header) => candidates.push(`${label}: header ${header.name}`));
      request.params.filter((parameter) => parameter.value && isSensitiveSecretName(parameter.name) && !isProtectedSecretReference(parameter.value))
        .forEach((parameter) => candidates.push(`${label}: query ${parameter.name}`));
      if (embeddedUrlCredential.test(request.url) && !isProtectedSecretReference(request.url)) candidates.push(`${label}: URL credentials`);
      if (request.transport.clientKeyPem && !isProtectedSecretReference(request.transport.clientKeyPem)) candidates.push(`${label}: client private key`);
      if (request.transport.clientCertificatePfxBase64 && !isProtectedSecretReference(request.transport.clientCertificatePfxBase64)) candidates.push(`${label}: client PFX/PKCS#12 identity`);
      if (request.transport.clientCertificatePassphrase && !isProtectedSecretReference(request.transport.clientCertificatePassphrase)) candidates.push(`${label}: client-certificate passphrase`);
      if (request.grpc.reflectionApiKey && !isProtectedSecretReference(request.grpc.reflectionApiKey)) candidates.push(`${label}: Buf reflection API key`);
    });
  });
  workspace.mcpClients.forEach((client) => {
    if (client.authType === 'bearer' && client.token && !isProtectedSecretReference(client.token)) candidates.push(`MCP ${client.name}: bearer token`);
    if (client.authType === 'basic' && client.password && !isProtectedSecretReference(client.password)) candidates.push(`MCP ${client.name}: password`);
    if (client.authType === 'oauth2' && client.oauthClientSecret && !isProtectedSecretReference(client.oauthClientSecret)) candidates.push(`MCP ${client.name}: OAuth client secret`);
    client.headers.filter((header) => header.value && isSensitiveSecretName(header.name) && !isProtectedSecretReference(header.value))
      .forEach((header) => candidates.push(`MCP ${client.name}: header ${header.name}`));
    client.env.filter((variable) => variable.value && isSensitiveSecretName(variable.name) && !isProtectedSecretReference(variable.value))
      .forEach((variable) => candidates.push(`MCP ${client.name}: environment ${variable.name}`));
  });
  if (workspace.ai.apiKey && !isProtectedSecretReference(workspace.ai.apiKey)) candidates.push('AI provider: API key');
  if (workspace.konnect.token && !isProtectedSecretReference(workspace.konnect.token)) candidates.push('Konnect: access token');
  return candidates;
};

export const shareableWorkspace = (workspace: Workspace): Workspace => {
  const environments = publicEnvironments(workspace.environments);
  return withoutOAuth2RuntimeCredentials({
    ...structuredClone(workspace),
    environments,
    activeEnvironmentId: environments.some((environment) => environment.id === workspace.activeEnvironmentId) ? workspace.activeEnvironmentId : environments[0]?.id ?? '',
    history: [],
    runnerReports: [],
    unitTestResults: [],
    imports: [],
    cookies: [],
    fileState: {},
    responses: [],
    streamSessions: [],
    mcpSessions: [],
    certificates: emptyWorkspaceCertificates(),
    project: { mode: 'local', path: '', remoteUrl: '', remoteName: 'origin', authorName: '', authorEmail: '', autoSave: true },
    plugins: [],
    pluginData: {},
    activePluginTheme: '',
    ai: { ...workspace.ai, enabled: false, apiKey: '' },
    konnect: { ...workspace.konnect, enabled: false, token: '', controlPlanes: [], controlPlaneId: '', managedByWorkspaceId: undefined, managedControlPlaneId: undefined, managedRegion: undefined, managedClusterType: undefined, managedDeploymentType: undefined },
    preferences: structuredClone(defaultPreferences),
    collaboration: { ...workspace.collaboration, path: '' },
  });
};

export const mergeSyncedWorkspace = (current: Workspace, payload: SyncPayload): Workspace => {
  const shared = migrateWorkspace(payload.workspace);
  const currentPublicIds = new Set(publicEnvironments(current.environments).map((environment) => environment.id));
  const privateEnvironments = current.environments.filter((environment) => !currentPublicIds.has(environment.id));
  const privateIds = new Set(privateEnvironments.map((environment) => environment.id));
  const sharedEnvironments = publicEnvironments(shared.environments).filter((environment) => !privateIds.has(environment.id));
  const currentMemberId = shared.governance.members.some((member) => member.id === current.governance.currentMemberId)
    ? current.governance.currentMemberId
    : shared.governance.currentMemberId;
  return mergeLocalOAuth2RuntimeCredentials(current, {
    ...shared,
    environments: [...sharedEnvironments, ...privateEnvironments],
    activeEnvironmentId: privateEnvironments.some((environment) => environment.id === current.activeEnvironmentId) ? current.activeEnvironmentId : sharedEnvironments.some((environment) => environment.id === shared.activeEnvironmentId) ? shared.activeEnvironmentId : sharedEnvironments[0]?.id ?? privateEnvironments[0]?.id ?? '',
    history: current.history,
    runnerReports: current.runnerReports,
    unitTestResults: current.unitTestResults,
    imports: current.imports,
    cookies: [],
    fileState: current.fileState,
    responses: current.responses,
    streamSessions: current.streamSessions,
    mcpSessions: current.mcpSessions,
    certificates: emptyWorkspaceCertificates(),
    project: current.project,
    plugins: current.plugins,
    pluginData: current.pluginData,
    activePluginTheme: current.activePluginTheme,
    ai: current.ai,
    konnect: current.konnect,
    preferences: current.preferences,
    collaboration: { ...current.collaboration, mode: 'encrypted-file', revision: payload.revision, lastPulledAt: new Date().toISOString() },
    governance: { ...shared.governance, currentMemberId },
  });
};

export const appendAudit = (workspace: Workspace, action: string, detail: string): Workspace => {
  const event: AuditEvent = {
    id: `audit-${crypto.randomUUID()}`,
    timestamp: new Date().toISOString(),
    actorId: workspace.governance.currentMemberId,
    action,
    detail,
  };
  const retention = Math.min(10_000, Math.max(1, workspace.governance.policy.auditRetention || 500));
  return { ...workspace, governance: { ...workspace.governance, audit: [event, ...workspace.governance.audit].slice(0, retention) } };
};
