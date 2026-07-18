import type { ApiRequest, HttpResponse } from '../types';
import { responseBodyBytes } from './responseBytes';

export type ResponseArtifact<T extends string | Uint8Array = string> = { contents: T; fileName: string; mimeType: string };
export type ResponseBodyArtifact = ResponseArtifact<string | Uint8Array>;
export type ResponseDiagnosticKind = 'debug' | 'har';

const contentType = (response: HttpResponse) => Object.entries(response.headers)
  .find(([name]) => name.toLowerCase() === 'content-type')?.[1]
  .split(';')[0]
  .trim()
  .toLowerCase() || 'text/plain';

const extension = (mimeType: string) => mimeType.includes('json') ? 'json'
  : mimeType.includes('xml') ? 'xml'
    : mimeType.includes('html') ? 'html'
      : mimeType.includes('csv') ? 'csv'
        : /ya?ml/.test(mimeType) ? 'yaml'
          : 'txt';

const safeName = (value: string) => value.trim().replace(/\s+/g, '_').replace(/[^a-z0-9._-]/gi, '_').replace(/_+/g, '_').slice(0, 120) || 'response';

const byteLength = (value: string) => new TextEncoder().encode(value).byteLength;

const headerValue = (headers: Record<string, string>, target: string) => Object.entries(headers)
  .find(([name]) => name.toLowerCase() === target)?.[1] ?? '';

const requestHeaderValue = (request: ApiRequest, target: string) => request.headers
  .find((header) => header.enabled && header.name.toLowerCase() === target)?.value ?? '';

const requestPostData = (request: ApiRequest) => {
  if (request.protocol === 'graphql') {
    let variables: unknown = {};
    try { variables = JSON.parse(request.graphql.variables || '{}'); } catch { variables = request.graphql.variables; }
    return {
      mimeType: 'application/json',
      text: JSON.stringify({ query: request.graphql.query, variables, operationName: request.graphql.operationName || undefined }),
    };
  }
  if (request.bodyMode === 'json') return { mimeType: 'application/json', text: request.body };
  if (request.bodyMode === 'text') return { mimeType: requestHeaderValue(request, 'content-type') || 'text/plain', text: request.body };
  if (request.bodyMode === 'form-urlencoded') return {
    mimeType: 'application/x-www-form-urlencoded',
    params: request.formBody.filter((part) => part.enabled).map((part) => ({ name: part.name, value: part.value })),
  };
  if (request.bodyMode === 'multipart') return {
    mimeType: 'multipart/form-data',
    params: request.multipartBody.filter((part) => part.enabled).map((part) => ({
      name: part.name,
      value: part.kind === 'text' ? part.value : undefined,
      fileName: part.fileName || part.file?.fileName,
      contentType: part.contentType || part.file?.mimeType,
    })),
  };
  return undefined;
};

const requestBodySize = (request: ApiRequest, postData: ReturnType<typeof requestPostData>) => {
  if (!postData) return request.bodyMode === 'none' ? 0 : -1;
  if ('text' in postData && typeof postData.text === 'string') return byteLength(postData.text);
  if (request.bodyMode === 'form-urlencoded') {
    return byteLength(new URLSearchParams(request.formBody.filter((part) => part.enabled).map((part) => [part.name, part.value])).toString());
  }
  return -1;
};

const requestQuery = (request: ApiRequest, url: string) => {
  try {
    return [...new URL(url).searchParams.entries()].map(([name, value]) => ({ name, value }));
  } catch {
    return request.params.filter((parameter) => parameter.enabled).map((parameter) => ({ name: parameter.name, value: parameter.value }));
  }
};

const isoDate = (value: string | undefined, fallback: number) => {
  const parsed = value ? Date.parse(value) : Number.NaN;
  return new Date(Number.isFinite(parsed) ? parsed : fallback).toISOString();
};

export const createResponseBodyArtifact = (
  requestName: string,
  response: HttpResponse,
  prettify = false,
  timestamp = Date.now(),
): ResponseBodyArtifact => {
  const mimeType = contentType(response);
  let contents: string | Uint8Array = response.bodyBase64 === undefined ? response.body : responseBodyBytes(response);
  if (prettify && mimeType.includes('json')) {
    try { contents = JSON.stringify(JSON.parse(response.body), null, 2); } catch { /* retain exact raw body bytes */ }
  }
  return { contents, fileName: `${safeName(requestName)}-${timestamp}.${extension(mimeType)}`, mimeType };
};

export const createResponseDebugArtifact = (
  requestName: string,
  response: HttpResponse,
  timestamp = Date.now(),
): ResponseArtifact => {
  const version = response.httpVersion || 'HTTP/1.1';
  const headers = Object.entries(response.headers)
    .sort(([left], [right]) => left.localeCompare(right, undefined, { sensitivity: 'base' }))
    .map(([name, value]) => `${name}: ${value}`);
  const head = [`${version} ${response.status} ${response.statusText}`.trim(), ...headers].join('\r\n');
  return {
    contents: `${head}\r\n\r\n${response.body}`,
    fileName: `${safeName(requestName)}-${timestamp}.txt`,
    mimeType: 'text/plain',
  };
};

export const createResponseHarArtifact = (
  request: ApiRequest,
  response: HttpResponse,
  timestamp = Date.now(),
  receivedAt?: string,
): ResponseArtifact => {
  const url = response.requestUrl || request.url;
  const postData = requestPostData(request);
  const responseHeaders = Object.entries(response.headers).map(([name, value]) => ({ name, value }));
  const output = {
    log: {
      version: '1.2',
      creator: { name: 'Brunomnia', version: '0.1.0' },
      entries: [{
        startedDateTime: isoDate(receivedAt, timestamp),
        time: response.durationMs,
        request: {
          method: request.method,
          url,
          httpVersion: response.httpVersion || 'HTTP/1.1',
          headers: request.headers.filter((header) => header.enabled).map((header) => ({ name: header.name, value: header.value })),
          queryString: requestQuery(request, url),
          cookies: [],
          headersSize: -1,
          bodySize: requestBodySize(request, postData),
          ...(postData ? { postData } : {}),
        },
        response: {
          status: response.status,
          statusText: response.statusText,
          httpVersion: response.httpVersion || 'HTTP/1.1',
          headers: responseHeaders,
          cookies: [],
          content: { size: response.sizeBytes, mimeType: contentType(response), text: response.body },
          redirectURL: headerValue(response.headers, 'location'),
          headersSize: -1,
          bodySize: response.sizeBytes,
        },
        cache: {},
        timings: { send: 0, wait: response.durationMs, receive: 0 },
        comment: request.name,
      }],
    },
  };
  return {
    contents: `${JSON.stringify(output, null, 2)}\n`,
    fileName: `${safeName(request.name)}-${timestamp}.har`,
    mimeType: 'application/json',
  };
};

const downloadArtifact = (artifact: ResponseBodyArtifact) => {
  const contents = typeof artifact.contents === 'string' ? artifact.contents : new Uint8Array(artifact.contents).buffer;
  const url = URL.createObjectURL(new Blob([contents], { type: artifact.mimeType }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = artifact.fileName;
  anchor.click();
  URL.revokeObjectURL(url);
};

export const downloadResponseBody = (requestName: string, response: HttpResponse, prettify = false) => {
  downloadArtifact(createResponseBodyArtifact(requestName, response, prettify));
};

export const downloadResponseDiagnostic = (
  request: ApiRequest,
  response: HttpResponse,
  kind: ResponseDiagnosticKind,
  receivedAt?: string,
) => downloadArtifact(kind === 'har'
  ? createResponseHarArtifact(request, response, Date.now(), receivedAt)
  : createResponseDebugArtifact(request.name, response));
