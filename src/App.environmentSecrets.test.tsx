import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { KeyValueEditor } from './App';
import type { VaultEntry } from './lib/security';

const entry: VaultEntry = {
  id: 'environment-entry',
  name: '__brunomnia_environment__:secret-row',
  value: 'private-value',
  updatedAt: '2026-01-01T00:00:00Z',
  kind: 'environment',
  ownerId: 'secret-row',
};

describe('private environment Secret row rendering', () => {
  it('renders masked Secret controls only with private unlocked authority', () => {
    const unlocked = renderToStaticMarkup(<KeyValueEditor allowSecrets environmentValues onChange={vi.fn()} onSecretEntriesChange={vi.fn()} rows={[{ id: 'secret-row', name: 'api_token', value: '', enabled: true, valueType: 'secret' }]} secretAvailable secretEntries={[entry]} />);
    expect(unlocked).toContain('value="secret"');
    expect(unlocked).toContain('type="password"');
    expect(unlocked).toContain('Reveal secret value for api_token');
    expect(unlocked).not.toContain('private-value</');

    const shared = renderToStaticMarkup(<KeyValueEditor environmentValues onChange={vi.fn()} rows={[{ id: 'plain', name: 'region', value: 'us', enabled: true }]} />);
    expect(shared).not.toContain('value="secret"');
  });

  it('keeps existing Secret rows locked and non-editable without decrypted entries', () => {
    const locked = renderToStaticMarkup(<KeyValueEditor allowSecrets environmentValues onChange={vi.fn()} rows={[{ id: 'secret-row', name: 'api_token', value: '', enabled: true, valueType: 'secret' }]} secretEntries={[]} />);
    expect(locked).toContain('Unlock vault to edit');
    expect(locked).toContain('disabled=""');
    expect(locked).not.toContain('private-value');
  });
});
