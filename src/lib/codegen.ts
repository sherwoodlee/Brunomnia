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
  body?: string;
  warnings: string[];
};

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

const materializeBody = (request: ApiRequest, variables: Record<string, string>, warnings: string[]): string | undefined => {
  if (request.method === 'GET' || request.method === 'HEAD') return undefined;
  if (request.protocol === 'graphql') {
    let graphqlVariables: unknown = request.graphql.variables;
    try { graphqlVariables = JSON.parse(resolveTemplate(request.graphql.variables || '{}', variables)); } catch { warnings.push('GraphQL variables were emitted as text because they are not valid JSON.'); }
    return JSON.stringify({
      query: request.graphql.query,
      variables: graphqlVariables,
      ...(request.graphql.operationName ? { operationName: request.graphql.operationName } : {}),
    });
  }
  if (request.bodyMode === 'none') return undefined;
  if (request.bodyMode === 'json' || request.bodyMode === 'text') return resolveTemplate(request.body, variables);
  if (request.bodyMode === 'form-urlencoded') {
    const body = new URLSearchParams();
    request.formBody.filter((row) => row.enabled && row.name).forEach((row) => body.append(resolveTemplate(row.name, variables), resolveTemplate(row.value, variables)));
    return body.toString();
  }
  if (request.bodyMode === 'multipart') warnings.push('Multipart parts are not embedded in generated snippets yet; add text and file parts in the target client.');
  if (request.bodyMode === 'binary') warnings.push('Binary payload bytes are intentionally omitted from generated snippets; attach the local file in the target client.');
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
  if (!request.auth.disabled && !['none', 'bearer', 'basic', 'api-key', 'oauth2'].includes(request.auth.type)) {
    warnings.push(`${request.auth.type.toUpperCase()} signing is runtime-specific and is not reproduced in the generated snippet.`);
  }
  if (/{{\s*[^{}]+\s*}}/.test(`${url}\n${JSON.stringify(headers)}\n${body ?? ''}`)) warnings.push('Unresolved template tags remain in the snippet.');
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
  if (body !== undefined) parts.push(`  --data-raw ${shell(body)}`);
  return parts.join(' \\\n');
};

const javascriptSnippet = ({ method, url, headers, body }: MaterializedRequest) => `const response = await fetch(${json(url)}, {
  method: ${json(method)},
  headers: ${prettyJson(headers)}${body === undefined ? '' : `,\n  body: ${json(body)}`}
});

const data = await response.text();
console.log(response.status, data);`;

const pythonSnippet = ({ method, url, headers, body }: MaterializedRequest) => `import requests

response = requests.request(
    ${json(method)},
    ${json(url)},
    headers=${prettyJson(headers).replace(/^/gm, '    ').trimStart()}${body === undefined ? '' : `,\n    data=${json(body)}`},
    timeout=30,
)

print(response.status_code, response.text)`;

const goSnippet = ({ method, url, headers, body }: MaterializedRequest) => `package main

import (
	"fmt"
	"io"
	"net/http"
${body === undefined ? '' : '\t"strings"\n'}
)

func main() {
	req, err := http.NewRequest(${json(method)}, ${json(url)}, ${body === undefined ? 'nil' : `strings.NewReader(${json(body)})`})
	if err != nil { panic(err) }
${Object.entries(headers).map(([name, value]) => `\treq.Header.Add(${json(name)}, ${json(value)})`).join('\n')}
	response, err := http.DefaultClient.Do(req)
	if err != nil { panic(err) }
	defer response.Body.Close()
	payload, err := io.ReadAll(response.Body)
	if err != nil { panic(err) }
	fmt.Println(response.StatusCode, string(payload))
}`;

const javaSnippet = ({ method, url, headers, body }: MaterializedRequest) => `import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

var request = HttpRequest.newBuilder(URI.create(${json(url)}))
    .method(${json(method)}, ${body === undefined ? 'HttpRequest.BodyPublishers.noBody()' : `HttpRequest.BodyPublishers.ofString(${json(body)})`})
${Object.entries(headers).map(([name, value]) => `    .header(${json(name)}, ${json(value)})`).join('\n')}
    .build();
var response = HttpClient.newHttpClient().send(request, HttpResponse.BodyHandlers.ofString());
System.out.println(response.statusCode() + " " + response.body());`;

const csharpSnippet = ({ method, url, headers, body }: MaterializedRequest) => `using System;
using System.Net.Http;

using var client = new HttpClient();
using var request = new HttpRequestMessage(new HttpMethod(${json(method)}), ${json(url)});
${body === undefined ? '' : `request.Content = new StringContent(${json(body)});\n`}${Object.entries(headers).map(([name, value]) => `if (!request.Headers.TryAddWithoutValidation(${json(name)}, ${json(value)})) request.Content?.Headers.TryAddWithoutValidation(${json(name)}, ${json(value)});`).join('\n')}
using var response = await client.SendAsync(request);
Console.WriteLine($"{(int)response.StatusCode} {await response.Content.ReadAsStringAsync()}");`;

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
