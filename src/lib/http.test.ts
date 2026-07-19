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
  it('decodes native response bytes with the declared charset before hooks and previews', async () => {
    tauri.invoke.mockResolvedValue({ status: 200, statusText: 'OK', headers: { 'content-type': 'text/plain; charset=windows-1252' }, body: 'caf�', bodyBase64: 'Y2Fm6Q==', durationMs: 1, sizeBytes: 4, setCookies: [], httpVersion: 'HTTP/1.1' });
    const request = createBlankRequest('native-response-charset');
    request.url = 'https://example.test/legacy-text';

    const response = await sendRequest(request, undefined);

    expect(response).toMatchObject({ body: 'café', bodyBase64: 'Y2Fm6Q==', sizeBytes: 4 });
  });

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
    tauri.invoke.mockResolvedValue({ status: 200, statusText: 'OK', headers: {}, body: '{"access_token":"oauth-token","id_token":"identity-token"}', durationMs: 1, sizeBytes: 58, setCookies: [], httpVersion: 'HTTP/1.1' });
    const request = createBlankRequest('oauth-certificates');
    request.url = 'https://api.example.test/items';
    request.auth.oauth2GrantType = 'client_credentials';
    request.auth.accessTokenUrl = 'https://auth.example.test/token';
    request.auth.clientId = 'client';
    request.auth.clientSecret = 'secret';
    request.auth.origin = 'https://app.example.test';

    const token = await fetchOAuth2Token(request, undefined, { validateCertificates: true, validateAuthCertificates: false });

    expect(tauri.invoke).toHaveBeenCalledWith('send_http_request', expect.objectContaining({ input: expect.objectContaining({ transport: expect.objectContaining({ validateCertificates: false }) }) }));
    expect(tauri.invoke).toHaveBeenCalledWith('send_http_request', expect.objectContaining({ input: expect.objectContaining({ headers: expect.arrayContaining([expect.objectContaining({ name: 'Origin', value: 'https://app.example.test' })]) }) }));
    expect(token.identityToken).toBe('identity-token');
    expect(request.transport.validateCertificatesMode).toBe('global');
  });

  it('refreshes expired OAuth credentials before sending the protected request', async () => {
    tauri.invoke
      .mockResolvedValueOnce({ status: 200, statusText: 'OK', headers: {}, body: '{"access_token":"fresh-token","expires_in":60}', durationMs: 1, sizeBytes: 48, setCookies: [], httpVersion: 'HTTP/2.0' })
      .mockResolvedValueOnce({ status: 200, statusText: 'OK', headers: {}, body: '{}', durationMs: 2, sizeBytes: 2, setCookies: [], httpVersion: 'HTTP/2.0' });
    const request = createBlankRequest('oauth-refresh-before-send');
    request.url = 'https://api.example.test/protected';
    request.auth = {
      ...request.auth,
      type: 'oauth2',
      accessTokenUrl: 'https://identity.example.test/token',
      accessToken: 'expired-token',
      refreshToken: 'refresh-token',
      expiresAt: Date.now() - 1,
    };
    const onOAuth2Token = vi.fn();

    await sendRequest(request, undefined, { onOAuth2Token });

    expect(tauri.invoke).toHaveBeenCalledTimes(2);
    expect(tauri.invoke.mock.calls[1][1]).toEqual(expect.objectContaining({ input: expect.objectContaining({
      headers: expect.arrayContaining([expect.objectContaining({ name: 'Authorization', value: 'Bearer fresh-token' })]),
    }) }));
    expect(onOAuth2Token).toHaveBeenCalledWith(expect.objectContaining({ auth: expect.objectContaining({ accessToken: 'fresh-token' }) }));
  });

  it('refuses to send an interactive OAuth request without a usable credential', async () => {
    const request = createBlankRequest('oauth-authorization-required');
    request.url = 'https://api.example.test/protected';
    request.auth = { ...request.auth, type: 'oauth2', authorizationUrl: 'https://identity.example.test/authorize', accessTokenUrl: 'https://identity.example.test/token' };
    await expect(sendRequest(request, undefined)).rejects.toThrow('browser authorization is required');
    expect(tauri.invoke).not.toHaveBeenCalled();
  });

  it('waits for a supplied interactive OAuth resolver before protected traffic', async () => {
    tauri.invoke.mockResolvedValue({ status: 200, statusText: 'OK', headers: {}, body: '{}', durationMs: 1, sizeBytes: 2, setCookies: [], httpVersion: 'HTTP/2.0' });
    const request = createBlankRequest('oauth-interactive-send');
    request.url = 'https://api.example.test/protected';
    request.auth = { ...request.auth, type: 'oauth2', authorizationUrl: 'https://identity.example.test/authorize', accessTokenUrl: 'https://identity.example.test/token' };
    const authorizeOAuth2 = vi.fn().mockResolvedValue({ ...request.auth, accessToken: 'interactive-token' });
    const onOAuth2Token = vi.fn();

    await sendRequest(request, undefined, { authorizeOAuth2, onOAuth2Token });

    expect(authorizeOAuth2).toHaveBeenCalledWith(request, undefined);
    expect(onOAuth2Token).toHaveBeenCalledWith(expect.objectContaining({ auth: expect.objectContaining({ accessToken: 'interactive-token' }) }));
    expect(tauri.invoke).toHaveBeenCalledTimes(1);
    expect(tauri.invoke).toHaveBeenCalledWith('send_http_request', expect.objectContaining({ input: expect.objectContaining({
      headers: expect.arrayContaining([expect.objectContaining({ name: 'Authorization', value: 'Bearer interactive-token' })]),
    }) }));
  });

  it('reauthorizes interactively after an invalid refresh grant', async () => {
    tauri.invoke
      .mockResolvedValueOnce({ status: 400, statusText: 'Bad Request', headers: {}, body: '{"error":"invalid_grant"}', durationMs: 1, sizeBytes: 25, setCookies: [], httpVersion: 'HTTP/2.0' })
      .mockResolvedValueOnce({ status: 200, statusText: 'OK', headers: {}, body: '{}', durationMs: 1, sizeBytes: 2, setCookies: [], httpVersion: 'HTTP/2.0' });
    const request = createBlankRequest('oauth-invalid-refresh');
    request.url = 'https://api.example.test/protected';
    request.auth = { ...request.auth, type: 'oauth2', accessTokenUrl: 'https://identity.example.test/token', authorizationUrl: 'https://identity.example.test/authorize', accessToken: 'expired', refreshToken: 'rejected', expiresAt: Date.now() - 1 };
    const authorizeOAuth2 = vi.fn().mockResolvedValue({ ...request.auth, accessToken: 'reauthorized', refreshToken: 'new-refresh', expiresAt: 0 });

    await sendRequest(request, undefined, { authorizeOAuth2 });

    expect(authorizeOAuth2).toHaveBeenCalledOnce();
    expect(tauri.invoke).toHaveBeenCalledTimes(2);
    expect(tauri.invoke.mock.calls[1][1]).toEqual(expect.objectContaining({ input: expect.objectContaining({
      headers: expect.arrayContaining([expect.objectContaining({ name: 'Authorization', value: 'Bearer reauthorized' })]),
    }) }));
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
