import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { cloneSeedWorkspace } from '../data/seed';
import { CreateMenu } from './CommandPalette';
import { PreferencesWorkbench } from './PreferencesWorkbench';
import { TemplateTagDialog } from './TemplateTagDialog';

describe('shortcut command surfaces', () => {
  it('renders the complete keyboard registry on direct keyboard-tab entry', () => {
    const html = renderToStaticMarkup(<PreferencesWorkbench initialTab="keyboard" onChangeWorkspace={vi.fn()} workspace={cloneSeedWorkspace()} />);
    expect(html.match(/class="shortcut-row"/g)).toHaveLength(33);
    expect(html).toContain('Show collection settings');
    expect(html).toContain('Focus GraphQL explorer filter');
  });

  it('offers request, folder, and collection creation while disabling unavailable folder scope', () => {
    const html = renderToStaticMarkup(<CreateMenu onAddCollection={vi.fn()} onAddRequest={vi.fn()} onClose={vi.fn()} />);
    expect(html).toContain('aria-label="Create menu"');
    expect(html).toContain('HTTP request');
    expect(html).toContain('<button disabled="" type="button">');
    expect(html).toContain('Collection');
  });

  it('reveals bounded effective variable values only when enabled', () => {
    const workspace = cloneSeedWorkspace();
    const request = workspace.collections[0].requests[0];
    const common = { cookies: [], onApply: vi.fn(), onClose: vi.fn(), request, responses: [], variableNames: ['baseUrl'], variableValues: { baseUrl: 'https://api.example.test' } };
    const hidden = renderToStaticMarkup(<TemplateTagDialog {...common} showVariableSourceAndValue={false} />);
    const visible = renderToStaticMarkup(<TemplateTagDialog {...common} showVariableSourceAndValue />);
    expect(hidden).not.toContain('effective request scope');
    expect(visible).toContain('baseUrl · https://api.example.test · effective request scope');
  });
});
