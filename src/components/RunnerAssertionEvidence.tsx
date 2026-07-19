import type { ScriptTestResult } from '../types';

type RunnerAssertionEvidenceProps = {
  tests: ScriptTestResult[];
};

export function RunnerAssertionEvidence({ tests }: RunnerAssertionEvidenceProps) {
  const failed = tests.filter((test) => !test.passed).length;
  const summary = tests.length ? `${tests.length} ${tests.length === 1 ? 'assertion' : 'assertions'} · ${tests.length - failed} passed · ${failed} failed` : 'No assertions recorded';

  return (
    <section aria-label="Assertion evidence" className="runner-assertion-evidence">
      <header><small>Script assertions</small><strong>{summary}</strong></header>
      {tests.length ? <div className="runner-assertion-list" role="list">{tests.map((test, index) => (
        <article className={test.passed ? 'passed' : 'failed'} key={`${test.name}-${index}`} role="listitem">
          <span className="runner-assertion-status">{test.passed ? 'PASS' : 'FAIL'}</span>
          <div><strong>{test.name || `Assertion ${index + 1}`}</strong>{test.error ? <pre>{test.error}</pre> : !test.passed ? <small>No error message was recorded.</small> : null}</div>
        </article>
      ))}</div> : <p>No script assertions were recorded for this attempt.</p>}
    </section>
  );
}
