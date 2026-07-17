import { describe, expect, it } from 'vitest';
import { runInNewContext } from 'node:vm';
import { createBlankRequest } from '../data/seed';
import { applyScriptSubresponse, buildScriptWorkerSource, hydrateScriptFileReferences, normalizeScriptSubrequest, validateScriptSource } from './scriptSandbox';

describe('script sandbox source validation', () => {
  const runWorkerSource = async (script: string, stateOverrides: Record<string, unknown> = {}) => {
    const messages: unknown[] = [];
    const listeners: Array<(event: { data: unknown }) => void> = [];
    const self = {
      addEventListener: (_name: string, listener: (event: { data: unknown }) => void) => listeners.push(listener),
      postMessage: (message: unknown) => messages.push(message),
      onmessage: undefined as undefined | ((event: { data: unknown }) => Promise<void>),
    };
    runInNewContext(buildScriptWorkerSource(script), { self, structuredClone, TextDecoder, TextEncoder, URL, URLSearchParams, crypto, atob, btoa, setTimeout, clearTimeout, setInterval, clearInterval, encodeURIComponent });
    const request = createBlankRequest('runtime');
    request.url = 'https://api.example.com/items';
    await self.onmessage?.({ data: { type: 'run', state: {
      request,
      baseGlobals: { base: 'base' },
      baseGlobalDisabled: [],
      environment: { global: 'global' },
      globalDisabled: [],
      globalsAreBase: false,
      baseEnvironment: { collectionBase: 'base' },
      baseEnvironmentDisabled: [],
      collectionVariables: { shared: 'collection' },
      collectionDisabled: [],
      collectionVariablesAreBase: false,
      folders: [{ id: 'root', name: 'Root', environment: { folder: 'root' } }, { id: 'child', name: 'Orders', environment: { folder: 'child' } }],
      response: { status: 201, statusText: 'Created', headers: { 'content-type': 'application/json' }, body: '{"id":"one"}', durationMs: 5, sizeBytes: 12 },
      localVariables: {}, iterationData: { row: '42' }, vault: {},
      permissions: { network: false, vault: false, maxSubrequests: 5 },
      ...stateOverrides,
    } } });
    return messages.find((message) => (message as { type?: string }).type === 'result') as Record<string, unknown>;
  };

  it('allows ordinary request and test scripts', () => {
    expect(() => validateScriptSource("insomnia.test('ok', () => expect(true).toBe(true));")).not.toThrow();
    expect(() => new Function(buildScriptWorkerSource("insomnia.environment.set('ready', true);"))).not.toThrow();
    expect(() => new Function(buildScriptWorkerSource("insomnia.test('chai', () => expect(insomnia.response.status).to.be.above(199)); insomnia.request.setHeader('X-Test', 'yes'); insomnia.request.url.addQueryParams([{ name: 'page', value: 2 }]);"))).not.toThrow();
    expect(() => new Function(buildScriptWorkerSource("insomnia.request.url.addQueryParams('k1=v1&k1=v2'); insomnia.request.auth.update({ type: 'basic', basic: [{ key: 'username', value: 'Ada' }] }, 'basic'); const folder = insomnia.parentFolders.get('Orders'); insomnia.test('async chai', async () => insomnia.expect({ a: 1 }).to.be.an('object').that.has.all.keys('a'));"))).not.toThrow();
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
    expect(normalizeScriptSubrequest('httpbin.org/anything', source).url).toBe('https://httpbin.org/anything');
  });

  it('rejects ambient schemes, file-backed bodies, and malformed methods', () => {
    const source = createBlankRequest('source');
    expect(() => normalizeScriptSubrequest('file:///tmp/token', source)).toThrow(/http:\/\//);
    expect(() => normalizeScriptSubrequest({ url: 'https://example.com', method: 'GET\r\nX-Evil: yes' }, source)).toThrow(/HTTP token/);
    expect(() => normalizeScriptSubrequest({ url: 'https://example.com', body: { mode: 'file', file: '/tmp/secret' } }, source)).toThrow(/cannot read file paths/);
  });

  it('executes scoped aliases, exact request helpers, folder lookup, and async Chai tests', async () => {
    const output = await runWorkerSource(`
      insomnia.globals.set('globalWrite', 'yes');
      insomnia.environment.set('collectionWrite', 'yes');
      insomnia.variables.set('localWrite', insomnia.variables.get('row'));
      insomnia.parentFolders.get('Orders').environment.set('folderWrite', 'yes');
      insomnia.request.url.addQueryParams('page=1&page=2');
      insomnia.request.auth.update({ type: 'basic', basic: [{ key: 'username', value: 'Ada' }, { key: 'password', value: 'secret' }] }, 'basic');
      insomnia.test('async contract', async () => {
        await Promise.resolve();
        insomnia.expect({ id: 'one', ok: true }).to.be.an('object').that.has.all.keys('id', 'ok');
        insomnia.expect(201).to.be.oneOf([200, 201]);
      });
    `);
    expect(output.ok).toBe(true);
    expect(output.environment).toMatchObject({ globalWrite: 'yes' });
    expect(output.collectionVariables).toMatchObject({ collectionWrite: 'yes' });
    expect(output.localVariables).toMatchObject({ localWrite: '42' });
    expect((output.folders as Array<{ environment: Record<string, string> }>)[1].environment).toMatchObject({ folder: 'child', folderWrite: 'yes' });
    expect(output.request).toMatchObject({ url: 'https://api.example.com/items?page=1&page=2', auth: { type: 'basic', username: 'Ada', password: 'secret' } });
    expect(output.tests).toEqual([{ name: 'async contract', passed: true }]);
  });

  it('executes the documented bundled module surface inside the disposable Worker', async () => {
    const output = await runWorkerSource(`
      const names = ['ajv', 'atob', 'btoa', 'chai', 'cheerio', 'crypto-js', 'csv-parse', 'lodash', 'moment', 'postman-collection', 'tv4', 'uuid', 'xml2js', 'assert', 'buffer', 'events', 'path', 'querystring', 'punycode', 'stream', 'string-decoder', 'timers', 'url', 'util'];
      names.forEach((name) => require(name));
      const Ajv = require('ajv');
      const csv = require('csv-parse').sync('id,name\\n1,Ada', { columns: true });
      const digest = require('crypto-js').SHA256('abc').toString();
      const xml = await require('xml2js').parseStringPromise('<root><id>1</id></root>', { explicitArray: false });
      insomnia.test('documented modules', () => {
        expect(new Ajv().validate({ required: ['id'] }, csv[0])).to.be.true;
        expect(digest).to.equal('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
        expect(require('cheerio').load('<p class="ok">yes</p>')('.ok').text()).to.equal('yes');
        expect(xml.root.id).to.equal('1');
        expect(require('moment')('2026-07-17T00:00:00Z').utc().format('YYYY-MM-DD')).to.equal('2026-07-17');
        expect(require('buffer').Buffer.from('ok').toString('hex')).to.equal('6f6b');
      });
    `);
    expect(output.ok).toBe(true);
    expect(output.tests).toEqual([{ name: 'documented modules', passed: true }]);
  });

  it('keeps unlisted modules outside the Worker capability boundary', async () => {
    const output = await runWorkerSource("require('node:fs');");
    expect(output.ok).toBe(false);
    expect(output.error).toContain("Module 'node:fs' is not bundled");
  });

  it('keeps local file references behind an explicit Worker capability', async () => {
    const denied = await runWorkerSource("insomnia.request.body.update({ mode: 'file', file: '/tmp/payload.bin' });");
    expect(denied.ok).toBe(false);
    expect(denied.error).toContain('Script file access is disabled');

    const binary = await runWorkerSource("insomnia.request.body.update({ mode: 'file', file: '{{ folder }}/payload.bin' });", { permissions: { network: false, files: true, vault: false, maxSubrequests: 5 }, folders: [{ id: 'root', name: 'Root', environment: { folder: '/tmp' } }] });
    expect(binary).toMatchObject({ ok: true, request: { bodyMode: 'binary' }, fileReferences: [{ kind: 'body', path: '/tmp/payload.bin' }] });

    const output = await runWorkerSource(`
      insomnia.request.body.update({ mode: 'formdata', formdata: [
        { key: 'label', type: 'text', value: 'ready' },
        { key: 'upload', type: 'file', value: '{{ folder }}/payload.csv', fileName: 'renamed.csv', contentType: 'text/csv' },
      ] });
      insomnia.request.certificate.update({ cert: { src: '/tmp/client.crt' }, key: { src: '/tmp/client.key' }, domains: ['api.example.com'] });
    `, { permissions: { network: false, files: true, vault: false, maxSubrequests: 5 }, folders: [{ id: 'root', name: 'Root', environment: { folder: '/tmp' } }] });
    expect(output.ok).toBe(true);
    expect(output.request).toMatchObject({ bodyMode: 'multipart', multipartBody: [{ kind: 'text', value: 'ready' }, { kind: 'file', fileName: 'renamed.csv', contentType: 'text/csv' }], transport: { clientCertificateDomains: 'api.example.com' } });
    expect(output.fileReferences).toEqual([
      { kind: 'multipart', path: '/tmp/payload.csv', partId: 'script-part-1', fileName: 'renamed.csv', contentType: 'text/csv' },
      { kind: 'certificate-cert', path: '/tmp/client.crt' },
      { kind: 'certificate-key', path: '/tmp/client.key' },
    ]);
  });

  it('hydrates bounded body, multipart, and PEM references outside the Worker', async () => {
    const body = createBlankRequest('binary');
    const readFile = async (path: string) => ({ fileName: path.split('/').at(-1) ?? 'file', mimeType: path.endsWith('.pem') ? 'application/x-pem-file' : 'application/octet-stream', dataBase64: Buffer.from(path.endsWith('.pem') ? '-----BEGIN TEST-----\nvalue\n-----END TEST-----' : 'payload').toString('base64') });
    await hydrateScriptFileReferences(body, [{ kind: 'body', path: '/tmp/payload.bin' }], readFile);
    expect(body).toMatchObject({ bodyMode: 'binary', binaryBody: { fileName: 'payload.bin', dataBase64: 'cGF5bG9hZA==' } });

    const multipart = createBlankRequest('multipart');
    multipart.bodyMode = 'multipart';
    multipart.multipartBody = [{ id: 'file-part', name: 'upload', value: '', enabled: true, kind: 'file' }];
    await hydrateScriptFileReferences(multipart, [
      { kind: 'multipart', path: '/tmp/payload.bin', partId: 'file-part', fileName: 'renamed.bin' },
      { kind: 'certificate-cert', path: '/tmp/client.pem' },
      { kind: 'certificate-key', path: '/tmp/key.pem' },
    ], readFile);
    expect(multipart.multipartBody[0]).toMatchObject({ fileName: 'renamed.bin', file: { fileName: 'payload.bin' } });
    expect(multipart.transport.clientCertificatePem).toContain('BEGIN TEST');
    expect(multipart.transport.clientKeyPem).toContain('BEGIN TEST');

    const references = Array.from({ length: 21 }, (_, index) => ({ kind: 'body' as const, path: `/tmp/${index}.bin` }));
    await expect(hydrateScriptFileReferences(createBlankRequest('too-many'), references, readFile)).rejects.toThrow(/20-file/);
    await expect(hydrateScriptFileReferences(createBlankRequest('too-large'), [{ kind: 'body', path: '/tmp/large.bin' }], async () => ({ fileName: 'large.bin', mimeType: 'application/octet-stream', dataBase64: 'A'.repeat(6_666_672) }))).rejects.toThrow(/5 MB/);
    const aggregatePayload = { fileName: 'aggregate.bin', mimeType: 'application/octet-stream', dataBase64: 'A'.repeat(5_333_336) };
    await expect(hydrateScriptFileReferences(createBlankRequest('aggregate'), references.slice(0, 5), async () => aggregatePayload)).rejects.toThrow(/20 MB aggregate/);
  });

  it('resolves all seven variable layers and mutates distinct base and selected stores', async () => {
    const output = await runWorkerSource(`
      insomnia.test('seven-level priority', () => {
        insomnia.expect(insomnia.variables.get('priority')).to.equal('local');
        insomnia.expect(insomnia.baseGlobals.get('priority')).to.equal('base-global');
        insomnia.expect(insomnia.globals.get('priority')).to.equal('selected-global');
        insomnia.expect(insomnia.baseEnvironment.get('priority')).to.equal('base-collection');
        insomnia.expect(insomnia.environment.get('priority')).to.equal('selected-collection');
        insomnia.expect(insomnia.parentFolders.get('Orders').environment.get('priority')).to.equal('folder');
        insomnia.expect(insomnia.iterationData.get('priority')).to.equal('iteration');
        insomnia.expect(insomnia.localVars.get('priority')).to.equal('local');
      });
      insomnia.baseGlobals.set('baseWrite', 'yes');
      insomnia.globals.set('masked', 'unmasked');
      insomnia.baseEnvironment.set('baseCollectionWrite', 'yes');
      insomnia.environment.set('selectedCollectionWrite', 'yes');
    `, {
      baseGlobals: { priority: 'base-global', masked: 'base' },
      environment: { priority: 'selected-global' },
      globalDisabled: ['masked'],
      baseEnvironment: { priority: 'base-collection' },
      collectionVariables: { priority: 'selected-collection' },
      folders: [{ id: 'root', name: 'Root', environment: { priority: 'root-folder' }, disabled: [] }, { id: 'child', name: 'Orders', environment: { priority: 'folder' }, disabled: [] }],
      iterationData: { priority: 'iteration' },
      localVariables: { priority: 'local' },
    });
    expect(output.ok).toBe(true);
    expect(output.tests).toEqual([{ name: 'seven-level priority', passed: true }]);
    expect(output.baseGlobals).toMatchObject({ baseWrite: 'yes' });
    expect(output.environment).toMatchObject({ masked: 'unmasked' });
    expect(output.globalDisabled).toEqual([]);
    expect(output.baseEnvironment).toMatchObject({ baseCollectionWrite: 'yes' });
    expect(output.collectionVariables).toMatchObject({ selectedCollectionWrite: 'yes' });
  });

  it('aliases selected APIs to base stores when no sub-environment is selected', async () => {
    const output = await runWorkerSource(`insomnia.globals.set('globalAlias', 'yes'); insomnia.environment.set('collectionAlias', 'yes');`, {
      baseGlobals: { initial: 'global' }, environment: {}, globalsAreBase: true,
      baseEnvironment: { initial: 'collection' }, collectionVariables: {}, collectionVariablesAreBase: true,
    });
    expect(output.baseGlobals).toEqual(output.environment);
    expect(output.baseGlobals).toMatchObject({ globalAlias: 'yes' });
    expect(output.baseEnvironment).toEqual(output.collectionVariables);
    expect(output.baseEnvironment).toMatchObject({ collectionAlias: 'yes' });
  });

  it('carries secondary response cookies and chaining records into later requests', () => {
    const request = createBlankRequest('secondary');
    request.id = 'script-secondary';
    request.name = 'secondary';
    request.url = 'https://api.example.com/session';
    const state = applyScriptSubresponse([], [], request, {
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/json' },
      body: '{"token":"one"}',
      durationMs: 4,
      sizeBytes: 15,
      setCookies: ['session=abc; Path=/; Secure'],
      requestUrl: request.url,
    }, '2026-07-16T00:00:00.000Z');
    expect(state.cookies[0]).toMatchObject({ name: 'session', value: 'abc', domain: 'api.example.com', secure: true });
    expect(state.responses[0]).toMatchObject({ requestId: 'script-secondary', requestName: 'secondary', requestUrl: request.url, receivedAt: '2026-07-16T00:00:00.000Z' });
  });
});
