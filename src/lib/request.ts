import type { ApiRequest, Environment, HttpResponse, KeyValue } from '../types';

const templatePattern = /{{\s*([^{}]+?)\s*}}/g;

export const environmentMap = (environment: Environment | undefined): Record<string, string> =>
  Object.fromEntries(
    (environment?.variables ?? [])
      .filter((variable) => variable.enabled && variable.name.trim())
      .map((variable) => [variable.name.trim(), variable.value]),
  );

export const resolveTemplate = (value: string, variables: Record<string, string>): string =>
  value.replace(templatePattern, (match, name: string) => variables[name] ?? match);

export const buildRequestUrl = (request: ApiRequest, variables: Record<string, string>): string => {
  const rawUrl = resolveTemplate(request.url, variables);
  const enabledParams = request.params.filter((param) => param.enabled && param.name.trim());
  if (enabledParams.length === 0) return rawUrl;

  const url = new URL(rawUrl);
  for (const param of enabledParams) {
    url.searchParams.set(resolveTemplate(param.name, variables), resolveTemplate(param.value, variables));
  }
  return url.toString();
};

export const buildHeaders = (request: ApiRequest, variables: Record<string, string>): KeyValue[] => {
  const headers = request.headers.map((header) => ({
    ...header,
    name: resolveTemplate(header.name, variables),
    value: resolveTemplate(header.value, variables),
  }));

  if (request.auth.type === 'bearer' && request.auth.token) {
    headers.push({ id: 'auth-bearer', name: 'Authorization', value: `Bearer ${resolveTemplate(request.auth.token, variables)}`, enabled: true });
  }
  if (request.auth.type === 'basic' && (request.auth.username || request.auth.password)) {
    headers.push({
      id: 'auth-basic',
      name: 'Authorization',
      value: `Basic ${btoa(`${resolveTemplate(request.auth.username, variables)}:${resolveTemplate(request.auth.password, variables)}`)}`,
      enabled: true,
    });
  }
  if (request.auth.type === 'api-key' && request.auth.apiKeyLocation === 'header' && request.auth.apiKeyName) {
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
