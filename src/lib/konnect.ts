import type { ApiRequest, Collection, Environment, JsonValue, KeyValue, KonnectConfig, KonnectControlPlane, RequestFolder, Workspace } from '../types';
import { createBlankRequest } from '../data/seed';
import { sendRequest, type SendRequestContext } from './http';
import { parseKonnectExpression } from './konnectExpression';
import { normalizeHttpMethod } from './request';
import { isProtectedSecretReference } from './security';

const asRecord = (value: unknown) => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
const asString = (value: unknown) => typeof value === 'string' ? value : '';
const asStrings = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
const sourceId = (value: unknown) => asString(asRecord(value)?.id);

export const activeKonnectRegions = ['us', 'eu', 'au', 'in', 'sg'] as const;

export type KonnectSyncCounts = {
  total: number;
  created: number;
  updated: number;
  deleted: number;
  skipped: number;
};

export type KonnectSkippedRoute = {
  routeName: string;
  reason: string;
  serviceName: string;
};

export const zeroKonnectSyncCounts = (): KonnectSyncCounts => ({ total: 0, created: 0, updated: 0, deleted: 0, skipped: 0 });

const konnectDeploymentType = (clusterType: string, cloudGateway: boolean): KonnectControlPlane['deploymentType'] => {
  if (clusterType === 'CLUSTER_TYPE_K8S_INGRESS_CONTROLLER') return 'k8sIngressController';
  if (clusterType === 'CLUSTER_TYPE_CONTROL_PLANE_GROUP') return 'group';
  if (clusterType === 'CLUSTER_TYPE_SERVERLESS' || clusterType === 'CLUSTER_TYPE_SERVERLESS_V1' || clusterType === 'CLUSTER_TYPE_CLOUD_API_GATEWAY') return 'serverless';
  if (clusterType === 'CLUSTER_TYPE_CONTROL_PLANE' && cloudGateway) return 'dedicatedCloud';
  return 'selfManaged';
};

const stripTemplateSyntax = (value: string) => {
  let sanitized = value;
  let previous = '';
  while (sanitized !== previous) {
    previous = sanitized;
    sanitized = sanitized.replace(/{{[\s\S]*?}}/g, '').replace(/{%[\s\S]*?%}/g, '');
  }
  return sanitized;
};

const validProxyHost = (host: string) => {
  if (!host || /[\s\\/@?#]|{{|{%/.test(host)) return false;
  const authority = host.includes(':') && !(host.startsWith('[') && host.endsWith(']')) ? `[${host}]` : host;
  try {
    const parsed = new URL(`http://${authority}`);
    return Boolean(parsed.hostname) && !parsed.username && !parsed.password && parsed.pathname === '/' && !parsed.search && !parsed.hash;
  } catch {
    return false;
  }
};

const parseProxyUrls = (value: unknown): KonnectControlPlane['proxyUrls'] => !Array.isArray(value) ? [] : value.flatMap((item): KonnectControlPlane['proxyUrls'] => {
  const proxy = asRecord(item);
  const host = stripTemplateSyntax(asString(proxy?.host)).trim().slice(0, 1_000);
  const port = Number(proxy?.port);
  const protocol = asString(proxy?.protocol).toLowerCase();
  if (!validProxyHost(host) || !Number.isInteger(port) || port < 1 || port > 65_535 || !['http', 'https', 'ws', 'wss', 'grpc', 'grpcs'].includes(protocol)) return [];
  return [{ host, port, protocol: protocol as KonnectControlPlane['proxyUrls'][number]['protocol'] }];
}).slice(0, 100);

const baseUrl = (config: KonnectConfig) => {
  const url = new URL(config.baseUrl.trim());
  if (url.protocol !== 'https:' || url.username || url.password || !(url.hostname === 'api.konghq.com' || url.hostname.endsWith('.api.konghq.com'))) {
    throw new Error('Konnect integration requires an HTTPS *.api.konghq.com endpoint without embedded credentials.');
  }
  url.pathname = url.pathname.replace(/\/$/, '');
  return url;
};

export const konnectRegionFromConfig = (config: KonnectConfig) => {
  const labels = baseUrl(config).hostname.split('.');
  return labels.length === 4 && labels.slice(1).join('.') === 'api.konghq.com' ? labels[0] : '';
};

export const konnectConfigForRegion = (config: KonnectConfig, region: string): KonnectConfig => {
  if (!activeKonnectRegions.includes(region as typeof activeKonnectRegions[number])) throw new Error(`Unsupported Konnect region: ${region || 'none'}.`);
  const url = baseUrl(config);
  const labels = url.hostname.split('.');
  if (url.hostname !== 'api.konghq.com' && !(labels.length === 4 && labels.slice(1).join('.') === 'api.konghq.com')) {
    throw new Error('All-control-plane sync requires the standard api.konghq.com regional endpoint.');
  }
  url.hostname = `${region}.api.konghq.com`;
  return { ...config, baseUrl: url.toString().replace(/\/$/, '') };
};

const getPage = async (config: KonnectConfig, url: string, environment: Environment | undefined, context: SendRequestContext) => {
  if (!isProtectedSecretReference(config.token)) throw new Error('Konnect access tokens must be a complete local-vault or approved external-vault reference.');
  const request = createBlankRequest(`konnect-${crypto.randomUUID()}`);
  request.name = 'Konnect pull';
  request.method = 'GET';
  request.url = url;
  request.auth = { ...request.auth, type: 'bearer', token: config.token, disabled: false };
  request.headers = [{ id: 'konnect-accept', name: 'Accept', value: 'application/json', enabled: true }];
  request.transport = { ...request.transport, timeoutMode: 'custom', timeoutMs: 30_000, followRedirects: false, followRedirectsMode: 'off', sendCookies: false, storeCookies: false };
  let response: Awaited<ReturnType<typeof sendRequest>>;
  for (let attempt = 0; ; attempt += 1) {
    response = await sendRequest(request, environment, context);
    if (response.status !== 429 || attempt >= 5) break;
    const retryAfter = Number.parseInt(response.headers?.['retry-after'] ?? response.headers?.['Retry-After'] ?? '', 10);
    const delay = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1_000 : Math.min(1_000 * 2 ** attempt, 30_000);
    await new Promise<void>((resolve, reject) => {
      const signal = context.signal;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const aborted = () => {
        if (timer) clearTimeout(timer);
        reject(signal?.reason instanceof Error ? signal.reason : new DOMException('Konnect sync canceled.', 'AbortError'));
      };
      if (signal?.aborted) {
        aborted();
        return;
      }
      timer = setTimeout(() => {
        signal?.removeEventListener('abort', aborted);
        resolve();
      }, delay);
      signal?.addEventListener('abort', aborted, { once: true });
    });
  }
  if (response.status === 401 || response.status === 403) throw new Error(`Konnect rejected the access token (${response.status}). Check its expiry and permissions.`);
  if (response.status < 200 || response.status >= 300) throw new Error(`Konnect request failed (${response.status}): ${response.body.slice(0, 2_000)}`);
  if (response.body.length > 20_000_000) throw new Error('Konnect response exceeded the 20 MB safety limit.');
  return asRecord(JSON.parse(response.body));
};

const getAllControlPlaneRecords = async (config: KonnectConfig, environment: Environment | undefined, context: SendRequestContext) => {
  const origin = baseUrl(config);
  const data: unknown[] = [];
  for (let page = 1; page <= 100; page += 1) {
    const url = new URL('/v2/control-planes', `${origin.toString()}/`);
    url.searchParams.set('page[size]', '100');
    url.searchParams.set('page[number]', String(page));
    const parsed = await getPage(config, url.toString(), environment, context);
    if (Array.isArray(parsed?.data)) data.push(...parsed.data);
    if (data.length > 10_000) throw new Error('Konnect sync exceeded the 10,000-resource safety limit.');
    const pageMeta = asRecord(asRecord(parsed?.meta)?.page);
    const total = Number(pageMeta?.total);
    const totalPages = Number.isFinite(total) && total > 0 ? Math.ceil(total / 100) : 1;
    if (page >= totalPages) break;
  }
  return data;
};

const getAllOffsetRecords = async (config: KonnectConfig, path: string, environment: Environment | undefined, context: SendRequestContext) => {
  const origin = baseUrl(config);
  const data: unknown[] = [];
  const seenOffsets = new Set<string>();
  let offset = '';
  for (let page = 0; page < 100; page += 1) {
    const url = new URL(path, `${origin.toString()}/`);
    url.searchParams.set('size', '100');
    if (offset) url.searchParams.set('offset', offset);
    const parsed = await getPage(config, url.toString(), environment, context);
    if (Array.isArray(parsed?.data)) data.push(...parsed.data);
    if (data.length > 10_000) throw new Error('Konnect sync exceeded the 10,000-resource safety limit.');
    const nextOffset = typeof parsed?.offset === 'string' ? parsed.offset.slice(0, 2_000) : '';
    if (!nextOffset) break;
    if (seenOffsets.has(nextOffset)) throw new Error('Konnect pagination repeated an offset.');
    seenOffsets.add(nextOffset);
    offset = nextOffset;
  }
  return data;
};

const parseKonnectControlPlanes = (records: unknown[], region: string): KonnectControlPlane[] => records.flatMap((item): KonnectControlPlane[] => {
  const plane = asRecord(item);
  const id = asString(plane?.id);
  const remoteConfig = asRecord(plane?.config);
  const clusterType = stripTemplateSyntax(asString(remoteConfig?.cluster_type)).slice(0, 200);
  const cloudGateway = remoteConfig?.cloud_gateway === true;
  return plane && id ? [{
    id,
    name: stripTemplateSyntax(asString(plane.name)).slice(0, 500) || id,
    description: stripTemplateSyntax(asString(plane.description)).slice(0, 20_000),
    region,
    clusterType,
    deploymentType: konnectDeploymentType(clusterType, cloudGateway),
    proxyUrls: parseProxyUrls(plane.proxy_urls),
  }] : [];
});

export const loadKonnectControlPlanes = async (config: KonnectConfig, environment: Environment | undefined, context: SendRequestContext): Promise<KonnectControlPlane[]> => {
  if (!config.enabled) throw new Error('Review and enable the Konnect integration before connecting.');
  if (!isProtectedSecretReference(config.token)) throw new Error('Use a complete local-vault or approved external-vault reference for the Konnect access token.');
  const records = await getAllControlPlaneRecords(config, environment, context);
  return parseKonnectControlPlanes(records, konnectRegionFromConfig(config));
};

export const loadKonnectControlPlanesForRegion = async (config: KonnectConfig, region: string, environment: Environment | undefined, context: SendRequestContext) => (
  loadKonnectControlPlanes(konnectConfigForRegion(config, region), environment, context)
);

const sanitizedStrings = (value: unknown) => asStrings(value).map(stripTemplateSyntax).filter((item) => item.trim());

const sanitizeRoute = (source: Record<string, unknown>) => ({
  id: asString(source.id),
  service: source.service,
  name: stripTemplateSyntax(asString(source.name)),
  methods: sanitizedStrings(source.methods),
  paths: sanitizedStrings(source.paths),
  hosts: sanitizedStrings(source.hosts),
  hasExpression: Boolean(asString(source.expression).trim()),
  expression: stripTemplateSyntax(asString(source.expression)),
  headers: Object.fromEntries(Object.entries(asRecord(source.headers) ?? {}).flatMap(([name, values]) => {
    const safeName = stripTemplateSyntax(name).trim();
    const safeValues = sanitizedStrings(values);
    return safeName && safeValues.length ? [[safeName, safeValues]] : [];
  })),
  protocols: sanitizedStrings(source.protocols).map((protocol) => protocol.toLowerCase()),
  snis: sanitizedStrings(source.snis),
});

const resolveKonnectPath = (rawPath: string) => {
  if (!rawPath.startsWith('~')) return { path: rawPath, pathParams: [] as KeyValue[] };
  let path = rawPath.slice(1).replace(/^\^|\$$/g, '').replace(/\\\//g, '/').replace(/\\\./g, '.').replace(/\/\?$/, '/');
  const names: string[] = [];
  path = path.replace(/\(\?<([a-zA-Z0-9_]+)>[^)]+\)/g, (_, name: string) => {
    const normalized = name.toLowerCase();
    names.push(normalized);
    return `{${normalized}}`;
  });
  let index = 1;
  path = path.replace(/\([^)]+\)|\[[^\]]+\][+*?]?/g, () => {
    const name = `param_${index++}`;
    names.push(name);
    return `{${name}}`;
  });
  if (/[()[\]*+?\\]/.test(path)) return { path: '/{path}', pathParams: [{ id: 'konnect-path', name: 'path', value: '', enabled: true }] };
  if (!path.startsWith('/')) path = `/${path}`;
  return { path, pathParams: names.map((name) => ({ id: `konnect-path-${name}`, name, value: '', enabled: true })) };
};

const serviceVariable = (serviceId: string, protocol: string) => `konnect_${serviceId.replace(/[^a-z0-9_]/gi, '_')}_${protocol}_proxy_url`;
const loopbackProxyUrl = (protocol: string) => `${protocol}://127.0.0.1:${protocol === 'grpc' || protocol === 'grpcs' ? '9000' : '8000'}`;
const managedResourceId = (prefix: string, key: string) => `${prefix}-${Array.from(new TextEncoder().encode(key), (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
const routeRequestId = (key: string) => managedResourceId('konnect-route', key);
const routeFolderId = (key: string) => managedResourceId('konnect-folder', key);
const httpLikeProxyProtocols = new Set(['http', 'https', 'ws', 'wss']);
const defaultPorts: Record<string, number> = { http: 80, ws: 80, https: 443, wss: 443 };

const proxyAuthority = ({ host, port, protocol }: KonnectControlPlane['proxyUrls'][number]) => {
  const normalizedHost = host.includes(':') && !(host.startsWith('[') && host.endsWith(']')) ? `[${host}]` : host;
  return defaultPorts[protocol] === port ? normalizedHost : `${normalizedHost}:${port}`;
};

const controlPlaneProxyUrl = (protocol: string, proxyUrls: KonnectControlPlane['proxyUrls']) => {
  const proxy = protocol === 'grpc' || protocol === 'grpcs'
    ? proxyUrls.find((candidate) => candidate.protocol === protocol)
    : proxyUrls.find((candidate) => httpLikeProxyProtocols.has(candidate.protocol));
  return proxy ? `${protocol}://${proxyAuthority(proxy)}` : '';
};

export const applyKonnectVariableDefaults = (
  variables: KeyValue[],
  variableDefaults: Record<string, string>,
  variableProtocols: Record<string, string>,
) => {
  const names = Object.keys(variableDefaults);
  const existingNames = new Set(variables.map((variable) => variable.name));
  return [
    ...variables.map((variable) => {
      const protocol = variableProtocols[variable.name];
      const nextValue = variableDefaults[variable.name];
      if (!protocol || !nextValue || !variable.id.startsWith('konnect-variable-')) return variable;
      return variable.value === '' || variable.value === loopbackProxyUrl(protocol) ? { ...variable, value: nextValue } : variable;
    }),
    ...names.filter((name) => !existingNames.has(name)).map((name) => ({ id: `konnect-variable-${crypto.randomUUID()}`, name, value: variableDefaults[name], enabled: true })),
  ];
};

const previousManagedHeaderNames = (request: ApiRequest | undefined) => new Set(sanitizedStrings(asRecord(request?.source?.unsupported)?.managedHeaderNames).map((name) => name.toLowerCase()));
const managedFolderFormat = 'konnect-route-folder';

const preserveLocalCollection = (generated: Collection, previous: Collection | undefined): Collection => {
  const folders = [
    ...(previous?.folders ?? []).filter((folder) => folder.source?.format !== managedFolderFormat),
    ...(generated.folders ?? []),
  ];
  const folderIds = new Set(folders.map((folder) => folder.id));
  const normalizedFolders = folders.map((folder) => ({ ...folder, parentId: folder.parentId && folderIds.has(folder.parentId) ? folder.parentId : '' }));
  const requests = generated.requests.map((request) => ({
    ...request,
    folderId: request.folderId && folderIds.has(request.folderId) ? request.folderId : '',
  }));
  const validIds = new Set([...folderIds, ...requests.map((request) => request.id)]);
  const seen = new Set<string>();
  const resourceOrder = [
    ...(previous?.resourceOrder ?? []),
    ...normalizedFolders.map((folder) => folder.id),
    ...requests.map((request) => request.id),
  ].filter((id) => validIds.has(id) && !seen.has(id) && Boolean(seen.add(id)));
  return {
    ...generated,
    requests,
    folders: normalizedFolders,
    resourceOrder,
    environment: previous?.environment ?? [],
    subEnvironments: previous?.subEnvironments ?? [],
    activeSubEnvironmentId: previous?.activeSubEnvironmentId ?? '',
    documentation: previous?.documentation ?? '',
  };
};

const preserveLocalRequest = (generated: ApiRequest, previous: ApiRequest | undefined, managedHeaders: KeyValue[], pathParams: KeyValue[]) => {
  if (!previous) {
    generated.headers = managedHeaders;
    generated.pathParams = pathParams;
    return generated;
  }
  const incoming = new Set(managedHeaders.map((header) => header.name.toLowerCase()));
  const priorManaged = previousManagedHeaderNames(previous);
  generated.id = previous.id;
  generated.params = previous.params;
  generated.pathParams = pathParams.map((parameter) => ({ ...parameter, value: previous.pathParams.find((candidate) => candidate.name === parameter.name)?.value ?? '' }));
  generated.headers = [...managedHeaders, ...previous.headers.filter((header) => !incoming.has(header.name.toLowerCase()) && !priorManaged.has(header.name.toLowerCase()))];
  generated.disableUserAgentHeader = previous.disableUserAgentHeader;
  generated.bodyMode = previous.bodyMode;
  generated.renderBodyTemplates = previous.renderBodyTemplates;
  generated.body = previous.body;
  generated.formBody = previous.formBody;
  generated.multipartBody = previous.multipartBody;
  generated.binaryBody = previous.binaryBody;
  generated.auth = previous.auth;
  generated.graphql = previous.graphql;
  generated.transport = previous.transport;
  generated.sse = previous.sse;
  generated.socketIo = previous.socketIo;
  generated.preRequestScript = previous.preRequestScript;
  generated.tests = previous.tests;
  generated.folderId = previous.folderId;
  generated.inheritFolderAuth = previous.inheritFolderAuth;
  generated.documentation = previous.documentation;
  return generated;
};

export const mapKonnectResources = (workspace: Workspace, servicesSource: unknown[], routesSource: unknown[]) => {
  const services = new Map(servicesSource.flatMap((item) => {
    const service = asRecord(item);
    const id = asString(service?.id);
    return service && id ? [[id, service] as const] : [];
  }));
  const existingCollections = new Map(workspace.collections
    .filter((collection) => collection.source?.format === 'konnect' && collection.source.sourceId)
    .map((collection) => [collection.source!.sourceId!, collection]));
  const routes = new Map<string, ReturnType<typeof sanitizeRoute>[]>();
  const skipped: Array<{ route: ReturnType<typeof sanitizeRoute>; reason: string }> = [];
  routesSource.forEach((item) => {
    const record = asRecord(item);
    if (!record) return;
    let route = sanitizeRoute(record);
    const protocols = route.protocols;
    const serviceId = sourceId(route.service);
    const supported = protocols.some((protocol) => ['http', 'https', 'ws', 'wss', 'grpc', 'grpcs'].includes(protocol));
    const expression = route.hasExpression ? parseKonnectExpression(route.expression) : undefined;
    const reason = !route.id ? 'Route has no identifier.'
      : !serviceId ? 'Route has no Gateway Service.'
      : route.snis.length ? 'Route uses SNI matching, which request URLs cannot override.'
        : expression?.reason ?? (!supported ? `Unsupported protocol: ${protocols.join(', ') || 'none'}.` : '');
    if (reason) {
      skipped.push({ route, reason });
      return;
    }
    if (expression?.fields) route = {
      ...route,
      methods: expression.fields.methods,
      paths: expression.fields.paths,
      hosts: expression.fields.hosts,
      headers: expression.fields.headers,
    };
    routes.set(serviceId, [...(routes.get(serviceId) ?? []), route]);
  });
  const collections: Collection[] = [];
  const variables = new Set<string>();
  const variableDefaults: Record<string, string> = {};
  const variableProtocols: Record<string, string> = {};
  const proxyUrls = workspace.konnect.controlPlanes.find((plane) => plane.id === workspace.konnect.controlPlaneId)?.proxyUrls ?? [];
  services.forEach((service, serviceId) => {
    const existing = existingCollections.get(serviceId);
    const existingRequests = new Map(existing?.requests.map((request) => [request.source?.sourceId, request]) ?? []);
    const existingFoldersById = new Map((existing?.folders ?? []).map((folder) => [folder.id, folder]));
    const existingManagedFolders = new Map((existing?.folders ?? [])
      .filter((folder) => folder.source?.format === managedFolderFormat && folder.source.sourceId)
      .map((folder) => [folder.source!.sourceId!, folder]));
    const localFolderIds = new Set((existing?.folders ?? []).filter((folder) => folder.source?.format !== managedFolderFormat).map((folder) => folder.id));
    const consumedPrevious = new Set<string>();
    const generatedKeys = new Set<string>();
    const generatedFolders = new Map<string, RequestFolder>();
    const usedFolderIds = new Set(localFolderIds);
    const managedFolder = (key: string, name: string, parentId: string) => {
      const generated = generatedFolders.get(key);
      if (generated) return generated.id;
      const previous = existingManagedFolders.get(key);
      let id = previous?.id ?? routeFolderId(key);
      while (usedFolderIds.has(id)) id = `${id}-managed`;
      usedFolderIds.add(id);
      const folder: RequestFolder = previous ? {
        ...previous,
        id,
        name,
        parentId,
        source: { format: managedFolderFormat, sourceId: key },
      } : {
        id,
        name,
        parentId,
        expanded: true,
        headers: [],
        environment: [],
        preRequestScript: '',
        tests: '',
        documentation: '',
        source: { format: managedFolderFormat, sourceId: key },
      };
      generatedFolders.set(key, folder);
      return id;
    };
    const previousFor = (key: string, routeId: string) => {
      const exact = existingRequests.get(key);
      if (exact) return exact;
      const legacy = existingRequests.get(routeId);
      if (legacy && !consumedPrevious.has(legacy.id)) {
        consumedPrevious.add(legacy.id);
        return legacy;
      }
      return undefined;
    };
    const requests: ApiRequest[] = [];
    (routes.get(serviceId) ?? []).forEach((route) => {
      const routeId = asString(route.id);
      const routeName = route.name || `Route ${routeId}`;
      const paths = route.paths.length ? route.paths : [''];
      const parentFolderId = managedFolder(`${routeId}:route`, routeName, '');
      const managedHeaders = [
        ...(route.hosts[0] ? [{ name: 'Host', value: route.hosts[0] }] : []),
        ...Object.entries(route.headers).map(([name, values]) => ({ name, value: values[0] })),
      ];
      const grpcProtocols = route.protocols.filter((protocol) => protocol === 'grpc' || protocol === 'grpcs');
      const wsProtocols = route.protocols.filter((protocol) => protocol === 'ws' || protocol === 'wss');
      const protocols = grpcProtocols.length ? grpcProtocols : wsProtocols.length ? wsProtocols : route.protocols.filter((protocol) => protocol === 'http' || protocol === 'https');
      protocols.forEach((protocol) => {
        const family = protocol === 'grpc' || protocol === 'grpcs' ? 'grpc' : protocol === 'ws' || protocol === 'wss' ? 'ws' : 'http';
        const variable = serviceVariable(serviceId, protocol);
        variables.add(variable);
        variableDefaults[variable] = controlPlaneProxyUrl(protocol, proxyUrls) || loopbackProxyUrl(protocol);
        variableProtocols[variable] = protocol;
        paths.forEach((rawPath) => {
          const resolved = resolveKonnectPath(rawPath);
          const requestName = resolved.path === '/{path}' ? rawPath : resolved.path || routeName;
          const needsSubfolder = protocols.length > 1 || (family === 'http' && paths.length > 1);
          const subfolderName = protocols.length > 1 ? `${protocol.toUpperCase()} ${requestName}` : requestName;
          const folderId = needsSubfolder
            ? managedFolder(`${routeId}:folder:${subfolderName}`, subfolderName, parentFolderId)
            : parentFolderId;
          const methods = protocol === 'http' || protocol === 'https'
            ? (route.methods.length ? route.methods : ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']).map((method) => normalizeHttpMethod(method, '')).filter(Boolean)
            : [''];
          methods.forEach((method) => {
            const key = family === 'http' ? `${routeId}:${method}:${rawPath}:${protocol}` : `${routeId}:${family}:${rawPath}:${protocol}`;
            if (generatedKeys.has(key)) return;
            generatedKeys.add(key);
            const previous = previousFor(key, routeId);
            const generated = createBlankRequest(routeRequestId(key));
            generated.name = requestName;
            generated.folderId = folderId;
            generated.protocol = family === 'grpc' ? 'grpc' : family === 'ws' ? 'websocket' : 'http';
            generated.method = (method || 'GET') as typeof generated.method;
            generated.url = `{{ ${variable} }}${family === 'grpc' ? '' : resolved.path}`;
            if (family === 'grpc') {
              const protoMethod = resolved.path.replace(/^\//, '');
              const segments = protoMethod.split('/').filter(Boolean);
              generated.grpc = {
                ...(previous?.grpc ?? generated.grpc),
                service: segments.slice(0, -1).join('/'),
                method: segments.at(-1) ?? '',
                metadata: managedHeaders.filter((header) => header.name.toLowerCase() !== 'host').map((header, index) => ({ id: `${generated.id}-metadata-${index}`, ...header, enabled: true })),
              };
            }
            const headers = family === 'grpc' ? [] : managedHeaders.map((header, index) => ({ id: `${generated.id}-header-${index}`, ...header, enabled: true }));
            const preserved = preserveLocalRequest(generated, previous, headers, family === 'grpc' ? [] : resolved.pathParams);
            const previousFolder = previous?.folderId ? existingFoldersById.get(previous.folderId) : undefined;
            preserved.folderId = previousFolder && previousFolder.source?.format !== managedFolderFormat ? previousFolder.id : folderId;
            if (family === 'grpc' && previous) {
              const incomingMetadata = new Set(preserved.grpc.metadata.map((header) => header.name.toLowerCase()));
              const priorManaged = previousManagedHeaderNames(previous);
              preserved.grpc.metadata = [...generated.grpc.metadata, ...previous.grpc.metadata.filter((header) => !incomingMetadata.has(header.name.toLowerCase()) && !priorManaged.has(header.name.toLowerCase()))];
            }
            const managedHeaderNames = (family === 'grpc' ? managedHeaders.filter((header) => header.name.toLowerCase() !== 'host') : headers).map((header) => header.name.toLowerCase());
            preserved.source = { format: 'konnect-route', sourceId: key, unsupported: { routeId, controlPlaneId: workspace.konnect.controlPlaneId, serviceId, protocols: route.protocols as JsonValue, managedHeaderNames } };
            requests.push(preserved);
          });
        });
      });
    });
    collections.push(preserveLocalCollection({
      id: existing?.id ?? `konnect-service-${serviceId}`,
      name: `Konnect · ${asString(service.name) || serviceId}`,
      expanded: existing?.expanded ?? true,
      requests,
      folders: [...generatedFolders.values()],
      source: { format: 'konnect', sourceId: serviceId, unsupported: { controlPlaneId: workspace.konnect.controlPlaneId } },
    }, existing));
  });
  if (skipped.length) {
    const existing = existingCollections.get('skipped-routes');
    collections.push(preserveLocalCollection({
      id: existing?.id ?? 'konnect-skipped-routes',
      name: 'Konnect · Skipped Routes',
      expanded: existing?.expanded ?? false,
      source: { format: 'konnect', sourceId: 'skipped-routes' },
      requests: skipped.map(({ route, reason }) => {
        const id = asString(route.id) || crypto.randomUUID();
        const request = createBlankRequest(`konnect-skipped-${id}`);
        request.name = `[Unsupported] ${asString(route.name) || id}`;
        request.url = 'https://unsupported.invalid/';
        request.source = { format: 'konnect-skipped-route', sourceId: id, unsupported: { protocols: route.protocols as JsonValue, reason } };
        return request;
      }),
    }, existing));
  }
  return {
    collections,
    variables: [...variables],
    variableDefaults,
    variableProtocols,
    skipped: skipped.length,
    skippedRoutes: skipped.map(({ route, reason }): KonnectSkippedRoute => {
      const service = services.get(sourceId(route.service));
      return {
        routeName: route.name || route.id || 'Unnamed route',
        reason,
        serviceName: stripTemplateSyntax(asString(service?.name)).slice(0, 500) || sourceId(route.service) || 'Unknown service',
      };
    }),
  };
};

const managedServiceCollections = (collections: Collection[]) => collections.filter((collection) => collection.source?.format === 'konnect' && collection.source.sourceId !== 'skipped-routes');

const managedRequests = (collections: Collection[]) => new Map(collections.flatMap((collection) => collection.requests
  .filter((request) => request.source?.format === 'konnect-route' && request.source.sourceId)
  .map((request) => [request.source!.sourceId!, request] as const)));

const managedRequestSignature = (request: ApiRequest) => {
  const managedNames = previousManagedHeaderNames(request);
  const rows = request.protocol === 'grpc' ? request.grpc.metadata : request.headers;
  return JSON.stringify({
    name: request.name,
    protocol: request.protocol,
    method: request.method,
    url: request.url,
    pathParameters: request.pathParams.map((parameter) => ({ name: parameter.name, enabled: parameter.enabled })),
    headers: rows.filter((header) => managedNames.has(header.name.toLowerCase())).map((header) => ({ name: header.name, value: header.value, enabled: header.enabled })),
    grpc: request.protocol === 'grpc' ? { service: request.grpc.service, method: request.grpc.method } : undefined,
  });
};

export const reconcileKonnectResources = (workspace: Workspace, services: unknown[], routes: unknown[], syncedAt = new Date().toISOString()) => {
  const mapped = mapKonnectResources(workspace, services, routes);
  const previousServices = new Map(managedServiceCollections(workspace.collections).map((collection) => [collection.source!.sourceId!, collection]));
  const nextServiceCollections = managedServiceCollections(mapped.collections);
  const nextServiceIds = new Set(nextServiceCollections.map((collection) => collection.source!.sourceId!));
  const previousRequests = managedRequests(managedServiceCollections(workspace.collections).filter((collection) => nextServiceIds.has(collection.source!.sourceId!)));
  const nextRequests = managedRequests(nextServiceCollections);
  const serviceCounts = zeroKonnectSyncCounts();
  serviceCounts.total = services.filter((service) => sourceId(service)).length;
  nextServiceCollections.forEach((collection) => {
    const previous = previousServices.get(collection.source!.sourceId!);
    if (!previous) serviceCounts.created += 1;
    else if (previous.name !== collection.name) serviceCounts.updated += 1;
  });
  previousServices.forEach((_collection, id) => {
    if (!nextServiceIds.has(id)) serviceCounts.deleted += 1;
  });
  const routeCounts = zeroKonnectSyncCounts();
  routeCounts.total = nextRequests.size;
  routeCounts.skipped = mapped.skipped;
  nextRequests.forEach((request, key) => {
    const previous = previousRequests.get(key);
    if (!previous) routeCounts.created += 1;
    else if (managedRequestSignature(previous) !== managedRequestSignature(request)) routeCounts.updated += 1;
  });
  previousRequests.forEach((_request, key) => {
    if (!nextRequests.has(key)) routeCounts.deleted += 1;
  });
  const localCollections = workspace.collections.filter((collection) => collection.source?.format !== 'konnect');
  const environments = workspace.environments.map((candidate) => candidate.id !== workspace.activeEnvironmentId ? candidate : {
    ...candidate,
    variables: applyKonnectVariableDefaults(candidate.variables, mapped.variableDefaults, mapped.variableProtocols),
  });
  return {
    workspace: {
      ...workspace,
      collections: [...localCollections, ...mapped.collections],
      environments,
      konnect: { ...workspace.konnect, lastSyncedAt: syncedAt },
    },
    services: serviceCounts,
    routes: routeCounts,
    skipped: mapped.skipped,
    skippedRoutes: mapped.skippedRoutes,
  };
};

export const loadKonnectControlPlaneResources = async (
  config: KonnectConfig,
  controlPlane: KonnectControlPlane,
  environment: Environment | undefined,
  context: SendRequestContext,
  onProgress?: (message: string) => void,
) => {
  const regionalConfig = controlPlane.region ? konnectConfigForRegion(config, controlPlane.region) : config;
  const encodedControlPlane = encodeURIComponent(controlPlane.id);
  onProgress?.(`Fetching services for ${controlPlane.name}…`);
  const services = await getAllOffsetRecords(regionalConfig, `/v2/control-planes/${encodedControlPlane}/core-entities/services`, environment, context);
  const routes: unknown[] = [];
  for (let index = 0; index < services.length; index += 5) {
    const batch = services.slice(index, index + 5);
    const results = await Promise.all(batch.map(async (service) => {
      const serviceId = sourceId(service);
      return serviceId
        ? getAllOffsetRecords(regionalConfig, `/v2/control-planes/${encodedControlPlane}/core-entities/services/${encodeURIComponent(serviceId)}/routes`, environment, context)
        : [];
    }));
    results.forEach((items) => routes.push(...items));
    if (routes.length > 10_000) throw new Error('Konnect sync exceeded the 10,000-route safety limit.');
    onProgress?.(`Fetched ${Math.min(index + batch.length, services.length)} / ${services.length} services for ${controlPlane.name}…`);
  }
  return { services, routes };
};

export const syncKonnectRoutes = async (workspace: Workspace, environment: Environment | undefined, context: SendRequestContext) => {
  const config = workspace.konnect;
  if (!config.enabled) throw new Error('Enable the Konnect integration before syncing.');
  if (!config.controlPlaneId) throw new Error('Choose a Konnect control plane.');
  const controlPlane = config.controlPlanes.find((plane) => plane.id === config.controlPlaneId) ?? {
    id: config.controlPlaneId,
    name: config.controlPlaneId,
    description: '',
    region: konnectRegionFromConfig(config),
    clusterType: '',
    deploymentType: 'selfManaged' as const,
    proxyUrls: [],
  };
  const { services, routes } = await loadKonnectControlPlaneResources(config, controlPlane, environment, context);
  const reconciled = reconcileKonnectResources(workspace, services, routes);
  return {
    ...reconciled,
    services: services.length,
    routes: routes.length,
    serviceCounts: reconciled.services,
    routeCounts: reconciled.routes,
  };
};
