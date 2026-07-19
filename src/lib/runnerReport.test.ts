import { describe, expect, it } from 'vitest';
import type { RunnerReport } from '../types';
import { createRunnerReportArtifact, parseRunnerReporter, runnerReporters } from './runnerReport';

const report: RunnerReport = {
  id: 'run<&"',
  collectionId: 'collection',
  collectionName: 'Orders & Billing',
  environmentId: 'environment',
  startedAt: '2026-07-17T12:00:00.000Z',
  finishedAt: '2026-07-17T12:00:01.250Z',
  iterations: 1,
  retries: 1,
  total: 3,
  passed: 1,
  failed: 2,
  cancelled: false,
  results: [
    { id: 'one', requestId: 'request-one', requestName: 'Create <order>', iteration: 1, attempt: 1, status: 201, durationMs: 200, passed: true, tests: [{ name: 'created', passed: true }] },
    { id: 'two', requestId: 'request-two', requestName: 'Read & validate', iteration: 1, attempt: 1, status: 200, durationMs: 300, passed: false, tests: [{ name: 'body <shape>', passed: false, error: 'expected <one> & "two"\u0001\ud800\uffff' }] },
    { id: 'three', requestId: 'request-three', requestName: 'Delete', iteration: 1, attempt: 1, status: 0, durationMs: 150, passed: false, error: 'connect\nrefused', tests: [] },
  ],
};

describe('runner report artifacts', () => {
  it('creates a versioned machine-readable JSON artifact', () => {
    const artifact = createRunnerReportArtifact(report, 'json');
    expect(artifact.fileName).toBe('orders-billing-run-20260717T120000Z.json');
    expect(artifact.mimeType).toBe('application/json');
    expect(JSON.parse(artifact.contents)).toMatchObject({ format: 'brunomnia-run-report', version: 1, report: { id: report.id, failed: 2 } });
  });

  it('creates XML-safe JUnit with separate failures and runner errors', () => {
    const artifact = createRunnerReportArtifact(report, 'junit');
    expect(artifact.fileName).toMatch(/\.junit\.xml$/);
    expect(artifact.contents).toContain('tests="3" failures="1" errors="1"');
    expect(artifact.contents).toContain('Create &lt;order&gt;');
    expect(artifact.contents).toContain('<failure type="assertion"');
    expect(artifact.contents).toContain('<error type="runner" message="connect&#10;refused"');
    expect(artifact.contents).toContain('expected &lt;one&gt; &amp; "two"���');
    expect(artifact.contents).not.toContain('\u0001');
    expect(artifact.contents).not.toContain('\ud800');
    expect(artifact.contents).not.toContain('\uffff');
  });

  it('formats spec and TAP reports with actionable failure detail', () => {
    const spec = createRunnerReportArtifact(report, 'spec').contents;
    expect(spec).toContain('✖ Read & validate (iteration 1, attempt 1)');
    expect(spec).toContain('body <shape>: expected <one> & "two"���');
    expect(spec).toContain('1 passed, 2 failed, 3 total (1250 ms)');

    const tap = createRunnerReportArtifact(report, 'tap').contents;
    expect(tap).toContain('TAP version 13\n1..3');
    expect(tap).toContain('ok 1 - Create <order>');
    expect(tap).toContain('not ok 3 - Delete');
    expect(tap).toContain('message: "connect refused"');
  });

  it('supports every documented Inso reporter name plus JSON and JUnit', () => {
    expect(runnerReporters).toEqual(['dot', 'list', 'min', 'progress', 'spec', 'tap', 'json', 'junit']);
    expect(createRunnerReportArtifact(report, 'dot').contents).toBe('.!!\n1 passed, 2 failed, 3 total (1250 ms)\n');
    expect(createRunnerReportArtifact(report, 'list').contents).toContain('FAIL Read & validate');
    expect(createRunnerReportArtifact(report, 'min').contents).toBe('1 passed, 2 failed, 3 total (1250 ms)\n');
    expect(createRunnerReportArtifact(report, 'progress').contents).toContain('[=======-------------]');
  });

  it('reports the applied test-name pattern match count', () => {
    const filtered = { ...report, testNamePattern: '^body', matchedTests: 1 };
    expect(createRunnerReportArtifact(filtered, 'min').contents).toBe('1 passed, 2 failed, 3 total, 1 matched tests (1250 ms)\n');
    expect(JSON.parse(createRunnerReportArtifact(filtered, 'json').contents).report).toMatchObject({ testNamePattern: '^body', matchedTests: 1 });
  });

  it('preserves skipped and canceled live items across reporters', () => {
    const controlled: RunnerReport = {
      ...report,
      skipped: 1,
      canceled: 1,
      cancelled: true,
      liveItems: [
        { key: 'skip', iteration: 1, requestId: 'skip', requestName: 'Skip me', requestUrl: '', status: 'skipped', errorMessage: 'Skipped by user.' },
        { key: 'cancel', iteration: 1, requestId: 'cancel', requestName: 'Cancel me', requestUrl: '', status: 'canceled', errorMessage: 'Canceled by user.' },
      ],
    };

    expect(createRunnerReportArtifact(controlled, 'min').contents).toContain('1 skipped, 1 canceled');
    expect(createRunnerReportArtifact(controlled, 'dot').contents).toMatch(/^\.!!sc\n/);
    expect(createRunnerReportArtifact(controlled, 'tap').contents).toContain('1..5');
    expect(createRunnerReportArtifact(controlled, 'tap').contents).toContain('# SKIP canceled');
    const junit = createRunnerReportArtifact(controlled, 'junit').contents;
    expect(junit).toContain('tests="5" failures="1" errors="1" skipped="2"');
    expect(junit).toContain('<skipped message="Skipped by user." />');
  });

  it('rejects unknown reporter names with the supported inventory', () => {
    expect(parseRunnerReporter(undefined, 'spec')).toBe('spec');
    expect(parseRunnerReporter('tap')).toBe('tap');
    expect(() => parseRunnerReporter('html')).toThrow("Unknown runner reporter 'html'. Choose dot, list, min, progress, spec, tap, json, junit.");
  });
});
