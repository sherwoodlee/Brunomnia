import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { RunnerResultsEmptyState } from './RunnerResultsEmptyState';

describe('Runner Results empty state', () => {
  it('renders the active Send shortcut before the first run', () => {
    const markup = renderToStaticMarkup(<RunnerResultsEmptyState hasSavedReport={false} shortcut="Mod+Shift+Enter" />);

    expect(markup).toContain('Run results will appear here');
    expect(markup).toContain('Select requests and press');
    expect(markup).toContain('<kbd>⌘/Ctrl+Shift+Enter</kbd>');
    expect(markup).toContain('to run');
  });

  it('keeps the saved empty-run guidance distinct from the initial state', () => {
    const markup = renderToStaticMarkup(<RunnerResultsEmptyState hasSavedReport shortcut="Mod+Enter" />);

    expect(markup).toContain('No results from this run');
    expect(markup).toContain('Add test cases in scripts and run them to see results.');
    expect(markup).not.toContain('<kbd>');
  });
});
