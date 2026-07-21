import { useEffect, useMemo, useState } from 'react';
import {
  activeCollaborationBranch,
  checkoutCollaborationBranch,
  collaborationBranches,
  collaborationCommits,
  collaborationResources,
  commitCollaborationResources,
  createCollaborationBranch,
  deleteCollaborationBranch,
  dirtyCollaborationResources,
  planCollaborationBranchMerge,
  resolveCollaborationBranchMerge,
  restoreCollaborationCommit,
  type CollaborationMergePlan,
} from '../lib/collaboration';
import { appendAudit } from '../lib/security';
import type { JsonValue, Workspace } from '../types';
import { Icon } from './Icon';

type Props = {
  workspace: Workspace;
  disabled: boolean;
  actor: string;
  onChangeWorkspace: (updater: (workspace: Workspace) => Workspace) => void;
};

type ConflictDraft = { mode: 'mine' | 'theirs' | 'manual'; manual: string };
const preview = (value: JsonValue | undefined) => value === undefined ? '(deleted)' : JSON.stringify(value, null, 2);

export function CollaborationRepositoryPanel({ workspace, disabled, actor, onChangeWorkspace }: Props) {
  const resources = useMemo(() => collaborationResources(workspace), [workspace]);
  const dirty = useMemo(() => new Set(dirtyCollaborationResources(workspace, workspace.collaboration.repository)), [workspace]);
  const [resourceKey, setResourceKey] = useState(resources[0]?.key ?? '');
  const [commitMessage, setCommitMessage] = useState('');
  const [branchName, setBranchName] = useState('');
  const [mergeBranch, setMergeBranch] = useState('');
  const [mergePlan, setMergePlan] = useState<CollaborationMergePlan | null>(null);
  const [conflicts, setConflicts] = useState<Record<string, ConflictDraft>>({});
  const [error, setError] = useState('');
  const selected = resources.find((resource) => resource.key === resourceKey) ?? resources[0];
  const selectedKey = selected?.key ?? '';
  const activeBranch = selectedKey ? activeCollaborationBranch(workspace.collaboration.repository, selectedKey) : '';
  const branches = selectedKey ? collaborationBranches(workspace.collaboration.repository, selectedKey) : [];
  const commits = selectedKey ? collaborationCommits(workspace.collaboration.repository, selectedKey) : [];
  const staged = new Set(workspace.collaboration.stagedResourceKeys);

  useEffect(() => {
    if (selectedKey !== resourceKey) setResourceKey(selectedKey);
  }, [resourceKey, selectedKey]);

  const update = (operation: (current: Workspace) => Workspace) => {
    setError('');
    try { onChangeWorkspace(operation); }
    catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
  };

  const toggleStage = () => {
    if (!selectedKey) return;
    update((current) => {
      const currentStaged = current.collaboration.stagedResourceKeys;
      const stagedResourceKeys = currentStaged.includes(selectedKey) ? currentStaged.filter((key) => key !== selectedKey) : [...currentStaged, selectedKey].slice(0, 100);
      return { ...current, collaboration: { ...current.collaboration, stagedResourceKeys } };
    });
  };

  const commit = () => update((current) => {
    const keys = current.collaboration.stagedResourceKeys.filter((key) => dirtyCollaborationResources(current, current.collaboration.repository).includes(key));
    if (!keys.length) throw new Error('Stage at least one changed resource before committing.');
    const result = commitCollaborationResources(current, current.collaboration.repository, keys, actor, commitMessage);
    if (!result.committed.length) throw new Error('The staged resources already match their branch heads.');
    setCommitMessage('');
    return appendAudit({ ...current, collaboration: { ...current.collaboration, repository: result.repository, stagedResourceKeys: [] } }, 'sync.commit', `Committed ${result.committed.length} resource${result.committed.length === 1 ? '' : 's'}: ${commitMessage.trim()}.`);
  });

  const createBranch = () => {
    if (!selectedKey) return;
    update((current) => {
      if (dirtyCollaborationResources(current, current.collaboration.repository).includes(selectedKey)) throw new Error('Commit or discard this resource before creating a branch.');
      const repository = createCollaborationBranch(current.collaboration.repository, selectedKey, branchName);
      setBranchName('');
      return appendAudit({ ...current, collaboration: { ...current.collaboration, repository } }, 'sync.branch.create', `Created ${branchName.trim()} for ${selected?.name ?? selectedKey}.`);
    });
  };

  const checkout = (name: string) => {
    if (!selectedKey) return;
    update((current) => {
      if (dirtyCollaborationResources(current, current.collaboration.repository).includes(selectedKey)) throw new Error('Commit or discard this resource before switching branches.');
      const checkedOut = checkoutCollaborationBranch(current, current.collaboration.repository, selectedKey, name);
      setMergePlan(null);
      return appendAudit({ ...checkedOut.workspace, collaboration: { ...checkedOut.workspace.collaboration, repository: checkedOut.repository } }, 'sync.branch.checkout', `Checked out ${name} for ${selected?.name ?? selectedKey}.`);
    });
  };

  const removeBranch = (name: string) => {
    if (!selectedKey || !window.confirm(`Delete collaboration branch '${name}'?`)) return;
    update((current) => appendAudit({ ...current, collaboration: { ...current.collaboration, repository: deleteCollaborationBranch(current.collaboration.repository, selectedKey, name) } }, 'sync.branch.delete', `Deleted ${name} for ${selected?.name ?? selectedKey}.`));
  };

  const merge = () => {
    if (!selectedKey || !mergeBranch) return;
    setError('');
    try {
      const plan = planCollaborationBranchMerge(workspace.collaboration.repository, selectedKey, mergeBranch);
      if (!plan.conflicts.length) {
        update((current) => {
          const result = resolveCollaborationBranchMerge(current, current.collaboration.repository, plan, {}, actor, `Merge ${mergeBranch} into ${activeBranch}`);
          return appendAudit({ ...result.workspace, collaboration: { ...result.workspace.collaboration, repository: result.repository } }, 'sync.branch.merge', `Merged ${mergeBranch} into ${activeBranch} for ${selected?.name ?? selectedKey}.`);
        });
        setMergeBranch('');
        return;
      }
      setMergePlan(plan);
      setConflicts(Object.fromEntries(plan.conflicts.map((conflict) => [conflict.path, { mode: 'mine', manual: preview(conflict.mine) }])));
    } catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
  };

  const resolveMerge = () => {
    if (!mergePlan) return;
    update((current) => {
      const resolutions = Object.fromEntries(mergePlan.conflicts.map((conflict) => {
        const draft = conflicts[conflict.path];
        if (!draft) throw new Error(`Resolve collaboration conflict '${conflict.path}'.`);
        if (draft.mode !== 'manual') return [conflict.path, draft.mode];
        try { return [conflict.path, JSON.parse(draft.manual) as JsonValue]; }
        catch { throw new Error(`Manual resolution for '${conflict.path}' must be valid JSON.`); }
      }));
      const result = resolveCollaborationBranchMerge(current, current.collaboration.repository, mergePlan, resolutions, actor, `Merge ${mergePlan.sourceBranch} into ${mergePlan.targetBranch}`);
      setMergePlan(null); setMergeBranch(''); setConflicts({});
      return appendAudit({ ...result.workspace, collaboration: { ...result.workspace.collaboration, repository: result.repository } }, 'sync.branch.merge', `Resolved and merged ${mergePlan.sourceBranch} into ${mergePlan.targetBranch} for ${selected?.name ?? selectedKey}.`);
    });
  };

  const restore = (commitId: string) => {
    if (!window.confirm('Restore this resource version as a new commit on the active branch?')) return;
    update((current) => {
      const result = restoreCollaborationCommit(current, current.collaboration.repository, commitId, actor);
      return appendAudit({ ...result.workspace, collaboration: { ...result.workspace.collaboration, repository: result.repository } }, 'sync.history.restore', `Restored collaboration commit ${commitId}.`);
    });
  };

  return <section className="security-card collaboration-repository-card">
    <header><div><small>Object-scoped version control</small><h2>Branches and history</h2></div><span>{workspace.collaboration.repository.commits.length} commits</span></header>
    {!resources.length ? <p>Add a collection, environment, API design, mock server, or MCP client to version it.</p> : <>
      <div className="collaboration-resource-toolbar">
        <label>Resource<select value={selectedKey} onChange={(event) => { setResourceKey(event.target.value); setMergePlan(null); setError(''); }}>{resources.map((resource) => <option key={resource.key} value={resource.key}>{resource.kind} · {resource.name}</option>)}</select></label>
        <span className={dirty.has(selectedKey) ? 'bad' : 'good'}>{dirty.has(selectedKey) ? 'Changed' : 'Matches branch head'}</span>
        <label className="inline-toggle"><input checked={staged.has(selectedKey)} disabled={disabled || !dirty.has(selectedKey)} onChange={toggleStage} type="checkbox" /> Staged</label>
      </div>
      <div className="collaboration-commit-row"><input disabled={disabled} value={commitMessage} onChange={(event) => setCommitMessage(event.target.value)} placeholder="Commit message for staged resources" /><button disabled={disabled || !workspace.collaboration.stagedResourceKeys.length || !commitMessage.trim()} onClick={commit} type="button">Commit staged</button></div>
      <div className="collaboration-branch-grid">
        <div><strong>Active branch</strong><select disabled={disabled} value={activeBranch} onChange={(event) => checkout(event.target.value)}>{branches.length ? branches.map((branch) => <option key={branch.name}>{branch.name}</option>) : <option>main</option>}</select></div>
        <div><strong>Create branch</strong><span><input disabled={disabled} value={branchName} onChange={(event) => setBranchName(event.target.value)} placeholder="feature/orders" /><button disabled={disabled || !branchName.trim()} onClick={createBranch} type="button"><Icon name="plus" size={12} /> Create</button></span></div>
        <div><strong>Merge branch</strong><span><select disabled={disabled} value={mergeBranch} onChange={(event) => setMergeBranch(event.target.value)}><option value="">Choose branch…</option>{branches.filter((branch) => branch.name !== activeBranch && branch.headCommitId).map((branch) => <option key={branch.name}>{branch.name}</option>)}</select><button disabled={disabled || !mergeBranch} onClick={merge} type="button">Merge</button></span></div>
      </div>
      {branches.some((branch) => branch.name !== 'main' && branch.name !== activeBranch) ? <div className="collaboration-branch-list">{branches.filter((branch) => branch.name !== 'main' && branch.name !== activeBranch).map((branch) => <span key={branch.name}><code>{branch.name}</code><button disabled={disabled} onClick={() => removeBranch(branch.name)} type="button"><Icon name="trash" size={11} /></button></span>)}</div> : null}
      {mergePlan ? <div className="collaboration-conflicts"><header><div><small>Three-way merge</small><strong>{mergePlan.conflicts.length} conflict{mergePlan.conflicts.length === 1 ? '' : 's'} need review</strong></div><button onClick={() => setMergePlan(null)} type="button"><Icon name="x" size={13} /></button></header>{mergePlan.conflicts.map((conflict) => {
        const draft = conflicts[conflict.path];
        return <article key={conflict.path}><code>{conflict.path}</code><div className="collaboration-conflict-versions"><pre><small>Base</small>{preview(conflict.base)}</pre><pre><small>Mine</small>{preview(conflict.mine)}</pre><pre><small>Theirs</small>{preview(conflict.theirs)}</pre></div><div className="segmented-control"><button className={draft?.mode === 'mine' ? 'active' : ''} onClick={() => setConflicts((current) => ({ ...current, [conflict.path]: { mode: 'mine', manual: preview(conflict.mine) } }))} type="button">Mine</button><button className={draft?.mode === 'theirs' ? 'active' : ''} onClick={() => setConflicts((current) => ({ ...current, [conflict.path]: { mode: 'theirs', manual: preview(conflict.theirs) } }))} type="button">Theirs</button><button className={draft?.mode === 'manual' ? 'active' : ''} onClick={() => setConflicts((current) => ({ ...current, [conflict.path]: { mode: 'manual', manual: draft?.manual ?? preview(conflict.mine) } }))} type="button">Manual JSON</button></div>{draft?.mode === 'manual' ? <textarea value={draft.manual} onChange={(event) => setConflicts((current) => ({ ...current, [conflict.path]: { ...draft, manual: event.target.value } }))} /> : null}</article>;
      })}<button className="primary-button" disabled={disabled} onClick={resolveMerge} type="button">Apply resolutions and merge</button></div> : null}
      <div className="collaboration-history"><header><strong>{selected?.name} history</strong><span>{commits.length}</span></header>{commits.map((commit) => <article key={commit.id}><Icon name="history" size={14} /><span><strong>{commit.message}</strong><small>{commit.branch} · {commit.actor || 'Unknown actor'} · {new Date(commit.createdAt).toLocaleString()}</small></span><button disabled={disabled || commit.id === commits[0]?.id} onClick={() => restore(commit.id)} type="button">Restore</button></article>)}{!commits.length ? <p>Stage and commit this resource to create its first branch head.</p> : null}</div>
    </>}
    {error ? <div className="automation-message error">{error}</div> : null}
  </section>;
}
