import type { ScriptTestResult } from '../types';
import { scriptTestCategoryLabel, scriptTestDurationLabel, scriptTestStatus } from '../lib/scriptTests';

type RunnerAssertionEvidenceProps = {
  tests: ScriptTestResult[];
};

export function RunnerAssertionEvidence({ tests }: RunnerAssertionEvidenceProps) {
  const failed = tests.filter((test) => scriptTestStatus(test) === 'failed').length;
  const skipped = tests.filter((test) => scriptTestStatus(test) === 'skipped').length;
  const passed = tests.length - failed - skipped;
  const summary = tests.length ? [`${tests.length} ${tests.length === 1 ? 'assertion' : 'assertions'}`, `${passed} passed`, `${failed} failed`, skipped ? `${skipped} skipped` : ''].filter(Boolean).join(' · ') : 'No assertions recorded';

  return (
    <section aria-label="Assertion evidence" className="runner-assertion-evidence">
      <header><small>Script assertions</small><strong>{summary}</strong></header>
      {tests.length ? <div className="runner-assertion-list" role="list">{tests.map((test, index) => {
        const status = scriptTestStatus(test);
        return <article className={status} key={`${test.name}-${index}`} role="listitem">
          <span className="runner-assertion-status">{status === 'passed' ? 'PASS' : status === 'skipped' ? 'SKIP' : 'FAIL'}</span>
          <div><strong>{test.name || `Assertion ${index + 1}`}</strong><small className="runner-assertion-meta">{scriptTestCategoryLabel(test.category)} (<span className={test.durationMs !== undefined && test.durationMs >= 300 ? 'slow' : ''}>{scriptTestDurationLabel(test.durationMs)}</span>)</small>{test.error ? <pre>{test.error}</pre> : status === 'failed' ? <small>No error message was recorded.</small> : null}</div>
        </article>;
      })}</div> : <p>No script assertions were recorded for this attempt.</p>}
    </section>
  );
}
