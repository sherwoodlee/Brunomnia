import { describe, expect, it } from 'vitest';
import { cloneSeedWorkspace } from '../data/seed';
import type { StoredResponse } from '../types';
import { renderTemplate } from './templates';

const request = cloneSeedWorkspace().collections[0].requests[0];
const response: StoredResponse = {
  requestId: 'create-order', requestName: 'Create Order', requestUrl: 'https://api.example.com/orders', receivedAt: '2026-07-16T12:00:00Z',
  status: 201, statusText: 'Created', headers: { location: '/orders/ord_1' }, body: '{"id":"ord_1","items":[{"sku":"one"}]}', durationMs: 20, sizeBytes: 44,
};

describe('template engine', () => {
  it('renders environment, uuid, timestamp, base64, and hash tags', async () => {
    const context = { variables: { baseUrl: 'https://api.example.com' }, cookies: [], responses: [], request, now: new Date('2026-07-16T12:00:00Z'), uuid: () => '00000000-0000-4000-8000-000000000000' };
    await expect(renderTemplate('{{ baseUrl }}/{% uuid \'v4\' %}?at={% timestamp \'milliseconds\' %}', context)).resolves.toBe('https://api.example.com/00000000-0000-4000-8000-000000000000?at=1784203200000');
    await expect(renderTemplate("{% base64 'encode', 'hello' %}", context)).resolves.toBe('aGVsbG8=');
    await expect(renderTemplate("{% hash 'sha256', 'hex', 'hello' %}", context)).resolves.toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
    await expect(renderTemplate('{{$randomUUID}}/{{$timestamp}}/{{$isoTimestamp}}', context)).resolves.toBe('00000000-0000-4000-8000-000000000000/1784203200/2026-07-16T12:00:00.000Z');
    await expect(renderTemplate("{% jsonpath '{\"items\":[{\"id\":\"one\"}]}', '$.items[0].id' %}", context)).resolves.toBe('one');
    await expect(renderTemplate("{% prompt 'Token', 'fallback' %}", { ...context, prompt: (_message, value) => value ?? '' })).resolves.toBe('fallback');
  });

  it('resolves response body attributes, headers, and status for chaining', async () => {
    const context = { variables: {}, cookies: [], responses: [response], request };
    await expect(renderTemplate("{% response 'body', 'create-order', '$.items[0].sku' %}", context)).resolves.toBe('one');
    await expect(renderTemplate("{% response 'header', 'Create Order', 'Location' %}", context)).resolves.toBe('/orders/ord_1');
    await expect(renderTemplate("{% response 'statusCode', 'create-order' %}", context)).resolves.toBe('201');
  });

  it('reports missing request dependencies instead of silently blanking them', async () => {
    await expect(renderTemplate("{% response 'body', 'missing', '$.id' %}", { variables: {}, cookies: [], responses: [], request })).rejects.toThrow("No stored response exists for 'missing'");
  });

  it('matches cookie tags after resolving environment values in the request URL', async () => {
    const templatedRequest = { ...request, url: '{{ baseUrl }}/api/items' };
    const cookies = [{ id: 'session', name: 'session', value: 'abc', domain: 'api.example.com', path: '/api', secure: true, httpOnly: true, sameSite: 'lax' as const, hostOnly: true, createdAt: '2026-07-16T12:00:00Z' }];
    await expect(renderTemplate("{% cookie 'session' %}", { variables: { baseUrl: 'https://api.example.com' }, cookies, responses: [], request: templatedRequest })).resolves.toBe('abc');
  });
});
