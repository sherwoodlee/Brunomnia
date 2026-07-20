import { isTauri } from '@tauri-apps/api/core';
import { useEffect, useMemo, useState } from 'react';
import type { Environment, GitCredential, Workspace } from '../types';
import {
  abortGitMerge,
  checkoutGitBranch,
  checkoutGitRemoteBranch,
  cloneGitProject,
  commitGitChanges,
  deleteGitBranch,
  discardGitFiles,
  getGitConflicts,
  getGitCommitPatch,
  getGitDiff,
  getGitFileDiff,
  getGitHistory,
  getGitStatus,
  fetchGitRemote,
  gitCredentialInput,
  initGitProject,
  loadGitCredentials,
  mergeGitBranch,
  pullGitProject,
  pushGitProject,
  readProject,
  resolveGitConflict,
  resolveGitConflictSide,
  setGitRemote,
  saveGitCredentials,
  stageGitFiles,
  unstageGitFiles,
  validateGitRemoteAccess,
  writeProject,
  type GitConflict,
  type GitCommitSummary,
  type GitStatus,
} from '../lib/project';
import { Icon } from './Icon';
import { plaintextSecretCandidates } from '../lib/security';
import { suggestCommitGroups, type AiCommitGroup } from '../lib/ai';
import { validateGitCommitPlan } from '../lib/gitCommitPlan';
import type { SendRequestContext } from '../lib/http';
import { withoutOAuth2RuntimeCredentials } from '../lib/oauth2Tokens';
import { GitRepositoryOnboarding } from './GitRepositoryOnboarding';

type ProjectWorkbenchProps = {
  workspace: Workspace;
  environment: Environment | undefined;
  requestContext: SendRequestContext;
  onChangeWorkspace: (updater: (workspace: Workspace) => Workspace) => void;
};

const emptyStatus: GitStatus = { branch: '', upstream: '', ahead: 0, behind: 0, canPush: false, files: [], branches: [], remoteBranches: [], remotes: [], mergeInProgress: false, rebaseInProgress: false };

export function ProjectWorkbench({ workspace, environment, requestContext: baseRequestContext, onChangeWorkspace }: ProjectWorkbenchProps) {
  const requestContext = baseRequestContext;
  const [path, setPath] = useState(workspace.project.path);
  const [remoteUrl, setRemoteUrl] = useState(workspace.project.remoteUrl);
  const [status, setStatus] = useState<GitStatus>(emptyStatus);
  const [selected, setSelected] = useState<string[]>([]);
  const [diff, setDiff] = useState('');
  const [showStagedDiff, setShowStagedDiff] = useState(false);
  const [diffPath, setDiffPath] = useState('');
  const [reviewMode, setReviewMode] = useState<'changes' | 'history'>('changes');
  const [history, setHistory] = useState<GitCommitSummary[]>([]);
  const [activeCommitOid, setActiveCommitOid] = useState('');
  const [commitPatch, setCommitPatch] = useState('');
  const [commitMessage, setCommitMessage] = useState('');
  const [aiGroups, setAiGroups] = useState<AiCommitGroup[]>([]);
  const [branchName, setBranchName] = useState('');
  const [mergeBranch, setMergeBranch] = useState('');
  const [deleteBranch, setDeleteBranch] = useState('');
  const [remoteBranchTrackingRef, setRemoteBranchTrackingRef] = useState('');
  const [conflicts, setConflicts] = useState<GitConflict[]>([]);
  const [activeConflictPath, setActiveConflictPath] = useState('');
  const [resolution, setResolution] = useState('');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [gitCredentials, setGitCredentials] = useState<GitCredential[]>([]);
  const native = isTauri();
  const activeConflict = conflicts.find((conflict) => conflict.path === activeConflictPath) ?? conflicts[0];
  const activeCommit = history.find((commit) => commit.oid === activeCommitOid) ?? history[0];
  const configuredRemote = status.remotes.find((remote) => remote.name === workspace.project.remoteName);
  const activeGitCredential = gitCredentialInput(gitCredentials.find((credential) => credential.id === workspace.project.gitCredentialId));
  const currentRemote = configuredRemote ?? status.remotes[0];
  const remoteOnlyBranches = status.remoteBranches.filter((remoteBranch) => !status.branches.includes(remoteBranch.branch));
  const unstaged = status.files.filter((file) => !file.staged || file.worktreeStatus !== ' ');
  const staged = status.files.filter((file) => file.staged);
  const stageableFiles = unstaged.filter((file) => !file.conflicted).map((file) => file.path);
  const unstageableFiles = staged.filter((file) => !file.conflicted).map((file) => file.path);
  const diffCandidates = showStagedDiff ? staged : unstaged;
  const effectiveDiffPath = diffCandidates.some((file) => file.path === diffPath) ? diffPath : '';
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const stageableSelected = selected.filter((path) => stageableFiles.includes(path));
  const unstageableSelected = selected.filter((path) => unstageableFiles.includes(path));
  const discardableFiles = unstaged.filter((file) => !file.conflicted).map((file) => file.path);
  const discardableSelected = selected.filter((path) => discardableFiles.includes(path));
  const plaintextSecrets = workspace.governance.policy.requireVaultForSecrets ? plaintextSecretCandidates(withoutOAuth2RuntimeCredentials(workspace)) : [];
  const allowedStorage = workspace.governance.policy.allowedStorage;

  const requireShareableSafety = () => {
    if (plaintextSecrets.length) throw new Error(`Vault policy blocked ${plaintextSecrets.length} plaintext secret candidate${plaintextSecrets.length === 1 ? '' : 's'}. Replace them with vault or external-vault references first.`);
  };

  const updateProject = (patch: Partial<Workspace['project']>) => onChangeWorkspace((current) => ({ ...current, project: { ...current.project, ...patch } }));
  const setNextStatus = async (next: GitStatus) => {
    setStatus(next);
    setSelected([]);
    if (next.mergeInProgress || next.files.some((file) => file.conflicted)) {
      const nextConflicts = await getGitConflicts(path);
      setConflicts(nextConflicts);
      setActiveConflictPath(nextConflicts[0]?.path ?? '');
      setResolution(nextConflicts[0]?.working ?? '');
    } else {
      setConflicts([]); setActiveConflictPath(''); setResolution('');
    }
  };
  const run = async (label: string, operation: () => Promise<void>) => {
    if (busy) return;
    setBusy(label); setError(''); setMessage('');
    try { await operation(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
    finally { setBusy(''); }
  };

  const refresh = () => run('Refreshing', async () => {
    const next = await getGitStatus(path);
    await setNextStatus(next);
    setMessage(`Git status refreshed on ${next.branch || 'HEAD'}.`);
  });

  const openHistory = () => {
    setReviewMode('history');
    setCommitPatch('');
    void run('Loading history', async () => {
      const next = await getGitHistory(path);
      const nextOid = next.some((commit) => commit.oid === activeCommitOid) ? activeCommitOid : next[0]?.oid ?? '';
      setHistory(next);
      setActiveCommitOid(nextOid);
      setCommitPatch(nextOid ? (await getGitCommitPatch(path, nextOid)).patch : '');
      setMessage(next.length ? `Loaded ${next.length} recent commit${next.length === 1 ? '' : 's'}.` : 'This repository has no commits yet.');
    });
  };

  const selectCommit = (oid: string) => run('Loading commit', async () => {
    setActiveCommitOid(oid);
    setCommitPatch('');
    setCommitPatch((await getGitCommitPatch(path, oid)).patch);
  });

  const closeHistory = () => {
    setReviewMode('changes');
    setHistory([]);
    setActiveCommitOid('');
    setCommitPatch('');
  };

  const createCommit = (pushAfter: boolean) => {
    void run(pushAfter ? 'Committing and pushing' : 'Committing', async () => {
      requireShareableSafety();
      const pushRemote = configuredRemote?.name ?? workspace.project.remoteName;
      if (pushAfter) await validateGitRemoteAccess(path, pushRemote, activeGitCredential);
      const committed = await commitGitChanges(path, commitMessage, workspace.project.authorName, workspace.project.authorEmail);
      setCommitMessage('');
      setAiGroups([]);
      closeHistory();
      await setNextStatus(committed.status);
      if (!pushAfter) {
        setMessage(committed.stdout || 'Commit created.');
        return;
      }
      try {
        const pushed = await pushGitProject(path, pushRemote, committed.status.branch || status.branch, activeGitCredential);
        await setNextStatus(pushed.status);
        setMessage(pushed.stderr || pushed.stdout || 'Commit created and pushed.');
      } catch (caught) {
        throw new Error(`Commit created locally, but push failed: ${caught instanceof Error ? caught.message : String(caught)}`);
      }
    });
  };

  const createGroupedCommits = (pushAfter: boolean) => {
    void run(pushAfter ? 'Committing groups and pushing' : 'Committing groups', async () => {
      requireShareableSafety();
      if (status.mergeInProgress || status.rebaseInProgress || status.files.some((file) => file.conflicted)) throw new Error('Resolve or abort the current merge/rebase before creating grouped commits.');
      const groups = validateGitCommitPlan(aiGroups, status.files.filter((file) => !file.conflicted).map((file) => file.path));
      const pushRemote = configuredRemote?.name ?? workspace.project.remoteName;
      if (pushAfter) await validateGitRemoteAccess(path, pushRemote, activeGitCredential);
      let completed = 0;
      let nextStatus = status;
      try {
        if (unstageableFiles.length) nextStatus = await unstageGitFiles(path, unstageableFiles);
        for (const group of groups) {
          nextStatus = await stageGitFiles(path, group.files);
          const committed = await commitGitChanges(path, group.message, workspace.project.authorName, workspace.project.authorEmail);
          nextStatus = committed.status;
          completed += 1;
        }
      } catch (caught) {
        try { await setNextStatus(await getGitStatus(path)); } catch { /* Preserve the primary grouped-commit error. */ }
        closeHistory();
        throw new Error(`Grouped commit stopped after ${completed} of ${groups.length} commits: ${caught instanceof Error ? caught.message : String(caught)}`);
      }
      setCommitMessage('');
      setAiGroups([]);
      closeHistory();
      await setNextStatus(nextStatus);
      if (!pushAfter) {
        setMessage(`Created ${groups.length} grouped commit${groups.length === 1 ? '' : 's'}.`);
        return;
      }
      try {
        const pushed = await pushGitProject(path, pushRemote, nextStatus.branch || status.branch, activeGitCredential);
        await setNextStatus(pushed.status);
        setMessage(pushed.stderr || pushed.stdout || `Created and pushed ${groups.length} grouped commits.`);
      } catch (caught) {
        throw new Error(`${groups.length} grouped commits created locally, but push failed: ${caught instanceof Error ? caught.message : String(caught)}`);
      }
    });
  };

  const discardChanges = (paths: string[]) => {
    if (!paths.length) return;
    if (workspace.preferences.confirmDestructive && !window.confirm(`Discard unstaged changes in ${paths.length} file${paths.length === 1 ? '' : 's'}? This cannot be undone.`)) return;
    void run('Discarding changes', async () => {
      const next = await discardGitFiles(path, paths);
      await setNextStatus(next);
      await reloadGitWorkspace(next);
      setMessage(`Discarded unstaged changes in ${paths.length} file${paths.length === 1 ? '' : 's'}.`);
    });
  };

  useEffect(() => {
    if (!native) return;
    let cancelled = false;
    void loadGitCredentials().then((credentials) => { if (!cancelled) setGitCredentials(credentials); }).catch((caught) => { if (!cancelled) setError(caught instanceof Error ? caught.message : String(caught)); });
    return () => { cancelled = true; };
  }, [native]);

  useEffect(() => {
    if (!native || workspace.project.mode !== 'git' || !workspace.project.path) return;
    let cancelled = false;
    void getGitStatus(workspace.project.path).then(async (next) => {
      if (!cancelled) await setNextStatus(next);
    }).catch((caught) => { if (!cancelled) setError(caught instanceof Error ? caught.message : String(caught)); });
    return () => { cancelled = true; };
    // Opening the workbench should inspect the configured repository once; manual refresh owns later updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [native, workspace.project.mode, workspace.project.path]);

  useEffect(() => {
    setReviewMode('changes');
    setHistory([]);
    setActiveCommitOid('');
    setCommitPatch('');
  }, [workspace.project.path]);

  useEffect(() => {
    if (!native || workspace.project.mode !== 'git' || !path) { setDiff(''); return; }
    let cancelled = false;
    const operation = effectiveDiffPath ? getGitFileDiff(path, showStagedDiff, effectiveDiffPath) : getGitDiff(path, showStagedDiff);
    void operation.then((value) => { if (!cancelled) setDiff(value); }).catch(() => { if (!cancelled) setDiff(''); });
    return () => { cancelled = true; };
  }, [effectiveDiffPath, native, path, showStagedDiff, status]);

  const connectFolder = (mode: 'folder' | 'git') => run(mode === 'git' ? 'Initializing Git' : 'Creating project', async () => {
    if (!allowedStorage.includes(mode)) throw new Error(`Workspace policy does not allow ${mode} storage.`);
    requireShareableSafety();
    const result = await writeProject(path, workspace);
    let nextStatus = emptyStatus;
    if (mode === 'git') nextStatus = await initGitProject(path, 'main');
    updateProject({ mode, path: result.path, remoteUrl, lastSavedAt: new Date().toISOString() });
    setPath(result.path);
    await setNextStatus(nextStatus);
    setMessage(`${mode === 'git' ? 'Git' : 'Filesystem'} project ready · ${result.filesWritten} files written.`);
  });

  const openFolder = () => run('Opening project', async () => {
    if (!allowedStorage.includes('folder')) throw new Error('Workspace policy does not allow folder storage.');
    const loaded = await readProject(path, workspace);
    onChangeWorkspace(() => ({ ...loaded, project: { ...loaded.project, mode: 'folder', path } }));
    setMessage(`Opened ${loaded.name} from YAML resources.`);
  });

  const reloadGitWorkspace = async (next: GitStatus) => {
    if (next.files.some((file) => file.conflicted)) return;
    const loaded = await readProject(path, workspace);
    onChangeWorkspace(() => ({ ...loaded, project: { ...workspace.project, mode: 'git', path } }));
  };

  const clone = (branch: string, credentialId: string) => run('Cloning', async () => {
    if (!allowedStorage.includes('git')) throw new Error('Workspace policy does not allow Git storage.');
    const cloneCredential = gitCredentialInput(gitCredentials.find((credential) => credential.id === credentialId));
    const nextStatus = await cloneGitProject(remoteUrl, path, branch, cloneCredential);
    let loaded: Workspace;
    try { loaded = await readProject(path, workspace); }
    catch {
      requireShareableSafety();
      const next = { ...workspace, project: { ...workspace.project, mode: 'git' as const, path, remoteUrl, gitCredentialId: credentialId } };
      await writeProject(path, next);
      loaded = next;
    }
    onChangeWorkspace(() => ({ ...loaded, project: { ...loaded.project, mode: 'git', path, remoteUrl, gitCredentialId: credentialId } }));
    await setNextStatus(nextStatus);
    setMessage(`Cloned ${remoteUrl}.`);
  });

  const suggestCommits = () => run('Asking AI for commit groups', async () => {
    requireShareableSafety();
    const [working, stagedDiff] = await Promise.all([getGitDiff(path, false), getGitDiff(path, true)]);
    const groups = await suggestCommitGroups(workspace.ai, `UNSTAGED\n${working}\n\nSTAGED\n${stagedDiff}`, status.files.map((file) => file.path), environment, requestContext);
    if (!groups.length) throw new Error('The AI provider returned no usable commit groups for the current file set.');
    setAiGroups(groups);
    setMessage(`AI suggested ${groups.length} atomic commit group${groups.length === 1 ? '' : 's'}. Review every file and message before staging.`);
  });

  const toggleSelected = (file: string) => setSelected((current) => current.includes(file) ? current.filter((path) => path !== file) : [...current, file]);

  if (!native) return (
    <section className="project-workbench unavailable-workbench">
      <Icon name="folder" size={34} /><h1>Filesystem projects require the desktop app</h1>
      <p>The production browser build cannot read folders or invoke Git. Open this same workspace in Brunomnia’s Tauri app to create, clone, merge, and push standard repositories.</p>
    </section>
  );

  if (workspace.project.mode !== 'git') return (
    <section className="project-workbench project-onboarding">
      <header><div><small>Project</small><h1>Filesystem and Git Sync</h1><p>Keep each collection in reviewable YAML files inside an ordinary local folder or `.git` repository.</p></div></header>
      <div className="project-connect-grid">
        <article><Icon name="folder" size={26} /><h2>Open YAML project</h2><p>Load an existing Brunomnia project without enabling Git.</p><label>Folder path<input value={path} onChange={(event) => setPath(event.target.value)} placeholder="/Users/me/Projects/orders-api" /></label><button disabled={!path || !allowedStorage.includes('folder') || Boolean(busy)} onClick={openFolder} type="button">Open project</button></article>
        <article><Icon name="archive" size={26} /><h2>Create local project</h2><p>Write this workspace into stable, split YAML resources.</p><label>Folder path<input value={path} onChange={(event) => setPath(event.target.value)} placeholder="/Users/me/Projects/orders-api" /></label><button disabled={!path || !allowedStorage.includes('folder') || Boolean(busy)} onClick={() => connectFolder('folder')} type="button">Create project</button></article>
        <article><Icon name="code" size={26} /><h2>Initialize Git Sync</h2><p>Create standard project YAML plus a normal `.git` directory.</p><label>Folder path<input value={path} onChange={(event) => setPath(event.target.value)} placeholder="/Users/me/Projects/orders-api" /></label><button disabled={!path || !allowedStorage.includes('git') || Boolean(busy)} onClick={() => connectFolder('git')} type="button">Initialize Git</button></article>
        <GitRepositoryOnboarding credentials={gitCredentials} activeCredentialId={workspace.project.gitCredentialId} remoteUrl={remoteUrl} path={path} authorEmail={workspace.project.authorEmail} disabled={!allowedStorage.includes('git') || Boolean(busy)} onSelectCredential={(gitCredentialId) => updateProject({ gitCredentialId })} onSaveCredentials={async (credentials) => { const saved = await saveGitCredentials(credentials); setGitCredentials(saved); return saved; }} onChangeRemoteUrl={setRemoteUrl} onChangePath={setPath} onChangeAuthorEmail={(authorEmail) => updateProject({ authorEmail })} onClone={clone} />
      </div>
      {busy ? <div className="automation-message">{busy}…</div> : null}{error ? <div className="automation-message error">{error}</div> : null}{message ? <div className="automation-message">{message}</div> : null}
    </section>
  );

  return (
    <section className="project-workbench git-workbench">
      <header className="project-header"><div><small>Git Sync</small><h1>{workspace.name}</h1><p>{path}{plaintextSecrets.length ? ` · ${plaintextSecrets.length} plaintext secret candidate${plaintextSecrets.length === 1 ? '' : 's'} blocked by policy` : ''}</p></div><div className="git-branch-summary"><strong>{status.branch || 'HEAD'}</strong><span>{status.upstream || 'No upstream'}</span>{status.ahead || status.behind ? <small>↑ {status.ahead} · ↓ {status.behind}</small> : status.canPush ? <small>Unpublished branch</small> : null}</div><div className="project-header-actions"><button disabled={Boolean(busy)} onClick={refresh} type="button">Refresh</button><button disabled={Boolean(busy)} onClick={openHistory} type="button">History</button><button disabled={Boolean(busy)} onClick={() => run('Saving YAML', async () => { requireShareableSafety(); const result = await writeProject(path, workspace); updateProject({ lastSavedAt: new Date().toISOString() }); await setNextStatus(await getGitStatus(path)); setMessage(`${result.filesWritten} files updated · ${result.filesUnchanged} unchanged.`); })} type="button">Save YAML</button><button disabled={Boolean(busy)} onClick={() => run('Pulling', async () => { const result = await pullGitProject(path, workspace.project.remoteName, status.branch, activeGitCredential); closeHistory(); await setNextStatus(result.status); await reloadGitWorkspace(result.status); setMessage(result.stderr || result.stdout || 'Pull complete.'); })} type="button">Pull</button><button disabled={!configuredRemote || !status.branch || !status.canPush || Boolean(busy)} onClick={() => run('Pushing', async () => { requireShareableSafety(); const result = await pushGitProject(path, configuredRemote!.name, status.branch, activeGitCredential); await setNextStatus(result.status); setMessage(result.stderr || result.stdout || 'Push complete.'); })} type="button">Push</button></div></header>

      <div className="git-layout">
        <aside className="git-sidebar">
          <section><header><strong>Changes</strong><span>{status.files.length}</span></header><div className="git-file-list">{status.files.map((file) => <label className={file.conflicted ? 'conflicted' : ''} key={file.path}><input checked={selectedSet.has(file.path)} onChange={() => toggleSelected(file.path)} type="checkbox" /><code>{file.indexStatus}{file.worktreeStatus}</code><span>{file.path}</span></label>)}{!status.files.length ? <p>Working tree clean.</p> : null}</div><div className="git-row-actions"><button disabled={!stageableSelected.length || Boolean(busy)} onClick={() => run('Staging selected changes', async () => { requireShareableSafety(); await setNextStatus(await stageGitFiles(path, stageableSelected)); })} type="button">Stage selected</button><button disabled={!unstageableSelected.length || Boolean(busy)} onClick={() => run('Unstaging selected changes', async () => setNextStatus(await unstageGitFiles(path, unstageableSelected)))} type="button">Unstage selected</button><button disabled={!stageableFiles.length || Boolean(busy)} onClick={() => run('Staging all changes', async () => { requireShareableSafety(); await setNextStatus(await stageGitFiles(path, stageableFiles)); })} type="button">Stage all</button><button disabled={!unstageableFiles.length || Boolean(busy)} onClick={() => run('Unstaging all changes', async () => setNextStatus(await unstageGitFiles(path, unstageableFiles)))} type="button">Unstage all</button><button className="git-discard-button" disabled={!discardableSelected.length || Boolean(busy)} onClick={() => discardChanges(discardableSelected)} type="button">Discard selected unstaged</button><button className="git-discard-button" disabled={!discardableFiles.length || Boolean(busy)} onClick={() => discardChanges(discardableFiles)} type="button">Discard all unstaged</button></div></section>
          <section><header><strong>Commit</strong><span>{staged.length} staged</span></header><textarea value={commitMessage} onChange={(event) => setCommitMessage(event.target.value)} placeholder="Describe this change" /><button disabled={!workspace.ai.enabled || !workspace.ai.commitSuggestions || !status.files.length || Boolean(busy)} onClick={suggestCommits} type="button">Suggest comments and grouping with AI</button>{aiGroups.length ? <><div className="ai-commit-groups">{aiGroups.map((group, index) => <button key={`${group.message}-${index}`} onClick={() => { setSelected(group.files); setCommitMessage(group.message); setMessage(`Selected AI group ${index + 1}. Review the diff, stage the listed files, then commit.`); }} type="button"><strong>{group.message}</strong><span>{group.files.join(' · ')}</span><small>{group.comment}</small></button>)}</div><div className="git-row-actions"><button disabled={Boolean(busy)} onClick={() => createGroupedCommits(false)} type="button">Commit AI groups</button><button disabled={!configuredRemote || !status.branch || Boolean(busy)} onClick={() => createGroupedCommits(true)} type="button">Commit groups + push</button></div></> : null}<div className="git-author-grid"><input value={workspace.project.authorName} onChange={(event) => updateProject({ authorName: event.target.value })} placeholder="Author name (optional)" /><input value={workspace.project.authorEmail} onChange={(event) => updateProject({ authorEmail: event.target.value })} placeholder="Author email (optional)" /></div><div className="git-row-actions"><button disabled={!commitMessage.trim() || !staged.length || Boolean(busy)} onClick={() => createCommit(false)} type="button">Commit staged changes</button><button disabled={!commitMessage.trim() || !staged.length || !configuredRemote || !status.branch || Boolean(busy)} onClick={() => createCommit(true)} type="button">Commit and push</button></div></section>
          <section><header><strong>Branches</strong><span>{status.branches.length} local · {remoteOnlyBranches.length} remote</span></header><select value={status.branch} onChange={(event) => { const branch = event.target.value; void run('Switching branch', async () => { const result = await checkoutGitBranch(path, branch); closeHistory(); await reloadGitWorkspace(result.status); await setNextStatus(result.status); }); }}>{status.branches.map((branch) => <option key={branch}>{branch}</option>)}</select><div className="git-inline"><input value={branchName} onChange={(event) => setBranchName(event.target.value)} placeholder="new-branch" /><button disabled={!branchName || Boolean(busy)} onClick={() => run('Creating branch', async () => { const result = await checkoutGitBranch(path, branchName, true); setBranchName(''); closeHistory(); await setNextStatus(result.status); })} type="button">Create</button></div><div className="git-inline"><select value={mergeBranch} onChange={(event) => setMergeBranch(event.target.value)}><option value="">Merge branch…</option>{status.branches.filter((branch) => branch !== status.branch).map((branch) => <option key={branch}>{branch}</option>)}</select><button disabled={!mergeBranch || Boolean(busy)} onClick={() => run('Merging', async () => { const result = await mergeGitBranch(path, mergeBranch); await setNextStatus(result.status); await reloadGitWorkspace(result.status); setMessage(result.stderr || result.stdout || 'Merge ready to commit.'); })} type="button">Merge</button></div><div className="git-inline"><select value={deleteBranch} onChange={(event) => setDeleteBranch(event.target.value)}><option value="">Delete local branch…</option>{status.branches.filter((branch) => branch !== status.branch).map((branch) => <option key={branch}>{branch}</option>)}</select><button disabled={!deleteBranch || Boolean(busy)} onClick={() => { if (workspace.preferences.confirmDestructive && !window.confirm(`Delete local branch “${deleteBranch}”? Git will refuse if it is not fully merged.`)) return; void run('Deleting branch', async () => { const result = await deleteGitBranch(path, deleteBranch); setDeleteBranch(''); await setNextStatus(result.status); setMessage(result.stderr || result.stdout || `Deleted ${deleteBranch}.`); }); }} type="button">Delete</button></div><div className="git-inline"><select value={remoteBranchTrackingRef} onChange={(event) => setRemoteBranchTrackingRef(event.target.value)}><option value="">Remote branch…</option>{remoteOnlyBranches.map((remoteBranch) => <option key={remoteBranch.trackingRef} value={remoteBranch.trackingRef}>{remoteBranch.trackingRef}</option>)}</select><button disabled={!remoteBranchTrackingRef || Boolean(busy)} onClick={() => run('Fetching and checking out', async () => { const remoteBranch = remoteOnlyBranches.find((candidate) => candidate.trackingRef === remoteBranchTrackingRef); if (!remoteBranch) throw new Error('Refresh and choose an available remote branch.'); const result = await checkoutGitRemoteBranch(path, remoteBranch.remote, remoteBranch.branch, activeGitCredential); setRemoteBranchTrackingRef(''); closeHistory(); await reloadGitWorkspace(result.status); await setNextStatus(result.status); setMessage(result.stderr || result.stdout || `Tracking ${remoteBranch.trackingRef}.`); })} type="button">Fetch + checkout</button></div></section>
          <section><header><strong>Remote</strong><span>{currentRemote?.name ?? 'none'}</span></header><select value={gitCredentials.some((credential) => credential.id === workspace.project.gitCredentialId) ? workspace.project.gitCredentialId : ''} onChange={(event) => updateProject({ gitCredentialId: event.target.value })}><option value="">System Git credential helper / SSH</option>{gitCredentials.map((credential) => <option key={credential.id} value={credential.id}>{credential.name} · {credential.provider}</option>)}</select><input value={remoteUrl} onChange={(event) => setRemoteUrl(event.target.value)} placeholder={currentRemote?.fetchUrl || 'https://…'} /><button disabled={!remoteUrl || Boolean(busy)} onClick={() => run('Setting remote', async () => { const next = await setGitRemote(path, workspace.project.remoteName, remoteUrl); updateProject({ remoteUrl }); await setNextStatus(next); })} type="button">Set {workspace.project.remoteName}</button><button disabled={!currentRemote || Boolean(busy)} onClick={() => run('Fetching remote branches', async () => { const result = await fetchGitRemote(path, currentRemote!.name, activeGitCredential); await setNextStatus(result.status); setMessage(result.stderr || result.stdout || `Fetched ${currentRemote!.name}.`); })} type="button">Fetch and prune branches</button></section>
        </aside>

        <div className="git-main">
          {conflicts.length ? <div className="conflict-workbench"><header><div><small>Merge conflict</small><h2>{activeConflict?.path}</h2></div><select value={activeConflict?.path ?? ''} onChange={(event) => { const conflict = conflicts.find((candidate) => candidate.path === event.target.value); setActiveConflictPath(event.target.value); setResolution(conflict?.working ?? ''); }}>{conflicts.map((conflict) => <option key={conflict.path}>{conflict.path}</option>)}</select><button onClick={() => run('Aborting merge', async () => setNextStatus(await abortGitMerge(path)))} type="button">Abort merge</button></header>{activeConflict?.binary ? <div className="empty-state"><strong>Binary conflict</strong><span>Choose and stage one complete binary version.</span><div className="git-row-actions"><button disabled={!activeConflict || Boolean(busy)} onClick={() => run('Choosing ours', async () => { const next = await resolveGitConflictSide(path, activeConflict!.path, 'ours'); await setNextStatus(next); await reloadGitWorkspace(next); })} type="button">Use ours</button><button disabled={!activeConflict || Boolean(busy)} onClick={() => run('Choosing theirs', async () => { const next = await resolveGitConflictSide(path, activeConflict!.path, 'theirs'); await setNextStatus(next); await reloadGitWorkspace(next); })} type="button">Use theirs</button></div></div> : <><div className="conflict-columns"><ConflictPane title="Base" value={activeConflict?.base ?? ''} /><ConflictPane title="Ours" value={activeConflict?.ours ?? ''} /><ConflictPane title="Theirs" value={activeConflict?.theirs ?? ''} /></div><div className="resolution-editor"><header><strong>Resolution</strong><div><button onClick={() => setResolution(activeConflict?.ours ?? '')} type="button">Use ours</button><button onClick={() => setResolution(activeConflict?.theirs ?? '')} type="button">Use theirs</button><button onClick={() => setResolution(`${activeConflict?.ours ?? ''}\n${activeConflict?.theirs ?? ''}`)} type="button">Keep both</button></div></header><textarea value={resolution} onChange={(event) => setResolution(event.target.value)} /></div><button className="resolve-button" disabled={!activeConflict || Boolean(busy)} onClick={() => run('Resolving conflict', async () => { const next = await resolveGitConflict(path, activeConflict!.path, resolution); await setNextStatus(next); await reloadGitWorkspace(next); })} type="button">Mark resolved and stage</button></>}</div>
            : reviewMode === 'history' ? <div className="git-history-workbench"><header><div><small>Repository</small><h2>Commit history</h2></div><div className="git-history-actions"><button disabled={Boolean(busy)} onClick={openHistory} type="button">Refresh history</button><button onClick={() => setReviewMode('changes')} type="button">Review changes</button></div></header><div className="git-history-layout"><nav aria-label="Recent commits" className="git-history-list">{history.map((commit) => <button aria-current={activeCommit?.oid === commit.oid ? 'true' : undefined} className={activeCommit?.oid === commit.oid ? 'active' : ''} key={commit.oid} onClick={() => void selectCommit(commit.oid)} type="button"><span className="git-history-node" /><span><strong>{commit.message || '(no subject)'}</strong><small>{commit.shortOid} · {formatCommitTime(commit.authoredAt)}</small><em title={commit.authorEmail}>{commit.authorName || commit.authorEmail || 'Unknown author'}</em>{commit.refs.length ? <span className="git-ref-list">{commit.refs.map((reference) => <code key={reference}>{reference}</code>)}</span> : null}</span></button>)}{!history.length ? <p>No history available. The first commit will appear here.</p> : null}</nav><section className="git-commit-detail">{activeCommit ? <><header><div><small>{activeCommit.shortOid}</small><h3>{activeCommit.message || '(no subject)'}</h3></div><dl><div><dt>Author</dt><dd>{activeCommit.authorName} &lt;{activeCommit.authorEmail}&gt;</dd></div><div><dt>Authored</dt><dd>{formatCommitTime(activeCommit.authoredAt)}</dd></div><div><dt>Parents</dt><dd>{activeCommit.parents.map((parent) => parent.slice(0, 8)).join(' · ') || 'Root commit'}</dd></div></dl></header><pre>{commitPatch || 'Loading commit patch…'}</pre></> : <div className="empty-state"><strong>No commit selected</strong><span>Create a commit or refresh this repository’s history.</span></div>}</section></div></div>
            : <div className="diff-workbench"><header><div><small>Review</small><h2>{showStagedDiff ? 'Staged diff' : 'Working tree diff'}</h2></div><div className="git-diff-controls"><select aria-label="Diff file" value={effectiveDiffPath} onChange={(event) => setDiffPath(event.target.value)}><option value="">All {showStagedDiff ? 'staged' : 'unstaged'} changes</option>{diffCandidates.map((file) => <option key={file.path} value={file.path}>{file.path}</option>)}</select><div className="segmented-control"><button className={!showStagedDiff ? 'active' : ''} onClick={() => { setDiffPath(''); setShowStagedDiff(false); }} type="button">Unstaged {unstaged.length}</button><button className={showStagedDiff ? 'active' : ''} onClick={() => { setDiffPath(''); setShowStagedDiff(true); }} type="button">Staged {staged.length}</button></div></div></header><pre>{diff || (showStagedDiff ? 'No staged diff.' : 'No unstaged diff.')}</pre></div>}
        </div>
      </div>
      {busy ? <div className="automation-message">{busy}…</div> : null}{error ? <div className="automation-message error">{error}</div> : null}{message ? <div className="automation-message">{message}</div> : null}
    </section>
  );
}

function ConflictPane({ title, value }: { title: string; value: string }) {
  return <article><header>{title}</header><pre>{value || 'File absent in this revision.'}</pre></article>;
}

function formatCommitTime(value: string) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toLocaleString() : value;
}
