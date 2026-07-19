import {
  buildClientSchema,
  getIntrospectionQuery,
  getVariableValues,
  Kind,
  parse,
  print,
  type GraphQLSchema as ClientGraphqlSchema,
  type IntrospectionQuery,
  type OperationDefinitionNode,
} from 'graphql';
import { getAutocompleteSuggestions, getDiagnostics, getHoverInformation, offsetToPosition } from 'graphql-language-service/esm/index.js';
import type { ApiRequest, Environment, GraphqlField, GraphqlInputValue, GraphqlSchema, GraphqlTypeRef } from '../types';
import { sendRequest, type SendRequestContext } from './http';
import { graphqlTypeLabel, normalizeGraphqlSchema } from './graphqlSchema';

export { graphqlTypeLabel, normalizeGraphqlSchema } from './graphqlSchema';

export type GraphqlIssue = { severity: 'error' | 'warning'; message: string; line?: number; column?: number };
export type GraphqlOperationType = 'query' | 'mutation' | 'subscription';
export type GraphqlCompletion = { label: string; detail: string; documentation: string; insertText: string; deprecated: boolean };
export type GraphqlSchemaSearchResult = { kind: 'type' | 'field'; label: string; owner: string; detail: string; description: string; typeName: string };

export const graphqlIntrospectionQuery = (includeInputValueDeprecation = false) => getIntrospectionQuery({ inputValueDeprecation: includeInputValueDeprecation });
const introspectionQuery = graphqlIntrospectionQuery();

const record = (value: unknown) => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;

const introspectionTypeRef = (type: GraphqlTypeRef | undefined): Record<string, unknown> => ({
  kind: type?.kind || 'SCALAR',
  name: type?.name || null,
  ofType: type?.ofType ? introspectionTypeRef(type.ofType) : null,
});

const introspectionInputValue = (value: GraphqlInputValue) => ({
  name: value.name,
  description: value.description || null,
  defaultValue: value.defaultValue || null,
  isDeprecated: value.isDeprecated,
  deprecationReason: value.deprecationReason || null,
  type: introspectionTypeRef(value.type),
});

const clientSchemas = new WeakMap<GraphqlSchema, ClientGraphqlSchema | null>();

export const graphqlClientSchema = (schema: GraphqlSchema | undefined): ClientGraphqlSchema | undefined => {
  if (!schema) return undefined;
  const cached = clientSchemas.get(schema);
  if (cached !== undefined) return cached ?? undefined;
  if (!schema.queryType) { clientSchemas.set(schema, null); return undefined; }
  try {
    const introspection = { __schema: {
      queryType: { name: schema.queryType, kind: 'OBJECT' },
      mutationType: schema.mutationType ? { name: schema.mutationType, kind: 'OBJECT' } : null,
      subscriptionType: schema.subscriptionType ? { name: schema.subscriptionType, kind: 'OBJECT' } : null,
      types: schema.types.map((type) => ({
        kind: type.kind as never,
        name: type.name,
        description: type.description || null,
        specifiedByURL: type.specifiedByUrl || null,
        isOneOf: type.isOneOf,
        fields: type.kind === 'OBJECT' || type.kind === 'INTERFACE' ? type.fields.map((field) => ({
          name: field.name,
          description: field.description || null,
          args: field.args.map(introspectionInputValue),
          type: introspectionTypeRef(field.type),
          isDeprecated: field.isDeprecated,
          deprecationReason: field.deprecationReason || null,
        })) : null,
        inputFields: type.kind === 'INPUT_OBJECT' ? type.inputFields.map(introspectionInputValue) : null,
        interfaces: type.kind === 'OBJECT' || type.kind === 'INTERFACE' ? type.interfaces.map(introspectionTypeRef) : null,
        enumValues: type.kind === 'ENUM' ? type.enumValues.map((value) => ({ ...value, description: value.description || null, deprecationReason: value.deprecationReason || null })) : null,
        possibleTypes: type.kind === 'UNION' || type.kind === 'INTERFACE' ? type.possibleTypes.map(introspectionTypeRef) : null,
      })),
      directives: schema.directives.map((directive) => ({
        name: directive.name,
        description: directive.description || null,
        isRepeatable: directive.isRepeatable,
        locations: directive.locations as never,
        args: directive.args.map(introspectionInputValue),
      })),
    } } as unknown as IntrospectionQuery;
    const built = buildClientSchema(introspection);
    clientSchemas.set(schema, built);
    return built;
  } catch {
    clientSchemas.set(schema, null);
    return undefined;
  }
};

const schemaFromIntrospectionData = (value: unknown) => {
  const data = record(value);
  const normalized = normalizeGraphqlSchema(data?.__schema);
  if (!normalized || !graphqlClientSchema(normalized)) throw new Error('The GraphQL introspection data does not describe a usable schema.');
  return normalized;
};

export const importGraphqlSchema = (source: string) => {
  if (new TextEncoder().encode(source).byteLength > 20_000_000) throw new Error('GraphQL schema import exceeds the 20 MB limit.');
  let payload: unknown;
  try { payload = JSON.parse(source) as unknown; }
  catch (error) { throw new Error(`GraphQL schema import is not valid JSON: ${error instanceof Error ? error.message : String(error)}`); }
  const data = record(record(payload)?.data);
  if (!data) throw new Error('GraphQL schema JSON must contain a data field with introspection results.');
  return schemaFromIntrospectionData(data);
};

export const fetchGraphqlSchema = async (request: ApiRequest, environment: Environment | undefined, context: SendRequestContext, includeInputValueDeprecation = false) => {
  if (request.protocol !== 'graphql') throw new Error('Schema introspection requires a GraphQL request.');
  const schemaRequest = structuredClone(request);
  schemaRequest.id = `graphql-schema-${crypto.randomUUID()}`;
  schemaRequest.name = `${request.name} · schema introspection`;
  schemaRequest.method = 'POST';
  schemaRequest.graphql = { ...schemaRequest.graphql, query: graphqlIntrospectionQuery(includeInputValueDeprecation), variables: '{}', operationName: 'IntrospectionQuery' };
  schemaRequest.preRequestScript = '';
  schemaRequest.tests = '';
  schemaRequest.transport = { ...schemaRequest.transport, followRedirects: false, followRedirectsMode: 'off', timeoutMode: 'custom', timeoutMs: Math.min(120_000, Math.max(1_000, schemaRequest.transport.timeoutMs)), storeCookies: false };
  const response = await sendRequest(schemaRequest, environment, context);
  if (response.status < 200 || response.status >= 300) throw new Error(`GraphQL introspection failed (${response.status}): ${response.body.slice(0, 2_000)}`);
  if (response.body.length > 20_000_000) throw new Error('GraphQL introspection exceeded the 20 MB parsed-response limit.');
  const payload: unknown = JSON.parse(response.body);
  const errors = record(payload)?.errors;
  if (Array.isArray(errors) && errors.length) throw new Error(`GraphQL introspection returned errors: ${JSON.stringify(errors).slice(0, 2_000)}`);
  try { return schemaFromIntrospectionData(record(payload)?.data); }
  catch { throw new Error('The GraphQL endpoint did not return a usable introspection schema. Introspection may be disabled.'); }
};

const parsedOperations = (query: string): OperationDefinitionNode[] => {
  try { return parse(query).definitions.filter((definition): definition is OperationDefinitionNode => definition.kind === Kind.OPERATION_DEFINITION); }
  catch { return []; }
};

export const graphqlOperationNames = (query: string) => parsedOperations(query).flatMap((operation) => operation.name?.value ? [operation.name.value] : []);

export const graphqlOperationType = (query: string, operationName = ''): GraphqlOperationType | undefined => {
  const operations = parsedOperations(query);
  if (!operations.length) return undefined;
  const selectedName = operationName.trim();
  const selected = selectedName ? operations.find((operation) => operation.name?.value === selectedName) : operations.length === 1 ? operations[0] : undefined;
  return selected?.operation;
};

export const graphqlOperationAtOffset = (query: string, offset: number) => {
  const bounded = Math.max(0, Math.min(query.length, offset));
  return parsedOperations(query).find((operation) => operation.name && operation.loc && operation.loc.start <= bounded && operation.loc.end >= bounded)?.name?.value ?? '';
};

export const graphqlVariableNames = (query: string, operationName = '') => {
  const operations = parsedOperations(query);
  const operation = operationName ? operations.find((candidate) => candidate.name?.value === operationName) : operations.length === 1 ? operations[0] : undefined;
  return operation?.variableDefinitions?.map((definition) => definition.variable.name.value) ?? [];
};

export const formatGraphqlDocument = (query: string) => {
  try { return `${print(parse(query)).trim()}\n`; }
  catch (error) { throw new Error(`Cannot format invalid GraphQL: ${error instanceof Error ? error.message : String(error)}`); }
};

export const isGraphqlSubscriptionRequest = (request: ApiRequest) => request.protocol === 'graphql'
  && graphqlOperationType(request.graphql.query, request.graphql.operationName) === 'subscription';

const positionAt = (source: string, offset: number) => offsetToPosition(source, Math.max(0, Math.min(source.length, offset)));

const namedType = (type: GraphqlTypeRef | undefined) => {
  let current = type;
  while (current?.ofType) current = current.ofType;
  return current?.name ?? '';
};

export const graphqlCompletions = (query: string, offset: number, schema: GraphqlSchema | undefined): GraphqlCompletion[] => {
  const clientSchema = graphqlClientSchema(schema);
  if (!clientSchema) return [];
  try {
    return getAutocompleteSuggestions(clientSchema, query, positionAt(query, offset)).slice(0, 200).map((suggestion) => ({
      label: suggestion.label,
      detail: suggestion.detail ?? (suggestion.type ? String(suggestion.type) : ''),
      documentation: suggestion.documentation ?? suggestion.deprecationReason ?? '',
      insertText: suggestion.insertText ?? suggestion.rawInsert ?? suggestion.label,
      deprecated: suggestion.isDeprecated === true,
    }));
  } catch { return []; }
};

export const graphqlHover = (query: string, offset: number, schema: GraphqlSchema | undefined) => {
  const clientSchema = graphqlClientSchema(schema);
  if (!clientSchema) return '';
  try {
    const value = getHoverInformation(clientSchema, query, positionAt(query, offset), undefined, { useMarkdown: true });
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) return value.map((entry) => typeof entry === 'string' ? entry : entry.value).join('\n\n');
    return value && typeof value === 'object' && 'value' in value ? String(value.value) : '';
  } catch { return ''; }
};

export const searchGraphqlSchema = (schema: GraphqlSchema | undefined, filter: string): GraphqlSchemaSearchResult[] => {
  const term = filter.trim().toLowerCase();
  if (!schema || !term) return [];
  const results: GraphqlSchemaSearchResult[] = [];
  schema.types.forEach((type) => {
    if (`${type.name} ${type.description}`.toLowerCase().includes(term)) results.push({ kind: 'type', label: type.name, owner: type.kind, detail: type.kind, description: type.description, typeName: type.name });
    type.fields.forEach((field) => {
      if (`${field.name} ${field.description} ${type.name}`.toLowerCase().includes(term)) results.push({ kind: 'field', label: field.name, owner: type.name, detail: graphqlTypeLabel(field.type), description: field.description || field.deprecationReason, typeName: namedType(field.type) });
    });
    type.inputFields.forEach((field) => {
      if (`${field.name} ${field.description} ${type.name}`.toLowerCase().includes(term)) results.push({ kind: 'field', label: field.name, owner: type.name, detail: graphqlTypeLabel(field.type), description: field.description || field.deprecationReason, typeName: namedType(field.type) });
    });
  });
  return results.slice(0, 500);
};

const dedupeIssues = (issues: GraphqlIssue[]) => {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = `${issue.severity}:${issue.line ?? 0}:${issue.column ?? 0}:${issue.message}`;
    return !seen.has(key) && Boolean(seen.add(key));
  }).slice(0, 200);
};

export const validateGraphqlDocument = (query: string, variables: string, schema?: GraphqlSchema, operationName = ''): GraphqlIssue[] => {
  const issues: GraphqlIssue[] = [];
  if (!query.trim()) issues.push({ severity: 'error', message: 'GraphQL query is required.' });
  if (query.includes('{{')) issues.push({ severity: 'warning', message: 'Template tags are literal in GraphQL query text; use them in variables instead.' });
  if (query.trim()) {
    const clientSchema = graphqlClientSchema(schema);
    try {
      getDiagnostics(query, clientSchema).forEach((diagnostic) => issues.push({
        severity: diagnostic.severity === 1 ? 'error' : 'warning',
        message: typeof diagnostic.message === 'string' ? diagnostic.message : diagnostic.message.value,
        line: diagnostic.range.start.line + 1,
        column: diagnostic.range.start.character + 1,
      }));
    } catch (error) {
      issues.push({ severity: 'error', message: error instanceof Error ? error.message : String(error) });
    }
  }

  let variableValues: Record<string, unknown> | undefined;
  try {
    const value: unknown = variables.trim() ? JSON.parse(variables) : {};
    if (!value || typeof value !== 'object' || Array.isArray(value)) issues.push({ severity: 'error', message: 'GraphQL variables must be a JSON object.' });
    else variableValues = value as Record<string, unknown>;
  } catch { issues.push({ severity: 'error', message: 'GraphQL variables are not valid JSON.' }); }

  const operations = parsedOperations(query);
  const selected = operationName ? operations.find((operation) => operation.name?.value === operationName) : operations.length === 1 ? operations[0] : undefined;
  if (operationName && !selected && operations.length) issues.push({ severity: 'error', message: `GraphQL operation '${operationName}' does not exist in this document.` });
  if (!operationName && operations.length > 1) issues.push({ severity: 'error', message: 'Choose an operation before sending a document with multiple operations.' });
  const clientSchema = graphqlClientSchema(schema);
  if (selected && variableValues && clientSchema) {
    const result = getVariableValues(clientSchema, selected.variableDefinitions ?? [], variableValues, { maxErrors: 50 });
    result.errors?.forEach((error) => issues.push({ severity: 'error', message: error.message }));
  }
  return dedupeIssues(issues);
};

const selectionForField = (field: GraphqlField, schema: GraphqlSchema) => {
  const named = (() => { let type: GraphqlTypeRef | undefined = field.type; while (type?.ofType) type = type.ofType; return type?.name ?? ''; })();
  const object = schema.types.find((type) => type.name === named && (type.kind === 'OBJECT' || type.kind === 'INTERFACE'));
  const children = object?.fields.filter((candidate) => !candidate.args.some((argument) => argument.type.kind === 'NON_NULL' && !argument.defaultValue)).slice(0, 3) ?? [];
  return children.length ? `${field.name} { ${children.map((child) => child.name).join(' ')} }` : field.name;
};

export const insertGraphqlRootField = (query: string, operation: 'query' | 'mutation' | 'subscription', field: GraphqlField, schema: GraphqlSchema): string => {
  const selection = selectionForField(field, schema);
  if (!query.trim()) return `${operation} {\n  ${selection}\n}`;
  const close = query.lastIndexOf('}');
  if (close < 0) return `${query.trimEnd()}\n${selection}`;
  return `${query.slice(0, close).trimEnd()}\n  ${selection}\n${query.slice(close)}`;
};

export { introspectionQuery };
