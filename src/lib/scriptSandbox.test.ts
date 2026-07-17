import { describe, expect, it } from 'vitest';
import { createBlankRequest } from '../data/seed';
import { buildScriptWorkerSource, normalizeScriptSubrequest, validateScriptSource } from './scriptSandbox';

describe('script sandbox source validation', () => {
  it('allows ordinary request and test scripts', () => {
    expect(() => validateScriptSource("insomnia.test('ok', () => expect(true).toBe(true));")).not.toThrow();
    expect(() => new Function(buildScriptWorkerSource("insomnia.environment.set('ready', true);"))).not.toThrow();
    expect(() => new Function(buildScriptWorkerSource("insomnia.test('chai', () => expect(insomnia.response.status).to.be.above(199)); insomnia.request.setHeader('X-Test', 'yes'); insomnia.request.url.addQueryParams([{ name: 'page', value: 2 }]);"))).not.toThrow();
    expect(buildScriptWorkerSource("await insomnia.sendRequest('https://example.com');")).toContain('secondary-request limit');
    expect(buildScriptWorkerSource("insomnia.vault.get('token');")).toContain('Script vault access is disabled');
    const boundary = buildScriptWorkerSource("console.log('bounded');");
    expect(boundary).toContain('const state = undefined');
    expect(boundary).toContain('const hostPostMessage = undefined');
    expect(boundary).toContain('Script result exceeds the 20 MB bridge limit');
  });

  it('rejects dynamic module imports, including comment-separated calls', () => {
    expect(() => validateScriptSource("import('https://example.com/module.js')")).toThrow(/Module imports/);
    expect(() => validateScriptSource("import /* hidden */ ('https://example.com/module.js')")).toThrow(/Module imports/);
    expect(() => validateScriptSource("eval('globalThis')")).toThrow(/eval/);
  });

  it('normalizes bounded secondary HTTP and GraphQL request inputs', () => {
    const source = createBlankRequest('source');
    source.transport.timeoutMs = 90_000;
    const http = normalizeScriptSubrequest({
      url: 'https://api.example.com/items',
      method: 'post',
      headers: { Accept: 'application/json', 'X-Repeat': ['one', 'two'] },
      body: { mode: 'urlencoded', urlencoded: [{ key: 'name', value: 'Ada' }] },
    }, source);
    expect(http).toMatchObject({ method: 'POST', bodyMode: 'form-urlencoded', transport: { timeoutMs: 10_000 }, preRequestScript: '', tests: '' });
    expect(http.headers.map((header) => [header.name, header.value])).toEqual([['Accept', 'application/json'], ['X-Repeat', 'one'], ['X-Repeat', 'two']]);
    expect(http.formBody[0]).toMatchObject({ name: 'name', value: 'Ada' });

    const graphql = normalizeScriptSubrequest({ url: 'https://api.example.com/graphql', body: { mode: 'graphql', graphql: { query: '{ viewer { id } }', variables: { active: true } } } }, source);
    expect(graphql).toMatchObject({ protocol: 'graphql', method: 'POST', graphql: { query: '{ viewer { id } }', variables: '{\n  "active": true\n}' } });
  });

  it('rejects ambient schemes, file-backed bodies, and malformed methods', () => {
    const source = createBlankRequest('source');
    expect(() => normalizeScriptSubrequest('file:///tmp/token', source)).toThrow(/http:\/\//);
    expect(() => normalizeScriptSubrequest({ url: 'https://example.com', method: 'GET\r\nX-Evil: yes' }, source)).toThrow(/HTTP token/);
    expect(() => normalizeScriptSubrequest({ url: 'https://example.com', body: { mode: 'file', file: '/tmp/secret' } }, source)).toThrow(/cannot read file paths/);
  });
});
