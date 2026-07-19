import { buildSchema, introspectionFromSchema } from 'graphql';
import { describe, expect, it } from 'vitest';
import { createBlankRequest } from '../data/seed';
import {
  graphqlClientSchema,
  graphqlCompletions,
  formatGraphqlDocument,
  graphqlHover,
  graphqlIntrospectionQuery,
  graphqlOperationAtOffset,
  graphqlOperationNames,
  graphqlOperationType,
  graphqlTypeLabel,
  graphqlVariableNames,
  importGraphqlSchema,
  insertGraphqlRootField,
  isGraphqlSubscriptionRequest,
  normalizeGraphqlSchema,
  searchGraphqlSchema,
  validateGraphqlDocument,
} from './graphql';

const executableSchema = buildSchema(`
  directive @live on QUERY

  type Query {
    viewer: User!
    search(term: String!, filter: UserFilter): [User!]!
  }

  type Mutation {
    rename(name: String!): User!
  }

  type Subscription {
    userChanged: User!
  }

  type User {
    id: ID!
    name: String!
    role: Role!
    profile: Profile!
  }

  type Profile {
    bio: String
  }

  input UserFilter {
    role: Role
    legacy: String @deprecated(reason: "Use role")
  }

  enum Role {
    ADMIN
    USER
  }
`);
const introspection = introspectionFromSchema(executableSchema, { inputValueDeprecation: true });
const schema = normalizeGraphqlSchema(introspection.__schema)!;

describe('GraphQL schema tooling', () => {
  it('normalizes complete introspection and rebuilds an executable client schema', () => {
    expect(schema.queryType).toBe('Query');
    expect(schema.directives.map((directive) => directive.name)).toContain('live');
    expect(schema.types.find((type) => type.name === 'UserFilter')?.inputFields.find((field) => field.name === 'legacy')).toMatchObject({ isDeprecated: true, deprecationReason: 'Use role' });
    expect(graphqlTypeLabel(schema.types.find((type) => type.name === 'User')?.fields[0].type)).toBe('ID!');
    expect(graphqlClientSchema(schema)?.getQueryType()?.name).toBe('Query');
  });

  it('uses GraphQL language-service syntax and nested schema validation', () => {
    expect(validateGraphqlDocument('query Viewer { viewer { id profile { bio } } }', '{}', schema, 'Viewer')).toEqual([]);
    const messages = validateGraphqlDocument('query Viewer { viewer { missing } search { id } }', '{}', schema, 'Viewer').map((issue) => issue.message);
    expect(messages).toEqual(expect.arrayContaining([
      'Cannot query field "missing" on type "User".',
      'Field "search" argument "term" of type "String!" is required, but it was not provided.',
    ]));
    expect(validateGraphqlDocument('query { viewer ', '{}', schema)[0]).toMatchObject({ severity: 'error', line: 1 });
    expect(validateGraphqlDocument('query { viewer(note: "{{ account }}") { id } }', '{}', schema).some((issue) => issue.message.includes('literal'))).toBe(true);
  });

  it('coerces selected-operation variables against input and enum types', () => {
    const query = 'query Search($term: String!, $filter: UserFilter) { search(term: $term, filter: $filter) { id } }';
    expect(validateGraphqlDocument(query, '{"term":"Ada","filter":{"role":"ADMIN"}}', schema, 'Search')).toEqual([]);
    expect(validateGraphqlDocument(query, '{"filter":{"role":"ROOT"}}', schema, 'Search').map((issue) => issue.message).join('\n')).toContain('was not provided');
    expect(validateGraphqlDocument(query, '{"term":"Ada","filter":{"role":"ROOT"}}', schema, 'Search').map((issue) => issue.message).join('\n')).toContain('does not exist in');
    expect(validateGraphqlDocument('query A { viewer { id } } query B { viewer { name } }', '{}', schema).map((issue) => issue.message)).toContain('Choose an operation before sending a document with multiple operations.');
  });

  it('provides nested completion, hover, and searchable schema documentation', () => {
    const query = 'query Viewer { viewer { na } }';
    const completions = graphqlCompletions(query, query.indexOf('na') + 2, schema);
    expect(completions).toEqual(expect.arrayContaining([expect.objectContaining({ label: 'name', detail: 'String!' })]));
    expect(graphqlHover('query Viewer { viewer { name } }', 26, schema)).toContain('User.name: String!');
    expect(searchGraphqlSchema(schema, 'profile')).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'type', label: 'Profile' }),
      expect.objectContaining({ kind: 'field', label: 'profile', owner: 'User' }),
    ]));
  });

  it('imports bounded standard introspection JSON and exposes the exact query toggle', () => {
    const imported = importGraphqlSchema(JSON.stringify({ data: introspection }));
    expect(graphqlClientSchema(imported)?.getType('User')).toBeDefined();
    expect(() => importGraphqlSchema('{}')).toThrow('data field');
    expect(() => importGraphqlSchema('{')).toThrow('not valid JSON');
    expect(graphqlIntrospectionQuery(false)).not.toContain('inputFields(includeDeprecated: true)');
    expect(graphqlIntrospectionQuery(true)).toContain('inputFields(includeDeprecated: true)');
    expect(graphqlIntrospectionQuery(true)).toContain('args(includeDeprecated: true)');
  });

  it('inserts a root selection with safe scalar child fields', () => {
    const viewer = schema.types.find((type) => type.name === 'Query')!.fields[0];
    expect(insertGraphqlRootField('', 'query', viewer, schema)).toContain('viewer { id name role }');
    expect(formatGraphqlDocument('query Viewer{viewer{id}}')).toBe('query Viewer {\n  viewer {\n    id\n  }\n}\n');
    expect(() => formatGraphqlDocument('query {')).toThrow('Cannot format invalid GraphQL');
  });
});

describe('GraphQL operation selection', () => {
  const document = `
    # subscription Fake { ignored }
    query Viewer { viewer(note: "subscription AlsoFake { no }") { id } }
    subscription Orders($filter: UserFilter = { role: ADMIN }) @live {
      userChanged { ...UserFields }
    }
    fragment UserFields on User { id }
  `;

  it('parses operation names, types, cursor selection, and variables', () => {
    expect(graphqlOperationNames(document)).toEqual(['Viewer', 'Orders']);
    expect(graphqlOperationType(document)).toBeUndefined();
    expect(graphqlOperationType(document, 'Orders')).toBe('subscription');
    expect(graphqlOperationType(document, 'Viewer')).toBe('query');
    expect(graphqlOperationType(document, 'Missing')).toBeUndefined();
    expect(graphqlOperationAtOffset(document, document.indexOf('userChanged'))).toBe('Orders');
    expect(graphqlVariableNames(document, 'Orders')).toEqual(['filter']);
  });

  it('recognizes a sole anonymous query and only routes selected subscriptions to streaming', () => {
    expect(graphqlOperationType('{ viewer { id } }')).toBe('query');
    const request = createBlankRequest('subscription-operation');
    request.protocol = 'graphql';
    request.graphql.query = 'query Viewer { viewer { id } } subscription Events { userChanged { id } }';
    request.graphql.operationName = 'Events';
    expect(isGraphqlSubscriptionRequest(request)).toBe(true);
    request.graphql.operationName = 'Viewer';
    expect(isGraphqlSubscriptionRequest(request)).toBe(false);
    expect(graphqlOperationType('subscription @live { userChanged { id } }', 'live')).toBeUndefined();
    expect(graphqlOperationType('subscription Broken { userChanged { id }')).toBeUndefined();
    expect(graphqlOperationType('subscription Broken { userChanged { id } } }')).toBeUndefined();
  });
});
