import type { RunnerItemResult, RunnerReport } from '../types';
import { scriptTestStatus } from './scriptTests';

const padTimestampPart = (value: number) => String(value).padStart(2, '0');

export const formatRunnerHistoryTimestamp = (value: string | number | Date) => {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Invalid date';
  return `${date.getFullYear()}-${padTimestampPart(date.getMonth() + 1)}-${padTimestampPart(date.getDate())} ${padTimestampPart(date.getHours())}:${padTimestampPart(date.getMinutes())}:${padTimestampPart(date.getSeconds())}`;
};

export const runnerReportDurationMs = (report: RunnerReport) => {
  if (typeof report.durationMs === 'number' && Number.isFinite(report.durationMs) && report.durationMs >= 0) return report.durationMs;
  const duration = Date.parse(report.finishedAt) - Date.parse(report.startedAt);
  return Number.isFinite(duration) && duration >= 0 ? duration : report.results.reduce((total, result) => total + Math.max(0, result.durationMs), 0);
};

export const formatRunnerDuration = (milliseconds: number) => {
  let unit = 'ms';
  let number = milliseconds;
  if (milliseconds > 60_000) {
    unit = 'm';
    number = milliseconds / 60_000;
  } else if (milliseconds > 1_000) {
    unit = 's';
    number = milliseconds / 1_000;
  }
  if (number > 100) number = Math.round(number);
  else if (number > 10) number = Math.round(number * 10) / 10;
  else number = Math.round(number * 100) / 100;
  return `${number} ${unit}`;
};

export const summarizeRunnerAssertions = (results: RunnerItemResult[]) => {
  let passed = 0;
  let failed = 0;
  let skipped = 0;
  results.forEach((result) => result.tests.forEach((test) => {
    const status = scriptTestStatus(test);
    if (status === 'passed') passed += 1;
    else if (status === 'failed') failed += 1;
    else skipped += 1;
  }));
  const total = passed + failed + skipped;
  const tone = total === 0 ? 'neutral' : passed === total ? 'passed' : 'failed';
  return { total, passed, failed, skipped, tone } as const;
};

export const summarizeRunnerHistory = (report: RunnerReport) => {
  const assertions = summarizeRunnerAssertions(report.results);
  const durationMs = runnerReportDurationMs(report);
  return { durationMs, duration: formatRunnerDuration(durationMs), total: assertions.total, passed: assertions.passed, failed: assertions.failed, skipped: assertions.skipped };
};
