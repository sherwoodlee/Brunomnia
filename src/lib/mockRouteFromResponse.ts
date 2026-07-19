import type { HttpMethod, MockRoute, MockServer, StoredResponse } from '../types';

const MAX_MOCK_RESPONSE_BODY_CHARS = 10_000_000;
const supportedMethods = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS', 'TRACE']);
const omittedHeaders = new Set(['connection', 'content-encoding', 'content-length', 'transfer-encoding']);

const headerValue = (response: StoredResponse, name: string) => Object.entries(response.headers)
  .find(([candidate]) => candidate.toLowerCase() === name)?.[1] ?? '';

const responsePath = (value: string) => {
  try { return new URL(value).pathname || '/'; } catch { /* use a conservative relative-path fallback */ }
  const relative = value.split(/[?#]/, 1)[0].trim();
  return relative.startsWith('/') ? relative || '/' : '/new-route';
};

const isTextResponse = (response: StoredResponse) => {
  if (!response.body) return true;
  const mimeType = headerValue(response, 'content-type').split(';', 1)[0].trim().toLowerCase();
  if (!mimeType) return response.bodyBase64 === undefined;
  return mimeType.startsWith('text/')
    || mimeType === 'image/svg+xml'
    || /(?:^|\/|\+)(?:json|xml|yaml)$/.test(mimeType)
    || ['application/graphql', 'application/javascript', 'application/x-javascript', 'application/x-www-form-urlencoded'].includes(mimeType);
};

const responseRouteFields = (response: StoredResponse, routeId: string): Pick<MockRoute, 'status' | 'headers' | 'body'> => {
  if (!isTextResponse(response)) throw new Error('This response is binary. Brunomnia mock routes currently store text bodies only.');
  if (response.body.length > MAX_MOCK_RESPONSE_BODY_CHARS) throw new Error('This response body exceeds the 10,000,000-character mock route limit.');
  const headers = Object.entries(response.headers)
    .filter(([name]) => !omittedHeaders.has(name.toLowerCase()))
    .slice(0, 1_000)
    .map(([name, value], index) => ({ id: `${routeId}-header-${index}`, name, value, enabled: true }));
  return {
    status: Math.min(599, Math.max(100, Math.round(response.status) || 200)),
    headers,
    body: response.body,
  };
};

export const createMockRouteFromResponse = (response: StoredResponse, routeId = `response-route-${crypto.randomUUID()}`): MockRoute => {
  const method = (response.requestSnapshot?.method ?? 'GET').toUpperCase();
  const safeMethod: HttpMethod = supportedMethods.has(method) ? method as HttpMethod : 'GET';
  const path = responsePath(response.requestUrl || response.requestSnapshot?.url || '');
  return {
    id: routeId,
    name: `${safeMethod} ${path} · ${response.status}`,
    enabled: true,
    method: safeMethod,
    path,
    ...responseRouteFields(response, routeId),
    delayMs: 0,
  };
};

export const overwriteMockRouteFromResponse = (route: MockRoute, response: StoredResponse): MockRoute => ({
  ...route,
  ...responseRouteFields(response, route.id),
});

export type ResponseMockTarget = {
  serverId?: string;
  routeId?: string;
  newServerId: string;
  newRouteId: string;
  newServerName?: string;
  path?: string;
  method?: HttpMethod;
};

export type AppliedResponseMockTarget = {
  mockServers: MockServer[];
  serverId: string;
  routeId: string;
  action: 'created-server' | 'created-route' | 'overwritten-route';
};

const nextMockPort = (servers: MockServer[]) => {
  const used = new Set(servers.map((server) => server.port));
  for (let port = 4_010; port <= 65_535; port += 1) if (!used.has(port)) return port;
  for (let port = 1_024; port < 4_010; port += 1) if (!used.has(port)) return port;
  throw new Error('No local mock server port is available.');
};

const createdRoute = (response: StoredResponse, target: ResponseMockTarget) => {
  if (!target.newRouteId.trim()) throw new Error('A new mock route ID is required.');
  const route = createMockRouteFromResponse(response, target.newRouteId);
  const path = (target.path ?? route.path).trim();
  const method = target.method ?? route.method;
  if (!path.startsWith('/')) throw new Error('Mock route paths must begin with /.');
  if (path.length > 2_000) throw new Error('Mock route paths must be 2,000 characters or fewer.');
  if (!supportedMethods.has(method)) throw new Error(`Unsupported mock route method '${method}'.`);
  return { ...route, method, path, name: `${method} ${path} · ${route.status}` };
};

export const applyResponseToMockTarget = (
  mockServers: MockServer[],
  response: StoredResponse,
  target: ResponseMockTarget,
): AppliedResponseMockTarget => {
  if (!target.serverId) {
    if (target.routeId) throw new Error('A mock route cannot be selected without its server.');
    if (!target.newServerId.trim()) throw new Error('A new mock server ID is required.');
    if (mockServers.some((server) => server.id === target.newServerId)) throw new Error('The new mock server ID already exists.');
    const route = createdRoute(response, target);
    const server: MockServer = {
      id: target.newServerId,
      name: target.newServerName?.trim().slice(0, 120) || 'Response mock',
      host: '127.0.0.1',
      port: nextMockPort(mockServers),
      routes: [route],
    };
    return { mockServers: [...mockServers, server], serverId: server.id, routeId: route.id, action: 'created-server' };
  }

  const server = mockServers.find((candidate) => candidate.id === target.serverId);
  if (!server) throw new Error('The selected mock server no longer exists.');
  if (target.routeId) {
    const route = server.routes.find((candidate) => candidate.id === target.routeId);
    if (!route) throw new Error('The selected mock route no longer exists.');
    const updated = overwriteMockRouteFromResponse(route, response);
    return {
      mockServers: mockServers.map((candidate) => candidate.id === server.id ? { ...candidate, routes: candidate.routes.map((item) => item.id === route.id ? updated : item) } : candidate),
      serverId: server.id,
      routeId: route.id,
      action: 'overwritten-route',
    };
  }

  const route = createdRoute(response, target);
  const conflict = server.routes.find((candidate) => candidate.path === route.path && candidate.method.toUpperCase() === route.method.toUpperCase());
  if (conflict) throw new Error(`${route.method} ${route.path} already exists in ${server.name}. Select that route to overwrite it.`);
  if (server.routes.some((candidate) => candidate.id === route.id)) throw new Error('The new mock route ID already exists.');
  return {
    mockServers: mockServers.map((candidate) => candidate.id === server.id ? { ...candidate, routes: [...candidate.routes, route] } : candidate),
    serverId: server.id,
    routeId: route.id,
    action: 'created-route',
  };
};
