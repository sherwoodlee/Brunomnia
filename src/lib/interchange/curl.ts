import type { ApiRequest, Collection, ImportWarning, JsonValue } from '../../types';
import { fileStem, normalizeMethod, requestFrom, sourceId, sourceMetadata } from './common';
import { emptyResources, type ArtifactImport } from './types';

const tokenize = (source: string): string[][] => {
  const commands: string[][] = [];
  let tokens: string[] = [];
  let token = '';
  let quote = '';
  let escaped = false;
  const pushToken = () => { if (token) { tokens.push(token); token = ''; } };
  const pushCommand = () => { pushToken(); if (tokens.length) { commands.push(tokens); tokens = []; } };
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (escaped) {
      if (character !== '\n') token += character;
      escaped = false;
      continue;
    }
    if (character === '\\' && quote !== "'") { escaped = true; continue; }
    if (quote) {
      if (character === quote) quote = '';
      else token += character;
      continue;
    }
    if (character === '"' || character === "'") { quote = character; continue; }
    if (character === ';' || character === '\n') { pushCommand(); continue; }
    if (/\s/.test(character)) { pushToken(); continue; }
    token += character;
  }
  pushCommand();
  return commands.flatMap((command) => {
    const curlIndex = command.findIndex((value) => value === 'curl' || value.endsWith('/curl'));
    return curlIndex >= 0 ? [command.slice(curlIndex + 1)] : [];
  });
};

export const isCurl = (contents: string) => /(^|[;\n]\s*)curl(?:\s|$)/.test(contents.trim()) || /^\s*curl(?:\s|$)/.test(contents);

const optionValue = (tokens: string[], index: number, option: string) => {
  const token = tokens[index];
  if (token === option) return { value: tokens[index + 1] ?? '', consumed: 1 };
  if (option.startsWith('--') && token.startsWith(`${option}=`)) return { value: token.slice(option.length + 1), consumed: 0 };
  if (!option.startsWith('--') && token.startsWith(option) && token !== option) return { value: token.slice(option.length), consumed: 0 };
  return undefined;
};

const parseHeader = (value: string) => {
  const separator = value.indexOf(':');
  return separator >= 0 ? { name: value.slice(0, separator).trim(), value: value.slice(separator + 1).trim() } : { name: value.trim(), value: '' };
};

const encodeUrlData = (entry: string) => {
  const separator = entry.indexOf('=');
  if (separator < 0) return encodeURIComponent(entry);
  return `${entry.slice(0, separator)}=${encodeURIComponent(entry.slice(separator + 1))}`;
};

const parseCurlCommand = (tokens: string[], commandIndex: number, warnings: ImportWarning[]): ApiRequest => {
  let method = '';
  let url = '';
  let forceGet = false;
  const headers: Array<{ name: string; value: string }> = [];
  const data: string[] = [];
  const urlEncoded: string[] = [];
  const forms: string[] = [];
  const unsupported: Record<string, JsonValue> = {};
  let username = '';
  let password = '';
  let bearer = '';
  let validateCertificates = true;
  let customTimeout = false;
  let timeoutMs = 60_000;
  let proxyUrl = '';

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    const requestMethod = optionValue(tokens, index, '-X') ?? optionValue(tokens, index, '--request');
    const header = optionValue(tokens, index, '-H') ?? optionValue(tokens, index, '--header');
    const body = optionValue(tokens, index, '-d') ?? optionValue(tokens, index, '--data') ?? optionValue(tokens, index, '--data-raw') ?? optionValue(tokens, index, '--data-binary');
    const encoded = optionValue(tokens, index, '--data-urlencode');
    const form = optionValue(tokens, index, '-F') ?? optionValue(tokens, index, '--form');
    const user = optionValue(tokens, index, '-u') ?? optionValue(tokens, index, '--user');
    const tokenBearer = optionValue(tokens, index, '--oauth2-bearer');
    const explicitUrl = optionValue(tokens, index, '--url');
    const cookie = optionValue(tokens, index, '-b') ?? optionValue(tokens, index, '--cookie');
    const timeout = optionValue(tokens, index, '--max-time');
    const proxy = optionValue(tokens, index, '-x') ?? optionValue(tokens, index, '--proxy');
    const json = optionValue(tokens, index, '--json');
    const certificate = optionValue(tokens, index, '-E') ?? optionValue(tokens, index, '--cert');
    const key = optionValue(tokens, index, '--key');
    const selected = requestMethod ?? header ?? body ?? encoded ?? form ?? user ?? tokenBearer ?? explicitUrl ?? cookie ?? timeout ?? proxy ?? json ?? certificate ?? key;
    if (selected) {
      index += selected.consumed;
      if (selected === requestMethod) method = selected.value;
      else if (selected === header) headers.push(parseHeader(selected.value));
      else if (selected === body) data.push(selected.value);
      else if (selected === encoded) urlEncoded.push(selected.value);
      else if (selected === form) forms.push(selected.value);
      else if (selected === user) [username, password = ''] = selected.value.split(':');
      else if (selected === tokenBearer) bearer = selected.value;
      else if (selected === explicitUrl) url = selected.value;
      else if (selected === cookie) headers.push({ name: 'Cookie', value: selected.value });
      else if (selected === timeout) { customTimeout = true; timeoutMs = Math.max(0, Number(selected.value) || 0) * 1000; }
      else if (selected === proxy) proxyUrl = selected.value;
      else if (selected === json) { data.push(selected.value); headers.push({ name: 'Content-Type', value: 'application/json' }, { name: 'Accept', value: 'application/json' }); }
      else if (selected === certificate) { unsupported.certificate = selected.value; warnings.push({ code: 'external-file', message: 'cURL certificate paths require selecting the certificate in Brunomnia.', resource: `cURL command ${commandIndex + 1}` }); }
      else if (selected === key) { unsupported.privateKey = selected.value; warnings.push({ code: 'external-file', message: 'cURL private-key paths require selecting the key in Brunomnia.', resource: `cURL command ${commandIndex + 1}` }); }
      continue;
    }
    if (token === '-G' || token === '--get') { forceGet = true; continue; }
    if (token === '-I' || token === '--head') { method = 'HEAD'; continue; }
    if (token === '-k' || token === '--insecure') { validateCertificates = false; continue; }
    if (token === '-L' || token === '--location' || token === '--compressed' || token === '-s' || token === '--silent') continue;
    if (!token.startsWith('-') && !url) { url = token; continue; }
    if (token.startsWith('-')) {
      unsupported[`option${Object.keys(unsupported).length + 1}`] = token;
      warnings.push({ code: 'curl-option', message: `cURL option '${token}' was preserved as source metadata.`, resource: url || `command ${commandIndex + 1}` });
    }
  }

  if (forceGet && (data.length || urlEncoded.length)) {
    const query = [...data, ...urlEncoded.map(encodeUrlData)].join('&');
    url += `${url.includes('?') ? '&' : '?'}${query}`;
    data.length = 0; urlEncoded.length = 0;
  }
  const inferredMethod = method || (forms.length || data.length || urlEncoded.length ? 'POST' : 'GET');
  const request = requestFrom('curl', `${inferredMethod}:${url}`, commandIndex);
  request.name = `${inferredMethod.toUpperCase()} ${url || `cURL request ${commandIndex + 1}`}`;
  request.method = normalizeMethod(inferredMethod, warnings, request.name);
  request.url = url;
  request.headers = headers.map((entry, index) => ({ id: `${request.id}-header-${index}`, ...entry, enabled: true }));
  if (forms.length) {
    request.bodyMode = 'multipart';
    request.multipartBody = forms.map((entry, index) => {
      const separator = entry.indexOf('=');
      const name = separator >= 0 ? entry.slice(0, separator) : entry;
      const value = separator >= 0 ? entry.slice(separator + 1) : '';
      const file = value.startsWith('@');
      if (file) warnings.push({ code: 'external-file', message: `cURL form file '${value.slice(1)}' requires re-selecting the local payload.`, resource: request.name });
      return { id: `${request.id}-part-${index}`, name, value: file ? '' : value, enabled: true, kind: file ? 'file' as const : 'text' as const };
    });
  } else if (urlEncoded.length) {
    request.bodyMode = 'form-urlencoded';
    request.formBody = urlEncoded.map((entry, index) => {
      const separator = entry.indexOf('=');
      return { id: `${request.id}-form-${index}`, name: separator >= 0 ? entry.slice(0, separator) : entry, value: separator >= 0 ? entry.slice(separator + 1) : '', enabled: true };
    });
  } else if (data.length) {
    request.body = data.join('&');
    const contentType = request.headers.find((header) => header.name.toLowerCase() === 'content-type')?.value ?? '';
    request.bodyMode = contentType.includes('json') || /^\s*[\[{]/.test(request.body) ? 'json' : contentType.includes('x-www-form-urlencoded') ? 'form-urlencoded' : 'text';
    if (request.bodyMode === 'form-urlencoded') {
      request.formBody = request.body.split('&').map((entry, index) => {
        const separator = entry.indexOf('=');
        return { id: `${request.id}-form-${index}`, name: separator >= 0 ? entry.slice(0, separator) : entry, value: separator >= 0 ? entry.slice(separator + 1) : '', enabled: true };
      });
    }
  } else request.bodyMode = 'none';
  if (bearer) request.auth = { ...request.auth, type: 'bearer', token: bearer };
  else if (username || password) request.auth = { ...request.auth, type: 'basic', username, password };
  request.transport = { ...request.transport, validateCertificates, timeoutMode: customTimeout ? 'custom' : 'global', timeoutMs, proxyUrl };
  request.source = sourceMetadata('curl', `command-${commandIndex + 1}`, Object.keys(unsupported).length ? unsupported : undefined);
  if (!url) warnings.push({ code: 'missing-url', message: 'A cURL command had no URL.', resource: request.name });
  return request;
};

export const importCurl = (contents: string, sourceName: string): ArtifactImport => {
  const warnings: ImportWarning[] = [];
  const commands = tokenize(contents);
  const requests = commands.map((tokens, index) => parseCurlCommand(tokens, index, warnings));
  const name = `${fileStem(sourceName)} cURL`;
  const collection: Collection = { id: sourceId('collection', 'curl', sourceName), name, expanded: true, requests, source: sourceMetadata('curl', sourceName) };
  if (!requests.length) warnings.push({ code: 'no-commands', message: 'No cURL commands were found.' });
  return { ...emptyResources(), format: 'curl', sourceName, warnings, metadata: { commands: String(requests.length) }, collections: [collection] };
};
