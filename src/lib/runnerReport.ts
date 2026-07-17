import type { RunnerItemResult, RunnerReport } from '../types';

export const runnerReporters = ['dot', 'list', 'min', 'progress', 'spec', 'tap', 'json', 'junit'] as const;

export type RunnerReporter = (typeof runnerReporters)[number];

export type RunnerReportArtifact = {
  contents: string;
  fileName: string;
  mimeType: string;
};

const cleanText = (value: unknown) => Array.from(String(value ?? ''), (character) => {
  const point = character.codePointAt(0) ?? 0;
  const xmlCharacter = point === 0x09 || point === 0x0a || point === 0x0d
    || (point >= 0x20 && point <= 0xd7ff)
    || (point >= 0xe000 && point <= 0xfffd)
    || (point >= 0x10000 && point <= 0x10ffff);
  return xmlCharacter && point !== 0x7f ? character : '�';
}).join('');
const xmlText = (value: unknown) => cleanText(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const xmlAttribute = (value: unknown) => xmlText(value).replaceAll('"', '&quot;').replaceAll("'", '&apos;').replaceAll('\t', '&#9;').replaceAll('\n', '&#10;').replaceAll('\r', '&#13;');
const seconds = (milliseconds: number) => (Math.max(0, milliseconds) / 1000).toFixed(3);
const resultLabel = (result: RunnerItemResult) => `${result.requestName} (iteration ${result.iteration}, attempt ${result.attempt})`;
const runDuration = (report: RunnerReport) => {
  const duration = Date.parse(report.finishedAt) - Date.parse(report.startedAt);
  return Number.isFinite(duration) && duration >= 0 ? duration : report.results.reduce((total, result) => total + Math.max(0, result.durationMs), 0);
};

const failureDetails = (result: RunnerItemResult) => {
  if (result.error) return result.error;
  const failedTests = result.tests.filter((test) => !test.passed);
  if (failedTests.length) return failedTests.map((test) => `${test.name}: ${test.error || 'assertion failed'}`).join('\n');
  if (result.status <= 0) return 'The request did not return a response.';
  if (result.status >= 400) return `HTTP status ${result.status}.`;
  return 'The runner marked this attempt as failed.';
};

const summary = (report: RunnerReport) => `${report.passed} passed, ${report.failed} failed, ${report.total} total${report.cancelled ? ', cancelled' : ''}${report.bailed ? ', bailed' : ''} (${runDuration(report)} ms)`;

const specReport = (report: RunnerReport) => {
  const lines = [report.collectionName];
  report.results.forEach((result) => {
    lines.push(`  ${result.passed ? '✓' : '✖'} ${resultLabel(result)} (${result.durationMs} ms)`);
    if (!result.passed) cleanText(failureDetails(result)).split('\n').forEach((detail) => lines.push(`    ${detail}`));
  });
  lines.push('', summary(report));
  return `${lines.join('\n')}\n`;
};

const tapLine = (value: string) => cleanText(value).replace(/\r?\n/g, ' ');
const tapReport = (report: RunnerReport) => {
  const lines = ['TAP version 13', `1..${report.total}`];
  report.results.forEach((result, index) => {
    lines.push(`${result.passed ? 'ok' : 'not ok'} ${index + 1} - ${tapLine(resultLabel(result))}`);
    if (!result.passed) {
      lines.push('  ---');
      lines.push(`  message: ${JSON.stringify(tapLine(failureDetails(result)))}`);
      lines.push(`  status: ${result.status}`);
      lines.push(`  duration_ms: ${Math.max(0, result.durationMs)}`);
      lines.push('  ...');
    }
  });
  lines.push(`# ${summary(report)}`);
  return `${lines.join('\n')}\n`;
};

const junitReport = (report: RunnerReport) => {
  const errors = report.results.filter((result) => Boolean(result.error)).length;
  const failures = report.results.filter((result) => !result.passed && !result.error).length;
  const cases = report.results.map((result) => {
    const attributes = `name="${xmlAttribute(resultLabel(result))}" classname="${xmlAttribute(report.collectionName)}" time="${seconds(result.durationMs)}"`;
    if (result.passed) return `    <testcase ${attributes} />`;
    const details = xmlText(failureDetails(result));
    if (result.error) return `    <testcase ${attributes}>\n      <error type="runner" message="${xmlAttribute(result.error)}">${details}</error>\n    </testcase>`;
    return `    <testcase ${attributes}>\n      <failure type="assertion" message="${xmlAttribute(failureDetails(result).split('\n')[0])}">${details}</failure>\n    </testcase>`;
  });
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<testsuites name="${xmlAttribute(report.collectionName)}" tests="${report.total}" failures="${failures}" errors="${errors}" time="${seconds(runDuration(report))}">`,
    `  <testsuite name="${xmlAttribute(report.collectionName)}" id="${xmlAttribute(report.id)}" tests="${report.total}" failures="${failures}" errors="${errors}" skipped="0" time="${seconds(runDuration(report))}" timestamp="${xmlAttribute(report.startedAt)}">`,
    ...cases,
    '  </testsuite>',
    '</testsuites>',
    '',
  ].join('\n');
};

const reportContents = (report: RunnerReport, reporter: RunnerReporter) => {
  if (reporter === 'json') return `${JSON.stringify({ format: 'brunomnia-run-report', version: 1, report }, null, 2)}\n`;
  if (reporter === 'junit') return junitReport(report);
  if (reporter === 'tap') return tapReport(report);
  if (reporter === 'spec') return specReport(report);
  if (reporter === 'min') return `${summary(report)}\n`;
  if (reporter === 'dot') return `${report.results.map((result) => result.passed ? '.' : '!').join('')}\n${summary(report)}\n`;
  if (reporter === 'progress') {
    const width = 20;
    const complete = report.total ? Math.round((report.passed / report.total) * width) : 0;
    return `[${'='.repeat(complete)}${'-'.repeat(width - complete)}] ${summary(report)}\n`;
  }
  return `${report.results.map((result) => `${result.passed ? 'PASS' : 'FAIL'} ${cleanText(resultLabel(result))} ${result.durationMs} ms${result.passed ? '' : ` — ${cleanText(failureDetails(result)).replace(/\r?\n/g, '; ')}`}`).join('\n')}\n${summary(report)}\n`;
};

export const parseRunnerReporter = (value: string | undefined, fallback: RunnerReporter = 'json'): RunnerReporter => {
  if (!value) return fallback;
  if ((runnerReporters as readonly string[]).includes(value)) return value as RunnerReporter;
  throw new Error(`Unknown runner reporter '${value}'. Choose ${runnerReporters.join(', ')}.`);
};

export const createRunnerReportArtifact = (report: RunnerReport, reporter: RunnerReporter): RunnerReportArtifact => {
  const slug = report.collectionName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'collection';
  const timestamp = report.startedAt.replace(/\.\d{3}Z$/, 'Z').replace(/[^0-9TZ]/g, '');
  const extension = reporter === 'json' ? 'json' : reporter === 'junit' ? 'junit.xml' : reporter === 'tap' ? 'tap' : 'txt';
  const mimeType = reporter === 'json' ? 'application/json' : reporter === 'junit' ? 'application/xml' : 'text/plain';
  return { contents: reportContents(report, reporter), fileName: `${slug}-run-${timestamp}.${extension}`, mimeType };
};
