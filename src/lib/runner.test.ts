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
        environment: [{ id: 'collection-token', name: 'collectionToken', value: 'before', enabled: true }],
        folders: [{ id: 'child', name: 'Child', parentId: '', expanded: true, headers: [], environment: [{ id: 'folder-token', name: 'folderToken', value: 'before', enabled: true }], preRequestScript: '', tests: '', documentation: '' }],
      },
      { id: 'env', name: 'Env', variables: [] },
      { iterations: 1, retries: 0, delayMs: 0, dataRows: [] },
      async (_activeRequest, variables) => {
        expect(variables).toMatchObject({ collectionToken: 'after', folderToken: 'after' });
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
