import { describe, expect, it, vi } from 'vitest';
import { createBlankRequest } from '../data/seed';
import type { RunnerItemResult, Workspace } from '../types';
import { RUNNER_DATA_ENCODINGS, RUNNER_REQUEST_PER_RESULT_BYTES, RUNNER_REQUEST_REPORT_BYTES, RUNNER_RESPONSE_PER_RESULT_BYTES, RUNNER_RESPONSE_REPORT_BYTES, RUNNER_TIMELINE_PER_RESULT_BYTES, RUNNER_TIMELINE_REPORT_BYTES, aggregateRunnerTimeline, buildRunnerItemKey, decodeRunnerDataBytes, detectRunnerDataEncoding, discardRunnerDraftEntries, discardRunnerReport, filterRunnerLiveItems, parseRunnerData, parseRunnerDataFile, resolveRunnerTarget, runCollection, runnerDataBytesFromBase64, runnerDataBytesToBase64, runnerDraftKey, runnerReportsForTarget, validateTestNamePattern } from './runner';
import { formatResponseTimeline } from './timeline';

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
    const draft = { collectionId: 'collection', environmentId: 'environment', iterations: 2, retries: 1, bail: true, keepLog: true, delayMs: 25, streamWindowMs: 500, data: '[{}]', dataFileName: 'iterations.json', dataFileEncoding: 'utf-8', dataFileBytesBase64: 'W3t9XQ==', requestPlan: [{ id: 'request', enabled: false }] };
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

  it('scopes saved reports to collection and folder Runner documents', () => {
    const report = (id: string, collectionId: string, folderId?: string) => ({ id, collectionId, collectionName: collectionId, environmentId: 'env', startedAt: '', finishedAt: '', iterations: 1, retries: 0, total: 0, passed: 0, failed: 0, cancelled: false, results: [], ...(folderId ? { folderId } : {}) });
    const reports = [report('root-a', 'a'), report('folder-a', 'a', 'folder'), report('root-b', 'b')];
    expect(runnerReportsForTarget(reports, 'a').map((item) => item.id)).toEqual(['root-a']);
    expect(runnerReportsForTarget(reports, 'a', 'folder').map((item) => item.id)).toEqual(['folder-a']);
    expect(runnerReportsForTarget(reports, 'a', 'missing')).toEqual([]);
    expect(discardRunnerReport(reports, 'folder-a').map((item) => item.id)).toEqual(['root-a', 'root-b']);
    expect(discardRunnerReport(reports, 'missing')).toBe(reports);
  });

  it('filters live Runner attempts by outcome and request or test name', () => {
    const items = [
      { key: 'passed', iteration: 1, requestId: 'one', requestName: 'Create order', requestUrl: 'https://example.test/orders', status: 'completed' as const, statusCode: 201 },
      { key: 'failed', iteration: 1, requestId: 'two', requestName: 'Read order', requestUrl: 'https://example.test/orders/1', status: 'completed' as const, statusCode: 500 },
      { key: 'skipped', iteration: 1, requestId: 'three', requestName: 'Delete order', requestUrl: 'https://example.test/orders/1', status: 'skipped' as const },
      { key: 'running', iteration: 1, requestId: 'four', requestName: 'List orders', requestUrl: 'https://example.test/orders', status: 'running' as const },
    ];
    const result = (key: string, passed: boolean, testName: string): RunnerItemResult => ({ id: key, key, requestId: key, requestName: key, iteration: 1, attempt: 1, status: passed ? 201 : 500, durationMs: 1, passed, tests: [{ name: testName, passed, ...(passed ? {} : { error: 'Expected success' }) }] });
    const results = [result('passed', true, 'creates resource'), result('failed', false, 'returns invoice')];

    expect(filterRunnerLiveItems(items, results, 'all', '')).toHaveLength(4);
    expect(filterRunnerLiveItems(items, results, 'passed', '').map((item) => item.key)).toEqual(['passed']);
    expect(filterRunnerLiveItems(items, results, 'failed', '').map((item) => item.key)).toEqual(['failed']);
    expect(filterRunnerLiveItems(items, results, 'skipped', '').map((item) => item.key)).toEqual(['skipped']);
    expect(filterRunnerLiveItems(items, results, 'all', 'INVOICE').map((item) => item.key)).toEqual(['failed']);
    expect(filterRunnerLiveItems(items, results, 'all', 'delete order').map((item) => item.key)).toEqual(['skipped']);
    expect(filterRunnerLiveItems(
      [{ key: 'legacy-live', iteration: 2, requestId: 'legacy', requestName: 'Legacy request', requestUrl: '', status: 'completed', statusCode: 200 }],
      [{ ...result('legacy-result', true, 'legacy assertion'), key: undefined, requestId: 'legacy', iteration: 2 }],
      'passed',
      'assertion',
    ).map((item) => item.key)).toEqual(['legacy-live']);
  });
  it('parses JSON and quoted CSV iteration data', () => {
    expect(parseRunnerData('[{"id":1,"nested":{"ok":true}}]')).toEqual([{ id: '1', nested: '{"ok":true}' }]);
    expect(parseRunnerData('id,name\n1,"Ada, L."')).toEqual([{ id: '1', name: 'Ada, L.' }]);
  });

  it('validates bounded JSON and CSV data-file previews', () => {
    expect(parseRunnerDataFile('[{"id":1,"nested":["a","b"]},null,"skip"]', 'iterations.JSON')).toEqual({ rows: [{ id: '1', nested: '["a","b"]' }], headers: ['id', 'nested'] });
    expect(parseRunnerDataFile('id,name\r\n1,"Ada, L."', 'iterations.csv')).toEqual({ rows: [{ id: '1', name: 'Ada, L.' }], headers: ['id', 'name'] });
    expect(() => parseRunnerDataFile('{"id":1}', 'iterations.json')).toThrow(/array of key-value objects/);
    expect(() => parseRunnerDataFile('id', 'iterations.csv')).toThrow(/header row and at least one data row/);
    expect(() => parseRunnerDataFile('[{"id":1}]', 'iterations.txt')).toThrow(/JSON or CSV/);
    expect(() => parseRunnerDataFile(JSON.stringify(Array.from({ length: 1_001 }, (_, id) => ({ id }))), 'iterations.json')).toThrow(/1,000 iterations/);
  });

  it('detects and decodes portable Runner data encodings', () => {
    const utf16 = new Uint8Array([0xff, 0xfe, 0x69, 0x00, 0x64, 0x00, 0x0a, 0x00, 0x31, 0x00]);
    expect(detectRunnerDataEncoding(utf16)).toBe('utf-16le');
    expect(decodeRunnerDataBytes(utf16, 'utf-16le')).toBe('id\n1');
    const western = new Uint8Array([0x69, 0x64, 0x2c, 0x6e, 0x61, 0x6d, 0x65, 0x0a, 0x31, 0x2c, 0xe9]);
    expect(detectRunnerDataEncoding(western)).toBe('windows-1252');
    expect(decodeRunnerDataBytes(western, 'windows-1252')).toBe('id,name\n1,é');
    const utf32le = new Uint8Array([0xff, 0xfe, 0x00, 0x00, 0x69, 0x00, 0x00, 0x00, 0x64, 0x00, 0x00, 0x00]);
    const utf32be = new Uint8Array([0x00, 0x00, 0xfe, 0xff, 0x00, 0x01, 0xf6, 0x80]);
    expect(detectRunnerDataEncoding(utf32le)).toBe('utf-32le');
    expect(detectRunnerDataEncoding(utf32be)).toBe('utf-32be');
    expect(decodeRunnerDataBytes(utf32le, 'utf-32le')).toBe('id');
    expect(decodeRunnerDataBytes(utf32be, 'utf-32be')).toBe('🚀');
    expect(decodeRunnerDataBytes(new Uint8Array([0x41, 0x80]), 'iso-8859-1')).toBe('A\u0080');
    expect(decodeRunnerDataBytes(new Uint8Array([0xae, 0xbe]), 'koi8-ru')).toBe('ўЎ');
    expect(decodeRunnerDataBytes(new Uint8Array([0x80, 0x81, 0x8a, 0xc0]), 'koi8-t')).toBe('қғҳю');
    expect(RUNNER_DATA_ENCODINGS).toHaveLength(41);
    expect(RUNNER_DATA_ENCODINGS.map((encoding) => encoding.key)).toEqual(expect.arrayContaining(['utf-8', 'utf-16le', 'utf-32be', 'ascii', 'iso-8859-12', 'windows-1252', 'euc-cn', 'shift_jis', 'koi8-ru', 'koi8-t']));
    expect(() => decodeRunnerDataBytes(western, 'utf-8')).toThrow(/not valid utf-8/);
    expect(() => decodeRunnerDataBytes(new Uint8Array([0x80]), 'ascii')).toThrow(/not valid ascii/);
    expect(() => decodeRunnerDataBytes(new Uint8Array([0x88]), 'koi8-t')).toThrow(/not valid koi8-t/);
  });

  it('round-trips bounded Runner source bytes for dialog reopening', () => {
    const bytes = new Uint8Array([0x00, 0x41, 0xff, 0x0a]);
    const encoded = runnerDataBytesToBase64(bytes);
    expect(runnerDataBytesFromBase64(encoded)).toEqual(bytes);
    expect(runnerDataBytesFromBase64('not base64')).toBeUndefined();
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

  it('applies the configured delay before every request attempt', async () => {
    vi.useFakeTimers();
    try {
      const request = createBlankRequest('delayed');
      let calls = 0;
      const reportPromise = runCollection(
        { id: 'collection', name: 'Collection', expanded: true, requests: [request] },
        { id: 'env', name: 'Env', variables: [] },
        { iterations: 1, retries: 1, delayMs: 25, dataRows: [] },
        async () => ({ status: ++calls === 1 ? 500 : 200, statusText: 'OK', headers: {}, body: '{}', durationMs: 1, sizeBytes: 2 }),
        async (_script, activeRequest, environment) => ({ request: activeRequest, environment, logs: [], tests: [] }),
      );

      await vi.advanceTimersByTimeAsync(24);
      expect(calls).toBe(0);
      await vi.advanceTimersByTimeAsync(1);
      expect(calls).toBe(1);
      await vi.advanceTimersByTimeAsync(24);
      expect(calls).toBe(1);
      await vi.advanceTimersByTimeAsync(1);

      await expect(reportPromise).resolves.toMatchObject({ total: 2, passed: 1, failed: 1 });
      expect(calls).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('skips an active item during its pre-send delay without starting transport', async () => {
    vi.useFakeTimers();
    try {
      const request = createBlankRequest('skip-delay');
      let shouldSkip = false;
      let cancelActive: (() => void) | undefined;
      let calls = 0;
      const reportPromise = runCollection(
        { id: 'collection', name: 'Collection', expanded: true, requests: [request] },
        { id: 'env', name: 'Env', variables: [] },
        {
          iterations: 1,
          retries: 0,
          delayMs: 50,
          dataRows: [],
          shouldSkip: () => shouldSkip,
          onActiveItem: (key, cancel) => { if (key) cancelActive = cancel; },
        },
        async () => { calls += 1; return { status: 200, statusText: 'OK', headers: {}, body: '{}', durationMs: 1, sizeBytes: 2 }; },
        async (_script, activeRequest, environment) => ({ request: activeRequest, environment, logs: [], tests: [] }),
      );

      await vi.advanceTimersByTimeAsync(10);
      shouldSkip = true;
      cancelActive?.();

      await expect(reportPromise).resolves.toMatchObject({ total: 0, skipped: 1, cancelled: false });
      expect(calls).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('caps programmatic pre-send delays at thirty seconds', async () => {
    vi.useFakeTimers();
    try {
      const request = createBlankRequest('bounded-delay');
      let calls = 0;
      const reportPromise = runCollection(
        { id: 'collection', name: 'Collection', expanded: true, requests: [request] },
        { id: 'env', name: 'Env', variables: [] },
        { iterations: 1, retries: 0, delayMs: 60_000, dataRows: [] },
        async () => { calls += 1; return { status: 200, statusText: 'OK', headers: {}, body: '{}', durationMs: 1, sizeBytes: 2 }; },
        async (_script, activeRequest, environment) => ({ request: activeRequest, environment, logs: [], tests: [] }),
      );

      await vi.advanceTimersByTimeAsync(29_999);
      expect(calls).toBe(0);
      await vi.advanceTimersByTimeAsync(1);
      await expect(reportPromise).resolves.toMatchObject({ passed: 1, failed: 0 });
      expect(calls).toBe(1);
    } finally {
      vi.useRealTimers();
    }
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

  it('retains categorized assertions and does not fail on explicit skips', async () => {
    const request = createBlankRequest('one');
    const categories: Array<string | undefined> = [];
    const report = await runCollection(
      { id: 'collection', name: 'Collection', expanded: true, requests: [request] },
      { id: 'env', name: 'Env', variables: [] },
      { iterations: 1, retries: 0, delayMs: 0, dataRows: [] },
      async () => ({ status: 200, statusText: 'OK', headers: {}, body: '{}', durationMs: 1, sizeBytes: 2 }),
      async (_script, activeRequest, environment, response, _timeout, _local, _iteration, options) => {
        categories.push(options?.testCategory);
        return {
          request: activeRequest,
          environment,
          logs: [],
          tests: response
            ? [{ name: 'after response', passed: true, status: 'passed', category: options?.testCategory, durationMs: 1 }]
            : [{ name: 'before request', passed: false, status: 'skipped', category: options?.testCategory, durationMs: 0 }],
        };
      },
    );

    expect(categories).toEqual(['pre-request', 'after-response']);
    expect(report).toMatchObject({ passed: 1, failed: 0 });
    expect(report.results[0].tests).toEqual([
      { name: 'before request', passed: false, status: 'skipped', category: 'pre-request', durationMs: 0 },
      { name: 'after response', passed: true, status: 'passed', category: 'after-response', durationMs: 1 },
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
      { iterations: 1, retries: 0, delayMs: 0, dataRows: [], sourceName: 'Collection / Folder', folderId: 'folder', onLiveItems: (items) => snapshots.push(items.map((item) => item.status)) },
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
    expect(report).toMatchObject({ sourceName: 'Collection / Folder', folderId: 'folder', planned: 1, completed: 1, skipped: 0, canceled: 0 });
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

  it('uses script-directed request IDs to skip forward in the current iteration', async () => {
    const first = createBlankRequest('first');
    const second = createBlankRequest('second');
    const third = createBlankRequest('third');
    const seen: string[] = [];
    const locations: string[][] = [];
    const report = await runCollection(
      { id: 'collection', name: 'Collection', expanded: true, requests: [first, second, third] },
      { id: 'env', name: 'Env', variables: [] },
      { iterations: 1, retries: 0, delayMs: 0, dataRows: [] },
      async (request) => { seen.push(request.id); return { status: 200, statusText: 'OK', headers: {}, body: '{}', durationMs: 1, sizeBytes: 2 }; },
      async (_script, request, environment, response, _timeout, _local, _iteration, options) => {
        locations.push(options?.executionLocation ?? []);
        const execution = response
          ? options?.execution
          : { location: options?.executionLocation ?? [], skipRequest: false, nextRequestIdOrName: request.id === first.id ? third.id : '' };
        return { request, environment, logs: [], tests: [], execution };
      },
    );

    expect(seen).toEqual(['first', 'third']);
    expect(report.results.map((result) => result.requestId)).toEqual(['first', 'third']);
    expect(report.liveItems?.map((item) => item.status)).toEqual(['completed', 'skipped', 'completed']);
    expect(locations).toContainEqual(['Collection', first.name]);
  });

  it('targets the last request when script flow selects a duplicate name', async () => {
    const first = createBlankRequest('first');
    const duplicateOne = { ...createBlankRequest('duplicate-one'), name: 'Duplicate' };
    const duplicateTwo = { ...createBlankRequest('duplicate-two'), name: 'Duplicate' };
    const seen: string[] = [];
    const report = await runCollection(
      { id: 'collection', name: 'Collection', expanded: true, requests: [first, duplicateOne, duplicateTwo] },
      { id: 'env', name: 'Env', variables: [] },
      { iterations: 1, retries: 0, delayMs: 0, dataRows: [] },
      async (request) => { seen.push(request.id); return { status: 200, statusText: 'OK', headers: {}, body: '{}', durationMs: 1, sizeBytes: 2 }; },
      async (_script, request, environment, response, _timeout, _local, _iteration, options) => ({
        request, environment, logs: [], tests: [],
        execution: response ? options?.execution : { location: [], skipRequest: false, nextRequestIdOrName: request.id === first.id ? 'Duplicate' : '' },
      }),
    );

    expect(seen).toEqual(['first', 'duplicate-two']);
    expect(report.liveItems?.map((item) => item.status)).toEqual(['completed', 'skipped', 'completed']);
  });

  it('marks the remaining plan skipped when a script target cannot be found', async () => {
    const first = createBlankRequest('first');
    const second = createBlankRequest('second');
    const seen: string[] = [];
    const report = await runCollection(
      { id: 'collection', name: 'Collection', expanded: true, requests: [first, second] },
      { id: 'env', name: 'Env', variables: [] },
      { iterations: 1, retries: 0, delayMs: 0, dataRows: [] },
      async (request) => { seen.push(request.id); return { status: 200, statusText: 'OK', headers: {}, body: '{}', durationMs: 1, sizeBytes: 2 }; },
      async (_script, request, environment, response, _timeout, _local, _iteration, options) => ({
        request, environment, logs: [], tests: [],
        execution: response ? options?.execution : { location: [], skipRequest: false, nextRequestIdOrName: request.id === first.id ? 'missing-request' : '' },
      }),
    );

    expect(seen).toEqual(['first']);
    expect(report.liveItems?.map((item) => item.status)).toEqual(['completed', 'skipped']);
    expect(report.liveItems?.[1].errorMessage).toContain("seeking 'missing-request'");
  });

  it('applies script-directed flow only after retry resolution', async () => {
    const first = createBlankRequest('first');
    const second = createBlankRequest('second');
    const third = createBlankRequest('third');
    const seen: string[] = [];
    let calls = 0;
    const report = await runCollection(
      { id: 'collection', name: 'Collection', expanded: true, requests: [first, second, third] },
      { id: 'env', name: 'Env', variables: [] },
      { iterations: 1, retries: 1, delayMs: 0, dataRows: [] },
      async (request) => { seen.push(request.id); return { status: request.id === first.id && ++calls === 1 ? 500 : 200, statusText: 'Result', headers: {}, body: '{}', durationMs: 1, sizeBytes: 2 }; },
      async (_script, request, environment, response, _timeout, _local, _iteration, options) => ({
        request, environment, logs: [], tests: [],
        execution: response ? options?.execution : { location: [], skipRequest: false, nextRequestIdOrName: request.id === first.id ? third.id : '' },
      }),
    );

    expect(seen).toEqual(['first', 'first', 'third']);
    expect(report.results.map((result) => result.status)).toEqual([500, 200, 200]);
    expect(report.liveItems?.map((item) => item.status)).toEqual(['completed', 'skipped', 'completed']);
  });

  it('repeats the current request while scripts target that same item', async () => {
    const first = createBlankRequest('first');
    const second = createBlankRequest('second');
    let firstExecutions = 0;
    const seen: string[] = [];
    const report = await runCollection(
      { id: 'collection', name: 'Collection', expanded: true, requests: [first, second] },
      { id: 'env', name: 'Env', variables: [] },
      { iterations: 1, retries: 0, delayMs: 0, dataRows: [] },
      async (request) => { seen.push(request.id); return { status: 200, statusText: 'OK', headers: {}, body: '{}', durationMs: 1, sizeBytes: 2 }; },
      async (_script, request, environment, response, _timeout, _local, _iteration, options) => {
        if (!response && request.id === first.id) firstExecutions += 1;
        return {
          request, environment, logs: [], tests: [],
          execution: response ? options?.execution : { location: [], skipRequest: false, nextRequestIdOrName: request.id === first.id && firstExecutions === 1 ? first.id : '' },
        };
      },
    );

    expect(seen).toEqual(['first', 'first', 'second']);
    expect(report.results.map((result) => result.requestId)).toEqual(['first', 'first', 'second']);
    expect(report.liveItems?.map((item) => item.status)).toEqual(['completed', 'completed']);
  });

  it('honors pre-request script skip while retaining its next-request target', async () => {
    const first = createBlankRequest('first');
    const second = createBlankRequest('second');
    const third = createBlankRequest('third');
    const seen: string[] = [];
    const report = await runCollection(
      { id: 'collection', name: 'Collection', expanded: true, requests: [first, second, third] },
      { id: 'env', name: 'Env', variables: [] },
      { iterations: 1, retries: 0, delayMs: 0, dataRows: [] },
      async (request) => { seen.push(request.id); return { status: 200, statusText: 'OK', headers: {}, body: '{}', durationMs: 1, sizeBytes: 2 }; },
      async (_script, request, environment, response, _timeout, _local, _iteration, options) => ({
        request, environment, logs: [], tests: [],
        execution: response ? options?.execution : { location: [], skipRequest: request.id === first.id, nextRequestIdOrName: request.id === first.id ? third.id : '' },
      }),
    );

    expect(seen).toEqual(['third']);
    expect(report).toMatchObject({ total: 1, passed: 1, failed: 0, skipped: 2 });
    expect(report.liveItems?.map((item) => item.status)).toEqual(['skipped', 'skipped', 'completed']);
  });

  it('terminates non-converging self-directed request flow at a bounded step limit', async () => {
    const request = createBlankRequest('loop');
    let executions = 0;
    const report = await runCollection(
      { id: 'collection', name: 'Collection', expanded: true, requests: [request] },
      { id: 'env', name: 'Env', variables: [] },
      { iterations: 1, retries: 0, delayMs: 0, dataRows: [], flowStepLimit: 3 },
      async () => { executions += 1; return { status: 200, statusText: 'OK', headers: {}, body: '{}', durationMs: 1, sizeBytes: 2 }; },
      async (_script, activeRequest, environment, response, _timeout, _local, _iteration, options) => ({
        request: activeRequest, environment, logs: [], tests: [],
        execution: response ? options?.execution : { location: [], skipRequest: false, nextRequestIdOrName: request.id },
      }),
    );

    expect(executions).toBe(3);
    expect(report).toMatchObject({ total: 4, passed: 3, failed: 1, flowError: expect.stringContaining('3-step safety limit') });
    expect(report.results.at(-1)).toMatchObject({ attempt: 0, status: 0, passed: false, error: expect.stringContaining('safety limit') });
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
      async () => ({ status: 200, statusText: 'OK', headers, body, durationMs: 1, sizeBytes: new TextEncoder().encode(body).byteLength, timeline: [{ name: 'DataOut', value: body, elapsedMs: 0 }] }),
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
    const timelines = report.results.flatMap((result) => result.timeline ?? []);
    expect(timelines).toHaveLength(70);
    expect(timelines.every((timeline) => timeline.storedBytes <= RUNNER_TIMELINE_PER_RESULT_BYTES)).toBe(true);
    expect(timelines.reduce((total, timeline) => total + timeline.storedBytes, 0)).toBeLessThanOrEqual(RUNNER_TIMELINE_REPORT_BYTES);
    expect(timelines.some((timeline) => timeline.truncated)).toBe(true);
    expect(timelines.at(-1)?.storedBytes).toBe(0);
  });

  it('retains timeline evidence by default and omits it when log retention is disabled', async () => {
    const request = createBlankRequest('timeline');
    const execute = async () => ({
      status: 200,
      statusText: 'OK',
      headers: {},
      body: '{}',
      durationMs: 4,
      sizeBytes: 2,
      timeline: [
        { name: 'Text' as const, value: 'Preparing GET request to https://example.test/orders?access_token=secret&view=full', elapsedMs: 0 },
        { name: 'HeaderOut' as const, value: 'Authorization: Bearer secret\nAccept: application/json', elapsedMs: 0 },
        { name: 'Text' as const, value: 'Redirect 302: https://example.test/orders?token=secret -> https://example.test/final?token=secret', elapsedMs: 2 },
        { name: 'HeaderIn' as const, value: 'HTTP/1.1 200 OK\nSet-Cookie: first=secret\nSet-Cookie: second=secret\nX-Trace: visible', elapsedMs: 4 },
        { name: 'DataIn' as const, value: 'Received 2 B chunk', elapsedMs: Number.NaN, hidden: true },
      ],
    });
    const run = (keepLog?: boolean) => runCollection(
      { id: 'collection', name: 'Collection', expanded: true, requests: [request] },
      { id: 'env', name: 'Env', variables: [] },
      { iterations: 1, retries: 0, delayMs: 0, dataRows: [], keepLog },
      execute,
      async (_script, activeRequest, environment) => ({ request: activeRequest, environment, logs: [], tests: [] }),
    );

    const retained = await run();
    expect(retained.keepLog).toBe(true);
    expect(retained.results[0].timeline).toMatchObject({
      truncated: false,
      entries: [
        { name: 'Text', value: 'Preparing GET request to https://example.test/orders?access_token=%5Bredacted%5D&view=full' },
        { name: 'HeaderOut', value: 'Authorization: [redacted]\nAccept: application/json' },
        { name: 'Text', value: 'Redirect 302: https://example.test/orders?token=%5Bredacted%5D -> https://example.test/final?token=%5Bredacted%5D' },
        { name: 'HeaderIn', value: 'HTTP/1.1 200 OK\nSet-Cookie: [redacted]\nSet-Cookie: [redacted]\nX-Trace: visible' },
        { name: 'DataIn', value: 'Received 2 B chunk', elapsedMs: 0, hidden: true },
      ],
    });
    const disabled = await run(false);
    expect(disabled.keepLog).toBe(false);
    expect(disabled.results[0].timeline).toBeUndefined();
  });

  it('retains and redacts pre-response transport failure timelines', async () => {
    const request = createBlankRequest('transport-failure');
    const failure = Object.assign(new Error('connect failed for https://example.test/orders?token=secret'), {
      durationMs: 23,
      timeline: [
        { name: 'Text' as const, value: 'Preparing GET request to https://example.test/orders?token=secret', elapsedMs: 0 },
        { name: 'HeaderOut' as const, value: 'Authorization: Bearer secret\nX-Trace: visible', elapsedMs: 0 },
        { name: 'Text' as const, value: 'Transport connect: https://example.test/orders?token=secret', elapsedMs: 23 },
      ],
    });
    const report = await runCollection(
      { id: 'collection', name: 'Collection', expanded: true, requests: [request] },
      { id: 'env', name: 'Env', variables: [] },
      { iterations: 1, retries: 0, delayMs: 0, dataRows: [] },
      async () => { throw failure; },
      async (_script, activeRequest, environment) => ({ request: activeRequest, environment, logs: [], tests: [] }),
    );

    expect(report.results[0]).toMatchObject({ status: 0, durationMs: 23, error: 'connect failed for https://example.test/orders?token=%5Bredacted%5D' });
    expect(report.results[0].timeline?.entries).toEqual([
      { name: 'Text', value: 'Preparing GET request to https://example.test/orders?token=%5Bredacted%5D', elapsedMs: 0 },
      { name: 'HeaderOut', value: 'Authorization: [redacted]\nX-Trace: visible', elapsedMs: 0 },
      { name: 'Text', value: 'Transport connect: https://example.test/orders?token=%5Bredacted%5D', elapsedMs: 23 },
    ]);
  });

  it('aggregates retry timelines and errors in execution order with pinned prefixes', () => {
    const result = (id: string, attempt: number, patch: Partial<RunnerItemResult>): RunnerItemResult => ({
      id,
      key: 'item',
      requestId: 'request',
      requestName: attempt < 3 ? 'Retry request' : 'Failed request',
      iteration: 1,
      attempt,
      status: 0,
      durationMs: attempt,
      passed: false,
      tests: [],
      ...patch,
    });
    const timeline = aggregateRunnerTimeline([
      result('first', 1, { timeline: { entries: [{ name: 'HeaderOut', value: 'GET /one', elapsedMs: 0 }, { name: 'DataOut', value: 'one', elapsedMs: 0 }], truncated: false, storedBytes: 11 } }),
      result('second', 2, { timeline: { entries: [{ name: 'HeaderIn', value: 'HTTP/1.1 200 OK', elapsedMs: 2 }, { name: 'SslDataIn', value: 'ignored category evidence', elapsedMs: 2 }], truncated: false, storedBytes: 40 } }),
      result('error', 3, { error: 'connection refused' }),
    ], 'runner flow failed');

    expect(timeline.map((entry) => entry.value)).toEqual([
      '------ Start of request (Retry request) ------',
      'GET /one',
      'one',
      '------ Start of request (Retry request) ------',
      'HTTP/1.1 200 OK',
      'ignored category evidence',
      '------ Start of request (Failed request) ------',
      'connection refused',
      'runner flow failed',
    ]);
    const formatted = formatResponseTimeline(timeline);
    expect(formatted).toContain('* ------ Start of request (Retry request) ------');
    expect(formatted).toContain('> GET /one');
    expect(formatted).toContain('| one');
    expect(formatted).toContain('< HTTP/1.1 200 OK');
    expect(formatted).toContain('<< ignored category evidence');
    expect(formatted.indexOf('> GET /one')).toBeLessThan(formatted.indexOf('< HTTP/1.1 200 OK'));
    expect(formatted).toContain('* connection refused\n* runner flow failed');
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
