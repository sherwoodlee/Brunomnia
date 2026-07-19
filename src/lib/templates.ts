import type { ApiRequest, CookieRecord, StoredResponse } from '../types';
import { cookiesForUrl } from './cookies';
import { renderFakerValue } from './faker';

export type TemplateContext = {
  variables: Record<string, string>;
  cookies: CookieRecord[];
  responses: StoredResponse[];
  request: ApiRequest;
  now?: Date;
  uuid?: () => string;
  prompt?: (message: string, defaultValue?: string) => string | null;
  readFile?: (path: string) => Promise<string>;
  customTag?: (name: string, args: string[]) => Promise<string | undefined>;
  externalSecret?: (input: { provider: 'aws' | 'gcp' | 'azure' | 'hashicorp'; reference: string; scope?: string; field?: string; version?: string }) => Promise<string>;
};

const environmentPattern = /{{\s*([^{}]+?)\s*}}/g;
const rawTagPattern = /{%\s*([a-zA-Z][\w-]*)\s*([\s\S]*?)%}/g;

const tagArguments = (source: string): string[] => {
  const values: string[] = [];
  let value = '';
  let quote = '';
  let escaped = false;
  for (const character of source.trim()) {
    if (escaped) { value += character; escaped = false; continue; }
    if (character === '\\' && quote) { escaped = true; continue; }
    if (quote) {
      if (character === quote) quote = '';
      else value += character;
      continue;
    }
    if (character === '"' || character === "'") { quote = character; continue; }
    if (character === ',') { values.push(value.trim()); value = ''; continue; }
    value += character;
  }
  if (value.trim() || source.includes(',')) values.push(value.trim());
  return values;
};

const bytesToHex = (bytes: Uint8Array) => [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
const bytesToBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const utf8 = (value: string) => new TextEncoder().encode(value);
type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

const digest = async (algorithm: string, value: string, encoding: string) => {
  const names: Record<string, AlgorithmIdentifier> = { sha1: 'SHA-1', sha256: 'SHA-256', sha384: 'SHA-384', sha512: 'SHA-512' };
  const name = names[algorithm.toLowerCase()];
  if (!name) throw new Error(`Hash algorithm '${algorithm}' is not supported by the local template engine.`);
  const output = new Uint8Array(await crypto.subtle.digest(name, utf8(value)));
  return encoding.toLowerCase() === 'base64' ? bytesToBase64(output) : bytesToHex(output);
};

const jsonPath = async (body: string, path: string) => {
  if (!path || path === '$') return body;
  let value: JsonValue;
  try { value = JSON.parse(body); } catch (error) { throw new Error(`Invalid JSON: ${error instanceof Error ? error.message : String(error)}`); }
  let results: unknown[];
  try {
    const { JSONPath } = await import('jsonpath-plus');
    results = JSONPath({ json: value, path, eval: 'safe', wrap: true }) as unknown[];
  } catch {
    throw new Error(`Invalid JSONPath query: ${path}`);
  }
  if (!results.length) throw new Error(`JSONPath query returned no results: ${path}`);
  const result = results[0];
  return typeof result === 'string' ? result : result === undefined ? '' : JSON.stringify(result);
};

const responseValue = async (context: TemplateContext, attribute: string, requestId: string, filter: string) => {
  const response = context.responses.find((candidate) => candidate.requestId === requestId || candidate.requestName === requestId);
  if (!response) throw new Error(`No stored response exists for '${requestId}'. Send that request before resolving this template.`);
  if (attribute === 'body') return filter ? jsonPath(response.body, filter) : response.body;
  if (attribute === 'status' || attribute === 'statusCode') return String(response.status);
  if (attribute === 'url') return response.requestUrl;
  if (attribute === 'header') return response.headers[filter.toLowerCase()] ?? Object.entries(response.headers).find(([name]) => name.toLowerCase() === filter.toLowerCase())?.[1] ?? '';
  return '';
};

const resolveRawTag = async (name: string, args: string[], context: TemplateContext) => {
  const now = context.now ?? new Date();
  const uuid = context.uuid ?? (() => crypto.randomUUID());
  if (name === 'uuid') return uuid();
  if (name === 'timestamp' || name === 'now') {
    const format = args[0]?.toLowerCase();
    if (format === 'milliseconds' || format === 'millis' || format === 'ms') return String(now.getTime());
    if (format === 'iso-8601' || format === 'iso') return now.toISOString();
    return String(Math.floor(now.getTime() / 1000));
  }
  if (name === 'base64') {
    const operation = args[0] || 'encode';
    const kind = args.length >= 3 ? args[1] || 'normal' : 'normal';
    const value = args.length >= 3 ? args[2] || '' : args[1] || '';
    if (!['encode', 'decode'].includes(operation)) throw new Error(`Invalid Base64 action '${operation}'.`);
    if (!['normal', 'url', 'hex'].includes(kind)) throw new Error(`Invalid Base64 kind '${kind}'.`);
    if (operation === 'encode') {
      const bytes = kind === 'hex'
        ? Uint8Array.from(value.match(/.{1,2}/g) ?? [], (byte) => Number.parseInt(byte, 16))
        : utf8(value);
      const encoded = bytesToBase64(bytes);
      return kind === 'url' ? encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') : encoded;
    }
    const normalized = kind === 'url' ? value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=') : value;
    const bytes = Uint8Array.from(atob(normalized), (character) => character.charCodeAt(0));
    return kind === 'hex' ? bytesToHex(bytes) : new TextDecoder().decode(bytes);
  }
  if (name === 'hash') return digest(args[0] || 'sha256', args[2] ?? '', args[1] || 'hex');
  if (name === 'jsonpath') return jsonPath(args[0] ?? '', args[1] ?? '$');
  if (name === 'cookie') {
    const explicitUrl = args.length > 1;
    const requestUrl = (explicitUrl ? args[0] : context.request.url)
      .replace(environmentPattern, (match, variable: string) => context.variables[variable.trim()] ?? match);
    const cookieName = args[explicitUrl ? 1 : 0] ?? '';
    const matching = cookiesForUrl(context.cookies, requestUrl, now);
    const cookie = matching.find((candidate) => candidate.name === cookieName);
    if (!cookie) throw new Error(`No cookie with name '${cookieName}' exists for '${requestUrl}'.`);
    return cookie.value;
  }
  if (name === 'response') return responseValue(context, args[0] ?? 'body', args[1] ?? '', args[2] ?? '');
  if (name === 'request') {
    const attribute = args[0] ?? 'url';
    if (attribute === 'url') return context.request.url;
    if (attribute === 'name') return context.request.name;
    if (attribute === 'method') return context.request.method;
    if (attribute === 'body') return context.request.body;
    return '';
  }
  if (name === 'faker') return renderFakerValue(args[0] ?? 'guid');
  if (name === 'file') {
    if (!args[0]) throw new Error('No file selected.');
    if (!context.readFile) throw new Error('File template tags require desktop file access and an allowed data folder.');
    return context.readFile(args[0]);
  }
  if (name === 'prompt') {
    const prompt = context.prompt ?? (typeof globalThis.prompt === 'function' ? globalThis.prompt.bind(globalThis) : undefined);
    if (!prompt) throw new Error('Prompt template tags require an interactive app window.');
    return prompt(args[0] || 'Enter a value', args[1] || '') ?? '';
  }
  if (name === 'os') {
    if ((args[0] ?? '').toLowerCase() === 'platform') return typeof navigator === 'undefined' ? 'unknown' : navigator.platform || 'unknown';
    return 'unknown';
  }
  if (name === 'external') {
    const provider = (args[0] ?? '').toLowerCase();
    if (!['aws', 'gcp', 'azure', 'hashicorp'].includes(provider)) throw new Error("External vault provider must be 'aws', 'gcp', 'azure', or 'hashicorp'.");
    if (!args[1]) throw new Error('External vault tags need a secret reference.');
    if (!context.externalSecret) throw new Error('External vault tags require the Tauri desktop credential adapter.');
    return context.externalSecret({ provider: provider as 'aws' | 'gcp' | 'azure' | 'hashicorp', reference: args[1], scope: args[2], field: args[3], version: args[4] });
  }
  const custom = await context.customTag?.(name, args);
  if (custom !== undefined) return custom;
  throw new Error(`Template tag '${name}' is not supported.`);
};

const renderEnvironmentValues = async (source: string, context: TemplateContext) => {
  let output = source;
  const pattern = new RegExp(environmentPattern.source, 'g');
  let match = pattern.exec(output);
  while (match) {
    const trimmed = match[1].trim();
    let replacement = match[0];
    if (trimmed.startsWith('faker.')) {
      const fakerName = trimmed.slice(6);
      replacement = context.uuid && (fakerName === 'guid' || fakerName === 'randomUUID') ? context.uuid() : await renderFakerValue(fakerName);
    } else if (trimmed === '$randomUUID' || trimmed === '$guid') replacement = (context.uuid ?? (() => crypto.randomUUID()))();
    else if (trimmed === '$timestamp') replacement = String(Math.floor((context.now ?? new Date()).getTime() / 1000));
    else if (trimmed === '$isoTimestamp') replacement = (context.now ?? new Date()).toISOString();
    else if (trimmed.startsWith('$random')) {
      const fakerName = trimmed.slice(1);
      replacement = context.uuid && fakerName === 'randomUUID' ? context.uuid() : await renderFakerValue(fakerName);
    } else replacement = context.variables[trimmed] ?? match[0];
    output = `${output.slice(0, match.index)}${replacement}${output.slice(match.index + match[0].length)}`;
    pattern.lastIndex = match.index + replacement.length;
    match = pattern.exec(output);
  }
  return output;
};

export const renderTemplate = async (source: string, context: TemplateContext): Promise<string> => {
  let output = await renderEnvironmentValues(source, context);
  const pattern = new RegExp(rawTagPattern.source, 'g');
  let match = pattern.exec(output);
  while (match) {
    const replacement = String(await resolveRawTag(match[1], tagArguments(match[2]), context));
    output = `${output.slice(0, match.index)}${replacement}${output.slice(match.index + match[0].length)}`;
    pattern.lastIndex = match.index + replacement.length;
    match = pattern.exec(output);
  }
  return output;
};
