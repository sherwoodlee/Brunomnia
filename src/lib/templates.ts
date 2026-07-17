import type { ApiRequest, CookieRecord, StoredResponse } from '../types';
import { cookieValueForUrl } from './cookies';

export type TemplateContext = {
  variables: Record<string, string>;
  cookies: CookieRecord[];
  responses: StoredResponse[];
  request: ApiRequest;
  now?: Date;
  uuid?: () => string;
  prompt?: (message: string, defaultValue?: string) => string | null;
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

const digest = async (algorithm: string, value: string, encoding: string) => {
  const names: Record<string, AlgorithmIdentifier> = { sha1: 'SHA-1', sha256: 'SHA-256', sha384: 'SHA-384', sha512: 'SHA-512' };
  const name = names[algorithm.toLowerCase()];
  if (!name) throw new Error(`Hash algorithm '${algorithm}' is not supported by the local template engine.`);
  const output = new Uint8Array(await crypto.subtle.digest(name, utf8(value)));
  return encoding.toLowerCase() === 'base64' ? bytesToBase64(output) : bytesToHex(output);
};

const jsonPath = (body: string, path: string) => {
  if (!path || path === '$') return body;
  let value: unknown = JSON.parse(body);
  const normalized = path.replace(/^\$\.?/, '').replace(/\[(\d+)\]/g, '.$1').replace(/^\./, '');
  for (const key of normalized.split('.').filter(Boolean)) {
    if (value === null || typeof value !== 'object') return '';
    value = (value as Record<string, unknown>)[key];
  }
  return typeof value === 'string' ? value : value === undefined ? '' : JSON.stringify(value);
};

const responseValue = (context: TemplateContext, attribute: string, requestId: string, filter: string) => {
  const response = context.responses.find((candidate) => candidate.requestId === requestId || candidate.requestName === requestId);
  if (!response) throw new Error(`No stored response exists for '${requestId}'. Send that request before resolving this template.`);
  if (attribute === 'body') return filter ? jsonPath(response.body, filter) : response.body;
  if (attribute === 'status' || attribute === 'statusCode') return String(response.status);
  if (attribute === 'url') return response.requestUrl;
  if (attribute === 'header') return response.headers[filter.toLowerCase()] ?? Object.entries(response.headers).find(([name]) => name.toLowerCase() === filter.toLowerCase())?.[1] ?? '';
  return '';
};

const faker = (name: string, uuid: () => string, now: Date) => {
  const firstNames = ['Avery', 'Jordan', 'Morgan', 'Riley', 'Taylor'];
  const lastNames = ['Chen', 'Garcia', 'Johnson', 'Patel', 'Williams'];
  const pick = <T,>(values: T[]) => values[Math.floor(Math.random() * values.length)];
  if (name === 'guid' || name === 'randomUUID') return uuid();
  if (name === 'randomInt') return String(Math.floor(Math.random() * 1000));
  if (name === 'randomBoolean') return String(Math.random() >= 0.5);
  if (name === 'randomFirstName') return pick(firstNames);
  if (name === 'randomLastName') return pick(lastNames);
  if (name === 'randomFullName') return `${pick(firstNames)} ${pick(lastNames)}`;
  if (name === 'randomEmail') return `${pick(firstNames).toLowerCase()}.${pick(lastNames).toLowerCase()}@example.com`;
  if (name === 'randomDateFuture') return new Date(now.getTime() + 86_400_000 * (1 + Math.floor(Math.random() * 365))).toISOString();
  if (name === 'randomDatePast') return new Date(now.getTime() - 86_400_000 * (1 + Math.floor(Math.random() * 365))).toISOString();
  if (name === 'randomStreetAddress') return `${1 + Math.floor(Math.random() * 9999)} Market Street`;
  throw new Error(`Faker variable '${name}' is not supported.`);
};

const resolveRawTag = async (name: string, args: string[], context: TemplateContext) => {
  const now = context.now ?? new Date();
  const uuid = context.uuid ?? (() => crypto.randomUUID());
  if (name === 'uuid') return uuid();
  if (name === 'timestamp') {
    const format = args[0]?.toLowerCase();
    if (format === 'milliseconds' || format === 'ms') return String(now.getTime());
    if (format === 'iso-8601' || format === 'iso') return now.toISOString();
    return String(Math.floor(now.getTime() / 1000));
  }
  if (name === 'base64') {
    const [operation = 'encode', value = ''] = args;
    return operation === 'decode' ? new TextDecoder().decode(Uint8Array.from(atob(value), (character) => character.charCodeAt(0))) : bytesToBase64(utf8(value));
  }
  if (name === 'hash') return digest(args[0] || 'sha256', args[2] ?? '', args[1] || 'hex');
  if (name === 'jsonpath') return jsonPath(args[0] ?? '', args[1] ?? '$');
  if (name === 'cookie') {
    const requestUrl = context.request.url.replace(environmentPattern, (match, variable: string) => context.variables[variable.trim()] ?? match);
    return cookieValueForUrl(context.cookies, requestUrl, args[0] ?? '', now);
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
  if (name === 'faker') return faker(args[0] ?? 'guid', uuid, now);
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

export const renderTemplate = async (source: string, context: TemplateContext): Promise<string> => {
  let output = source.replace(environmentPattern, (match, name: string) => {
    const trimmed = name.trim();
    if (trimmed.startsWith('faker.')) return faker(trimmed.slice(6), context.uuid ?? (() => crypto.randomUUID()), context.now ?? new Date());
    if (trimmed === '$randomUUID' || trimmed === '$guid') return (context.uuid ?? (() => crypto.randomUUID()))();
    if (trimmed === '$timestamp') return String(Math.floor((context.now ?? new Date()).getTime() / 1000));
    if (trimmed === '$isoTimestamp') return (context.now ?? new Date()).toISOString();
    if (trimmed.startsWith('$random')) return faker(trimmed.slice(1), context.uuid ?? (() => crypto.randomUUID()), context.now ?? new Date());
    return context.variables[trimmed] ?? match;
  });
  rawTagPattern.lastIndex = 0;
  let match = rawTagPattern.exec(output);
  while (match) {
    const replacement = await resolveRawTag(match[1], tagArguments(match[2]), context);
    output = `${output.slice(0, match.index)}${replacement}${output.slice(match.index + match[0].length)}`;
    rawTagPattern.lastIndex = match.index + replacement.length;
    match = rawTagPattern.exec(output);
  }
  return output;
};
