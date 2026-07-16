import { invoke, isTauri } from '@tauri-apps/api/core';
import { cloneSeedWorkspace } from '../data/seed';
import type { PluginPermission, PluginRecord, Workspace } from '../types';

const storageKey = 'brunomnia.workspace.v1';

const isWorkspaceEnvelope = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return candidate.format === 'brunomnia' && Array.isArray(candidate.collections);
};

const requestDefaults = () => cloneSeedWorkspace().collections[0].requests[0];

const knownPluginPermissions: PluginPermission[] = ['request:read', 'request:write', 'response:read', 'response:write', 'store', 'network', 'app:prompt', 'app:clipboard', 'template', 'action', 'theme'];

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
  return {
    ...workspace,
    version: 6,
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
