import { describe, expect, it } from 'vitest';
import { evaluateRunnerConfigCode } from './configCode';

describe('executable Inso config runtime', () => {
  it('loads CommonJS and ESM default objects', async () => {
    await expect(evaluateRunnerConfigCode(`module.exports = { options: { ci: true }, scripts: { test: 'inso run test' } };`, '.insorc.cjs')).resolves.toEqual({
      options: { ci: true }, scripts: { test: 'inso run test' },
    });
    await expect(evaluateRunnerConfigCode(`export default { options: { verbose: true } };`, 'inso.config.mjs')).resolves.toEqual({ options: { verbose: true } });
  });

  it('transpiles TypeScript default exports without emitting files', async () => {
    await expect(evaluateRunnerConfigCode(`
      type Config = { options: { workingDir: string } };
      const config: Config = { options: { workingDir: './project' } };
      export default config satisfies Config;
    `, 'inso.config.ts')).resolves.toEqual({ options: { workingDir: './project' } });
  });

  it('does not expose process, external buffers, or string code generation', async () => {
    await expect(evaluateRunnerConfigCode(`module.exports = { options: { processType: typeof process, arrayBufferType: typeof ArrayBuffer } };`, '.insorc.js')).resolves.toEqual({
      options: { processType: 'undefined', arrayBufferType: 'undefined' },
    });
    await expect(evaluateRunnerConfigCode(`module.exports = Function('return process')();`, '.insorc.js')).rejects.toThrow(/Code generation from strings disallowed/);
  });

  it('rejects imports, require, non-JSON values, non-objects, and runaway code', async () => {
    await expect(evaluateRunnerConfigCode(`import fs from 'node:fs'; export default {};`, '.insorc.mjs')).rejects.toThrow(/imports and require/);
    await expect(evaluateRunnerConfigCode(`module.exports = require('node:fs');`, '.insorc.cjs')).rejects.toThrow(/imports and require/);
    await expect(evaluateRunnerConfigCode(`export default { options: { ci: } };`, 'inso.config.ts')).rejects.toThrow(/TypeScript config.*invalid/);
    await expect(evaluateRunnerConfigCode(`module.exports = { options: { unsafe: () => true } };`, '.insorc.js')).rejects.toThrow(/non-JSON value/);
    await expect(evaluateRunnerConfigCode(`module.exports = 'invalid';`, '.insorc.js')).rejects.toThrow(/must export an object/);
    await expect(evaluateRunnerConfigCode(`while (true) {}`, '.insorc.js')).rejects.toThrow(/timed out/);
  });
});
