import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { VaultKeyRetentionControl } from './SecurityWorkbench';

describe('vault key retention control', () => {
  it('renders the pinned label and explains the renderer authority boundary', () => {
    const html = renderToStaticMarkup(<VaultKeyRetentionControl busy={false} canRetain={false} onToggle={vi.fn()} retained supported />);
    expect(html).toContain('Save encrypted vault key locally');
    expect(html).toContain('checked=""');
    expect(html).toContain('without returning the saved key to the renderer');
    expect(html).not.toContain('passphrase');
  });

  it('disables unsupported or not-yet-unlocked retention', () => {
    expect(renderToStaticMarkup(<VaultKeyRetentionControl busy={false} canRetain={false} onToggle={vi.fn()} retained={false} supported />)).toContain('disabled=""');
    expect(renderToStaticMarkup(<VaultKeyRetentionControl busy={false} canRetain onToggle={vi.fn()} retained={false} supported={false} />)).toContain('requires macOS Keychain');
  });
});
