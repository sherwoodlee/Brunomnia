import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { SyncRecipientEncryptionControl, VaultKeyRetentionControl } from './SecurityWorkbench';

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
    expect(renderToStaticMarkup(<VaultKeyRetentionControl busy={false} canRetain onToggle={vi.fn()} retained={false} supported={false} />)).toContain('requires an operating-system credential store');
  });
});

describe('recipient encryption control', () => {
  it('renders public identity, recipient revocation, and rotation boundaries', () => {
    const identity = { recipient: { id: 'recipient-local', label: 'Avery’s Mac', publicKeyBase64: 'local-key' }, inviteCode: 'brunomnia-sync-recipient-v1:public-invite' };
    const html = renderToStaticMarkup(<SyncRecipientEncryptionControl
      busy={false}
      canGovern
      enabled
      identity={identity}
      invite=""
      onAdd={vi.fn()}
      onInvite={vi.fn()}
      onRemove={vi.fn()}
      onToggle={vi.fn()}
      recipients={[identity.recipient, { id: 'recipient-remote', label: 'Blake’s PC', publicKeyBase64: 'remote-key' }]}
      status={{ exists: true, updatedAt: '2026-07-21T00:00:00Z', encryptionMode: 'recipients', recipients: [] }}
    />);

    expect(html).toContain('Per-user recipients');
    expect(html).toContain('brunomnia-sync-recipient-v1:public-invite');
    expect(html).toContain('private X25519 key remains');
    expect(html).toContain('Avery’s Mac');
    expect(html).toContain('Blake’s PC');
    expect(html).toContain('This device');
    expect(html).toContain('fresh random content key');
    expect(html).toContain('cannot erase copies of older ciphertext');
  });
});
