import type { ScriptTestResult } from '../types';
import { filterScriptTests, scriptTestCategoryLabel, scriptTestDurationLabel, scriptTestStatus, type ScriptTestFilter } from '../lib/scriptTests';

type RunnerAssertionEvidenceProps = {
  tests: ScriptTestResult[];
  statusFilter?: ScriptTestFilter;
  nameFilter?: string;
};

export function RunnerAssertionEvidence({ tests, statusFilter = 'all', nameFilter = '' }: RunnerAssertionEvidenceProps) {
  const visibleTests = filterScriptTests(tests, statusFilter, nameFilter);
  const failed = visibleTests.filter((test) => scriptTestStatus(test) === 'failed').length;
  const skipped = visibleTests.filter((test) => scriptTestStatus(test) === 'skipped').length;
  const passed = visibleTests.length - failed - skipped;
  const summary = tests.length ? [`${visibleTests.length}/${tests.length} shown`, `${passed} passed`, `${failed} failed`, skipped ? `${skipped} skipped` : ''].filter(Boolean).join(' · ') : 'No assertions recorded';

  return (
    <section aria-label="Assertion evidence" className="runner-assertion-evidence">
      <header><small>Script assertions</small><strong>{summary}</strong></header>
      {tests.length ? <div className="runner-assertion-list" role="list">{visibleTests.map((test, index) => {
        const status = scriptTestStatus(test);
        return <article className={status} key={`${test.name}-${index}`} role="listitem">
          <span className="runner-assertion-status">{status === 'passed' ? 'PASS' : status === 'skipped' ? 'SKIP' : 'FAIL'}</span>
          <div><strong>{test.name || `Assertion ${index + 1}`}</strong><small className="runner-assertion-meta">{scriptTestCategoryLabel(test.category)} (<span className={test.durationMs !== undefined && test.durationMs >= 300 ? 'slow' : ''}>{scriptTestDurationLabel(test.durationMs)}</span>)</small>{test.error ? <pre>{test.error}</pre> : status === 'failed' ? <small>No error message was recorded.</small> : null}</div>
        </article>;
      })}{!visibleTests.length ? <p>No matching assertions.</p> : null}</div> : <p>No script assertions were recorded for this attempt.</p>}
    </section>
  );
}
