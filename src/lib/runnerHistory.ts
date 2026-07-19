import type { RunnerReport } from '../types';
import { scriptTestStatus } from './scriptTests';

export const runnerReportDurationMs = (report: RunnerReport) => {
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

export const summarizeRunnerHistory = (report: RunnerReport) => {
  let passed = 0;
  let failed = 0;
  let skipped = 0;
  report.results.forEach((result) => result.tests.forEach((test) => {
    const status = scriptTestStatus(test);
    if (status === 'passed') passed += 1;
    else if (status === 'failed') failed += 1;
    else skipped += 1;
  }));
  const durationMs = runnerReportDurationMs(report);
  return { durationMs, duration: formatRunnerDuration(durationMs), total: passed + failed + skipped, passed, failed, skipped };
};
