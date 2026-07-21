import type { ApiRequest, BodyMode, Environment, HttpResponse, KeyValue } from '../types';
import { environmentVariables } from './environmentJson';

const templatePattern = /{{\s*([^{}]+?)\s*}}/g;
const methodPattern = /^[!#$%&'*+.^_`|~0-9A-Z-]+$/;

export const normalizeHttpMethod = (value: string, fallback = 'GET'): string => {
  const method = value.trim().toUpperCase();
  return method && method.length <= 32 && methodPattern.test(method) ? method : fallback;
};

export const environmentMap = (environment: Environment | undefined): Record<string, string> => environmentVariables(environment?.variables ?? []);

export const resolveTemplate = (value: string, variables: Record<string, string>): string =>
  value.replace(templatePattern, (match, name: string) => Object.hasOwn(variables, name) ? variables[name] : match);

export const buildRequestUrl = (request: ApiRequest, variables: Record<string, string>): string => {
  let rawUrl = resolveTemplate(request.url, variables);
  (request.pathParams ?? []).filter((parameter) => parameter.enabled && parameter.name.trim()).forEach((parameter) => {
    const name = resolveTemplate(parameter.name, variables).trim();
    const rawValue = resolveTemplate(parameter.value, variables);
    const value = request.encodeUrl === false ? rawValue : encodeURIComponent(rawValue);
    rawUrl = rawUrl.split(`{${name}}`).join(value);
  });
  const enabledParams = request.params.filter((param) => param.enabled && param.name.trim());
  if (enabledParams.length === 0) return rawUrl;

  if (request.encodeUrl === false) {
    const hashIndex = rawUrl.indexOf('#');
    const base = hashIndex < 0 ? rawUrl : rawUrl.slice(0, hashIndex);
    const hash = hashIndex < 0 ? '' : rawUrl.slice(hashIndex);
    const separator = base.includes('?') ? base.endsWith('?') || base.endsWith('&') ? '' : '&' : '?';
    const query = enabledParams.map((param) => `${resolveTemplate(param.name, variables)}=${resolveTemplate(param.value, variables)}`).join('&');
    return `${base}${separator}${query}${hash}`;
  }

  const url = new URL(rawUrl);
  for (const param of enabledParams) {
    url.searchParams.append(resolveTemplate(param.name, variables), resolveTemplate(param.value, variables));
  }
  return url.toString();
};

export const buildHeaders = (request: ApiRequest, variables: Record<string, string>): KeyValue[] => {
  const headers = request.headers.map((header) => ({
    ...header,
    name: resolveTemplate(header.name, variables),
    value: resolveTemplate(header.value, variables),
  }));

  if (!request.auth.disabled && request.auth.type === 'bearer' && request.auth.token) {
    const prefix = resolveTemplate(request.auth.prefix, variables) || 'Bearer';
    headers.push({ id: 'auth-bearer', name: 'Authorization', value: `${prefix} ${resolveTemplate(request.auth.token, variables)}`.trim(), enabled: true });
  }
  if (!request.auth.disabled && request.auth.type === 'basic' && (request.auth.username || request.auth.password)) {
    const credentials = new TextEncoder().encode(`${resolveTemplate(request.auth.username, variables)}:${resolveTemplate(request.auth.password, variables)}`);
    headers.push({
      id: 'auth-basic',
      name: 'Authorization',
      value: `Basic ${btoa(String.fromCharCode(...credentials))}`,
      enabled: true,
    });
  }
  if (!request.auth.disabled && request.auth.type === 'api-key' && request.auth.apiKeyLocation === 'header' && request.auth.apiKeyName) {
    headers.push({
      id: 'auth-api-key',
      name: resolveTemplate(request.auth.apiKeyName, variables),
      value: resolveTemplate(request.auth.apiKeyValue, variables),
      enabled: true,
    });
  }
  return headers;
};

export const formatBytes = (size: number): string => {
  if (size < 1024) return `${size} B`;
  return `${(size / 1024).toFixed(1)} KB`;
};

export const prettyBody = (body: string): string => {
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
  }
};

const prettyXml = (body: string) => {
  const source = body.trim().replace(/>\s*</g, '><').replace(/></g, '>\n<');
  if (!source.startsWith('<') || !source.endsWith('>')) return body;
  let depth = 0;
  return source.split('\n').map((line) => {
    const closing = /^<\//.test(line);
    if (closing) depth = Math.max(0, depth - 1);
    const output = `${'  '.repeat(depth)}${line}`;
    const opens = /^<[^!?/][^>]*[^/]?>$/.test(line) && !/<\/[^>]+>$/.test(line);
    if (opens) depth += 1;
    return output;
  }).join('\n');
};

export const prettyRequestBody = (request: ApiRequest): string => {
  if (request.bodyMode === 'json') return prettyBody(request.body);
  const contentType = request.headers.find((header) => header.enabled && header.name.toLowerCase() === 'content-type')?.value.toLowerCase() ?? '';
  if (request.bodyMode === 'text' && (contentType.includes('xml') || /^\s*<[^>]+>/.test(request.body))) return prettyXml(request.body);
  return request.body;
};

const withoutContentType = (request: ApiRequest) => request.headers.filter((header) => header.name.toLowerCase() !== 'content-type');

export const requestBodyContentType = (request: ApiRequest): string => request.headers.find(
  (header) => header.enabled && header.name.toLowerCase() === 'content-type',
)?.value ?? (request.bodyMode === 'json' ? 'application/json' : request.bodyMode === 'text' ? 'text/plain' : '');

export const changeRequestBodyContentType = (request: ApiRequest, value: string): Partial<ApiRequest> => ({
  bodyMode: value.toLowerCase().includes('json') ? 'json' : 'text',
  headers: [{ ...(request.headers.find((header) => header.name.toLowerCase() === 'content-type') ?? { id: `${request.id}-body-content-type`, name: 'Content-Type' }), value, enabled: true }, ...withoutContentType(request)],
});

export const changeRequestBodyMode = (request: ApiRequest, bodyMode: BodyMode): Partial<ApiRequest> => {
  if (request.bodyMode === bodyMode) return { bodyMode };
  const contentTypes: Partial<Record<BodyMode, string>> = {
    json: 'application/json',
    text: 'text/plain',
    'form-urlencoded': 'application/x-www-form-urlencoded',
    multipart: 'multipart/form-data',
  };
  const contentType = contentTypes[bodyMode];
  if (!contentType) return { bodyMode, headers: withoutContentType(request) };
  return {
    bodyMode,
    headers: [{ ...(request.headers.find((header) => header.name.toLowerCase() === 'content-type') ?? { id: `${request.id}-body-content-type`, name: 'Content-Type' }), value: contentType, enabled: true }, ...withoutContentType(request)],
  };
};

export const mockResponse = (): HttpResponse => {
  const body = JSON.stringify(
    {
      id: 'ord_abc123',
      status: 'created',
      createdAt: new Date().toISOString(),
      customerId: 'cus_12345',
      items: [
        { productId: 'prod_98765', name: 'Wireless Headphones', quantity: 2, unitPrice: 49.99, total: 99.98 },
        { productId: 'prod_56789', name: 'USB-C Cable', quantity: 1, unitPrice: 19.99, total: 19.99 },
      ],
    },
    null,
    2,
  );
  return {
    status: 200,
    statusText: 'OK',
    durationMs: 184,
    sizeBytes: new Blob([body]).size,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-request-id': 'req_91e0d2',
    },
    body,
  };
};
