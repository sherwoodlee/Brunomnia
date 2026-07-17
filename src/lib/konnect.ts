import type { Collection, Environment, JsonValue, KonnectConfig, KonnectControlPlane, Workspace } from '../types';
import { createBlankRequest } from '../data/seed';
import { sendRequest, type SendRequestContext } from './http';
import { isProtectedSecretReference } from './security';

const asRecord = (value: unknown) => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
const asString = (value: unknown) => typeof value === 'string' ? value : '';
const asStrings = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
const sourceId = (value: unknown) => asString(asRecord(value)?.id);
const allowedMethods = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);

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

const serviceVariable = (serviceId: string) => `konnect_${serviceId.replace(/[^a-z0-9_]/gi, '_')}_proxy_host`;

export const mapKonnectResources = (workspace: Workspace, servicesSource: unknown[], routesSource: unknown[]) => {
  const services = new Map(servicesSource.flatMap((item) => {
    const service = asRecord(item);
    const id = asString(service?.id);
    return service && id ? [[id, service] as const] : [];
  }));
  const existingCollections = new Map(workspace.collections
    .filter((collection) => collection.source?.format === 'konnect' && collection.source.sourceId)
    .map((collection) => [collection.source!.sourceId!, collection]));
  const routes = new Map<string, Record<string, unknown>[]>();
  const skipped: Record<string, unknown>[] = [];
  routesSource.forEach((item) => {
    const route = asRecord(item);
    if (!route) return;
    const protocols = asStrings(route.protocols);
    const serviceId = sourceId(route.service);
    if (!serviceId || !protocols.some((protocol) => protocol === 'http' || protocol === 'https')) {
      skipped.push(route);
      return;
    }
    routes.set(serviceId, [...(routes.get(serviceId) ?? []), route]);
  });
  const collections: Collection[] = [];
  const variables = new Set<string>();
  services.forEach((service, serviceId) => {
    const existing = existingCollections.get(serviceId);
    const existingRequests = new Map(existing?.requests.map((request) => [request.source?.sourceId, request]) ?? []);
    const variable = serviceVariable(serviceId);
    variables.add(variable);
    const requests = (routes.get(serviceId) ?? []).map((route) => {
      const routeId = asString(route.id);
      const previous = existingRequests.get(routeId);
      const remoteMethod = asStrings(route.methods).map((method) => method.toUpperCase()).find((method) => allowedMethods.has(method)) ?? 'GET';
      const path = asStrings(route.paths)[0] || '/';
      const generated = createBlankRequest(`konnect-route-${routeId || crypto.randomUUID()}`);
      generated.name = asString(route.name) || `${remoteMethod} ${path}`;
      generated.method = remoteMethod as typeof generated.method;
      generated.url = `{{ ${variable} }}${path}`;
      generated.headers = [];
      const host = asStrings(route.hosts)[0];
      if (host) generated.headers.push({ id: `${generated.id}-host`, name: 'Host', value: host, enabled: true });
      const routeHeaders = asRecord(route.headers) ?? {};
      Object.entries(routeHeaders).forEach(([name, value], index) => {
        const values = asStrings(value);
        if (values.length) generated.headers.push({ id: `${generated.id}-route-header-${index}`, name, value: values.join(', '), enabled: true });
      });
      generated.source = { format: 'konnect-route', sourceId: routeId, unsupported: { controlPlaneId: workspace.konnect.controlPlaneId, serviceId, protocols: asStrings(route.protocols) as JsonValue } };
      if (!previous) return generated;
      const managedNames = new Set(generated.headers.map((header) => header.name.toLowerCase()));
      return {
        ...generated,
        params: previous.params,
        headers: [...generated.headers, ...previous.headers.filter((header) => !managedNames.has(header.name.toLowerCase()))],
        bodyMode: previous.bodyMode,
        body: previous.body,
        formBody: previous.formBody,
        multipartBody: previous.multipartBody,
        binaryBody: previous.binaryBody,
        auth: previous.auth,
        transport: previous.transport,
        preRequestScript: previous.preRequestScript,
        tests: previous.tests,
      };
    });
    collections.push({
      id: existing?.id ?? `konnect-service-${serviceId}`,
      name: `Konnect · ${asString(service.name) || serviceId}`,
      expanded: existing?.expanded ?? true,
      requests,
      source: { format: 'konnect', sourceId: serviceId, unsupported: { controlPlaneId: workspace.konnect.controlPlaneId } },
    });
  });
  if (skipped.length) {
    const existing = existingCollections.get('skipped-routes');
    collections.push({
      id: existing?.id ?? 'konnect-skipped-routes',
      name: 'Konnect · Skipped Routes',
      expanded: existing?.expanded ?? false,
      source: { format: 'konnect', sourceId: 'skipped-routes' },
      requests: skipped.map((route) => {
        const id = asString(route.id) || crypto.randomUUID();
        const request = createBlankRequest(`konnect-skipped-${id}`);
        request.name = `[Unsupported] ${asString(route.name) || id}`;
        request.url = 'https://unsupported.invalid/';
        request.source = { format: 'konnect-skipped-route', sourceId: id, unsupported: { protocols: asStrings(route.protocols) as JsonValue, reason: 'Unsupported Konnect route protocol or missing service.' } };
        return request;
      }),
    });
  }
  return { collections, variables: [...variables], skipped: skipped.length };
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
    variables: [...candidate.variables, ...mapped.variables.filter((name) => !candidate.variables.some((variable) => variable.name === name)).map((name) => ({ id: `konnect-variable-${crypto.randomUUID()}`, name, value: 'http://127.0.0.1:8000', enabled: true }))],
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
