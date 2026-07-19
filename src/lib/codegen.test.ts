import { describe, expect, it } from 'vitest';
import { createBlankRequest } from '../data/seed';
import { clientCodeFamilies, clientCodeTargets, generateClientCode, resolveClientCodeSelection } from './codegen';

const javascriptInlineBytes = (code: string) => {
  const encoded = code.match(/atob\("([A-Za-z0-9+/=]+)"\)/)?.[1];
  if (!encoded) throw new Error('Generated JavaScript does not contain an inline Base64 body.');
  return { bytes: Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0)), encoded };
};

const cInlineBytes = (bytes: Uint8Array) => Array.from(bytes, (byte) => `0x${byte.toString(16).padStart(2, '0')}`).join(', ');
const ocamlInlineBytes = (bytes: Uint8Array) => `"${Array.from(bytes, (byte) => {
  if (byte === 34) return '\\"';
  if (byte === 92) return '\\\\';
  if (byte >= 32 && byte <= 126) return String.fromCharCode(byte);
  return `\\${byte.toString(10).padStart(3, '0')}`;
}).join('')}"`;

describe('local client code generation', () => {
  it('exposes the exact pinned target and client registry order', () => {
    expect(clientCodeFamilies.map((family) => [family.id, family.defaultClient, family.clients.map((client) => client.key)])).toEqual([
      ['c', 'libcurl', ['libcurl']],
      ['clojure', 'clj_http', ['clj_http']],
      ['crystal', 'native', ['native']],
      ['csharp', 'restsharp', ['httpclient', 'restsharp']],
      ['go', 'native', ['native']],
      ['http', 'http1.1', ['http1.1']],
      ['java', 'unirest', ['asynchttp', 'nethttp', 'okhttp', 'unirest']],
      ['javascript', 'xhr', ['xhr', 'axios', 'fetch', 'jquery']],
      ['kotlin', 'okhttp', ['okhttp']],
      ['node', 'native', ['native', 'request', 'unirest', 'axios', 'fetch']],
      ['objc', 'nsurlsession', ['nsurlsession']],
      ['ocaml', 'cohttp', ['cohttp']],
      ['php', 'curl', ['curl', 'guzzle', 'http1', 'http2']],
      ['powershell', 'webrequest', ['webrequest', 'restmethod']],
      ['python', 'python3', ['python3', 'requests']],
      ['r', 'httr', ['httr']],
      ['ruby', 'native', ['native', 'faraday']],
      ['rust', 'reqwest', ['reqwest']],
      ['shell', 'curl', ['curl', 'httpie', 'wget']],
      ['swift', 'nsurlsession', ['nsurlsession']],
    ]);
    expect(clientCodeTargets.map((target) => target.id)).toEqual([
      'c-libcurl',
      'clojure-clj-http',
      'crystal-native',
      'csharp-httpclient',
      'csharp-restsharp',
      'go',
      'http-1.1',
      'java-asynchttp',
      'java-httpclient',
      'java-okhttp',
      'java-unirest',
      'javascript-xhr',
      'javascript-axios',
      'javascript-fetch',
      'javascript-jquery',
      'kotlin-okhttp',
      'node-native',
      'node-request',
      'node-unirest',
      'node-axios',
      'node-fetch',
      'objc-nsurlsession',
      'ocaml-cohttp',
      'php-curl',
      'php-guzzle',
      'php-http1',
      'php-http2',
      'powershell-webrequest',
      'powershell-restmethod',
      'python-python3',
      'python-requests',
      'r-httr',
      'ruby-native',
      'ruby-faraday',
      'rust-reqwest',
      'curl',
      'shell-httpie',
      'shell-wget',
      'swift-urlsession',
    ]);
  });

  it('resolves saved target and client identities with pinned defaults', () => {
    expect(resolveClientCodeSelection()).toEqual({ familyId: 'shell', clientKey: 'curl', target: 'curl' });
    expect(resolveClientCodeSelection('java')).toEqual({ familyId: 'java', clientKey: 'unirest', target: 'java-unirest' });
    expect(resolveClientCodeSelection('javascript', 'axios')).toEqual({ familyId: 'javascript', clientKey: 'axios', target: 'javascript-axios' });
    expect(resolveClientCodeSelection('python', 'missing')).toEqual({ familyId: 'python', clientKey: 'python3', target: 'python-python3' });
    expect(resolveClientCodeSelection('http')).toEqual({ familyId: 'http', clientKey: 'http1.1', target: 'http-1.1' });
    expect(resolveClientCodeSelection('missing', 'missing')).toEqual({ familyId: 'shell', clientKey: 'curl', target: 'curl' });
  });

  it('generates every supported target from the materialized request', () => {
    const request = createBlankRequest('codegen');
    request.method = 'PROPFIND';
    request.url = '{{ baseUrl }}/files/{path}';
    request.pathParams = [{ id: 'path', name: 'path', value: 'team docs', enabled: true }];
    request.params = [{ id: 'depth', name: 'depth', value: '1', enabled: true }];
    request.headers = [{ id: 'accept', name: 'Accept', value: 'application/json', enabled: true }];
    for (const target of clientCodeTargets) {
      const snippet = generateClientCode(target.id, request, { baseUrl: 'https://api.example.com' });
      expect(snippet.code.toUpperCase()).toContain('PROPFIND');
      if (target.id === 'http-1.1') expect(snippet.code).toContain('/files/team%20docs?depth=1 HTTP/1.1');
      else expect(snippet.code).toContain('https://api.example.com/files/team%20docs?depth=1');
      if (target.id === 'csharp-restsharp') expect(snippet.warnings).toContain('RestSharp cannot run PROPFIND requests.');
      else if (target.id === 'ruby-faraday') expect(snippet.warnings).toContain('Faraday cannot run PROPFIND requests.');
      else expect(snippet.warnings).toEqual([]);
    }
  });

  it('materializes auth and bodies while naming unsafe omissions', () => {
    const request = createBlankRequest('warnings');
    request.method = 'POST';
    request.url = 'https://api.example.com/{missing}/{other}';
    request.pathParams = [{ id: 'missing', name: 'missing', value: '{{ secret }}', enabled: true }];
    request.auth = { ...request.auth, type: 'iam', awsAccessKeyId: 'key', awsSecretAccessKey: 'secret' };
    request.bodyMode = 'multipart';
    request.multipartBody = [{ id: 'upload', name: 'upload', value: '', enabled: true, kind: 'file' }];
    const snippet = generateClientCode('curl', request, {});
    expect(snippet.warnings).toEqual(expect.arrayContaining([
      expect.stringContaining('Multipart'),
      expect.stringContaining('IAM'),
      expect.stringContaining('path parameters'),
      expect.stringContaining('unresolved template tag'),
    ]));
  });

  it('adds query API keys and a JSON content type', () => {
    const request = createBlankRequest('api-key');
    request.method = 'POST';
    request.url = 'https://api.example.com/items';
    request.headers = [];
    request.bodyMode = 'json';
    request.body = '{"ok":true}';
    request.auth = { ...request.auth, type: 'api-key', apiKeyLocation: 'query', apiKeyName: 'key', apiKeyValue: 'secret' };
    const snippet = generateClientCode('javascript-fetch', request, {});
    expect(snippet.code).toContain('https://api.example.com/items?key=secret');
    expect(snippet.code).toContain('Content-Type');
  });

  it('keeps body template tags literal when rendering is disabled', () => {
    const request = createBlankRequest('literal-body');
    request.method = 'POST';
    request.bodyMode = 'text';
    request.body = '{{ payload }}';
    request.renderBodyTemplates = false;
    const snippet = generateClientCode('curl', request, { payload: 'resolved' });
    expect(snippet.code).toContain("--data-raw '{{ payload }}'");
    expect(snippet.warnings).toContain('Unresolved template tags remain in the snippet.');
  });

  it('embeds one exact multipart payload across every target', () => {
    const request = createBlankRequest('multipart-codegen');
    request.method = 'POST';
    request.url = 'https://api.example.com/upload';
    request.headers = [{ id: 'stale', name: 'Content-Type', value: 'multipart/form-data; boundary=stale', enabled: true }];
    request.bodyMode = 'multipart';
    request.multipartBody = [
      { id: 'note', name: '{{ textField }}', value: 'hello {{ name }}', enabled: true, kind: 'text', contentType: 'text/plain; charset=utf-8' },
      {
        id: 'upload',
        name: 'attachment',
        value: '',
        enabled: true,
        kind: 'file',
        contentType: 'application/x-custom',
        fileName: 'renamed-{{ suffix }}.bin',
        file: { fileName: 'source.bin', mimeType: 'application/octet-stream', dataBase64: 'AP8KDQ==' },
      },
      { id: 'duplicate', name: '{{ textField }}', value: 'second', enabled: true, kind: 'text' },
      { id: 'collision', name: 'boundary', value: '--------------------------brunomnia-generated-0', enabled: true, kind: 'text' },
      { id: 'disabled', name: 'ignored', value: 'ignored', enabled: false, kind: 'text' },
    ];
    const variables = { name: 'world', suffix: 'copy', textField: 'note' };
    const javascript = generateClientCode('javascript-fetch', request, variables);
    const { bytes, encoded } = javascriptInlineBytes(javascript.code);
    const body = new TextDecoder().decode(bytes);
    const boundary = javascript.code.match(/multipart\/form-data; boundary=([^"\\]+)/)?.[1];

    expect(javascript.warnings).toEqual([]);
    expect(boundary).toBe('--------------------------brunomnia-generated-1');
    expect(body).toContain('Content-Disposition: form-data; name="note"\r\nContent-Type: text/plain; charset=utf-8\r\n\r\nhello world\r\n');
    expect(body).toContain('Content-Disposition: form-data; name="attachment"; filename="renamed-copy.bin"\r\nContent-Type: application/x-custom\r\n\r\n');
    expect(body).toContain('Content-Disposition: form-data; name="note"\r\n\r\nsecond\r\n');
    expect(body).not.toContain('ignored');
    expect(body.endsWith(`--${boundary}--\r\n`)).toBe(true);
    expect(Array.from(bytes)).toContain(255);

    for (const target of clientCodeTargets) {
      const snippet = generateClientCode(target.id, request, variables);
      if (target.id === 'http-1.1') expect(snippet.warnings).toContain('Raw HTTP/1.1 cannot carry arbitrary bytes in a text preview; the exact body is shown as Base64 and must be decoded before sending.');
      else expect(snippet.warnings).toEqual([]);
      if (target.id === 'c-libcurl') expect(snippet.code).toContain(cInlineBytes(bytes));
      else if (target.id === 'ocaml-cohttp') expect(snippet.code).toContain(ocamlInlineBytes(bytes));
      else expect(snippet.code).toContain(encoded);
      expect(snippet.code).toContain(`multipart/form-data; boundary=${boundary}`);
      expect(snippet.code).not.toContain('boundary=stale');
    }
  });

  it('embeds standalone binary bytes and their default content type', () => {
    const request = createBlankRequest('binary-codegen');
    request.method = 'PUT';
    request.url = 'https://api.example.com/archive';
    request.headers = [];
    request.bodyMode = 'binary';
    request.binaryBody = { fileName: 'archive.bin', mimeType: 'application/x-archive', dataBase64: 'AAEC/w==' };
    const binaryBytes = Uint8Array.from([0, 1, 2, 255]);

    for (const target of clientCodeTargets) {
      const snippet = generateClientCode(target.id, request, {});
      if (target.id === 'http-1.1') expect(snippet.warnings).toContain('Raw HTTP/1.1 cannot carry arbitrary bytes in a text preview; the exact body is shown as Base64 and must be decoded before sending.');
      else expect(snippet.warnings).toEqual([]);
      if (target.id === 'c-libcurl') expect(snippet.code).toContain(cInlineBytes(binaryBytes));
      else if (target.id === 'ocaml-cohttp') expect(snippet.code).toContain(ocamlInlineBytes(binaryBytes));
      else expect(snippet.code).toContain('AAEC/w==');
      expect(snippet.code).toContain('application/x-archive');
    }
  });

  it('renders the added default clients with exact UTF-8 body bytes and escaped metadata', () => {
    const request = createBlankRequest('expanded-codegen');
    request.method = 'REPORT';
    request.url = 'https://api.example.com/reports?scope=team%20docs';
    request.headers = [{ id: 'quoted', name: 'X-Quoted', value: "one'\\two", enabled: true }];
    request.bodyMode = 'text';
    request.body = 'line one\nπ and \u0000';
    const encoded = 'bGluZSBvbmUKz4AgYW5kIAA=';
    const markers = {
      'node-native': ["import https from 'node:https'", 'Buffer.from', 'request.end(payload)', `"X-Quoted": "one'\\\\two"`],
      'php-curl': ['CURLOPT_CUSTOMREQUEST', 'CURLOPT_POSTFIELDS', encoded, "X-Quoted: one\\'\\\\two"],
      'ruby-native': ["require 'net/http'", 'Net::HTTPGenericRequest', encoded, "'X-Quoted' => 'one\\'\\\\two'"],
      'swift-urlsession': ['URLSession.shared.dataTask', 'Data(base64Encoded:', encoded, `"X-Quoted": "one'\\\\two"`],
      'rust-reqwest': ['reqwest::{blocking::Client, Method}', 'STANDARD.decode', encoded, "r\"one'\\two\""],
    } as const;

    for (const [target, expected] of Object.entries(markers)) {
      const snippet = generateClientCode(target as keyof typeof markers, request, {});
      expect(snippet.warnings).toEqual([]);
      expect(snippet.code).toContain('REPORT');
      expect(snippet.code).toContain('https://api.example.com/reports?scope=team%20docs');
      expected.forEach((marker) => expect(snippet.code).toContain(marker));
    }
  });

  it('renders every remaining target-family default with exact UTF-8 bytes and safe literals', () => {
    const request = createBlankRequest('complete-target-families');
    request.method = 'REPORT';
    request.url = 'https://api.example.com/reports?scope=team%20docs';
    request.headers = [{ id: 'quoted', name: 'X-Quoted', value: "one'\\two", enabled: true }];
    request.bodyMode = 'text';
    request.body = 'line one\nπ and \u0000';
    const encoded = 'bGluZSBvbmUKz4AgYW5kIAA=';
    const markers = {
      'c-libcurl': ['#include <curl/curl.h>', 'CURLOPT_POSTFIELDSIZE_LARGE', '0xcf, 0x80'],
      'clojure-clj-http': ["require '[clj-http.client :as client]", '(keyword "report")', encoded, `"X-Quoted" "one'\\\\two"`],
      'crystal-native': ['HTTP::Client.exec', 'Base64.decode', encoded, `"X-Quoted" => "one'\\\\two"`],
      'http-1.1': ['REPORT /reports?scope=team%20docs HTTP/1.1\r\n', 'Host: api.example.com\r\n', 'Content-Length: 17\r\n', request.body],
      'kotlin-okhttp': ['OkHttpClient()', '.method("REPORT", requestBody)', encoded, `"X-Quoted", "one'\\\\two"`],
      'objc-nsurlsession': ['#import <Foundation/Foundation.h>', 'dataTaskWithRequest', encoded, `@"X-Quoted": @"one'\\\\two"`],
      'ocaml-cohttp': ['Cohttp_lwt_unix.Client.call', 'Cohttp.Code.method_of_string', '\\207\\128', `("X-Quoted", "one'\\\\two")`],
      'powershell-webrequest': ['Invoke-WebRequest @parameters', "'CustomMethod'", encoded, "'X-Quoted' = 'one''\\two'"],
      'r-httr': ['library(httr)', 'VERB("REPORT"', encoded, `"X-Quoted" = "one'\\\\two"`],
    } as const;

    for (const [target, expected] of Object.entries(markers)) {
      const snippet = generateClientCode(target as keyof typeof markers, request, {});
      expect(snippet.warnings).toEqual([]);
      expected.forEach((marker) => expect(snippet.code).toContain(marker));
    }
  });

  it('renders every alternate client with the shared exact payload contract', () => {
    const request = createBlankRequest('alternate-codegen-clients');
    request.method = 'POST';
    request.url = 'https://api.example.com/reports?scope=team%20docs';
    request.headers = [{ id: 'quoted', name: 'X-Quoted', value: "one'\\two", enabled: true }];
    request.bodyMode = 'text';
    request.body = 'line one\nπ and \u0000';
    const encoded = 'bGluZSBvbmUKz4AgYW5kIAA=';
    const markers = {
      'csharp-restsharp': ['using RestSharp;', 'Method.Post', 'Convert.FromBase64String'],
      'java-asynchttp': ['DefaultAsyncHttpClient', 'request.setBody', 'Base64.getDecoder()'],
      'java-okhttp': ['okhttp3.OkHttpClient', 'RequestBody.create', 'Base64.getDecoder()'],
      'java-unirest': ['kong.unirest.Unirest', 'Unirest.request', 'Base64.getDecoder()'],
      'javascript-xhr': ['XMLHttpRequest', 'xhr.send(payload)', 'atob('],
      'javascript-axios': ["import axios from 'axios'", 'axios.request', 'atob('],
      'javascript-jquery': ['$.ajax', 'processData: false', 'atob('],
      'node-request': ["import request from 'request'", 'Buffer.from', 'body: payload'],
      'node-unirest': ["import unirest from 'unirest'", 'request.send(payload)', 'Buffer.from'],
      'node-axios': ["import axios from 'axios'", 'axios.request', 'Buffer.from'],
      'node-fetch': ["import fetch from 'node-fetch'", 'body: payload', 'Buffer.from'],
      'php-guzzle': ['GuzzleHttp\\Client', "'body' => $payload", 'base64_decode'],
      'php-http1': ['new HttpRequest()', '$request->setBody($payload)', 'base64_decode'],
      'php-http2': ['new http\\Client()', '$body->append($payload)', 'base64_decode'],
      'powershell-restmethod': ['Invoke-RestMethod @parameters', '[Convert]::FromBase64String'],
      'python-python3': ['import http.client', 'base64.b64decode', 'connection.request'],
      'ruby-faraday': ["require 'faraday'", 'Base64.strict_decode64', 'connection.run_request'],
      'shell-httpie': ["http 'POST'", '"$payload_file"', 'base64 --decode'],
      'shell-wget': ['wget --quiet', '--body-file "$payload_file"', 'base64 --decode'],
    } as const;

    for (const [target, expected] of Object.entries(markers)) {
      const snippet = generateClientCode(target as keyof typeof markers, request, {});
      expect(snippet.warnings).toEqual([]);
      expect(snippet.code.toUpperCase()).toContain('POST');
      expect(snippet.code).toContain(request.url);
      expect(snippet.code).toContain('X-Quoted');
      expect(snippet.code).toContain(encoded);
      expected.forEach((marker) => expect(snippet.code).toContain(marker));
    }
  });

  it('bounds invalid saved file data with explicit warnings', () => {
    const multipart = createBlankRequest('invalid-multipart');
    multipart.method = 'POST';
    multipart.bodyMode = 'multipart';
    multipart.multipartBody = [
      { id: 'injected', name: 'upload\r\nInjected: yes', value: 'safe', enabled: true, kind: 'text' },
      {
        id: 'broken',
        name: 'broken',
        value: '',
        enabled: true,
        kind: 'file',
        file: { fileName: 'broken.bin', mimeType: 'application/octet-stream', dataBase64: 'not base64!' },
      },
    ];
    const multipartSnippet = generateClientCode('javascript-fetch', multipart, {});
    expect(multipartSnippet.warnings).toEqual(expect.arrayContaining([
      expect.stringContaining('line breaks'),
      expect.stringContaining('not valid Base64'),
    ]));
    const materialized = new TextDecoder().decode(javascriptInlineBytes(multipartSnippet.code).bytes);
    expect(materialized).toContain('name="upload Injected: yes"');
    expect(materialized).not.toContain('\r\nInjected: yes');

    const binary = createBlankRequest('invalid-binary');
    binary.method = 'POST';
    binary.bodyMode = 'binary';
    binary.binaryBody = { fileName: 'broken.bin', mimeType: 'application/octet-stream', dataBase64: '!' };
    expect(generateClientCode('curl', binary, {}).warnings).toContain('Binary payload bytes were omitted because the saved file is not valid Base64.');
  });
});
