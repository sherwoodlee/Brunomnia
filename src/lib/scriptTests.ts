import type { ScriptTestCategory, ScriptTestResult, ScriptTestStatus } from '../types';

export const scriptTestStatus = (test: ScriptTestResult): ScriptTestStatus => test.status ?? (test.passed ? 'passed' : 'failed');

export const scriptTestPassed = (test: ScriptTestResult) => scriptTestStatus(test) === 'passed';

export const scriptTestFailed = (test: ScriptTestResult) => scriptTestStatus(test) === 'failed';

export const scriptTestSkipped = (test: ScriptTestResult) => scriptTestStatus(test) === 'skipped';

export const scriptTestCategoryLabel = (category: ScriptTestCategory | undefined) => category === 'pre-request'
  ? 'Pre-request Test'
  : category === 'after-response'
    ? 'After-response Test'
    : 'Unknown';

export const scriptTestDurationLabel = (durationMs: number | undefined) => {
  if (durationMs === undefined || !Number.isFinite(durationMs)) return 'Timing unavailable';
  const bounded = Math.max(0, durationMs);
  return `${bounded === 0 ? '< 0.1' : bounded.toFixed(1)} ms`;
};
