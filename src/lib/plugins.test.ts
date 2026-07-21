import { describe, expect, it } from 'vitest';
import { buildPluginWorkerSource, inferPluginPermissions, pluginStarterSource, validatePluginSource } from './plugins';

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
});
