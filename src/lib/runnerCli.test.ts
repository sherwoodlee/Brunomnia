import { describe, expect, it } from 'vitest';
import { applyRunnerEnvironmentOverrides, buildRunnerCliCommand, quotePosixShellArgument } from './runnerCli';

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
    })).toBe("brunomnia run collection '/tmp/My Projects/orders' collection-orders --env environment-local --request request-third --request request-first --iterations 4 --retries 2 --delay-request 125 --data '/tmp/iteration data.csv' --bail");
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
    })).toBe('brunomnia run collection workspace.json collection --env environment --request request --delay-request 30000');
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
});
