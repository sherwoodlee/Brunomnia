import { describe, expect, it } from 'vitest';
import { buildScriptWorkerSource, validateScriptSource } from './scriptSandbox';

describe('script sandbox source validation', () => {
  it('allows ordinary request and test scripts', () => {
    expect(() => validateScriptSource("insomnia.test('ok', () => expect(true).toBe(true));")).not.toThrow();
    expect(() => new Function(buildScriptWorkerSource("insomnia.environment.set('ready', true);"))).not.toThrow();
  });

  it('rejects dynamic module imports, including comment-separated calls', () => {
    expect(() => validateScriptSource("import('https://example.com/module.js')")).toThrow(/Module imports/);
    expect(() => validateScriptSource("import /* hidden */ ('https://example.com/module.js')")).toThrow(/Module imports/);
  });
});
