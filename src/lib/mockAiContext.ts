import type { ApiRequest, HttpResponse, KeyValue, StoredResponse, Workspace } from '../types';

export type MockAiContextSource = 'manual' | 'active-request' | 'latest-response' | 'spec-url';
export type WorkspaceMockAiContextSource = Extract<MockAiContextSource, 'active-request' | 'latest-response'>;

export type MockAiContext = {
  label: string;
  text: string;
};

export const MAX_MOCK_AI_INPUT_CHARS = 190_000;
export const MAX_MOCK_SPEC_URL_BYTES = 5_000_000;
const MAX_CONTEXT_CHARS = 94_000;
const MAX_ADDITIONAL_INSTRUCTIONS_CHARS = 94_000;
const REDACTED = '[REDACTED]';

const bounded = (value: string, limit: number) => {
  const suffix = '\n… [truncated locally]';
  return value.length <= limit ? value : `${value.slice(0, Math.max(0, limit - suffix.length))}${suffix}`;
};

const normalizedName = (name: string) => name
  .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
  .toLowerCase();

const isSensitiveName = (name: string) => {
  const normalized = normalizedName(name);
  return /(?:^|[-_.\s])(authorization|auth|cookie|set-cookie|credential|password|passwd|secret|token|api-key|apikey|private-key|signature|key)(?:$|[-_.\s])/.test(normalized);
};

const redactUrl = (value: string) => value
  .replace(/(^[a-z][a-z\d+.-]*:\/\/)[^/@\s]+@/i, `$1${REDACTED}@`)
  .replace(/([?&])([^=&#]+)=([^&#]*)/g, (match, separator: string, rawName: string) => {
    let name = rawName;
    try { name = decodeURIComponent(rawName.replace(/\+/g, ' ')); } catch { /* retain the configured name */ }
    return isSensitiveName(name) ? `${separator}${rawName}=${REDACTED}` : match;
  });

const redactUnknown = (value: unknown, key = '', depth = 0): unknown => {
  if (isSensitiveName(key)) return REDACTED;
  if (depth > 20) return '[nested value omitted]';
  if (Array.isArray(value)) return value.slice(0, 500).map((item) => redactUnknown(item, '', depth + 1));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value as Record<string, unknown>).slice(0, 1_000).map(([name, item]) => [name, redactUnknown(item, name, depth + 1)]));
  return value;
};

const redactBody = (value: string) => {
  const source = bounded(value, MAX_CONTEXT_CHARS);
  if (!source.trim()) return '';
  try {
    return JSON.stringify(redactUnknown(JSON.parse(source)), null, 2);
  } catch {
    return source.replace(/((?:authorization|auth|cookie|credential|password|passwd|secret|token|api[-_ -]?key|private[-_ -]?key|signature)\s*["']?\s*[:=]\s*)([^\s,;&}\n]+)/gi, `$1${REDACTED}`);
  }
};

const redactRows = (rows: KeyValue[]) => rows
  .filter((row) => row.enabled && row.name)
  .slice(0, 1_000)
  .map((row) => ({ name: row.name, value: isSensitiveName(row.name) ? REDACTED : bounded(row.value, 20_000) }));

const requestPayload = (request: ApiRequest) => {
  const payload: Record<string, unknown> = {
    name: request.name,
    protocol: request.protocol,
    method: request.method,
    url: redactUrl(request.url),
    pathParameters: redactRows(request.pathParams),
    queryParameters: redactRows(request.params),
    headers: redactRows(request.headers),
    authentication: request.auth.disabled ? 'disabled' : request.auth.type,
    bodyMode: request.bodyMode,
  };
  if (request.bodyMode === 'json' || request.bodyMode === 'text') payload.body = redactBody(request.body);
  if (request.bodyMode === 'form-urlencoded') payload.form = redactRows(request.formBody);
  if (request.bodyMode === 'multipart') payload.multipart = request.multipartBody.filter((part) => part.enabled).slice(0, 1_000).map((part) => ({
    name: part.name,
    kind: part.kind,
    value: part.kind === 'file' ? '[file bytes omitted]' : isSensitiveName(part.name) ? REDACTED : bounded(part.value, 20_000),
    fileName: part.fileName || part.file?.fileName || undefined,
    contentType: part.contentType || part.file?.mimeType || undefined,
  }));
  if (request.bodyMode === 'binary') payload.body = request.binaryBody ? { fileName: request.binaryBody.fileName, mimeType: request.binaryBody.mimeType, data: '[file bytes omitted]' } : '[no file selected]';
  if (request.protocol === 'graphql') payload.graphql = {
    operationName: request.graphql.operationName,
    query: bounded(request.graphql.query, 60_000),
    variables: redactBody(request.graphql.variables),
  };
  if (request.protocol === 'grpc') payload.grpc = {
    service: request.grpc.service,
    method: request.grpc.method,
    input: redactBody(request.grpc.input),
    metadata: redactRows(request.grpc.metadata),
  };
  return payload;
};

const responseHeaders = (headers: Record<string, string>) => Object.fromEntries(Object.entries(headers).slice(0, 1_000).map(([name, value]) => [name, isSensitiveName(name) ? REDACTED : bounded(value, 20_000)]));

export const findActiveRequest = (workspace: Workspace) => workspace.collections
  .flatMap((collection) => collection.requests)
  .find((request) => request.id === workspace.activeRequestId);

export const findLatestResponseForActiveRequest = (workspace: Workspace): StoredResponse | undefined => {
  const candidates = workspace.responses.filter((response) => response.requestId === workspace.activeRequestId)
    .filter((response) => !workspace.preferences.filterResponsesByEnv || response.environmentId === workspace.activeEnvironmentId);
  return candidates.reduce<StoredResponse | undefined>((latest, response) => {
    if (!latest) return response;
    const latestTime = Date.parse(latest.receivedAt);
    const responseTime = Date.parse(response.receivedAt);
    if (Number.isNaN(latestTime) || Number.isNaN(responseTime)) return response;
    return responseTime >= latestTime ? response : latest;
  }, undefined);
};

export const buildMockAiContext = (workspace: Workspace, source: WorkspaceMockAiContextSource): MockAiContext => {
  const activeRequest = findActiveRequest(workspace);
  if (!activeRequest) throw new Error('Select an active request before using request context.');
  if (source === 'active-request') {
    return {
      label: `Active request · ${activeRequest.name}`,
      text: bounded(`The user explicitly selected this credential-redacted active request as mock-generation source material.\n${JSON.stringify({ request: requestPayload(activeRequest) }, null, 2)}`, MAX_CONTEXT_CHARS),
    };
  }
  const response = findLatestResponseForActiveRequest(workspace);
  if (!response) throw new Error('Send the active request before using its latest response as context.');
  return {
    label: `Latest response · ${response.status} ${response.statusText}`.trim(),
    text: bounded(`The user explicitly selected this credential-redacted request and response as mock-generation source material.\n${JSON.stringify({
      request: requestPayload(response.requestSnapshot ?? activeRequest),
      response: {
        url: redactUrl(response.requestUrl || response.requestSnapshot?.url || activeRequest.url),
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders(response.headers),
        body: redactBody(response.body),
      },
    }, null, 2)}`, MAX_CONTEXT_CHARS),
  };
};

export const validateMockSpecUrl = (value: string) => {
  const source = value.trim();
  if (!source) throw new Error('Enter a specification URL.');
  if (source.length > 8_192) throw new Error('The specification URL exceeds 8,192 characters.');
  let url: URL;
  try { url = new URL(source); } catch { throw new Error('Enter a valid specification URL.'); }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('Specification URLs must use HTTP or HTTPS.');
  if (url.username || url.password) throw new Error('Specification URLs cannot include credentials.');
  url.hash = '';
  return url.toString();
};

export const buildMockSpecUrlContext = (url: string, response: Pick<HttpResponse, 'body' | 'bodyBase64' | 'headers' | 'sizeBytes'>): MockAiContext => {
  if (response.sizeBytes > MAX_MOCK_SPEC_URL_BYTES) throw new Error('The specification URL response exceeds the 5 MB model-context limit.');
  const contentType = Object.entries(response.headers).find(([name]) => name.toLowerCase() === 'content-type')?.[1] ?? '';
  const mimeType = contentType.split(';', 1)[0].trim().toLowerCase();
  const textLike = !mimeType || mimeType.startsWith('text/') || mimeType === 'application/x-yaml' || /(?:^|\/|\+)(?:json|xml|yaml)$/.test(mimeType);
  if (!textLike || (response.bodyBase64 !== undefined && !mimeType)) throw new Error('The specification URL returned a binary response. Use JSON, YAML, XML, or text.');
  if (!response.body.trim()) throw new Error('The specification URL returned an empty body.');
  const safeUrl = redactUrl(validateMockSpecUrl(url));
  return {
    label: `Specification URL · ${new URL(safeUrl).hostname}`,
    text: bounded(`The user explicitly fetched and selected this specification URL as mock-generation source material.\nSOURCE URL: ${safeUrl}\nCONTENT TYPE: ${contentType || 'not provided'}\n\nSPECIFICATION:\n${response.body}`, MAX_CONTEXT_CHARS),
  };
};

export const composeMockAiInput = (instructions: string, context?: MockAiContext) => {
  const trimmed = instructions.trim();
  if (!context) {
    if (!trimmed) throw new Error('Describe the mock API, paste an OpenAPI document, or include an example response.');
    return bounded(trimmed, MAX_MOCK_AI_INPUT_CHARS);
  }
  const additional = bounded(trimmed, MAX_ADDITIONAL_INSTRUCTIONS_CHARS);
  return bounded(`${context.text}${additional ? `\n\nADDITIONAL USER INSTRUCTIONS:\n${additional}` : ''}`, MAX_MOCK_AI_INPUT_CHARS);
};
