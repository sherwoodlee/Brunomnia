import type { JsonValue } from '../types';

export type McpParameterPath = Array<string | number>;
export type McpParameterType = 'object' | 'array' | 'string' | 'number' | 'integer' | 'boolean' | 'null' | 'unknown';
export type McpParameterOption = { label: string; value: JsonValue };
export type McpParameterProperty = { name: string; required: boolean; schema: JsonValue };
export type McpParameterVariant = { title: string; schema: JsonValue };
export type McpParameterSchemaNode = {
  type: McpParameterType;
  title: string;
  description: string;
  properties: McpParameterProperty[];
  itemSchema?: JsonValue;
  additionalProperties: false | JsonValue;
  additionalPropertiesForbidden: boolean;
  options: McpParameterOption[];
  variants: McpParameterVariant[];
  variantIndex: number;
  defaultValue?: JsonValue;
  readOnly: boolean;
  truncated: boolean;
};

type UnknownRecord = Record<string, unknown>;

const maxSchemaDepth = 20;
const maxSchemaProperties = 200;
const maxSchemaVariants = 50;
const record = (value: unknown): UnknownRecord | undefined => value && typeof value === 'object' && !Array.isArray(value) ? value as UnknownRecord : undefined;
const jsonValue = (value: unknown): value is JsonValue => value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || Array.isArray(value) || Boolean(record(value));
const cloneJson = <T extends JsonValue>(value: T): T => structuredClone(value);
const pathKey = (path: McpParameterPath) => JSON.stringify(path);

const jsonEqual = (left: unknown, right: unknown): boolean => {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) && Array.isArray(right)) return left.length === right.length && left.every((value, index) => jsonEqual(value, right[index]));
  const leftRecord = record(left);
  const rightRecord = record(right);
  if (!leftRecord || !rightRecord) return false;
  const leftEntries = Object.entries(leftRecord);
  const rightEntries = Object.entries(rightRecord);
  return leftEntries.length === rightEntries.length && leftEntries.every(([key, value]) => Object.hasOwn(rightRecord, key) && jsonEqual(value, rightRecord[key]));
};

const mergeSchema = (left: UnknownRecord, right: UnknownRecord): UnknownRecord => {
  const merged = { ...left, ...right };
  const leftProperties = record(left.properties);
  const rightProperties = record(right.properties);
  if (leftProperties || rightProperties) merged.properties = { ...leftProperties, ...rightProperties };
  const leftDefinitions = record(left.$defs);
  const rightDefinitions = record(right.$defs);
  if (leftDefinitions || rightDefinitions) merged.$defs = { ...leftDefinitions, ...rightDefinitions };
  const leftLegacyDefinitions = record(left.definitions);
  const rightLegacyDefinitions = record(right.definitions);
  if (leftLegacyDefinitions || rightLegacyDefinitions) merged.definitions = { ...leftLegacyDefinitions, ...rightLegacyDefinitions };
  if (Array.isArray(left.required) || Array.isArray(right.required)) {
    merged.required = [...new Set([...(Array.isArray(left.required) ? left.required : []), ...(Array.isArray(right.required) ? right.required : [])].filter((value): value is string => typeof value === 'string'))].slice(0, maxSchemaProperties);
  }
  return merged;
};

const withoutKeys = (source: UnknownRecord, keys: string[]) => Object.fromEntries(Object.entries(source).filter(([key]) => !keys.includes(key)));

const pointerValue = (root: JsonValue, reference: string): JsonValue | undefined => {
  if (reference === '#') return root;
  if (!reference.startsWith('#/')) return undefined;
  let current: unknown = root;
  const segments = reference.slice(2).split('/');
  if (segments.length > 100) return undefined;
  for (const rawSegment of segments) {
    const segment = rawSegment.replace(/~1/g, '/').replace(/~0/g, '~');
    const currentRecord = record(current);
    if (currentRecord && Object.hasOwn(currentRecord, segment)) current = currentRecord[segment];
    else if (Array.isArray(current) && /^\d+$/.test(segment)) current = current[Number(segment)];
    else return undefined;
  }
  return jsonValue(current) ? current : undefined;
};

const schemaTypes = (value: unknown): McpParameterType[] => (Array.isArray(value) ? value : [value]).flatMap((type): McpParameterType[] => (
  type === 'object' || type === 'array' || type === 'string' || type === 'number' || type === 'integer' || type === 'boolean' || type === 'null' ? [type] : []
));

const valueMatchesType = (type: McpParameterType, value: unknown) => {
  if (type === 'null') return value === null;
  if (type === 'array') return Array.isArray(value);
  if (type === 'object') return Boolean(record(value));
  if (type === 'integer') return typeof value === 'number' && Number.isInteger(value);
  return type === 'unknown' || typeof value === type;
};

const resolveReference = (schema: UnknownRecord, root: JsonValue, references: Set<string>, depth: number): UnknownRecord => {
  const reference = typeof schema.$ref === 'string' ? schema.$ref : '';
  if (!reference || references.has(reference) || depth >= maxSchemaDepth) return withoutKeys(schema, ['$ref']);
  const target = pointerValue(root, reference);
  const targetRecord = record(target);
  if (!targetRecord) return withoutKeys(schema, ['$ref']);
  const nextReferences = new Set(references).add(reference);
  return mergeSchema(resolveReference(targetRecord, root, nextReferences, depth + 1), withoutKeys(schema, ['$ref']));
};

const matchesSchema = (schemaValue: unknown, value: unknown, root: JsonValue, depth = 0, references = new Set<string>()): boolean => {
  if (schemaValue === true) return true;
  if (schemaValue === false || depth >= maxSchemaDepth) return schemaValue !== false;
  const rawSchema = record(schemaValue);
  if (!rawSchema) return true;
  const schema = resolveReference(rawSchema, root, references, depth);
  if (Object.hasOwn(schema, 'const') && !jsonEqual(value, schema.const)) return false;
  if (Array.isArray(schema.enum) && !schema.enum.some((entry) => jsonEqual(value, entry))) return false;
  const types = schemaTypes(schema.type);
  if (types.length && !types.some((type) => valueMatchesType(type, value))) return false;
  if (typeof value === 'number') {
    if (typeof schema.minimum === 'number' && value < schema.minimum) return false;
    if (typeof schema.maximum === 'number' && value > schema.maximum) return false;
  }
  if (typeof value === 'string') {
    if (typeof schema.minLength === 'number' && value.length < schema.minLength) return false;
    if (typeof schema.maxLength === 'number' && value.length > schema.maxLength) return false;
  }
  const valueRecord = record(value);
  if (valueRecord) {
    const required = Array.isArray(schema.required) ? schema.required.filter((entry): entry is string => typeof entry === 'string') : [];
    if (required.some((name) => !Object.hasOwn(valueRecord, name))) return false;
    const properties = record(schema.properties);
    if (properties && Object.entries(properties).some(([name, property]) => Object.hasOwn(valueRecord, name) && !matchesSchema(property, valueRecord[name], root, depth + 1, references))) return false;
  }
  if (Array.isArray(schema.allOf) && schema.allOf.some((branch) => !matchesSchema(branch, value, root, depth + 1, references))) return false;
  if (Array.isArray(schema.anyOf) && !schema.anyOf.some((branch) => matchesSchema(branch, value, root, depth + 1, references))) return false;
  if (Array.isArray(schema.oneOf) && schema.oneOf.filter((branch) => matchesSchema(branch, value, root, depth + 1, references)).length !== 1) return false;
  if (schema.not !== undefined && matchesSchema(schema.not, value, root, depth + 1, references)) return false;
  return true;
};

const variantTitle = (schema: UnknownRecord, index: number) => typeof schema.title === 'string' && schema.title ? schema.title : `Option ${index + 1}`;

const composeSchema = (
  rawSchema: UnknownRecord,
  root: JsonValue,
  value: unknown,
  preferredVariant: number | undefined,
  references = new Set<string>(),
  depth = 0,
): { schema: UnknownRecord; variants: McpParameterVariant[]; variantIndex: number; truncated: boolean } => {
  if (depth >= maxSchemaDepth) return { schema: {}, variants: [], variantIndex: 0, truncated: true };
  let schema = resolveReference(rawSchema, root, references, depth);
  let truncated = false;
  const allOf = Array.isArray(schema.allOf) ? schema.allOf.slice(0, maxSchemaVariants) : [];
  if (Array.isArray(schema.allOf) && schema.allOf.length > maxSchemaVariants) truncated = true;
  schema = withoutKeys(schema, ['allOf']);
  allOf.forEach((branch) => {
    const branchRecord = record(branch);
    if (!branchRecord) return;
    const composed = composeSchema(branchRecord, root, value, undefined, references, depth + 1);
    schema = mergeSchema(schema, composed.schema);
    truncated ||= composed.truncated;
  });

  const rawVariants = (Array.isArray(schema.oneOf) ? schema.oneOf : Array.isArray(schema.anyOf) ? schema.anyOf : [])
    .slice(0, maxSchemaVariants)
    .flatMap((branch, index): McpParameterVariant[] => {
      const branchRecord = record(branch);
      return branchRecord ? [{ title: variantTitle(branchRecord, index), schema: branch as JsonValue }] : [];
    });
  if ((Array.isArray(schema.oneOf) && schema.oneOf.length > maxSchemaVariants) || (Array.isArray(schema.anyOf) && schema.anyOf.length > maxSchemaVariants)) truncated = true;
  let variantIndex = Number.isInteger(preferredVariant) && preferredVariant! >= 0 && preferredVariant! < rawVariants.length
    ? preferredVariant!
    : Math.max(0, rawVariants.findIndex((variant) => matchesSchema(variant.schema, value, root)));
  if (variantIndex < 0) variantIndex = 0;
  schema = withoutKeys(schema, ['oneOf', 'anyOf']);
  const selectedVariant = rawVariants[variantIndex];
  if (selectedVariant) {
    const branchRecord = record(selectedVariant.schema);
    if (branchRecord) {
      const composed = composeSchema(branchRecord, root, value, undefined, references, depth + 1);
      schema = mergeSchema(schema, composed.schema);
      truncated ||= composed.truncated;
    }
  }

  const valueRecord = record(value);
  const dependentSchemas = record(schema.dependentSchemas);
  if (valueRecord && dependentSchemas) Object.entries(dependentSchemas).slice(0, maxSchemaProperties).forEach(([name, dependent]) => {
    if (!Object.hasOwn(valueRecord, name)) return;
    const dependentRecord = record(dependent);
    if (!dependentRecord) return;
    const composed = composeSchema(dependentRecord, root, value, undefined, references, depth + 1);
    schema = mergeSchema(schema, composed.schema);
    truncated ||= composed.truncated;
  });
  const dependentRequired = record(schema.dependentRequired);
  const legacyDependencies = record(schema.dependencies);
  if (valueRecord) {
    [dependentRequired, legacyDependencies].forEach((dependencies) => Object.entries(dependencies ?? {}).slice(0, maxSchemaProperties).forEach(([name, dependent]) => {
      if (!Object.hasOwn(valueRecord, name)) return;
      if (Array.isArray(dependent)) schema = mergeSchema(schema, { required: dependent });
      else {
        const dependentRecord = record(dependent);
        if (!dependentRecord) return;
        const composed = composeSchema(dependentRecord, root, value, undefined, references, depth + 1);
        schema = mergeSchema(schema, composed.schema);
        truncated ||= composed.truncated;
      }
    }));
  }
  if (schema.if !== undefined) {
    const branch = matchesSchema(schema.if, value, root) ? schema.then : schema.else;
    const branchRecord = record(branch);
    if (branchRecord) {
      const composed = composeSchema(branchRecord, root, value, undefined, references, depth + 1);
      schema = mergeSchema(schema, composed.schema);
      truncated ||= composed.truncated;
    }
    schema = withoutKeys(schema, ['if', 'then', 'else']);
  }
  return { schema, variants: rawVariants, variantIndex, truncated };
};

const inferredType = (schema: UnknownRecord, value: unknown): McpParameterType => {
  const types = schemaTypes(schema.type);
  const matching = types.find((type) => value !== undefined && valueMatchesType(type, value));
  if (matching) return matching;
  if (types.length) return types.find((type) => type !== 'null') ?? types[0];
  if (record(schema.properties)) return 'object';
  if (schema.items !== undefined) return 'array';
  if (Array.isArray(value)) return 'array';
  if (record(value)) return 'object';
  if (value === null) return 'null';
  if (typeof value === 'string') return 'string';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  return 'unknown';
};

export const mcpParameterSchemaNode = (schemaValue: JsonValue, root: JsonValue = schemaValue, value?: unknown, preferredVariant?: number): McpParameterSchemaNode => {
  if (schemaValue === false) return { type: 'unknown', title: '', description: 'This value is forbidden by the server schema.', properties: [], additionalProperties: false, additionalPropertiesForbidden: true, options: [], variants: [], variantIndex: 0, readOnly: true, truncated: false };
  const rawSchema = record(schemaValue) ?? {};
  const composed = composeSchema(rawSchema, root, value, preferredVariant);
  const schema = composed.schema;
  const required = new Set(Array.isArray(schema.required) ? schema.required.filter((name): name is string => typeof name === 'string') : []);
  const rawProperties = Object.entries(record(schema.properties) ?? {});
  const properties = rawProperties.slice(0, maxSchemaProperties).flatMap(([name, property]): McpParameterProperty[] => jsonValue(property) ? [{ name, required: required.has(name), schema: property }] : []);
  const optionValues = Array.isArray(schema.enum)
    ? schema.enum.filter(jsonValue).slice(0, 500)
    : Object.hasOwn(schema, 'const') && jsonValue(schema.const) ? [schema.const] : [];
  const additionalProperties = schema.additionalProperties === true
    ? {}
    : schema.additionalProperties === false || schema.additionalProperties === undefined
      ? false
      : jsonValue(schema.additionalProperties) ? schema.additionalProperties : false;
  const itemSchema = Array.isArray(schema.items)
    ? jsonValue(schema.items[0]) ? schema.items[0] : undefined
    : jsonValue(schema.items) ? schema.items : undefined;
  return {
    type: inferredType(schema, value),
    title: typeof schema.title === 'string' ? schema.title : '',
    description: typeof schema.description === 'string' ? schema.description : '',
    properties,
    itemSchema,
    additionalProperties,
    additionalPropertiesForbidden: schema.additionalProperties === false,
    options: optionValues.map((option) => ({ label: option === null ? 'null' : String(option), value: option })),
    variants: composed.variants,
    variantIndex: composed.variantIndex,
    defaultValue: jsonValue(schema.default) ? cloneJson(schema.default) : Object.hasOwn(schema, 'const') && jsonValue(schema.const) ? cloneJson(schema.const) : undefined,
    readOnly: schema.readOnly === true,
    truncated: composed.truncated || rawProperties.length > maxSchemaProperties,
  };
};

export const initialMcpParameterValue = (schema: JsonValue, root: JsonValue = schema, depth = 0, references = new Set<string>()): JsonValue | undefined => {
  if (depth >= maxSchemaDepth) return undefined;
  const source = record(schema);
  const reference = typeof source?.$ref === 'string' ? source.$ref : '';
  if (reference && references.has(reference)) return undefined;
  const nextReferences = reference ? new Set(references).add(reference) : references;
  const node = mcpParameterSchemaNode(schema, root);
  if (node.defaultValue !== undefined) return cloneJson(node.defaultValue);
  if (node.type === 'object') {
    const entries = node.properties.flatMap(({ name, schema: propertySchema }) => {
      const value = initialMcpParameterValue(propertySchema, root, depth + 1, nextReferences);
      return value === undefined ? [] : [[name, value] as const];
    });
    const initial = Object.fromEntries(entries) as Record<string, JsonValue>;
    const resolved = mcpParameterSchemaNode(schema, root, initial);
    resolved.properties.forEach(({ name, schema: propertySchema }) => {
      if (Object.hasOwn(initial, name)) return;
      const value = initialMcpParameterValue(propertySchema, root, depth + 1, nextReferences);
      if (value !== undefined) initial[name] = value;
    });
    return initial;
  }
  if (node.type === 'array') return [];
  return undefined;
};

export const initialMcpToolParameters = (schema: JsonValue) => {
  const value = initialMcpParameterValue(schema);
  return record(value) ?? {};
};

export const mcpScalarInputValue = (type: McpParameterType, value: string): JsonValue => {
  if (type === 'boolean') return value === 'true';
  if (type === 'null') return null;
  if (type === 'number' || type === 'integer') {
    if (!value.trim()) return '';
    const number = Number(value);
    return Number.isFinite(number) ? type === 'integer' ? Math.trunc(number) : number : value;
  }
  return value;
};

export const mcpScalarOptionKey = (value: unknown) => `${typeof value}:${JSON.stringify(value)}`;

export const mcpParameterValueAtPath = (value: unknown, path: McpParameterPath): unknown => path.reduce((current: unknown, segment) => {
  if (typeof segment === 'number') return Array.isArray(current) ? current[segment] : undefined;
  return record(current)?.[segment];
}, value);

export const withMcpParameterValue = (value: unknown, path: McpParameterPath, nextValue: JsonValue): JsonValue => {
  if (!path.length) return nextValue;
  const [segment, ...rest] = path;
  if (typeof segment === 'number') {
    const output = Array.isArray(value) ? [...value] : [];
    output[segment] = withMcpParameterValue(output[segment], rest, nextValue);
    return output as JsonValue;
  }
  const source = record(value) ?? {};
  return Object.fromEntries([...Object.entries(source).filter(([key]) => key !== segment), [segment, withMcpParameterValue(source[segment], rest, nextValue)]]) as JsonValue;
};

export const withoutMcpParameterValue = (value: unknown, path: McpParameterPath): JsonValue => {
  if (!path.length) return {};
  const [segment, ...rest] = path;
  if (typeof segment === 'number') {
    const output = Array.isArray(value) ? [...value] : [];
    if (!rest.length) output.splice(segment, 1);
    else output[segment] = withoutMcpParameterValue(output[segment], rest);
    return output as JsonValue;
  }
  const source = record(value) ?? {};
  if (!rest.length) return Object.fromEntries(Object.entries(source).filter(([key]) => key !== segment)) as JsonValue;
  return Object.fromEntries([...Object.entries(source).filter(([key]) => key !== segment), [segment, withoutMcpParameterValue(source[segment], rest)]]) as JsonValue;
};

export const renameMcpParameterValue = (value: unknown, parentPath: McpParameterPath, currentName: string, nextName: string): JsonValue => {
  const parent = record(mcpParameterValueAtPath(value, parentPath));
  if (!parent || !nextName || (currentName !== nextName && Object.hasOwn(parent, nextName))) return (jsonValue(value) ? value : {}) as JsonValue;
  const renamed = Object.fromEntries(Object.entries(parent).map(([name, entry]) => [name === currentName ? nextName : name, entry]));
  return withMcpParameterValue(value, parentPath, renamed as JsonValue);
};

export const mcpParameterVariantKey = (prefix: string, path: McpParameterPath) => `${prefix}:${pathKey(path)}`;

const displayPath = (path: McpParameterPath) => path.reduce((output, segment) => typeof segment === 'number'
  ? `${output}[${segment}]`
  : /^[A-Za-z_$][\w$]*$/.test(segment) ? `${output}.${segment}` : `${output}[${JSON.stringify(segment)}]`, '$');

export const mcpParameterIssues = (
  schema: JsonValue,
  value: unknown,
  root: JsonValue = schema,
  variants: Record<string, number> = {},
  variantPrefix = '',
  path: McpParameterPath = [],
  required = true,
  depth = 0,
): string[] => {
  if (value === undefined) return required ? [`${displayPath(path)} is required.`] : [];
  if (schema === false) return [`${displayPath(path)} is forbidden by the server schema.`];
  if (depth >= maxSchemaDepth) return [`${displayPath(path)} exceeds the guided schema depth; review it in JSON.`];
  const node = mcpParameterSchemaNode(schema, root, value, variants[mcpParameterVariantKey(variantPrefix, path)]);
  if (node.type !== 'unknown' && !valueMatchesType(node.type, value)) return [`${displayPath(path)} must be ${node.type}.`];
  if (node.options.length && !node.options.some((option) => jsonEqual(option.value, value))) return [`${displayPath(path)} must use one of the declared values.`];
  if (node.type === 'object') {
    const current = record(value);
    if (!current) return [`${displayPath(path)} must be object.`];
    const propertyNames = new Set(node.properties.map((property) => property.name));
    const additionalIssues = node.additionalPropertiesForbidden
      ? Object.keys(current).filter((name) => !propertyNames.has(name)).slice(0, maxSchemaProperties).map((name) => `${displayPath([...path, name])} is not allowed by the server schema.`)
      : [];
    return [...node.properties.flatMap((property) => mcpParameterIssues(
      property.schema,
      current[property.name],
      root,
      variants,
      variantPrefix,
      [...path, property.name],
      property.required,
      depth + 1,
    )), ...additionalIssues].slice(0, maxSchemaProperties);
  }
  if (node.type === 'array') {
    if (!Array.isArray(value)) return [`${displayPath(path)} must be array.`];
    const itemSchema = node.itemSchema ?? {};
    return value.slice(0, maxSchemaProperties).flatMap((item, index) => mcpParameterIssues(itemSchema, item, root, variants, variantPrefix, [...path, index], true, depth + 1)).slice(0, maxSchemaProperties);
  }
  return [];
};
