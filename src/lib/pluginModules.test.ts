import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { cloneSeedWorkspace } from '../data/seed';
import type { PluginRecord } from '../types';
import {
  buildPluginModuleRegistrySource,
  inferPluginModules,
  installReviewedPlugin,
  pluginModuleVersions,
  pluginPackageChanged,
  requestedPluginModules,
  retainedPluginModuleGrants,
} from './pluginModules';

const remotePlugin = (patch: Partial<PluginRecord> = {}): PluginRecord => ({
  id: 'plugin-remote',
  name: 'Remote plugin',
  version: '1.0.0',
  description: '',
  source: 'module.exports = {};',
  registryPackageName: 'insomnia-plugin-remote',
  sourceFormat: 'insomnia-commonjs',
  enabled: false,
  requestedModules: ['events'],
  grantedModules: [],
  moduleWarnings: [],
  requestedPermissions: ['action'],
  grantedPermissions: [],
  installedAt: '2026-01-01T00:00:00.000Z',
  ...patch,
});

describe('curated plugin modules', () => {
  it('canonicalizes source and manifest requests without treating baseline modules as grants', () => {
    const source = `
      require('node:path');
      require('node:events');
      require('uuid');
      require('./local');
    `;
    expect(inferPluginModules(source)).toEqual(['events', 'uuid']);
    expect(requestedPluginModules(source, ['node:crypto', 'ajv', 'node:events'])).toEqual(['ajv', 'events', 'uuid']);
  });

  it('treats source, package maps, entries, and manifest requests as authority-changing identity', () => {
    const previous = { source: 'module.exports = {};', moduleFiles: { 'index.js': 'module.exports = {};' }, entryModuleKey: 'index.js', requestedModules: ['events'] };
    expect(pluginPackageChanged(previous, { ...previous })).toBe(false);
    expect(pluginPackageChanged(previous, { ...previous, requestedModules: ['events', 'uuid'] })).toBe(true);
    expect(pluginPackageChanged(previous, { ...previous, moduleFiles: { 'index.js': 'module.exports = { changed: true };' } })).toBe(true);
    expect(retainedPluginModuleGrants(['node:events', 'uuid'], ['events'])).toEqual(['events']);
  });

  it('emits deterministic grant and availability denials with pinned vendored versions', () => {
    const baseline = buildPluginModuleRegistrySource([], '__br_baseline').source;
    const registry = buildPluginModuleRegistrySource(['uuid'], '__br_modules').source;
    const complete = buildPluginModuleRegistrySource(['uuid', 'ajv'], '__br_complete').source;
    const packageJson = JSON.parse(readFileSync(new URL('../../scripts/plugin-vendored/package.json', import.meta.url), 'utf8')) as { dependencies: Record<string, string> };
    expect(registry).toContain("not permitted by manifest");
    expect(registry).toContain("not available in sandbox");
    expect(registry).toContain('uuid');
    expect(registry.length).toBeGreaterThan(baseline.length);
    expect(complete.length).toBeGreaterThan(registry.length);
    expect(pluginModuleVersions).toEqual({ uuid: '11.1.1', ajv: '8.18.0' });
    expect(pluginModuleVersions).toEqual(packageJson.dependencies);
  });

  it('upserts registry packages while preserving only byte-identical reviewed authority', () => {
    const workspace = cloneSeedWorkspace();
    const previous = remotePlugin({ enabled: true, grantedModules: ['events'], grantedPermissions: ['action'] });
    workspace.plugins = [previous];
    workspace.pluginData = { [previous.id]: { retained: 'yes' } };
    workspace.activePluginTheme = `${previous.id}::dark`;

    const unchanged = installReviewedPlugin(workspace, remotePlugin({ id: 'new-id', version: '1.1.0' }));
    expect(unchanged).toMatchObject({ replaced: true, changed: false, plugin: { id: previous.id, version: '1.1.0', enabled: true, grantedModules: ['events'], grantedPermissions: ['action'], installedAt: previous.installedAt } });
    expect(unchanged.workspace.pluginData).toEqual(workspace.pluginData);
    expect(unchanged.workspace.activePluginTheme).toBe(workspace.activePluginTheme);

    const changed = installReviewedPlugin(unchanged.workspace, remotePlugin({ id: 'another-id', version: '2.0.0', source: 'module.exports = { changed: true };' }));
    expect(changed).toMatchObject({ replaced: true, changed: true, plugin: { id: previous.id, version: '2.0.0', enabled: false, grantedModules: [], grantedPermissions: [] } });
    expect(changed.workspace.pluginData).toEqual({});
    expect(changed.workspace.activePluginTheme).toBe('');
    expect(changed.workspace.plugins).toHaveLength(1);
  });
});
