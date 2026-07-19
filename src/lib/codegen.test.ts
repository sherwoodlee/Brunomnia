import { describe, expect, it } from 'vitest';
import { createBlankRequest } from '../data/seed';
import { clientCodeTargets, generateClientCode } from './codegen';

const javascriptInlineBytes = (code: string) => {
  const encoded = code.match(/atob\("([A-Za-z0-9+/=]+)"\)/)?.[1];
  if (!encoded) throw new Error('Generated JavaScript does not contain an inline Base64 body.');
  return { bytes: Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0)), encoded };
};

describe('local client code generation', () => {
  it('exposes the expanded pinned target set in stable order', () => {
    expect(clientCodeTargets.map((target) => target.id)).toEqual([
      'curl',
      'javascript-fetch',
      'node-native',
      'python-requests',
      'php-curl',
      'ruby-native',
      'go',
      'java-httpclient',
      'csharp-httpclient',
      'swift-urlsession',
      'rust-reqwest',
    ]);
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
      expect(snippet.code).toContain('PROPFIND');
      expect(snippet.code).toContain('https://api.example.com/files/team%20docs?depth=1');
      expect(snippet.warnings).toEqual([]);
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
      expect(snippet.warnings).toEqual([]);
      expect(snippet.code).toContain(encoded);
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

    for (const target of clientCodeTargets) {
      const snippet = generateClientCode(target.id, request, {});
      expect(snippet.warnings).toEqual([]);
      expect(snippet.code).toContain('AAEC/w==');
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
