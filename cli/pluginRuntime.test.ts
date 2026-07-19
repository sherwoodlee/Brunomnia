import { describe, expect, it } from 'vitest';
import { createBlankRequest } from '../src/data/seed';
import type { PluginRecord } from '../src/types';
import { createCliPluginTemplateRuntime } from './pluginRuntime';

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
});
