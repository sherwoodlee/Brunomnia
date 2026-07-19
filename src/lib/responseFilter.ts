import type { HttpResponse } from '../types';
import { JSONPath } from 'jsonpath-plus';

export type ResponseFilterLanguage = 'json' | 'xml' | '';
export type ResponseFilterResult = { contents: string; error: string; matchCount: number | null };

export const queryJsonPath = (body: string, path: string): unknown[] => JSONPath({
  eval: 'safe',
  json: JSON.parse(body) as object,
  path: path.trim(),
  wrap: true,
}) as unknown[];

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
