import { invoke, isTauri } from '@tauri-apps/api/core';
import type { ApiDesignSourceFile } from '../types';

export type RemoteSourceReader = (url: string) => Promise<string>;

const MAX_SOURCE_FILES = 100;
const MAX_SOURCE_FILE_BYTES = 1_000_000;
const MAX_SOURCE_TOTAL_BYTES = 10_000_000;
const REMOTE_CACHE_MS = 5 * 60_000;
const remoteSourceCache = new Map<string, { contents: string; expiresAt: number }>();

export const API_DESIGN_SOURCE_LIMITS = {
  files: MAX_SOURCE_FILES,
  fileBytes: MAX_SOURCE_FILE_BYTES,
  totalBytes: MAX_SOURCE_TOTAL_BYTES,
} as const;

export const utf8Length = (value: string) => new TextEncoder().encode(value).byteLength;

export const normalizeRelativeApiDesignPath = (rawPath: string) => {
  const normalized = rawPath.trim().replaceAll('\\', '/').replace(/^\.\//, '');
  if (!normalized || normalized.includes('\0') || normalized.startsWith('/')) throw new Error(`Source path '${rawPath}' must be relative.`);
  const segments: string[] = [];
  for (const segment of normalized.split('/')) {
    if (!segment || segment === '.') continue;
    if (segment === '..') {
      if (!segments.length) throw new Error(`Source path '${rawPath}' escapes its selected root.`);
      segments.pop();
    } else {
      segments.push(segment);
    }
  }
  if (!segments.length) throw new Error(`Source path '${rawPath}' is empty.`);
  if (!/\.(?:json|ya?ml)$/i.test(segments.at(-1) ?? '')) throw new Error(`Source path '${rawPath}' must end in .json, .yaml, or .yml.`);
  return segments.join('/');
};

export const normalizeApiDesignSourceFiles = (files: ApiDesignSourceFile[] = []) => {
  if (files.length > MAX_SOURCE_FILES) throw new Error(`API designs accept at most ${MAX_SOURCE_FILES} source files.`);
  let totalBytes = 0;
  const seen = new Set<string>();
  return files.map((file) => {
    const path = normalizeRelativeApiDesignPath(file.path);
    const size = utf8Length(file.contents);
    if (size > MAX_SOURCE_FILE_BYTES) throw new Error(`Source file '${path}' exceeds the 1 MB limit.`);
    totalBytes += size;
    if (totalBytes > MAX_SOURCE_TOTAL_BYTES) throw new Error('API design source files exceed the 10 MB combined limit.');
    if (seen.has(path)) throw new Error(`Source file '${path}' is duplicated.`);
    seen.add(path);
    return { path, contents: file.contents };
  });
};

const privateLiteralHost = (hostname: string) => {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost')) return true;
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)?.slice(1).map(Number);
  if (ipv4?.length === 4 && ipv4.every((part) => part <= 255)) {
    const [first, second] = ipv4;
    return first === 0 || first === 10 || first === 127 || (first === 169 && second === 254)
      || (first === 172 && second >= 16 && second <= 31) || (first === 192 && second === 168);
  }
  return host === '::' || host === '::1' || host.startsWith('fc') || host.startsWith('fd') || /^fe[89ab]/.test(host);
};

export const safeSpecificationRemoteUrl = (rawUrl: string) => {
  let url: URL;
  try { url = new URL(rawUrl); } catch { throw new Error(`Remote source '${rawUrl}' is not a valid URL.`); }
  if (url.protocol !== 'https:') throw new Error(`Remote source '${url.href}' must use HTTPS.`);
  if (url.username || url.password) throw new Error(`Remote source '${url.href}' cannot contain URL credentials.`);
  if (!url.hostname || privateLiteralHost(url.hostname)) throw new Error(`Remote source '${url.href}' targets a private or loopback host.`);
  return url;
};

export const fetchPublicSpecificationSource: RemoteSourceReader = async (rawUrl) => {
  const url = safeSpecificationRemoteUrl(rawUrl).href;
  const cached = remoteSourceCache.get(url);
  if (cached && cached.expiresAt > Date.now()) return cached.contents;
  let contents: string;
  if (isTauri()) {
    contents = await invoke<string>('fetch_public_specification_source', { url });
  } else {
    const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error(`Failed to fetch '${url}': ${response.status} ${response.statusText}`);
    const declared = Number(response.headers.get('content-length') ?? 0);
    if (declared > MAX_SOURCE_FILE_BYTES) throw new Error(`Remote source '${url}' exceeds the 1 MB limit.`);
    contents = await response.text();
  }
  if (utf8Length(contents) > MAX_SOURCE_FILE_BYTES) throw new Error(`Remote source '${url}' exceeds the 1 MB limit.`);
  if (remoteSourceCache.size >= 50) remoteSourceCache.delete(remoteSourceCache.keys().next().value ?? '');
  remoteSourceCache.set(url, { contents, expiresAt: Date.now() + REMOTE_CACHE_MS });
  return contents;
};

export const clearSpecificationSourceCache = () => remoteSourceCache.clear();
