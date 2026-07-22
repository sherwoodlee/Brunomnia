import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { cloneSeedWorkspace } from '../data/seed';
import { PreferencesWorkbench } from './PreferencesWorkbench';

describe('preferences accessibility contracts', () => {
  it('renders named tabs, a signed updater, and polite status output', () => {
    const html = renderToStaticMarkup(<PreferencesWorkbench onChangeWorkspace={vi.fn()} workspace={cloneSeedWorkspace()} />);
    expect(html).toContain('role="tablist"');
    expect(html).toContain('aria-label="Preference sections"');
    expect(html).toContain('role="tab"');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('role="tabpanel"');
    expect(html).toContain('Desktop updates');
    expect(html).toContain('Automatically check every three hours');
    expect(html).toContain('aria-live="polite"');
    expect(html).not.toContain('Upgrade');
  });
});
