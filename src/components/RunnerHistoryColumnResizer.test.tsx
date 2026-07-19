import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { RunnerHistoryColumnResizer } from './RunnerHistoryColumnResizer';

describe('Runner History column resizer', () => {
  it('exposes bounded vertical-separator semantics', () => {
    const markup = renderToStaticMarkup(<RunnerHistoryColumnResizer label="Source" maximum={520} minimum={160} onChange={vi.fn()} value={260.4} />);

    expect(markup).toContain('role="separator"');
    expect(markup).toContain('aria-label="Resize Runner History Source column"');
    expect(markup).toContain('aria-orientation="vertical"');
    expect(markup).toContain('aria-valuemin="160"');
    expect(markup).toContain('aria-valuemax="520"');
    expect(markup).toContain('aria-valuenow="260"');
    expect(markup).toContain('tabindex="0"');
  });
});
