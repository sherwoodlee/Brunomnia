import { describe, expect, it } from 'vitest';
import { createBlankRequest } from '../data/seed';
import { RUNNER_RESPONSE_PER_RESULT_BYTES, RUNNER_RESPONSE_REPORT_BYTES, parseRunnerData, runCollection } from './runner';

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

  it('runs a de-duplicated selected request plan in the requested order', async () => {
    const first = createBlankRequest('first');
    const second = createBlankRequest('second');
    const third = createBlankRequest('third');
    const seen: string[] = [];
    const report = await runCollection(
      { id: 'collection', name: 'Collection', expanded: true, requests: [first, second, third] },
      { id: 'env', name: 'Env', variables: [] },
      { iterations: 1, retries: 0, delayMs: 0, dataRows: [], requestIds: ['third', 'first', 'third', 'missing'] },
      async (request) => { seen.push(request.id); return { status: 200, statusText: 'OK', headers: {}, body: '{}', durationMs: 1, sizeBytes: 2 }; },
      async (_script, activeRequest, environment) => ({ request: activeRequest, environment, logs: [], tests: [] }),
    );

    expect(seen).toEqual(['third', 'first']);
    expect(report.results.map((result) => result.requestId)).toEqual(['third', 'first']);
    expect(report.total).toBe(2);
  });

  it('bails only after retries are exhausted', async () => {
    const first = createBlankRequest('first');
    const second = createBlankRequest('second');
    const seen: string[] = [];
    const report = await runCollection(
      { id: 'collection', name: 'Collection', expanded: true, requests: [first, second] },
      { id: 'env', name: 'Env', variables: [] },
      { iterations: 2, retries: 1, delayMs: 0, dataRows: [], bail: true },
      async (request) => { seen.push(request.id); return { status: 500, statusText: 'Failed', headers: {}, body: '{}', durationMs: 1, sizeBytes: 2 }; },
      async (_script, activeRequest, environment) => ({ request: activeRequest, environment, logs: [], tests: [] }),
    );

    expect(seen).toEqual(['first', 'first']);
    expect(report.total).toBe(2);
    expect(report.failed).toBe(2);
    expect(report.bailed).toBe(true);
    expect(report.cancelled).toBe(false);
  });

  it('continues when a retry recovers under bail mode', async () => {
    const first = createBlankRequest('first');
    const second = createBlankRequest('second');
    let calls = 0;
    const report = await runCollection(
      { id: 'collection', name: 'Collection', expanded: true, requests: [first, second] },
      { id: 'env', name: 'Env', variables: [] },
      { iterations: 1, retries: 1, delayMs: 0, dataRows: [], bail: true },
      async () => ({ status: ++calls === 1 ? 500 : 200, statusText: 'OK', headers: {}, body: '{}', durationMs: 1, sizeBytes: 2 }),
      async (_script, activeRequest, environment) => ({ request: activeRequest, environment, logs: [], tests: [] }),
    );

    expect(report.results.map((result) => result.status)).toEqual([500, 200, 200]);
    expect(report.bailed).toBe(false);
    expect(report.total).toBe(3);
  });

  it('stores UTF-8-safe response previews within per-result and report budgets', async () => {
    const requests = Array.from({ length: 70 }, (_, index) => createBlankRequest(`request-${index}`));
    const headers = Object.fromEntries(Array.from({ length: 70 }, (_, index) => [`x-header-${index}`, `value-${index}`]));
    const body = '🙂'.repeat(5_000);
    const report = await runCollection(
      { id: 'collection', name: 'Collection', expanded: true, requests },
      { id: 'env', name: 'Env', variables: [] },
      { iterations: 1, retries: 0, delayMs: 0, dataRows: [] },
      async () => ({ status: 200, statusText: 'OK', headers, body, durationMs: 1, sizeBytes: new TextEncoder().encode(body).byteLength }),
      async (_script, activeRequest, environment) => ({ request: activeRequest, environment, logs: [], tests: [] }),
    );

    const snapshots = report.results.flatMap((result) => result.response ?? []);
    expect(snapshots).toHaveLength(70);
    expect(snapshots[0].headersTruncated).toBe(true);
    expect(snapshots[0].bodyTruncated).toBe(true);
    expect(new TextEncoder().encode(snapshots[0].bodyPreview).byteLength).toBeLessThanOrEqual(16_000);
    expect(snapshots.every((snapshot) => snapshot.storedBytes <= RUNNER_RESPONSE_PER_RESULT_BYTES)).toBe(true);
    expect(snapshots.reduce((total, snapshot) => total + snapshot.storedBytes, 0)).toBeLessThanOrEqual(RUNNER_RESPONSE_REPORT_BYTES);
    expect(snapshots.at(-1)?.bodyTruncated).toBe(true);
    expect(snapshots.at(-1)?.storedBytes).toBe(0);
  });

  it('passes iteration data and request-local variables through scripts and request rendering', async () => {
    const request = createBlankRequest('one');
    const scriptCalls: Array<{ local: Record<string, string>; iteration: Record<string, string> }> = [];
    await runCollection(
      { id: 'collection', name: 'Collection', expanded: true, requests: [request] },
      { id: 'env', name: 'Env', variables: [{ id: 'env-host', name: 'host', value: 'environment', enabled: true }] },
      { iterations: 1, retries: 0, delayMs: 0, dataRows: [{ row: '42', host: 'iteration' }] },
      async (_activeRequest, variables) => {
        expect(variables).toMatchObject({ row: '42', host: 'iteration', local: 'yes' });
        return { status: 200, statusText: 'OK', headers: {}, body: '{}', durationMs: 1, sizeBytes: 2 };
      },
      async (_script, activeRequest, environment, response, _timeout, local = {}, iteration = {}) => {
        scriptCalls.push({ local, iteration });
        return { request: activeRequest, environment, localVariables: response ? local : { local: 'yes' }, logs: [], tests: [] };
      },
    );
    expect(scriptCalls).toEqual([
      { local: {}, iteration: { row: '42', host: 'iteration' } },
      { local: { local: 'yes' }, iteration: { row: '42', host: 'iteration' } },
    ]);
  });

  it('carries collection and parent-folder script variables through the run', async () => {
    const request = { ...createBlankRequest('one'), folderId: 'child' };
    const seen: Array<{ collection: Record<string, string>; folder: Record<string, string> }> = [];
    await runCollection(
      {
        id: 'collection', name: 'Collection', expanded: true, requests: [request],
        environment: [{ id: 'collection-token', name: 'collectionToken', value: 'before', enabled: true }, { id: 'collection-disabled', name: 'blocked', value: '', enabled: false }],
        folders: [{ id: 'child', name: 'Child', parentId: '', expanded: true, headers: [], environment: [{ id: 'folder-token', name: 'folderToken', value: 'before', enabled: true }], preRequestScript: '', tests: '', documentation: '' }],
      },
      { id: 'env', name: 'Env', variables: [{ id: 'global-blocked', name: 'blocked', value: 'global', enabled: true }] },
      { iterations: 1, retries: 0, delayMs: 0, dataRows: [] },
      async (_activeRequest, variables) => {
        expect(variables).toMatchObject({ collectionToken: 'after', folderToken: 'after' });
        expect(variables).not.toHaveProperty('blocked');
        return { status: 200, statusText: 'OK', headers: {}, body: '{}', durationMs: 1, sizeBytes: 2 };
      },
      async (_script, activeRequest, environment, response, _timeout, local, _iteration, options) => {
        seen.push({ collection: { ...(options?.collectionVariables ?? {}) }, folder: { ...(options?.folders?.[0]?.environment ?? {}) } });
        return {
          request: activeRequest,
          environment,
          collectionVariables: response ? options?.collectionVariables : { collectionToken: 'after' },
          folders: response ? options?.folders : [{ id: 'child', name: 'Child', environment: { folderToken: 'after' } }],
          localVariables: local,
          logs: [],
          tests: [],
        };
      },
    );
    expect(seen).toEqual([
      { collection: { collectionToken: 'before' }, folder: { folderToken: 'before' } },
      { collection: { collectionToken: 'after' }, folder: { folderToken: 'after' } },
    ]);
  });
});
