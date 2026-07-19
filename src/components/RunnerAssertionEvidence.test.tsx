import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { RunnerAssertionEvidence } from './RunnerAssertionEvidence';

describe('Runner assertion evidence', () => {
  it('renders each retained assertion status, name, and error', () => {
    const markup = renderToStaticMarkup(<RunnerAssertionEvidence tests={[
      { name: 'creates the order', passed: true },
      { name: 'returns the created status', passed: false, error: 'Expected <201> but received <500>' },
      { name: 'fails without an error', passed: false },
    ]} />);

    expect(markup).toContain('3 assertions · 1 passed · 2 failed');
    expect(markup).toContain('creates the order');
    expect(markup).toContain('returns the created status');
    expect(markup).toContain('Expected &lt;201&gt; but received &lt;500&gt;');
    expect(markup).toContain('No error message was recorded.');
    expect(markup.match(/>PASS</g)).toHaveLength(1);
    expect(markup.match(/>FAIL</g)).toHaveLength(2);
  });

  it('renders an explicit empty assertion state', () => {
    const markup = renderToStaticMarkup(<RunnerAssertionEvidence tests={[]} />);

    expect(markup).toContain('No assertions recorded');
    expect(markup).toContain('No script assertions were recorded for this attempt.');
  });
});
