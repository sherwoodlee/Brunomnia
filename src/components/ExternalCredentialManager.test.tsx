import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { ExternalCredentialRecord } from '../lib/security';
import { azureCredentialExpired, ExternalCredentialManager, upsertAzureExternalCredential } from './ExternalCredentialManager';
import { externalCredentialsForProvider, retainedExternalCredentialId } from './SecurityWorkbench';

const profiles: ExternalCredentialRecord[] = [
  { id: 'aws-one', name: 'AWS production', provider: 'aws', credentials: { type: 'awsTemporary', accessKeyId: 'key', secretAccessKey: 'secret', sessionToken: 'session', region: 'us-west-2' } },
  { id: 'hcp-one', name: 'HCP production', provider: 'hashicorp', credentials: { type: 'hcpVaultSecrets', clientId: 'client', clientSecret: 'secret' } },
];

describe('external credential manager', () => {
  it('renders exact HCP fields and guided Azure authentication lifecycle', () => {
    const hcp = renderToStaticMarkup(<ExternalCredentialManager credentials={profiles} disabled={false} initialDraft={profiles[1]} onSave={vi.fn()} />);
    expect(hcp).toContain('HCP Vault Secrets');
    expect(hcp).toContain('Client Id');
    expect(hcp).toContain('Client Secret');
    const azure = renderToStaticMarkup(<ExternalCredentialManager credentials={[{ id: 'azure-one', name: 'Azure production', provider: 'azure', credentials: { type: 'azureOauth', expiresOn: '2020-01-01T00:00:00Z', uniqueId: 'account', username: 'user@example.com', accessToken: 'token' } }]} disabled={false} initialProvider="azure" onSave={vi.fn()} />);
    expect(azure).toContain('Authenticate with Azure');
    expect(azure).toContain('Token expired');
    expect(azure).toContain('Renew');
    expect(azure).toContain('Use device code');
    expect(azure).not.toContain('>Edit<');
    const status = renderToStaticMarkup(<ExternalCredentialManager credentials={[]} disabled={false} initialProvider="azure" onSave={vi.fn()} />);
    expect(status).toContain('Authenticate with Azure');
  });

  it('filters provider selections and clears only deleted selections', () => {
    expect(externalCredentialsForProvider(profiles, 'aws').map((credential) => credential.id)).toEqual(['aws-one']);
    expect(externalCredentialsForProvider(profiles, 'hashicorp').map((credential) => credential.id)).toEqual(['hcp-one']);
    expect(retainedExternalCredentialId('hcp-one', profiles)).toBe('hcp-one');
    expect(retainedExternalCredentialId('hcp-one', profiles.slice(0, 1))).toBe('');
  });

  it('upserts Azure identities and preserves the record id during renewal', () => {
    const expired = { type: 'azureOauth' as const, expiresOn: '2020-01-01T00:00:00Z', uniqueId: 'old-subscription', username: 'user@example.com', accessToken: 'old' };
    const current = { type: 'azureOauth' as const, expiresOn: '2099-01-01T00:00:00Z', uniqueId: 'new-subscription', username: 'user@example.com', accessToken: 'new' };
    expect(azureCredentialExpired(expired, Date.parse('2026-01-01T00:00:00Z'))).toBe(true);
    expect(azureCredentialExpired(current, Date.parse('2026-01-01T00:00:00Z'))).toBe(false);
    const renewed = upsertAzureExternalCredential([{ id: 'azure-one', name: 'Old', provider: 'azure', credentials: expired }], current, 'azure-one', () => 'unused');
    expect(renewed).toEqual([{ id: 'azure-one', name: 'user@example.com', provider: 'azure', credentials: current }]);
    const created = upsertAzureExternalCredential([], current, '', () => 'azure-new');
    expect(created[0].id).toBe('azure-new');
  });
});
