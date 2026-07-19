import { describe, expect, it, vi } from 'vitest';
import { cloneSeedWorkspace } from '../data/seed';
import type { StoredResponse } from '../types';
import { fakerFunctionNames, renderFakerValue } from './faker';
import { clearTemplatePromptValues, clearTemplatePromptValuesForRequest, renderTemplate } from './templates';

const request = cloneSeedWorkspace().collections[0].requests[0];
const response: StoredResponse = {
  id: 'response-one', requestId: 'create-order', requestName: 'Create Order', requestUrl: 'https://api.example.com/orders', environmentId: 'development', receivedAt: '2026-07-16T12:00:00Z',
  status: 201, statusText: 'Created', headers: { location: '/orders/ord_1' }, body: '{"id":"ord_1","items":[{"sku":"one"}]}', durationMs: 20, sizeBytes: 44,
};

describe('template engine', () => {
  it('renders environment, uuid, timestamp, base64, and hash tags', async () => {
    const context = { variables: { baseUrl: 'https://api.example.com' }, cookies: [], responses: [], request, now: new Date('2026-07-16T12:00:00Z'), uuid: () => '00000000-0000-4000-8000-000000000000' };
    await expect(renderTemplate('{{ baseUrl }}/{% uuid \'v4\' %}?at={% timestamp \'milliseconds\' %}', context)).resolves.toBe('https://api.example.com/00000000-0000-4000-8000-000000000000?at=1784203200000');
    await expect(renderTemplate("{% base64 'encode', 'hello' %}", context)).resolves.toBe('aGVsbG8=');
    await expect(renderTemplate("{% hash 'sha256', 'hex', 'hello' %}", context)).resolves.toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
    await expect(renderTemplate("{% hash 'md5', 'hex', 'hello' %}", context)).resolves.toBe('5d41402abc4b2a76b9719d911017c592');
    await expect(renderTemplate("{% hash 'md5', 'base64', 'hello' %}", context)).resolves.toBe('XUFAKrxLKna5cZ2REBfFkg==');
    await expect(renderTemplate("{% now 'custom', 'yyyy-MM-dd' %}", context)).resolves.toBe('2026-07-16');
    await expect(renderTemplate('{{$randomUUID}}/{{$timestamp}}/{{$isoTimestamp}}', context)).resolves.toBe('00000000-0000-4000-8000-000000000000/1784203200/2026-07-16T12:00:00.000Z');
    await expect(renderTemplate("{% jsonpath '{\"items\":[{\"id\":\"one\"}]}', '$.items[0].id' %}", context)).resolves.toBe('one');
    await expect(renderTemplate("{% prompt 'Token', 'Label', 'fallback' %}", { ...context, prompt: async ({ defaultValue }) => defaultValue })).resolves.toBe('fallback');
  });

  it('matches source-shaped OS and six-argument prompt behavior', async () => {
    clearTemplatePromptValues();
    const osInfo = async () => ({ arch: 'arm64', platform: 'darwin', release: '25.0.0', hostname: 'test-host', freemem: 42, cpus: [{ model: 'Test CPU', speed: 1, times: {} }], userInfo: { username: 'ada' } });
    const context = { variables: {}, cookies: [], responses: [], request, osInfo };
    await expect(renderTemplate("{% os 'arch' %}/{% os 'freemem' %}/{% os 'userInfo', '$.username' %}", context)).resolves.toBe('arm64/42/{"username":"ada"}');

    const calls: unknown[] = [];
    const prompt = async (input: unknown) => { calls.push(input); return 'secret'; };
    const source = "{% prompt 'Credentials', 'Password', 'fallback', 'login', 'true', 'false' %}";
    await expect(renderTemplate(source, { ...context, renderPurpose: 'preview', prompt })).resolves.toBe('fallback');
    await expect(Promise.all([
      renderTemplate(source, { ...context, prompt }),
      renderTemplate(source, { ...context, prompt }),
    ])).resolves.toEqual(['secret', 'secret']);
    expect(calls).toEqual([{ title: 'Credentials', label: 'Password', defaultValue: 'fallback', maskText: true }]);
    await expect(renderTemplate(source, { ...context, prompt: async () => 'different' })).resolves.toBe('secret');
    const implicit = "{% prompt 'Per send', 'Value', '', '', 'false', 'true' %}";
    await expect(renderTemplate(implicit, { ...context, prompt: async () => 'first' })).resolves.toBe('first');
    clearTemplatePromptValuesForRequest(request.id);
    await expect(renderTemplate(implicit, { ...context, prompt: async () => 'second' })).resolves.toBe('second');
    clearTemplatePromptValues();
  });

  it('resolves response body attributes, headers, and status for chaining', async () => {
    const context = { variables: {}, cookies: [], responses: [response], request };
    await expect(renderTemplate("{% response 'body', 'create-order', '$.items[0].sku' %}", context)).resolves.toBe('one');
    await expect(renderTemplate("{% response 'header', 'Create Order', 'Location' %}", context)).resolves.toBe('/orders/ord_1');
    await expect(renderTemplate("{% response 'raw', 'create-order' %}", context)).resolves.toBe(response.body);
  });

  it('preserves large JSON integers, multiple response matches, XPath, and trigger callbacks', async () => {
    const richResponse = { ...response, body: '{"id":9007199254740993,"items":[{"id":1},{"id":2}]}', receivedAt: '2026-07-16T12:00:00Z' };
    const context = { variables: {}, cookies: [], responses: [richResponse], request };
    await expect(renderTemplate("{% response 'body', 'create-order', '$.id' %}", context)).resolves.toBe('9007199254740993');
    await expect(renderTemplate("{% response 'body', 'create-order', '$.items[*].id' %}", context)).resolves.toBe('[1,2]');
    await expect(renderTemplate("{% response 'body', 'create-order', '/root/id/text()' %}", { ...context, responses: [{ ...response, body: '<root><id>one</id></root>' }] })).resolves.toBe('one');
    const resolveResponse = vi.fn(async () => ({ ...response, body: '{"id":"fresh"}', receivedAt: new Date().toISOString() }));
    await expect(renderTemplate("{% response 'body', 'create-order', '$.id', 'always', '60' %}", { ...context, resolveResponse })).resolves.toBe('fresh');
    expect(resolveResponse).toHaveBeenCalledWith(expect.objectContaining({ requestId: 'create-order', resendBehavior: 'always', maxAgeSeconds: 60, requestChain: ['create-order'] }));
    resolveResponse.mockClear();
    await expect(renderTemplate("{% response 'body', 'create-order', '$.id', 'always', '60' %}", { ...context, renderPurpose: 'preview', resolveResponse })).resolves.toBe('9007199254740993');
    expect(resolveResponse).not.toHaveBeenCalled();

    const sharedResponses: StoredResponse[] = [];
    const sharedCookies: typeof context.cookies = [];
    const resolveShared = vi.fn(async (input: { responses: StoredResponse[] }) => {
      const stored = { ...response, body: '{"id":"shared"}' };
      input.responses.push(stored);
      return stored;
    });
    await expect(renderTemplate("{% response 'body', 'create-order', '$.id', 'always' %}/{% response 'body', 'create-order', '$.id' %}", { ...context, cookies: sharedCookies, responses: sharedResponses, resolveResponse: resolveShared })).resolves.toBe('shared/shared');
  });

  it('resolves current request URL, rows, cookies, OAuth tokens, and folder ancestors', async () => {
    const currentRequest = structuredClone(request);
    currentRequest.name = 'Current request';
    currentRequest.url = '{{ baseUrl }}/orders';
    currentRequest.params = [{ id: 'query', name: 'expand', value: "{% base64 'decode', 'normal', 'aXRlbXM=' %}", enabled: false }];
    currentRequest.headers = [{ id: 'header', name: 'X-Token', value: 'abc', enabled: true }];
    currentRequest.auth = { ...currentRequest.auth, type: 'oauth2', accessToken: 'access', identityToken: 'identity', refreshToken: 'refresh' };
    const cookies = [{ id: 'session', name: 'session', value: 'cookie', domain: 'api.example.com', path: '/', secure: true, httpOnly: true, sameSite: 'lax' as const, hostOnly: true, createdAt: '2026-07-16T12:00:00Z' }];
    const context = { variables: { baseUrl: 'https://api.example.com' }, cookies, responses: [], request: currentRequest, requestAncestors: ['Child', 'Parent', 'Collection'] };
    await expect(renderTemplate("{% request 'url' %}", context)).resolves.toBe('https://api.example.com/orders?expand=items');
    await expect(renderTemplate("{% request 'parameter', 'EXPAND' %}/{% request 'header', 'x-token' %}", context)).resolves.toBe('items/abc');
    await expect(renderTemplate("{% request 'cookie', 'session' %}/{% request 'oauth2' %}/{% request 'oauth2-identity' %}/{% request 'oauth2-refresh' %}", context)).resolves.toBe('cookie/access/identity/refresh');
    await expect(renderTemplate("{% request 'folder', '', '1' %}", context)).resolves.toBe('Parent');
  });

  it('reports missing request dependencies instead of silently blanking them', async () => {
    await expect(renderTemplate("{% response 'body', 'missing', '$.id' %}", { variables: {}, cookies: [], responses: [], request })).rejects.toThrow("No stored response exists for 'missing'");
    await expect(renderTemplate("{% request 'url' %}", { variables: {}, cookies: [], responses: [], request: { ...request, url: "{% request 'url' %}" } })).rejects.toThrow('recursion exceeded');
    await expect(renderTemplate("{% prompt 'Unavailable' %}", { variables: {}, cookies: [], responses: [], request })).rejects.toThrow('interactive app window');
  });

  it('matches cookie tags after resolving environment values in the request URL', async () => {
    const templatedRequest = { ...request, url: '{{ baseUrl }}/api/items' };
    const cookies = [{ id: 'session', name: 'session', value: 'abc', domain: 'api.example.com', path: '/api', secure: true, httpOnly: true, sameSite: 'lax' as const, hostOnly: true, createdAt: '2026-07-16T12:00:00Z' }];
    await expect(renderTemplate("{% cookie 'session' %}", { variables: { baseUrl: 'https://api.example.com' }, cookies, responses: [], request: templatedRequest })).resolves.toBe('abc');
  });

  it('delegates four-family external vault tags without exposing provider credentials', async () => {
    const calls: unknown[] = [];
    const externalSecret = async (input: unknown) => { calls.push(input); return 'resolved-secret'; };
    await expect(renderTemplate("{% external 'hashicorp', 'secret/orders', '', 'token', 'latest' %}", { variables: {}, cookies: [], responses: [], request, externalSecret })).resolves.toBe('resolved-secret');
    expect(calls[0]).toMatchObject({ provider: 'hashicorp', reference: 'secret/orders', field: 'token', version: 'latest' });
  });

  it('matches the pinned 118-function Faker registry', async () => {
    expect(fakerFunctionNames).toHaveLength(118);
    expect(fakerFunctionNames).toEqual(expect.arrayContaining(['randomAlphaNumeric', 'randomBankAccountIban', 'randomDatabaseEngine', 'randomImageDataUri', 'randomLoremLines']));
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      for (const name of fakerFunctionNames) expect(await renderFakerValue(name)).not.toBe('');
    } finally {
      warning.mockRestore();
    }
    await expect(renderFakerValue('notARealFakerFunction')).rejects.toThrow("Faker variable 'notARealFakerFunction' is not supported");
  });

  it('supports safe JSONPath filters, recursive descent, slices, unions, and explicit failures', async () => {
    const context = { variables: {}, cookies: [], responses: [], request };
    const source = JSON.stringify({ store: { book: [{ title: 'one', price: 8 }, { title: 'two', price: 12 }, { title: 'three', price: 6 }], bicycle: { price: 19 } } });
    await expect(renderTemplate(`{% jsonpath '${source}', '$.store.book[?(@.price < 10)].title' %}`, context)).resolves.toBe('one');
    await expect(renderTemplate(`{% jsonpath '${source}', '$..price' %}`, context)).resolves.toBe('8');
    await expect(renderTemplate(`{% jsonpath '${source}', '$.store.book[0:2].title' %}`, context)).resolves.toBe('one');
    await expect(renderTemplate(`{% jsonpath '${source}', '$.store.book[0,2].title' %}`, context)).resolves.toBe('one');
    await expect(renderTemplate(`{% jsonpath '${source}', '$.missing' %}`, context)).rejects.toThrow('JSONPath query returned no results');
    await expect(renderTemplate("{% jsonpath '{', '$.id' %}", context)).rejects.toThrow('Invalid JSON');
  });

  it('supports pinned Base64 variants, timestamp aliases, explicit cookie URLs, and confined file reads', async () => {
    const cookies = [{ id: 'session', name: 'session', value: 'abc', domain: 'api.example.com', path: '/api', secure: true, httpOnly: true, sameSite: 'lax' as const, hostOnly: true, createdAt: '2026-07-16T12:00:00Z' }];
    const calls: string[] = [];
    const context = { variables: {}, cookies, responses: [], request, now: new Date('2026-07-16T12:00:00Z'), readFile: async (path: string) => { calls.push(path); return 'file contents'; } };
    await expect(renderTemplate("{% base64 'encode', 'url', 'hello?' %}", context)).resolves.toBe('aGVsbG8_');
    await expect(renderTemplate("{% base64 'decode', 'url', 'aGVsbG8_' %}", context)).resolves.toBe('hello?');
    await expect(renderTemplate("{% base64 'encode', 'hex', '6869' %}", context)).resolves.toBe('aGk=');
    await expect(renderTemplate("{% base64 'decode', 'hex', 'aGk=' %}", context)).resolves.toBe('6869');
    await expect(renderTemplate("{% now 'millis' %}/{% now 'unix' %}", context)).resolves.toBe('1784203200000/1784203200');
    await expect(renderTemplate("{% cookie 'https://api.example.com/api/items', 'session' %}", context)).resolves.toBe('abc');
    await expect(renderTemplate("{% file '/approved/data.txt' %}", context)).resolves.toBe('file contents');
    expect(calls).toEqual(['/approved/data.txt']);
    await expect(renderTemplate("{% file '/blocked.txt' %}", { ...context, readFile: undefined })).rejects.toThrow('desktop file access');
    await expect(renderTemplate("{% cookie 'https://other.example.com', 'session' %}", context)).rejects.toThrow("No cookie with name 'session'");
  });

  it('renders raw tags independently across concurrent request fields', async () => {
    const context = { variables: {}, cookies: [], responses: [], request };
    const outputs = await Promise.all(Array.from({ length: 20 }, (_, index) => renderTemplate(`field-${index}:{% base64 'encode', 'value-${index}' %}`, context)));
    expect(outputs).toEqual(Array.from({ length: 20 }, (_, index) => `field-${index}:${btoa(`value-${index}`)}`));
  });
});
