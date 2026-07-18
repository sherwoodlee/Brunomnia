import { describe, expect, it } from 'vitest';
import { normalizedResponseLink, responseLineSegments } from './responseLinks';

describe('response viewer links', () => {
  it('detects bounded HTTP links while preserving surrounding text and punctuation', () => {
    expect(responseLineSegments('Docs: https://example.test/api?q=one, then http://localhost:3000/a(b).')).toEqual([
      { kind: 'text', value: 'Docs: ' },
      { kind: 'link', value: 'https://example.test/api?q=one', url: 'https://example.test/api?q=one' },
      { kind: 'text', value: ', then ' },
      { kind: 'link', value: 'http://localhost:3000/a(b)', url: 'http://localhost:3000/a(b)' },
      { kind: 'text', value: '.' },
    ]);
  });

  it('decodes XML entities only for the opened URL', () => {
    expect(responseLineSegments('https://example.test/search?a=1&amp;b=2', true)).toEqual([
      { kind: 'link', value: 'https://example.test/search?a=1&amp;b=2', url: 'https://example.test/search?a=1&b=2' },
    ]);
  });

  it('rejects non-web schemes, malformed input, and oversized links', () => {
    expect(normalizedResponseLink('javascript:alert(1)')).toBe('');
    expect(normalizedResponseLink('not a URL')).toBe('');
    expect(normalizedResponseLink(`https://example.test/${'x'.repeat(8_192)}`)).toBe('');
    expect(responseLineSegments('file:///tmp/secret mailto:test@example.test')).toEqual([{ kind: 'text', value: 'file:///tmp/secret mailto:test@example.test' }]);
  });

  it('caps clickable targets without changing overflow text', () => {
    const line = Array.from({ length: 102 }, (_, index) => `https://example.test/${index}`).join(' ');
    const segments = responseLineSegments(line);

    expect(segments.filter((segment) => segment.kind === 'link')).toHaveLength(100);
    expect(segments.map((segment) => segment.value).join('')).toBe(line);
    expect(segments.at(-1)).toEqual({ kind: 'text', value: ' https://example.test/100 https://example.test/101' });
  });
});
