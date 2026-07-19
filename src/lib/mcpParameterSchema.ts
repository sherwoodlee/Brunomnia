import type { JsonValue } from '../types';

export type McpScalarOption = { label: string; value: string | number | boolean };
export type McpScalarField = {
  name: string;
  title: string;
  description: string;
  required: boolean;
  type: 'string' | 'number' | 'integer' | 'boolean';
  options: McpScalarOption[];
  defaultValue?: string | number | boolean;
};

export type McpToolParameterSchema = {
  fields: McpScalarField[];
  hasComplexFields: boolean;
};

const record = (value: unknown): Record<string, unknown> | undefined => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
const scalar = (value: unknown): value is string | number | boolean => typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
const scalarType = (value: unknown): McpScalarField['type'] | undefined => {
  const types = Array.isArray(value) ? value : [value];
  return types.find((type): type is McpScalarField['type'] => type === 'string' || type === 'number' || type === 'integer' || type === 'boolean');
};

export const mcpToolParameterSchema = (schema: JsonValue): McpToolParameterSchema => {
  const source = record(schema);
  const properties = record(source?.properties);
  if (!source || !properties) return { fields: [], hasComplexFields: Boolean(source && source.type !== 'object') };
  const required = new Set(Array.isArray(source.required) ? source.required.filter((name): name is string => typeof name === 'string') : []);
  const fields: McpScalarField[] = [];
  let hasComplexFields = Boolean(source.additionalProperties || source.$ref || source.oneOf || source.anyOf || source.allOf || source.if || source.dependentSchemas);
  Object.entries(properties).slice(0, 200).forEach(([name, value]) => {
    const property = record(value);
    const type = scalarType(property?.type);
    if (!property || !type) {
      hasComplexFields = true;
      return;
    }
    const optionValues = Array.isArray(property.enum) ? property.enum.filter(scalar).slice(0, 500) : property.const !== undefined && scalar(property.const) ? [property.const] : [];
    fields.push({
      name,
      title: typeof property.title === 'string' && property.title ? property.title : name,
      description: typeof property.description === 'string' ? property.description : '',
      required: required.has(name),
      type,
      options: optionValues.map((option) => ({ label: String(option), value: option })),
      defaultValue: scalar(property.default) ? property.default : undefined,
    });
  });
  if (Object.keys(properties).length > 200) hasComplexFields = true;
  return { fields, hasComplexFields };
};

export const initialMcpToolParameters = (schema: McpToolParameterSchema) => Object.fromEntries(schema.fields.flatMap((field) => field.defaultValue === undefined ? [] : [[field.name, field.defaultValue]]));

export const mcpScalarInputValue = (field: McpScalarField, value: string) => {
  if (field.type === 'boolean') return value === 'true';
  if (field.type === 'number' || field.type === 'integer') {
    if (!value.trim()) return '';
    const number = Number(value);
    return Number.isFinite(number) ? field.type === 'integer' ? Math.trunc(number) : number : value;
  }
  return value;
};

export const mcpScalarOptionKey = (value: unknown) => `${typeof value}:${String(value)}`;
