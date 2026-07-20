import { describe, expect, it, vi } from 'vitest';

import { createBlankRequest } from '../src/data/seed';
import { runNodeScriptWorker } from './scriptRuntime';

describe('portable script worker isolation', () => {
  it('runs documented script state without Node host globals', async () => {
    const request = createBlankRequest('portable-worker');
    const result = await runNodeScriptWorker(`
      console.log([typeof process, typeof require, typeof Buffer, typeof parentPort].join(','));
      insomnia.environment.set('token', 'worker-value');
      insomnia.request.setHeader('X-Worker', 'isolated');
      insomnia.test('worker assertion', () => insomnia.expect(insomnia.environment.get('token')).to.equal('worker-value'));
    `, request, {});

    expect(result.logs).toEqual(['undefined,function,undefined,undefined']);
    expect(result.collectionVariables).toEqual({ token: 'worker-value' });
    expect(result.request.headers).toContainEqual(expect.objectContaining({ name: 'X-Worker', value: 'isolated' }));
    expect(result.tests).toEqual([expect.objectContaining({ name: 'worker assertion', status: 'passed', category: 'unknown' })]);
  });

  it('terminates runaway code and disables string code generation', async () => {
    const request = createBlankRequest('portable-worker-limits');
    await expect(runNodeScriptWorker('while (true) {}', request, {}, undefined, 50)).rejects.toThrow('50 ms execution limit');
    await expect(runNodeScriptWorker("Function('return 1')()", request, {})).rejects.toThrow('Function is not a function');
  });

  it('mediates subrequests, file hydration, and read-only vault access through the host', async () => {
    const request = createBlankRequest('portable-worker-rpc');
    const readFile = vi.fn(async (path: string) => ({
      fileName: path.split('/').at(-1) ?? 'file.bin',
      mimeType: 'application/octet-stream',
      dataBase64: Buffer.from(path.endsWith('primary.bin') ? 'primary' : 'secondary').toString('base64'),
    }));
    const sendRequest = vi.fn(async (secondary: typeof request) => {
      expect(secondary.binaryBody?.dataBase64).toBe(Buffer.from('secondary').toString('base64'));
      return { status: 201, statusText: 'Created', headers: { 'content-type': 'application/json' }, body: '{"ok":true}', durationMs: 4, sizeBytes: 11 };
    });
    const result = await runNodeScriptWorker(`
      const secondary = await insomnia.sendRequest({ url: 'https://api.example.test/upload', method: 'POST', body: { mode: 'file', file: '/allowed/secondary.bin' } });
      insomnia.request.body.update({ mode: 'file', file: '/allowed/primary.bin' });
      insomnia.test('mediated capabilities', () => {
        insomnia.expect(secondary.json()).to.deep.equal({ ok: true });
        insomnia.expect(insomnia.vault.has('token')).to.equal(true);
        insomnia.expect(insomnia.vault.replaceIn('Bearer {{ token }}')).to.equal('Bearer secret');
        insomnia.expect(insomnia.vault.toObject()).to.deep.equal({ token: 'secret' });
        insomnia.expect(() => insomnia.vault.set('token', 'changed')).to.throw('Vault can not be set');
      });
    `, request, {}, undefined, 10_000, {}, {}, { readFile, sendRequest, vault: { token: 'secret' } });

    expect(sendRequest).toHaveBeenCalledOnce();
    expect(readFile.mock.calls.map(([path]) => path)).toEqual(['/allowed/secondary.bin', '/allowed/primary.bin']);
    expect(result.request.binaryBody?.dataBase64).toBe(Buffer.from('primary').toString('base64'));
    expect(result.tests).toEqual([expect.objectContaining({ name: 'mediated capabilities', status: 'passed' })]);
  });
});
