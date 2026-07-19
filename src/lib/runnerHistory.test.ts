import { describe, expect, it } from 'vitest';
import type { RunnerReport } from '../types';
import { formatRunnerDuration, formatRunnerHistoryTimestamp, runnerReportDurationMs, summarizeRunnerAssertions, summarizeRunnerHistory } from './runnerHistory';

const report = (patch: Partial<RunnerReport> = {}): RunnerReport => ({
  id: 'run',
  collectionId: 'collection',
  collectionName: 'Orders',
  environmentId: 'environment',
  startedAt: '2026-07-19T18:00:00.000Z',
  finishedAt: '2026-07-19T18:01:01.234Z',
  durationMs: 50,
  iterations: 1,
  retries: 0,
  total: 2,
  passed: 1,
  failed: 1,
  cancelled: false,
  results: [
    { id: 'one', requestId: 'one', requestName: 'One', iteration: 1, attempt: 1, status: 200, durationMs: 20, passed: true, tests: [{ name: 'passes', passed: true, status: 'passed' }, { name: 'skips', passed: false, status: 'skipped' }] },
    { id: 'two', requestId: 'two', requestName: 'Two', iteration: 1, attempt: 1, status: 500, durationMs: 30, passed: false, tests: [{ name: 'fails', passed: false, status: 'failed' }, { name: 'legacy pass', passed: true }] },
  ],
  ...patch,
});

describe('Runner history presentation', () => {
  it('formats local timestamps with the pinned fixed field order', () => {
    const local = new Date(2026, 6, 9, 4, 5, 6);
    expect(formatRunnerHistoryTimestamp(local)).toBe('2026-07-09 04:05:06');
    expect(formatRunnerHistoryTimestamp(local.toISOString())).toBe('2026-07-09 04:05:06');
    expect(formatRunnerHistoryTimestamp('invalid')).toBe('Invalid date');
  });

  it('counts retained assertions rather than request attempts', () => {
    expect(summarizeRunnerHistory(report())).toEqual({ durationMs: 50, duration: '50 ms', total: 4, passed: 2, failed: 1, skipped: 1 });
  });

  it('marks the Results badge green only when every retained assertion passed', () => {
    expect(summarizeRunnerAssertions([])).toEqual({ total: 0, passed: 0, failed: 0, skipped: 0, tone: 'neutral' });
    expect(summarizeRunnerAssertions(report().results.slice(0, 1))).toEqual({ total: 2, passed: 1, failed: 0, skipped: 1, tone: 'failed' });
    expect(summarizeRunnerAssertions([{ ...report().results[0], tests: [{ name: 'one', passed: true }, { name: 'two', passed: true, status: 'passed' }] }])).toEqual({ total: 2, passed: 2, failed: 0, skipped: 0, tone: 'passed' });
  });

  it('uses strict time-unit thresholds and magnitude-based precision', () => {
    expect(formatRunnerDuration(1_000)).toBe('1000 ms');
    expect(formatRunnerDuration(1_001)).toBe('1 s');
    expect(formatRunnerDuration(10_550)).toBe('10.6 s');
    expect(formatRunnerDuration(60_000)).toBe('60 s');
    expect(formatRunnerDuration(60_001)).toBe('1 m');
    expect(formatRunnerDuration(6_060_000)).toBe('101 m');
  });

  it('falls back to summed nonnegative attempt durations for invalid timestamps', () => {
    const invalid = report({ durationMs: undefined, startedAt: 'invalid', finishedAt: 'invalid', results: [
      { id: 'one', requestId: 'one', requestName: 'One', iteration: 1, attempt: 1, status: 0, durationMs: -5, passed: false, tests: [] },
      { id: 'two', requestId: 'two', requestName: 'Two', iteration: 1, attempt: 1, status: 200, durationMs: 12.5, passed: true, tests: [] },
    ] });

    expect(runnerReportDurationMs(invalid)).toBe(12.5);
    expect(summarizeRunnerHistory(invalid)).toMatchObject({ duration: '12.5 ms', total: 0, passed: 0, failed: 0, skipped: 0 });
  });

  it('retains the legacy wall-clock fallback when an older report has no explicit duration', () => {
    expect(runnerReportDurationMs(report({ durationMs: undefined }))).toBe(61_234);
  });
});
