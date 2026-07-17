import { describe, expect, it } from 'vitest';
import { createBlankRequest } from '../data/seed';
import { graphqlBody } from './http';

describe('GraphQL request serialization', () => {
  it('keeps query template syntax literal while resolving variable templates', () => {
    const request = createBlankRequest('graphql-template-boundary');
    request.protocol = 'graphql';
    request.graphql.query = 'query { viewer(id: "{{ account_id }}") { id } }';
    request.graphql.variables = '{"accountId":"{{ account_id }}"}';

    expect(JSON.parse(graphqlBody(request, { account_id: 'acct-42' }))).toEqual({
      query: request.graphql.query,
      variables: { accountId: 'acct-42' },
      operationName: request.graphql.operationName,
    });
  });
});
