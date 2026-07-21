import { describe, expect, it } from 'vitest';
import nodeCrypto from 'node:crypto';
import { cloneSeedWorkspace, createBlankRequest } from '../src/data/seed';
import type { PluginRecord } from '../src/types';
import { createCliPluginRuntime, createCliPluginTemplateRuntime } from './pluginRuntime';

const plugin = (source: string, grantedPermissions: PluginRecord['grantedPermissions'] = ['template', 'store'], grantedModules: string[] = []): PluginRecord => ({
  id: 'plugin-cli',
  name: 'CLI plugin',
  version: '1.0.0',
  description: '',
  source,
  sourceFormat: 'insomnia-commonjs',
  enabled: true,
  requestedModules: grantedModules,
  grantedModules,
  requestedPermissions: grantedPermissions,
  grantedPermissions,
  installedAt: '2026-07-19T00:00:00.000Z',
});

describe('CLI plugin template runtime', () => {
  it('provides baseline buffer, path, and crypto modules without a manifest grant', async () => {
    const runtime = createCliPluginTemplateRuntime([plugin(`
      const path = require('node:path');
      const crypto = require('crypto');
      const { Buffer: ModuleBuffer } = require('buffer');
      module.exports.templateTags = [{ name: 'baseline', run() {
        const hashes = ['md5', 'sha1', 'sha256', 'sha384', 'sha512'].map(algorithm => crypto.createHash(algorithm).update('hello ').update('world').digest('hex'));
        return JSON.stringify({
          path: path.join('/plugins', 'one', '..', 'two'),
          hashes,
          base64: crypto.createHash('sha256').update('foo').update('bar').digest('base64'),
          hmac: crypto.createHmac('sha256', 'parity-test-key').update('payload').digest('hex'),
          randomLength: crypto.randomBytes(2147483648).toString('hex').length,
          uuid: crypto.randomUUID(),
          buffer: ModuleBuffer.from('ok').toString('hex'),
        });
      } }];
    `)], {});
    const raw = await runtime.render('baseline', [], createBlankRequest('plugin-request'));
    expect(JSON.parse(raw ?? '{}')).toEqual({
      path: '/plugins/one/../two',
      hashes: ['md5', 'sha1', 'sha256', 'sha384', 'sha512'].map(algorithm => nodeCrypto.createHash(algorithm).update('hello ').update('world').digest('hex')),
      base64: nodeCrypto.createHash('sha256').update('foo').update('bar').digest('base64'),
      hmac: nodeCrypto.createHmac('sha256', 'parity-test-key').update('payload').digest('hex'),
      randomLength: 65_536 * 2,
      uuid: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/),
      buffer: '6f6b',
    });
  });

  it('enforces exact curated-module grant and availability denials', async () => {
    const request = createBlankRequest('plugin-request');
    const denied = createCliPluginTemplateRuntime([plugin(`require('events'); module.exports.templateTags = [{ name: 'value', run() { return 'unsafe'; } }];`)], {});
    await expect(denied.render('value', [], request)).rejects.toThrow("Module 'events' not permitted by manifest");

    const unavailable = createCliPluginTemplateRuntime([plugin(`require('fs'); module.exports.templateTags = [{ name: 'value', run() { return 'unsafe'; } }];`, ['template'], ['fs'])], {});
    await expect(unavailable.render('value', [], request)).rejects.toThrow("Module 'fs' not available in sandbox");

    const granted = createCliPluginTemplateRuntime([plugin(`
      const EventEmitter = require('node:events').EventEmitter;
      module.exports.templateTags = [{ name: 'value', run() { const emitter = new EventEmitter(); let value = ''; emitter.once('ready', next => { value = next; }); emitter.emit('ready', 'granted'); emitter.emit('ready', 'ignored'); return value; } }];
    `, ['template'], ['events'])], {});
    await expect(granted.render('value', [], request)).resolves.toBe('granted');
  });

  it('matches pinned uuid v1/v3/v4/v5, validation, version, and namespace contracts', async () => {
    const runtime = createCliPluginTemplateRuntime([plugin(`
      const uuid = require('uuid');
      module.exports.templateTags = [{ name: 'uuid_contract', run() {
        const one = uuid.v1({ msecs: 0, nsecs: 0, clockseq: 0, node: new Uint8Array(6) });
        const three = uuid.v3('hello.example.com', uuid.v3.DNS);
        const four = uuid.v4({ random: new Uint8Array(16) });
        const five = uuid.v5('hello.example.com', uuid.v5.DNS);
        return JSON.stringify({ one, three, four, five, nil: uuid.NIL, dns: uuid.v3.DNS, url: uuid.v5.URL, valid: [one, three, four, five, uuid.NIL].map(uuid.validate), versions: [one, three, four, five].map(uuid.version) });
      } }];
    `, ['template'], ['uuid'])], {});
    const raw = await runtime.render('uuid_contract', [], createBlankRequest('plugin-request'));
    const value = JSON.parse(raw ?? '{}');
    expect(value).toMatchObject({
      one: '13814000-1dd2-11b2-8000-000000000000',
      three: '9125a8dc-52ee-365b-a5aa-81b0b3681cf6',
      four: '00000000-0000-4000-8000-000000000000',
      five: 'fdda765f-fc57-5604-a269-52a7df8164ec',
      nil: '00000000-0000-0000-0000-000000000000',
      dns: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
      url: '6ba7b811-9dad-11d1-80b4-00c04fd430c8',
      valid: [true, true, true, true, true],
      versions: [1, 3, 4, 5],
    });
  });

  it('matches pinned AJV nested, array, enum, additional-property, error, and reuse behavior', async () => {
    const runtime = createCliPluginTemplateRuntime([plugin(`
      const Ajv = require('ajv');
      const ajv = new Ajv({ allErrors: true });
      const validate = ajv.compile({
        type: 'object', required: ['user'], additionalProperties: false,
        properties: { user: { type: 'object', required: ['roles'], properties: { roles: { type: 'array', minItems: 1, items: { enum: ['admin', 'user'] } } }, additionalProperties: false } },
      });
      module.exports.templateTags = [{ name: 'ajv_contract', run() {
        const missing = validate({}); const missingErrors = validate.errors.map(error => error.keyword);
        const invalid = validate({ user: { roles: ['owner'] }, extra: true }); const invalidErrors = validate.errors.map(error => error.keyword);
        const valid = validate({ user: { roles: ['admin', 'user'] } }); const validErrors = validate.errors;
        const reused = validate({ user: { roles: [] } }); const reusedErrors = validate.errors.map(error => error.keyword);
        return JSON.stringify({ missing, missingErrors, invalid, invalidErrors, valid, validErrors, reused, reusedErrors });
      } }];
    `, ['template'], ['ajv'])], {});
    const raw = await runtime.render('ajv_contract', [], createBlankRequest('plugin-request'));
    expect(JSON.parse(raw ?? '{}')).toEqual({
      missing: false,
      missingErrors: ['required'],
      invalid: false,
      invalidErrors: ['additionalProperties', 'enum'],
      valid: true,
      validErrors: null,
      reused: false,
      reusedErrors: ['minItems'],
    });
  });

  it('runs granted tags with bounded in-memory store continuity', async () => {
    const runtime = createCliPluginTemplateRuntime([plugin(`
      module.exports.templateTags = [{
        name: 'cli_value',
        async run(context, fallback = 'fallback') {
          const value = await context.store.getItem('value');
          await context.store.setItem('value', 'next');
          return value || fallback;
        },
      }];
    `)], { 'plugin-cli': { value: 'stored' } });
    const request = createBlankRequest('plugin-request');
    await expect(runtime.render('cli_value', ['fallback'], request)).resolves.toBe('stored');
    await expect(runtime.render('cli_value', ['fallback'], request)).resolves.toBe('next');
    await expect(runtime.render('missing', [], request)).resolves.toBeUndefined();
  });

  it('loads bounded relative JavaScript and JSON package modules', async () => {
    const entry = `
      const helper = require('./lib');
      const settings = require('./settings.json');
      module.exports.templateTags = [{ name: 'package_value', run() { return helper(settings.value); } }];
    `;
    const packaged = {
      ...plugin(entry),
      moduleFiles: {
        'index.js': entry,
        'lib/index.js': `module.exports = value => __dirname + ':' + __filename + ':loaded-' + value;`,
        'settings.json': '{"value":"json"}',
      },
      entryModuleKey: 'index.js',
    };
    const runtime = createCliPluginRuntime([packaged], {});
    await expect(runtime.render('package_value', [], createBlankRequest('plugin-request'))).resolves.toBe('lib:lib/index.js:loaded-json');
  });

  it('loads only explicitly granted reviewed CommonJS dependencies', async () => {
    const entry = `
      const leftPad = require('left-pad');
      module.exports.templateTags = [{ name: 'dependency_value', run() { return leftPad('7', 3, '0'); } }];
    `;
    const dependencyFields = {
      dependencyModuleFiles: {
        'node_modules/left-pad/package.json': '{"name":"left-pad","version":"1.3.0","main":"index.js"}',
        'node_modules/left-pad/index.js': `module.exports = require('./lib/pad');`,
        'node_modules/left-pad/lib/pad.js': `module.exports = (value, length, fill) => String(value).padStart(length, fill);`,
      },
      dependencyPackages: {
        'left-pad': { version: '1.3.0', entryModuleKey: 'node_modules/left-pad/index.js' },
      },
    };
    const denied = createCliPluginRuntime([{
      ...plugin(entry),
      ...dependencyFields,
      requestedModules: ['left-pad'],
    }], {});
    await expect(denied.render('dependency_value', [], createBlankRequest('plugin-request'))).rejects.toThrow("Module 'left-pad' not permitted by manifest");

    const granted = createCliPluginRuntime([{
      ...plugin(entry, ['template'], ['left-pad']),
      ...dependencyFields,
    }], {});
    await expect(granted.render('dependency_value', [], createBlankRequest('plugin-request'))).resolves.toBe('007');

    const escaping = createCliPluginRuntime([{
      ...plugin(entry, ['template'], ['left-pad']),
      dependencyModuleFiles: {
        'node_modules/left-pad/index.js': `module.exports = require('../other');`,
        'node_modules/other/index.js': `module.exports = () => 'unsafe';`,
      },
      dependencyPackages: {
        'left-pad': { version: '1.3.0', entryModuleKey: 'node_modules/left-pad/index.js' },
        other: { version: '1.0.0', entryModuleKey: 'node_modules/other/index.js' },
      },
    }], {});
    await expect(escaping.render('dependency_value', [], createBlankRequest('plugin-request'))).rejects.toThrow("escaped package 'left-pad'");
  });

  it('refuses missing, traversing, and bare package dependencies', async () => {
    const request = createBlankRequest('plugin-request');
    for (const dependency of ['./missing', '../outside', 'uuid']) {
      const entry = `require(${JSON.stringify(dependency)}); module.exports.templateTags = [{ name: 'value', run() { return 'unsafe'; } }];`;
      const runtime = createCliPluginRuntime([{ ...plugin(entry), moduleFiles: { 'index.js': entry }, entryModuleKey: 'index.js' }], {});
      await expect(runtime.render('value', [], request)).rejects.toThrow(/Cannot find|not available|not permitted/);
    }
  });

  it('hides Node process authority and refuses host RPC capabilities', async () => {
    const runtime = createCliPluginTemplateRuntime([plugin(`
      module.exports.templateTags = [
        { name: 'process_type', run() { return typeof process; } },
        { name: 'network_call', async run(context) { await context.network.sendRequest({ url: 'https://example.test' }); } },
      ];
    `, ['template', 'network'])], {});
    const request = createBlankRequest('plugin-request');
    await expect(runtime.render('process_type', [], request)).resolves.toBe('undefined');
    await expect(runtime.render('network_call', [], request)).rejects.toThrow("cannot use host capability 'network'");
  });

  it('ignores disabled and ungranted plugins', async () => {
    const disabled = { ...plugin(`module.exports.templateTags = [{ name: 'value', run() { return 'unsafe'; } }];`), enabled: false };
    const ungranted = plugin(`module.exports.templateTags = [{ name: 'value', run() { return 'unsafe'; } }];`, []);
    const runtime = createCliPluginTemplateRuntime([disabled, ungranted], {});
    await expect(runtime.render('value', [], createBlankRequest('plugin-request'))).resolves.toBeUndefined();
  });

  it('runs documented request and response hooks with bounded context state', async () => {
    const runtime = createCliPluginRuntime([plugin(`
      module.exports.requestHooks = [context => {
        context.request.setUrl(context.request.getUrl() + '/' + context.request.getEnvironmentVariable('tenant'));
        context.request.setMethod('PATCH');
        context.request.addHeader('X-Plugin', 'one');
        context.request.setParameter('page', '2');
        context.request.setAuthenticationParameter('token', 'updated');
        context.request.setCookie('session', 'abc');
        context.request.settingEncodeUrl(false);
        context.request.settingSendCookies(false);
        context.request.settingStoreCookies(false);
        context.request.settingDisableRenderRequestBody(true);
        context.request.settingFollowRedirects('off');
        context.request.setBody({ mimeType: 'application/json', text: JSON.stringify({ ok: true }) });
      }];
      module.exports.responseHooks = [context => {
        const duplicate = context.response.getHeader('X-Trace');
        let streamed = '';
        context.response.getBodyStream().pipe({ write(value) { streamed = value.toString(); }, end() {} });
        context.response.setBody(Buffer.from(JSON.stringify({ duplicate, streamed })));
      }];
    `, ['request:read', 'request:write', 'response:read', 'response:write'])], {});
    const request = createBlankRequest('plugin-request');
    request.url = 'https://api.example.com';
    const prepared = await runtime.beforeRequest(request, { tenant: 'acme' });
    expect(prepared).toMatchObject({ url: 'https://api.example.com/acme', method: 'PATCH', encodeUrl: false, bodyMode: 'json', body: '{"ok":true}', renderBodyTemplates: false });
    expect(prepared.params).toEqual([expect.objectContaining({ name: 'page', value: '2', enabled: true })]);
    expect(prepared.headers).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'X-Plugin', value: 'one' }), expect.objectContaining({ name: 'Cookie', value: 'session=abc' })]));
    expect(prepared.transport).toMatchObject({ sendCookies: false, storeCookies: false, followRedirects: false, followRedirectsMode: 'off' });
    expect(prepared.auth.token).toBe('updated');

    const response = await runtime.afterResponse(prepared, { status: 200, statusText: 'OK', headers: { 'X-Trace': 'last' }, headerLines: [{ name: 'X-Trace', value: 'one' }, { name: 'X-Trace', value: 'two' }], body: 'original', durationMs: 10, sizeBytes: 8 }, { tenant: 'acme' });
    expect(response.body).toBe('{"duplicate":["one","two"],"streamed":"original"}');
    expect(response.sizeBytes).toBe(49);
  });

  it('supplies folder actions with the selected folder and all descendants', async () => {
    const actionPlugin = plugin(`
      module.exports.requestGroupActions = [{
        label: 'Count descendants',
        action(context, { requestGroup, requests }) {
          context.request.setHeader('X-Folder', requestGroup.name + ':' + requests.length);
        },
      }];
    `, ['action', 'request:write']);
    const runtime = createCliPluginRuntime([actionPlugin], {});
    const workspace = cloneSeedWorkspace();
    const collection = workspace.collections[0];
    collection.folders = [
      { id: 'parent', name: 'Parent', parentId: '', expanded: true, headers: [], environment: [], preRequestScript: '', tests: '', documentation: '' },
      { id: 'child', name: 'Child', parentId: 'parent', expanded: true, headers: [], environment: [], preRequestScript: '', tests: '', documentation: '' },
    ];
    collection.requests = collection.requests.slice(0, 3);
    collection.requests[0].folderId = 'parent';
    collection.requests[1].folderId = 'child';
    collection.requests[2].folderId = '';
    const output = await runtime.runAction(actionPlugin.id, { id: 'request-group:0', label: 'Count descendants', kind: 'request-group' }, collection.requests[0], workspace, { collectionId: collection.id, folderId: 'parent' });
    expect(output.headers).toContainEqual(expect.objectContaining({ name: 'X-Folder', value: 'Parent:2' }));
  });
});
