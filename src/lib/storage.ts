import { invoke, isTauri } from '@tauri-apps/api/core';
import { cloneSeedWorkspace } from '../data/seed';
import type { AuditEvent, CollaborationConfig, GovernanceMember, GovernancePolicy, GovernanceRole, PluginPermission, PluginRecord, Workspace } from '../types';

const storageKey = 'brunomnia.workspace.v1';

const isWorkspaceEnvelope = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return candidate.format === 'brunomnia' && Array.isArray(candidate.collections);
};

const requestDefaults = () => cloneSeedWorkspace().collections[0].requests[0];

const knownPluginPermissions: PluginPermission[] = ['request:read', 'request:write', 'response:read', 'response:write', 'store', 'network', 'app:prompt', 'app:clipboard', 'template', 'action', 'theme'];
const governanceRoles: GovernanceRole[] = ['owner', 'admin', 'editor', 'viewer'];
const storageModes: GovernancePolicy['allowedStorage'] = ['local', 'folder', 'git', 'encrypted-file'];
const record = (value: unknown) => value && typeof value === 'object' ? value as Record<string, unknown> : undefined;

const normalizePlugins = (value: unknown): PluginRecord[] => !Array.isArray(value) ? [] : value.flatMap((item, index) => {
  if (!item || typeof item !== 'object') return [];
  const plugin = item as Record<string, unknown>;
  if (typeof plugin.source !== 'string' || !plugin.source.trim()) return [];
  const permissions = (candidate: unknown) => Array.isArray(candidate)
    ? knownPluginPermissions.filter((permission) => candidate.includes(permission))
    : [];
  return [{
    id: typeof plugin.id === 'string' && plugin.id ? plugin.id : `migrated-plugin-${index}`,
    name: typeof plugin.name === 'string' && plugin.name ? plugin.name : 'Local plugin',
    version: typeof plugin.version === 'string' && plugin.version ? plugin.version : '0.0.0-local',
    description: typeof plugin.description === 'string' ? plugin.description : '',
    source: plugin.source,
    sourcePath: typeof plugin.sourcePath === 'string' ? plugin.sourcePath : undefined,
    sourceFormat: plugin.sourceFormat === 'brunomnia' ? 'brunomnia' : 'insomnia-commonjs',
    enabled: plugin.enabled === true,
    requestedPermissions: permissions(plugin.requestedPermissions),
    grantedPermissions: permissions(plugin.grantedPermissions),
    installedAt: typeof plugin.installedAt === 'string' ? plugin.installedAt : new Date(0).toISOString(),
    error: typeof plugin.error === 'string' ? plugin.error : undefined,
  } satisfies PluginRecord];
});

const normalizeGovernance = (value: unknown, defaults: Workspace['governance']): Workspace['governance'] => {
  const source = record(value);
  const rawMembers = Array.isArray(source?.members) ? source.members : [];
  const members = rawMembers.flatMap((value, index): GovernanceMember[] => {
    const member = record(value);
    if (!member) return [];
    const role = governanceRoles.includes(member.role as GovernanceRole) ? member.role as GovernanceRole : 'viewer';
    return [{
      id: typeof member.id === 'string' && member.id ? member.id : `migrated-member-${index}`,
      name: typeof member.name === 'string' && member.name ? member.name : 'Imported member',
      email: typeof member.email === 'string' ? member.email : '',
      role,
      active: member.active !== false,
    }];
  });
  const safeMembers = members.length ? members : defaults.members;
  if (!safeMembers.some((member) => member.active && member.role === 'owner')) safeMembers[0] = { ...safeMembers[0], role: 'owner', active: true };
  const rawPolicy = record(source?.policy);
  const requestedStorage = Array.isArray(rawPolicy?.allowedStorage) ? rawPolicy.allowedStorage : [];
  const externalVaultAllowlist = Array.isArray(rawPolicy?.externalVaultAllowlist) ? rawPolicy.externalVaultAllowlist : [];
  const allowedStorage = requestedStorage.length
    ? storageModes.filter((mode) => requestedStorage.includes(mode))
    : defaults.policy.allowedStorage;
  const auditRetention = Math.min(10_000, Math.max(1, Number(rawPolicy?.auditRetention) || defaults.policy.auditRetention));
  const policy: GovernancePolicy = {
    allowedStorage: allowedStorage.length ? allowedStorage : defaults.policy.allowedStorage,
    requireEncryptedSync: rawPolicy?.requireEncryptedSync !== false,
    requireVaultForSecrets: rawPolicy?.requireVaultForSecrets !== false,
    externalVaultAllowlist: externalVaultAllowlist.filter((value): value is string => typeof value === 'string').slice(0, 1_000),
    auditRetention,
  };
  const audit = (Array.isArray(source?.audit) ? source.audit : []).flatMap((value): AuditEvent[] => {
    const event = record(value);
    if (!event || typeof event.action !== 'string' || typeof event.timestamp !== 'string') return [];
    return [{ id: typeof event.id === 'string' ? event.id : `audit-${crypto.randomUUID()}`, timestamp: event.timestamp, actorId: typeof event.actorId === 'string' ? event.actorId : safeMembers[0].id, action: event.action, detail: typeof event.detail === 'string' ? event.detail : '' }];
  }).slice(0, auditRetention);
  const requestedCurrent = typeof source?.currentMemberId === 'string' ? source.currentMemberId : '';
  const currentMemberId = safeMembers.some((member) => member.id === requestedCurrent && member.active) ? requestedCurrent : safeMembers.find((member) => member.active)?.id ?? safeMembers[0].id;
  return { currentMemberId, members: safeMembers, policy, audit };
};

const normalizeCollaboration = (value: unknown, defaults: CollaborationConfig): CollaborationConfig => {
  const source = record(value);
  return {
    mode: source?.mode === 'encrypted-file' ? 'encrypted-file' : 'off',
    path: typeof source?.path === 'string' ? source.path : defaults.path,
    actor: typeof source?.actor === 'string' ? source.actor : defaults.actor,
    revision: Math.max(0, Number(source?.revision) || 0),
    lastPulledAt: typeof source?.lastPulledAt === 'string' ? source.lastPulledAt : undefined,
    lastPushedAt: typeof source?.lastPushedAt === 'string' ? source.lastPushedAt : undefined,
  };
};

export const migrateWorkspace = (value: unknown): Workspace => {
  if (!isWorkspaceEnvelope(value)) throw new Error('This is not a Brunomnia workspace export.');
  const seed = cloneSeedWorkspace();
  const workspace = value as unknown as Omit<Workspace, 'version' | 'collections'> & {
    version?: number;
    collections: Array<{ requests: Array<Partial<Workspace['collections'][number]['requests'][number]>> } & Omit<Workspace['collections'][number], 'requests'>>;
  };
  const defaults = requestDefaults();
  const importedCollections = workspace.collections.map((collection) => ({
    ...collection,
    requests: collection.requests.map((request) => ({
      ...defaults,
      ...request,
      bodyMode: request.bodyMode ?? (request.method === 'GET' || request.method === 'HEAD' ? 'none' : 'json'),
      auth: { ...defaults.auth, ...request.auth },
      graphql: { ...defaults.graphql, ...request.graphql },
      grpc: { ...defaults.grpc, ...request.grpc },
      transport: { ...defaults.transport, ...request.transport },
      formBody: request.formBody ?? [],
      multipartBody: (request.multipartBody ?? []).map((part) => ({ ...part, contentType: part.contentType ?? part.file?.mimeType ?? '', fileName: part.fileName ?? part.file?.fileName ?? '' })),
    })),
  }));
  const collections = importedCollections.length ? importedCollections : seed.collections;
  const environments = Array.isArray(workspace.environments) && workspace.environments.length ? workspace.environments : seed.environments;
  const requestIds = new Set(collections.flatMap((collection) => collection.requests.map((request) => request.id)));
  const environmentIds = new Set(environments.map((environment) => environment.id));
  const governance = normalizeGovernance(workspace.governance, seed.governance);
  return {
    ...workspace,
    version: 7,
    name: workspace.name || 'Imported Workspace',
    activeRequestId: requestIds.has(workspace.activeRequestId) ? workspace.activeRequestId : collections[0]?.requests[0]?.id ?? '',
    activeEnvironmentId: environmentIds.has(workspace.activeEnvironmentId) ? workspace.activeEnvironmentId : environments[0].id,
    environments,
    history: Array.isArray(workspace.history) ? workspace.history : [],
    apiDesigns: (workspace.apiDesigns ?? seed.apiDesigns).map((design) => ({ ...design, ruleset: design.ruleset ?? '' })),
    mockServers: workspace.mockServers ?? seed.mockServers,
    runnerReports: workspace.runnerReports ?? [],
    imports: workspace.imports ?? [],
    cookies: workspace.cookies ?? [],
    responses: workspace.responses ?? [],
    project: { ...seed.project, ...workspace.project },
    plugins: normalizePlugins(workspace.plugins),
    pluginData: workspace.pluginData ?? {},
    activePluginTheme: workspace.activePluginTheme ?? '',
    collaboration: normalizeCollaboration(workspace.collaboration, seed.collaboration),
    governance,
    collections,
  } as Workspace;
};

export const secureImportedWorkspace = (value: unknown): Workspace => {
  const workspace = migrateWorkspace(value);
  return {
    ...workspace,
    plugins: workspace.plugins.map((plugin) => ({ ...plugin, enabled: false, grantedPermissions: [] })),
    pluginData: {},
    activePluginTheme: '',
  };
};

export const loadWorkspace = async (): Promise<Workspace> => {
  try {
    if (isTauri()) {
      const workspace = await invoke<unknown>('load_workspace');
      return isWorkspaceEnvelope(workspace) ? migrateWorkspace(workspace) : cloneSeedWorkspace();
    }
    const raw = localStorage.getItem(storageKey);
    if (!raw) return cloneSeedWorkspace();
    const workspace: unknown = JSON.parse(raw);
    return isWorkspaceEnvelope(workspace) ? migrateWorkspace(workspace) : cloneSeedWorkspace();
  } catch {
    return cloneSeedWorkspace();
  }
};

export const saveWorkspace = async (workspace: Workspace): Promise<void> => {
  if (isTauri()) {
    await invoke('save_workspace', { workspace });
    return;
  }
  localStorage.setItem(storageKey, JSON.stringify(workspace));
};

export const parseWorkspaceImport = (text: string): Workspace => {
  const parsed: unknown = JSON.parse(text);
  return secureImportedWorkspace(parsed);
};
