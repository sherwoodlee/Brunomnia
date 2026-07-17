import { describe, expect, it } from 'vitest';
import { graphqlTypeLabel, insertGraphqlRootField, normalizeGraphqlSchema, validateGraphqlDocument } from './graphql';

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
