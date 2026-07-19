import type { ApiRequest, KeyValue } from '../types';
import { buildHeaders, buildRequestUrl, resolveTemplate } from './request';

export type ClientCodeTarget = 'curl' | 'javascript-fetch' | 'python-requests' | 'go' | 'java-httpclient' | 'csharp-httpclient';

export const clientCodeTargets: Array<{ id: ClientCodeTarget; label: string }> = [
  { id: 'curl', label: 'cURL' },
  { id: 'javascript-fetch', label: 'JavaScript · Fetch' },
  { id: 'python-requests', label: 'Python · Requests' },
  { id: 'go', label: 'Go · net/http' },
  { id: 'java-httpclient', label: 'Java · HttpClient' },
  { id: 'csharp-httpclient', label: 'C# · HttpClient' },
];

export type ClientCodeSnippet = {
  code: string;
  warnings: string[];
};

type MaterializedRequest = {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: MaterializedBody;
  warnings: string[];
};

type MaterializedBody =
  | { kind: 'text'; value: string }
  | { kind: 'bytes'; contentType?: string; dataBase64: string; replaceContentType?: boolean };

const headerRecord = (rows: KeyValue[], warnings: string[]) => {
  const headers: Record<string, string> = {};
  const names = new Set<string>();
  rows.filter((row) => row.enabled && row.name.trim()).forEach((row) => {
    const name = row.name.trim();
    const normalized = name.toLowerCase();
    if (names.has(normalized)) warnings.push(`Duplicate header '${name}' was collapsed to its last value for this target.`);
    names.add(normalized);
    headers[name] = row.value;
  });
  return headers;
};

const addContentType = (headers: Record<string, string>, value: string) => {
  if (!Object.keys(headers).some((name) => name.toLowerCase() === 'content-type')) headers['Content-Type'] = value;
};

const removeContentType = (headers: Record<string, string>) => {
  Object.keys(headers).forEach((name) => {
    if (name.toLowerCase() === 'content-type') delete headers[name];
  });
};

const encoder = new TextEncoder();

const decodeBase64 = (value: string) => {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

const encodeBase64 = (value: Uint8Array) => {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let output = '';
  for (let index = 0; index < value.length; index += 3) {
    const first = value[index];
    const second = value[index + 1];
    const third = value[index + 2];
    output += alphabet[first >> 2];
    output += alphabet[((first & 3) << 4) | ((second ?? 0) >> 4)];
    output += second === undefined ? '=' : alphabet[((second & 15) << 2) | ((third ?? 0) >> 6)];
    output += third === undefined ? '=' : alphabet[third & 63];
  }
  return output;
};

const concatBytes = (chunks: Uint8Array[]) => {
  const output = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.byteLength, 0));
  let offset = 0;
  chunks.forEach((chunk) => {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  });
  return output;
};

const includesBytes = (value: Uint8Array, search: Uint8Array) => {
  if (!search.byteLength || search.byteLength > value.byteLength) return false;
  for (let start = 0; start <= value.byteLength - search.byteLength; start += 1) {
    let matches = true;
    for (let index = 0; index < search.byteLength; index += 1) {
      if (value[start + index] !== search[index]) {
        matches = false;
        break;
      }
    }
    if (matches) return true;
  }
  return false;
};

const safeMultipartHeaderValue = (value: string, label: string, warnings: string[]) => {
  const safe = value.replace(/[\r\n]+/g, ' ');
  if (safe !== value) warnings.push(`${label} line breaks were replaced to keep the generated multipart headers valid.`);
  return safe;
};

const quoteMultipartParameter = (value: string) => value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

type EncodedMultipartPart = {
  contentType: string;
  data: Uint8Array;
  fileName?: string;
  name: string;
};

const materializeMultipart = (request: ApiRequest, variables: Record<string, string>, warnings: string[]) => {
  const parts: EncodedMultipartPart[] = [];
  request.multipartBody.filter((part) => part.enabled).forEach((part) => {
    const name = safeMultipartHeaderValue(resolveTemplate(part.name, variables).trim(), 'Multipart field name', warnings);
    if (!name) return;
    const contentType = safeMultipartHeaderValue(resolveTemplate(part.contentType ?? '', variables).trim(), `Multipart field '${name}' content type`, warnings);
    if (part.kind === 'file') {
      if (!part.file) {
        warnings.push(`Multipart file field '${name}' was omitted because no file is attached.`);
        return;
      }
      let data: Uint8Array;
      try {
        data = decodeBase64(part.file.dataBase64);
      } catch {
        warnings.push(`Multipart file field '${name}' was omitted because its saved bytes are not valid Base64.`);
        return;
      }
      const fileName = safeMultipartHeaderValue(resolveTemplate(part.fileName || part.file.fileName || 'file', variables), `Multipart field '${name}' filename`, warnings);
      const effectiveContentType = safeMultipartHeaderValue(contentType || part.file.mimeType || 'application/octet-stream', `Multipart field '${name}' content type`, warnings);
      parts.push({ contentType: effectiveContentType, data, fileName, name });
      return;
    }
    parts.push({ contentType, data: encoder.encode(resolveTemplate(part.value, variables)), name });
  });

  const collisionInputs = parts.flatMap((part) => [
    part.data,
    encoder.encode(`${part.name}\n${part.fileName ?? ''}\n${part.contentType}`),
  ]);
  let boundaryIndex = 0;
  let boundary = '';
  do {
    boundary = `--------------------------brunomnia-generated-${boundaryIndex}`;
    boundaryIndex += 1;
  } while (collisionInputs.some((input) => includesBytes(input, encoder.encode(boundary))));

  const chunks: Uint8Array[] = [];
  parts.forEach((part) => {
    const disposition = `Content-Disposition: form-data; name="${quoteMultipartParameter(part.name)}"${part.fileName === undefined ? '' : `; filename="${quoteMultipartParameter(part.fileName)}"`}`;
    chunks.push(encoder.encode(`--${boundary}\r\n${disposition}\r\n`));
    if (part.contentType) chunks.push(encoder.encode(`Content-Type: ${part.contentType}\r\n`));
    chunks.push(encoder.encode('\r\n'), part.data, encoder.encode('\r\n'));
  });
  chunks.push(encoder.encode(`--${boundary}--\r\n`));
  return { boundary, dataBase64: encodeBase64(concatBytes(chunks)) };
};

const materializeBody = (request: ApiRequest, variables: Record<string, string>, warnings: string[]): MaterializedBody | undefined => {
  if (request.method === 'GET' || request.method === 'HEAD') return undefined;
  if (request.protocol === 'graphql') {
    let graphqlVariables: unknown = request.graphql.variables;
    try { graphqlVariables = JSON.parse(resolveTemplate(request.graphql.variables || '{}', variables)); } catch { warnings.push('GraphQL variables were emitted as text because they are not valid JSON.'); }
    return { kind: 'text', value: JSON.stringify({
      query: request.graphql.query,
      variables: graphqlVariables,
      ...(request.graphql.operationName ? { operationName: request.graphql.operationName } : {}),
    }) };
  }
  if (request.bodyMode === 'none') return undefined;
  if (request.bodyMode === 'json' || request.bodyMode === 'text') return { kind: 'text', value: resolveTemplate(request.body, variables) };
  if (request.bodyMode === 'form-urlencoded') {
    const body = new URLSearchParams();
    request.formBody.filter((row) => row.enabled && row.name).forEach((row) => body.append(resolveTemplate(row.name, variables), resolveTemplate(row.value, variables)));
    return { kind: 'text', value: body.toString() };
  }
  if (request.bodyMode === 'multipart') {
    const multipart = materializeMultipart(request, variables, warnings);
    return { kind: 'bytes', contentType: `multipart/form-data; boundary=${multipart.boundary}`, dataBase64: multipart.dataBase64, replaceContentType: true };
  }
  if (request.bodyMode === 'binary') {
    if (!request.binaryBody) {
      warnings.push('Binary payload bytes were omitted because no file is attached.');
      return undefined;
    }
    try {
      decodeBase64(request.binaryBody.dataBase64);
    } catch {
      warnings.push('Binary payload bytes were omitted because the saved file is not valid Base64.');
      return undefined;
    }
    return { kind: 'bytes', contentType: request.binaryBody.mimeType, dataBase64: request.binaryBody.dataBase64 };
  }
  return undefined;
};

const materialize = (request: ApiRequest, variables: Record<string, string>): MaterializedRequest => {
  const warnings: string[] = [];
  let url: string;
  try { url = buildRequestUrl(request, variables); } catch {
    url = buildRequestUrl({ ...request, params: [] }, variables);
    warnings.push('Query parameters could not be appended because the resolved URL is invalid.');
  }
  if (!request.auth.disabled && request.auth.type === 'api-key' && request.auth.apiKeyLocation === 'query' && request.auth.apiKeyName) {
    try {
      const parsed = new URL(url);
      parsed.searchParams.set(resolveTemplate(request.auth.apiKeyName, variables), resolveTemplate(request.auth.apiKeyValue, variables));
      url = parsed.toString();
    } catch { warnings.push('The API-key query parameter could not be appended because the resolved URL is invalid.'); }
  }
  const headerRows = buildHeaders(request, variables);
  if (!request.auth.disabled && request.auth.type === 'oauth2' && request.auth.accessToken) {
    headerRows.push({ id: 'codegen-oauth2', name: 'Authorization', value: `${request.auth.tokenPrefix || 'Bearer'} ${resolveTemplate(request.auth.accessToken, variables)}`.trim(), enabled: true });
  }
  const headers = headerRecord(headerRows, warnings);
  const body = materializeBody(request, variables, warnings);
  if (request.protocol === 'graphql' || request.bodyMode === 'json') addContentType(headers, 'application/json');
  if (request.bodyMode === 'form-urlencoded') addContentType(headers, 'application/x-www-form-urlencoded');
  if (body?.kind === 'bytes' && body.replaceContentType && body.contentType) {
    removeContentType(headers);
    headers['Content-Type'] = body.contentType;
  }
  if (body?.kind === 'bytes' && !body.replaceContentType && body.contentType) addContentType(headers, body.contentType);
  if (!request.auth.disabled && !['none', 'bearer', 'basic', 'api-key', 'oauth2'].includes(request.auth.type)) {
    warnings.push(`${request.auth.type.toUpperCase()} signing is runtime-specific and is not reproduced in the generated snippet.`);
  }
  if (/{{\s*[^{}]+\s*}}/.test(`${url}\n${JSON.stringify(headers)}\n${JSON.stringify(body)}`)) warnings.push('Unresolved template tags remain in the snippet.');
  if (request.pathParams.some((row) => row.enabled && /{{\s*[^{}]+\s*}}/.test(resolveTemplate(`${row.name}\n${row.value}`, variables)))) warnings.push('An unresolved template tag remains in a path parameter.');
  if (/{[^{}]+}/.test(url)) warnings.push('One or more path parameters have no enabled value.');
  return { method: request.method, url, headers, body, warnings: [...new Set(warnings)] };
};

const json = (value: unknown) => JSON.stringify(value);
const prettyJson = (value: unknown) => JSON.stringify(value, null, 2);
const shell = (value: string) => `'${value.replace(/'/g, `'"'"'`)}'`;

const curlSnippet = ({ method, url, headers, body }: MaterializedRequest) => {
  const parts = [`curl --request ${method}`, `  --url ${shell(url)}`];
  Object.entries(headers).forEach(([name, value]) => parts.push(`  --header ${shell(`${name}: ${value}`)}`));
  if (body?.kind === 'text') parts.push(`  --data-raw ${shell(body.value)}`);
  if (body?.kind === 'bytes') parts.push('  --data-binary @"$payload_file"');
  const command = parts.join(' \\\n');
  if (body?.kind !== 'bytes') return command;
  return `payload_file="$(mktemp)"
trap 'rm -f "$payload_file"' EXIT
if ! printf %s ${shell(body.dataBase64)} | base64 --decode > "$payload_file" 2>/dev/null; then
  printf %s ${shell(body.dataBase64)} | base64 -D > "$payload_file"
fi

${command}`;
};

const javascriptSnippet = ({ method, url, headers, body }: MaterializedRequest) => {
  const bodyExpression = body?.kind === 'text'
    ? json(body.value)
    : body?.kind === 'bytes'
      ? `Uint8Array.from(atob(${json(body.dataBase64)}), character => character.charCodeAt(0))`
      : '';
  return `const response = await fetch(${json(url)}, {
  method: ${json(method)},
  headers: ${prettyJson(headers)}${body === undefined ? '' : `,\n  body: ${bodyExpression}`}
});

const data = await response.text();
console.log(response.status, data);`;
};

const pythonSnippet = ({ method, url, headers, body }: MaterializedRequest) => {
  const bodyExpression = body?.kind === 'text'
    ? json(body.value)
    : body?.kind === 'bytes'
      ? `base64.b64decode(${json(body.dataBase64)})`
      : '';
  return `${body?.kind === 'bytes' ? 'import base64\n' : ''}import requests

response = requests.request(
    ${json(method)},
    ${json(url)},
    headers=${prettyJson(headers).replace(/^/gm, '    ').trimStart()}${body === undefined ? '' : `,\n    data=${bodyExpression}`},
    timeout=30,
)

print(response.status_code, response.text)`;
};

const goSnippet = ({ method, url, headers, body }: MaterializedRequest) => {
  const imports = ['"fmt"', '"io"', '"net/http"'];
  if (body) imports.unshift('"bytes"');
  if (body?.kind === 'bytes') imports.splice(1, 0, '"encoding/base64"');
  const bodySetup = body?.kind === 'text'
    ? `\trequestPayload := []byte(${json(body.value)})\n`
    : body?.kind === 'bytes'
      ? `\trequestPayload, err := base64.StdEncoding.DecodeString(${json(body.dataBase64)})\n\tif err != nil { panic(err) }\n`
      : '';
  return `package main

import (
${imports.map((name) => `\t${name}`).join('\n')}
)

func main() {
${bodySetup}	req, err := http.NewRequest(${json(method)}, ${json(url)}, ${body === undefined ? 'nil' : 'bytes.NewReader(requestPayload)'})
	if err != nil { panic(err) }
${Object.entries(headers).map(([name, value]) => `\treq.Header.Add(${json(name)}, ${json(value)})`).join('\n')}
	response, err := http.DefaultClient.Do(req)
	if err != nil { panic(err) }
	defer response.Body.Close()
	payload, err := io.ReadAll(response.Body)
	if err != nil { panic(err) }
	fmt.Println(response.StatusCode, string(payload))
}`;
};

const javaSnippet = ({ method, url, headers, body }: MaterializedRequest) => {
  const publisher = body?.kind === 'text'
    ? `HttpRequest.BodyPublishers.ofString(${json(body.value)})`
    : body?.kind === 'bytes'
      ? `HttpRequest.BodyPublishers.ofByteArray(Base64.getDecoder().decode(${json(body.dataBase64)}))`
      : 'HttpRequest.BodyPublishers.noBody()';
  return `import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
${body?.kind === 'bytes' ? 'import java.util.Base64;\n' : ''}

var request = HttpRequest.newBuilder(URI.create(${json(url)}))
    .method(${json(method)}, ${publisher})
${Object.entries(headers).map(([name, value]) => `    .header(${json(name)}, ${json(value)})`).join('\n')}
    .build();
var response = HttpClient.newHttpClient().send(request, HttpResponse.BodyHandlers.ofString());
System.out.println(response.statusCode() + " " + response.body());`;
};

const csharpSnippet = ({ method, url, headers, body }: MaterializedRequest) => {
  const content = body?.kind === 'text'
    ? `request.Content = new StringContent(${json(body.value)});\n`
    : body?.kind === 'bytes'
      ? `request.Content = new ByteArrayContent(Convert.FromBase64String(${json(body.dataBase64)}));\n`
      : '';
  return `using System;
using System.Net.Http;

using var client = new HttpClient();
using var request = new HttpRequestMessage(new HttpMethod(${json(method)}), ${json(url)});
${content}${Object.entries(headers).map(([name, value]) => `if (!request.Headers.TryAddWithoutValidation(${json(name)}, ${json(value)})) { request.Content?.Headers.Remove(${json(name)}); request.Content?.Headers.TryAddWithoutValidation(${json(name)}, ${json(value)}); }`).join('\n')}
using var response = await client.SendAsync(request);
Console.WriteLine($"{(int)response.StatusCode} {await response.Content.ReadAsStringAsync()}");`;
};

export const generateClientCode = (target: ClientCodeTarget, request: ApiRequest, variables: Record<string, string>): ClientCodeSnippet => {
  const prepared = materialize(request, variables);
  const generators: Record<ClientCodeTarget, (input: MaterializedRequest) => string> = {
    curl: curlSnippet,
    'javascript-fetch': javascriptSnippet,
    'python-requests': pythonSnippet,
    go: goSnippet,
    'java-httpclient': javaSnippet,
    'csharp-httpclient': csharpSnippet,
  };
  return { code: generators[target](prepared), warnings: prepared.warnings };
};
