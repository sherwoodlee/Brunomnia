import { describe, expect, it } from 'vitest';
import { buildRequestUrl, normalizeHttpMethod, prettyRequestBody, resolveTemplate } from './request';
import { createBlankRequest } from '../data/seed';

describe('request templates', () => {
  it('resolves known variables and preserves unknown variables', () => {
    expect(resolveTemplate('{{ baseUrl }}/orders/{{ missing }}', { baseUrl: 'https://api.example.com' })).toBe(
      'https://api.example.com/orders/{{ missing }}',
    );
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
});
