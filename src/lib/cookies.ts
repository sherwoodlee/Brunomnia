import type { CookieRecord } from '../types';

const cookieId = (domain: string, path: string, name: string) => `cookie-${encodeURIComponent(domain)}-${encodeURIComponent(path)}-${encodeURIComponent(name)}`;

const defaultPath = (pathname: string) => {
  if (!pathname.startsWith('/') || pathname === '/') return '/';
  const lastSlash = pathname.lastIndexOf('/');
  return lastSlash <= 0 ? '/' : pathname.slice(0, lastSlash);
};

const parseDate = (value: string) => {
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : undefined;
};

export const parseSetCookie = (header: string, requestUrl: string, now = new Date()): CookieRecord | undefined => {
  const url = new URL(requestUrl);
  const [pair, ...attributes] = header.split(';');
  const separator = pair.indexOf('=');
  if (separator <= 0) return undefined;
  const name = pair.slice(0, separator).trim();
  const value = pair.slice(separator + 1).trim();
  if (!name) return undefined;
  let domain = url.hostname.toLowerCase();
  let path = defaultPath(url.pathname);
  let expires: string | undefined;
  let secure = false;
  let httpOnly = false;
  let sameSite: CookieRecord['sameSite'] = '';
  let hostOnly = true;

  for (const rawAttribute of attributes) {
    const [rawName, ...rawValue] = rawAttribute.trim().split('=');
    const attribute = rawName.toLowerCase();
    const attributeValue = rawValue.join('=').trim();
    if (attribute === 'domain' && attributeValue) {
      domain = attributeValue.replace(/^\./, '').toLowerCase();
      hostOnly = false;
    } else if (attribute === 'path' && attributeValue.startsWith('/')) path = attributeValue;
    else if (attribute === 'expires') expires = parseDate(attributeValue);
    else if (attribute === 'max-age') {
      const seconds = Number(attributeValue);
      if (Number.isFinite(seconds)) expires = new Date(now.getTime() + seconds * 1000).toISOString();
    } else if (attribute === 'secure') secure = true;
    else if (attribute === 'httponly') httpOnly = true;
    else if (attribute === 'samesite' && ['strict', 'lax', 'none'].includes(attributeValue.toLowerCase())) sameSite = attributeValue.toLowerCase() as CookieRecord['sameSite'];
  }

  if (hostOnly ? domain !== url.hostname.toLowerCase() : !(url.hostname.toLowerCase() === domain || url.hostname.toLowerCase().endsWith(`.${domain}`))) return undefined;
  return { id: cookieId(domain, path, name), name, value, domain, path, expires, secure, httpOnly, sameSite, hostOnly, createdAt: now.toISOString() };
};

export const storeResponseCookies = (cookies: CookieRecord[], requestUrl: string, setCookieHeaders: string[], now = new Date()): CookieRecord[] => {
  const output = [...cookies];
  for (const header of setCookieHeaders) {
    const parsed = parseSetCookie(header, requestUrl, now);
    if (!parsed) continue;
    const index = output.findIndex((cookie) => cookie.name === parsed.name && cookie.domain === parsed.domain && cookie.path === parsed.path);
    const expired = parsed.expires !== undefined && Date.parse(parsed.expires) <= now.getTime();
    if (expired) {
      if (index >= 0) output.splice(index, 1);
    } else if (index >= 0) output[index] = parsed;
    else output.push(parsed);
  }
  return output;
};

const domainMatches = (cookie: CookieRecord, hostname: string) => cookie.hostOnly
  ? hostname === cookie.domain
  : hostname === cookie.domain || hostname.endsWith(`.${cookie.domain}`);

const pathMatches = (cookiePath: string, requestPath: string) => requestPath === cookiePath
  || (requestPath.startsWith(cookiePath) && (cookiePath.endsWith('/') || requestPath[cookiePath.length] === '/'));

export const cookiesForUrl = (cookies: CookieRecord[], requestUrl: string, now = new Date()): CookieRecord[] => {
  const url = new URL(requestUrl);
  const hostname = url.hostname.toLowerCase();
  return cookies.filter((cookie) => {
    if (cookie.expires && Date.parse(cookie.expires) <= now.getTime()) return false;
    if (cookie.secure && url.protocol !== 'https:' && url.protocol !== 'wss:') return false;
    return domainMatches(cookie, hostname) && pathMatches(cookie.path, url.pathname || '/');
  }).sort((left, right) => right.path.length - left.path.length || left.createdAt.localeCompare(right.createdAt));
};

export const cookieHeaderForUrl = (cookies: CookieRecord[], requestUrl: string, now = new Date()) => cookiesForUrl(cookies, requestUrl, now)
  .map((cookie) => `${cookie.name}=${cookie.value}`)
  .join('; ');

export const cookieValueForUrl = (cookies: CookieRecord[], requestUrl: string, name: string, now = new Date()) => cookiesForUrl(cookies, requestUrl, now)
  .find((cookie) => cookie.name === name)?.value ?? '';
