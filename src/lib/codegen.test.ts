import { describe, expect, it } from 'vitest';
import { createBlankRequest } from '../data/seed';
import { clientCodeTargets, generateClientCode } from './codegen';

describe('local client code generation', () => {
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
});
