import type { JsonValue, KeyValue } from '../types';

export type EnvironmentJsonObject = { [key: string]: JsonValue };
export type EnvironmentRowsObject = {
  object?: EnvironmentJsonObject;
  error?: string;
  disabledNames: string[];
  duplicateNames: string[];
};

const reservedRootNames = new Set(['_', 'vault', '__insomnia_vault']);
const MAX_SOURCE_LENGTH = 1_000_000;
const MAX_TOP_LEVEL_KEYS = 1_000;
const MAX_TOTAL_VALUES = 10_000;
const MAX_DEPTH = 50;

const isObject = (value: JsonValue): value is EnvironmentJsonObject => value !== null && typeof value === 'object' && !Array.isArray(value);
const setValue = <T>(target: Record<string, T>, key: string, value: T) => Object.defineProperty(target, key, { configurable: true, enumerable: true, value, writable: true });

const validateObject = (value: JsonValue, isRoot = true, depth = 0, count = { value: 0 }): string | undefined => {
  if (depth > MAX_DEPTH) return `Environment JSON exceeds the ${MAX_DEPTH}-level nesting limit.`;
  if (value === null || typeof value !== 'object') return undefined;
  for (const [key, child] of Object.entries(value)) {
    count.value += 1;
    if (count.value > MAX_TOTAL_VALUES) return `Environment JSON exceeds the ${MAX_TOTAL_VALUES.toLocaleString()}-value limit.`;
    if (key.startsWith('$') || key.includes('.')) return `"${key}" cannot begin with '$' or contain a '.'.`;
    if (isRoot && reservedRootNames.has(key)) return `"${key}" is a reserved root environment key.`;
    const error = validateObject(child, false, depth + 1, count);
    if (error) return error;
  }
};

const rowValue = (row: KeyValue): { value?: JsonValue; error?: string } => {
  if (row.valueType === 'secret') return { error: `Secret variable "${row.name || '(unnamed)'}" is available only in Table view under the reserved vault namespace.` };
  if (row.valueType !== 'json') return { value: row.value };
  try {
    return { value: JSON.parse(row.value) as JsonValue };
  } catch (error) {
    return { error: `Variable "${row.name || '(unnamed)'}" contains invalid JSON: ${error instanceof Error ? error.message : String(error)}` };
  }
};

export const environmentRowsToObject = (rows: KeyValue[]): EnvironmentRowsObject => {
  const object: EnvironmentJsonObject = {};
  const disabledNames: string[] = [];
  const duplicateNames: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const name = row.name.trim();
    if (!name) continue;
    if (!row.enabled) {
      disabledNames.push(name);
      continue;
    }
    if (seen.has(name) && !duplicateNames.includes(name)) duplicateNames.push(name);
    seen.add(name);
    const parsed = rowValue(row);
    if (parsed.error) return { error: parsed.error, disabledNames, duplicateNames };
    setValue(object, name, parsed.value ?? null);
  }
  if (Object.keys(object).length > MAX_TOP_LEVEL_KEYS) return { error: `Environment JSON exceeds the ${MAX_TOP_LEVEL_KEYS.toLocaleString()} top-level key limit.`, disabledNames, duplicateNames };
  const error = validateObject(object);
  return error ? { error, disabledNames, duplicateNames } : { object, disabledNames, duplicateNames };
};

export const validateEnvironmentJsonRow = (rows: KeyValue[], rowId: string, value: string) => environmentRowsToObject(rows
  .map((row) => row.id === rowId ? { ...row, value, valueType: 'json' as const } : row)
  .filter((row) => row.valueType !== 'secret')).error ?? '';

const jsonRowValue = (value: JsonValue): Pick<KeyValue, 'value' | 'valueType'> => value !== null && typeof value === 'object'
  ? { value: JSON.stringify(value), valueType: 'json' }
  : { value: String(value), valueType: 'string' };

export const parseEnvironmentJson = (source: string, existing: KeyValue[], createId: () => string): { rows?: KeyValue[]; error?: string } => {
  if (source.length > MAX_SOURCE_LENGTH) return { error: `Environment JSON exceeds the ${MAX_SOURCE_LENGTH.toLocaleString()}-character limit.` };
  let parsed: JsonValue;
  try {
    parsed = JSON.parse(source) as JsonValue;
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
  if (!isObject(parsed)) return { error: 'Environment JSON must be an object at the root.' };
  if (Object.keys(parsed).length > MAX_TOP_LEVEL_KEYS) return { error: `Environment JSON exceeds the ${MAX_TOP_LEVEL_KEYS.toLocaleString()} top-level key limit.` };
  const error = validateObject(parsed);
  if (error) return { error };
  const existingByName = new Map(existing.filter((row) => row.enabled && row.name.trim()).map((row) => [row.name.trim(), row]));
  return {
    rows: Object.entries(parsed).map(([name, value]) => ({
      ...(existingByName.get(name) ?? { id: createId(), name, enabled: true }),
      name,
      enabled: true,
      ...jsonRowValue(value),
    })),
  };
};

export const formatEnvironmentJson = (rows: KeyValue[]): { source?: string; error?: string; disabledNames: string[]; duplicateNames: string[] } => {
  const result = environmentRowsToObject(rows);
  return {
    ...(result.object ? { source: JSON.stringify(result.object, null, 2) } : {}),
    ...(result.error ? { error: result.error } : {}),
    disabledNames: result.disabledNames,
    duplicateNames: result.duplicateNames,
  };
};

const scalarText = (value: JsonValue) => value !== null && typeof value === 'object' ? JSON.stringify(value) : String(value);

export const environmentRowVariables = (row: KeyValue): Record<string, string> => {
  const name = row.name.trim();
  if (!name || !row.enabled || row.valueType === 'secret') return {};
  const output: Record<string, string> = { [name]: row.value };
  if (row.valueType !== 'json') return output;
  let parsed: JsonValue;
  try { parsed = JSON.parse(row.value) as JsonValue; } catch { return output; }
  let count = 0;
  const append = (value: JsonValue, path: string, depth: number) => {
    if (depth > 20 || count >= MAX_TOTAL_VALUES || value === null || typeof value !== 'object') return;
    Object.entries(value).slice(0, 1_000).forEach(([key, child]) => {
      if (count >= MAX_TOTAL_VALUES) return;
      count += 1;
      const childPath = `${path}.${key}`;
      setValue(output, childPath, scalarText(child));
      append(child, childPath, depth + 1);
    });
  };
  append(parsed, name, 0);
  return output;
};

export const environmentVariables = (rows: KeyValue[]): Record<string, string> => {
  const output: Record<string, string> = {};
  rows.forEach((row) => {
    const name = row.name.trim();
    if (!name) return;
    Object.keys(output).filter((key) => key === name || key.startsWith(`${name}.`)).forEach((key) => delete output[key]);
    if (row.enabled) Object.entries(environmentRowVariables(row)).forEach(([key, value]) => setValue(output, key, value));
  });
  return output;
};
