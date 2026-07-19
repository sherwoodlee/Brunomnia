import fuzzysort from 'fuzzysort';
import type { ScriptTestCategory, ScriptTestResult, ScriptTestStatus } from '../types';

export type ScriptTestFilter = 'all' | ScriptTestStatus;

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

export const scriptTestNameMatches = (query: string, name: string) => {
  if (!query.trim()) return true;
  const match = fuzzysort.single(query, name);
  return Boolean(match && match.score >= -8_000);
};

export const filterScriptTests = (tests: ScriptTestResult[], filter: ScriptTestFilter, query: string) => tests.filter((test) => {
  const matchesStatus = filter === 'all' || scriptTestStatus(test) === filter;
  return matchesStatus && scriptTestNameMatches(query, test.name);
});
