import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  buildPluginModuleRegistrySource,
  inferPluginModules,
  pluginModuleVersions,
  pluginPackageChanged,
  requestedPluginModules,
  retainedPluginModuleGrants,
} from './pluginModules';

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
});
