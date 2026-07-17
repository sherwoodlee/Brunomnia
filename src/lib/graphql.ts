import type { ApiRequest, Environment, GraphqlField, GraphqlInputValue, GraphqlSchema, GraphqlSchemaType, GraphqlTypeRef } from '../types';
import { sendRequest, type SendRequestContext } from './http';

export type GraphqlIssue = { severity: 'error' | 'warning'; message: string };

const introspectionQuery = `query BrunomniaIntrospection {
  __schema {
    queryType { name }
    mutationType { name }
    subscriptionType { name }
    types {
      kind
      name
      description
      fields(includeDeprecated: true) {
        name
        description
        isDeprecated
        deprecationReason
        args { name description defaultValue type { ...TypeRef } }
        type { ...TypeRef }
      }
      inputFields { name description defaultValue type { ...TypeRef } }
      enumValues(includeDeprecated: true) { name description isDeprecated deprecationReason }
      possibleTypes { ...TypeRef }
    }
  }
}

fragment TypeRef on __Type {
  kind
  name
  ofType { kind name ofType { kind name ofType { kind name ofType { kind name ofType { kind name ofType { kind name } } } } } }
}`;

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
  return source && name ? [{ name, description: text(source.description), defaultValue: text(source.defaultValue), type: normalizeTypeRef(source.type) }] : [];
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
    return [{ kind: text(type.kind), name, description: text(type.description), fields, inputFields: normalizeInputValues(type.inputFields), enumValues, possibleTypes }];
  }).slice(0, 5_000);
  if (!types.length) return undefined;
  return {
    queryType: text(record(source?.queryType)?.name),
    mutationType: text(record(source?.mutationType)?.name),
    subscriptionType: text(record(source?.subscriptionType)?.name),
    types,
  };
};

export const graphqlTypeLabel = (type: GraphqlTypeRef | undefined): string => {
  if (!type) return '';
  if (type.kind === 'NON_NULL') return `${graphqlTypeLabel(type.ofType)}!`;
  if (type.kind === 'LIST') return `[${graphqlTypeLabel(type.ofType)}]`;
  return type.name || type.kind;
};

export const fetchGraphqlSchema = async (request: ApiRequest, environment: Environment | undefined, context: SendRequestContext) => {
  if (request.protocol !== 'graphql') throw new Error('Schema introspection requires a GraphQL request.');
  const schemaRequest = structuredClone(request);
  schemaRequest.id = `graphql-schema-${crypto.randomUUID()}`;
  schemaRequest.name = `${request.name} · schema introspection`;
  schemaRequest.method = 'POST';
  schemaRequest.graphql = { ...schemaRequest.graphql, query: introspectionQuery, variables: '{}', operationName: 'BrunomniaIntrospection' };
  schemaRequest.preRequestScript = '';
  schemaRequest.tests = '';
  schemaRequest.transport = { ...schemaRequest.transport, followRedirects: false, followRedirectsMode: 'off', timeoutMs: Math.min(120_000, Math.max(1_000, schemaRequest.transport.timeoutMs)), storeCookies: false };
  const response = await sendRequest(schemaRequest, environment, context);
  if (response.status < 200 || response.status >= 300) throw new Error(`GraphQL introspection failed (${response.status}): ${response.body.slice(0, 2_000)}`);
  if (response.body.length > 20_000_000) throw new Error('GraphQL introspection exceeded the 20 MB parsed-response limit.');
  const payload: unknown = JSON.parse(response.body);
  const errors = record(payload)?.errors;
  if (Array.isArray(errors) && errors.length) throw new Error(`GraphQL introspection returned errors: ${JSON.stringify(errors).slice(0, 2_000)}`);
  const schema = normalizeGraphqlSchema(record(record(payload)?.data)?.__schema);
  if (!schema) throw new Error('The GraphQL endpoint did not return a usable introspection schema. Introspection may be disabled.');
  return schema;
};

const withoutStringsAndComments = (source: string) => source
  .replace(/"""[\s\S]*?"""/g, ' ')
  .replace(/"(?:\\.|[^"\\])*"/g, ' ')
  .replace(/#[^\n\r]*/g, ' ');

const balancedIssue = (source: string): string => {
  const pairs: Record<string, string> = { ')': '(', ']': '[', '}': '{' };
  const stack: string[] = [];
  for (const character of withoutStringsAndComments(source)) {
    if ('([{'.includes(character)) stack.push(character);
    if (')]}'.includes(character) && stack.pop() !== pairs[character]) return `Unexpected '${character}' in GraphQL document.`;
  }
  return stack.length ? `Unclosed '${stack.at(-1)}' in GraphQL document.` : '';
};

const rootFieldNames = (source: string) => {
  const cleaned = withoutStringsAndComments(source).replace(/\.\.\.\s*(?:on\s+)?[_A-Za-z][_0-9A-Za-z]*/g, ' ');
  const tokens: string[] = cleaned.match(/[_A-Za-z][_0-9A-Za-z]*|[{}():!@$,]/g) ?? [];
  const open = tokens.indexOf('{');
  if (open < 0) return [];
  const fields: string[] = [];
  let depth = 0;
  let parentheses = 0;
  for (let index = open; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === '{') { depth += 1; continue; }
    if (token === '}') { depth -= 1; continue; }
    if (token === '(') { parentheses += 1; continue; }
    if (token === ')') { parentheses -= 1; continue; }
    if (depth !== 1 || parentheses || !/^[_A-Za-z]/.test(token)) continue;
    if (tokens[index + 1] === ':') continue;
    if (tokens[index - 1] === '@' || tokens[index - 1] === '$') continue;
    fields.push(token);
  }
  return [...new Set(fields)];
};

export const validateGraphqlDocument = (query: string, variables: string, schema?: GraphqlSchema): GraphqlIssue[] => {
  const issues: GraphqlIssue[] = [];
  if (!query.trim()) issues.push({ severity: 'error', message: 'GraphQL query is required.' });
  if (query.includes('{{')) issues.push({ severity: 'warning', message: 'Template tags are literal in GraphQL query text; use them in variables instead.' });
  const balance = balancedIssue(query);
  if (balance) issues.push({ severity: 'error', message: balance });
  try {
    const value: unknown = variables.trim() ? JSON.parse(variables) : {};
    if (!value || typeof value !== 'object' || Array.isArray(value)) issues.push({ severity: 'error', message: 'GraphQL variables must be a JSON object.' });
  } catch { issues.push({ severity: 'error', message: 'GraphQL variables are not valid JSON.' }); }
  if (!schema || balance) return issues;
  const operation = /^\s*(mutation|subscription)\b/.exec(withoutStringsAndComments(query))?.[1] ?? 'query';
  const rootName = operation === 'mutation' ? schema.mutationType : operation === 'subscription' ? schema.subscriptionType : schema.queryType;
  const root = schema.types.find((type) => type.name === rootName);
  if (!root) {
    issues.push({ severity: 'error', message: `The schema has no ${operation} root type.` });
    return issues;
  }
  const allowed = new Set(root.fields.map((field) => field.name));
  rootFieldNames(query).filter((name) => !allowed.has(name)).forEach((name) => issues.push({ severity: 'error', message: `Unknown ${operation} field '${name}'.` }));
  return issues;
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
