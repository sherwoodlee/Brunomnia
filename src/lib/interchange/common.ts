import { createBlankRequest } from '../../data/seed';
import type { ApiRequest, AuthConfig, HttpMethod, ImportWarning, JsonValue, KeyValue, SourceMetadata } from '../../types';

export type UnknownRecord = Record<string, unknown>;

export const asRecord = (value: unknown): UnknownRecord | undefined => value !== null && typeof value === 'object' && !Array.isArray(value)
  ? value as UnknownRecord : undefined;
export const asArray = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
export const asString = (value: unknown, fallback = ''): string => typeof value === 'string' ? value : fallback;
export const asBoolean = (value: unknown, fallback = false): boolean => typeof value === 'boolean' ? value : fallback;
export const asNumber = (value: unknown, fallback = 0): number => typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const hash = (value: string) => {
  let output = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    output ^= value.charCodeAt(index);
    output = Math.imul(output, 16777619);
  }
  return (output >>> 0).toString(36);
};

export const sourceId = (prefix: string, format: string, value: string, index = 0) => `${prefix}-${hash(`${format}:${value}:${index}`)}`;

export const toJsonValue = (value: unknown): JsonValue => {
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.map(toJsonValue);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, toJsonValue(entry)]));
  return String(value ?? '');
};

const supportedMethods = new Set<HttpMethod>(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS', 'TRACE']);

export const normalizeMethod = (value: unknown, warnings: ImportWarning[], resource: string): HttpMethod => {
  const method = asString(value, 'GET').toUpperCase();
  if (supportedMethods.has(method as HttpMethod)) return method as HttpMethod;
  warnings.push({ code: 'unsupported-method', message: `Method ${method || '(empty)'} was converted to GET.`, resource });
  return 'GET';
};

export const keyValues = (
  input: unknown,
  prefix: string,
  keys: { name?: string; value?: string; disabled?: string } = {},
): KeyValue[] => asArray(input).flatMap((entry, index) => {
  const item = asRecord(entry);
  if (!item) return [];
  const nameKey = keys.name ?? 'name';
  const valueKey = keys.value ?? 'value';
  const disabledKey = keys.disabled ?? 'disabled';
  return [{
    id: `${prefix}-${index}`,
    name: asString(item[nameKey] ?? item.key),
    value: asString(item[valueKey]),
    enabled: !asBoolean(item[disabledKey]),
  }];
});

export const objectVariables = (value: unknown, prefix: string): KeyValue[] => {
  const record = asRecord(value);
  if (!record) return [];
  return Object.entries(record).map(([name, entry], index) => ({
    id: `${prefix}-${index}`,
    name,
    value: typeof entry === 'string' ? entry : JSON.stringify(entry),
    enabled: true,
  }));
};

export const sourceMetadata = (format: string, id: unknown, unsupported?: UnknownRecord): SourceMetadata => ({
  format,
  sourceId: asString(id) || undefined,
  unsupported: unsupported && Object.keys(unsupported).length ? Object.fromEntries(Object.entries(unsupported).map(([key, value]) => [key, toJsonValue(value)])) : undefined,
});

export const requestFrom = (format: string, identity: string, index: number): ApiRequest => {
  const request = createBlankRequest(sourceId('request', format, identity, index));
  request.source = sourceMetadata(format, identity);
  return request;
};

export const emptyAuth = (): AuthConfig => ({
  type: 'none', token: '', username: '', password: '', apiKeyName: 'X-API-Key', apiKeyValue: '', apiKeyLocation: 'header',
});

export const decodeBase64 = (value: string): string => {
  try {
    if (typeof atob === 'function') return atob(value);
    return value;
  } catch {
    return value;
  }
};

export const stripQuery = (url: string) => {
  const index = url.indexOf('?');
  return index >= 0 ? url.slice(0, index) : url;
};

export const fileStem = (sourceName: string) => sourceName.replace(/^.*[\\/]/, '').replace(/\.[^.]+$/, '') || 'Imported API';
