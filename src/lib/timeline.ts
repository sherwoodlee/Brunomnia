import type { ApiRequest, HttpResponse, ResponseTimelineEntry } from '../types';

const utf8Size = (value: string) => new TextEncoder().encode(value).byteLength;

const base64Size = (value: string) => {
  const compact = value.replace(/\s/g, '');
  if (!compact) return 0;
  return Math.max(0, Math.floor(compact.length * 3 / 4) - (compact.endsWith('==') ? 2 : compact.endsWith('=') ? 1 : 0));
};

export const describeTimelineBytes = (bytes: number) => {
  if (bytes < 1_024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1_024).toFixed(bytes < 10_240 ? 1 : 0)} KiB`;
  return `${(bytes / 1_048_576).toFixed(bytes < 10_485_760 ? 1 : 0)} MiB`;
};

type TimelinePayload = { bytes: number; value: string; binary?: boolean; approximate?: boolean };

const requestPayload = (request: ApiRequest, graphqlPayload?: string): TimelinePayload | undefined => {
  if (request.protocol === 'graphql') {
    const value = graphqlPayload ?? request.body;
    return { bytes: utf8Size(value), value };
  }
  if (request.method === 'GET' || request.method === 'HEAD' || request.bodyMode === 'none') return undefined;
  if (request.bodyMode === 'json' || request.bodyMode === 'text') return { bytes: utf8Size(request.body), value: request.body };
  if (request.bodyMode === 'form-urlencoded') {
    const value = new URLSearchParams(request.formBody.filter((field) => field.enabled && field.name).map((field) => [field.name, field.value])).toString();
    return { bytes: utf8Size(value), value };
  }
  if (request.bodyMode === 'binary' && request.binaryBody) {
    const bytes = base64Size(request.binaryBody.dataBase64);
    return { bytes, value: `${request.binaryBody.fileName || 'binary payload'} · ${describeTimelineBytes(bytes)}`, binary: true };
  }
  if (request.bodyMode === 'multipart') {
    const parts = request.multipartBody.filter((part) => part.enabled && part.name);
    const bytes = parts.reduce((total, part) => total + utf8Size(part.name) + (part.kind === 'file' && part.file ? base64Size(part.file.dataBase64) : utf8Size(part.value)), 0);
    const value = parts.map((part) => part.kind === 'file'
      ? `${part.name}=@${part.fileName || part.file?.fileName || 'file'} (${describeTimelineBytes(part.file ? base64Size(part.file.dataBase64) : 0)})`
      : `${part.name}=${part.value}`).join('\n');
    return { bytes, value, approximate: true };
  }
  return undefined;
};

export const buildResponseTimeline = (
  request: ApiRequest,
  url: string,
  response: HttpResponse,
  maxTimelineDataSizeKB = 10,
  graphqlPayload?: string,
): ResponseTimelineEntry[] => {
  const elapsedMs = Math.max(0, response.durationMs);
  const entries: ResponseTimelineEntry[] = [{ name: 'Text', value: `Preparing ${request.method} request to ${url}`, elapsedMs: 0 }];
  const payload = requestPayload(request, graphqlPayload);
  if (payload && payload.bytes > 0) {
    // Current Insomnia treats zero as a 1 KiB fallback and hides a chunk exactly at the limit.
    const limitBytes = (Math.max(0, maxTimelineDataSizeKB) || 1) * 1_024;
    const hidden = payload.bytes >= limitBytes;
    const suffix = payload.approximate ? ' (configured multipart data; wire framing excluded)' : '';
    entries.push({
      name: 'DataOut',
      value: hidden ? `(${describeTimelineBytes(payload.bytes)} hidden)` : payload.binary ? `(${payload.value})` : `${payload.value}${suffix}`,
      elapsedMs: 0,
      ...(hidden ? { hidden: true } : {}),
    });
  }
  entries.push({ name: 'Text', value: `Response ${response.status} ${response.statusText}; received ${describeTimelineBytes(response.sizeBytes)} decoded body`, elapsedMs });
  if (response.httpVersion) entries.push({ name: 'Text', value: `Negotiated ${response.httpVersion}`, elapsedMs });
  entries.push({ name: 'Text', value: 'Response body decoded and available to scripts and preview', elapsedMs });
  return entries;
};
