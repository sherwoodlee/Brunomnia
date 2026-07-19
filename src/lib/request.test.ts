import { describe, expect, it } from 'vitest';
import { buildRequestUrl, changeRequestBodyContentType, changeRequestBodyMode, normalizeHttpMethod, prettyRequestBody, requestBodyContentType, resolveTemplate } from './request';
import { createBlankRequest } from '../data/seed';

describe('request templates', () => {
  it('resolves known variables and preserves unknown variables', () => {
    expect(resolveTemplate('{{ baseUrl }}/orders/{{ missing }}', { baseUrl: 'https://api.example.com' })).toBe(
      'https://api.example.com/orders/{{ missing }}',
    );
    expect(resolveTemplate('{{ toString }}', {})).toBe('{{ toString }}');
  });

  it('adds enabled query parameters', () => {
    const request = createBlankRequest('test');
    request.url = '{{ baseUrl }}/orders';
    request.params = [
      { id: 'one', name: 'limit', value: '20', enabled: true },
      { id: 'two', name: 'hidden', value: 'yes', enabled: false },
    ];
    expect(buildRequestUrl(request, { baseUrl: 'https://api.example.com' })).toBe(
      'https://api.example.com/orders?limit=20',
    );
  });

  it('encodes explicit path parameters and preserves repeated query keys', () => {
    const request = createBlankRequest('paths');
    request.url = 'https://api.example.com/teams/{team}/items/{item}';
    request.pathParams = [
      { id: 'team', name: 'team', value: 'Core API', enabled: true },
      { id: 'item', name: 'item', value: 'one/two', enabled: true },
    ];
    request.params = [
      { id: 'tag-one', name: 'tag', value: 'first', enabled: true },
      { id: 'tag-two', name: 'tag', value: 'second', enabled: true },
    ];
    expect(buildRequestUrl(request, {})).toBe('https://api.example.com/teams/Core%20API/items/one%2Ftwo?tag=first&tag=second');
  });

  it('normalizes valid custom methods and rejects invalid tokens', () => {
    expect(normalizeHttpMethod(' propfind ')).toBe('PROPFIND');
    expect(normalizeHttpMethod('bad method')).toBe('GET');
  });

  it('beautifies JSON and XML request bodies without changing plain text', () => {
    const request = createBlankRequest('body');
    request.bodyMode = 'json';
    request.body = '{"ok":true,"items":[1,2]}';
    expect(prettyRequestBody(request)).toBe('{\n  "ok": true,\n  "items": [\n    1,\n    2\n  ]\n}');
    request.bodyMode = 'text';
    request.body = '<root><item>one</item></root>';
    expect(prettyRequestBody(request)).toBe('<root>\n  <item>one</item>\n</root>');
    request.body = 'leave me alone';
    expect(prettyRequestBody(request)).toBe('leave me alone');
  });

  it('synchronizes body modes and arbitrary raw MIME types with Content-Type', () => {
    const request = createBlankRequest('body-content-type');
    request.headers = [{ id: 'old', name: 'content-type', value: 'application/legacy', enabled: false }];

    Object.assign(request, changeRequestBodyMode(request, 'json'));
    expect(requestBodyContentType(request)).toBe('application/json');
    expect(request.headers).toEqual([{ id: 'old', name: 'content-type', value: 'application/json', enabled: true }]);

    Object.assign(request, changeRequestBodyContentType(request, 'application/yaml'));
    expect(request.bodyMode).toBe('text');
    expect(requestBodyContentType(request)).toBe('application/yaml');
    expect(changeRequestBodyMode(request, 'text')).toEqual({ bodyMode: 'text' });
    Object.assign(request, changeRequestBodyContentType(request, ''));
    expect(requestBodyContentType(request)).toBe('');

    Object.assign(request, changeRequestBodyMode(request, 'multipart'));
    expect(request.headers[0].value).toBe('multipart/form-data');
    Object.assign(request, changeRequestBodyMode(request, 'binary'));
    expect(request.headers).toEqual([]);
  });
});
