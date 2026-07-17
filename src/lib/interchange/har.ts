import type { ApiRequest, Collection, ImportWarning } from '../../types';
import { asArray, asRecord, asString, decodeBase64, fileStem, keyValues, normalizeMethod, requestFrom, sourceId, sourceMetadata, type UnknownRecord } from './common';
import { emptyResources, type ArtifactImport } from './types';

export const isHar = (document: UnknownRecord) => {
  const log = asRecord(document.log);
  return Array.isArray(log?.entries) || (typeof document.httpVersion === 'string' && typeof document.method === 'string' && typeof document.url === 'string');
};

const applyHarAuth = (request: ApiRequest) => {
  const authorization = request.headers.find((header) => header.name.toLowerCase() === 'authorization')?.value ?? '';
  if (authorization.startsWith('Basic ')) {
    const [username = '', password = ''] = decodeBase64(authorization.slice(6)).split(':');
    request.auth = { ...request.auth, type: 'basic', username, password };
  } else if (authorization.startsWith('Bearer ')) {
    request.auth = { ...request.auth, type: 'bearer', token: authorization.slice(7) };
  }
};

const applyHarBody = (request: ApiRequest, value: unknown, warnings: ImportWarning[]) => {
  const body = asRecord(value);
  if (!body) { request.bodyMode = 'none'; return; }
  const mimeType = asString(body.mimeType).toLowerCase();
  const params = asArray(body.params);
  if (params.length && mimeType.includes('multipart/form-data')) {
    request.bodyMode = 'multipart';
    request.multipartBody = params.flatMap((entry, index) => {
      const item = asRecord(entry);
      if (!item) return [];
      const fileName = asString(item.fileName);
      if (fileName) warnings.push({ code: 'external-file', message: `HAR file '${fileName}' requires re-selecting the local payload.`, resource: request.name });
      return [{ id: `${request.id}-part-${index}`, name: asString(item.name), value: asString(item.value), enabled: true, kind: fileName ? 'file' as const : 'text' as const }];
    });
  } else if (params.length || mimeType.includes('application/x-www-form-urlencoded')) {
    request.bodyMode = 'form-urlencoded';
    request.formBody = keyValues(params, `${request.id}-form`);
  } else if (typeof body.text === 'string') {
    request.bodyMode = mimeType.includes('json') || /^\s*[\[{]/.test(body.text) ? 'json' : 'text';
    request.body = body.text;
  } else {
    request.bodyMode = 'none';
  }
};

export const importHar = (sourceName: string, document: UnknownRecord): ArtifactImport => {
  const warnings: ImportWarning[] = [];
  const log = asRecord(document.log);
  const rawEntries = Array.isArray(log?.entries) ? log.entries : [{ request: document }];
  const requests = rawEntries.flatMap((rawEntry, index) => {
    const entry = asRecord(rawEntry);
    const raw = asRecord(entry?.request);
    if (!raw) return [];
    const identity = `${asString(raw.method)}:${asString(raw.url)}:${index}`;
    const request = requestFrom('har', identity, index);
    request.name = asString(entry?.comment ?? raw.comment, asString(raw.url, `HAR request ${index + 1}`));
    request.method = normalizeMethod(raw.method, warnings, request.name);
    request.url = asString(raw.url);
    request.params = keyValues(raw.queryString, `${request.id}-query`);
    request.headers = keyValues(raw.headers, `${request.id}-header`);
    const cookieHeader = asArray(raw.cookies).flatMap((cookie) => {
      const item = asRecord(cookie);
      return item ? [`${asString(item.name)}=${asString(item.value)}`] : [];
    }).join('; ');
    const existingCookie = request.headers.find((header) => header.name.toLowerCase() === 'cookie');
    if (cookieHeader && existingCookie) existingCookie.value = `${existingCookie.value}; ${cookieHeader}`;
    else if (cookieHeader) request.headers.push({ id: `${request.id}-cookies`, name: 'Cookie', value: cookieHeader, enabled: true });
    applyHarBody(request, raw.postData, warnings);
    applyHarAuth(request);
    request.source = sourceMetadata('har', identity, entry?.response ? { response: entry.response } : undefined);
    return [request];
  });
  const title = asString(asRecord(log?.creator)?.name, fileStem(sourceName));
  const collection: Collection = { id: sourceId('collection', 'har', sourceName), name: `${title} HAR`, expanded: true, requests, source: sourceMetadata('har', sourceName) };
  if (!requests.length) warnings.push({ code: 'no-requests', message: 'The HAR document contained no request entries.' });
  return { ...emptyResources(), format: 'har', sourceName, warnings, metadata: { title, requests: String(requests.length), version: asString(log?.version, '1.2') }, collections: [collection] };
};
