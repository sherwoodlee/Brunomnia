import { invoke, isTauri } from '@tauri-apps/api/core';
import type { ApiRequest, Environment, HttpResponse } from '../types';
import { buildHeaders, buildRequestUrl, environmentMap, mockResponse, resolveTemplate } from './request';

const graphqlBody = (request: ApiRequest, variables: Record<string, string>) => {
  let parsedVariables: unknown = {};
  const resolvedVariables = resolveTemplate(request.graphql.variables, variables).trim();
  if (resolvedVariables) parsedVariables = JSON.parse(resolvedVariables);
  return JSON.stringify({
    query: resolveTemplate(request.graphql.query, variables),
    variables: parsedVariables,
    operationName: request.graphql.operationName || undefined,
  });
};

const browserBody = (request: ApiRequest, variables: Record<string, string>): BodyInit | undefined => {
  if (request.method === 'GET' || request.method === 'HEAD' || request.bodyMode === 'none') return undefined;
  if (request.protocol === 'graphql') return graphqlBody(request, variables);
  if (request.bodyMode === 'form-urlencoded') {
    return new URLSearchParams(Object.fromEntries(request.formBody
      .filter((row) => row.enabled && row.name)
      .map((row) => [resolveTemplate(row.name, variables), resolveTemplate(row.value, variables)])));
  }
  if (request.bodyMode === 'multipart') {
    const body = new FormData();
    request.multipartBody.filter((part) => part.enabled && part.name).forEach((part) => {
      if (part.kind === 'file' && part.file) {
        const bytes = Uint8Array.from(atob(part.file.dataBase64), (character) => character.charCodeAt(0));
        body.append(part.name, new Blob([bytes], { type: part.file.mimeType }), part.file.fileName);
      } else {
        body.append(part.name, resolveTemplate(part.value, variables));
      }
    });
    return body;
  }
  if (request.bodyMode === 'binary' && request.binaryBody) {
    return Uint8Array.from(atob(request.binaryBody.dataBase64), (character) => character.charCodeAt(0));
  }
  return resolveTemplate(request.body, variables);
};

export const sendRequest = async (request: ApiRequest, environment: Environment | undefined): Promise<HttpResponse> => {
  const variables = environmentMap(environment);
  let url = buildRequestUrl(request, variables);
  let headers = buildHeaders(request, variables);
  const contentType = (value: string) => value.toLowerCase() === 'content-type';
  if (request.protocol === 'graphql' && !headers.some((header) => header.enabled && contentType(header.name))) {
    headers = [...headers, { id: 'graphql-content-type', name: 'Content-Type', value: 'application/json', enabled: true }];
  }
  if (request.protocol === 'http' && (request.bodyMode === 'multipart' || request.bodyMode === 'form-urlencoded')) {
    headers = headers.filter((header) => !contentType(header.name));
  }

  if (request.auth.type === 'api-key' && request.auth.apiKeyLocation === 'query' && request.auth.apiKeyName) {
    const parsedUrl = new URL(url);
    parsedUrl.searchParams.set(
      resolveTemplate(request.auth.apiKeyName, variables),
      resolveTemplate(request.auth.apiKeyValue, variables),
    );
    url = parsedUrl.toString();
  }

  if (isTauri()) {
    const body = request.protocol === 'graphql'
      ? graphqlBody(request, variables)
      : resolveTemplate(request.body, variables);
    return invoke<HttpResponse>('send_http_request', {
      input: {
        method: request.method,
        url,
        headers,
        bodyMode: request.protocol === 'graphql' ? 'json' : request.bodyMode,
        body,
        formBody: request.formBody,
        multipartBody: request.multipartBody,
        binaryBody: request.binaryBody,
        transport: request.transport,
      },
    });
  }

  if (new URL(url).hostname === 'api.acme.dev') {
    await new Promise((resolve) => window.setTimeout(resolve, 380));
    return mockResponse();
  }

  const startedAt = performance.now();
  const response = await fetch(url, {
    method: request.method,
    headers: Object.fromEntries(headers.filter((header) => header.enabled).map((header) => [header.name, header.value])),
    body: browserBody(request, variables),
    redirect: request.transport.followRedirects ? 'follow' : 'manual',
    signal: AbortSignal.timeout(request.transport.timeoutMs),
  });
  const body = await response.text();
  return {
    status: response.status,
    statusText: response.statusText,
    headers: Object.fromEntries(response.headers.entries()),
    body,
    durationMs: Math.round(performance.now() - startedAt),
    sizeBytes: new Blob([body]).size,
  };
};
