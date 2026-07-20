import { invoke, isTauri } from '@tauri-apps/api/core';
import { cloneSeedWorkspace } from '../data/seed';
import type { AiSettings, ApiRequest, AppPreferences, AuditEvent, AuthConfig, CollaborationConfig, Environment, GovernanceMember, GovernancePolicy, GovernanceRole, JsonValue, KeyValue, KonnectConfig, McpClient, McpPrompt, McpResource, McpTool, PluginPermission, PluginRecord, RequestFolder, ResponseTimelineEntry, ScriptTestResult, ShortcutAction, StoredResponse, StoredStreamSession, StreamMessage, Workspace } from '../types';
import { normalizeGraphqlSchema } from './graphqlSchema';
import { normalizeGrpcProtoTree } from './grpcProto';
import { normalizeCertificatePassphrase, normalizeCertificatePfxBase64, normalizeWorkspaceCertificates } from './certificates';
import { defaultPreferences, defaultShortcuts, normalizeShortcut } from './preferences';
import { normalizeHttpMethod } from './request';
import { normalizeMcpHistorySessions } from './mcpHistory';

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
const environmentEditorMode = (value: unknown) => value === 'raw' ? 'raw' as const : 'table' as const;
const normalizeRows = (value: unknown, prefix: string): KeyValue[] => !Array.isArray(value) ? [] : value.flatMap((item, index) => {
  const row = record(item);
  if (!row) return [];
  const valueType = row.valueType === 'json' ? 'json' as const : 'string' as const;
  return [{ id: stringValue(row.id, `${prefix}-${index}`), name: stringValue(row.name), value: stringValue(row.value), enabled: row.enabled !== false, description: stringValue(row.description).slice(0, 20_000), ...(row.multiline === true ? { multiline: true } : {}), ...(valueType === 'json' ? { valueType } : {}) }];
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
  const uriTemplate = stringValue(resource?.uriTemplate);
  const uri = stringValue(resource?.uri, uriTemplate);
  if (!resource || !uri) return [];
  let variables: string[] = [];
  if (uriTemplate) {
    variables = [...uriTemplate.matchAll(/\{[+#./;?&]?([^{}]+)\}/g)]
      .flatMap((match) => match[1].split(',').map((name) => name.replace(/\*$/, '').replace(/:\d+$/, '')))
      .filter((name, index, all) => Boolean(name) && all.indexOf(name) === index)
      .slice(0, 100);
  }
  return [{ uri, uriTemplate, variables, name: stringValue(resource.name, uri), description: stringValue(resource.description), mimeType: stringValue(resource.mimeType) }];
}).slice(0, 5_000);

const normalizeMcpClients = (value: unknown): McpClient[] => !Array.isArray(value) ? [] : value.flatMap((item, index): McpClient[] => {
  const client = record(item);
  if (!client) return [];
  const authType = client.authType === 'bearer' || client.authType === 'basic' || client.authType === 'oauth2' ? client.authType : 'none';
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
    env: normalizeRows(client.env, `mcp-${index}-environment`).slice(0, 100),
    headers: normalizeRows(client.headers, `mcp-${index}-header`),
    authType,
    token: stringValue(client.token),
    username: stringValue(client.username),
    password: stringValue(client.password),
    oauthAuthorizationUrl: stringValue(client.oauthAuthorizationUrl),
    oauthAccessTokenUrl: stringValue(client.oauthAccessTokenUrl),
    oauthClientId: stringValue(client.oauthClientId),
    oauthClientSecret: stringValue(client.oauthClientSecret),
    oauthScope: stringValue(client.oauthScope),
    oauthState: stringValue(client.oauthState),
    oauthRefreshToken: stringValue(client.oauthRefreshToken),
    oauthIdentityToken: stringValue(client.oauthIdentityToken),
    oauthExpiresAt: typeof client.oauthExpiresAt === 'number' && Number.isFinite(client.oauthExpiresAt) ? Math.max(0, Math.trunc(client.oauthExpiresAt)) : 0,
    oauthTokenPrefix: stringValue(client.oauthTokenPrefix, 'Bearer'),
    oauthRegisteredClientId: stringValue(client.oauthRegisteredClientId),
    oauthRegisteredClientSecret: stringValue(client.oauthRegisteredClientSecret),
    oauthRegisteredClientIdIssuedAt: typeof client.oauthRegisteredClientIdIssuedAt === 'number' && Number.isFinite(client.oauthRegisteredClientIdIssuedAt) ? Math.max(0, Math.trunc(client.oauthRegisteredClientIdIssuedAt)) : 0,
    oauthRegisteredClientSecretExpiresAt: typeof client.oauthRegisteredClientSecretExpiresAt === 'number' && Number.isFinite(client.oauthRegisteredClientSecretExpiresAt) ? Math.max(0, Math.trunc(client.oauthRegisteredClientSecretExpiresAt)) : 0,
    oauthRegisteredTokenEndpointAuthMethod: client.oauthRegisteredTokenEndpointAuthMethod === 'client_secret_basic' || client.oauthRegisteredTokenEndpointAuthMethod === 'client_secret_post' ? client.oauthRegisteredTokenEndpointAuthMethod : 'none',
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

const validKonnectProxyHost = (host: string) => {
  if (!host || /[\s\\/@?#]|{{|{%/.test(host)) return false;
  const authority = host.includes(':') && !(host.startsWith('[') && host.endsWith(']')) ? `[${host}]` : host;
  try {
    const parsed = new URL(`http://${authority}`);
    return Boolean(parsed.hostname) && !parsed.username && !parsed.password && parsed.pathname === '/' && !parsed.search && !parsed.hash;
  } catch {
    return false;
  }
};

const normalizeKonnect = (value: unknown, defaults: KonnectConfig): KonnectConfig => {
  const source = record(value);
  const controlPlanes = !Array.isArray(source?.controlPlanes) ? [] : source.controlPlanes.flatMap((item): KonnectConfig['controlPlanes'] => {
    const plane = record(item);
    const id = stringValue(plane?.id);
    if (!plane || !id) return [];
    const rawProxyUrls = Array.isArray(plane.proxyUrls) ? plane.proxyUrls : Array.isArray(plane.proxy_urls) ? plane.proxy_urls : [];
    const proxyUrls = rawProxyUrls.flatMap((item): KonnectConfig['controlPlanes'][number]['proxyUrls'] => {
      const proxy = record(item);
      const host = stringValue(proxy?.host).trim().slice(0, 1_000);
      const port = Number(proxy?.port);
      const protocol = stringValue(proxy?.protocol).toLowerCase();
      if (!validKonnectProxyHost(host) || !Number.isInteger(port) || port < 1 || port > 65_535 || !['http', 'https', 'ws', 'wss', 'grpc', 'grpcs'].includes(protocol)) return [];
      return [{ host, port, protocol: protocol as KonnectConfig['controlPlanes'][number]['proxyUrls'][number]['protocol'] }];
    }).slice(0, 100);
    return [{ id, name: stringValue(plane.name, id).slice(0, 500), description: stringValue(plane.description).slice(0, 20_000), proxyUrls }];
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
    fontSize: Math.min(24, Math.max(8, Number(source?.fontSize) || defaultPreferences.fontSize)),
    interfaceFontSize: Math.min(24, Math.max(8, Number(source?.interfaceFontSize) || defaultPreferences.interfaceFontSize)),
    fontInterface: stringValue(source?.fontInterface).replace(/[\r\n]/g, ' ').slice(0, 512),
    fontMonospace: stringValue(source?.fontMonospace).replace(/[\r\n]/g, ' ').slice(0, 512),
    showPasswords: source?.showPasswords === true,
    allowHtmlPreviewRemoteResources: source?.allowHtmlPreviewRemoteResources === true,
    allowHtmlPreviewScripts: source?.allowHtmlPreviewScripts === true,
    disableResponsePreviewLinks: source?.disableResponsePreviewLinks === true,
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
    maxTimelineDataSizeKB: typeof source?.maxTimelineDataSizeKB === 'number' && Number.isFinite(source.maxTimelineDataSizeKB)
      ? Math.max(0, Math.trunc(source.maxTimelineDataSizeKB))
      : defaultPreferences.maxTimelineDataSizeKB,
    maxHistoryResponses: typeof source?.maxHistoryResponses === 'number' && Number.isFinite(source.maxHistoryResponses)
      ? Math.max(-1, Math.trunc(source.maxHistoryResponses))
      : defaultPreferences.maxHistoryResponses,
    filterResponsesByEnv: source?.filterResponsesByEnv === true,
    requestTimeoutMs: typeof source?.requestTimeoutMs === 'number' && Number.isFinite(source.requestTimeoutMs)
      ? Math.min(2_147_483_647, Math.max(0, Math.trunc(source.requestTimeoutMs)))
      : defaultPreferences.requestTimeoutMs,
    validateCertificates: source?.validateCertificates !== false,
    validateAuthCertificates: source?.validateAuthCertificates !== false,
    proxyEnabled: source?.proxyEnabled === true,
    httpProxy: stringValue(source?.httpProxy).slice(0, 4_096),
    httpsProxy: stringValue(source?.httpsProxy).slice(0, 4_096),
    noProxy: stringValue(source?.noProxy).slice(0, 20_000),
    useBulkHeaderEditor: source?.useBulkHeaderEditor === true,
    useBulkParametersEditor: source?.useBulkParametersEditor === true,
    forceVerticalLayout: source?.forceVerticalLayout === true,
    editorIndentWithTabs: source?.editorIndentWithTabs !== false,
    editorIndentSize: Math.min(16, Math.max(1, Math.trunc(Number(source?.editorIndentSize) || defaultPreferences.editorIndentSize))),
    editorLineWrapping: source?.editorLineWrapping !== false,
    fontVariantLigatures: source?.fontVariantLigatures === true,
    scriptTimeoutMs: Math.min(60_000, Math.max(1_000, Number(source?.scriptTimeoutMs) || defaultPreferences.scriptTimeoutMs)),
    allowScriptRequests: source?.allowScriptRequests === true,
    allowScriptFileAccess: source?.allowScriptFileAccess === true,
    dataFolders: Array.isArray(source?.dataFolders)
      ? [...new Set(source.dataFolders
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.trim().slice(0, 4_096))
        .filter(Boolean))].slice(0, 100)
      : [],
    enableVaultInScripts: source?.enableVaultInScripts === true,
    autoFetchGraphqlSchema: source?.autoFetchGraphqlSchema !== false,
    confirmDestructive: source?.confirmDestructive !== false,
    shortcuts,
  };
};

const responseTimelineNames = new Set<ResponseTimelineEntry['name']>(['HeaderIn', 'DataIn', 'SslDataIn', 'HeaderOut', 'DataOut', 'SslDataOut', 'Text']);
const normalizeResponseTimeline = (value: unknown): ResponseTimelineEntry[] => !Array.isArray(value) ? [] : value.slice(0, 1_000).flatMap((entry): ResponseTimelineEntry[] => {
  const source = record(entry);
  if (!source) return [];
  const name = responseTimelineNames.has(source.name as ResponseTimelineEntry['name']) ? source.name as ResponseTimelineEntry['name'] : 'Text';
  const elapsedMs = Number(source.elapsedMs);
  return [{
    name,
    value: stringValue(source.value),
    elapsedMs: Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0,
    ...(source.hidden === true ? { hidden: true } : {}),
  }];
});

const normalizeResponseTestResults = (value: unknown): ScriptTestResult[] => !Array.isArray(value) ? [] : value.slice(0, 1_000).flatMap((entry): ScriptTestResult[] => {
  const source = record(entry);
  if (!source) return [];
  const status = source.status === 'passed' || source.status === 'failed' || source.status === 'skipped' ? source.status : source.passed === true ? 'passed' : 'failed';
  const category = source.category === 'pre-request' || source.category === 'after-response' ? source.category : 'unknown';
  const duration = typeof source.durationMs === 'number' ? source.durationMs : Number.NaN;
  const error = stringValue(source.error).slice(0, 20_000);
  return [{
    name: stringValue(source.name, 'Unnamed test').slice(0, 2_000),
    passed: status === 'passed',
    status,
    category,
    ...(Number.isFinite(duration) ? { durationMs: Math.min(2_147_483_647, Math.max(0, duration)) } : {}),
    ...(error ? { error } : {}),
  }];
});

const normalizeStoredResponses = (value: unknown): StoredResponse[] => Array.isArray(value) ? value.flatMap((entry, index) => {
  const source = record(entry);
  if (!source) return [];
  const { bodyBase64: encodedBody, ...response } = source;
  const bodyBase64 = typeof encodedBody === 'string' && encodedBody.length ? encodedBody : undefined;
  return [{
    ...response,
    id: stringValue(source.id, `legacy-response-${index}`),
    requestId: stringValue(source.requestId),
    requestName: stringValue(source.requestName),
    requestUrl: stringValue(source.requestUrl),
    environmentId: stringValue(source.environmentId),
    receivedAt: stringValue(source.receivedAt, new Date(0).toISOString()),
    body: stringValue(source.body),
    ...(bodyBase64 ? { bodyBase64 } : {}),
    timeline: normalizeResponseTimeline(source.timeline),
    requestTestResults: normalizeResponseTestResults(source.requestTestResults),
    ...(typeof source.settingSendCookies === 'boolean' ? { settingSendCookies: source.settingSendCookies } : {}),
    ...(typeof source.settingStoreCookies === 'boolean' ? { settingStoreCookies: source.settingStoreCookies } : {}),
    ...(typeof source.globalEnvironmentId === 'string' ? { globalEnvironmentId: source.globalEnvironmentId.slice(0, 500) } : {}),
    ...(typeof source.collectionEnvironmentId === 'string' ? { collectionEnvironmentId: source.collectionEnvironmentId.slice(0, 500) } : {}),
  } as StoredResponse];
}) : [];

const normalizeStreamMessages = (value: unknown, sessionId: string): StreamMessage[] => {
  const messages = (Array.isArray(value) ? value : []).slice(-5_000).flatMap((entry, index): StreamMessage[] => {
    const source = record(entry);
    if (!source) return [];
    const direction = source.direction === 'incoming' || source.direction === 'outgoing' ? source.direction : 'system';
    return [{
      id: stringValue(source.id, `${sessionId}-event-${index}`),
      sessionId,
      direction,
      kind: stringValue(source.kind, 'event').slice(0, 500),
      text: stringValue(source.text).slice(0, 1_048_576),
      timestamp: stringValue(source.timestamp, new Date(0).toISOString()),
    }];
  });
  let characters = messages.reduce((total, message) => total + message.text.length, 0);
  while (messages.length > 1 && characters > 5_000_000) characters -= messages.shift()!.text.length;
  return messages;
};

const normalizeStreamHeaders = (value: unknown) => {
  const source = record(value);
  if (!source) return undefined;
  return Object.fromEntries(Object.entries(source).slice(0, 500).map(([name, headerValue]) => [name.slice(0, 8_192), stringValue(headerValue).slice(0, 65_536)]));
};

const normalizeStoredStreamSessions = (value: unknown, requestIds: Set<string>): StoredStreamSession[] => (Array.isArray(value) ? value : []).slice(0, 5_000).flatMap((entry, index): StoredStreamSession[] => {
  const source = record(entry);
  if (!source) return [];
  const requestId = stringValue(source.requestId);
  if (!requestIds.has(requestId)) return [];
  const protocol = source.protocol === 'graphql' || source.protocol === 'websocket' || source.protocol === 'sse' ? source.protocol : 'socketio';
  const id = stringValue(source.id, `legacy-stream-${index}`);
  const endedAt = stringValue(source.endedAt);
  const requestSnapshot = record(source.requestSnapshot);
  const status = typeof source.status === 'number' && Number.isFinite(source.status) ? Math.min(999, Math.max(0, Math.trunc(source.status))) : undefined;
  const durationMs = typeof source.durationMs === 'number' && Number.isFinite(source.durationMs) ? Math.max(0, Math.trunc(source.durationMs)) : undefined;
  const headers = normalizeStreamHeaders(source.headers);
  return [{
    id,
    requestId,
    requestName: stringValue(source.requestName),
    requestUrl: stringValue(source.requestUrl),
    environmentId: stringValue(source.environmentId),
    protocol,
    startedAt: stringValue(source.startedAt, new Date(0).toISOString()),
    ...(endedAt ? { endedAt } : {}),
    messages: normalizeStreamMessages(source.messages, id),
    ...(requestSnapshot?.id === requestId ? { requestSnapshot: structuredClone(requestSnapshot) as ApiRequest } : {}),
    ...(status !== undefined ? { status } : {}),
    ...(typeof source.statusText === 'string' ? { statusText: source.statusText.slice(0, 500) } : {}),
    ...(headers ? { headers } : {}),
    ...(typeof source.httpVersion === 'string' ? { httpVersion: source.httpVersion.slice(0, 100) } : {}),
    ...(durationMs !== undefined ? { durationMs } : {}),
    ...(typeof source.transport === 'string' ? { transport: source.transport.slice(0, 200) } : {}),
    ...(Array.isArray(source.timeline) ? { timeline: normalizeResponseTimeline(source.timeline) } : {}),
  }];
});

const normalizeResponseFilters = (value: unknown, requestIds: Set<string>) => {
  const source = record(value);
  if (!source) return {};
  return Object.fromEntries(Object.entries(source).flatMap(([requestId, entry]) => {
    if (!requestIds.has(requestId)) return [];
    const state = record(entry);
    const filter = stringValue(state?.filter).trim().slice(0, 2_000);
    const previewMode = state?.previewMode === 'friendly' || state?.previewMode === 'raw' ? state.previewMode : 'source';
    const seen = new Set<string>();
    const history = (Array.isArray(state?.history) ? state.history : []).flatMap((candidate): string[] => {
      const normalized = stringValue(candidate).trim().slice(0, 2_000);
      return normalized && !seen.has(normalized) && Boolean(seen.add(normalized)) ? [normalized] : [];
    }).slice(0, 10);
    return [[requestId, { filter, history, previewMode }]];
  }));
};

const normalizeFolders = (value: unknown, defaultAuth: AuthConfig): RequestFolder[] => {
  const source = !Array.isArray(value) ? [] : value.slice(0, 1_000);
  const folders = source.flatMap((item, index): RequestFolder[] => {
    const folder = record(item);
    if (!folder) return [];
    const id = stringValue(folder.id, `migrated-folder-${index}`);
    const folderSource = record(folder.source);
    const source = folderSource && stringValue(folderSource.format) ? {
      format: stringValue(folderSource.format).slice(0, 200),
      sourceId: stringValue(folderSource.sourceId).slice(0, 10_000) || undefined,
    } : undefined;
    return [{
      id,
      name: stringValue(folder.name, `Folder ${index + 1}`),
      parentId: stringValue(folder.parentId),
      expanded: folder.expanded !== false,
      headers: normalizeRows(folder.headers, `${id}-header`),
      environment: normalizeRows(folder.environment, `${id}-environment`),
      environmentEditorMode: environmentEditorMode(folder.environmentEditorMode),
      auth: folder.auth ? { ...defaultAuth, ...record(folder.auth) } as AuthConfig : undefined,
      preRequestScript: stringValue(folder.preRequestScript),
      tests: stringValue(folder.tests),
      documentation: stringValue(folder.documentation),
      source,
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
    environmentEditorMode: environmentEditorMode(environment.environmentEditorMode),
  }];
});

const normalizeEnvironments = (value: unknown, fallback: Environment[]): Environment[] => {
  if (!Array.isArray(value) || !value.length) return fallback;
  const environments = value.slice(0, 500).flatMap((item, index): Environment[] => {
    const environment = record(item);
    if (!environment) return [];
    const id = stringValue(environment.id, `migrated-environment-${index}`);
    const color = stringValue(environment.color);
    return [{ id, name: stringValue(environment.name, `Environment ${index + 1}`), variables: normalizeRows(environment.variables, `${id}-variable`), environmentEditorMode: environmentEditorMode(environment.environmentEditorMode), parentId: stringValue(environment.parentId), private: environment.private === true, color: /^#[0-9a-f]{6}$/i.test(color) ? color : '', source: environment.source as Environment['source'] }];
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

const normalizeTestSuites = (value: unknown, collections: Workspace['collections'], requestIds: Set<string>): Workspace['testSuites'] => {
  if (!Array.isArray(value)) return [];
  const suiteIds = new Set<string>();
  const testIds = new Set<string>();
  const collectionIds = new Set(collections.map((collection) => collection.id));
  const requestCollectionIds = new Map(collections.flatMap((collection) => collection.requests.map((request) => [request.id, collection.id] as const)));
  return value.slice(0, 500).flatMap((item, suiteIndex): Workspace['testSuites'] => {
    const suite = record(item);
    if (!suite) return [];
    const id = stringValue(suite.id, `migrated-test-suite-${suiteIndex}`).slice(0, 500);
    if (!id || suiteIds.has(id) || requestIds.has(id)) return [];
    suiteIds.add(id);
    const rawTests = Array.isArray(suite.tests) ? suite.tests : [];
    const requestedCollectionId = stringValue(suite.collectionId).slice(0, 500);
    const inferredCollectionId = rawTests.flatMap((testValue) => {
      const test = record(testValue);
      const collectionId = requestCollectionIds.get(stringValue(test?.requestId));
      return collectionId ? [collectionId] : [];
    })[0];
    const collectionId = collectionIds.has(requestedCollectionId) ? requestedCollectionId : inferredCollectionId ?? collections[0]?.id;
    if (!collectionId) return [];
    const tests = rawTests.slice(0, 1_000).flatMap((testValue, testIndex) => {
      const test = record(testValue);
      if (!test) return [];
      const testId = stringValue(test.id, `${id}-test-${testIndex}`).slice(0, 500);
      if (!testId || testIds.has(testId)) return [];
      testIds.add(testId);
      const requestId = stringValue(test.requestId).slice(0, 500);
      return [{
        id: testId,
        name: stringValue(test.name, `Test ${testIndex + 1}`).slice(0, 2_000),
        code: stringValue(test.code).slice(0, 1_000_000),
        requestId: requestCollectionIds.get(requestId) === collectionId ? requestId : null,
        sortKey: typeof test.sortKey === 'number' && Number.isFinite(test.sortKey) ? test.sortKey : testIndex,
      }];
    }).sort((left, right) => left.sortKey - right.sortKey);
    return [{
      id,
      name: stringValue(suite.name, `Suite ${suiteIndex + 1}`).slice(0, 2_000),
      collectionId,
      sortKey: typeof suite.sortKey === 'number' && Number.isFinite(suite.sortKey) ? suite.sortKey : suiteIndex,
      tests,
    }];
  }).sort((left, right) => left.sortKey - right.sortKey);
};

const normalizeUnitTestResults = (value: unknown, suiteIds: Set<string>): Workspace['unitTestResults'] => {
  if (!Array.isArray(value)) return [];
  const resultIds = new Set<string>();
  return value.slice(0, 100).flatMap((item, resultIndex): Workspace['unitTestResults'] => {
    const result = record(item);
    if (!result) return [];
    const suiteId = stringValue(result.suiteId).slice(0, 500);
    const id = stringValue(result.id, `migrated-unit-test-result-${resultIndex}`).slice(0, 500);
    if (!id || resultIds.has(id) || !suiteIds.has(suiteId)) return [];
    resultIds.add(id);
    const tests = (Array.isArray(result.tests) ? result.tests : []).slice(0, 1_000).flatMap((testValue, testIndex) => {
      const test = record(testValue);
      if (!test) return [];
      const requestId = stringValue(test.requestId).slice(0, 500);
      const error = stringValue(test.error).slice(0, 20_000);
      return [{
        testId: stringValue(test.testId, `${id}-test-${testIndex}`).slice(0, 500),
        name: stringValue(test.name, `Test ${testIndex + 1}`).slice(0, 2_000),
        requestId: requestId || null,
        passed: test.passed === true,
        durationMs: typeof test.durationMs === 'number' && Number.isFinite(test.durationMs) ? Math.min(2_147_483_647, Math.max(0, Math.trunc(test.durationMs))) : 0,
        ...(error ? { error } : {}),
        logs: (Array.isArray(test.logs) ? test.logs : []).filter((log): log is string => typeof log === 'string').slice(0, 1_000).map((log) => log.slice(0, 20_000)),
      }];
    });
    return [{
      id,
      suiteId,
      startedAt: stringValue(result.startedAt, new Date(0).toISOString()),
      finishedAt: stringValue(result.finishedAt, new Date(0).toISOString()),
      tests,
    }];
  });
};

export const migrateWorkspace = (value: unknown): Workspace => {
  if (!isWorkspaceEnvelope(value)) throw new Error('This is not a Brunomnia workspace export.');
  const seed = cloneSeedWorkspace();
  const workspace = value as unknown as Omit<Workspace, 'version' | 'collections'> & {
    version?: number;
    collections: Array<{ requests: Array<Partial<Workspace['collections'][number]['requests'][number]>> } & Omit<Workspace['collections'][number], 'requests'>>;
  };
  const completeGraphqlSchemaModel = (workspace.version ?? 0) >= 34;
  const defaults = requestDefaults();
  const importedCollections = workspace.collections.map((collection) => ({
    ...collection,
    folders: normalizeFolders(collection.folders, defaults.auth),
    environment: normalizeRows(collection.environment, `${collection.id}-environment`),
    environmentEditorMode: environmentEditorMode(collection.environmentEditorMode),
    subEnvironments: normalizeCollectionEnvironments(collection.subEnvironments, collection.id),
    activeSubEnvironmentId: stringValue(collection.activeSubEnvironmentId),
    documentation: stringValue(collection.documentation),
    requests: collection.requests.map((request) => {
      const graphql = record(request.graphql);
      const socketIo = record(request.socketIo);
      const requestId = stringValue(request.id, `migrated-request-${crypto.randomUUID()}`);
      const method = normalizeHttpMethod(stringValue(request.method, defaults.method), defaults.method);
      const protocol = request.protocol === 'http'
        || request.protocol === 'graphql'
        || request.protocol === 'websocket'
        || request.protocol === 'socketio'
        || request.protocol === 'sse'
        || request.protocol === 'grpc'
        ? request.protocol
        : defaults.protocol;
      const followRedirectsMode = request.transport?.followRedirectsMode === 'global'
        || request.transport?.followRedirectsMode === 'on'
        || request.transport?.followRedirectsMode === 'off'
        ? request.transport.followRedirectsMode
        : request.transport?.followRedirects === false ? 'off' : 'global';
      const timeoutMode = request.transport?.timeoutMode === 'global' || request.transport?.timeoutMode === 'custom'
        ? request.transport.timeoutMode
        : typeof request.transport?.timeoutMs === 'number' ? 'custom' : 'global';
      const validateCertificatesMode = request.transport?.validateCertificatesMode === 'global'
        || request.transport?.validateCertificatesMode === 'on'
        || request.transport?.validateCertificatesMode === 'off'
        ? request.transport.validateCertificatesMode
        : typeof request.transport?.validateCertificates === 'boolean'
          ? request.transport.validateCertificates ? 'on' : 'off'
          : 'global';
      const proxyMode = request.transport?.proxyMode === 'global'
        || request.transport?.proxyMode === 'custom'
        || request.transport?.proxyMode === 'disabled'
        ? request.transport.proxyMode
        : stringValue(request.transport?.proxyUrl).trim() || stringValue(request.transport?.proxyExclusions).trim()
          ? 'custom'
          : 'global';
      const grpc = record(request.grpc);
      const { disableUserAgentHeader: legacyDisableUserAgentHeader, ...persistedGrpc } = grpc ?? {};
      const protoTree = normalizeGrpcProtoTree(
        grpc?.protoFiles,
        stringValue(grpc?.protoText, defaults.grpc.protoText),
        stringValue(grpc?.protoEntryPath),
        stringValue(grpc?.protoActivePath),
      );
      return {
        ...defaults,
        ...request,
        id: requestId,
        protocol,
        method,
        folderId: stringValue(request.folderId),
        inheritFolderAuth: request.inheritFolderAuth === true,
        documentation: stringValue(request.documentation),
        pathParams: normalizeRows(request.pathParams, `${requestId}-path`),
        params: normalizeRows(request.params, `${requestId}-query`),
        headers: normalizeRows(request.headers, `${requestId}-header`),
        disableUserAgentHeader: typeof request.disableUserAgentHeader === 'boolean'
          ? request.disableUserAgentHeader
          : legacyDisableUserAgentHeader === true,
        bodyMode: request.bodyMode ?? (method === 'GET' || method === 'HEAD' ? 'none' : 'json'),
        renderBodyTemplates: request.renderBodyTemplates !== false,
        auth: {
          ...defaults.auth,
          ...request.auth,
          expiresAt: typeof request.auth?.expiresAt === 'number' && Number.isFinite(request.auth.expiresAt)
            ? Math.max(0, Math.trunc(request.auth.expiresAt))
            : 0,
        },
        graphql: {
          ...defaults.graphql,
          ...request.graphql,
          schema: normalizeGraphqlSchema(graphql?.schema),
          schemaEndpoint: completeGraphqlSchemaModel ? stringValue(graphql?.schemaEndpoint) : '',
          schemaFetchedAt: stringValue(graphql?.schemaFetchedAt),
          schemaSource: completeGraphqlSchemaModel && graphql?.schemaSource === 'local' ? 'local' : 'remote',
          schemaFileName: completeGraphqlSchemaModel ? stringValue(graphql?.schemaFileName).slice(0, 1_000) : '',
          includeInputValueDeprecation: graphql?.includeInputValueDeprecation === true,
          schemaIncludesInputValueDeprecation: completeGraphqlSchemaModel && graphql?.schemaIncludesInputValueDeprecation === true,
        },
        grpc: {
          ...defaults.grpc,
          ...persistedGrpc,
          ...protoTree,
          descriptorSource: grpc?.descriptorSource === 'proto' || grpc?.descriptorSource === 'buf' ? grpc.descriptorSource : 'reflection',
          reflectionApiUrl: stringValue(grpc?.reflectionApiUrl, defaults.grpc.reflectionApiUrl).slice(0, 8_192),
          reflectionApiKey: stringValue(grpc?.reflectionApiKey).slice(0, 65_536),
          reflectionApiModule: stringValue(grpc?.reflectionApiModule, defaults.grpc.reflectionApiModule).slice(0, 2_048),
          metadata: normalizeRows(grpc?.metadata, `${requestId}-metadata`),
        },
        transport: {
          ...defaults.transport,
          ...request.transport,
          followRedirects: followRedirectsMode !== 'off',
          followRedirectsMode,
          timeoutMode,
          timeoutMs: typeof request.transport?.timeoutMs === 'number' && Number.isFinite(request.transport.timeoutMs)
            ? Math.min(2_147_483_647, Math.max(0, Math.trunc(request.transport.timeoutMs)))
            : defaults.transport.timeoutMs,
          validateCertificates: validateCertificatesMode !== 'off',
          validateCertificatesMode,
          proxyMode,
          clientCertificatePfxBase64: normalizeCertificatePfxBase64(request.transport?.clientCertificatePfxBase64),
          clientCertificatePassphrase: normalizeCertificatePassphrase(request.transport?.clientCertificatePassphrase),
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
        socketIo: {
          path: stringValue(socketIo?.path, defaults.socketIo.path).slice(0, 2_048),
          eventName: stringValue(socketIo?.eventName, defaults.socketIo.eventName).slice(0, 500),
          args: (Array.isArray(socketIo?.args) ? socketIo.args : defaults.socketIo.args).flatMap((value, index) => {
            const arg = record(value);
            if (!arg) return [];
            return [{
              id: stringValue(arg.id, `${requestId}-socketio-arg-${index}`),
              value: stringValue(arg.value).slice(0, 1_048_576),
              mode: arg.mode === 'text' ? 'text' as const : 'json' as const,
            }];
          }).slice(0, 100),
          ack: socketIo?.ack === true,
          eventListeners: (Array.isArray(socketIo?.eventListeners) ? socketIo.eventListeners : []).flatMap((value, index) => {
            const listener = record(value);
            if (!listener) return [];
            return [{
              id: stringValue(listener.id, `${requestId}-socketio-listener-${index}`),
              eventName: stringValue(listener.eventName).slice(0, 500),
              description: stringValue(listener.description ?? listener.desc).slice(0, 20_000),
              enabled: listener.enabled === true || listener.isOpen === true,
            }];
          }).slice(0, 500),
        },
        formBody: normalizeRows(request.formBody, `${requestId}-form`),
        multipartBody: (request.multipartBody ?? []).map((part) => ({ ...part, multiline: part.multiline === true, contentType: part.contentType ?? part.file?.mimeType ?? '', fileName: part.fileName ?? part.file?.fileName ?? '' })),
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
  const testSuites = normalizeTestSuites(workspace.testSuites, collections as Workspace['collections'], requestIds);
  const mcpClients = normalizeMcpClients(workspace.mcpClients);
  return {
    ...workspace,
    version: 39,
    name: workspace.name || 'Imported Workspace',
    activeRequestId: requestIds.has(workspace.activeRequestId) ? workspace.activeRequestId : collections[0]?.requests[0]?.id ?? '',
    activeEnvironmentId: environmentIds.has(workspace.activeEnvironmentId) ? workspace.activeEnvironmentId : environments[0].id,
    environments,
    history: Array.isArray(workspace.history) ? workspace.history : [],
    apiDesigns: (workspace.apiDesigns ?? seed.apiDesigns).map((design) => ({
      ...design,
      ruleset: design.ruleset ?? '',
      sourceFiles: Array.isArray(design.sourceFiles) ? design.sourceFiles.filter((file) => file && typeof file.path === 'string' && typeof file.contents === 'string') : [],
    })),
    mockServers: workspace.mockServers ?? seed.mockServers,
    testSuites,
    unitTestResults: normalizeUnitTestResults(workspace.unitTestResults, new Set(testSuites.map((suite) => suite.id))),
    runnerReports: workspace.runnerReports ?? [],
    imports: workspace.imports ?? [],
    cookies: workspace.cookies ?? [],
    responses: normalizeStoredResponses(workspace.responses),
    streamSessions: normalizeStoredStreamSessions(workspace.streamSessions, requestIds),
    mcpSessions: normalizeMcpHistorySessions(workspace.mcpSessions, new Set(mcpClients.map((client) => client.id)), environmentIds),
    responseFilters: normalizeResponseFilters(workspace.responseFilters, requestIds),
    certificates: normalizeWorkspaceCertificates(workspace.certificates),
    project: { ...seed.project, ...workspace.project },
    plugins: normalizePlugins(workspace.plugins),
    pluginData: workspace.pluginData ?? {},
    activePluginTheme: workspace.activePluginTheme ?? '',
    collaboration: normalizeCollaboration(workspace.collaboration, seed.collaboration),
    governance,
    mcpClients,
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
    mcpSessions: [],
    mcpClients: workspace.mcpClients.map((client) => ({ ...client, enabled: false, token: '', password: '', oauthClientSecret: '', oauthRefreshToken: '', oauthIdentityToken: '', oauthExpiresAt: 0, oauthRegisteredClientId: '', oauthRegisteredClientSecret: '', oauthRegisteredClientIdIssuedAt: 0, oauthRegisteredClientSecretExpiresAt: 0, oauthRegisteredTokenEndpointAuthMethod: 'none' })),
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
