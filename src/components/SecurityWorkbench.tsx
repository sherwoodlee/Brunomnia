import { isTauri } from '@tauri-apps/api/core';
import { withoutOAuth2RuntimeCredentials } from '../lib/oauth2Tokens';
import { useEffect, useMemo, useState } from 'react';
import {
  appendAudit,
  clearExternalSecretCache,
  encryptedSyncStatus,
  externalSecretReferenceKey,
  forgetVaultKey,
  mergeSyncedWorkspace,
  loadExternalCredentials,
  plaintextSecretCandidates,
  pullEncryptedSync,
  pushEncryptedSync,
  retainVaultKey,
  resolveExternalSecret,
  resetVault,
  saveVault,
  saveVaultWithSavedKey,
  saveExternalCredentials,
  shareableWorkspace,
  unlockVault,
  vaultKeyStatus,
  vaultStatus,
  type SecureFileStatus,
  type ExternalSecretInput,
  type ExternalCredentialRecord,
  type VaultEntry,
  type VaultKeyStatus,
  type VaultSession,
} from '../lib/security';
import { directVaultEntries, ENVIRONMENT_SECRET_NAME_PREFIX, isEnvironmentSecretEntry, withoutEnvironmentSecrets } from '../lib/environmentSecrets';
import type { GovernanceMember, GovernanceRole, Workspace } from '../types';
import { CertificateManager } from './CertificateManager';
import { Icon } from './Icon';
import { ExternalCredentialManager } from './ExternalCredentialManager';
import { getWorkspaceFileState, updateWorkspaceFileState } from '../lib/workspaceFileState';

type SecurityWorkbenchProps = {
  workspaceId: string;
  workspace: Workspace;
  workspaceFileId: string;
  vaultSession: VaultSession;
  onVaultSession: (session: VaultSession) => void;
  onChangeWorkspace: (updater: (workspace: Workspace) => Workspace) => void;
};

const blankStatus: SecureFileStatus = { exists: false, updatedAt: '' };
const blankKeyStatus: VaultKeyStatus = { supported: false, retained: false };
const roles: GovernanceRole[] = ['owner', 'admin', 'editor', 'viewer'];
const secretId = () => `secret-${crypto.randomUUID()}`;
const memberId = () => `member-${crypto.randomUUID()}`;

type VaultKeyRetentionControlProps = {
  supported: boolean;
  retained: boolean;
  canRetain: boolean;
  busy: boolean;
  onToggle: () => void;
};

export function VaultKeyRetentionControl({ supported, retained, canRetain, busy, onToggle }: VaultKeyRetentionControlProps) {
  if (!supported) return <small>Automatic vault-key retention requires macOS Keychain.</small>;
  return <>
    <label className="reveal-toggle"><input checked={retained} disabled={busy || (!retained && !canRetain)} onChange={onToggle} type="checkbox" /> Save encrypted vault key locally</label>
    <small>{retained ? 'macOS Keychain can unlock this project without returning the saved key to the renderer.' : 'Unlock the vault manually to enable optional macOS Keychain retention.'}</small>
  </>;
}

export const retainedExternalCredentialId = (credentialId: string | undefined, credentials: ExternalCredentialRecord[]) => credentialId && credentials.some((credential) => credential.id === credentialId) ? credentialId : '';
export const externalCredentialsForProvider = (credentials: ExternalCredentialRecord[], provider: ExternalSecretInput['provider']) => credentials.filter((credential) => credential.provider === provider);

export function SecurityWorkbench({ workspaceId, workspaceFileId, workspace, vaultSession, onVaultSession, onChangeWorkspace }: SecurityWorkbenchProps) {
  const [tab, setTab] = useState<'vault' | 'certificates' | 'sync' | 'governance'>('vault');
  const [status, setStatus] = useState<SecureFileStatus>(blankStatus);
  const [keyStatus, setKeyStatus] = useState<VaultKeyStatus>(blankKeyStatus);
  const [syncStatus, setSyncStatus] = useState<SecureFileStatus>(blankStatus);
  const [syncPassphrase, setSyncPassphrase] = useState('');
  const [forcePush, setForcePush] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [newSecretName, setNewSecretName] = useState('');
  const [newSecretValue, setNewSecretValue] = useState('');
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [external, setExternal] = useState<ExternalSecretInput>({ provider: 'aws', reference: '', scope: '', field: '', version: '', credentialId: '', appName: '', cacheSeconds: 1800 });
  const [externalCredentials, setExternalCredentials] = useState<ExternalCredentialRecord[]>([]);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const native = isTauri();
  const currentMember = workspace.governance.members.find((member) => member.id === workspace.governance.currentMemberId) ?? workspace.governance.members[0];
  const canEdit = currentMember?.active && currentMember.role !== 'viewer';
  const canGovern = currentMember?.active && (currentMember.role === 'owner' || currentMember.role === 'admin');
  const plaintextSecrets = workspace.governance.policy.requireVaultForSecrets ? plaintextSecretCandidates(withoutOAuth2RuntimeCredentials(workspace)) : [];
  const externalKey = externalSecretReferenceKey(external);
  const externalApproved = workspace.governance.policy.externalVaultAllowlist.includes(externalKey);
  const selectedExternalCredential = externalCredentials.find((credential) => credential.id === external.credentialId);
  const usesHcpVaultSecrets = selectedExternalCredential?.credentials.type === 'hcpVaultSecrets';
  const usesAzureOauth = selectedExternalCredential?.credentials.type === 'azureOauth';

  const run = async (label: string, operation: () => Promise<void>) => {
    if (busy) return;
    setBusy(label); setError(''); setMessage('');
    try { await operation(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
    finally { setBusy(''); }
  };
  const audit = (action: string, detail: string) => onChangeWorkspace((current) => appendAudit(current, action, detail));
  const updateCollaboration = (patch: Partial<Workspace['collaboration']>) => onChangeWorkspace((current) => ({ ...current, collaboration: { ...current.collaboration, ...patch } }));
  const updateStoragePolicy = (mode: Workspace['governance']['policy']['allowedStorage'][number], enabled: boolean) => onChangeWorkspace((current) => {
    const allowedStorage = enabled
      ? [...new Set([...current.governance.policy.allowedStorage, mode])]
      : current.governance.policy.allowedStorage.filter((candidate) => candidate !== mode);
    if (!allowedStorage.length) return current;
    return appendAudit({ ...current, governance: { ...current.governance, policy: { ...current.governance.policy, allowedStorage } } }, 'governance.policy.update', `${enabled ? 'Allowed' : 'Blocked'} ${mode} storage.`);
  });
  const toggleExternalApproval = () => {
    if (!canGovern || !external.reference.trim()) return;
    onChangeWorkspace((current) => {
      const allowlist = externalApproved
        ? current.governance.policy.externalVaultAllowlist.filter((key) => key !== externalKey)
        : [...new Set([...current.governance.policy.externalVaultAllowlist, externalKey])];
      return appendAudit({ ...current, governance: { ...current.governance, policy: { ...current.governance.policy, externalVaultAllowlist: allowlist } } }, 'governance.external-vault.update', `${externalApproved ? 'Revoked' : 'Approved'} ${externalKey}.`);
    });
  };

  useEffect(() => {
    if (!native) return;
    let cancelled = false;
    setStatus(blankStatus);
    setKeyStatus(blankKeyStatus);
    void Promise.all([vaultStatus(workspaceId), vaultKeyStatus(workspaceId)]).then(([nextStatus, nextKeyStatus]) => {
      if (!cancelled) {
        setStatus(nextStatus);
        setKeyStatus(nextKeyStatus);
      }
    }).catch((caught) => { if (!cancelled) setError(caught instanceof Error ? caught.message : String(caught)); });
    return () => { cancelled = true; };
  }, [native, workspaceId]);

  useEffect(() => {
    if (!native) return;
    let cancelled = false;
    void loadExternalCredentials().then((credentials) => { if (!cancelled) setExternalCredentials(credentials); }).catch((caught) => { if (!cancelled) setError(caught instanceof Error ? caught.message : String(caught)); });
    return () => { cancelled = true; };
  }, [native]);

  const visibleVaultEntries = useMemo(() => directVaultEntries(vaultSession.entries), [vaultSession.entries]);
  const environmentSecretCount = useMemo(() => vaultSession.entries.filter(isEnvironmentSecretEntry).length, [vaultSession.entries]);
  const vaultNames = useMemo(() => new Set(visibleVaultEntries.map((entry) => entry.name.trim().toLowerCase())), [visibleVaultEntries]);
  const unlockOrCreate = () => run(status.exists ? 'Unlocking vault' : 'Creating vault', async () => {
    const passphrase = vaultSession.passphrase;
    if (status.exists) {
      const entries = await unlockVault(workspaceId, passphrase);
      onVaultSession({ ...vaultSession, entries, unlocked: true });
      if (keyStatus.retained) setKeyStatus(await retainVaultKey(workspaceId, passphrase));
      audit('vault.unlock', `Unlocked ${entries.length} encrypted secret entries.`);
      setMessage(`Vault unlocked · ${entries.length} secret${entries.length === 1 ? '' : 's'} available in memory.`);
    } else {
      const next = await saveVault(workspaceId, passphrase, []);
      setStatus(next); onVaultSession({ ...vaultSession, entries: [], unlocked: true });
      if (keyStatus.retained) setKeyStatus(await retainVaultKey(workspaceId, passphrase));
      audit('vault.create', 'Created the encrypted local vault.');
      setMessage('Encrypted local vault created and unlocked.');
    }
  });

  const persistVault = () => run('Encrypting vault', async () => {
    const next = vaultSession.passphrase
      ? await saveVault(workspaceId, vaultSession.passphrase, vaultSession.entries)
      : await saveVaultWithSavedKey(workspaceId, vaultSession.entries);
    setStatus(next); audit('vault.save', `Saved ${vaultSession.entries.length} encrypted secret entries.`);
    setMessage(`Encrypted ${vaultSession.entries.length} secret${vaultSession.entries.length === 1 ? '' : 's'} to the local vault.`);
  });

  const toggleSavedKey = () => {
    const retaining = !keyStatus.retained;
    const confirmed = window.confirm(retaining
      ? 'Save this project’s encrypted vault key in macOS Keychain?'
      : 'Remove this project’s encrypted vault key from macOS Keychain? You will need to enter it again.');
    if (!confirmed) return;
    void run(retaining ? 'Saving encrypted vault key' : 'Removing encrypted vault key', async () => {
      if (retaining) {
        const next = await retainVaultKey(workspaceId, vaultSession.passphrase);
        setKeyStatus(next);
        audit('vault.key.retain', 'Saved the encrypted local vault key in macOS Keychain.');
        setMessage('Encrypted vault key saved locally in macOS Keychain.');
      } else {
        const next = await forgetVaultKey(workspaceId);
        setKeyStatus(next);
        if (!vaultSession.passphrase) {
          onVaultSession({ unlocked: false, passphrase: '', entries: [] });
          setRevealed(false);
        }
        audit('vault.key.forget', 'Removed the encrypted local vault key from macOS Keychain.');
        setMessage(vaultSession.passphrase ? 'Saved vault key removed. The current in-memory vault remains unlocked.' : 'Saved vault key removed. Enter the passphrase to unlock the vault again.');
      }
    });
  };

  const addSecret = () => {
    const name = newSecretName.trim();
    if (!name || !newSecretValue) { setError('Enter a unique secret name and value.'); return; }
    if (name.startsWith(ENVIRONMENT_SECRET_NAME_PREFIX)) { setError('This secret name uses a reserved private-environment prefix.'); return; }
    if (vaultNames.has(name.toLowerCase())) { setError('Secret names must be unique, ignoring case.'); return; }
    const entry: VaultEntry = { id: secretId(), name, value: newSecretValue, updatedAt: new Date().toISOString() };
    onVaultSession({ ...vaultSession, entries: [...vaultSession.entries, entry] });
    setNewSecretName(''); setNewSecretValue(''); setError('');
  };

  const pull = () => run('Pulling encrypted revision', async () => {
    const payload = await pullEncryptedSync(workspace.collaboration.path, syncPassphrase);
    onChangeWorkspace((current) => appendAudit(mergeSyncedWorkspace(current, payload), 'sync.pull', `Pulled encrypted revision ${payload.revision} from ${payload.actor || 'another collaborator'}.`));
    const next = await encryptedSyncStatus(workspace.collaboration.path); setSyncStatus(next);
    setMessage(`Pulled revision ${payload.revision}, saved by ${payload.actor || 'unknown actor'}.`);
  });

  const push = () => run(forcePush ? 'Force pushing encrypted revision' : 'Pushing encrypted revision', async () => {
    if (!canEdit) throw new Error('The selected governance actor does not have edit authority.');
    if (!workspace.governance.policy.allowedStorage.includes('encrypted-file')) throw new Error('Workspace policy does not allow encrypted-file collaboration.');
    if (plaintextSecrets.length) throw new Error(`Vault policy blocked ${plaintextSecrets.length} plaintext secret candidate${plaintextSecrets.length === 1 ? '' : 's'}. Replace them with vault or external-vault references first.`);
    const payload = await pushEncryptedSync({
      path: workspace.collaboration.path,
      passphrase: syncPassphrase,
      actor: workspace.collaboration.actor || currentMember?.name || 'Local collaborator',
      baseRevision: workspace.collaboration.revision,
      force: forcePush,
      workspace: shareableWorkspace(workspace),
    });
    onChangeWorkspace((current) => appendAudit({ ...current, collaboration: { ...current.collaboration, mode: 'encrypted-file', revision: payload.revision, lastPushedAt: new Date().toISOString() } }, forcePush ? 'sync.force-push' : 'sync.push', `Published encrypted revision ${payload.revision}.`));
    const next = await encryptedSyncStatus(workspace.collaboration.path); setSyncStatus(next); setForcePush(false);
    setMessage(`Published encrypted revision ${payload.revision}.`);
  });

  const addMember = () => {
    if (!canGovern) { setError('Only an owner or admin can add local governance actors.'); return; }
    if (!newMemberName.trim()) { setError('Enter a member name.'); return; }
    const member: GovernanceMember = { id: memberId(), name: newMemberName.trim(), email: newMemberEmail.trim(), role: 'editor', active: true };
    onChangeWorkspace((current) => appendAudit({ ...current, governance: { ...current.governance, members: [...current.governance.members, member] } }, 'governance.member.add', `Added ${member.name} as editor.`));
    setNewMemberName(''); setNewMemberEmail(''); setError('');
  };

  const updateMember = (id: string, patch: Partial<GovernanceMember>) => {
    if (!canGovern) { setError('Only an owner or admin can change governance actors.'); return; }
    const nextMembers = workspace.governance.members.map((member) => member.id === id ? { ...member, ...patch } : member);
    if (!nextMembers.some((member) => member.active && member.role === 'owner')) { setError('At least one active owner is required.'); return; }
    onChangeWorkspace((current) => appendAudit({ ...current, governance: { ...current.governance, members: nextMembers } }, 'governance.member.update', `Updated governance actor ${id}.`));
  };

  return (
    <section className="security-workbench">
      <header className="security-header"><div><small>Security & collaboration</small><h1>Encrypted local control plane</h1><p>Keep secrets out of workspace files, exchange end-to-end encrypted revisions, and record local governance decisions without a paid service.</p></div><span className="local-only-badge">Free · self-hostable files</span></header>
      <nav className="security-tabs" aria-label="Security sections"><button className={tab === 'vault' ? 'active' : ''} onClick={() => setTab('vault')} type="button">Local vault</button><button className={tab === 'certificates' ? 'active' : ''} onClick={() => setTab('certificates')} type="button">Certificates</button><button className={tab === 'sync' ? 'active' : ''} onClick={() => setTab('sync')} type="button">Encrypted sync</button><button className={tab === 'governance' ? 'active' : ''} onClick={() => setTab('governance')} type="button">Governance & audit</button></nav>{tab === 'certificates' ? <CertificateManager canEdit={Boolean(canEdit)} certificates={getWorkspaceFileState(workspace, workspaceFileId).certificates} onChange={(certificates) => onChangeWorkspace((current) => updateWorkspaceFileState(current, workspaceFileId, (state) => ({ ...state, certificates })))} /> : null}

      {tab === 'vault' ? <div className="security-grid vault-grid">
        <section className="security-card vault-control"><header><div><small>AES-256-GCM · PBKDF2-SHA256</small><h2>{vaultSession.unlocked ? 'Vault unlocked in memory' : status.exists ? 'Unlock local vault' : 'Create local vault'}</h2></div><Icon name="lock" size={24} /></header>{!native ? <p>The browser build cannot access the encrypted application-data file. Use the Tauri desktop app.</p> : vaultSession.unlocked ? <><div className="vault-actions"><button onClick={() => { onVaultSession({ unlocked: false, passphrase: '', entries: [] }); setRevealed(false); setMessage('Vault locked and decrypted values cleared from application memory.'); }} type="button">Lock and clear memory</button><button disabled={!canEdit || Boolean(busy) || (!vaultSession.passphrase && !keyStatus.retained)} onClick={persistVault} type="button">Save encrypted vault</button></div><label className="reveal-toggle"><input checked={revealed} onChange={(event) => setRevealed(event.target.checked)} type="checkbox" /> Reveal secret values on this screen</label></> : <><label>Encryption passphrase<input autoComplete="off" type="password" value={vaultSession.passphrase} onChange={(event) => onVaultSession({ ...vaultSession, passphrase: event.target.value })} /></label><button disabled={vaultSession.passphrase.length < 12 || Boolean(busy)} onClick={unlockOrCreate} type="button">{status.exists ? 'Unlock vault' : 'Create encrypted vault'}</button><small>The passphrase stays in memory unless you explicitly retain it in macOS Keychain.</small></>}{native && status.exists ? <VaultKeyRetentionControl busy={Boolean(busy)} canRetain={vaultSession.unlocked && vaultSession.passphrase.length >= 12} onToggle={toggleSavedKey} retained={keyStatus.retained} supported={keyStatus.supported} /> : null}</section>
        <section className="security-card vault-entries"><header><div><small>Request syntax</small><h2>{'{{ vault.secret_name }}'}</h2></div><span>{visibleVaultEntries.length} direct · {environmentSecretCount} environment</span></header>{vaultSession.unlocked ? <><div className="vault-new"><input placeholder="secret_name" value={newSecretName} onChange={(event) => setNewSecretName(event.target.value)} /><input placeholder="Secret value" type={revealed ? 'text' : 'password'} value={newSecretValue} onChange={(event) => setNewSecretValue(event.target.value)} /><button disabled={!canEdit} onClick={addSecret} type="button">Add</button></div><div className="vault-list">{visibleVaultEntries.map((entry) => <article key={entry.id}><input aria-label={`${entry.name} name`} disabled={!canEdit} value={entry.name} onChange={(event) => { if (event.target.value.startsWith(ENVIRONMENT_SECRET_NAME_PREFIX)) { setError('This secret name uses a reserved private-environment prefix.'); return; } onVaultSession({ ...vaultSession, entries: vaultSession.entries.map((candidate) => candidate.id === entry.id ? { ...candidate, name: event.target.value, updatedAt: new Date().toISOString() } : candidate) }); }} /><input aria-label={`${entry.name} value`} disabled={!canEdit} type={revealed ? 'text' : 'password'} value={entry.value} onChange={(event) => onVaultSession({ ...vaultSession, entries: vaultSession.entries.map((candidate) => candidate.id === entry.id ? { ...candidate, value: event.target.value, updatedAt: new Date().toISOString() } : candidate) })} /><button disabled={!canEdit} onClick={() => onVaultSession({ ...vaultSession, entries: vaultSession.entries.filter((candidate) => candidate.id !== entry.id) })} type="button"><Icon name="trash" size={14} /></button></article>)}{!visibleVaultEntries.length ? <p>No direct secrets yet. Private-environment Secret values are managed in their environment rows.</p> : null}</div></> : <div className="empty-state"><Icon name="lock" size={28} /><strong>Vault is locked</strong><span>Unlock it to resolve vault-prefixed request variables.</span></div>}</section>
        <section className="security-card external-vault-card"><header><div><small>Official CLI chains or protected profiles</small><h2>External vault resolver</h2></div><span>30 minute memory cache</span></header><div className="external-vault-fields"><label>Provider<select disabled={!native} value={external.provider} onChange={(event) => setExternal({ ...external, provider: event.target.value as ExternalSecretInput['provider'], credentialId: '', appName: '' })}><option value="aws">AWS Secrets Manager</option><option value="gcp">GCP Secret Manager</option><option value="azure">Azure Key Vault</option><option value="hashicorp">HashiCorp Vault</option></select></label><label>Credential<select disabled={!native} value={external.credentialId ?? ''} onChange={(event) => { const credentialId = event.target.value; const selected = externalCredentials.find((credential) => credential.id === credentialId); setExternal({ ...external, credentialId, appName: selected?.credentials.type === 'hcpVaultSecrets' ? external.appName : '' }); }}><option value="">Ambient official CLI login</option>{externalCredentialsForProvider(externalCredentials, external.provider).map((credential) => <option key={credential.id} value={credential.id}>{credential.name}</option>)}</select></label><label>{usesAzureOauth ? 'Secret identifier URL' : 'Secret reference'}<input disabled={!native} value={external.reference} onChange={(event) => setExternal({ ...external, reference: event.target.value })} placeholder={usesAzureOauth ? 'https://vault-name.vault.azure.net/secrets/secret-name/version' : external.provider === 'hashicorp' ? 'secret/data/orders' : 'orders-api-token'} /></label>{!usesAzureOauth ? <><label>{usesHcpVaultSecrets ? 'Organization ID' : external.provider === 'aws' ? 'Region' : external.provider === 'gcp' ? 'Project' : external.provider === 'azure' ? 'Vault name' : 'Scope (unused)'}<input disabled={!native} value={external.scope} onChange={(event) => setExternal({ ...external, scope: event.target.value })} /></label><label>{usesHcpVaultSecrets ? 'Project ID' : external.provider === 'hashicorp' ? 'Field' : 'Field (provider default)'}<input disabled={!native} value={external.field} onChange={(event) => setExternal({ ...external, field: event.target.value })} placeholder={usesHcpVaultSecrets ? 'project-id' : external.provider === 'hashicorp' ? 'token' : ''} /></label>{usesHcpVaultSecrets ? <label>App name<input disabled={!native} value={external.appName} onChange={(event) => setExternal({ ...external, appName: event.target.value })} /></label> : null}<label>Version / stage<input disabled={!native} value={external.version} onChange={(event) => setExternal({ ...external, version: event.target.value })} placeholder="latest" /></label></> : null}</div><code>{`{% external '${external.provider}', '${external.reference || 'secret-reference'}', '${external.scope ?? ''}', '${external.field ?? ''}', '${external.version ?? ''}', '${external.credentialId ?? ''}', '${external.appName ?? ''}' %}`}</code><div className="vault-actions"><button disabled={!native || !external.reference || Boolean(busy)} onClick={() => run('Resolving external secret', async () => { const value = await resolveExternalSecret(external); audit('external-vault.resolve', `Resolved a ${external.provider} secret through its selected local credential authority.`); setMessage(`External secret resolved successfully · ${new TextEncoder().encode(value).length} bytes cached in memory.`); })} type="button">Test without revealing</button><button disabled={!canGovern || !external.reference} onClick={toggleExternalApproval} type="button">{externalApproved ? 'Revoke request use' : 'Approve for requests'}</button><button disabled={!native || Boolean(busy)} onClick={() => run('Clearing external cache', async () => { await clearExternalSecretCache(); audit('external-vault.cache.clear', 'Cleared the in-memory external secret cache.'); setMessage('External secret cache cleared.'); })} type="button">Clear cache</button></div><p>Credential selection and HCP app coordinates are part of the exact approval and cache key. Workspace data cannot grant itself access to another device profile.</p></section>
        {native ? <ExternalCredentialManager credentials={externalCredentials} disabled={Boolean(busy)} onSave={async (credentials) => { const saved = await saveExternalCredentials(credentials); setExternalCredentials(saved); const credentialId = retainedExternalCredentialId(external.credentialId, saved); if (credentialId !== external.credentialId) setExternal({ ...external, credentialId, appName: '' }); }} /> : null}
        {native && status.exists && !vaultSession.unlocked ? <section className="security-card danger-zone"><header><h2>Recovery boundary</h2></header><p>Brunomnia cannot recover a lost passphrase. Reset permanently deletes this project's encrypted local vault, any saved Keychain key, and every private-environment Secret row.</p><button onClick={() => { if (!window.confirm('Permanently delete this project’s encrypted local vault and all private-environment Secret rows?')) return; void run('Resetting vault', async () => { await resetVault(workspaceId); setStatus(blankStatus); setKeyStatus((current) => ({ ...current, retained: false })); onVaultSession({ unlocked: false, passphrase: '', entries: [] }); onChangeWorkspace((current) => withoutEnvironmentSecrets(current)); audit('vault.reset', 'Permanently reset the project encrypted local vault and removed private-environment Secret rows.'); }); }} type="button">Reset encrypted vault</button></section> : null}
      </div> : null}

      {tab === 'sync' ? <div className="security-grid sync-grid"><section className="security-card"><header><div><small>Revision checked</small><h2>Encrypted shared file</h2></div><span>Revision {workspace.collaboration.revision}</span></header><label>Shared file path<input disabled={!native} value={workspace.collaboration.path} onChange={(event) => updateCollaboration({ mode: event.target.value ? 'encrypted-file' : 'off', path: event.target.value })} placeholder="/Volumes/team/orders.brunomnia-sync.json" /></label><label>Actor label<input value={workspace.collaboration.actor} onChange={(event) => updateCollaboration({ actor: event.target.value })} placeholder={currentMember?.name || 'Local collaborator'} /></label><label>Shared passphrase<input autoComplete="off" type="password" value={syncPassphrase} onChange={(event) => setSyncPassphrase(event.target.value)} /></label>{plaintextSecrets.length ? <div className="policy-warning"><strong>Vault policy blocked {plaintextSecrets.length} plaintext candidate{plaintextSecrets.length === 1 ? '' : 's'}</strong><span>{plaintextSecrets.slice(0, 4).join(' · ')}</span></div> : null}<div className="sync-actions"><button disabled={!native || !workspace.collaboration.path || syncPassphrase.length < 12 || Boolean(busy)} onClick={pull} type="button">Pull and decrypt</button><button disabled={!native || !workspace.collaboration.path || syncPassphrase.length < 12 || !canEdit || Boolean(busy)} onClick={push} type="button">Encrypt and push</button><button disabled={!native || !workspace.collaboration.path || Boolean(busy)} onClick={() => run('Inspecting sync file', async () => { const next = await encryptedSyncStatus(workspace.collaboration.path); setSyncStatus(next); setMessage(next.exists ? `Encrypted sync file updated ${new Date(next.updatedAt).toLocaleString()}.` : 'No encrypted sync file exists yet.'); })} type="button">Check</button></div><label className="force-toggle"><input checked={forcePush} onChange={(event) => setForcePush(event.target.checked)} type="checkbox" /> Explicitly force past a revision mismatch on the next push</label>{syncStatus.updatedAt ? <small>Encrypted file updated {new Date(syncStatus.updatedAt).toLocaleString()}</small> : null}</section><section className="security-card"><header><div><small>Shareable scope</small><h2>What crosses the boundary</h2></div><Icon name="archive" size={22} /></header><ul><li>Collections, environments, designs, mocks, and governance metadata are encrypted before writing.</li><li>History, responses, cookies, reports, Git paths, plugins, plugin data, vault contents, and the shared-file path stay local.</li><li>A mismatched base revision blocks push until you pull or deliberately select force.</li></ul><p>This file can live on a self-hosted file share, mounted WebDAV volume, or another user-controlled synchronization system. Real-time presence and server-mediated comments are not claimed yet.</p></section></div> : null}

      {tab === 'governance' ? <div className="security-grid governance-grid"><section className="security-card"><header><div><small>Local actor model</small><h2>Members and roles</h2></div><select aria-label="Current governance actor" value={workspace.governance.currentMemberId} onChange={(event) => onChangeWorkspace((current) => ({ ...current, governance: { ...current.governance, currentMemberId: event.target.value } }))}>{workspace.governance.members.filter((member) => member.active).map((member) => <option key={member.id} value={member.id}>{member.name} · {member.role}</option>)}</select></header><div className="member-list">{workspace.governance.members.map((member) => <article key={member.id}><span><strong>{member.name}</strong><small>{member.email || 'No email'} · {member.active ? 'active' : 'inactive'}</small></span><select disabled={!canGovern} value={member.role} onChange={(event) => updateMember(member.id, { role: event.target.value as GovernanceRole })}>{roles.map((role) => <option key={role}>{role}</option>)}</select><label><input checked={member.active} disabled={!canGovern} onChange={(event) => updateMember(member.id, { active: event.target.checked })} type="checkbox" /> Active</label></article>)}</div><div className="member-new"><input placeholder="Member name" value={newMemberName} onChange={(event) => setNewMemberName(event.target.value)} /><input placeholder="Email (optional)" value={newMemberEmail} onChange={(event) => setNewMemberEmail(event.target.value)} /><button disabled={!canGovern} onClick={addMember} type="button">Add editor</button></div><p>These roles protect local sync/governance actions; they are not authentication. SSO and SCIM adapters require a self-hosted identity service in the next closure step.</p></section><section className="security-card"><header><div><small>Workspace policy</small><h2>Guardrails</h2></div></header><div className="policy-list"><div className="storage-policy">{(['local', 'folder', 'git', 'encrypted-file'] as const).map((mode) => <label key={mode}><input checked={workspace.governance.policy.allowedStorage.includes(mode)} disabled={!canGovern} onChange={(event) => updateStoragePolicy(mode, event.target.checked)} type="checkbox" /> {mode}</label>)}</div><label><input checked={workspace.governance.policy.requireEncryptedSync} disabled={!canGovern} onChange={(event) => onChangeWorkspace((current) => appendAudit({ ...current, governance: { ...current.governance, policy: { ...current.governance.policy, requireEncryptedSync: event.target.checked } } }, 'governance.policy.update', 'Changed encrypted-sync requirement.'))} type="checkbox" /> Require encrypted collaboration files</label><label><input checked={workspace.governance.policy.requireVaultForSecrets} disabled={!canGovern} onChange={(event) => onChangeWorkspace((current) => appendAudit({ ...current, governance: { ...current.governance, policy: { ...current.governance.policy, requireVaultForSecrets: event.target.checked } } }, 'governance.policy.update', 'Changed local-vault secret policy.'))} type="checkbox" /> Require the encrypted vault for secret values</label><label>Audit retention<input disabled={!canGovern} min="1" max="10000" type="number" value={workspace.governance.policy.auditRetention} onChange={(event) => onChangeWorkspace((current) => ({ ...current, governance: { ...current.governance, policy: { ...current.governance.policy, auditRetention: Math.min(10000, Math.max(1, Number(event.target.value))) } } }))} /></label></div></section><section className="security-card audit-card"><header><div><small>Append-only in UI</small><h2>Audit trail</h2></div><span>{workspace.governance.audit.length}</span></header><div>{workspace.governance.audit.map((event) => <article key={event.id}><time>{new Date(event.timestamp).toLocaleString()}</time><strong>{event.action}</strong><span>{event.detail}</span><small>{workspace.governance.members.find((member) => member.id === event.actorId)?.name ?? event.actorId}</small></article>)}{!workspace.governance.audit.length ? <p>No governance events recorded yet.</p> : null}</div></section></div> : null}
      {busy ? <div className="automation-message">{busy}…</div> : null}{error ? <div className="automation-message error">{error}</div> : null}{message ? <div className="automation-message">{message}</div> : null}
    </section>
  );
}
