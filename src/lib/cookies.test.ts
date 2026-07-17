import { describe, expect, it } from 'vitest';
import { cookieHeaderForUrl, parseSetCookie, storeResponseCookies } from './cookies';

const now = new Date('2026-07-16T12:00:00.000Z');

describe('cookie jar', () => {
  it('parses and selects secure, domain, path, and host-only cookies', () => {
    const host = parseSetCookie('session=abc; Path=/api; HttpOnly; Secure; SameSite=Lax', 'https://api.example.com/api/login', now)!;
    const domain = parseSetCookie('theme=dark; Domain=.example.com; Path=/', 'https://api.example.com/api/login', now)!;
    expect(host).toMatchObject({ domain: 'api.example.com', path: '/api', hostOnly: true, secure: true, httpOnly: true, sameSite: 'lax' });
    expect(cookieHeaderForUrl([host, domain], 'https://api.example.com/api/items', now)).toBe('session=abc; theme=dark');
    expect(cookieHeaderForUrl([host, domain], 'http://api.example.com/api/items', now)).toBe('theme=dark');
    expect(cookieHeaderForUrl([host, domain], 'https://www.example.com/', now)).toBe('theme=dark');
  });

  it('replaces matching cookies and removes expired Max-Age entries', () => {
    const first = storeResponseCookies([], 'https://api.example.com/', ['token=one; Path=/'], now);
    const replaced = storeResponseCookies(first, 'https://api.example.com/', ['token=two; Path=/'], now);
    expect(replaced).toHaveLength(1);
    expect(replaced[0].value).toBe('two');
    expect(storeResponseCookies(replaced, 'https://api.example.com/', ['token=gone; Path=/; Max-Age=0'], now)).toEqual([]);
  });

  it('rejects cookies whose Domain does not contain the response host', () => {
    expect(parseSetCookie('bad=1; Domain=attacker.example; Path=/', 'https://api.example.com/', now)).toBeUndefined();
  });
});
