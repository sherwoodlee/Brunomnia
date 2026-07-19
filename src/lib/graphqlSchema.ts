import type { GraphqlDirective, GraphqlField, GraphqlInputValue, GraphqlSchema, GraphqlSchemaType, GraphqlTypeRef } from '../types';

const record = (value: unknown) => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
const text = (value: unknown) => typeof value === 'string' ? value : '';

const normalizeTypeRef = (value: unknown, depth = 0): GraphqlTypeRef => {
  const source = record(value);
  const ofType = depth < 12 && source?.ofType ? normalizeTypeRef(source.ofType, depth + 1) : undefined;
  return { kind: text(source?.kind), name: text(source?.name), ...(ofType?.kind || ofType?.name ? { ofType } : {}) };
};

const normalizeInputValues = (value: unknown): GraphqlInputValue[] => !Array.isArray(value) ? [] : value.flatMap((item): GraphqlInputValue[] => {
  const source = record(item);
  const name = text(source?.name);
  return source && name ? [{
    name,
    description: text(source.description),
    defaultValue: text(source.defaultValue),
    isDeprecated: source.isDeprecated === true,
    deprecationReason: text(source.deprecationReason),
    type: normalizeTypeRef(source.type),
  }] : [];
}).slice(0, 500);

export const normalizeGraphqlSchema = (value: unknown): GraphqlSchema | undefined => {
  const source = record(value);
  const rawTypes = Array.isArray(source?.types) ? source.types : [];
  const types = rawTypes.flatMap((item): GraphqlSchemaType[] => {
    const type = record(item);
    const name = text(type?.name);
    if (!type || !name) return [];
    const fields = !Array.isArray(type.fields) ? [] : type.fields.flatMap((item): GraphqlField[] => {
      const field = record(item);
      const fieldName = text(field?.name);
      return field && fieldName ? [{
        name: fieldName,
        description: text(field.description),
        isDeprecated: field.isDeprecated === true,
        deprecationReason: text(field.deprecationReason),
        args: normalizeInputValues(field.args).slice(0, 100),
        type: normalizeTypeRef(field.type),
      }] : [];
    }).slice(0, 1_000);
    const enumValues = !Array.isArray(type.enumValues) ? [] : type.enumValues.flatMap((item) => {
      const entry = record(item);
      const entryName = text(entry?.name);
      return entry && entryName ? [{ name: entryName, description: text(entry.description), isDeprecated: entry.isDeprecated === true, deprecationReason: text(entry.deprecationReason) }] : [];
    }).slice(0, 5_000);
    const possibleTypes = !Array.isArray(type.possibleTypes) ? [] : type.possibleTypes.map((entry) => normalizeTypeRef(entry)).filter((entry) => entry.name).slice(0, 1_000);
    const interfaces = !Array.isArray(type.interfaces) ? [] : type.interfaces.map((entry) => normalizeTypeRef(entry)).filter((entry) => entry.name).slice(0, 1_000);
    return [{
      kind: text(type.kind),
      name,
      description: text(type.description),
      specifiedByUrl: text(type.specifiedByURL ?? type.specifiedByUrl),
      isOneOf: type.isOneOf === true,
      fields,
      inputFields: normalizeInputValues(type.inputFields),
      interfaces,
      enumValues,
      possibleTypes,
    }];
  }).slice(0, 5_000);
  if (!types.length) return undefined;
  const directives = !Array.isArray(source?.directives) ? [] : source.directives.flatMap((item): GraphqlDirective[] => {
    const directive = record(item);
    const name = text(directive?.name);
    if (!directive || !name) return [];
    return [{
      name,
      description: text(directive.description),
      isRepeatable: directive.isRepeatable === true,
      locations: Array.isArray(directive.locations) ? directive.locations.filter((location): location is string => typeof location === 'string').slice(0, 100) : [],
      args: normalizeInputValues(directive.args).slice(0, 100),
    }];
  }).slice(0, 500);
  return {
    queryType: typeof source?.queryType === 'string' ? source.queryType : text(record(source?.queryType)?.name),
    mutationType: typeof source?.mutationType === 'string' ? source.mutationType : text(record(source?.mutationType)?.name),
    subscriptionType: typeof source?.subscriptionType === 'string' ? source.subscriptionType : text(record(source?.subscriptionType)?.name),
    types,
    directives,
  };
};

export const graphqlTypeLabel = (type: GraphqlTypeRef | undefined): string => {
  if (!type) return '';
  if (type.kind === 'NON_NULL') return `${graphqlTypeLabel(type.ofType)}!`;
  if (type.kind === 'LIST') return `[${graphqlTypeLabel(type.ofType)}]`;
  return type.name || type.kind;
};
