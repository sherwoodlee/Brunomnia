import { useEffect, useMemo, useState } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import type { Workspace } from '../types';
import { buildRunnerCliCommand } from '../lib/runnerCli';
import { getCatalogWorkspaceCliPath } from '../lib/workspaceCatalog';
import { Icon } from './Icon';

type RunnerCliDialogProps = {
  workspace: Workspace;
  workspaceId: string;
  collectionId: string;
  environmentId: string;
  requestIds: string[];
  iterations: number;
  retries: number;
  delayMs: number;
  bail: boolean;
  hasData: boolean;
  dataFileName: string;
  onClose: () => void;
};

export function RunnerCliDialog({ workspace, workspaceId, collectionId, environmentId, requestIds, iterations, retries, delayMs, bail, hasData, dataFileName, onClose }: RunnerCliDialogProps) {
  const projectBacked = workspace.project.mode !== 'local' && Boolean(workspace.project.path);
  const native = isTauri();
  const [workspacePath, setWorkspacePath] = useState(native ? '' : projectBacked ? workspace.project.path : '');
  const [dataPath, setDataPath] = useState('');
  const [resolvingPath, setResolvingPath] = useState(native);
  const [pathError, setPathError] = useState('');
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState('');

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  useEffect(() => {
    if (!native) return;
    let active = true;
    setResolvingPath(true);
    void getCatalogWorkspaceCliPath(workspaceId)
      .then((path) => { if (active) setWorkspacePath(path); })
      .catch((caught) => {
        if (!active) return;
        if (projectBacked) setWorkspacePath(workspace.project.path);
        else setPathError(caught instanceof Error ? caught.message : String(caught));
      })
      .finally(() => { if (active) setResolvingPath(false); });
    return () => { active = false; };
  }, [native, projectBacked, workspace.project.path, workspaceId]);

  const command = useMemo(() => buildRunnerCliCommand({
    workspacePath: workspacePath || '<workspace-or-project-path>',
    collectionId,
    environmentId,
    requestIds,
    iterations,
    retries,
    delayMs,
    dataPath: hasData ? dataPath || '<iteration-data-path>' : undefined,
    bail,
  }), [bail, collectionId, dataPath, delayMs, environmentId, hasData, iterations, requestIds, retries, workspacePath]);
  const ready = Boolean(workspacePath) && (!hasData || Boolean(dataPath)) && requestIds.length > 0 && !resolvingPath;

  const copy = async () => {
    setCopyError('');
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1_500);
    } catch (caught) {
      setCopied(false);
      setCopyError(caught instanceof Error ? caught.message : String(caught));
    }
  };

  return <div className="runner-data-overlay" onMouseDown={onClose} role="presentation">
    <section aria-labelledby="runner-cli-title" aria-modal="true" className="runner-cli-dialog" onMouseDown={(event) => event.stopPropagation()} role="dialog">
      <header><div><small>Collection Runner</small><h2 id="runner-cli-title">Run via CLI</h2></div><button aria-label="Close Runner CLI preview" onClick={onClose} type="button">×</button></header>
      <p>Copy a POSIX-shell command with this Runner's selected request order and execution controls.</p>
      <div className="runner-cli-paths">
        <label>Workspace JSON or project folder<input aria-label="Runner CLI workspace path" placeholder="/path/to/workspace.brunomnia.json" value={workspacePath} onChange={(event) => setWorkspacePath(event.target.value)} /></label>
        {hasData ? <label>Iteration data file<input aria-label="Runner CLI data path" placeholder={`/path/to/${dataFileName || 'iterations.json'}`} value={dataPath} onChange={(event) => setDataPath(event.target.value)} /></label> : null}
      </div>
      {resolvingPath ? <div className="runner-cli-notice">Resolving this device-local project's saved JSON path…</div> : null}
      {!resolvingPath && !workspacePath ? <div className="runner-cli-notice warning">Browser-local projects have no CLI-readable path. Export all workspace data as Brunomnia JSON, then enter the downloaded path.</div> : null}
      {projectBacked ? <div className="runner-cli-notice">The saved local JSON is the most complete CLI input. The connected folder or Git path can also be entered directly; the CLI reads its split YAML files.</div> : null}
      {hasData && !dataPath ? <div className="runner-cli-notice warning">Save the decoded current iteration data as UTF-8 JSON or CSV and enter its filesystem path before copying.</div> : null}
      {pathError ? <div className="automation-message error" role="alert">{pathError}</div> : null}
      <div className="runner-cli-command"><code>{command}</code></div>
      <div className="runner-cli-summary"><span>{requestIds.length} selected request{requestIds.length === 1 ? '' : 's'}</span><span>{iterations} iteration{iterations === 1 ? '' : 's'}</span><span>{delayMs > 0 ? `${delayMs} ms delay` : 'No delay'}</span><span>{bail ? 'Bail enabled' : 'Bail disabled'}</span></div>
      <p className="runner-cli-trust">CLI scripts and local/external access remain denied unless you append the relevant explicit <code>--allow-*</code> trust flags.</p>
      {copyError ? <div className="automation-message error" role="alert">{copyError}</div> : null}
      <footer><button className="secondary-action" onClick={onClose} type="button">Close</button><button className="primary-action" disabled={!ready} onClick={() => void copy()} type="button"><Icon name={copied ? 'check' : 'copy'} size={13} /> {copied ? 'Copied' : 'Copy command'}</button></footer>
    </section>
  </div>;
}
