import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ProjectDashboard } from './App';
import { cloneSeedWorkspace } from './data/seed';
import { createBlankWorkspace } from './lib/workspaceCatalog';

const callbacks = () => ({
  canReopenRequest: false,
  onAddRequest: vi.fn(),
  onImport: vi.fn(),
  onOpenCollection: vi.fn(),
  onOpenDesign: vi.fn(),
  onOpenEnvironment: vi.fn(),
  onOpenMcp: vi.fn(),
  onOpenMockServer: vi.fn(),
  onOpenTestSuite: vi.fn(),
  onReopenRequest: vi.fn(),
});

describe('empty project dashboard', () => {
  it('shows the pinned first-file actions for a genuinely empty project', () => {
    const workspace = createBlankWorkspace('Empty Project', cloneSeedWorkspace().preferences);
    const markup = renderToStaticMarkup(<ProjectDashboard {...callbacks()} workspace={workspace} />);

    expect(markup).toContain('Welcome to your project!');
    expect(markup).toContain('Send a request');
    expect(markup).toContain('Create document');
    expect(markup).toContain('Import');
    expect(markup).not.toContain('Project files');
  });

  it('shows the ordinary resource dashboard once files exist', () => {
    const markup = renderToStaticMarkup(<ProjectDashboard {...callbacks()} workspace={cloneSeedWorkspace()} />);

    expect(markup).toContain('Project files');
    expect(markup).not.toContain('Welcome to your project!');
  });
});
