import { describe, expect, it } from 'vitest';
import { cloneSeedWorkspace, createBlankRequest } from '../src/data/seed';
import type { PluginRecord } from '../src/types';
import { createCliPluginRuntime, createCliPluginTemplateRuntime } from './pluginRuntime';

const plugin = (source: string, grantedPermissions: PluginRecord['grantedPermissions'] = ['template', 'store']): PluginRecord => ({
  id: 'plugin-cli',
  name: 'CLI plugin',
  version: '1.0.0',
  description: '',
  source,
  sourceFormat: 'insomnia-commonjs',
  enabled: true,
  requestedPermissions: grantedPermissions,
  grantedPermissions,
  installedAt: '2026-07-19T00:00:00.000Z',
});

describe('CLI plugin template runtime', () => {
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
