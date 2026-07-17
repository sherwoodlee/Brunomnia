import { invoke, isTauri } from '@tauri-apps/api/core';
import type { AuditEvent, Workspace } from '../types';
import { migrateWorkspace } from './storage';

export type VaultEntry = { id: string; name: string; value: string; updatedAt: string };
export type VaultSession = { unlocked: boolean; passphrase: string; entries: VaultEntry[] };
export type SecureFileStatus = { exists: boolean; updatedAt: string };
export type SyncPayload = { revision: number; actor: string; savedAt: string; workspace: unknown };
export type ExternalSecretInput = { provider: 'aws' | 'gcp' | 'azure' | 'hashicorp'; reference: string; scope?: string; field?: string; version?: string; cacheSeconds?: number };

const nativeOnly = () => {
  if (!isTauri()) throw new Error('Encrypted vault and sync files require the Tauri desktop app.');
};

export const vaultStatus = async () => {
  nativeOnly();
  return invoke<SecureFileStatus>('secure_vault_status');
};

export const unlockVault = async (passphrase: string) => {
  nativeOnly();
  return invoke<VaultEntry[]>('secure_vault_unlock', { passphrase });
};

export const saveVault = async (passphrase: string, entries: VaultEntry[]) => {
  nativeOnly();
  return invoke<SecureFileStatus>('secure_vault_save', { input: { passphrase, entries } });
};

export const resetVault = async () => {
  nativeOnly();
  return invoke<void>('secure_vault_reset');
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
export const isSensitiveSecretName = (value: string) => /(authorization|api[-_]?key|token|secret|password)/i.test(value);
const embeddedUrlCredential = /^[a-z][a-z0-9+.-]*:\/\/[^/\s:@]+:[^@\s]+@/i;
const sensitiveAuthFields = ['token', 'password', 'apiKeyValue', 'consumerSecret', 'tokenSecret', 'privateKey', 'clientSecret', 'accessToken', 'refreshToken', 'awsSecretAccessKey', 'awsSessionToken', 'hawkKey', 'asapPrivateKey', 'netrc'] as const;

export const plaintextSecretCandidates = (workspace: Workspace): string[] => {
  const candidates = workspace.environments.flatMap((environment) => environment.variables
    .filter((variable) => variable.value && sensitiveVariable.test(variable.name) && !isProtectedSecretReference(variable.value))
    .map((variable) => `Environment ${environment.name}: ${variable.name}`));
  workspace.collections.forEach((collection) => collection.requests.forEach((request) => {
    sensitiveAuthFields.forEach((field) => {
      const value = request.auth[field];
      if (typeof value === 'string' && value && !isProtectedSecretReference(value)) candidates.push(`${collection.name} / ${request.name}: auth.${field}`);
    });
    request.headers.filter((header) => header.value && isSensitiveSecretName(header.name) && !isProtectedSecretReference(header.value))
      .forEach((header) => candidates.push(`${collection.name} / ${request.name}: header ${header.name}`));
    request.params.filter((parameter) => parameter.value && isSensitiveSecretName(parameter.name) && !isProtectedSecretReference(parameter.value))
      .forEach((parameter) => candidates.push(`${collection.name} / ${request.name}: query ${parameter.name}`));
    if (embeddedUrlCredential.test(request.url) && !isProtectedSecretReference(request.url)) candidates.push(`${collection.name} / ${request.name}: URL credentials`);
    if (request.transport.clientKeyPem && !isProtectedSecretReference(request.transport.clientKeyPem)) candidates.push(`${collection.name} / ${request.name}: client private key`);
  }));
  workspace.mcpClients.forEach((client) => {
    if (client.token && !isProtectedSecretReference(client.token)) candidates.push(`MCP ${client.name}: bearer token`);
    if (client.password && !isProtectedSecretReference(client.password)) candidates.push(`MCP ${client.name}: password`);
    client.headers.filter((header) => header.value && isSensitiveSecretName(header.name) && !isProtectedSecretReference(header.value))
      .forEach((header) => candidates.push(`MCP ${client.name}: header ${header.name}`));
  });
  if (workspace.ai.apiKey && !isProtectedSecretReference(workspace.ai.apiKey)) candidates.push('AI provider: API key');
  if (workspace.konnect.token && !isProtectedSecretReference(workspace.konnect.token)) candidates.push('Konnect: access token');
  return candidates;
};

export const shareableWorkspace = (workspace: Workspace): Workspace => ({
  ...structuredClone(workspace),
  history: [],
  runnerReports: [],
  imports: [],
  cookies: [],
  responses: [],
  project: { mode: 'local', path: '', remoteUrl: '', remoteName: 'origin', authorName: '', authorEmail: '', autoSave: true },
  plugins: [],
  pluginData: {},
  activePluginTheme: '',
  ai: { ...workspace.ai, enabled: false, apiKey: '' },
  konnect: { ...workspace.konnect, enabled: false, token: '', controlPlanes: [], controlPlaneId: '' },
  collaboration: { ...workspace.collaboration, path: '' },
});

export const mergeSyncedWorkspace = (current: Workspace, payload: SyncPayload): Workspace => {
  const shared = migrateWorkspace(payload.workspace);
  const currentMemberId = shared.governance.members.some((member) => member.id === current.governance.currentMemberId)
    ? current.governance.currentMemberId
    : shared.governance.currentMemberId;
  return {
    ...shared,
    history: current.history,
    runnerReports: current.runnerReports,
    imports: current.imports,
    cookies: current.cookies,
    responses: current.responses,
    project: current.project,
    plugins: current.plugins,
    pluginData: current.pluginData,
    activePluginTheme: current.activePluginTheme,
    ai: current.ai,
    konnect: current.konnect,
    collaboration: { ...current.collaboration, mode: 'encrypted-file', revision: payload.revision, lastPulledAt: new Date().toISOString() },
    governance: { ...shared.governance, currentMemberId },
  };
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
