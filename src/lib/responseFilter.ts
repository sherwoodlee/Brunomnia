import type { HttpResponse } from '../types';

export type ResponseFilterLanguage = 'json' | 'xml' | '';
export type ResponseFilterResult = { contents: string; error: string; matchCount: number | null };

type PathToken = {
  kind: 'property' | 'index' | 'wildcard';
  key?: string;
  index?: number;
  recursive: boolean;
};

const decodeProperty = (value: string) => {
  const trimmed = value.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) return JSON.parse(trimmed) as string;
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) return trimmed.slice(1, -1).replace(/\\'/g, "'").replace(/\\\\/g, '\\');
  throw new Error(`Unsupported bracket selector [${value}]`);
};

const parseJsonPath = (source: string): PathToken[] => {
  const path = source.trim();
  if (!path.startsWith('$')) throw new Error('JSONPath must start with $.');
  const tokens: PathToken[] = [];
  let index = 1;
  while (index < path.length) {
    let recursive = false;
    if (path.startsWith('..', index)) { recursive = true; index += 2; }
    else if (path[index] === '.') index += 1;
    else if (path[index] !== '[') throw new Error(`Unexpected JSONPath token at position ${index + 1}.`);

    if (path[index] === '[') {
      const end = path.indexOf(']', index + 1);
      if (end < 0) throw new Error('JSONPath bracket selector is not closed.');
      const selector = path.slice(index + 1, end).trim();
      if (selector === '*') tokens.push({ kind: 'wildcard', recursive });
      else if (/^\d+$/.test(selector)) tokens.push({ kind: 'index', index: Number(selector), recursive });
      else tokens.push({ kind: 'property', key: decodeProperty(selector), recursive });
      index = end + 1;
      continue;
    }

    if (path[index] === '*') {
      tokens.push({ kind: 'wildcard', recursive });
      index += 1;
      continue;
    }
    const start = index;
    while (index < path.length && path[index] !== '.' && path[index] !== '[') index += 1;
    const key = path.slice(start, index);
    if (!key) throw new Error(`Missing JSONPath property at position ${start + 1}.`);
    tokens.push({ kind: 'property', key, recursive });
  }
  return tokens;
};

const children = (value: unknown): unknown[] => Array.isArray(value)
  ? value
  : value !== null && typeof value === 'object' ? Object.values(value as Record<string, unknown>) : [];

const directMatches = (value: unknown, token: PathToken): unknown[] => {
  if (token.kind === 'wildcard') return children(value);
  if (token.kind === 'index') return Array.isArray(value) && token.index! < value.length ? [value[token.index!]] : [];
  if (value !== null && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, token.key!)) {
    return [(value as Record<string, unknown>)[token.key!]];
  }
  return [];
};

const recursiveMatches = (value: unknown, token: PathToken, output: unknown[]) => {
  output.push(...directMatches(value, token));
  children(value).forEach((child) => recursiveMatches(child, token, output));
};

export const queryJsonPath = (body: string, path: string): unknown[] => {
  const tokens = parseJsonPath(path);
  let values: unknown[] = [JSON.parse(body)];
  tokens.forEach((token) => {
    const next: unknown[] = [];
    values.forEach((value) => token.recursive ? recursiveMatches(value, token, next) : next.push(...directMatches(value, token)));
    values = next;
  });
  return values;
};

const escapeXml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const queryXml = (body: string, path: string) => {
  if (typeof DOMParser === 'undefined' || typeof XMLSerializer === 'undefined') throw new Error('XPath filtering requires the desktop or browser renderer.');
  const document = new DOMParser().parseFromString(body, 'application/xml');
  const parseError = document.querySelector('parsererror');
  if (parseError) throw new Error(parseError.textContent?.trim() || 'The response is not valid XML.');
  if (typeof document.evaluate !== 'function') throw new Error('XPath evaluation is unavailable in this renderer.');
  const result = document.evaluate(path.trim(), document, null, 7, null);
  const serializer = new XMLSerializer();
  const matches = Array.from({ length: result.snapshotLength }, (_, index) => result.snapshotItem(index)).filter((node): node is Node => Boolean(node));
  const serialized = matches.map((node) => node.nodeType === Node.ATTRIBUTE_NODE
    ? `${node.nodeName}="${escapeXml(node.nodeValue ?? '')}"`
    : node.nodeType === Node.TEXT_NODE ? escapeXml(node.nodeValue ?? '') : serializer.serializeToString(node));
  return { matches: serialized, contents: `<result>${serialized.length ? `\n${serialized.join('\n')}\n` : ''}</result>` };
};

const responseContentType = (response: HttpResponse) => Object.entries(response.headers)
  .find(([name]) => name.toLowerCase() === 'content-type')?.[1].toLowerCase() ?? '';

export const responseFilterLanguage = (response: HttpResponse): ResponseFilterLanguage => {
  const contentType = responseContentType(response);
  if (contentType.includes('json')) return 'json';
  if (contentType.includes('xml')) return 'xml';
  try { JSON.parse(response.body); return 'json'; } catch { /* inspect markup next */ }
  return /^\s*<[^>]+>/.test(response.body) ? 'xml' : '';
};

export const applyResponseBodyFilter = (response: HttpResponse, filter: string): ResponseFilterResult => {
  const query = filter.trim();
  if (!query) return { contents: response.body, error: '', matchCount: null };
  const language = responseFilterLanguage(response);
  try {
    if (language === 'json') {
      const matches = queryJsonPath(response.body, query);
      return { contents: JSON.stringify(matches, null, 2), error: '', matchCount: matches.length };
    }
    if (language === 'xml') {
      const result = queryXml(response.body, query);
      return { contents: result.contents, error: '', matchCount: result.matches.length };
    }
    return { contents: response.body, error: 'Response filters require a JSON or XML body.', matchCount: null };
  } catch (caught) {
    return {
      contents: language === 'xml' ? `<error>${escapeXml(caught instanceof Error ? caught.message : String(caught))}</error>` : '[]',
      error: caught instanceof Error ? caught.message : String(caught),
      matchCount: null,
    };
  }
};

export const rememberResponseFilter = (history: string[], filter: string) => {
  const value = filter.trim().slice(0, 2_000);
  if (!value) return history.slice(0, 10);
  return [value, ...history.filter((candidate) => candidate !== value)].slice(0, 10);
};
