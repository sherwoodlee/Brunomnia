import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { RunnerPaneSplitter } from './RunnerPaneSplitter';

describe('Runner pane splitter', () => {
  it('exposes bounded separator semantics for each pane direction', () => {
    const horizontal = renderToStaticMarkup(<RunnerPaneSplitter direction="horizontal" onChange={vi.fn()} value={35} />);
    const vertical = renderToStaticMarkup(<RunnerPaneSplitter direction="vertical" onChange={vi.fn()} value={62.4} />);

    expect(horizontal).toContain('role="separator"');
    expect(horizontal).toContain('aria-orientation="vertical"');
    expect(horizontal).toContain('aria-valuemin="35"');
    expect(horizontal).toContain('aria-valuemax="90"');
    expect(horizontal).toContain('aria-valuenow="35"');
    expect(horizontal).toContain('tabindex="0"');
    expect(vertical).toContain('aria-orientation="horizontal"');
    expect(vertical).toContain('aria-valuenow="62"');
  });
});
