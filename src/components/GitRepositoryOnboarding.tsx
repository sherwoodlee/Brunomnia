import { useEffect, useMemo, useState } from 'react';
import type { GitCredential, GitProvider } from '../types';
import {
  discoverGitProviderRepositories,
  gitCredentialInput,
  probeGitRepository,
  validateGitProviderCredential,
  type GitProviderRepository,
  type GitProviderValidation,
  type GitRepositoryProbe,
} from '../lib/project';
import { Icon } from './Icon';

type GitRepositoryOnboardingProps = {
  credentials: GitCredential[];
  activeCredentialId: string;
  remoteUrl: string;
  path: string;
  authorEmail: string;
  disabled: boolean;
  onSelectCredential: (activeCredentialId: string) => void;
  onSaveCredentials: (credentials: GitCredential[]) => Promise<GitCredential[]>;
  onChangeRemoteUrl: (remoteUrl: string) => void;
  onChangePath: (path: string) => void;
  onChangeAuthorEmail: (authorEmail: string) => void;
  onClone: (branch: string, credentialId: string) => Promise<void>;
};

const systemCredentialId = '__system__';
const emptyDraft = (): GitCredential => ({ id: '', name: '', provider: 'github', username: '', token: '' });

export const gitProviderSupportsDiscovery = (provider: GitProvider | 'system') => provider === 'github' || provider === 'gitlab';

export const gitRepositoryScanSummary = (probe: GitRepositoryProbe) => [
  `${probe.totalFiles}${probe.truncated ? '+' : ''} repository files`,
  `${probe.brunomniaFiles} Brunomnia files`,
  `${probe.insomniaFiles} Insomnia files`,
  `${probe.specificationFiles} API specifications`,
];

const repositoryLabel = (repository: GitProviderRepository) => `${repository.fullName || repository.name}${repository.private ? ' · private' : ''}${repository.canPush ? ' · write' : ' · read-only'}`;

export function GitRepositoryOnboarding({ credentials, activeCredentialId, remoteUrl, path, authorEmail, disabled, onSelectCredential, onSaveCredentials, onChangeRemoteUrl, onChangePath, onChangeAuthorEmail, onClone }: GitRepositoryOnboardingProps) {
  const selectedCredentialId = credentials.some((credential) => credential.id === activeCredentialId) ? activeCredentialId : systemCredentialId;
  const selectedCredential = credentials.find((credential) => credential.id === selectedCredentialId);
  const provider = selectedCredential?.provider ?? 'system';
  const [draft, setDraft] = useState<GitCredential>(emptyDraft);
  const [editing, setEditing] = useState(false);
  const [validation, setValidation] = useState<GitProviderValidation | null>(null);
  const [repositories, setRepositories] = useState<GitProviderRepository[]>([]);
  const [repositoryId, setRepositoryId] = useState('');
  const [branches, setBranches] = useState<string[]>([]);
  const [branch, setBranch] = useState('');
  const [probe, setProbe] = useState<GitRepositoryProbe | null>(null);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const credential = gitCredentialInput(selectedCredential);
  const emails = validation?.emails ?? [];
  const selectedRepository = useMemo(() => repositories.find((repository) => repository.id === repositoryId), [repositories, repositoryId]);

  useEffect(() => {
    setValidation(null);
    setRepositories([]);
    setRepositoryId('');
    setBranches([]);
    setBranch('');
    setProbe(null);
    setMessage('');
    setError('');
  }, [selectedCredentialId]);

  const run = async (label: string, operation: () => Promise<void>) => {
    if (busy || disabled) return;
    setBusy(label);
    setError('');
    setMessage('');
    try {
      await operation();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy('');
    }
  };

  const chooseCredential = (id: string) => {
    onSelectCredential(id === systemCredentialId ? '' : id);
    setEditing(false);
  };

  const saveCredential = () => void run('Saving credential', async () => {
    const name = draft.name.replace(/[\r\n\0]/g, ' ').trim().slice(0, 200);
    const username = draft.username.replace(/[\r\n\0]/g, '').slice(0, 500);
    const token = draft.token.replace(/[\r\n\0]/g, '').slice(0, 65_536);
    if (!name) throw new Error('Enter a credential name.');
    if (!token) throw new Error('Enter the provider access token.');
    if (draft.provider === 'custom' && !username) throw new Error('Enter the custom Git username.');
    const id = draft.id || `git-credential-${crypto.randomUUID()}`;
    const next = { id, name, provider: draft.provider, username, token };
    const nextCredentials = draft.id
      ? credentials.map((credential) => credential.id === draft.id ? next : credential)
      : [...credentials, next].slice(-100);
    await onSaveCredentials(nextCredentials);
    onSelectCredential(id);
    setDraft(emptyDraft());
    setEditing(false);
    setError('');
    setMessage(`Saved ${name} in OS-protected device credential storage.`);
  });

  const removeCredential = () => void run('Removing credential', async () => {
    if (!selectedCredential) return;
    await onSaveCredentials(credentials.filter((credential) => credential.id !== selectedCredential.id));
    onSelectCredential('');
    setEditing(false);
    setMessage(`Removed ${selectedCredential.name}.`);
  });

  const validateAndDiscover = () => run(gitProviderSupportsDiscovery(provider) ? 'Validating and discovering' : 'Validating repository access', async () => {
    if (gitProviderSupportsDiscovery(provider)) {
      if (!credential) throw new Error('Choose a saved provider credential.');
      const nextValidation = await validateGitProviderCredential(credential);
      setValidation(nextValidation);
      if (nextValidation.emails.length && !authorEmail) onChangeAuthorEmail(nextValidation.emails[0]);
      const nextRepositories = await discoverGitProviderRepositories(credential);
      setRepositories(nextRepositories);
      const first = nextRepositories[0];
      if (first) {
        setRepositoryId(first.id);
        onChangeRemoteUrl(first.cloneUrl);
        setBranch(first.defaultBranch);
      }
      setMessage(`Validated ${nextValidation.accountLogin || nextValidation.accountName || provider} and discovered ${nextRepositories.length} pullable repositor${nextRepositories.length === 1 ? 'y' : 'ies'}.`);
      return;
    }
    if (!remoteUrl.trim()) throw new Error('Enter a repository URL before validating system or custom credentials.');
    const nextProbe = await probeGitRepository(remoteUrl, '', credential);
    setBranches(nextProbe.branches);
    setBranch(nextProbe.defaultBranch);
    setProbe(null);
    setValidation({ provider: selectedCredential?.provider ?? 'custom', accountLogin: provider === 'system' ? 'System Git credential helper / SSH agent' : selectedCredential?.name ?? 'Custom credential', accountName: '', emails: [], canDiscoverRepositories: false });
    setMessage(`Repository access validated · ${nextProbe.branches.length} branch${nextProbe.branches.length === 1 ? '' : 'es'} discovered.`);
  });

  const chooseRepository = (id: string) => {
    setRepositoryId(id);
    const repository = repositories.find((candidate) => candidate.id === id);
    if (!repository) return;
    onChangeRemoteUrl(repository.cloneUrl);
    setBranch(repository.defaultBranch);
    setBranches([]);
    setProbe(null);
  };

  const inspectRepository = () => run('Inspecting repository', async () => {
    if (!remoteUrl.trim()) throw new Error('Choose or enter a repository URL.');
    const nextProbe = await probeGitRepository(remoteUrl, '', credential);
    setBranches(nextProbe.branches);
    setBranch(nextProbe.branches.includes(branch) ? branch : nextProbe.defaultBranch);
    setProbe(null);
    setMessage(`Discovered ${nextProbe.branches.length} remote branch${nextProbe.branches.length === 1 ? '' : 'es'}.`);
  });

  const scanBranch = () => run('Scanning repository tree', async () => {
    if (!branch) throw new Error('Choose a remote branch.');
    const nextProbe = await probeGitRepository(remoteUrl, branch, credential);
    setBranches(nextProbe.branches);
    setProbe(nextProbe);
    setMessage(`Scanned ${branch} without checking files out locally.`);
  });

  const clone = () => run('Cloning and opening', async () => {
    if (!probe || !branch) throw new Error('Inspect and scan the selected branch before cloning.');
    if (!path.trim()) throw new Error('Choose a clone destination.');
    await onClone(branch, selectedCredential?.id ?? '');
  });

  return (
    <article className="git-onboarding-card">
      <Icon name="download" size={26} />
      <h2>Connect Git repository</h2>
      <p>Validate reusable credentials, discover provider repositories, inspect branches, scan project files, then clone the exact branch.</p>
      <div className="git-onboarding-steps">
        <section>
          <header><small>1</small><strong>Credential</strong></header>
          <label>Reusable credential<select value={selectedCredentialId} onChange={(event) => chooseCredential(event.target.value)}>
            <option value={systemCredentialId}>System Git credential helper / SSH</option>
            {credentials.map((credential) => <option key={credential.id} value={credential.id}>{credential.name} · {credential.provider}</option>)}
          </select></label>
          <div className="git-onboarding-actions">
            <button disabled={disabled || Boolean(busy)} onClick={() => { setDraft(emptyDraft()); setEditing(true); }} type="button">Add credential</button>
            <button disabled={!selectedCredential || disabled || Boolean(busy)} onClick={() => { if (selectedCredential) { setDraft({ ...selectedCredential }); setEditing(true); } }} type="button">Edit</button>
            <button disabled={!selectedCredential || disabled || Boolean(busy)} onClick={removeCredential} type="button">Remove</button>
          </div>
          {editing ? <div className="git-credential-editor">
            <label>Provider<select value={draft.provider} onChange={(event) => setDraft((current) => ({ ...current, provider: event.target.value as GitProvider }))}><option value="github">GitHub</option><option value="gitlab">GitLab</option><option value="custom">Custom HTTP(S)</option></select></label>
            <label>Name<input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Work GitHub" /></label>
            {draft.provider === 'custom' ? <label>Username<input value={draft.username} onChange={(event) => setDraft((current) => ({ ...current, username: event.target.value }))} autoComplete="username" /></label> : null}
            <label>{draft.provider === 'custom' ? 'Password / token' : 'Personal access token'}<input value={draft.token} onChange={(event) => setDraft((current) => ({ ...current, token: event.target.value }))} type="password" autoComplete="new-password" /></label>
            <div className="git-onboarding-actions"><button onClick={saveCredential} type="button">Save credential</button><button onClick={() => { setEditing(false); setDraft(emptyDraft()); }} type="button">Cancel</button></div>
          </div> : null}
          <button disabled={disabled || Boolean(busy) || (gitProviderSupportsDiscovery(provider) && !selectedCredential)} onClick={validateAndDiscover} type="button">{gitProviderSupportsDiscovery(provider) ? 'Validate and discover repositories' : 'Validate repository access'}</button>
          {validation ? <div className="git-validation"><strong>Validated</strong><span>{validation.accountLogin || validation.accountName}</span></div> : null}
        </section>

        <section>
          <header><small>2</small><strong>Repository</strong></header>
          {repositories.length ? <label>Discovered repositories<select value={repositoryId} onChange={(event) => chooseRepository(event.target.value)}>{repositories.map((repository) => <option key={repository.id} value={repository.id}>{repositoryLabel(repository)}</option>)}</select></label> : null}
          {selectedRepository && !selectedRepository.canPush ? <div className="git-onboarding-warning">This provider reports pull-only access. Clone works; push requires write permission.</div> : null}
          <label>Repository URL<input value={remoteUrl} onChange={(event) => { onChangeRemoteUrl(event.target.value); setRepositoryId(''); setBranches([]); setBranch(''); setProbe(null); }} placeholder="https://github.com/org/api-project.git" /></label>
          <button disabled={!remoteUrl.trim() || disabled || Boolean(busy)} onClick={inspectRepository} type="button">Inspect remote branches</button>
        </section>

        <section>
          <header><small>3</small><strong>Branch and scan</strong></header>
          <label>Remote branch<select value={branch} disabled={!branches.length} onChange={(event) => { setBranch(event.target.value); setProbe(null); }}>{branches.map((candidate) => <option key={candidate} value={candidate}>{candidate}</option>)}</select></label>
          <button disabled={!branch || disabled || Boolean(busy)} onClick={scanBranch} type="button">Scan selected branch</button>
          {probe ? <div className="git-scan-summary">{gitRepositoryScanSummary(probe).map((line) => <span key={line}>{line}</span>)}</div> : <p className="git-step-help">The scan reads the remote tree into a temporary no-checkout clone and reports Brunomnia, Insomnia, and API-spec files.</p>}
        </section>

        <section>
          <header><small>4</small><strong>Clone and open</strong></header>
          {emails.length ? <label>Commit author email<select value={authorEmail} onChange={(event) => onChangeAuthorEmail(event.target.value)}><option value="">Choose later</option>{emails.map((email) => <option key={email} value={email}>{email}</option>)}</select></label> : null}
          <label>Destination<input value={path} onChange={(event) => onChangePath(event.target.value)} placeholder="/Users/me/Projects/api-project" /></label>
          <button disabled={!path.trim() || !probe || disabled || Boolean(busy)} onClick={clone} type="button">Clone {branch || 'branch'} and open</button>
        </section>
      </div>
      {busy ? <div className="automation-message">{busy}…</div> : null}
      {error ? <div className="automation-message error">{error}</div> : null}
      {message ? <div className="automation-message">{message}</div> : null}
    </article>
  );
}
