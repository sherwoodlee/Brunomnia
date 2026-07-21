import { describe, expect, it } from 'vitest';
import { cloneSeedWorkspace } from '../data/seed';
import type { PluginRecord, Workspace } from '../types';
import { applyContextualPluginActionResult, buildPluginWorkerSource, contextualPluginActionsFor, discoverContextualPluginActions, inferPluginPermissions, pluginActionAuthorityKey, pluginSourceText, pluginStarterSource, resolveContextualPluginActionInvocation, validatePluginSource, validateRegistryPluginName, type ContextualPluginAction, type ContextualPluginActionKind } from './plugins';

const pluginRecord = (id: string, patch: Partial<PluginRecord> = {}): PluginRecord => ({
  id,
  name: id,
  version: '1.0.0',
  description: '',
  source: 'module.exports = {};',
  sourceFormat: 'insomnia-commonjs',
  enabled: true,
  requestedPermissions: ['action'],
  grantedPermissions: ['action'],
  installedAt: '2026-07-20T00:00:00.000Z',
  ...patch,
});

const contextualAction = (kind: ContextualPluginActionKind, plugin = pluginRecord('plugin')): ContextualPluginAction => ({
  key: `${plugin.id}:${kind}:0`,
  pluginId: plugin.id,
  pluginName: plugin.name,
  descriptor: { id: `${kind}:0`, label: `Run ${kind}`, kind },
  authorityKey: pluginActionAuthorityKey(plugin),
});

describe('permissioned plugin runtime source', () => {
  it('builds an isolated CommonJS worker for Insomnia-compatible exports', () => {
    const source = buildPluginWorkerSource(pluginStarterSource, '__br_testnonce');
    expect(() => new Function(source)).not.toThrow();
    expect(source).toContain('requestHooks');
    expect(source).toContain("Plugin permission not granted");
    expect(source).toContain("'fetch', 'XMLHttpRequest', 'WebSocket'");
    expect(source).toContain("response.bodyBase64 === undefined");
    expect(source).toContain("response.wireSizeBytes ?? response.sizeBytes");
    expect(source).toContain('getBodyStream');
    expect(source).toContain('requestGroupActions');
    expect(source).toContain("'data-export'");
    expect(source).toContain('INSOMNIA_TEMPLATE_SANDBOX');
    expect(source).toContain('nextTick: (callback, ...args)');
    expect(source).toContain('nodeOS: async ()');
  });

  it('builds a relative module loader and validates package paths', () => {
    const source = `module.exports = require('./lib/value');`;
    const worker = buildPluginWorkerSource(source, '__br_package', { 'index.js': source, 'lib/value.js': 'module.exports = {};' }, 'index.js');
    expect(() => new Function(worker)).not.toThrow();
    expect(worker).toContain('resolveModuleKey');
    expect(worker).toContain('lib/value.js');
    expect(() => buildPluginWorkerSource(source, '__br_unsafe', { 'index.js': source, '../escape.js': '' }, 'index.js')).toThrow(/not safe/);
  });

  it('infers permissions across every packaged source file', () => {
    expect(inferPluginPermissions(pluginSourceText({
      source: `module.exports = require('./hook');`,
      moduleFiles: { 'index.js': `module.exports = require('./hook');`, 'hook.js': `module.exports.requestHooks = [context => context.request.setHeader('X-Test', 'yes')];` },
      entryModuleKey: 'index.js',
    }))).toEqual(expect.arrayContaining(['request:read', 'request:write']));
  });

  it('infers folder, data, private-value, and file-path authorities', () => {
    expect(inferPluginPermissions(`
      module.exports.requestGroupActions = [{ action(context) {
        context.data.import.raw('{}');
        context.data.export.insomnia({ includePrivate: true });
        context.app.showSaveDialog({ defaultPath: context.app.getPath('desktop') });
      } }];
    `)).toEqual(expect.arrayContaining(['action', 'app:file', 'data:read', 'data:write', 'data:private']));
  });

  it('rejects dynamic/static module imports and oversized sources', () => {
    expect(() => validatePluginSource("import('https://example.com/plugin.js')")).toThrow(/imports/);
    expect(() => validatePluginSource('import thing from "module"')).toThrow(/imports/);
    expect(() => validatePluginSource('export const thing = true')).toThrow(/exports/);
    expect(() => validatePluginSource('x'.repeat(1_000_001))).toThrow(/1 MB/);
  });

  it('validates strict unscoped registry plugin names', () => {
    expect(() => validateRegistryPluginName('insomnia-plugin-example')).not.toThrow();
    expect(() => validateRegistryPluginName('insomnia-plugin-Example_1.2')).not.toThrow();
    for (const invalid of ['example', '@scope/example', 'insomnia-plugin-../escape', 'insomnia-plugin--example', 'insomnia-plugin-example-', 'insomnia-plugin-con']) {
      expect(() => validateRegistryPluginName(invalid)).toThrow();
    }
  });
});

describe('contextual plugin actions', () => {
  it('discovers only enabled, granted renderer placements while isolating failures', async () => {
    const plugins = [
      pluginRecord('placed'),
      pluginRecord('disabled', { enabled: false }),
      pluginRecord('ungranted', { grantedPermissions: [] }),
      pluginRecord('broken'),
    ];
    const result = await discoverContextualPluginActions(plugins, async (plugin) => {
      if (plugin.id === 'broken') throw new Error('invalid package');
      return {
        templates: [],
        themes: [],
        actions: [
          { id: 'request:0', label: 'Request tool', kind: 'request' },
          { id: 'request-group:0', label: 'Folder tool', kind: 'request-group' },
          { id: 'document:0', label: 'Design tool', kind: 'document' },
          { id: 'workspace:0', label: 'Unplaced tool', kind: 'workspace' },
        ],
      };
    });

    expect(result.actions.map((action) => action.descriptor.kind)).toEqual(['request', 'request-group', 'document']);
    expect(contextualPluginActionsFor(result.actions, 'request-group').map((action) => action.descriptor.label)).toEqual(['Folder tool']);
    expect(result.errors).toEqual([{ pluginId: 'broken', pluginName: 'broken', message: 'invalid package' }]);
  });

  it('binds request, folder, and design placements to exact live targets', () => {
    const workspace = cloneSeedWorkspace();
    const collection = workspace.collections[0];
    const request = collection.requests[0];
    collection.folders = [{ id: 'folder-a', name: 'Folder A', parentId: '', expanded: true, headers: [], environment: [], preRequestScript: '', tests: '', documentation: '' }];
    request.folderId = 'folder-a';

    expect(resolveContextualPluginActionInvocation(workspace, contextualAction('request'), { requestId: request.id })).toEqual({
      request,
      target: { requestId: request.id, collectionId: collection.id, folderId: 'folder-a' },
    });
    expect(resolveContextualPluginActionInvocation(workspace, contextualAction('request-group'), { collectionId: collection.id, folderId: 'folder-a' })).toEqual({
      request,
      target: { collectionId: collection.id, folderId: 'folder-a' },
    });
    const activeRequest = workspace.collections.flatMap((candidate) => candidate.requests).find((candidate) => candidate.id === workspace.activeRequestId);
    expect(resolveContextualPluginActionInvocation(workspace, contextualAction('document'), { designId: workspace.apiDesigns[0].id })).toEqual({
      request: activeRequest,
      target: { designId: workspace.apiDesigns[0].id },
    });
    expect(() => resolveContextualPluginActionInvocation(workspace, contextualAction('request'), { requestId: 'missing' })).toThrow(/no longer available/);
    expect(() => resolveContextualPluginActionInvocation(workspace, { ...contextualAction('request'), descriptor: { id: 'document:0', label: 'Mismatch', kind: 'request' } }, { requestId: request.id })).toThrow(/identity/);
  });

  it('persists request/store output only while the reviewed action authority is current', () => {
    const workspace = cloneSeedWorkspace();
    const plugin = pluginRecord('placed', { source: 'module.exports.requestActions = [];', grantedPermissions: ['action', 'store', 'request:write'] });
    workspace.plugins = [plugin];
    workspace.pluginData = { [plugin.id]: { before: 'yes' } };
    const action = contextualAction('request', plugin);
    const request = { ...workspace.collections[0].requests[0], name: 'Changed by plugin' };
    const applied = applyContextualPluginActionResult(workspace, action, { request, store: { after: 'yes' }, notifications: [] });
    expect(applied.collections[0].requests[0].name).toBe('Changed by plugin');
    expect(applied.pluginData[plugin.id]).toEqual({ after: 'yes' });

    const revoked: Workspace = { ...workspace, plugins: [{ ...plugin, grantedPermissions: ['store', 'request:write'] }] };
    expect(applyContextualPluginActionResult(revoked, action, { request, store: { stale: 'yes' }, notifications: [] })).toBe(revoked);
    const changed = { ...workspace, plugins: [{ ...plugin, source: `${plugin.source}\n// changed` }] };
    expect(applyContextualPluginActionResult(changed, action, { request, store: { stale: 'yes' }, notifications: [] })).toBe(changed);
  });
});
