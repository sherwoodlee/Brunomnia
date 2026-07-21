import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { CollectionSidebar, ProjectDashboard } from './App';
import { cloneSeedWorkspace } from './data/seed';
import type { ContextualPluginAction, ContextualPluginActionKind } from './lib/plugins';

const action = (kind: ContextualPluginActionKind): ContextualPluginAction => ({
  key: `plugin:${kind}:0`,
  pluginId: 'plugin',
  pluginName: 'Placement plugin',
  descriptor: { id: `${kind}:0`, label: `Run ${kind}`, kind },
  authorityKey: 'reviewed-authority',
});

const dashboardCallbacks = {
  onOpenCollection: vi.fn(),
  onOpenDesign: vi.fn(),
  onOpenEnvironment: vi.fn(),
  onOpenMcp: vi.fn(),
  onOpenMockServer: vi.fn(),
  onOpenTestSuite: vi.fn(),
  onRunPluginAction: vi.fn(),
};

describe('contextual plugin action placement', () => {
  it('places request and request-group actions on matching sidebar resources', () => {
    const workspace = cloneSeedWorkspace();
    const request = workspace.collections[0].requests[0];
    request.folderId = 'folder-a';
    workspace.collections[0].folders = [{ id: 'folder-a', name: 'Folder A', parentId: '', expanded: true, headers: [], environment: [], preRequestScript: '', tests: '', documentation: '' }];
    const markup = renderToStaticMarkup(<CollectionSidebar
      mode="collections"
      onAddCollection={vi.fn()}
      onAddFolder={vi.fn()}
      onAddRequest={vi.fn()}
      onEditCollection={vi.fn()}
      onEditFolder={vi.fn()}
      onMoveResource={vi.fn()}
      onSearch={vi.fn()}
      onSelectFolder={vi.fn()}
      onSelectRequest={vi.fn()}
      onRunPluginAction={vi.fn()}
      onToggleCollection={vi.fn()}
      onToggleFolder={vi.fn()}
      onToggleRequestPin={vi.fn()}
      pinnedRequestIds={[request.id]}
      pluginActions={[action('request'), action('request-group'), action('document')]}
      search=""
      selectedDocumentId={request.id}
      selectedDocumentType="request"
      workspace={workspace}
    />);

    expect(markup.match(new RegExp(`Plugin actions for ${request.name}`, 'g'))).toHaveLength(2);
    expect(markup).toContain('Plugin actions for Folder A');
    expect(markup).not.toContain('Plugin actions for Orders API');
  });

  it('places document actions on API Design project cards only', () => {
    const workspace = cloneSeedWorkspace();
    const markup = renderToStaticMarkup(<ProjectDashboard
      canReopenRequest={false}
      onAddRequest={vi.fn()}
      onImport={vi.fn()}
      onReopenRequest={vi.fn()}
      pluginActions={[action('request'), action('request-group'), action('document')]}
      workspace={workspace}
      {...dashboardCallbacks}
    />);

    expect(markup).toContain(`Plugin actions for ${workspace.apiDesigns[0].name}`);
    expect(markup).not.toContain(`aria-label="Plugin actions for ${workspace.collections[0].name}"`);
  });
});
