import { describe, expect, it } from 'vitest';
import { createBlankRequest } from '../data/seed';
import { parseRunnerData, runCollection } from './runner';

describe('collection runner', () => {
  it('parses JSON and quoted CSV iteration data', () => {
    expect(parseRunnerData('[{"id":1}]')).toEqual([{ id: '1' }]);
    expect(parseRunnerData('id,name\n1,"Ada, L."')).toEqual([{ id: '1', name: 'Ada, L.' }]);
  });

  it('retries failures and keeps ordered results', async () => {
    const request = createBlankRequest('one');
    let calls = 0;
    const report = await runCollection(
      { id: 'collection', name: 'Collection', expanded: true, requests: [request] },
      { id: 'env', name: 'Env', variables: [] },
      { iterations: 1, retries: 1, delayMs: 0, dataRows: [] },
      async () => ({ status: ++calls === 1 ? 500 : 200, statusText: 'OK', headers: {}, body: '{}', durationMs: 1, sizeBytes: 2 }),
      async (_script, activeRequest, environment) => ({ request: activeRequest, environment, logs: [], tests: [] }),
    );
    expect(report.results.map((result) => result.status)).toEqual([500, 200]);
    expect(report.passed).toBe(1);
    expect(report.failed).toBe(1);
  });

  it('normalizes non-finite iteration and retry counts', async () => {
    const request = createBlankRequest('one');
    const report = await runCollection(
      { id: 'collection', name: 'Collection', expanded: true, requests: [request] },
      { id: 'env', name: 'Env', variables: [] },
      { iterations: Number.NaN, retries: Number.POSITIVE_INFINITY, delayMs: 0, dataRows: [] },
      async () => ({ status: 200, statusText: 'OK', headers: {}, body: '{}', durationMs: 1, sizeBytes: 2 }),
      async (_script, activeRequest, environment) => ({ request: activeRequest, environment, logs: [], tests: [] }),
    );

    expect(report.iterations).toBe(1);
    expect(report.retries).toBe(0);
    expect(report.total).toBe(1);
  });
});
