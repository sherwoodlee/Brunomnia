import { describe, expect, it } from 'vitest';
import { filterScriptTests, scriptTestCategoryLabel, scriptTestDurationLabel, scriptTestFailed, scriptTestNameMatches, scriptTestPassed, scriptTestSkipped, scriptTestStatus } from './scriptTests';

describe('script test evidence', () => {
  it('resolves current and legacy assertion statuses', () => {
    expect(scriptTestStatus({ name: 'legacy pass', passed: true })).toBe('passed');
    expect(scriptTestStatus({ name: 'legacy fail', passed: false })).toBe('failed');
    const skipped = { name: 'later', passed: false, status: 'skipped' as const };
    expect(scriptTestSkipped(skipped)).toBe(true);
    expect(scriptTestPassed(skipped)).toBe(false);
    expect(scriptTestFailed(skipped)).toBe(false);
  });

  it('formats pinned category and execution-time labels', () => {
    expect(scriptTestCategoryLabel('pre-request')).toBe('Pre-request Test');
    expect(scriptTestCategoryLabel('after-response')).toBe('After-response Test');
    expect(scriptTestCategoryLabel(undefined)).toBe('Unknown');
    expect(scriptTestDurationLabel(0)).toBe('< 0.1 ms');
    expect(scriptTestDurationLabel(12.345)).toBe('12.3 ms');
    expect(scriptTestDurationLabel(undefined)).toBe('Timing unavailable');
  });

  it('filters assertion rows by exact status and pinned fuzzy name matching', () => {
    const tests = [
      { name: 'creates the order', passed: true, status: 'passed' as const },
      { name: 'returns invoice', passed: false, status: 'failed' as const },
      { name: 'production only', passed: false, status: 'skipped' as const },
    ];

    expect(filterScriptTests(tests, 'all', '')).toEqual(tests);
    expect(filterScriptTests(tests, 'passed', '').map((test) => test.name)).toEqual(['creates the order']);
    expect(filterScriptTests(tests, 'failed', 'return inv').map((test) => test.name)).toEqual(['returns invoice']);
    expect(filterScriptTests(tests, 'failed', 'rtns inv')).toEqual([]);
    expect(filterScriptTests(tests, 'skipped', 'PROD').map((test) => test.name)).toEqual(['production only']);
    expect(filterScriptTests(tests, 'all', 'request error')).toEqual([]);
    expect(scriptTestNameMatches('tst', 'testing')).toBe(true);
    expect(scriptTestNameMatches('foo', 'bar')).toBe(false);
  });
});
