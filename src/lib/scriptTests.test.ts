import { describe, expect, it } from 'vitest';
import { scriptTestCategoryLabel, scriptTestDurationLabel, scriptTestFailed, scriptTestPassed, scriptTestSkipped, scriptTestStatus } from './scriptTests';

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
});
