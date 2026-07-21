import type { ApiRequest, CookieRecord, StoredResponse } from '../types';
import { cookiesForUrl } from './cookies';
import { renderFakerValue } from './faker';

export type TemplateContext = {
  variables: Record<string, string>;
  cookies: CookieRecord[];
  responses: StoredResponse[];
  environmentId?: string;
  request: ApiRequest;
  requestAncestors?: string[];
  renderPurpose?: 'send' | 'preview';
  now?: Date;
  uuid?: () => string;
  prompt?: (input: TemplatePromptInput) => Promise<string | null>;
  osInfo?: () => Promise<Record<string, unknown>>;
  resolveResponse?: (input: { requestId: string; resendBehavior: string; maxAgeSeconds: number; requestChain: string[]; cookies: CookieRecord[]; responses: StoredResponse[] }) => Promise<StoredResponse | undefined>;
  requestChain?: string[];
  requestValueDepth?: number;
  readFile?: (path: string) => Promise<string>;
  customTag?: (name: string, args: string[]) => Promise<string | undefined>;
  externalSecret?: (input: { provider: 'aws' | 'gcp' | 'azure' | 'hashicorp'; reference: string; scope?: string; field?: string; version?: string; credentialId?: string; appName?: string }) => Promise<string>;
};

export type TemplatePromptInput = {
  title: string;
  label: string;
  defaultValue: string;
  maskText: boolean;
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
const promptValues = new Map<string, string>();
const pendingPrompts = new Map<string, Promise<string>>();
const requestPromptKeys = new Map<string, Set<string>>();

export const clearTemplatePromptValues = () => {
  promptValues.clear();
  pendingPrompts.clear();
  requestPromptKeys.clear();
};

export const clearTemplatePromptValuesForRequest = (requestId: string) => {
  const keys = requestPromptKeys.get(requestId);
  keys?.forEach((key) => promptValues.delete(key));
  requestPromptKeys.delete(requestId);
};

const booleanArgument = (value: string | undefined, fallback: boolean) => value === undefined || value === ''
  ? fallback
  : value.toLowerCase() === 'true';

const digest = async (algorithm: string, value: string, encoding: string) => {
  if (!['hex', 'base64'].includes(encoding.toLowerCase())) throw new Error(`Invalid encoding ${encoding}. Choices are hex, base64`);
  let output: Uint8Array;
  if (algorithm.toLowerCase() === 'md5') {
    const { md5 } = await import('js-md5');
    const hex = md5(value);
    output = Uint8Array.from(hex.match(/.{2}/g) ?? [], (byte) => Number.parseInt(byte, 16));
  } else {
    const names: Record<string, AlgorithmIdentifier> = { sha1: 'SHA-1', sha256: 'SHA-256', sha512: 'SHA-512' };
    output = new Uint8Array(await crypto.subtle.digest(names[algorithm.toLowerCase()] ?? 'SHA-256', utf8(value)));
  }
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

const responseJsonPath = async (body: string, path: string) => {
  let value: unknown;
  try {
    const { default: JSONBig } = await import('json-bigint');
    value = JSONBig({ storeAsString: true }).parse(body) as unknown;
  } catch (error) {
    throw new Error(`Invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  let results: unknown[];
  try {
    const { JSONPath } = await import('jsonpath-plus');
    results = JSONPath({ json: value as object, path, eval: 'safe', wrap: true }) as unknown[];
  } catch {
    throw new Error(`Invalid JSONPath query: ${path}`);
  }
  if (!results.length) throw new Error(`Returned no results: ${path}`);
  if (results.length > 1) return JSON.stringify(results);
  return typeof results[0] === 'string' ? results[0] : JSON.stringify(results[0]);
};

const responseXPath = async (body: string, path: string) => {
  try {
    const [{ DOMParser }, xpath] = await Promise.all([import('@xmldom/xmldom'), import('xpath')]);
    const document = new DOMParser().parseFromString(body, 'text/xml');
    const selected = xpath.select(path, document as unknown as Node);
    if (typeof selected === 'string' || typeof selected === 'number' || typeof selected === 'boolean') return String(selected);
    const results = (selected as unknown[]).flatMap((value) => {
      const node = value as { nodeType?: number; nodeValue?: string | null; childNodes?: { toString(): string }; toString(): string };
      if (node.nodeType === 2) return [node.nodeValue ?? ''];
      if (node.nodeType === 1) return [node.childNodes?.toString() ?? ''];
      if (node.nodeType === 3) return [node.toString().trim()];
      return [];
    });
    if (!results.length) throw new Error(`Returned no results: ${path}`);
    if (results.length > 1) throw new Error(`Returned more than one result: ${path}`);
    return results[0];
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Returned ')) throw error;
    throw new Error(`Invalid XPath query: ${path}`);
  }
};

const latestResponse = (responses: StoredResponse[], requestId: string, environmentId?: string) => responses
  .filter((candidate) => (candidate.requestId === requestId || candidate.requestName === requestId) && (!environmentId || candidate.environmentId === environmentId))
  .sort((left, right) => Date.parse(right.receivedAt) - Date.parse(left.receivedAt))[0];

const responseValue = async (context: TemplateContext, attribute: string, requestId: string, filter: string, resendBehavior: string, maxAgeSource: string) => {
  const behavior = (resendBehavior || 'never').toLowerCase();
  if (!['never', 'no-history', 'when-expired', 'always'].includes(behavior)) throw new Error(`Invalid response trigger behavior ${resendBehavior}`);
  if (!['body', 'header', 'raw', 'url'].includes(attribute)) throw new Error(`Invalid response field ${attribute}`);
  if (!requestId) throw new Error('No request specified');
  const maxAgeSeconds = Number(maxAgeSource || 60);
  let response: StoredResponse | undefined = latestResponse(context.responses, requestId, context.environmentId);
  const expired = response && Number.isFinite(maxAgeSeconds) && (Date.now() - Date.parse(response.receivedAt)) / 1_000 > maxAgeSeconds;
  const shouldResend = behavior === 'always' || (behavior === 'no-history' && !response) || (behavior === 'when-expired' && (!response || expired));
  const requestChain = context.requestChain ?? [];
  if (shouldResend && context.renderPurpose !== 'preview' && !requestChain.includes(requestId)) {
    if (!context.resolveResponse) throw new Error(`Response trigger '${behavior}' requires dependent-request execution.`);
    response = await context.resolveResponse({ requestId, resendBehavior: behavior, maxAgeSeconds, requestChain: [...requestChain, requestId], cookies: context.cookies, responses: context.responses });
  }
  if (!response) throw new Error(`No stored response exists for '${requestId}'. Send that request before resolving this template.`);
  if (!response.status) throw new Error(`No successful responses for request '${requestId}'.`);
  if (attribute === 'raw') return response.body;
  if (attribute === 'url') return response.requestUrl;
  if (!filter) throw new Error(`No ${attribute} filter specified`);
  if (attribute === 'header') {
    const header = Object.entries(response.headers).find(([name]) => name.toLowerCase() === filter.trim().toLowerCase());
    if (!header) throw new Error(`No header with name "${filter.trim()}".`);
    return header[1];
  }
  const path = filter.trim();
  return path.startsWith('$') ? responseJsonPath(response.body, path) : responseXPath(response.body, path);
};

const templateOsInfo = async (context: TemplateContext) => {
  if (context.osInfo) return context.osInfo();
  return import('@tauri-apps/api/core').then(({ invoke, isTauri }) => isTauri()
    ? invoke<Record<string, unknown>>('template_os_info')
    : Promise.resolve({
      arch: 'unknown', cpus: [], freemem: 0, hostname: globalThis.location?.hostname ?? '',
      platform: globalThis.navigator?.platform ?? 'unknown', release: '',
      userInfo: { uid: 0, gid: 0, username: '', homedir: '', shell: '' },
    }));
};

const promptValue = async (context: TemplateContext, args: string[]) => {
  const [title, label = '', initialDefault = '', explicitStorageKey = ''] = args;
  if (!title) throw new Error('Title attribute is required for prompt tag');
  const maskText = booleanArgument(args[4], false);
  const saveLastValue = booleanArgument(args[5], true);
  const storageKey = explicitStorageKey || `${context.request.id}.${title}`;
  if (!explicitStorageKey) {
    const keys = requestPromptKeys.get(context.request.id) ?? new Set<string>();
    keys.add(storageKey);
    requestPromptKeys.set(context.request.id, keys);
  }
  const cachedValue = promptValues.get(storageKey);
  if (explicitStorageKey && cachedValue) return cachedValue;
  const defaultValue = cachedValue && saveLastValue ? cachedValue : initialDefault;
  if (context.renderPurpose === 'preview') return cachedValue ?? defaultValue ?? '';
  const pending = pendingPrompts.get(storageKey);
  if (pending) return pending;
  const prompt = context.prompt ?? (typeof globalThis.prompt === 'function'
    ? async (input: TemplatePromptInput) => globalThis.prompt(`${input.title}${input.label ? `\n${input.label}` : ''}`, input.defaultValue)
    : undefined);
  if (!prompt) throw new Error('Prompt template tags require an interactive app window.');
  const request = prompt({ title, label, defaultValue, maskText }).then((value) => value ?? '');
  pendingPrompts.set(storageKey, request);
  try {
    const value = await request;
    promptValues.set(storageKey, value);
    return value;
  } finally {
    pendingPrompts.delete(storageKey);
  }
};

const requestValue = async (context: TemplateContext, attribute: string, name: string, folderIndexSource: string) => {
  if ((context.requestValueDepth ?? 0) >= 20) throw new Error('Current-request template recursion exceeded 20 nested renders.');
  const request = context.request;
  if (attribute === 'name') return request.name;
  if (attribute === 'folder') {
    const folderIndex = Number(folderIndexSource || 0);
    const value = context.requestAncestors?.[folderIndex];
    if (value === undefined) throw new Error(`Could not get folder by index ${folderIndex}. Must be between 0-${Math.max(0, (context.requestAncestors?.length ?? 0) - 1)}`);
    return value;
  }
  const render = (value: string) => renderTemplate(value, { ...context, requestValueDepth: (context.requestValueDepth ?? 0) + 1 });
  if (attribute === 'url') {
    const url = new URL(await render(request.url), 'http://localhost');
    for (const parameter of request.params) {
      const parameterName = await render(parameter.name);
      const value = await render(parameter.value);
      if (parameterName && value) url.searchParams.append(parameterName, value);
    }
    return url.toString();
  }
  if (attribute === 'parameter' || attribute === 'header') {
    if (!name) throw new Error(attribute === 'parameter' ? 'No query parameter specified' : 'No header specified');
    const rows = attribute === 'parameter' ? request.params : request.headers;
    for (const row of rows) {
      const rowName = await render(row.name);
      if (rowName.toLowerCase() === name.toLowerCase()) return render(row.value);
    }
    throw new Error(`No ${attribute === 'parameter' ? 'query parameter' : 'header'} with name "${name}".`);
  }
  if (attribute === 'cookie') {
    if (!name) throw new Error('No cookie specified');
    const requestUrl = await render(request.url);
    const cookie = cookiesForUrl(context.cookies, requestUrl, context.now ?? new Date()).find((candidate) => candidate.name === name);
    if (!cookie) throw new Error(`No cookie with name "${name}" found in cookie jar for url "${requestUrl}"`);
    return cookie.value;
  }
  if (attribute === 'oauth2' || attribute === 'oauth2-identity' || attribute === 'oauth2-refresh') {
    const value = attribute === 'oauth2' ? request.auth.accessToken : attribute === 'oauth2-identity' ? request.auth.identityToken : request.auth.refreshToken;
    if (!value) throw new Error('No OAuth 2.0 access tokens found for request');
    return value;
  }
  return '';
};

const resolveRawTag = async (name: string, args: string[], context: TemplateContext) => {
  const now = context.now ?? new Date();
  const uuid = context.uuid ?? (() => crypto.randomUUID());
  if (name === 'uuid') return uuid();
  if (name === 'timestamp' || name === 'now') {
    const format = (args[0] || (name === 'timestamp' ? 'unix' : 'iso-8601')).toLowerCase();
    if (format === 'milliseconds' || format === 'millis' || format === 'ms') return String(now.getTime());
    if (format === 'unix' || format === 'seconds' || format === 's') return String(Math.round(now.getTime() / 1000));
    if (format === 'iso-8601' || format === 'iso') return now.toISOString();
    if (format === 'custom') {
      const { format: formatDate } = await import('date-fns/format');
      return formatDate(now, args[1] ?? '');
    }
    throw new Error(`Invalid date type "${format}"`);
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
  if (name === 'response') return responseValue(context, args[0] ?? 'body', args[1] ?? '', args[2] ?? '', args[3] ?? 'never', args[4] ?? '60');
  if (name === 'request') return requestValue(context, args[0] ?? 'url', args[1] ?? '', args[2] ?? '0');
  if (name === 'faker') return renderFakerValue(args[0] ?? 'guid');
  if (name === 'file') {
    if (!args[0]) throw new Error('No file selected.');
    if (!context.readFile) throw new Error('File template tags require desktop file access and an allowed data folder.');
    return context.readFile(args[0]);
  }
  if (name === 'prompt') return promptValue(context, args);
  if (name === 'os') {
    const os = await templateOsInfo(context);
    const value = os[args[0] || 'arch'];
    return typeof value === 'string' ? value : JSON.stringify(value);
  }
  if (name === 'external') {
    const provider = (args[0] ?? '').toLowerCase();
    if (!['aws', 'gcp', 'azure', 'hashicorp'].includes(provider)) throw new Error("External vault provider must be 'aws', 'gcp', 'azure', or 'hashicorp'.");
    if (!args[1]) throw new Error('External vault tags need a secret reference.');
    if (!context.externalSecret) throw new Error('External vault tags require the Tauri desktop credential adapter.');
    return context.externalSecret({ provider: provider as 'aws' | 'gcp' | 'azure' | 'hashicorp', reference: args[1], scope: args[2], field: args[3], version: args[4], credentialId: args[5], appName: args[6] });
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
