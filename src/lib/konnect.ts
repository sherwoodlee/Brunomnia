import type { ApiRequest, Collection, Environment, JsonValue, KeyValue, KonnectConfig, KonnectControlPlane, Workspace } from '../types';
import { createBlankRequest } from '../data/seed';
import { sendRequest, type SendRequestContext } from './http';
import { normalizeHttpMethod } from './request';
import { isProtectedSecretReference } from './security';

const asRecord = (value: unknown) => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
const asString = (value: unknown) => typeof value === 'string' ? value : '';
const asStrings = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
const sourceId = (value: unknown) => asString(asRecord(value)?.id);

const baseUrl = (config: KonnectConfig) => {
  const url = new URL(config.baseUrl.trim());
  if (url.protocol !== 'https:' || url.username || url.password || !(url.hostname === 'api.konghq.com' || url.hostname.endsWith('.api.konghq.com'))) {
    throw new Error('Konnect integration requires an HTTPS *.api.konghq.com endpoint without embedded credentials.');
  }
  url.pathname = url.pathname.replace(/\/$/, '');
  return url;
};

const getPage = async (config: KonnectConfig, url: string, environment: Environment | undefined, context: SendRequestContext) => {
  if (!isProtectedSecretReference(config.token)) throw new Error('Konnect access tokens must be a complete local-vault or approved external-vault reference.');
  const request = createBlankRequest(`konnect-${crypto.randomUUID()}`);
  request.name = 'Konnect pull';
  request.method = 'GET';
  request.url = url;
  request.auth = { ...request.auth, type: 'bearer', token: config.token, disabled: false };
  request.headers = [{ id: 'konnect-accept', name: 'Accept', value: 'application/json', enabled: true }];
  request.transport = { ...request.transport, timeoutMode: 'custom', timeoutMs: 60_000, followRedirects: false, followRedirectsMode: 'off', sendCookies: false, storeCookies: false };
  const response = await sendRequest(request, environment, context);
  if (response.status === 401 || response.status === 403) throw new Error(`Konnect rejected the access token (${response.status}). Check its expiry and permissions.`);
  if (response.status < 200 || response.status >= 300) throw new Error(`Konnect request failed (${response.status}): ${response.body.slice(0, 2_000)}`);
  if (response.body.length > 20_000_000) throw new Error('Konnect response exceeded the 20 MB safety limit.');
  return asRecord(JSON.parse(response.body));
};

const getAll = async (config: KonnectConfig, path: string, environment: Environment | undefined, context: SendRequestContext) => {
  const origin = baseUrl(config);
  let next = new URL(path, `${origin.toString()}/`).toString();
  const data: unknown[] = [];
  for (let page = 0; page < 100 && next; page += 1) {
    const parsed = await getPage(config, next, environment, context);
    if (Array.isArray(parsed?.data)) data.push(...parsed.data);
    if (data.length > 10_000) throw new Error('Konnect sync exceeded the 10,000-resource safety limit.');
    const pageMeta = asRecord(asRecord(parsed?.meta)?.page);
    const links = asRecord(parsed?.links);
    const candidate = asString(pageMeta?.next) || asString(links?.next);
    if (!candidate) break;
    const candidateUrl = new URL(candidate, origin);
    if (candidateUrl.origin !== origin.origin) throw new Error('Konnect pagination attempted to leave the configured API origin.');
    next = candidateUrl.toString();
  }
  return data;
};

export const loadKonnectControlPlanes = async (config: KonnectConfig, environment: Environment | undefined, context: SendRequestContext): Promise<KonnectControlPlane[]> => {
  if (!config.enabled) throw new Error('Review and enable the Konnect integration before connecting.');
  if (!isProtectedSecretReference(config.token)) throw new Error('Use a complete local-vault or approved external-vault reference for the Konnect access token.');
  const records = await getAll(config, '/v2/control-planes', environment, context);
  return records.flatMap((item): KonnectControlPlane[] => {
    const plane = asRecord(item);
    const id = asString(plane?.id);
    return plane && id ? [{ id, name: asString(plane.name) || id, description: asString(plane.description) }] : [];
  });
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
const defaultProxyUrl = (protocol: string) => `${protocol}://127.0.0.1:${protocol === 'grpc' || protocol === 'grpcs' ? '9000' : '8000'}`;
const routeRequestId = (key: string) => `konnect-route-${Array.from(new TextEncoder().encode(key), (byte) => byte.toString(16).padStart(2, '0')).join('')}`;

const previousManagedHeaderNames = (request: ApiRequest | undefined) => new Set(sanitizedStrings(asRecord(request?.source?.unsupported)?.managedHeaderNames).map((name) => name.toLowerCase()));

const preserveLocalCollection = (generated: Collection, previous: Collection | undefined): Collection => {
  const folders = previous?.folders ?? [];
  const folderIds = new Set(folders.map((folder) => folder.id));
  const requests = generated.requests.map((request) => ({
    ...request,
    folderId: request.folderId && folderIds.has(request.folderId) ? request.folderId : '',
  }));
  const validIds = new Set([...folderIds, ...requests.map((request) => request.id)]);
  const seen = new Set<string>();
  const resourceOrder = [
    ...(previous?.resourceOrder ?? []),
    ...folders.map((folder) => folder.id),
    ...requests.map((request) => request.id),
  ].filter((id) => validIds.has(id) && !seen.has(id) && Boolean(seen.add(id)));
  return {
    ...generated,
    requests,
    folders,
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
    const route = sanitizeRoute(record);
    const protocols = route.protocols;
    const serviceId = sourceId(route.service);
    const supported = protocols.some((protocol) => ['http', 'https', 'ws', 'wss', 'grpc', 'grpcs'].includes(protocol));
    const reason = !serviceId ? 'Route has no Gateway Service.'
      : route.snis.length ? 'Route uses SNI matching, which request URLs cannot override.'
        : route.hasExpression ? 'Expression-router routes require reviewed expression conversion.'
          : !supported ? `Unsupported protocol: ${protocols.join(', ') || 'none'}.`
            : '';
    if (reason) {
      skipped.push({ route, reason });
      return;
    }
    routes.set(serviceId, [...(routes.get(serviceId) ?? []), route]);
  });
  const collections: Collection[] = [];
  const variables = new Set<string>();
  const variableDefaults: Record<string, string> = {};
  services.forEach((service, serviceId) => {
    const existing = existingCollections.get(serviceId);
    const existingRequests = new Map(existing?.requests.map((request) => [request.source?.sourceId, request]) ?? []);
    const consumedPrevious = new Set<string>();
    const generatedKeys = new Set<string>();
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
      const managedHeaders = [
        ...(route.hosts[0] ? [{ name: 'Host', value: route.hosts[0] }] : []),
        ...Object.entries(route.headers).map(([name, values]) => ({ name, value: values[0] })),
      ];
      const grpcProtocols = route.protocols.filter((protocol) => protocol === 'grpc' || protocol === 'grpcs');
      const wsProtocols = route.protocols.filter((protocol) => protocol === 'ws' || protocol === 'wss');
      const protocols = grpcProtocols.length ? grpcProtocols : wsProtocols.length ? wsProtocols : route.protocols.filter((protocol) => protocol === 'http' || protocol === 'https');
      protocols.forEach((protocol) => {
        const variable = serviceVariable(serviceId, protocol);
        variables.add(variable);
        variableDefaults[variable] = defaultProxyUrl(protocol);
        paths.forEach((rawPath) => {
          const resolved = resolveKonnectPath(rawPath);
          const methods = protocol === 'http' || protocol === 'https'
            ? (route.methods.length ? route.methods : ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']).map((method) => normalizeHttpMethod(method, '')).filter(Boolean)
            : [''];
          methods.forEach((method) => {
            const family = protocol === 'grpc' || protocol === 'grpcs' ? 'grpc' : protocol === 'ws' || protocol === 'wss' ? 'ws' : 'http';
            const key = family === 'http' ? `${routeId}:${method}:${rawPath}:${protocol}` : `${routeId}:${family}:${rawPath}:${protocol}`;
            if (generatedKeys.has(key)) return;
            generatedKeys.add(key);
            const previous = previousFor(key, routeId);
            const generated = createBlankRequest(routeRequestId(key));
            generated.name = route.name || resolved.path || routeName;
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
  return { collections, variables: [...variables], variableDefaults, skipped: skipped.length };
};

export const syncKonnectRoutes = async (workspace: Workspace, environment: Environment | undefined, context: SendRequestContext) => {
  const config = workspace.konnect;
  if (!config.enabled) throw new Error('Enable the Konnect integration before syncing.');
  if (!config.controlPlaneId) throw new Error('Choose a Konnect control plane.');
  const encoded = encodeURIComponent(config.controlPlaneId);
  const [services, routes] = await Promise.all([
    getAll(config, `/v2/control-planes/${encoded}/core-entities/services`, environment, context),
    getAll(config, `/v2/control-planes/${encoded}/core-entities/routes`, environment, context),
  ]);
  const mapped = mapKonnectResources(workspace, services, routes);
  const localCollections = workspace.collections.filter((collection) => collection.source?.format !== 'konnect');
  const environments = workspace.environments.map((candidate) => candidate.id !== workspace.activeEnvironmentId ? candidate : {
    ...candidate,
    variables: [...candidate.variables, ...mapped.variables.filter((name) => !candidate.variables.some((variable) => variable.name === name)).map((name) => ({ id: `konnect-variable-${crypto.randomUUID()}`, name, value: mapped.variableDefaults[name], enabled: true }))],
  });
  return {
    workspace: {
      ...workspace,
      collections: [...localCollections, ...mapped.collections],
      environments,
      konnect: { ...config, lastSyncedAt: new Date().toISOString() },
    },
    services: services.length,
    routes: routes.length,
    skipped: mapped.skipped,
  };
};
