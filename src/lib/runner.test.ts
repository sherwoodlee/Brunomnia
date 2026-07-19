import { describe, expect, it } from 'vitest';
import { createBlankRequest } from '../data/seed';
import type { Workspace } from '../types';
import { RUNNER_REQUEST_PER_RESULT_BYTES, RUNNER_REQUEST_REPORT_BYTES, RUNNER_RESPONSE_PER_RESULT_BYTES, RUNNER_RESPONSE_REPORT_BYTES, buildRunnerItemKey, discardRunnerDraftEntries, parseRunnerData, resolveRunnerTarget, runCollection, runnerDraftKey, validateTestNamePattern } from './runner';

describe('collection runner', () => {
  it('resolves workspace and nested folder runner targets', () => {
    const root = createBlankRequest('root');
    const direct = { ...createBlankRequest('direct'), folderId: 'folder' };
    const nested = { ...createBlankRequest('nested'), folderId: 'child' };
    const other = { ...createBlankRequest('other'), folderId: 'other-folder' };
    const workspace = {
      collections: [{ id: 'collection', name: 'Collection', expanded: true, requests: [root, direct, nested, other], folders: [{ id: 'folder', name: 'Folder', parentId: '', expanded: true, headers: [], environment: [], preRequestScript: '', tests: '', documentation: '' }, { id: 'child', name: 'Child', parentId: 'folder', expanded: true, headers: [], environment: [], preRequestScript: '', tests: '', documentation: '' }, { id: 'other-folder', name: 'Other', parentId: '', expanded: true, headers: [], environment: [], preRequestScript: '', tests: '', documentation: '' }] }],
    } as unknown as Workspace;
    expect(resolveRunnerTarget(workspace).requests.map((request) => request.id)).toEqual(['root', 'direct', 'nested', 'other']);
    expect(resolveRunnerTarget(workspace, { collectionId: 'collection', folderId: 'folder' })).toMatchObject({ folder: { id: 'folder' }, requests: [{ id: 'direct' }, { id: 'nested' }] });
    expect(resolveRunnerTarget(workspace, { collectionId: 'collection', folderId: 'missing' }).requests).toEqual([]);
  });

  it('keys Runner drafts by workspace and clears only closed documents', () => {
    const draft = { collectionId: 'collection', environmentId: 'environment', iterations: 2, retries: 1, bail: true, delayMs: 25, streamWindowMs: 500, data: '[{}]', requestPlan: [{ id: 'request', enabled: false }] };
    const drafts = {
      [runnerDraftKey('workspace-a', 'runner_one')]: draft,
      [runnerDraftKey('workspace-a', 'runner_two')]: { ...draft, iterations: 3 },
      [runnerDraftKey('workspace-b', 'runner_one')]: { ...draft, iterations: 4 },
    };
    const retained = discardRunnerDraftEntries(drafts, 'workspace-a', ['runner_one', 'missing']);
    expect(retained).toEqual({
      [runnerDraftKey('workspace-a', 'runner_two')]: { ...draft, iterations: 3 },
      [runnerDraftKey('workspace-b', 'runner_one')]: { ...draft, iterations: 4 },
    });
    expect(discardRunnerDraftEntries(retained, 'workspace-a', ['missing'])).toBe(retained);
  });
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

  it('retains pre-request and after-response assertions together', async () => {
    const request = createBlankRequest('one');
    const report = await runCollection(
      { id: 'collection', name: 'Collection', expanded: true, requests: [request] },
      { id: 'env', name: 'Env', variables: [] },
      { iterations: 1, retries: 0, delayMs: 0, dataRows: [] },
      async () => ({ status: 200, statusText: 'OK', headers: {}, body: '{}', durationMs: 1, sizeBytes: 2 }),
      async (_script, activeRequest, environment, response) => ({
        request: activeRequest,
        environment,
        logs: [],
        tests: [{ name: response ? 'after response' : 'before request', passed: true }],
      }),
    );

    expect(report.results[0].tests).toEqual([
      { name: 'before request', passed: true },
      { name: 'after response', passed: true },
    ]);
  });

  it('validates test-name regexes before execution', async () => {
    const request = createBlankRequest('one');
    let calls = 0;
    await expect(runCollection(
      { id: 'collection', name: 'Collection', expanded: true, requests: [request] },
      { id: 'env', name: 'Env', variables: [] },
      { iterations: 1, retries: 0, delayMs: 0, dataRows: [], testNamePattern: '[' },
      async () => { calls += 1; return { status: 200, statusText: 'OK', headers: {}, body: '{}', durationMs: 1, sizeBytes: 2 }; },
      async (_script, activeRequest, environment) => ({ request: activeRequest, environment, logs: [], tests: [] }),
    )).rejects.toThrow(/Invalid test name pattern/);
    expect(calls).toBe(0);
    expect(validateTestNamePattern('^status (?:2|3)\\d\\d$')).toBe('^status (?:2|3)\\d\\d$');
    expect(() => validateTestNamePattern('x'.repeat(1_001))).toThrow(/1,000 characters/);
  });

  it('propagates a test-name pattern and omits clean attempts with no matches', async () => {
    const first = createBlankRequest('first');
    const second = createBlankRequest('second');
    const seenRequests: string[] = [];
    const seenPatterns: Array<string | undefined> = [];
    const report = await runCollection(
      { id: 'collection', name: 'Collection', expanded: true, requests: [first, second] },
      { id: 'env', name: 'Env', variables: [] },
      { iterations: 1, retries: 0, delayMs: 0, dataRows: [], testNamePattern: '^keep:' },
      async (request) => { seenRequests.push(request.id); return { status: 200, statusText: 'OK', headers: {}, body: '{}', durationMs: 1, sizeBytes: 2 }; },
      async (_script, request, environment, response, _timeout, _local, _iteration, options) => {
        seenPatterns.push(options?.testNamePattern);
        const candidates = request.id === 'first'
          ? [{ name: 'keep: status', passed: true }, { name: 'skip: body', passed: false, error: 'must not count' }]
          : [{ name: 'skip: only', passed: false, error: 'must not count' }];
        const pattern = options?.testNamePattern === undefined ? undefined : new RegExp(options.testNamePattern);
        return { request, environment, logs: [], tests: response ? candidates.filter((test) => !pattern || pattern.test(test.name)) : [] };
      },
    );

    expect(seenRequests).toEqual(['first', 'second']);
    expect(seenPatterns).toEqual([undefined, '^keep:', undefined, '^keep:']);
    expect(report).toMatchObject({ testNamePattern: '^keep:', matchedTests: 1, total: 1, passed: 1, failed: 0 });
    expect(report.results[0]).toMatchObject({ requestId: 'first', tests: [{ name: 'keep: status', passed: true }] });
  });

  it('retains transport failures even when no test name matches', async () => {
    const request = createBlankRequest('failed');
    const report = await runCollection(
      { id: 'collection', name: 'Collection', expanded: true, requests: [request] },
      { id: 'env', name: 'Env', variables: [] },
      { iterations: 1, retries: 0, delayMs: 0, dataRows: [], testNamePattern: '^missing$' },
      async () => ({ status: 500, statusText: 'Failed', headers: {}, body: '{}', durationMs: 1, sizeBytes: 2 }),
      async (_script, activeRequest, environment) => ({ request: activeRequest, environment, logs: [], tests: [] }),
    );
    expect(report).toMatchObject({ total: 1, failed: 1, matchedTests: 0 });
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

  it('publishes pending, running, and completed live-item evidence', async () => {
    const request = createBlankRequest('live');
    const snapshots: string[][] = [];
    const report = await runCollection(
      { id: 'collection', name: 'Collection', expanded: true, requests: [request] },
      { id: 'env', name: 'Env', variables: [] },
      { iterations: 1, retries: 0, delayMs: 0, dataRows: [], onLiveItems: (items) => snapshots.push(items.map((item) => item.status)) },
      async (_activeRequest, _variables, execution) => {
        expect(execution).toMatchObject({ key: buildRunnerItemKey(1, 0, request.id), attempt: 1 });
        expect(execution.signal.aborted).toBe(false);
        return { status: 201, statusText: 'Created', headers: {}, body: '{}', durationMs: 12, sizeBytes: 2, requestUrl: 'https://example.test/rendered' };
      },
      async (_script, activeRequest, environment, response) => ({ request: activeRequest, environment, logs: [], tests: response ? [{ name: 'created', passed: true }] : [] }),
    );

    expect(snapshots[0]).toEqual(['pending']);
    expect(snapshots).toContainEqual(['running']);
    expect(snapshots.at(-1)).toEqual(['completed']);
    expect(report).toMatchObject({ planned: 1, completed: 1, skipped: 0, canceled: 0 });
    expect(report.liveItems?.[0]).toMatchObject({ status: 'completed', statusCode: 201, statusMessage: 'Created', responseTime: 12, responseSize: 2, requestUrl: 'https://example.test/rendered', tests: [{ name: 'created', passed: true }] });
  });

  it('skips queued items without executing or counting them as failures', async () => {
    const first = createBlankRequest('first');
    const second = createBlankRequest('second');
    const skippedKey = buildRunnerItemKey(1, 1, second.id);
    const seen: string[] = [];
    const report = await runCollection(
      { id: 'collection', name: 'Collection', expanded: true, requests: [first, second] },
      { id: 'env', name: 'Env', variables: [] },
      { iterations: 1, retries: 0, delayMs: 0, dataRows: [], shouldSkip: (key) => key === skippedKey },
      async (request) => { seen.push(request.id); return { status: 200, statusText: 'OK', headers: {}, body: '{}', durationMs: 1, sizeBytes: 2 }; },
      async (_script, activeRequest, environment) => ({ request: activeRequest, environment, logs: [], tests: [] }),
    );

    expect(seen).toEqual(['first']);
    expect(report).toMatchObject({ total: 1, passed: 1, failed: 0, skipped: 1, canceled: 0 });
    expect(report.liveItems?.map((item) => item.status)).toEqual(['completed', 'skipped']);
  });

  it('aborts an active skipped item and continues with the queue', async () => {
    const first = createBlankRequest('first');
    const second = createBlankRequest('second');
    const firstKey = buildRunnerItemKey(1, 0, first.id);
    let skipped = false;
    let cancelActive: (() => void) | undefined;
    const seen: string[] = [];
    const report = await runCollection(
      { id: 'collection', name: 'Collection', expanded: true, requests: [first, second] },
      { id: 'env', name: 'Env', variables: [] },
      {
        iterations: 1, retries: 0, delayMs: 0, dataRows: [],
        shouldSkip: (key) => key === firstKey && skipped,
        onActiveItem: (key, cancel) => { cancelActive = key === firstKey ? cancel : undefined; },
      },
      async (request, _variables, execution) => {
        seen.push(request.id);
        if (request.id !== first.id) return { status: 200, statusText: 'OK', headers: {}, body: '{}', durationMs: 1, sizeBytes: 2 };
        return new Promise((_resolve, reject) => {
          execution.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
          queueMicrotask(() => { skipped = true; cancelActive?.(); });
        });
      },
      async (_script, activeRequest, environment) => ({ request: activeRequest, environment, logs: [], tests: [] }),
    );

    expect(seen).toEqual(['first', 'second']);
    expect(report).toMatchObject({ total: 1, passed: 1, failed: 0, skipped: 1, cancelled: false });
    expect(report.liveItems?.map((item) => item.status)).toEqual(['skipped', 'completed']);
  });

  it('aborts the active request and cancels every unfinished item', async () => {
    const first = createBlankRequest('first');
    const second = createBlankRequest('second');
    let stopped = false;
    let cancelActive: (() => void) | undefined;
    const report = await runCollection(
      { id: 'collection', name: 'Collection', expanded: true, requests: [first, second] },
      { id: 'env', name: 'Env', variables: [] },
      {
        iterations: 1, retries: 1, delayMs: 0, dataRows: [],
        shouldCancel: () => stopped,
        onActiveItem: (key, cancel) => { cancelActive = key ? cancel : undefined; },
      },
      async (_request, _variables, execution) => new Promise((_resolve, reject) => {
        execution.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
        queueMicrotask(() => { stopped = true; cancelActive?.(); });
      }),
      async (_script, activeRequest, environment) => ({ request: activeRequest, environment, logs: [], tests: [] }),
    );

    expect(report).toMatchObject({ total: 0, passed: 0, failed: 0, canceled: 2, cancelled: true });
    expect(report.liveItems?.map((item) => item.status)).toEqual(['canceled', 'canceled']);
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
    expect(report.liveItems?.map((item) => item.status)).toEqual(['completed', 'skipped', 'skipped', 'skipped']);
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
    const requests = Array.from({ length: 70 }, (_, index) => ({ ...createBlankRequest(`request-${index}`), headers: Array.from({ length: 10 }, (_value, headerIndex) => ({ id: `header-${index}-${headerIndex}`, name: `X-Debug-${headerIndex}`, value: 'x'.repeat(20_000), enabled: true })) }));
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
    const requestSnapshots = report.results.flatMap((result) => result.request ?? []);
    expect(requestSnapshots.every((snapshot) => snapshot.storedBytes <= RUNNER_REQUEST_PER_RESULT_BYTES)).toBe(true);
    expect(requestSnapshots.reduce((total, snapshot) => total + snapshot.storedBytes, 0)).toBeLessThanOrEqual(RUNNER_REQUEST_REPORT_BYTES);
    expect(requestSnapshots.at(-1)?.headersTruncated).toBe(true);
    expect(requestSnapshots.at(-1)?.storedBytes).toBe(0);
  });

  it('records resolved request metadata while redacting named secrets and omitting body content', async () => {
    const request = {
      ...createBlankRequest('request'),
      url: 'https://example.test/orders/{{ orderId }}?access_token=secret&view=full',
      headers: [
        { id: 'accept', name: 'Accept', value: 'application/json', enabled: true },
        { id: 'token', name: 'X-API-Key', value: '{{ apiKey }}', enabled: true },
      ],
      bodyMode: 'json' as const,
      body: '{"password":"{{ password }}"}',
    };
    const report = await runCollection(
      { id: 'collection', name: 'Collection', expanded: true, requests: [request] },
      { id: 'env', name: 'Env', variables: [{ id: 'order', name: 'orderId', value: '42', enabled: true }, { id: 'key', name: 'apiKey', value: 'top-secret', enabled: true }, { id: 'password', name: 'password', value: 'hidden', enabled: true }] },
      { iterations: 1, retries: 0, delayMs: 0, dataRows: [] },
      async () => ({ status: 200, statusText: 'OK', headers: {}, body: '{}', durationMs: 1, sizeBytes: 2, requestUrl: 'https://example.test/orders/42?access_token=secret&view=full' }),
      async (_script, activeRequest, environment) => ({ request: activeRequest, environment, logs: [], tests: [] }),
    );

    const snapshot = report.results[0].request;
    expect(snapshot?.url).toContain('access_token=%5Bredacted%5D');
    expect(snapshot?.url).toContain('view=full');
    expect(snapshot?.headers).toEqual([
      { name: 'Accept', value: 'application/json', redacted: false },
      { name: 'X-API-Key', value: '[redacted]', redacted: true },
    ]);
    expect(snapshot?.bodyMode).toBe('json');
    expect(snapshot?.bodySummary).toBe('JSON body');
    expect(snapshot?.bodySizeBytes).toBe(new TextEncoder().encode('{"password":"hidden"}').byteLength);
    expect(JSON.stringify(snapshot)).not.toContain('top-secret');
    expect(JSON.stringify(snapshot)).not.toContain('hidden');
    expect(report.liveItems?.[0].requestUrl).toContain('access_token=%5Bredacted%5D');
    expect(JSON.stringify(report.liveItems)).not.toContain('access_token=secret');
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
