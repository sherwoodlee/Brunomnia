import { invoke, isTauri } from '@tauri-apps/api/core';

const MAX_RESPONSE_LINK_LENGTH = 8_192;
const MAX_LINKS_PER_LINE = 100;
const RESPONSE_LINK_PATTERN = /https?:\/\/[^\s<>"']+/gi;

export type ResponseLineSegment = { kind: 'text'; value: string } | { kind: 'link'; value: string; url: string };

const decodeXmlUrl = (value: string) => value
  .replaceAll('&amp;', '&')
  .replaceAll('&quot;', '"')
  .replaceAll('&lt;', '<')
  .replaceAll('&gt;', '>');

const withoutTrailingPunctuation = (value: string) => {
  let output = value.replace(/[.,!?]+$/g, '');
  const pairs = [['(', ')'], ['[', ']'], ['{', '}']] as const;
  for (const [opening, closing] of pairs) {
    let balance = 0;
    for (const character of output) {
      if (character === opening) balance += 1;
      else if (character === closing) balance -= 1;
    }
    while (output.endsWith(closing) && balance < 0) {
      output = output.slice(0, -1);
      balance += 1;
    }
  }
  return output;
};

export const normalizedResponseLink = (value: string, xml = false) => {
  const candidate = (xml ? decodeXmlUrl(value) : value).trim();
  if (!candidate || candidate.length > MAX_RESPONSE_LINK_LENGTH) return '';
  try {
    const url = new URL(candidate);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : '';
  } catch {
    return '';
  }
};

export const responseLineSegments = (line: string, xml = false): ResponseLineSegment[] => {
  const segments: ResponseLineSegment[] = [];
  let cursor = 0;
  let links = 0;
  RESPONSE_LINK_PATTERN.lastIndex = 0;
  for (let match = RESPONSE_LINK_PATTERN.exec(line); match && links < MAX_LINKS_PER_LINE; match = RESPONSE_LINK_PATTERN.exec(line)) {
    if (match[0].length > MAX_RESPONSE_LINK_LENGTH) continue;
    const value = withoutTrailingPunctuation(match[0]);
    const url = normalizedResponseLink(value, xml);
    if (!url || !value) continue;
    if (match.index > cursor) segments.push({ kind: 'text', value: line.slice(cursor, match.index) });
    segments.push({ kind: 'link', value, url });
    cursor = match.index + value.length;
    links += 1;
  }
  if (!segments.length) return [{ kind: 'text', value: line }];
  if (cursor < line.length) segments.push({ kind: 'text', value: line.slice(cursor) });
  return segments;
};

export const openResponseLink = async (value: string) => {
  const url = normalizedResponseLink(value);
  if (!url) throw new Error('Only valid HTTP and HTTPS response links can be opened.');
  if (isTauri()) {
    await invoke('open_external_url', { url });
    return;
  }
  const opened = window.open(url, '_blank', 'noopener,noreferrer');
  if (opened) opened.opener = null;
};
