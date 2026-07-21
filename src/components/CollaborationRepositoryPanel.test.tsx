import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { cloneSeedWorkspace } from '../data/seed';
import { commitCollaborationResources, emptyCollaborationRepository } from '../lib/collaboration';
import { CollaborationRepositoryPanel } from './CollaborationRepositoryPanel';

describe('CollaborationRepositoryPanel', () => {
  it('renders object-scoped staging, branch, merge, and history controls', () => {
    const workspace = cloneSeedWorkspace();
    const key = `collection:${workspace.collections[0].id}`;
    workspace.collaboration.repository = commitCollaborationResources(workspace, emptyCollaborationRepository(), [key], 'Local owner', 'Initial', () => '2026-01-01T00:00:00Z', () => 'base').repository;
    const html = renderToStaticMarkup(<CollaborationRepositoryPanel actor="Local owner" disabled={false} onChangeWorkspace={() => undefined} workspace={workspace} />);

    expect(html).toContain('Object-scoped version control');
    expect(html).toContain('Branches and history');
    expect(html).toContain('Matches branch head');
    expect(html).toContain('Commit staged');
    expect(html).toContain('Create branch');
    expect(html).toContain('Merge branch');
    expect(html).toContain('Initial');
  });
});
