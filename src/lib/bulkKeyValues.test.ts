import { describe, expect, it } from 'vitest';
import { formatBulkKeyValues, parseBulkKeyValues } from './bulkKeyValues';

describe('bulk key/value editors', () => {
  it('formats enabled nonblank rows in order and omits disabled metadata', () => {
    expect(formatBulkKeyValues([
      { id: 'one', name: 'Accept', value: 'application/json', enabled: true, description: 'kept only in regular mode' },
      { id: 'two', name: 'X-Off', value: 'hidden', enabled: false },
      { id: 'three', name: '', value: '', enabled: true },
      { id: 'four', name: 'Accept', value: 'text/plain', enabled: true },
    ])).toBe('Accept: application/json\nAccept: text/plain\n');
  });

  it('splits on the first colon, trims fields, and preserves duplicate order', () => {
    expect(parseBulkKeyValues(' Accept: application/json\nX-URL: https://example.test:8443/path\nAccept: text/plain\nname-only\n', (index) => `row-${index}`)).toEqual([
      { id: 'row-0', name: 'Accept', value: 'application/json', enabled: true },
      { id: 'row-1', name: 'X-URL', value: 'https://example.test:8443/path', enabled: true },
      { id: 'row-2', name: 'Accept', value: 'text/plain', enabled: true },
      { id: 'row-3', name: 'name-only', value: '', enabled: true },
    ]);
  });
});
