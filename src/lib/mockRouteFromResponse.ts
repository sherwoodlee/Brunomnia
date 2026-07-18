import type { HttpMethod, MockRoute, StoredResponse } from '../types';

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
