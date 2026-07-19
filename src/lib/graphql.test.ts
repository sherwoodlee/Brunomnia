import { describe, expect, it } from 'vitest';
import { graphqlOperationType, graphqlTypeLabel, insertGraphqlRootField, isGraphqlSubscriptionRequest, normalizeGraphqlSchema, validateGraphqlDocument } from './graphql';
import { createBlankRequest } from '../data/seed';

const schema = normalizeGraphqlSchema({
  queryType: { name: 'Query' }, mutationType: { name: 'Mutation' }, subscriptionType: null,
  types: [
    { kind: 'OBJECT', name: 'Query', fields: [{ name: 'viewer', args: [], type: { kind: 'OBJECT', name: 'User' } }] },
    { kind: 'OBJECT', name: 'Mutation', fields: [{ name: 'rename', args: [{ name: 'name', type: { kind: 'NON_NULL', ofType: { kind: 'SCALAR', name: 'String' } } }], type: { kind: 'OBJECT', name: 'User' } }] },
    { kind: 'OBJECT', name: 'User', fields: [{ name: 'id', args: [], type: { kind: 'NON_NULL', ofType: { kind: 'SCALAR', name: 'ID' } } }, { name: 'name', args: [], type: { kind: 'SCALAR', name: 'String' } }] },
  ],
})!;

describe('GraphQL schema tooling', () => {
  it('normalizes introspection and formats nested type references', () => {
    expect(schema.queryType).toBe('Query');
    expect(graphqlTypeLabel(schema.types.find((type) => type.name === 'User')?.fields[0].type)).toBe('ID!');
  });

  it('validates variables, syntax balance, and root fields', () => {
    expect(validateGraphqlDocument('query { viewer { id } }', '{}', schema)).toEqual([]);
    expect(validateGraphqlDocument('query { missing }', '[]', schema).map((issue) => issue.message)).toEqual(expect.arrayContaining(["Unknown query field 'missing'.", 'GraphQL variables must be a JSON object.']));
    expect(validateGraphqlDocument('query { viewer ', '{}', schema)[0].message).toContain('Unclosed');
    expect(validateGraphqlDocument('query { viewer(id: "{{ account }}") }', '{}', schema).some((issue) => issue.message.includes('literal'))).toBe(true);
  });

  it('inserts a root selection with safe scalar child fields', () => {
    const viewer = schema.types.find((type) => type.name === 'Query')!.fields[0];
    expect(insertGraphqlRootField('', 'query', viewer, schema)).toContain('viewer { id name }');
  });
});

describe('GraphQL operation selection', () => {
  it('selects subscriptions by operation name across comments, strings, fragments, and object defaults', () => {
    const document = `
      # subscription Fake { ignored }
      query Viewer { viewer(note: "subscription AlsoFake { no }") { id } }
      subscription Orders($filter: Filter = { status: OPEN }) @live {
        orderChanged(filter: $filter) { ...OrderFields }
      }
      fragment OrderFields on Order { id }
    `;
    expect(graphqlOperationType(document)).toBeUndefined();
    expect(graphqlOperationType(document, 'Orders')).toBe('subscription');
    expect(graphqlOperationType(document, 'Viewer')).toBe('query');
    expect(graphqlOperationType(document, 'Missing')).toBeUndefined();
  });

  it('recognizes a sole anonymous query and only routes selected subscriptions to streaming', () => {
    expect(graphqlOperationType('{ viewer { id } }')).toBe('query');
    const request = createBlankRequest('subscription-operation');
    request.protocol = 'graphql';
    request.graphql.query = 'query Viewer { viewer { id } } subscription Events { event { id } }';
    request.graphql.operationName = 'Events';
    expect(isGraphqlSubscriptionRequest(request)).toBe(true);
    request.graphql.operationName = 'Viewer';
    expect(isGraphqlSubscriptionRequest(request)).toBe(false);
    expect(graphqlOperationType('subscription @live { event { id } }', 'live')).toBeUndefined();
    expect(graphqlOperationType('subscription Broken { event { id }')).toBeUndefined();
    expect(graphqlOperationType('subscription Broken { event { id } } }')).toBeUndefined();
  });
});
