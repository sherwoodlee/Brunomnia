import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { RunnerAssertionEvidence } from './RunnerAssertionEvidence';

describe('Runner assertion evidence', () => {
  it('renders each retained assertion status, name, and error', () => {
    const markup = renderToStaticMarkup(<RunnerAssertionEvidence tests={[
      { name: 'creates the order', passed: true, status: 'passed', category: 'pre-request', durationMs: 0 },
      { name: 'returns the created status', passed: false, status: 'failed', category: 'after-response', durationMs: 325.25, error: 'Expected <201> but received <500>' },
      { name: 'fails without an error', passed: false },
      { name: 'runs only in production', passed: false, status: 'skipped', category: 'after-response', durationMs: 0 },
    ]} />);

    expect(markup).toContain('4/4 shown · 1 passed · 2 failed · 1 skipped');
    expect(markup).toContain('creates the order');
    expect(markup).toContain('returns the created status');
    expect(markup).toContain('Pre-request Test');
    expect(markup).toContain('After-response Test');
    expect(markup).toContain('&lt; 0.1 ms');
    expect(markup).toContain('325.3 ms');
    expect(markup).toContain('Expected &lt;201&gt; but received &lt;500&gt;');
    expect(markup).toContain('No error message was recorded.');
    expect(markup.match(/>PASS</g)).toHaveLength(1);
    expect(markup.match(/>FAIL</g)).toHaveLength(2);
    expect(markup.match(/>SKIP</g)).toHaveLength(1);
  });

  it('renders an explicit empty assertion state', () => {
    const markup = renderToStaticMarkup(<RunnerAssertionEvidence tests={[]} />);

    expect(markup).toContain('No assertions recorded');
    expect(markup).toContain('No script assertions were recorded for this attempt.');
  });

  it('filters only assertion rows with pinned status and fuzzy-name semantics', () => {
    const tests = [
      { name: 'creates the order', passed: true, status: 'passed' as const },
      { name: 'returns invoice', passed: false, status: 'failed' as const, error: 'Expected success' },
      { name: 'production only', passed: false, status: 'skipped' as const },
    ];
    const failed = renderToStaticMarkup(<RunnerAssertionEvidence nameFilter="return inv" statusFilter="failed" tests={tests} />);
    const noMatch = renderToStaticMarkup(<RunnerAssertionEvidence nameFilter="missing" statusFilter="all" tests={tests} />);

    expect(failed).toContain('1/3 shown · 0 passed · 1 failed');
    expect(failed).toContain('returns invoice');
    expect(failed).not.toContain('creates the order');
    expect(failed).not.toContain('production only');
    expect(noMatch).toContain('0/3 shown · 0 passed · 0 failed');
    expect(noMatch).toContain('No matching assertions.');
  });
});
