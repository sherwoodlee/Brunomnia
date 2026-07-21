import { useState } from 'react';
import {
  authenticateAzureExternalCredential,
  type ExternalCredential,
  type ExternalCredentialRecord,
  type ExternalSecretInput,
} from '../lib/security';

type ExternalCredentialManagerProps = {
  credentials: ExternalCredentialRecord[];
  disabled: boolean;
  onSave: (credentials: ExternalCredentialRecord[]) => Promise<void>;
  initialDraft?: ExternalCredentialRecord;
  initialProvider?: ExternalSecretInput['provider'];
};

const id = () => `cloud-credential-${crypto.randomUUID()}`;

const blankCredential = (provider: ExternalSecretInput['provider']): ExternalCredential => {
  if (provider === 'aws') return { type: 'awsTemporary', accessKeyId: '', secretAccessKey: '', sessionToken: '', region: '' };
  if (provider === 'gcp') return { type: 'gcpServiceAccount', serviceAccountKeyFilePath: '' };
  if (provider === 'hashicorp') return { type: 'hashicorpToken', systemType: 'onPrem', serverAddress: '', accessToken: '', namespace: '' };
  return { type: 'azureOauth', expiresOn: '', uniqueId: '', username: '', accessToken: '' };
};

const providerLabel = (provider: ExternalSecretInput['provider']) => ({ aws: 'AWS', gcp: 'GCP', azure: 'Azure', hashicorp: 'HashiCorp' })[provider];

export const azureCredentialExpired = (credential: Extract<ExternalCredential, { type: 'azureOauth' }>, now = Date.now()) => {
  const expiresAt = Date.parse(credential.expiresOn);
  return !Number.isFinite(expiresAt) || expiresAt <= now;
};

export const upsertAzureExternalCredential = (
  credentials: ExternalCredentialRecord[],
  azure: Extract<ExternalCredential, { type: 'azureOauth' }>,
  existingId = '',
  createId: () => string = id,
) => {
  const username = azure.username.trim();
  const existing = credentials.find((credential) => credential.id === existingId)
    ?? credentials.find((credential) => credential.provider === 'azure' && credential.credentials.type === 'azureOauth' && credential.credentials.username.trim().toLowerCase() === username.toLowerCase());
  const record: ExternalCredentialRecord = {
    id: existing?.id ?? createId(),
    name: username || azure.uniqueId,
    provider: 'azure',
    credentials: azure,
  };
  return [...credentials.filter((credential) => credential.id !== record.id), record];
};

export function ExternalCredentialManager({ credentials, disabled, onSave, initialDraft, initialProvider = 'aws' }: ExternalCredentialManagerProps) {
  const [provider, setProvider] = useState<ExternalSecretInput['provider']>(initialProvider);
  const [draft, setDraft] = useState<ExternalCredentialRecord | undefined>(initialDraft);
  const [azureBusy, setAzureBusy] = useState(false);
  const [azureError, setAzureError] = useState('');
  const [azureStatus, setAzureStatus] = useState<string[]>([]);
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
    if (!draft || draft.provider === 'azure') return;
    await onSave([...credentials.filter((credential) => credential.id !== draft.id), draft]);
    setDraft(undefined);
  };
  const authenticateAzure = async (useDeviceCode: boolean, existingId = '') => {
    if (azureBusy) return;
    setAzureBusy(true);
    setAzureError('');
    setAzureStatus([]);
    try {
      const azure = await authenticateAzureExternalCredential(useDeviceCode, (message) => {
        setAzureStatus((current) => [...current.slice(-7), message]);
      });
      await onSave(upsertAzureExternalCredential(credentials, azure, existingId));
      setDraft(undefined);
    } catch (caught) {
      setAzureError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setAzureBusy(false);
    }
  };

  return <section className="security-card external-vault-card">
    <header><div><small>Protected device records · no paid plan</small><h2>Service provider credentials</h2></div><span>{credentials.length}/100</span></header>
    <div className="vault-actions">
      <select aria-label="Credential provider" disabled={disabled || azureBusy} value={provider} onChange={(event) => { setProvider(event.target.value as ExternalSecretInput['provider']); setAzureError(''); }}><option value="aws">AWS</option><option value="gcp">GCP</option><option value="hashicorp">HashiCorp</option><option value="azure">Azure</option></select>
      <button disabled={disabled || azureBusy || credentials.length >= 100} onClick={() => provider === 'azure' ? void authenticateAzure(false) : setDraft({ id: id(), name: '', provider, credentials: blankCredential(provider) })} type="button">{provider === 'azure' ? azureBusy ? 'Waiting for Azure…' : 'Authenticate with Azure' : 'Add credential'}</button>
      {provider === 'azure' ? <button disabled={disabled || azureBusy || credentials.length >= 100} onClick={() => void authenticateAzure(true)} type="button">Use device code</button> : null}
    </div>
    {azureStatus.length ? <div aria-live="polite" className="policy-warning" role="status"><strong>Azure CLI</strong>{azureStatus.map((message, index) => <span key={`${index}-${message}`}>{message}</span>)}</div> : null}
    {azureError ? <div className="policy-warning" role="alert"><strong>Azure authorization failed</strong><span>{azureError}</span><button disabled={disabled || azureBusy} onClick={() => void authenticateAzure(true)} type="button">Use device code</button></div> : null}
    <div className="member-list">{credentials.map((credential) => {
      const azure = credential.credentials.type === 'azureOauth' ? credential.credentials : undefined;
      const expired = azure ? azureCredentialExpired(azure) : false;
      return <article key={credential.id}><span><strong>{credential.name}{expired ? ' · Token expired' : ''}</strong><small>{providerLabel(credential.provider)} · {credential.credentials.type}{azure && !expired ? ` · expires ${new Date(azure.expiresOn).toLocaleString()}` : ''}</small></span>{azure ? expired ? <button disabled={disabled || azureBusy} onClick={() => void authenticateAzure(false, credential.id)} type="button">Renew</button> : null : <button disabled={disabled || azureBusy} onClick={() => setDraft(structuredClone(credential))} type="button">Edit</button>}<button disabled={disabled || azureBusy} onClick={() => void onSave(credentials.filter((candidate) => candidate.id !== credential.id))} type="button">Delete</button></article>;
    })}{!credentials.length ? <p>No cloud service provider credentials found</p> : null}</div>
    {draft ? <div className="external-vault-fields"><label>Credential name<input disabled={disabled} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
      {draft.provider === 'aws' ? <><label>Credential type<select disabled={disabled} value={draft.credentials.type} onChange={(event) => selectType(event.target.value as ExternalCredential['type'])}><option value="awsTemporary">Temporary Credential</option><option value="awsFile">Credential File</option><option value="awsSso">SSO Credential</option></select></label>{draft.credentials.type === 'awsTemporary' ? <><label>Access Key Id<input disabled={disabled} value={draft.credentials.accessKeyId} onChange={(event) => update({ accessKeyId: event.target.value })} /></label><label>Secret Access Key<input disabled={disabled} type="password" value={draft.credentials.secretAccessKey} onChange={(event) => update({ secretAccessKey: event.target.value })} /></label><label>Session Token<input disabled={disabled} type="password" value={draft.credentials.sessionToken} onChange={(event) => update({ sessionToken: event.target.value })} /></label><label>Region<input disabled={disabled} value={draft.credentials.region} onChange={(event) => update({ region: event.target.value })} /></label></> : draft.credentials.type === 'awsFile' || draft.credentials.type === 'awsSso' ? <><label>{draft.credentials.type === 'awsSso' ? 'Profile Name' : 'Section Name'}<input disabled={disabled} value={draft.credentials.section} onChange={(event) => update({ section: event.target.value })} /></label><label>Credential File Path<input disabled={disabled} value={draft.credentials.filePath} onChange={(event) => update({ filePath: event.target.value })} /></label>{draft.credentials.type === 'awsSso' ? <label>Config File Path<input disabled={disabled} value={draft.credentials.configFilePath} onChange={(event) => update({ configFilePath: event.target.value })} /></label> : null}<label>Region<input disabled={disabled} value={draft.credentials.region} onChange={(event) => update({ region: event.target.value })} /></label></> : null}</> : null}
      {draft.provider === 'gcp' && draft.credentials.type === 'gcpServiceAccount' ? <label>Service Account Key File Path<input disabled={disabled} value={draft.credentials.serviceAccountKeyFilePath} onChange={(event) => update({ serviceAccountKeyFilePath: event.target.value })} /></label> : null}
      {draft.provider === 'hashicorp' ? <><label>System / auth type<select disabled={disabled} value={draft.credentials.type} onChange={(event) => selectType(event.target.value as ExternalCredential['type'])}><option value="hashicorpToken">On-Premises / Vault Dedicated Token</option><option value="hashicorpAppRole">On-Premises / Vault Dedicated AppRole</option><option value="hcpVaultSecrets">HCP Vault Secrets</option></select></label>{draft.credentials.type === 'hcpVaultSecrets' ? <><label>Client Id<input disabled={disabled} value={draft.credentials.clientId} onChange={(event) => update({ clientId: event.target.value })} /></label><label>Client Secret<input disabled={disabled} type="password" value={draft.credentials.clientSecret} onChange={(event) => update({ clientSecret: event.target.value })} /></label></> : draft.credentials.type === 'hashicorpToken' || draft.credentials.type === 'hashicorpAppRole' ? <><label>System Type<select disabled={disabled} value={draft.credentials.systemType} onChange={(event) => update({ systemType: event.target.value as 'onPrem' | 'cloudVaultDedicated' })}><option value="onPrem">On-Premises</option><option value="cloudVaultDedicated">Vault Dedicated</option></select></label><label>Server Address<input disabled={disabled} value={draft.credentials.serverAddress} onChange={(event) => update({ serverAddress: event.target.value })} /></label>{draft.credentials.type === 'hashicorpToken' ? <label>Authentication Token<input disabled={disabled} type="password" value={draft.credentials.accessToken} onChange={(event) => update({ accessToken: event.target.value })} /></label> : <><label>Role Id<input disabled={disabled} value={draft.credentials.roleId} onChange={(event) => update({ roleId: event.target.value })} /></label><label>Secret Id<input disabled={disabled} type="password" value={draft.credentials.secretId} onChange={(event) => update({ secretId: event.target.value })} /></label></>}<label>Namespace<input disabled={disabled} value={draft.credentials.namespace} onChange={(event) => update({ namespace: event.target.value })} /></label></> : null}</> : null}
      {draft.provider === 'azure' ? <p>Azure profiles are created and renewed through official Azure CLI browser authentication; access tokens cannot be edited manually.</p> : null}
      <div className="vault-actions"><button onClick={() => setDraft(undefined)} type="button">Cancel</button><button disabled={disabled || draft.provider === 'azure' || !draft.name.trim()} onClick={() => void saveDraft()} type="button">Save credential</button></div>
    </div> : null}
    <p>Profiles are non-syncable device records protected by the operating-system credential store. AWS temporary/file/SSO, GCP service-account, HashiCorp token/AppRole/HCP Vault Secrets, and Azure OAuth profiles are available to the native resolver; ambient official CLI chains remain available.</p>
  </section>;
}
