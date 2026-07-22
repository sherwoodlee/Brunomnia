import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { cloneSeedWorkspace } from '../data/seed';
import { IdentityGovernancePanel } from './IdentityGovernancePanel';

describe('identity governance panel', () => {
  it('renders the free organization controls and every governance section', () => {
    const workspace = cloneSeedWorkspace();
    const html = renderToStaticMarkup(<IdentityGovernancePanel
      onChangeWorkspace={vi.fn()}
      workspace={workspace}
      workspaceId="workspace-test"
    />);

    expect(html).toContain('Identity governance sections');
    expect(html).toContain('Free organization control');
    expect(html).toContain('Storage controls');
    expect(html).toContain('Cloud Sync (self-hosted encrypted revisions)');
    expect(html).toContain('Transfer organization');
    expect(html).toContain('>Members<');
    expect(html).toContain('>Access<');
    expect(html).toContain('>SSO<');
    expect(html).toContain('>SCIM<');
    expect(html).toContain('>Audit<');
    expect(html).not.toContain('Upgrade');
  });
});
