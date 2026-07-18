import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBlankRequest } from '../data/seed';
import type { StoredResponse } from '../types';
import { fetchOAuth2Token, graphqlBody, sendRequest } from './http';

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

    const response = await sendRequest(request, undefined, { preferredHttpVersion: 'http2', maxRedirects: -1, followRedirects: false, requestTimeoutMs: 0, validateCertificates: false, proxy: { enabled: true, httpProxy: 'http://http-proxy.test:8080', httpsProxy: 'http://https-proxy.test:8443', noProxy: 'localhost' } });

    expect(response.httpVersion).toBe('HTTP/2.0');
    expect(tauri.invoke).toHaveBeenCalledWith('send_http_request', expect.objectContaining({
      input: expect.objectContaining({
        transport: expect.objectContaining({ preferredHttpVersion: 'http2', maxRedirects: -1, followRedirects: false, timeoutMs: 0, validateCertificates: false, proxyMode: 'custom', proxyUrl: 'http://https-proxy.test:8443', proxyExclusions: 'localhost' }),
      }),
    }));
    expect(request.transport).not.toHaveProperty('preferredHttpVersion');
    expect(request.transport).not.toHaveProperty('maxRedirects');
    expect(request.transport).toMatchObject({ followRedirects: true, followRedirectsMode: 'global', timeoutMode: 'global', timeoutMs: 60_000, validateCertificates: true, validateCertificatesMode: 'global', proxyMode: 'global', proxyUrl: '' });
  });

  it('honors explicit request certificate-validation modes over the device preference', async () => {
    tauri.invoke.mockResolvedValue({ status: 200, statusText: 'OK', headers: {}, body: '{}', durationMs: 1, sizeBytes: 2, setCookies: [], httpVersion: 'HTTP/1.1' });
    const request = createBlankRequest('certificate-override');
    request.url = 'https://example.test/status';
    request.transport.validateCertificatesMode = 'on';
    await sendRequest(request, undefined, { validateCertificates: false });
    expect(tauri.invoke).toHaveBeenLastCalledWith('send_http_request', expect.objectContaining({ input: expect.objectContaining({ transport: expect.objectContaining({ validateCertificates: true }) }) }));

    request.transport.validateCertificatesMode = 'off';
    await sendRequest(request, undefined, { validateCertificates: true });
    expect(tauri.invoke).toHaveBeenLastCalledWith('send_http_request', expect.objectContaining({ input: expect.objectContaining({ transport: expect.objectContaining({ validateCertificates: false }) }) }));
  });

  it('uses the separate authentication certificate preference for OAuth token calls', async () => {
    tauri.invoke.mockResolvedValue({ status: 200, statusText: 'OK', headers: {}, body: '{"access_token":"oauth-token"}', durationMs: 1, sizeBytes: 30, setCookies: [], httpVersion: 'HTTP/1.1' });
    const request = createBlankRequest('oauth-certificates');
    request.url = 'https://api.example.test/items';
    request.auth.oauth2GrantType = 'client_credentials';
    request.auth.accessTokenUrl = 'https://auth.example.test/token';
    request.auth.clientId = 'client';
    request.auth.clientSecret = 'secret';

    await fetchOAuth2Token(request, undefined, { validateCertificates: true, validateAuthCertificates: false });

    expect(tauri.invoke).toHaveBeenCalledWith('send_http_request', expect.objectContaining({ input: expect.objectContaining({ transport: expect.objectContaining({ validateCertificates: false }) }) }));
    expect(request.transport.validateCertificatesMode).toBe('global');
  });

  it('honors explicit request proxy modes over the device preference', async () => {
    tauri.invoke.mockResolvedValue({ status: 200, statusText: 'OK', headers: {}, body: '{}', durationMs: 1, sizeBytes: 2, setCookies: [], httpVersion: 'HTTP/1.1' });
    const request = createBlankRequest('proxy-override');
    request.url = 'https://example.test/status';
    request.transport.proxyMode = 'custom';
    request.transport.proxyUrl = 'http://request-proxy.test:9000';
    await sendRequest(request, undefined, { proxy: { enabled: false, httpProxy: '', httpsProxy: '', noProxy: '' } });
    expect(tauri.invoke).toHaveBeenLastCalledWith('send_http_request', expect.objectContaining({ input: expect.objectContaining({ transport: expect.objectContaining({ proxyMode: 'custom', proxyUrl: 'http://request-proxy.test:9000' }) }) }));

    request.transport.proxyMode = 'disabled';
    await sendRequest(request, undefined, { proxy: { enabled: true, httpProxy: 'http://global', httpsProxy: 'http://global', noProxy: '' } });
    expect(tauri.invoke).toHaveBeenLastCalledWith('send_http_request', expect.objectContaining({ input: expect.objectContaining({ transport: expect.objectContaining({ proxyMode: 'disabled', proxyUrl: '' }) }) }));
  });

  it('honors an explicit request timeout over the device preference', async () => {
    tauri.invoke.mockResolvedValue({ status: 200, statusText: 'OK', headers: {}, body: '{}', durationMs: 1, sizeBytes: 2, setCookies: [], httpVersion: 'HTTP/1.1' });
    const request = createBlankRequest('timeout-override');
    request.url = 'https://example.test/status';
    request.transport.timeoutMode = 'custom';
    request.transport.timeoutMs = 4_321;

    await sendRequest(request, undefined, { requestTimeoutMs: 30_000 });

    expect(tauri.invoke).toHaveBeenCalledWith('send_http_request', expect.objectContaining({ input: expect.objectContaining({ transport: expect.objectContaining({ timeoutMs: 4_321 }) }) }));
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

  it('attaches size-bounded outgoing and response timeline evidence', async () => {
    tauri.invoke.mockResolvedValue({ status: 201, statusText: 'Created', headers: {}, body: '{}', durationMs: 3, sizeBytes: 2, setCookies: [], httpVersion: 'HTTP/1.1' });
    const request = createBlankRequest('timeline-evidence');
    request.method = 'POST';
    request.url = 'https://example.test/items';
    request.bodyMode = 'text';
    request.body = 'x'.repeat(1_024);

    const response = await sendRequest(request, undefined, { maxTimelineDataSizeKB: 0 });
    expect(response.timeline).toEqual([
      expect.objectContaining({ name: 'Text', value: 'Preparing POST request to https://example.test/items' }),
      expect.objectContaining({ name: 'DataOut', value: '(1.0 KiB hidden)', hidden: true }),
      expect.objectContaining({ value: 'Response 201 Created; received 2 B decoded body' }),
      expect.objectContaining({ value: 'Negotiated HTTP/1.1' }),
      expect.objectContaining({ value: 'Response body decoded and available to scripts and preview' }),
    ]);
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
