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

const timelinePrefix: Record<ResponseTimelineEntry['name'], string> = {
  HeaderIn: '< ',
  DataIn: '| ',
  SslDataIn: '<< ',
  HeaderOut: '> ',
  DataOut: '| ',
  SslDataOut: '>> ',
  Text: '* ',
};

export const formatResponseTimeline = (timeline: ResponseTimelineEntry[]) => timeline.map((entry, index, all) => {
  const lines = String(entry.value).replace(/\n$/, '').split('\n').filter((line) => !/^\s*$/.test(line)).map((line) => `${timelinePrefix[entry.name] ?? '* '}${line}`);
  return `${index > 0 && all[index - 1].name !== entry.name ? '\n' : ''}${lines.join('\n')}`;
}).join('\n').trim();

type TimelinePayload = { bytes: number; value: string; binary?: boolean; approximate?: boolean };

export type ResponseTransportEvidence = {
  requestHeaders?: Array<{ name: string; value: string }>;
  responseHeaders?: Array<{ name: string; value: string }>;
  redirects?: Array<{ status: number; fromUrl: string; toUrl: string; elapsedMs: number }>;
  redirectsTruncated?: boolean;
  effectiveUrl?: string;
  networkText?: Array<{ value: string; elapsedMs: number }>;
};

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

const requestTimeline = (request: ApiRequest, url: string, maxTimelineDataSizeKB: number, graphqlPayload: string | undefined, transport: ResponseTransportEvidence) => {
  const entries: ResponseTimelineEntry[] = [{ name: 'Text', value: `Preparing ${request.method} request to ${url}`, elapsedMs: 0 }];
  if (transport.requestHeaders?.length) entries.push({
    name: 'HeaderOut',
    value: transport.requestHeaders.map((header) => `${header.name}: ${header.value}`).join('\n'),
    elapsedMs: 0,
  });
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
  return entries;
};

const appendRedirectEvidence = (entries: ResponseTimelineEntry[], transport: ResponseTransportEvidence, elapsedMs: number) => {
  transport.redirects?.slice(0, 100).forEach((redirect) => entries.push({
    name: 'Text',
    value: `Redirect ${redirect.status}: ${redirect.fromUrl} -> ${redirect.toUrl}`,
    elapsedMs: Number.isFinite(redirect.elapsedMs) ? Math.max(0, redirect.elapsedMs) : 0,
  }));
  if (transport.redirectsTruncated) entries.push({ name: 'Text', value: 'Redirect trace truncated after 100 hops', elapsedMs });
};

export const buildRequestFailureTimeline = (
  request: ApiRequest,
  url: string,
  failure: { kind: string; message: string; elapsedMs: number },
  maxTimelineDataSizeKB = 10,
  graphqlPayload?: string,
  transport: ResponseTransportEvidence = {},
) => {
  const elapsedMs = Number.isFinite(failure.elapsedMs) ? Math.max(0, failure.elapsedMs) : 0;
  const entries = requestTimeline(request, url, maxTimelineDataSizeKB, graphqlPayload, transport);
  appendRedirectEvidence(entries, transport, elapsedMs);
  entries.push({ name: 'Text', value: `Transport ${failure.kind || 'error'}: ${failure.message}`, elapsedMs });
  return entries;
};

export const buildResponseTimeline = (
  request: ApiRequest,
  url: string,
  response: HttpResponse,
  maxTimelineDataSizeKB = 10,
  graphqlPayload?: string,
  transport: ResponseTransportEvidence = {},
): ResponseTimelineEntry[] => {
  const elapsedMs = Math.max(0, response.durationMs);
  const entries = requestTimeline(request, url, maxTimelineDataSizeKB, graphqlPayload, transport);
  appendRedirectEvidence(entries, transport, elapsedMs);
  transport.networkText?.forEach((entry) => entries.push({
    name: 'Text',
    value: entry.value,
    elapsedMs: Number.isFinite(entry.elapsedMs) ? Math.max(0, entry.elapsedMs) : elapsedMs,
  }));
  const responseHeaders = transport.responseHeaders?.length
    ? transport.responseHeaders
    : Object.entries(response.headers).map(([name, value]) => ({ name, value }));
  entries.push({
    name: 'HeaderIn',
    value: [
      `${response.httpVersion ?? 'HTTP'} ${response.status} ${response.statusText}`.trim(),
      ...responseHeaders.map((header) => `${header.name}: ${header.value}`),
    ].join('\n'),
    elapsedMs,
  });
  const wireSize = response.wireSizeBytes ?? response.sizeBytes;
  entries.push({
    name: 'Text',
    value: wireSize === response.sizeBytes
      ? `Response ${response.status} ${response.statusText}; received ${describeTimelineBytes(response.sizeBytes)} decoded body`
      : `Response ${response.status} ${response.statusText}; read ${describeTimelineBytes(wireSize)} compressed wire body and decoded ${describeTimelineBytes(response.sizeBytes)} content`,
    elapsedMs,
  });
  if (transport.effectiveUrl && transport.effectiveUrl !== url) entries.push({ name: 'Text', value: `Effective URL ${transport.effectiveUrl}`, elapsedMs });
  if (response.httpVersion) entries.push({ name: 'Text', value: `Negotiated ${response.httpVersion}`, elapsedMs });
  entries.push({ name: 'Text', value: 'Response body decoded and available to scripts and preview', elapsedMs });
  return entries;
};
