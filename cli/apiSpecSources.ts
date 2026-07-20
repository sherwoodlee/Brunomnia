import { readFile, realpath, stat } from 'node:fs/promises';
import { isIPv4, isIPv6 } from 'node:net';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { lookup } from 'node:dns/promises';
import { fetch as undiciFetch } from 'undici';
import { parse } from 'yaml';
import type { ApiDesignSourceFile } from '../src/types';
import { API_DESIGN_SOURCE_LIMITS, normalizeApiDesignSourceFiles, safeSpecificationRemoteUrl } from '../src/lib/apiDesignSources';

type SourceKind = 'specification' | 'ruleset';
type LookupHost = (hostname: string, options: { all: true }) => Promise<Array<{ address: string }>>;
type FetchRemote = (url: string, init: RequestInit) => Promise<Response>;

const withinRoot = (root: string, candidate: string) => {
  const child = relative(root, candidate);
  return child === '' || (child !== '..' && !child.startsWith(`..${sep}`) && !isAbsolute(child));
};

export const isPrivateOrLoopbackHost = (hostname: string) => {
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) return true;
  const host = hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;
  const isPrivateIpv4 = ([first, second, third, fourth]: number[]) => [first, second, third, fourth].every((part) => Number.isInteger(part) && part >= 0 && part <= 255)
    && (first === 0 || first === 127 || first === 10 || (first === 172 && second >= 16 && second <= 31)
      || (first === 192 && second === 168) || (first === 169 && second === 254));
  if (isIPv4(host)) {
    return isPrivateIpv4(host.split('.').map(Number));
  }
  if (isIPv6(host)) {
    const dottedTail = host.slice(host.lastIndexOf(':') + 1);
    const normalizedHost = isIPv4(dottedTail)
      ? `${host.slice(0, host.lastIndexOf(':') + 1)}${dottedTail.split('.').map(Number).reduce((groups, part, index) => {
        if (index % 2 === 0) groups.push(part << 8);
        else groups[groups.length - 1] += part;
        return groups;
      }, [] as number[]).map((group) => group.toString(16)).join(':')}`
      : host;
    const halves = normalizedHost.split('::');
    const left = halves[0] ? halves[0].split(':') : [];
    const right = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
    const groups = [...left, ...Array.from<string>({ length: 8 - left.length - right.length }).fill('0'), ...right];
    const values = groups.map((group) => Number.parseInt(group || '0', 16));
    const first = values[0];
    const unspecified = values.every((group) => group === 0);
    const loopback = values.slice(0, 7).every((group) => group === 0) && values[7] === 1;
    const mappedIpv4 = values.slice(0, 5).every((group) => group === 0) && (values[5] === 0 || values[5] === 0xffff)
      ? [values[6] >> 8, values[6] & 0xff, values[7] >> 8, values[7] & 0xff]
      : [];
    return unspecified || loopback || (first & 0xfe00) === 0xfc00 || (first & 0xffc0) === 0xfe80
      || (mappedIpv4.length > 0 && isPrivateIpv4(mappedIpv4));
  }
  return false;
};

const boundedResponseText = async (response: Response, url: string) => {
  const declared = Number(response.headers.get('content-length') ?? 0);
  if (declared > API_DESIGN_SOURCE_LIMITS.fileBytes) throw new Error(`Remote source '${url}' exceeds the 1 MB limit.`);
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const result = await reader.read();
    if (result.done) break;
    size += result.value.byteLength;
    if (size > API_DESIGN_SOURCE_LIMITS.fileBytes) {
      await reader.cancel();
      throw new Error(`Remote source '${url}' exceeds the 1 MB limit.`);
    }
    chunks.push(result.value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  chunks.forEach((chunk) => { bytes.set(chunk, offset); offset += chunk.byteLength; });
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
};

export const fetchPublicSpecificationSourceNode = async (
  rawUrl: string,
  dependencies: { lookupHost?: LookupHost; fetchRemote?: FetchRemote } = {},
) => {
  const url = safeSpecificationRemoteUrl(rawUrl);
  const lookupHost = dependencies.lookupHost ?? lookup as unknown as LookupHost;
  const records = await lookupHost(url.hostname.toLowerCase(), { all: true });
  if (records.some(({ address }) => isPrivateOrLoopbackHost(address.toLowerCase()))) {
    throw new Error(`Remote source '${url.href}' resolves to a private or loopback address.`);
  }
  const fetchRemote = dependencies.fetchRemote ?? undiciFetch as unknown as FetchRemote;
  const response = await fetchRemote(url.href, { redirect: 'error', signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`Failed to fetch '${url.href}': ${response.status} ${response.statusText}`);
  return boundedResponseText(response, url.href);
};

const specificationReferences = (value: unknown) => {
  const references: string[] = [];
  const seen = new WeakSet<object>();
  let nodes = 0;
  const visit = (current: unknown, depth: number) => {
    if (++nodes > 100_000 || depth > 100 || !current || typeof current !== 'object' || seen.has(current)) return;
    seen.add(current);
    if (Array.isArray(current)) current.forEach((child) => visit(child, depth + 1));
    else Object.entries(current as Record<string, unknown>).forEach(([name, child]) => {
      if (name === '$ref' && typeof child === 'string') references.push(child);
      visit(child, depth + 1);
    });
  };
  visit(value, 0);
  return references;
};

const sourceReferences = (contents: string, kind: SourceKind) => {
  let parsed: unknown;
  try { parsed = parse(contents); } catch { return []; }
  if (kind === 'specification') return specificationReferences(parsed);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return [];
  const extended = (parsed as Record<string, unknown>).extends;
  return (Array.isArray(extended) ? extended : extended === undefined ? [] : [extended])
    .filter((entry): entry is string => typeof entry === 'string');
};

const localReferencePath = (reference: string) => {
  let path = '';
  try { path = decodeURIComponent(reference.split('#', 1)[0]).trim(); } catch { return ''; }
  if (!path || path.startsWith('/') || /^[a-z][a-z\d+.-]*:/i.test(path)) return '';
  return path;
};

const readBoundedUtf8 = async (path: string) => {
  const metadata = await stat(path);
  if (!metadata.isFile()) throw new Error(`API design source '${path}' is not a regular file.`);
  if (metadata.size > API_DESIGN_SOURCE_LIMITS.fileBytes) throw new Error(`API design source '${path}' exceeds the 1 MB limit.`);
  const bytes = await readFile(path);
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
};

export const collectCliApiDesignSources = async (entryPath: string, kind: SourceKind) => {
  const entry = await realpath(resolve(entryPath));
  const root = await realpath(dirname(entry));
  const visited = new Set<string>();
  const files: ApiDesignSourceFile[] = [];
  let entryContents = '';
  const visit = async (path: string, depth: number): Promise<void> => {
    if (depth > 100 || visited.has(path)) return;
    if (!withinRoot(root, path)) throw new Error(`API design source '${path}' escapes '${root}'.`);
    const canonical = await realpath(path).catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return '';
      throw error;
    });
    if (!canonical) return;
    if (!withinRoot(root, canonical)) throw new Error(`API design source '${path}' escapes '${root}' through a symlink.`);
    if (visited.has(canonical)) return;
    visited.add(canonical);
    const contents = await readBoundedUtf8(canonical);
    if (canonical === entry) entryContents = contents;
    const sourcePath = relative(root, canonical).split(sep).join('/');
    files.push({ path: sourcePath, contents });
    if (files.length > API_DESIGN_SOURCE_LIMITS.files) throw new Error(`API designs accept at most ${API_DESIGN_SOURCE_LIMITS.files} source files.`);
    for (const reference of sourceReferences(contents, kind)) {
      const localPath = localReferencePath(reference);
      if (!localPath) continue;
      await visit(resolve(dirname(canonical), localPath), depth + 1);
    }
  };
  await visit(entry, 0);
  const alias = kind === 'specification' ? 'openapi.yaml' : '.spectral.yaml';
  if (!files.some((file) => file.path === alias)) files.push({ path: alias, contents: entryContents });
  return { contents: entryContents, files: normalizeApiDesignSourceFiles(files) };
};
