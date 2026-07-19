import { describe, expect, it } from 'vitest';
import { createBlankRequest } from '../data/seed';
import { applyRunnerEnvironmentOverrides, buildRunnerCliCommand, loadRunnerIterationData, normalizeRunnerInsoConfig, parseRunnerRequestTimeout, quotePosixShellArgument, resolveRunnerItemRequestIds, runnerCliPositionalArguments, runnerRequestIdsMatchingPattern, validateRunnerRequestNamePattern } from './runnerCli';

describe('Runner CLI command preview', () => {
  it('preserves selected request order and every execution control', () => {
    expect(buildRunnerCliCommand({
      workspacePath: '/tmp/My Projects/orders',
      collectionId: 'collection-orders',
      environmentId: 'environment-local',
      requestIds: ['request-third', 'request-first'],
      iterations: 4,
      retries: 2,
      delayMs: 125,
      dataPath: '/tmp/iteration data.csv',
      bail: true,
    })).toBe("brunomnia run collection collection-orders --workingDir '/tmp/My Projects/orders' --env environment-local --item request-third --item request-first --iteration-count 4 --retries 2 --delay-request 125 --iteration-data '/tmp/iteration data.csv' --bail");
  });

  it('omits default controls and bounds numeric input like the runner', () => {
    expect(buildRunnerCliCommand({
      workspacePath: 'workspace.json',
      collectionId: 'collection',
      environmentId: 'environment',
      requestIds: ['request'],
      iterations: Number.NaN,
      retries: -8,
      delayMs: 100_000,
      bail: false,
    })).toBe('brunomnia run collection collection --workingDir workspace.json --env environment --item request --delay-request 30000');
  });

  it('quotes empty, whitespace, apostrophe, and shell-control values', () => {
    expect(quotePosixShellArgument('')).toBe("''");
    expect(quotePosixShellArgument("/tmp/Sam's data.csv")).toBe("'/tmp/Sam'\"'\"'s data.csv'");
    expect(quotePosixShellArgument('$(touch nope)')).toBe("'$(touch nope)'");
  });

  it('applies repeated Inso-style environment overrides to every data row', () => {
    const rows = [{ row: '1', region: 'file' }, { row: '2', region: 'file' }];
    expect(applyRunnerEnvironmentOverrides(rows, ['region=first', 'region=override', 'token=a%2Bb', 'label=hello+world'])).toEqual([
      { row: '1', region: 'override', token: 'a+b', label: 'hello world' },
      { row: '2', region: 'override', token: 'a+b', label: 'hello world' },
    ]);
    expect(applyRunnerEnvironmentOverrides([], ['missing=', 'flag'])).toEqual([{ missing: '', flag: '' }]);
    expect(applyRunnerEnvironmentOverrides(rows, [])).toBe(rows);
  });

  it('filters the full or selected request plan with an Inso-style name pattern', () => {
    const requests = [
      { id: 'first', name: 'Get first' },
      { id: 'second', name: 'Post second' },
      { id: 'third', name: 'Get third' },
    ];
    expect(runnerRequestIdsMatchingPattern(requests, undefined, '^Get ')).toEqual(['first', 'third']);
    expect(runnerRequestIdsMatchingPattern(requests, ['third', 'second', 'first'], '^Get ')).toEqual(['third', 'first']);
    expect(runnerRequestIdsMatchingPattern(requests, ['missing', 'second'], '^Get ')).toEqual([]);
    expect(validateRunnerRequestNamePattern('^Post (?:first|second)$')).toBe('^Post (?:first|second)$');
    expect(() => validateRunnerRequestNamePattern('[')).toThrow(/Invalid request name pattern/);
    expect(() => validateRunnerRequestNamePattern('x'.repeat(1_001))).toThrow(/1,000 characters/);
  });

  it('expands pinned folder items recursively in tree order and de-duplicates mixed selections', () => {
    const request = (id: string, name: string, folderId = '') => ({ ...createBlankRequest(id), name, folderId });
    const collection = {
      id: 'collection', name: 'Collection', expanded: true,
      folders: [
        { id: 'folder', name: 'Folder', parentId: '', expanded: true, headers: [], environment: [], preRequestScript: '', tests: '', documentation: '' },
        { id: 'nested', name: 'Nested', parentId: 'folder', expanded: true, headers: [], environment: [], preRequestScript: '', tests: '', documentation: '' },
        { id: 'empty', name: 'Empty', parentId: '', expanded: true, headers: [], environment: [], preRequestScript: '', tests: '', documentation: '' },
      ],
      requests: [request('root', 'Root'), request('first', 'First', 'folder'), request('nested-request', 'Nested request', 'nested'), request('last', 'Last', 'folder')],
      resourceOrder: ['root', 'folder', 'first', 'nested', 'nested-request', 'last', 'empty'],
    };
    expect(resolveRunnerItemRequestIds(collection, ['folder', 'root', 'nested-request'])).toEqual(['first', 'nested-request', 'last', 'root']);
    expect(resolveRunnerItemRequestIds(collection, ['empty'])).toEqual([]);
    expect(() => resolveRunnerItemRequestIds(collection, ['missing'])).toThrow(/Item 'missing' was not found/);
    const cyclic = { ...collection, folders: collection.folders.map((folder) => folder.id === 'folder' ? { ...folder, parentId: 'nested' } : folder) };
    expect(resolveRunnerItemRequestIds(cyclic, ['folder'])).toEqual(['first', 'nested-request', 'last']);
  });

  it('parses pinned request timeout overrides with desktop bounds and fallback', () => {
    expect(parseRunnerRequestTimeout(undefined, 12_345)).toBe(12_345);
    expect(parseRunnerRequestTimeout('3000', 10)).toBe(3_000);
    expect(parseRunnerRequestTimeout('1000ms', 10)).toBe(1_000);
    expect(parseRunnerRequestTimeout('0', 10)).toBe(0);
    expect(parseRunnerRequestTimeout('-5', 10)).toBe(0);
    expect(parseRunnerRequestTimeout('9999999999', 10)).toBe(2_147_483_647);
    expect(() => parseRunnerRequestTimeout('later', 10)).toThrow(/Invalid request timeout/);
  });

  it('loads bounded local or explicit HTTP iteration data', async () => {
    await expect(loadRunnerIterationData('/tmp/data.csv', async (path) => `local:${path}`, fetch, 100)).resolves.toBe('local:/tmp/data.csv');
    await expect(loadRunnerIterationData('http-data.csv', async (path) => `local:${path}`, fetch, 100)).resolves.toBe('local:http-data.csv');
    await expect(loadRunnerIterationData('https://example.test/data.csv', async () => '', async () => new Response('row\n1\n'), 100)).resolves.toBe('row\n1\n');
    await expect(loadRunnerIterationData('https://example.test/missing.csv', async () => '', async () => new Response('missing', { status: 404 }), 100)).rejects.toThrow(/HTTP 404/);
    await expect(loadRunnerIterationData('https://example.test/large.csv', async () => '', async () => new Response('123456789'), 8)).rejects.toThrow(/5 MB/);
    await expect(loadRunnerIterationData('/tmp/large.csv', async () => '123456789', fetch, 8)).rejects.toThrow(/5 MB/);
  });

  it('extracts legacy and pinned run positionals around options', () => {
    expect(runnerCliPositionalArguments(['workspace.json', 'collection', '--item', 'request', '-b'])).toEqual(['workspace.json', 'collection']);
    expect(runnerCliPositionalArguments(['collection', '-w', '/tmp/project', '--env', 'staging', '--requestTimeout', '5000'])).toEqual(['collection']);
    expect(runnerCliPositionalArguments(['--config', '/tmp/.insorc', '--ci', '--workingDir', '/tmp/project', '--allow-scripts', 'suite'])).toEqual(['suite']);
  });

  it('keeps only bounded pinned config options and script strings', () => {
    expect(normalizeRunnerInsoConfig({
      options: { workingDir: '/tmp/project', ci: true, verbose: false, printOptions: true, ignored: 'value' },
      scripts: { test: 'inso run test suite', invalid: 42 },
      ignored: true,
    })).toEqual({
      options: { workingDir: '/tmp/project', ci: true, verbose: false, printOptions: true },
      scripts: { test: 'inso run test suite' },
    });
    expect(normalizeRunnerInsoConfig(undefined)).toEqual({ options: {}, scripts: {} });
    const bounded = normalizeRunnerInsoConfig({ scripts: Object.fromEntries(Array.from({ length: 102 }, (_, index) => [`script-${index}`, 'inso run test'])) });
    expect(Object.keys(bounded.scripts)).toHaveLength(100);
    expect(normalizeRunnerInsoConfig({ scripts: { ['x'.repeat(201)]: 'inso run test', valid: 'x'.repeat(10_001) } }).scripts).toEqual({});
  });
});
