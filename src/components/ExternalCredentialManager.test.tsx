import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { ExternalCredentialRecord } from '../lib/security';
import { ExternalCredentialManager } from './ExternalCredentialManager';
import { externalCredentialsForProvider, retainedExternalCredentialId } from './SecurityWorkbench';

const profiles: ExternalCredentialRecord[] = [
  { id: 'aws-one', name: 'AWS production', provider: 'aws', credentials: { type: 'awsTemporary', accessKeyId: 'key', secretAccessKey: 'secret', sessionToken: 'session', region: 'us-west-2' } },
  { id: 'hcp-one', name: 'HCP production', provider: 'hashicorp', credentials: { type: 'hcpVaultSecrets', clientId: 'client', clientSecret: 'secret' } },
];

describe('external credential manager', () => {
  it('renders exact HCP and Azure protected profile fields', () => {
    const hcp = renderToStaticMarkup(<ExternalCredentialManager credentials={profiles} disabled={false} initialDraft={profiles[1]} onSave={vi.fn()} />);
    expect(hcp).toContain('HCP Vault Secrets');
    expect(hcp).toContain('Client Id');
    expect(hcp).toContain('Client Secret');
    const azure = renderToStaticMarkup(<ExternalCredentialManager credentials={[]} disabled={false} initialDraft={{ id: 'azure-one', name: 'Azure production', provider: 'azure', credentials: { type: 'azureOauth', expiresOn: '2027-01-01T00:00:00Z', uniqueId: 'account', username: 'user@example.com', accessToken: 'token' } }} onSave={vi.fn()} />);
    expect(azure).toContain('OAuth result from Azure browser authorization');
    expect(azure).toContain('Expires On (RFC 3339)');
    expect(azure).toContain('type="password"');
  });

  it('filters provider selections and clears only deleted selections', () => {
    expect(externalCredentialsForProvider(profiles, 'aws').map((credential) => credential.id)).toEqual(['aws-one']);
    expect(externalCredentialsForProvider(profiles, 'hashicorp').map((credential) => credential.id)).toEqual(['hcp-one']);
    expect(retainedExternalCredentialId('hcp-one', profiles)).toBe('hcp-one');
    expect(retainedExternalCredentialId('hcp-one', profiles.slice(0, 1))).toBe('');
  });
});
