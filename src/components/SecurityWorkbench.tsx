import { isTauri } from '@tauri-apps/api/core';
import { withoutOAuth2RuntimeCredentials } from '../lib/oauth2Tokens';
import { useEffect, useMemo, useState } from 'react';
import {
  appendAudit,
  clearExternalSecretCache,
  encryptedSyncIdentity,
  encryptedSyncRecipientFromInvite,
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
  type SyncFileStatus,
  type SyncIdentity,
  type SyncRecipient,
  type ExternalSecretInput,
  type ExternalCredentialRecord,
  type VaultEntry,
  type VaultKeyStatus,
  type VaultSession,
} from '../lib/security';
import { directVaultEntries, ENVIRONMENT_SECRET_NAME_PREFIX, isEnvironmentSecretEntry, withoutEnvironmentSecrets } from '../lib/environmentSecrets';
import type { Workspace } from '../types';
import { CertificateManager } from './CertificateManager';
import { Icon } from './Icon';
import { ExternalCredentialManager } from './ExternalCredentialManager';
import { CollaborationRepositoryPanel } from './CollaborationRepositoryPanel';
import { getWorkspaceFileState, updateWorkspaceFileState } from '../lib/workspaceFileState';
import { dirtyCollaborationResources } from '../lib/collaboration';
import { IdentityGovernancePanel } from './IdentityGovernancePanel';

type SecurityWorkbenchProps = {
  workspaceId: string;
  workspace: Workspace;
  workspaceFileId: string;
  vaultSession: VaultSession;
  onVaultSession: (session: VaultSession) => void;
  onChangeWorkspace: (updater: (workspace: Workspace) => Workspace) => void;
};

const blankStatus: SecureFileStatus = { exists: false, updatedAt: '' };
const blankSyncStatus: SyncFileStatus = { exists: false, updatedAt: '', encryptionMode: 'none', recipients: [] };
const blankKeyStatus: VaultKeyStatus = { supported: false, retained: false };
const secretId = () => `secret-${crypto.randomUUID()}`;

type VaultKeyRetentionControlProps = {
  supported: boolean;
  retained: boolean;
  canRetain: boolean;
  busy: boolean;
  onToggle: () => void;
};

export function VaultKeyRetentionControl({ supported, retained, canRetain, busy, onToggle }: VaultKeyRetentionControlProps) {
  if (!supported) return <small>Automatic vault-key retention requires an operating-system credential store.</small>;
  return <>
    <label className="reveal-toggle"><input checked={retained} disabled={busy || (!retained && !canRetain)} onChange={onToggle} type="checkbox" /> Save encrypted vault key locally</label>
    <small>{retained ? 'The operating-system credential store can unlock this project without returning the saved key to the renderer.' : 'Unlock the vault manually to enable optional operating-system credential retention.'}</small>
  </>;
}

type SyncRecipientEncryptionControlProps = {
  status: SyncFileStatus;
  identity?: SyncIdentity;
  enabled: boolean;
  recipients: SyncRecipient[];
  invite: string;
  canGovern: boolean;
  busy: boolean;
  onToggle: (enabled: boolean) => void;
  onInvite: (value: string) => void;
  onAdd: () => void;
  onRemove: (recipient: SyncRecipient) => void;
};

export function SyncRecipientEncryptionControl({ status, identity, enabled, recipients, invite, canGovern, busy, onToggle, onInvite, onAdd, onRemove }: SyncRecipientEncryptionControlProps) {
  return <section className="security-card sync-recipient-card">
    <header><div><small>X25519 · rotating AES-256-GCM key</small><h2>Per-user recipients</h2></div><span>{enabled ? `${recipients.length} active` : 'Optional'}</span></header>
    <label className="force-toggle"><input checked={enabled} disabled={busy || status.encryptionMode === 'recipients'} onChange={(event) => onToggle(event.target.checked)} type="checkbox" /> Encrypt new revisions only for listed device identities</label>
    {identity ? <><label>Your public invitation<textarea aria-label="Your public encrypted-sync invitation" readOnly rows={3} value={identity.inviteCode} /></label><small>Share this public invitation with an owner. The private X25519 key remains in this device's operating-system credential store.</small></> : <p>Creating the device identity…</p>}
    {enabled ? <><div className="sync-recipient-add"><textarea aria-label="Recipient invitation" disabled={!canGovern || busy} onChange={(event) => onInvite(event.target.value)} placeholder="Paste a brunomnia-sync-recipient-v1 invitation" rows={3} value={invite} /><button disabled={!canGovern || busy || !invite.trim()} onClick={onAdd} type="button">Add recipient</button></div><div className="sync-recipient-list">{recipients.map((recipient) => <article key={recipient.id}><span><strong>{recipient.label}</strong><code>{recipient.id}</code></span><button disabled={!canGovern || busy || recipient.id === identity?.recipient.id} onClick={() => onRemove(recipient)} type="button">{recipient.id === identity?.recipient.id ? 'This device' : 'Remove'}</button></article>)}</div><p>Every push creates a fresh random content key. Removing a recipient takes effect when the next revision is published and cannot erase copies of older ciphertext retained outside Brunomnia.</p></> : <p>Shared-passphrase files remain supported. Enable recipients before the next push to migrate without exposing a shared decryption secret.</p>}
  </section>;
}

export const retainedExternalCredentialId = (credentialId: string | undefined, credentials: ExternalCredentialRecord[]) => credentialId && credentials.some((credential) => credential.id === credentialId) ? credentialId : '';
export const externalCredentialsForProvider = (credentials: ExternalCredentialRecord[], provider: ExternalSecretInput['provider']) => credentials.filter((credential) => credential.provider === provider);

export function SecurityWorkbench({ workspaceId, workspaceFileId, workspace, vaultSession, onVaultSession, onChangeWorkspace }: SecurityWorkbenchProps) {
  const [tab, setTab] = useState<'vault' | 'certificates' | 'sync' | 'governance'>('vault');
  const [status, setStatus] = useState<SecureFileStatus>(blankStatus);
  const [keyStatus, setKeyStatus] = useState<VaultKeyStatus>(blankKeyStatus);
  const [syncStatus, setSyncStatus] = useState<SyncFileStatus>(blankSyncStatus);
  const [syncPassphrase, setSyncPassphrase] = useState('');
  const [syncIdentity, setSyncIdentity] = useState<SyncIdentity>();
  const [syncRecipients, setSyncRecipients] = useState<SyncRecipient[]>([]);
  const [syncRecipientInvite, setSyncRecipientInvite] = useState('');
  const [recipientEncryption, setRecipientEncryption] = useState(false);
  const [forcePush, setForcePush] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [newSecretName, setNewSecretName] = useState('');
  const [newSecretValue, setNewSecretValue] = useState('');
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
  const syncActorLabel = workspace.collaboration.actor || currentMember?.name || 'Local collaborator';
  const syncUsesRecipients = recipientEncryption || syncStatus.encryptionMode === 'recipients';
  const syncCredentialReady = syncStatus.encryptionMode === 'passphrase' ? syncPassphrase.length >= 12 : syncUsesRecipients ? Boolean(syncIdentity) : syncPassphrase.length >= 12;

  const run = async (label: string, operation: () => Promise<void>) => {
    if (busy) return;
    setBusy(label); setError(''); setMessage('');
    try { await operation(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
    finally { setBusy(''); }
  };
  const audit = (action: string, detail: string) => onChangeWorkspace((current) => appendAudit(current, action, detail));
  const updateCollaboration = (patch: Partial<Workspace['collaboration']>) => onChangeWorkspace((current) => ({ ...current, collaboration: { ...current.collaboration, ...patch } }));
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

  useEffect(() => {
    if (!native || tab !== 'sync') return;
    let cancelled = false;
    const statusPromise = workspace.collaboration.path
      ? encryptedSyncStatus(workspace.collaboration.path)
      : Promise.resolve(blankSyncStatus);
    void Promise.all([encryptedSyncIdentity(syncActorLabel), statusPromise]).then(([identity, nextStatus]) => {
      if (cancelled) return;
      setSyncIdentity(identity);
      setSyncStatus(nextStatus);
      if (nextStatus.encryptionMode === 'recipients') {
        setRecipientEncryption(true);
        setSyncRecipients(nextStatus.recipients);
      } else {
        setRecipientEncryption(false);
        setSyncRecipients([identity.recipient]);
      }
    }).catch((caught) => { if (!cancelled) setError(caught instanceof Error ? caught.message : String(caught)); });
    return () => { cancelled = true; };
  }, [native, tab, workspace.collaboration.path]);

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
      ? 'Save this project’s encrypted vault key in the operating-system credential store?'
      : 'Remove this project’s encrypted vault key from the operating-system credential store? You will need to enter it again.');
    if (!confirmed) return;
    void run(retaining ? 'Saving encrypted vault key' : 'Removing encrypted vault key', async () => {
      if (retaining) {
        const next = await retainVaultKey(workspaceId, vaultSession.passphrase);
        setKeyStatus(next);
        audit('vault.key.retain', 'Saved the encrypted local vault key in the operating-system credential store.');
        setMessage('Encrypted vault key saved locally in the operating-system credential store.');
      } else {
        const next = await forgetVaultKey(workspaceId);
        setKeyStatus(next);
        if (!vaultSession.passphrase) {
          onVaultSession({ unlocked: false, passphrase: '', entries: [] });
          setRevealed(false);
        }
        audit('vault.key.forget', 'Removed the encrypted local vault key from the operating-system credential store.');
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

  const refreshSyncStatus = async () => {
    const next = await encryptedSyncStatus(workspace.collaboration.path);
    setSyncStatus(next);
    if (next.encryptionMode === 'recipients') {
      setRecipientEncryption(true);
      setSyncRecipients(next.recipients);
    }
    return next;
  };

  const toggleRecipientEncryption = (enabled: boolean) => {
    if (syncStatus.encryptionMode === 'recipients' && !enabled) return;
    if (!enabled) { setRecipientEncryption(false); return; }
    if (syncIdentity) {
      setRecipientEncryption(true);
      setSyncRecipients((current) => current.some((recipient) => recipient.id === syncIdentity.recipient.id) ? current : [syncIdentity.recipient, ...current]);
      return;
    }
    void run('Creating device collaboration identity', async () => {
      const identity = await encryptedSyncIdentity(syncActorLabel);
      setSyncIdentity(identity);
      setSyncRecipients((current) => current.some((recipient) => recipient.id === identity.recipient.id) ? current : [identity.recipient, ...current]);
      setRecipientEncryption(true);
      setMessage('Created an X25519 collaboration identity in the operating-system credential store.');
    });
  };

  const addSyncRecipient = () => run('Validating recipient invitation', async () => {
    if (!canGovern) throw new Error('Only an owner or admin can change encrypted-sync recipients.');
    const recipient = await encryptedSyncRecipientFromInvite(syncRecipientInvite);
    setSyncRecipients((current) => current.some((candidate) => candidate.id === recipient.id) ? current.map((candidate) => candidate.id === recipient.id ? recipient : candidate) : [...current, recipient]);
    setSyncRecipientInvite('');
    setRecipientEncryption(true);
    setMessage(`Added ${recipient.label}. Publish a new revision to rotate the data key for the updated recipient list.`);
  });

  const removeSyncRecipient = (recipient: SyncRecipient) => {
    if (!canGovern) { setError('Only an owner or admin can change encrypted-sync recipients.'); return; }
    if (recipient.id === syncIdentity?.recipient.id) { setError('This device must remain a recipient while it rotates the sync key.'); return; }
    setSyncRecipients((current) => current.filter((candidate) => candidate.id !== recipient.id));
    setMessage(`Removed ${recipient.label} from the pending recipient list. Publish a new revision to rotate the data key.`);
  };

  const pull = () => run('Pulling encrypted revision', async () => {
    const payload = await pullEncryptedSync(workspace.collaboration.path, syncPassphrase);
    onChangeWorkspace((current) => appendAudit(mergeSyncedWorkspace(current, payload), 'sync.pull', `Pulled encrypted revision ${payload.revision} from ${payload.actor || 'another collaborator'}.`));
    await refreshSyncStatus();
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
      repository: workspace.collaboration.repository,
      recipientEncryption: syncUsesRecipients,
      recipients: syncUsesRecipients ? syncRecipients : [],
    });
    onChangeWorkspace((current) => appendAudit({ ...current, collaboration: { ...current.collaboration, mode: 'encrypted-file', revision: payload.revision, lastPushedAt: new Date().toISOString() } }, forcePush ? 'sync.force-push' : 'sync.push', `Published encrypted revision ${payload.revision}${syncUsesRecipients ? ` for ${syncRecipients.length} recipient${syncRecipients.length === 1 ? '' : 's'}` : ''}.`));
    await refreshSyncStatus(); setForcePush(false);
    setMessage(`Published encrypted revision ${payload.revision}${syncUsesRecipients ? ' with a freshly rotated recipient data key' : ''}.`);
  });

  useEffect(() => {
    if (!native || tab !== 'sync' || !workspace.collaboration.autoSync || !workspace.collaboration.path || !syncCredentialReady || busy) return;
    let cancelled = false;
    let polling = false;
    const poll = async () => {
      if (polling) return;
      polling = true;
      try {
        const nextStatus = await encryptedSyncStatus(workspace.collaboration.path);
        if (cancelled || !nextStatus.exists) return;
        if (!syncStatus.updatedAt) {
          setSyncStatus(nextStatus);
          if (nextStatus.encryptionMode === 'recipients') { setRecipientEncryption(true); setSyncRecipients(nextStatus.recipients); }
          return;
        }
        if (nextStatus.updatedAt === syncStatus.updatedAt) return;
        const dirty = dirtyCollaborationResources(workspace, workspace.collaboration.repository);
        if (workspace.collaboration.stagedResourceKeys.length || dirty.length) {
          setMessage(`Encrypted revision changed remotely at ${new Date(nextStatus.updatedAt).toLocaleString()}. Commit or restore ${dirty.length || workspace.collaboration.stagedResourceKeys.length} local resource change${dirty.length === 1 ? '' : 's'} before automatic pull.`);
          return;
        }
        const payload = await pullEncryptedSync(workspace.collaboration.path, syncPassphrase);
        if (cancelled) return;
        if (payload.revision > workspace.collaboration.revision) {
          onChangeWorkspace((current) => appendAudit(mergeSyncedWorkspace(current, payload), 'sync.auto-pull', `Automatically pulled encrypted revision ${payload.revision} from ${payload.actor || 'another collaborator'}.`));
          setMessage(`Automatically pulled revision ${payload.revision} from ${payload.actor || 'another collaborator'}.`);
        }
        setSyncStatus(nextStatus);
        if (nextStatus.encryptionMode === 'recipients') { setRecipientEncryption(true); setSyncRecipients(nextStatus.recipients); }
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : String(caught));
      } finally { polling = false; }
    };
    const interval = window.setInterval(() => { void poll(); }, 5_000);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, [busy, native, onChangeWorkspace, syncCredentialReady, syncPassphrase, syncStatus.updatedAt, tab, workspace]);

  return (
    <section className="security-workbench">
      <header className="security-header"><div><small>Security & collaboration</small><h1>Encrypted local control plane</h1><p>Keep secrets out of workspace files, exchange end-to-end encrypted revisions, and record local governance decisions without a paid service.</p></div><span className="local-only-badge">Free · self-hostable files</span></header>
      <nav className="security-tabs" aria-label="Security sections"><button className={tab === 'vault' ? 'active' : ''} onClick={() => setTab('vault')} type="button">Local vault</button><button className={tab === 'certificates' ? 'active' : ''} onClick={() => setTab('certificates')} type="button">Certificates</button><button className={tab === 'sync' ? 'active' : ''} onClick={() => setTab('sync')} type="button">Encrypted sync</button><button className={tab === 'governance' ? 'active' : ''} onClick={() => setTab('governance')} type="button">Governance & audit</button></nav>{tab === 'certificates' ? <CertificateManager canEdit={Boolean(canEdit)} certificates={getWorkspaceFileState(workspace, workspaceFileId).certificates} onChange={(certificates) => onChangeWorkspace((current) => updateWorkspaceFileState(current, workspaceFileId, (state) => ({ ...state, certificates })))} /> : null}

      {tab === 'vault' ? <div className="security-grid vault-grid">
        <section className="security-card vault-control"><header><div><small>AES-256-GCM · PBKDF2-SHA256</small><h2>{vaultSession.unlocked ? 'Vault unlocked in memory' : status.exists ? 'Unlock local vault' : 'Create local vault'}</h2></div><Icon name="lock" size={24} /></header>{!native ? <p>The browser build cannot access the encrypted application-data file. Use the Tauri desktop app.</p> : vaultSession.unlocked ? <><div className="vault-actions"><button onClick={() => { onVaultSession({ unlocked: false, passphrase: '', entries: [] }); setRevealed(false); setMessage('Vault locked and decrypted values cleared from application memory.'); }} type="button">Lock and clear memory</button><button disabled={!canEdit || Boolean(busy) || (!vaultSession.passphrase && !keyStatus.retained)} onClick={persistVault} type="button">Save encrypted vault</button></div><label className="reveal-toggle"><input checked={revealed} onChange={(event) => setRevealed(event.target.checked)} type="checkbox" /> Reveal secret values on this screen</label></> : <><label>Encryption passphrase<input autoComplete="off" type="password" value={vaultSession.passphrase} onChange={(event) => onVaultSession({ ...vaultSession, passphrase: event.target.value })} /></label><button disabled={vaultSession.passphrase.length < 12 || Boolean(busy)} onClick={unlockOrCreate} type="button">{status.exists ? 'Unlock vault' : 'Create encrypted vault'}</button><small>The passphrase stays in memory unless you explicitly retain it in the operating-system credential store.</small></>}{native && status.exists ? <VaultKeyRetentionControl busy={Boolean(busy)} canRetain={vaultSession.unlocked && vaultSession.passphrase.length >= 12} onToggle={toggleSavedKey} retained={keyStatus.retained} supported={keyStatus.supported} /> : null}</section>
        <section className="security-card vault-entries"><header><div><small>Request syntax</small><h2>{'{{ vault.secret_name }}'}</h2></div><span>{visibleVaultEntries.length} direct · {environmentSecretCount} environment</span></header>{vaultSession.unlocked ? <><div className="vault-new"><input placeholder="secret_name" value={newSecretName} onChange={(event) => setNewSecretName(event.target.value)} /><input placeholder="Secret value" type={revealed ? 'text' : 'password'} value={newSecretValue} onChange={(event) => setNewSecretValue(event.target.value)} /><button disabled={!canEdit} onClick={addSecret} type="button">Add</button></div><div className="vault-list">{visibleVaultEntries.map((entry) => <article key={entry.id}><input aria-label={`${entry.name} name`} disabled={!canEdit} value={entry.name} onChange={(event) => { if (event.target.value.startsWith(ENVIRONMENT_SECRET_NAME_PREFIX)) { setError('This secret name uses a reserved private-environment prefix.'); return; } onVaultSession({ ...vaultSession, entries: vaultSession.entries.map((candidate) => candidate.id === entry.id ? { ...candidate, name: event.target.value, updatedAt: new Date().toISOString() } : candidate) }); }} /><input aria-label={`${entry.name} value`} disabled={!canEdit} type={revealed ? 'text' : 'password'} value={entry.value} onChange={(event) => onVaultSession({ ...vaultSession, entries: vaultSession.entries.map((candidate) => candidate.id === entry.id ? { ...candidate, value: event.target.value, updatedAt: new Date().toISOString() } : candidate) })} /><button disabled={!canEdit} onClick={() => onVaultSession({ ...vaultSession, entries: vaultSession.entries.filter((candidate) => candidate.id !== entry.id) })} type="button"><Icon name="trash" size={14} /></button></article>)}{!visibleVaultEntries.length ? <p>No direct secrets yet. Private-environment Secret values are managed in their environment rows.</p> : null}</div></> : <div className="empty-state"><Icon name="lock" size={28} /><strong>Vault is locked</strong><span>Unlock it to resolve vault-prefixed request variables.</span></div>}</section>
        <section className="security-card external-vault-card"><header><div><small>Official CLI chains or protected profiles</small><h2>External vault resolver</h2></div><span>30 minute memory cache</span></header><div className="external-vault-fields"><label>Provider<select disabled={!native} value={external.provider} onChange={(event) => setExternal({ ...external, provider: event.target.value as ExternalSecretInput['provider'], credentialId: '', appName: '' })}><option value="aws">AWS Secrets Manager</option><option value="gcp">GCP Secret Manager</option><option value="azure">Azure Key Vault</option><option value="hashicorp">HashiCorp Vault</option></select></label><label>Credential<select disabled={!native} value={external.credentialId ?? ''} onChange={(event) => { const credentialId = event.target.value; const selected = externalCredentials.find((credential) => credential.id === credentialId); setExternal({ ...external, credentialId, appName: selected?.credentials.type === 'hcpVaultSecrets' ? external.appName : '' }); }}><option value="">Ambient official CLI login</option>{externalCredentialsForProvider(externalCredentials, external.provider).map((credential) => <option key={credential.id} value={credential.id}>{credential.name}</option>)}</select></label><label>{usesAzureOauth ? 'Secret identifier URL' : 'Secret reference'}<input disabled={!native} value={external.reference} onChange={(event) => setExternal({ ...external, reference: event.target.value })} placeholder={usesAzureOauth ? 'https://vault-name.vault.azure.net/secrets/secret-name/version' : external.provider === 'hashicorp' ? 'secret/data/orders' : 'orders-api-token'} /></label>{!usesAzureOauth ? <><label>{usesHcpVaultSecrets ? 'Organization ID' : external.provider === 'aws' ? 'Region' : external.provider === 'gcp' ? 'Project' : external.provider === 'azure' ? 'Vault name' : 'Scope (unused)'}<input disabled={!native} value={external.scope} onChange={(event) => setExternal({ ...external, scope: event.target.value })} /></label><label>{usesHcpVaultSecrets ? 'Project ID' : external.provider === 'hashicorp' ? 'Field' : 'Field (provider default)'}<input disabled={!native} value={external.field} onChange={(event) => setExternal({ ...external, field: event.target.value })} placeholder={usesHcpVaultSecrets ? 'project-id' : external.provider === 'hashicorp' ? 'token' : ''} /></label>{usesHcpVaultSecrets ? <label>App name<input disabled={!native} value={external.appName} onChange={(event) => setExternal({ ...external, appName: event.target.value })} /></label> : null}<label>Version / stage<input disabled={!native} value={external.version} onChange={(event) => setExternal({ ...external, version: event.target.value })} placeholder="latest" /></label></> : null}</div><code>{`{% external '${external.provider}', '${external.reference || 'secret-reference'}', '${external.scope ?? ''}', '${external.field ?? ''}', '${external.version ?? ''}', '${external.credentialId ?? ''}', '${external.appName ?? ''}' %}`}</code><div className="vault-actions"><button disabled={!native || !external.reference || Boolean(busy)} onClick={() => run('Resolving external secret', async () => { const value = await resolveExternalSecret(external); audit('external-vault.resolve', `Resolved a ${external.provider} secret through its selected local credential authority.`); setMessage(`External secret resolved successfully · ${new TextEncoder().encode(value).length} bytes cached in memory.`); })} type="button">Test without revealing</button><button disabled={!canGovern || !external.reference} onClick={toggleExternalApproval} type="button">{externalApproved ? 'Revoke request use' : 'Approve for requests'}</button><button disabled={!native || Boolean(busy)} onClick={() => run('Clearing external cache', async () => { await clearExternalSecretCache(); audit('external-vault.cache.clear', 'Cleared the in-memory external secret cache.'); setMessage('External secret cache cleared.'); })} type="button">Clear cache</button></div><p>Credential selection and HCP app coordinates are part of the exact approval and cache key. Workspace data cannot grant itself access to another device profile.</p></section>
        {native ? <ExternalCredentialManager credentials={externalCredentials} disabled={Boolean(busy)} onSave={async (credentials) => { const saved = await saveExternalCredentials(credentials); setExternalCredentials(saved); const credentialId = retainedExternalCredentialId(external.credentialId, saved); if (credentialId !== external.credentialId) setExternal({ ...external, credentialId, appName: '' }); }} /> : null}
        {native && status.exists && !vaultSession.unlocked ? <section className="security-card danger-zone"><header><h2>Recovery boundary</h2></header><p>Brunomnia cannot recover a lost passphrase. Reset permanently deletes this project's encrypted local vault, any saved Keychain key, and every private-environment Secret row.</p><button onClick={() => { if (!window.confirm('Permanently delete this project’s encrypted local vault and all private-environment Secret rows?')) return; void run('Resetting vault', async () => { await resetVault(workspaceId); setStatus(blankStatus); setKeyStatus((current) => ({ ...current, retained: false })); onVaultSession({ unlocked: false, passphrase: '', entries: [] }); onChangeWorkspace((current) => withoutEnvironmentSecrets(current)); audit('vault.reset', 'Permanently reset the project encrypted local vault and removed private-environment Secret rows.'); }); }} type="button">Reset encrypted vault</button></section> : null}
      </div> : null}

      {tab === 'sync' ? <div className="security-grid sync-grid">
        <section className="security-card"><header><div><small>Revision checked</small><h2>Encrypted shared file</h2></div><span>Revision {workspace.collaboration.revision}</span></header><label>Shared file path<input disabled={!native} value={workspace.collaboration.path} onChange={(event) => updateCollaboration({ mode: event.target.value ? 'encrypted-file' : 'off', path: event.target.value })} placeholder="/Volumes/team/orders.brunomnia-sync.json" /></label><label>Actor label<input value={workspace.collaboration.actor} onChange={(event) => updateCollaboration({ actor: event.target.value })} placeholder={currentMember?.name || 'Local collaborator'} /></label>{!syncUsesRecipients || syncStatus.encryptionMode === 'passphrase' ? <label>{recipientEncryption ? 'Current shared passphrase for migration' : 'Shared passphrase'}<input autoComplete="off" type="password" value={syncPassphrase} onChange={(event) => setSyncPassphrase(event.target.value)} /></label> : null}{plaintextSecrets.length ? <div className="policy-warning"><strong>Vault policy blocked {plaintextSecrets.length} plaintext candidate{plaintextSecrets.length === 1 ? '' : 's'}</strong><span>{plaintextSecrets.slice(0, 4).join(' · ')}</span></div> : null}<div className="sync-actions"><button disabled={!native || !workspace.collaboration.path || !syncCredentialReady || Boolean(busy)} onClick={pull} type="button">Pull and decrypt</button><button disabled={!native || !workspace.collaboration.path || !syncCredentialReady || !canEdit || Boolean(busy)} onClick={push} type="button">Encrypt and push</button><button disabled={!native || !workspace.collaboration.path || Boolean(busy)} onClick={() => run('Inspecting sync file', async () => { const next = await refreshSyncStatus(); setMessage(next.exists ? `Encrypted sync file updated ${new Date(next.updatedAt).toLocaleString()} using ${next.encryptionMode === 'recipients' ? `${next.recipients.length} per-user recipient${next.recipients.length === 1 ? '' : 's'}` : 'a shared passphrase'}.` : 'No encrypted sync file exists yet.'); })} type="button">Check</button></div><label className="force-toggle"><input checked={workspace.collaboration.autoSync} onChange={(event) => updateCollaboration({ autoSync: event.target.checked })} type="checkbox" /> Automatically pull clean remote revisions every five seconds</label><label className="force-toggle"><input checked={forcePush} onChange={(event) => setForcePush(event.target.checked)} type="checkbox" /> Explicitly force past a revision mismatch on the next push</label>{syncStatus.updatedAt ? <small>Encrypted file updated {new Date(syncStatus.updatedAt).toLocaleString()} · {syncStatus.encryptionMode === 'recipients' ? `${syncStatus.recipients.length} recipient keys` : 'shared passphrase'}</small> : null}</section>
        <SyncRecipientEncryptionControl busy={Boolean(busy)} canGovern={Boolean(canGovern)} enabled={syncUsesRecipients} identity={syncIdentity} invite={syncRecipientInvite} onAdd={addSyncRecipient} onInvite={setSyncRecipientInvite} onRemove={removeSyncRecipient} onToggle={toggleRecipientEncryption} recipients={syncRecipients} status={syncStatus} />
        <section className="security-card"><header><div><small>Shareable scope</small><h2>What crosses the boundary</h2></div><Icon name="archive" size={22} /></header><ul><li>Collections, environments, designs, mocks, repository commits, branches, and governance metadata are encrypted before writing.</li><li>History, responses, cookies, reports, Git paths, plugins, plugin data, vault contents, recipient private keys, and the shared-file path stay local.</li><li>A mismatched base revision blocks push until you pull or deliberately select force.</li></ul><p>This file can live on a self-hosted file share, mounted WebDAV volume, or another user-controlled synchronization system. The pinned product has no comments or presence surface; collaboration is encrypted commits, branches, history, merge, and remote refresh.</p></section>
        <CollaborationRepositoryPanel actor={syncActorLabel} disabled={!canEdit || Boolean(busy)} onChangeWorkspace={onChangeWorkspace} workspace={workspace} />
      </div> : null}

      {tab === 'governance' ? <IdentityGovernancePanel onChangeWorkspace={onChangeWorkspace} workspace={workspace} workspaceId={workspaceId} /> : null}
      {busy ? <div className="automation-message">{busy}…</div> : null}{error ? <div className="automation-message error">{error}</div> : null}{message ? <div className="automation-message">{message}</div> : null}
    </section>
  );
}
