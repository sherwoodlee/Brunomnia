import type { ApiRequest, KeyValue } from '../types';
import { buildHeaders, buildRequestUrl, resolveTemplate } from './request';

export type ClientCodeTarget =
  | 'curl'
  | 'javascript-fetch'
  | 'node-native'
  | 'python-requests'
  | 'php-curl'
  | 'ruby-native'
  | 'go'
  | 'java-httpclient'
  | 'csharp-httpclient'
  | 'swift-urlsession'
  | 'rust-reqwest'
  | 'c-libcurl'
  | 'clojure-clj-http'
  | 'crystal-native'
  | 'http-1.1'
  | 'kotlin-okhttp'
  | 'objc-nsurlsession'
  | 'ocaml-cohttp'
  | 'powershell-webrequest'
  | 'r-httr';

export const clientCodeTargets: Array<{ id: ClientCodeTarget; label: string }> = [
  { id: 'c-libcurl', label: 'C · libcurl' },
  { id: 'clojure-clj-http', label: 'Clojure · clj-http' },
  { id: 'crystal-native', label: 'Crystal · HTTP::Client' },
  { id: 'csharp-httpclient', label: 'C# · HttpClient' },
  { id: 'go', label: 'Go · net/http' },
  { id: 'http-1.1', label: 'HTTP · HTTP/1.1' },
  { id: 'java-httpclient', label: 'Java · HttpClient' },
  { id: 'javascript-fetch', label: 'JavaScript · Fetch' },
  { id: 'kotlin-okhttp', label: 'Kotlin · OkHttp' },
  { id: 'node-native', label: 'Node.js · Native' },
  { id: 'objc-nsurlsession', label: 'Objective-C · NSURLSession' },
  { id: 'ocaml-cohttp', label: 'OCaml · CoHTTP' },
  { id: 'php-curl', label: 'PHP · cURL' },
  { id: 'powershell-webrequest', label: 'PowerShell · Invoke-WebRequest' },
  { id: 'python-requests', label: 'Python · Requests' },
  { id: 'r-httr', label: 'R · httr' },
  { id: 'ruby-native', label: 'Ruby · Net::HTTP' },
  { id: 'rust-reqwest', label: 'Rust · Reqwest' },
  { id: 'curl', label: 'Shell · cURL' },
  { id: 'swift-urlsession', label: 'Swift · URLSession' },
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
  const render = (value: string) => request.renderBodyTemplates !== false ? resolveTemplate(value, variables) : value;
  request.multipartBody.filter((part) => part.enabled).forEach((part) => {
    const name = safeMultipartHeaderValue(render(part.name).trim(), 'Multipart field name', warnings);
    if (!name) return;
    const contentType = safeMultipartHeaderValue(render(part.contentType ?? '').trim(), `Multipart field '${name}' content type`, warnings);
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
      const fileName = safeMultipartHeaderValue(render(part.fileName || part.file.fileName || 'file'), `Multipart field '${name}' filename`, warnings);
      const effectiveContentType = safeMultipartHeaderValue(contentType || part.file.mimeType || 'application/octet-stream', `Multipart field '${name}' content type`, warnings);
      parts.push({ contentType: effectiveContentType, data, fileName, name });
      return;
    }
    parts.push({ contentType, data: encoder.encode(render(part.value)), name });
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
  const render = (value: string) => request.renderBodyTemplates !== false ? resolveTemplate(value, variables) : value;
  if (request.method === 'GET' || request.method === 'HEAD') return undefined;
  if (request.protocol === 'graphql') {
    let graphqlVariables: unknown = request.graphql.variables;
    try { graphqlVariables = JSON.parse(render(request.graphql.variables || '{}')); } catch { warnings.push('GraphQL variables were emitted as text because they are not valid JSON.'); }
    return { kind: 'text', value: JSON.stringify({
      query: request.graphql.query,
      variables: graphqlVariables,
      ...(request.graphql.operationName ? { operationName: request.graphql.operationName } : {}),
    }) };
  }
  if (request.bodyMode === 'none') return undefined;
  if (request.bodyMode === 'json' || request.bodyMode === 'text') return { kind: 'text', value: render(request.body) };
  if (request.bodyMode === 'form-urlencoded') {
    const body = new URLSearchParams();
    request.formBody.filter((row) => row.enabled && row.name).forEach((row) => body.append(render(row.name), render(row.value)));
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
const singleQuoted = (value: string) => `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
const bodyBase64 = (body: MaterializedBody) => body.kind === 'bytes' ? body.dataBase64 : encodeBase64(encoder.encode(body.value));
const rustRaw = (value: string) => {
  let hashes = '';
  while (value.includes(`"${hashes}`)) hashes += '#';
  return `r${hashes}"${value}"${hashes}`;
};
const bodyBytes = (body: MaterializedBody) => body.kind === 'bytes' ? decodeBase64(body.dataBase64) : encoder.encode(body.value);
const escapedByteString = (bytes: Uint8Array, escapeByte: (byte: number) => string) => `"${Array.from(bytes, (byte) => {
  if (byte === 34) return '\\"';
  if (byte === 92) return '\\\\';
  if (byte >= 32 && byte <= 126) return String.fromCharCode(byte);
  return escapeByte(byte);
}).join('')}"`;
const cString = (value: string) => escapedByteString(encoder.encode(value), (byte) => `\\${byte.toString(8).padStart(3, '0')}`);
const ocamlBytes = (value: Uint8Array) => escapedByteString(value, (byte) => `\\${byte.toString(10).padStart(3, '0')}`);
const ocamlString = (value: string) => ocamlBytes(encoder.encode(value));
const kotlinString = (value: string) => json(value).replace(/\$/g, '\\$');
const crystalString = (value: string) => json(value).replace(/#\{/g, '\\#{');
const objcString = (value: string) => `@${json(value)}`;
const powershellString = (value: string) => `'${value.replace(/'/g, "''")}'`;

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

const nodeSnippet = ({ method, url, headers, body }: MaterializedRequest) => {
  const payload = body?.kind === 'text'
    ? `Buffer.from(${json(body.value)}, 'utf8')`
    : body?.kind === 'bytes'
      ? `Buffer.from(${json(body.dataBase64)}, 'base64')`
      : '';
  return `import http from 'node:http';
import https from 'node:https';

const target = new URL(${json(url)});
${body ? `const payload = ${payload};\n` : ''}const request = (target.protocol === 'https:' ? https : http).request(target, {
  method: ${json(method)},
  headers: ${prettyJson(headers)}
}, response => {
  const chunks = [];
  response.on('data', chunk => chunks.push(chunk));
  response.on('end', () => console.log(response.statusCode, Buffer.concat(chunks).toString('utf8')));
});

request.on('error', error => { throw error; });
request.end(${body ? 'payload' : ''});`;
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

const phpSnippet = ({ method, url, headers, body }: MaterializedRequest) => {
  const payload = body ? `$payload = base64_decode(${singleQuoted(bodyBase64(body))}, true);
if ($payload === false) { throw new RuntimeException('Invalid generated Base64 payload.'); }

` : '';
  const options = [
    `    CURLOPT_URL => ${singleQuoted(url)}`,
    '    CURLOPT_RETURNTRANSFER => true',
    `    CURLOPT_CUSTOMREQUEST => ${singleQuoted(method)}`,
    `    CURLOPT_HTTPHEADER => [${Object.entries(headers).map(([name, value]) => `\n        ${singleQuoted(`${name}: ${value}`)}`).join(',')}${Object.keys(headers).length ? '\n    ' : ''}]`,
    ...(body ? ['    CURLOPT_POSTFIELDS => $payload'] : []),
  ];
  return `<?php

${payload}$curl = curl_init();
curl_setopt_array($curl, [
${options.join(',\n')}
]);

$response = curl_exec($curl);
if ($response === false) { throw new RuntimeException(curl_error($curl)); }
$status = curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
curl_close($curl);
echo $status . ' ' . $response . PHP_EOL;`;
};

const rubySnippet = ({ method, url, headers, body }: MaterializedRequest) => {
  const requestHasBody = body ? 'true' : 'false';
  const headerEntries = Object.entries(headers).map(([name, value]) => `${singleQuoted(name)} => ${singleQuoted(value)}`).join(', ');
  return `require 'net/http'
require 'uri'
${body ? "require 'base64'\n" : ''}
uri = URI(${singleQuoted(url)})
request = Net::HTTPGenericRequest.new(${singleQuoted(method)}, ${requestHasBody}, true, uri.request_uri, { ${headerEntries} })
${body ? `request.body = Base64.strict_decode64(${singleQuoted(bodyBase64(body))})\n` : ''}http = Net::HTTP.new(uri.host, uri.port)
http.use_ssl = uri.scheme == 'https'
response = http.request(request)
puts "#{response.code} #{response.body}"`;
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

const swiftSnippet = ({ method, url, headers, body }: MaterializedRequest) => {
  const headerFields = Object.entries(headers).map(([name, value]) => `${json(name)}: ${json(value)}`).join(',\n    ');
  return `import Foundation

let url = URL(string: ${json(url)})!
var request = URLRequest(url: url)
request.httpMethod = ${json(method)}
request.allHTTPHeaderFields = [${headerFields ? `\n    ${headerFields}\n` : ''}]${body ? `
request.httpBody = Data(base64Encoded: ${json(bodyBase64(body))})!` : ''}

let semaphore = DispatchSemaphore(value: 0)
URLSession.shared.dataTask(with: request) { data, response, error in
    defer { semaphore.signal() }
    if let error { print(error); return }
    let status = (response as? HTTPURLResponse)?.statusCode ?? 0
    let text = data.flatMap { String(data: $0, encoding: .utf8) } ?? ""
    print(status, text)
}.resume()
semaphore.wait()`;
};

const rustSnippet = ({ method, url, headers, body }: MaterializedRequest) => `${body ? 'use base64::{engine::general_purpose::STANDARD, Engine as _};\n' : ''}use reqwest::{blocking::Client, Method};
use std::error::Error;

fn main() -> Result<(), Box<dyn Error>> {
    let client = Client::new();
    let mut request = client.request(
        Method::from_bytes(${rustRaw(method)}.as_bytes())?,
        ${rustRaw(url)},
    );
${Object.entries(headers).map(([name, value]) => `    request = request.header(${rustRaw(name)}, ${rustRaw(value)});`).join('\n')}${Object.keys(headers).length ? '\n' : ''}${body ? `    let payload = STANDARD.decode(${rustRaw(bodyBase64(body))})?;
    request = request.body(payload);
` : ''}    let response = request.send()?;
    let status = response.status();
    let text = response.text()?;
    println!("{} {}", status.as_u16(), text);
    Ok(())
}
`;

const cSnippet = ({ method, url, headers, body }: MaterializedRequest) => {
  const bytes = body ? bodyBytes(body) : undefined;
  const payload = bytes ? `    static const unsigned char payload[] = { ${bytes.byteLength ? Array.from(bytes, (byte) => `0x${byte.toString(16).padStart(2, '0')}`).join(', ') : '0x00'} };
` : '';
  const headerSetup = Object.entries(headers).map(([name, value]) => `    request_headers = curl_slist_append(request_headers, ${cString(`${name}: ${value}`)});`).join('\n');
  return `#include <curl/curl.h>
#include <stdio.h>

int main(void) {
    CURL *client = curl_easy_init();
    if (client == NULL) return 1;
${Object.keys(headers).length ? '    struct curl_slist *request_headers = NULL;\n' : ''}${payload}
    curl_easy_setopt(client, CURLOPT_CUSTOMREQUEST, ${cString(method)});
    curl_easy_setopt(client, CURLOPT_URL, ${cString(url)});
${headerSetup}${headerSetup ? '\n    curl_easy_setopt(client, CURLOPT_HTTPHEADER, request_headers);\n' : ''}${bytes ? `    curl_easy_setopt(client, CURLOPT_POSTFIELDS, payload);
    curl_easy_setopt(client, CURLOPT_POSTFIELDSIZE_LARGE, (curl_off_t)${bytes.byteLength});
` : ''}
    CURLcode result = curl_easy_perform(client);
    if (result != CURLE_OK) fprintf(stderr, "%s\\n", curl_easy_strerror(result));
${Object.keys(headers).length ? '    curl_slist_free_all(request_headers);\n' : ''}    curl_easy_cleanup(client);
    return result == CURLE_OK ? 0 : 1;
}`;
};

const clojureSnippet = ({ method, url, headers, body }: MaterializedRequest) => {
  const headerEntries = Object.entries(headers).map(([name, value]) => `${json(name)} ${json(value)}`).join(' ');
  return `(require '[clj-http.client :as client])
${body ? "(import '[java.util Base64])\n" : ''}
${body ? `(def payload (.decode (Base64/getDecoder) ${json(bodyBase64(body))}))\n` : ''}(def response
  (client/request
    {:method (keyword ${json(method.toLowerCase())})
     :url ${json(url)}
     :headers {${headerEntries}}${body ? '\n     :body payload' : ''}
     :as :text}))

(println (:status response) (:body response))`;
};

const crystalSnippet = ({ method, url, headers, body }: MaterializedRequest) => {
  const headerEntries = Object.entries(headers).map(([name, value]) => `  ${crystalString(name)} => ${crystalString(value)},`).join('\n');
  return `require "http/client"
${body ? 'require "base64"\n' : ''}

url = ${crystalString(url)}
headers = HTTP::Headers{${headerEntries ? `\n${headerEntries}\n` : ''}}
${body ? `payload = Base64.decode(${json(bodyBase64(body))})\n` : ''}
response = HTTP::Client.exec(${crystalString(method)}, url, headers: headers${body ? ', body: payload' : ''})
puts "#{response.status_code} #{response.body}"`;
};

const http11Snippet = ({ method, url, headers, body }: MaterializedRequest) => {
  let requestTarget = url;
  let host = '';
  try {
    const parsed = new URL(url);
    requestTarget = `${parsed.pathname || '/'}${parsed.search}`;
    host = parsed.host;
  } catch {}
  const lines = [`${method} ${requestTarget} HTTP/1.1`, ...Object.entries(headers).map(([name, value]) => `${name}: ${value}`)];
  if (host && !Object.keys(headers).some((name) => name.toLowerCase() === 'host')) lines.push(`Host: ${host}`);
  if (body && !Object.keys(headers).some((name) => name.toLowerCase() === 'content-length')) lines.push(`Content-Length: ${bodyBytes(body).byteLength}`);
  const renderedBody = body?.kind === 'bytes'
    ? `[Brunomnia binary body Base64; decode before sending]\r\n${body.dataBase64}`
    : body?.value ?? '';
  return `${lines.join('\r\n')}\r\n\r\n${renderedBody}`;
};

const kotlinSnippet = ({ method, url, headers, body }: MaterializedRequest) => {
  const needsRequestBody = body !== undefined || !['GET', 'HEAD'].includes(method.toUpperCase());
  const requestBody = body
    ? `val payload = Base64.getDecoder().decode(${kotlinString(bodyBase64(body))})
val requestBody = payload.toRequestBody(null)
`
    : needsRequestBody
      ? 'val requestBody = ByteArray(0).toRequestBody(null)\n'
      : '';
  return `${body ? 'import java.util.Base64\n' : ''}import okhttp3.OkHttpClient
import okhttp3.Request
${needsRequestBody ? 'import okhttp3.RequestBody.Companion.toRequestBody\n' : ''}
val client = OkHttpClient()
${requestBody}
val request = Request.Builder()
    .url(${kotlinString(url)})
    .method(${kotlinString(method)}, ${needsRequestBody ? 'requestBody' : 'null'})
${Object.entries(headers).map(([name, value]) => `    .addHeader(${kotlinString(name)}, ${kotlinString(value)})`).join('\n')}${Object.keys(headers).length ? '\n' : ''}    .build()

client.newCall(request).execute().use { response ->
    println("${'$'}{response.code} ${'$'}{response.body?.string().orEmpty()}")
}`;
};

const objcSnippet = ({ method, url, headers, body }: MaterializedRequest) => {
  const headerEntries = Object.entries(headers).map(([name, value]) => `            ${objcString(name)}: ${objcString(value)},`).join('\n');
  return `#import <Foundation/Foundation.h>

int main(void) {
    @autoreleasepool {
        NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:[NSURL URLWithString:${objcString(url)}]];
        [request setHTTPMethod:${objcString(method)}];
${headerEntries ? `        NSDictionary<NSString *, NSString *> *headers = @{\n${headerEntries}\n        };\n        [request setAllHTTPHeaderFields:headers];\n` : ''}${body ? `        NSData *payload = [[NSData alloc] initWithBase64EncodedString:${objcString(bodyBase64(body))} options:0];
        [request setHTTPBody:payload];
` : ''}        dispatch_semaphore_t semaphore = dispatch_semaphore_create(0);
        NSURLSessionDataTask *task = [[NSURLSession sharedSession] dataTaskWithRequest:request completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
            if (error != nil) {
                NSLog(@"%@", error);
            } else {
                NSHTTPURLResponse *httpResponse = (NSHTTPURLResponse *)response;
                NSString *text = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
                NSLog(@"%ld %@", (long)httpResponse.statusCode, text ?: @"");
            }
            dispatch_semaphore_signal(semaphore);
        }];
        [task resume];
        dispatch_semaphore_wait(semaphore, DISPATCH_TIME_FOREVER);
    }
    return 0;
}`;
};

const ocamlSnippet = ({ method, url, headers, body }: MaterializedRequest) => {
  const headerEntries = Object.entries(headers).map(([name, value]) => `      (${ocamlString(name)}, ${ocamlString(value)});`).join('\n');
  return `open Lwt.Infix

let () =
  Lwt_main.run (
    let uri = Uri.of_string ${ocamlString(url)} in
    let headers = Cohttp.Header.of_list [${headerEntries ? `\n${headerEntries}\n    ` : ''}] in
${body ? `    let body = Cohttp_lwt.Body.of_string ${ocamlBytes(bodyBytes(body))} in
` : ''}    Cohttp_lwt_unix.Client.call ~headers ${body ? '~body ' : ''}(Cohttp.Code.method_of_string ${ocamlString(method)}) uri
    >>= fun (response, response_body) ->
    Cohttp_lwt.Body.to_string response_body >|= fun text ->
    Printf.printf "%d %s\\n" (Cohttp.Response.status response |> Cohttp.Code.code_of_status) text
  )`;
};

const powershellSnippet = ({ method, url, headers, body }: MaterializedRequest) => {
  const headerEntries = Object.entries(headers).map(([name, value]) => `    ${powershellString(name)} = ${powershellString(value)}`).join('\n');
  const standardMethod = ['DEFAULT', 'DELETE', 'GET', 'HEAD', 'MERGE', 'OPTIONS', 'PATCH', 'POST', 'PUT', 'TRACE'].includes(method.toUpperCase());
  return `${headerEntries ? `$headers = @{\n${headerEntries}\n}\n` : ''}${body ? `$payload = [Convert]::FromBase64String(${powershellString(bodyBase64(body))})\n` : ''}$parameters = @{
    Uri = ${powershellString(url)}
${headerEntries ? '    Headers = $headers\n' : ''}${body ? '    Body = $payload\n' : ''}}
$parameters[${powershellString(standardMethod ? 'Method' : 'CustomMethod')}] = ${powershellString(method)}

$response = Invoke-WebRequest @parameters
Write-Output "$($response.StatusCode) $($response.Content)"`;
};

const rSnippet = ({ method, url, headers, body }: MaterializedRequest) => {
  const headerEntries = Object.entries(headers).map(([name, value]) => `${json(name)} = ${json(value)}`).join(', ');
  return `library(httr)

url <- ${json(url)}
${headerEntries ? `headers <- add_headers(.headers = c(${headerEntries}))\n` : ''}${body ? `payload <- jsonlite::base64_dec(${json(bodyBase64(body))})\n` : ''}
response <- VERB(${json(method)}, url${headerEntries ? ', headers' : ''}${body ? ', body = payload, encode = "raw"' : ''})
cat(status_code(response), content(response, "text", encoding = "UTF-8"))`;
};

export const generateClientCode = (target: ClientCodeTarget, request: ApiRequest, variables: Record<string, string>): ClientCodeSnippet => {
  const prepared = materialize(request, variables);
  const generators: Record<ClientCodeTarget, (input: MaterializedRequest) => string> = {
    curl: curlSnippet,
    'javascript-fetch': javascriptSnippet,
    'node-native': nodeSnippet,
    'python-requests': pythonSnippet,
    'php-curl': phpSnippet,
    'ruby-native': rubySnippet,
    go: goSnippet,
    'java-httpclient': javaSnippet,
    'csharp-httpclient': csharpSnippet,
    'swift-urlsession': swiftSnippet,
    'rust-reqwest': rustSnippet,
    'c-libcurl': cSnippet,
    'clojure-clj-http': clojureSnippet,
    'crystal-native': crystalSnippet,
    'http-1.1': http11Snippet,
    'kotlin-okhttp': kotlinSnippet,
    'objc-nsurlsession': objcSnippet,
    'ocaml-cohttp': ocamlSnippet,
    'powershell-webrequest': powershellSnippet,
    'r-httr': rSnippet,
  };
  const targetWarnings = target === 'http-1.1' && prepared.body?.kind === 'bytes'
    ? ['Raw HTTP/1.1 cannot carry arbitrary bytes in a text preview; the exact body is shown as Base64 and must be decoded before sending.']
    : [];
  return { code: generators[target](prepared), warnings: [...prepared.warnings, ...targetWarnings] };
};
