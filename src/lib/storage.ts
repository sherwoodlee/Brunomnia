import { invoke, isTauri } from '@tauri-apps/api/core';
import { cloneSeedWorkspace } from '../data/seed';
import type { AiSettings, AppPreferences, AuditEvent, AuthConfig, CollaborationConfig, Environment, GovernanceMember, GovernancePolicy, GovernanceRole, JsonValue, KeyValue, KonnectConfig, McpClient, McpPrompt, McpResource, McpTool, PluginPermission, PluginRecord, RequestFolder, ShortcutAction, StoredResponse, Workspace } from '../types';
import { normalizeGraphqlSchema } from './graphql';
import { defaultPreferences, defaultShortcuts, normalizeShortcut } from './preferences';
import { normalizeHttpMethod } from './request';

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
const stringValue = (value: unknown, fallback = '') => typeof value === 'string' ? value : fallback;
const normalizeRows = (value: unknown, prefix: string): KeyValue[] => !Array.isArray(value) ? [] : value.flatMap((item, index) => {
  const row = record(item);
  if (!row) return [];
  return [{ id: stringValue(row.id, `${prefix}-${index}`), name: stringValue(row.name), value: stringValue(row.value), enabled: row.enabled !== false, description: stringValue(row.description).slice(0, 20_000) }];
}).slice(0, 1_000);

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

const normalizeMcpResources = (value: unknown): McpResource[] => !Array.isArray(value) ? [] : value.flatMap((item): McpResource[] => {
  const resource = record(item);
  const uri = stringValue(resource?.uri);
  if (!resource || !uri) return [];
  return [{ uri, name: stringValue(resource.name, uri), description: stringValue(resource.description), mimeType: stringValue(resource.mimeType) }];
}).slice(0, 5_000);

const normalizeMcpClients = (value: unknown): McpClient[] => !Array.isArray(value) ? [] : value.flatMap((item, index): McpClient[] => {
  const client = record(item);
  if (!client) return [];
  const authType = client.authType === 'bearer' || client.authType === 'basic' ? client.authType : 'none';
  const tools = !Array.isArray(client.tools) ? [] : client.tools.flatMap((item): McpTool[] => {
    const tool = record(item);
    const name = stringValue(tool?.name);
    if (!tool || !name) return [];
    return [{ name, description: stringValue(tool.description), inputSchema: (tool.inputSchema ?? {}) as JsonValue }];
  }).slice(0, 5_000);
  const prompts = !Array.isArray(client.prompts) ? [] : client.prompts.flatMap((item): McpPrompt[] => {
    const prompt = record(item);
    const name = stringValue(prompt?.name);
    if (!prompt || !name) return [];
    const args = Array.isArray(prompt.arguments) ? prompt.arguments.flatMap((item): McpPrompt['arguments'] => {
      const argument = record(item);
      const argumentName = stringValue(argument?.name);
      return argument && argumentName ? [{ name: argumentName, description: stringValue(argument.description), required: argument.required === true }] : [];
    }).slice(0, 500) : [];
    return [{ name, description: stringValue(prompt.description), arguments: args }];
  }).slice(0, 5_000);
  return [{
    id: stringValue(client.id, `migrated-mcp-${index}`),
    name: stringValue(client.name, `MCP Client ${index + 1}`),
    enabled: client.enabled === true,
    transport: client.transport === 'stdio' ? 'stdio' : 'http',
    url: stringValue(client.url),
    command: stringValue(client.command),
    args: Array.isArray(client.args) ? client.args.filter((arg): arg is string => typeof arg === 'string').slice(0, 100) : [],
    headers: normalizeRows(client.headers, `mcp-${index}-header`),
    authType,
    token: stringValue(client.token),
    username: stringValue(client.username),
    password: stringValue(client.password),
    roots: Array.isArray(client.roots) ? client.roots.filter((root): root is string => typeof root === 'string').slice(0, 100) : [],
    tools,
    prompts,
    resources: normalizeMcpResources(client.resources),
    resourceTemplates: normalizeMcpResources(client.resourceTemplates),
    lastSyncedAt: typeof client.lastSyncedAt === 'string' ? client.lastSyncedAt : undefined,
  }];
}).slice(0, 100);

const normalizeAi = (value: unknown, defaults: AiSettings): AiSettings => {
  const source = record(value);
  const provider = source?.provider === 'openai' || source?.provider === 'anthropic' || source?.provider === 'gemini' || source?.provider === 'openai-compatible'
    ? source.provider
    : defaults.provider;
  return {
    enabled: source?.enabled === true,
    provider,
    baseUrl: stringValue(source?.baseUrl, defaults.baseUrl),
    model: stringValue(source?.model),
    apiKey: stringValue(source?.apiKey),
    mockGeneration: source?.mockGeneration === true,
    commitSuggestions: source?.commitSuggestions === true,
  };
};

const normalizeKonnect = (value: unknown, defaults: KonnectConfig): KonnectConfig => {
  const source = record(value);
  const controlPlanes = !Array.isArray(source?.controlPlanes) ? [] : source.controlPlanes.flatMap((item): KonnectConfig['controlPlanes'] => {
    const plane = record(item);
    const id = stringValue(plane?.id);
    return plane && id ? [{ id, name: stringValue(plane.name, id), description: stringValue(plane.description) }] : [];
  }).slice(0, 1_000);
  return {
    enabled: source?.enabled === true,
    baseUrl: stringValue(source?.baseUrl, defaults.baseUrl),
    token: stringValue(source?.token),
    controlPlaneId: stringValue(source?.controlPlaneId),
    controlPlanes,
    lastSyncedAt: typeof source?.lastSyncedAt === 'string' ? source.lastSyncedAt : undefined,
  };
};

const normalizePreferences = (value: unknown): AppPreferences => {
  const source = record(value);
  const rawShortcuts = record(source?.shortcuts);
  const shortcuts = Object.fromEntries((Object.keys(defaultShortcuts) as ShortcutAction[]).map((action) => {
    const candidate = typeof rawShortcuts?.[action] === 'string' ? normalizeShortcut(rawShortcuts[action].slice(0, 64)) : '';
    return [action, candidate || defaultShortcuts[action]];
  })) as AppPreferences['shortcuts'];
  return {
    theme: source?.theme === 'dark' || source?.theme === 'light' ? source.theme : 'system',
    density: source?.density === 'compact' ? 'compact' : 'comfortable',
    fontSize: Math.min(20, Math.max(11, Number(source?.fontSize) || defaultPreferences.fontSize)),
    preferredHttpVersion: source?.preferredHttpVersion === 'http1.0'
      || source?.preferredHttpVersion === 'http1.1'
      || source?.preferredHttpVersion === 'http2'
      || source?.preferredHttpVersion === 'http2-prior-knowledge'
      ? source.preferredHttpVersion
      : 'default',
    maxRedirects: typeof source?.maxRedirects === 'number' && Number.isFinite(source.maxRedirects)
      ? Math.max(-1, Math.trunc(source.maxRedirects))
      : defaultPreferences.maxRedirects,
    followRedirects: source?.followRedirects !== false,
    maxHistoryResponses: typeof source?.maxHistoryResponses === 'number' && Number.isFinite(source.maxHistoryResponses)
      ? Math.max(-1, Math.trunc(source.maxHistoryResponses))
      : defaultPreferences.maxHistoryResponses,
    filterResponsesByEnv: source?.filterResponsesByEnv === true,
    requestTimeoutMs: Math.min(600_000, Math.max(1_000, Number(source?.requestTimeoutMs) || defaultPreferences.requestTimeoutMs)),
    scriptTimeoutMs: Math.min(60_000, Math.max(1_000, Number(source?.scriptTimeoutMs) || defaultPreferences.scriptTimeoutMs)),
    allowScriptRequests: source?.allowScriptRequests === true,
    allowScriptFileAccess: source?.allowScriptFileAccess === true,
    enableVaultInScripts: source?.enableVaultInScripts === true,
    autoFetchGraphqlSchema: source?.autoFetchGraphqlSchema !== false,
    confirmDestructive: source?.confirmDestructive !== false,
    shortcuts,
  };
};

const normalizeStoredResponses = (value: unknown): StoredResponse[] => Array.isArray(value) ? value.flatMap((entry, index) => {
  const source = record(entry);
  if (!source) return [];
  return [{
    ...source,
    id: stringValue(source.id, `legacy-response-${index}`),
    requestId: stringValue(source.requestId),
    requestName: stringValue(source.requestName),
    requestUrl: stringValue(source.requestUrl),
    environmentId: stringValue(source.environmentId),
    receivedAt: stringValue(source.receivedAt, new Date(0).toISOString()),
  } as StoredResponse];
}) : [];

const normalizeFolders = (value: unknown, defaultAuth: AuthConfig): RequestFolder[] => {
  const source = !Array.isArray(value) ? [] : value.slice(0, 1_000);
  const folders = source.flatMap((item, index): RequestFolder[] => {
    const folder = record(item);
    if (!folder) return [];
    const id = stringValue(folder.id, `migrated-folder-${index}`);
    return [{
      id,
      name: stringValue(folder.name, `Folder ${index + 1}`),
      parentId: stringValue(folder.parentId),
      expanded: folder.expanded !== false,
      headers: normalizeRows(folder.headers, `${id}-header`),
      environment: normalizeRows(folder.environment, `${id}-environment`),
      auth: folder.auth ? { ...defaultAuth, ...record(folder.auth) } as AuthConfig : undefined,
      preRequestScript: stringValue(folder.preRequestScript),
      tests: stringValue(folder.tests),
      documentation: stringValue(folder.documentation),
    }];
  });
  const ids = new Set(folders.map((folder) => folder.id));
  const normalized = folders.map((folder) => ({ ...folder, parentId: folder.parentId !== folder.id && ids.has(folder.parentId) ? folder.parentId : '' }));
  const byId = new Map(normalized.map((folder) => [folder.id, folder]));
  normalized.forEach((folder) => {
    const visited = new Set([folder.id]);
    let current = folder;
    while (current.parentId) {
      if (visited.has(current.parentId)) {
        folder.parentId = '';
        break;
      }
      visited.add(current.parentId);
      const parent = byId.get(current.parentId);
      if (!parent) break;
      current = parent;
    }
  });
  return normalized;
};

const normalizeCollectionEnvironments = (value: unknown, collectionId: string) => !Array.isArray(value) ? [] : value.slice(0, 500).flatMap((item, index) => {
  const environment = record(item);
  if (!environment) return [];
  const id = stringValue(environment.id, `${collectionId}-sub-environment-${index}`);
  return [{
    id,
    name: stringValue(environment.name, `Environment ${index + 1}`),
    variables: normalizeRows(environment.variables, `${id}-variable`),
  }];
});

const normalizeEnvironments = (value: unknown, fallback: Environment[]): Environment[] => {
  if (!Array.isArray(value) || !value.length) return fallback;
  const environments = value.slice(0, 500).flatMap((item, index): Environment[] => {
    const environment = record(item);
    if (!environment) return [];
    const id = stringValue(environment.id, `migrated-environment-${index}`);
    const color = stringValue(environment.color);
    return [{ id, name: stringValue(environment.name, `Environment ${index + 1}`), variables: normalizeRows(environment.variables, `${id}-variable`), parentId: stringValue(environment.parentId), private: environment.private === true, color: /^#[0-9a-f]{6}$/i.test(color) ? color : '', source: environment.source as Environment['source'] }];
  });
  if (!environments.length) return fallback;
  const ids = new Set(environments.map((environment) => environment.id));
  const normalized = environments.map((environment) => ({ ...environment, parentId: environment.parentId !== environment.id && ids.has(environment.parentId ?? '') ? environment.parentId : '' }));
  const byId = new Map(normalized.map((environment) => [environment.id, environment]));
  normalized.forEach((environment) => {
    const visited = new Set([environment.id]);
    let current = environment;
    while (current.parentId) {
      if (visited.has(current.parentId)) {
        environment.parentId = '';
        break;
      }
      visited.add(current.parentId);
      const parent = byId.get(current.parentId);
      if (!parent) break;
      current = parent;
    }
  });
  for (let pass = 0; pass < normalized.length; pass += 1) {
    let changed = false;
    normalized.forEach((environment) => {
      const parent = environment.parentId ? byId.get(environment.parentId) : undefined;
      if (parent?.private && !environment.private) {
        environment.private = true;
        changed = true;
      }
    });
    if (!changed) break;
  }
  return normalized;
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
    folders: normalizeFolders(collection.folders, defaults.auth),
    environment: normalizeRows(collection.environment, `${collection.id}-environment`),
    subEnvironments: normalizeCollectionEnvironments(collection.subEnvironments, collection.id),
    activeSubEnvironmentId: stringValue(collection.activeSubEnvironmentId),
    documentation: stringValue(collection.documentation),
    requests: collection.requests.map((request) => {
      const graphql = record(request.graphql);
      const requestId = stringValue(request.id, `migrated-request-${crypto.randomUUID()}`);
      const method = normalizeHttpMethod(stringValue(request.method, defaults.method), defaults.method);
      const followRedirectsMode = request.transport?.followRedirectsMode === 'global'
        || request.transport?.followRedirectsMode === 'on'
        || request.transport?.followRedirectsMode === 'off'
        ? request.transport.followRedirectsMode
        : request.transport?.followRedirects === false ? 'off' : 'global';
      return {
        ...defaults,
        ...request,
        id: requestId,
        method,
        folderId: stringValue(request.folderId),
        inheritFolderAuth: request.inheritFolderAuth === true,
        documentation: stringValue(request.documentation),
        pathParams: normalizeRows(request.pathParams, `${requestId}-path`),
        params: normalizeRows(request.params, `${requestId}-query`),
        headers: normalizeRows(request.headers, `${requestId}-header`),
        bodyMode: request.bodyMode ?? (method === 'GET' || method === 'HEAD' ? 'none' : 'json'),
        auth: { ...defaults.auth, ...request.auth },
        graphql: {
          ...defaults.graphql,
          ...request.graphql,
          schema: normalizeGraphqlSchema(graphql?.schema),
          schemaEndpoint: stringValue(graphql?.schemaEndpoint),
          schemaFetchedAt: stringValue(graphql?.schemaFetchedAt),
        },
        grpc: { ...defaults.grpc, ...request.grpc, metadata: normalizeRows(record(request.grpc)?.metadata, `${requestId}-metadata`) },
        transport: {
          ...defaults.transport,
          ...request.transport,
          followRedirects: followRedirectsMode !== 'off',
          followRedirectsMode,
        },
        sse: {
          ...defaults.sse,
          ...request.sse,
          autoReconnect: request.sse?.autoReconnect !== false,
          reconnectDelayMs: Math.min(60_000, Math.max(100, Number(request.sse?.reconnectDelayMs) || defaults.sse.reconnectDelayMs)),
          maxReconnects: Math.min(1_000, Math.max(0, Number(request.sse?.maxReconnects) || 0)),
          respectServerRetry: request.sse?.respectServerRetry !== false,
          sendLastEventId: request.sse?.sendLastEventId !== false,
        },
        formBody: normalizeRows(request.formBody, `${requestId}-form`),
        multipartBody: (request.multipartBody ?? []).map((part) => ({ ...part, contentType: part.contentType ?? part.file?.mimeType ?? '', fileName: part.fileName ?? part.file?.fileName ?? '' })),
      };
    }),
  }));
  const collections = (importedCollections.length ? importedCollections : seed.collections).map((collection) => {
    const folderIds = new Set((collection.folders ?? []).map((folder) => folder.id));
    const resourceIds = new Set([...folderIds, ...collection.requests.map((request) => request.id)]);
    const orderedIds = Array.isArray(collection.resourceOrder) ? collection.resourceOrder : [];
    const seenResourceIds = new Set<string>();
    const resourceOrder = [
      ...orderedIds,
      ...(collection.folders ?? []).map((folder) => folder.id),
      ...collection.requests.map((request) => request.id),
    ].filter((id): id is string => typeof id === 'string' && resourceIds.has(id) && !seenResourceIds.has(id) && Boolean(seenResourceIds.add(id)));
    const subEnvironmentIds = new Set((collection.subEnvironments ?? []).map((environment) => environment.id));
    return {
      ...collection,
      resourceOrder,
      activeSubEnvironmentId: subEnvironmentIds.has(collection.activeSubEnvironmentId ?? '') ? collection.activeSubEnvironmentId : '',
      requests: collection.requests.map((request) => ({ ...request, folderId: request.folderId && folderIds.has(request.folderId) ? request.folderId : '' })),
    };
  });
  const environments = normalizeEnvironments(workspace.environments, seed.environments);
  const requestIds = new Set(collections.flatMap((collection) => collection.requests.map((request) => request.id)));
  const environmentIds = new Set(environments.map((environment) => environment.id));
  const governance = normalizeGovernance(workspace.governance, seed.governance);
  return {
    ...workspace,
    version: 14,
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
    responses: normalizeStoredResponses(workspace.responses),
    project: { ...seed.project, ...workspace.project },
    plugins: normalizePlugins(workspace.plugins),
    pluginData: workspace.pluginData ?? {},
    activePluginTheme: workspace.activePluginTheme ?? '',
    collaboration: normalizeCollaboration(workspace.collaboration, seed.collaboration),
    governance,
    mcpClients: normalizeMcpClients(workspace.mcpClients),
    ai: normalizeAi(workspace.ai, seed.ai),
    konnect: normalizeKonnect(workspace.konnect, seed.konnect),
    preferences: normalizePreferences(workspace.preferences),
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
    mcpClients: workspace.mcpClients.map((client) => ({ ...client, enabled: false, token: '', password: '' })),
    ai: { ...workspace.ai, enabled: false, apiKey: '', mockGeneration: false, commitSuggestions: false },
    konnect: { ...workspace.konnect, enabled: false, token: '' },
    preferences: structuredClone(defaultPreferences),
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
