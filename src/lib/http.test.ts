import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBlankRequest } from '../data/seed';
import { graphqlBody, sendRequest } from './http';

const tauri = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: tauri.invoke,
  isTauri: () => true,
}));

beforeEach(() => {
  tauri.invoke.mockReset();
});

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

describe('native HTTP transport preferences', () => {
  it('passes device HTTP and redirect preferences without changing saved request transport', async () => {
    tauri.invoke.mockResolvedValue({ status: 200, statusText: 'OK', headers: {}, body: '{}', durationMs: 1, sizeBytes: 2, setCookies: [], httpVersion: 'HTTP/2.0' });
    const request = createBlankRequest('preferred-http-version');
    request.url = 'https://example.test/status';

    const response = await sendRequest(request, undefined, { preferredHttpVersion: 'http2', maxRedirects: -1 });

    expect(response.httpVersion).toBe('HTTP/2.0');
    expect(tauri.invoke).toHaveBeenCalledWith('send_http_request', expect.objectContaining({
      input: expect.objectContaining({
        transport: expect.objectContaining({ preferredHttpVersion: 'http2', maxRedirects: -1 }),
      }),
    }));
    expect(request.transport).not.toHaveProperty('preferredHttpVersion');
    expect(request.transport).not.toHaveProperty('maxRedirects');
  });
});
