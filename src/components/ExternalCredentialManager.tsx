import { useState } from 'react';
import type { ExternalCredential, ExternalCredentialRecord, ExternalSecretInput } from '../lib/security';

type ExternalCredentialManagerProps = {
  credentials: ExternalCredentialRecord[];
  disabled: boolean;
  onSave: (credentials: ExternalCredentialRecord[]) => Promise<void>;
  initialDraft?: ExternalCredentialRecord;
};

const id = () => `cloud-credential-${crypto.randomUUID()}`;

const blankCredential = (provider: ExternalSecretInput['provider']): ExternalCredential => {
  if (provider === 'aws') return { type: 'awsTemporary', accessKeyId: '', secretAccessKey: '', sessionToken: '', region: '' };
  if (provider === 'gcp') return { type: 'gcpServiceAccount', serviceAccountKeyFilePath: '' };
  if (provider === 'hashicorp') return { type: 'hashicorpToken', systemType: 'onPrem', serverAddress: '', accessToken: '', namespace: '' };
  return { type: 'azureOauth', expiresOn: '', uniqueId: '', username: '', accessToken: '' };
};

const providerLabel = (provider: ExternalSecretInput['provider']) => ({ aws: 'AWS', gcp: 'GCP', azure: 'Azure', hashicorp: 'HashiCorp' })[provider];

export function ExternalCredentialManager({ credentials, disabled, onSave, initialDraft }: ExternalCredentialManagerProps) {
  const [provider, setProvider] = useState<ExternalSecretInput['provider']>('aws');
  const [draft, setDraft] = useState<ExternalCredentialRecord | undefined>(initialDraft);
  const update = (patch: Partial<ExternalCredential>) => setDraft((current) => current ? { ...current, credentials: { ...current.credentials, ...patch } as ExternalCredential } : current);
  const selectType = (type: ExternalCredential['type']) => {
    if (!draft) return;
    const next = type === 'awsTemporary' ? { type, accessKeyId: '', secretAccessKey: '', sessionToken: '', region: '' }
      : type === 'awsFile' ? { type, section: '', filePath: '', enableCache: false, region: '' }
        : type === 'awsSso' ? { type, section: '', filePath: '', configFilePath: '', enableCache: false, region: '' }
          : type === 'hashicorpToken' ? { type, systemType: 'onPrem' as const, serverAddress: '', accessToken: '', namespace: '' }
            : type === 'hashicorpAppRole' ? { type, systemType: 'onPrem' as const, serverAddress: '', roleId: '', secretId: '', namespace: '' }
              : type === 'hcpVaultSecrets' ? { type, clientId: '', clientSecret: '' }
                : draft.credentials;
    setDraft({ ...draft, credentials: next as ExternalCredential });
  };
  const saveDraft = async () => {
    if (!draft) return;
    const next = [...credentials.filter((credential) => credential.id !== draft.id), draft];
    await onSave(next);
    setDraft(undefined);
  };
  return <section className="security-card external-vault-card">
    <header><div><small>Protected device records · no paid plan</small><h2>Service provider credentials</h2></div><span>{credentials.length}/100</span></header>
    <div className="vault-actions"><select aria-label="Credential provider" disabled={disabled} value={provider} onChange={(event) => setProvider(event.target.value as ExternalSecretInput['provider'])}><option value="aws">AWS</option><option value="gcp">GCP</option><option value="hashicorp">HashiCorp</option><option value="azure">Azure</option></select><button disabled={disabled || credentials.length >= 100} onClick={() => setDraft({ id: id(), name: '', provider, credentials: blankCredential(provider) })} type="button">Add credential</button></div>
    <div className="member-list">{credentials.map((credential) => <article key={credential.id}><span><strong>{credential.name}</strong><small>{providerLabel(credential.provider)} · {credential.credentials.type}</small></span><button disabled={disabled} onClick={() => setDraft(structuredClone(credential))} type="button">Edit</button><button disabled={disabled} onClick={() => void onSave(credentials.filter((candidate) => candidate.id !== credential.id))} type="button">Delete</button></article>)}{!credentials.length ? <p>No cloud service provider credentials found</p> : null}</div>
    {draft ? <div className="external-vault-fields"><label>Credential name<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
      {draft.provider === 'aws' ? <><label>Credential type<select value={draft.credentials.type} onChange={(event) => selectType(event.target.value as ExternalCredential['type'])}><option value="awsTemporary">Temporary Credential</option><option value="awsFile">Credential File</option><option value="awsSso">SSO Credential</option></select></label>{draft.credentials.type === 'awsTemporary' ? <><label>Access Key Id<input value={draft.credentials.accessKeyId} onChange={(event) => update({ accessKeyId: event.target.value })} /></label><label>Secret Access Key<input type="password" value={draft.credentials.secretAccessKey} onChange={(event) => update({ secretAccessKey: event.target.value })} /></label><label>Session Token<input type="password" value={draft.credentials.sessionToken} onChange={(event) => update({ sessionToken: event.target.value })} /></label><label>Region<input value={draft.credentials.region} onChange={(event) => update({ region: event.target.value })} /></label></> : draft.credentials.type === 'awsFile' || draft.credentials.type === 'awsSso' ? <><label>{draft.credentials.type === 'awsSso' ? 'Profile Name' : 'Section Name'}<input value={draft.credentials.section} onChange={(event) => update({ section: event.target.value })} /></label><label>Credential File Path<input value={draft.credentials.filePath} onChange={(event) => update({ filePath: event.target.value })} /></label>{draft.credentials.type === 'awsSso' ? <label>Config File Path<input value={draft.credentials.configFilePath} onChange={(event) => update({ configFilePath: event.target.value })} /></label> : null}<label>Region<input value={draft.credentials.region} onChange={(event) => update({ region: event.target.value })} /></label></> : null}</> : null}
      {draft.provider === 'gcp' && draft.credentials.type === 'gcpServiceAccount' ? <label>Service Account Key File Path<input value={draft.credentials.serviceAccountKeyFilePath} onChange={(event) => update({ serviceAccountKeyFilePath: event.target.value })} /></label> : null}
      {draft.provider === 'hashicorp' ? <><label>System / auth type<select value={draft.credentials.type} onChange={(event) => selectType(event.target.value as ExternalCredential['type'])}><option value="hashicorpToken">On-Premises / Vault Dedicated Token</option><option value="hashicorpAppRole">On-Premises / Vault Dedicated AppRole</option><option value="hcpVaultSecrets">HCP Vault Secrets</option></select></label>{draft.credentials.type === 'hcpVaultSecrets' ? <><label>Client Id<input value={draft.credentials.clientId} onChange={(event) => update({ clientId: event.target.value })} /></label><label>Client Secret<input type="password" value={draft.credentials.clientSecret} onChange={(event) => update({ clientSecret: event.target.value })} /></label></> : draft.credentials.type === 'hashicorpToken' || draft.credentials.type === 'hashicorpAppRole' ? <><label>System Type<select value={draft.credentials.systemType} onChange={(event) => update({ systemType: event.target.value as 'onPrem' | 'cloudVaultDedicated' })}><option value="onPrem">On-Premises</option><option value="cloudVaultDedicated">Vault Dedicated</option></select></label><label>Server Address<input value={draft.credentials.serverAddress} onChange={(event) => update({ serverAddress: event.target.value })} /></label>{draft.credentials.type === 'hashicorpToken' ? <label>Authentication Token<input type="password" value={draft.credentials.accessToken} onChange={(event) => update({ accessToken: event.target.value })} /></label> : <><label>Role Id<input value={draft.credentials.roleId} onChange={(event) => update({ roleId: event.target.value })} /></label><label>Secret Id<input type="password" value={draft.credentials.secretId} onChange={(event) => update({ secretId: event.target.value })} /></label></>}<label>Namespace<input value={draft.credentials.namespace} onChange={(event) => update({ namespace: event.target.value })} /></label></> : null}</> : null}
      {draft.provider === 'azure' && draft.credentials.type === 'azureOauth' ? <><p>Store the OAuth result from Azure browser authorization. The native resolver sends the access token only to validated Azure Key Vault service hosts.</p><label>Username<input value={draft.credentials.username} onChange={(event) => update({ username: event.target.value })} /></label><label>Account Id<input value={draft.credentials.uniqueId} onChange={(event) => update({ uniqueId: event.target.value })} /></label><label>Expires On (RFC 3339)<input value={draft.credentials.expiresOn} onChange={(event) => update({ expiresOn: event.target.value })} /></label><label>Access Token<input type="password" value={draft.credentials.accessToken} onChange={(event) => update({ accessToken: event.target.value })} /></label></> : null}
      <div className="vault-actions"><button onClick={() => setDraft(undefined)} type="button">Cancel</button><button disabled={disabled || !draft.name.trim()} onClick={() => void saveDraft()} type="button">Save credential</button></div>
    </div> : null}
    <p>Profiles are non-syncable device records protected by macOS Keychain. AWS temporary/file/SSO, GCP service-account, HashiCorp token/AppRole/HCP Vault Secrets, and Azure OAuth profiles are available to the native resolver; ambient official CLI chains remain available.</p>
  </section>;
}
