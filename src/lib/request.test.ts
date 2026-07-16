import { describe, expect, it } from 'vitest';
import { buildRequestUrl, resolveTemplate } from './request';
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
});
