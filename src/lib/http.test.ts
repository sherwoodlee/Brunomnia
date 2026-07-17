import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBlankRequest } from '../data/seed';
import type { StoredResponse } from '../types';
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

    const response = await sendRequest(request, undefined, { preferredHttpVersion: 'http2', maxRedirects: -1, followRedirects: false });

    expect(response.httpVersion).toBe('HTTP/2.0');
    expect(tauri.invoke).toHaveBeenCalledWith('send_http_request', expect.objectContaining({
      input: expect.objectContaining({
        transport: expect.objectContaining({ preferredHttpVersion: 'http2', maxRedirects: -1, followRedirects: false }),
      }),
    }));
    expect(request.transport).not.toHaveProperty('preferredHttpVersion');
    expect(request.transport).not.toHaveProperty('maxRedirects');
    expect(request.transport).toMatchObject({ followRedirects: true, followRedirectsMode: 'global' });
  });

  it('honors explicit per-request redirect overrides over the device default', async () => {
    tauri.invoke.mockResolvedValue({ status: 200, statusText: 'OK', headers: {}, body: '{}', durationMs: 1, sizeBytes: 2, setCookies: [], httpVersion: 'HTTP/1.1' });
    const request = createBlankRequest('redirect-override');
    request.url = 'https://example.test/status';
    request.transport.followRedirectsMode = 'on';
    await sendRequest(request, undefined, { followRedirects: false });
    expect(tauri.invoke).toHaveBeenLastCalledWith('send_http_request', expect.objectContaining({ input: expect.objectContaining({ transport: expect.objectContaining({ followRedirects: true }) }) }));

    request.transport.followRedirectsMode = 'off';
    await sendRequest(request, undefined, { followRedirects: true });
    expect(tauri.invoke).toHaveBeenLastCalledWith('send_http_request', expect.objectContaining({ input: expect.objectContaining({ transport: expect.objectContaining({ followRedirects: false }) }) }));
  });

  it('filters response template history to the active environment when enabled', async () => {
    tauri.invoke.mockResolvedValue({ status: 200, statusText: 'OK', headers: {}, body: '{}', durationMs: 1, sizeBytes: 2, setCookies: [], httpVersion: 'HTTP/1.1' });
    const request = createBlankRequest('filtered-response-history');
    request.url = 'https://example.test/status';
    request.headers = [{ id: 'history-header', name: 'X-History', value: "{% response 'body', 'source-request' %}", enabled: true }];
    const stored = (id: string, environmentId: string, body: string): StoredResponse => ({
      id, environmentId, body, requestId: 'source-request', requestName: 'Source', requestUrl: 'https://example.test/source', receivedAt: `2026-07-17T00:00:0${id}.000Z`, status: 200, statusText: 'OK', headers: {}, durationMs: 1, sizeBytes: body.length,
    });

    await sendRequest(request, { id: 'development', name: 'Development', variables: [] }, {
      responses: [stored('2', 'production', 'production-value'), stored('1', 'development', 'development-value')],
      filterResponsesByEnv: true,
    });

    expect(tauri.invoke).toHaveBeenCalledWith('send_http_request', expect.objectContaining({
      input: expect.objectContaining({ headers: [expect.objectContaining({ value: 'development-value' })] }),
    }));
  });
});
