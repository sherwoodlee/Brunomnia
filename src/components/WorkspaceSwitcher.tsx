import { useEffect, useRef, useState, type DragEvent as ReactDragEvent, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { ProjectWorkspaceSummary } from '../lib/projectWorkspaces';
import type { WorkspaceCatalogEntry, WorkspaceRecovery, WorkspaceSnapshotEntry, WorkspaceTrashEntry } from '../lib/workspaceCatalog';
import { Icon } from './Icon';

type WorkspaceSwitcherProps = {
  activeWorkspaceId: string;
  busy: boolean;
  entries: WorkspaceCatalogEntry[];
  error?: string;
  recovery?: WorkspaceRecovery;
  onCreate: (name: string) => Promise<void>;
  onCreateSnapshot: (workspaceId: string, message: string) => Promise<void>;
  onDelete: (workspaceId: string) => Promise<void>;
  onDuplicate: (workspaceId: string, name: string) => Promise<void>;
  onDuplicateProjectWorkspace: (sourceWorkspaceId: string, projectWorkspaceId: string, targetWorkspaceId: string, name: string) => Promise<void>;
  onEmptyDeleted: () => Promise<void>;
  onListProjectWorkspaces: (workspaceId: string) => Promise<ProjectWorkspaceSummary[]>;
  onListSnapshots: (workspaceId: string) => Promise<WorkspaceSnapshotEntry[]>;
  onListDeleted: () => Promise<WorkspaceTrashEntry[]>;
  onMoveProjectWorkspace: (sourceWorkspaceId: string, projectWorkspaceId: string, targetWorkspaceId: string) => Promise<void>;
  onOpen: (workspaceId: string) => Promise<void>;
  onPurgeDeleted: (workspaceId: string, deletedAt: number) => Promise<void>;
  onRename: (workspaceId: string, name: string) => Promise<void>;
  onReorder: (workspaceId: string, targetWorkspaceId: string, position: 'before' | 'after') => Promise<void>;
  onRestore: (workspaceId: string) => Promise<void>;
  onRestoreDeleted: (workspaceId: string, deletedAt: number) => Promise<void>;
  onRestoreSnapshot: (workspaceId: string, snapshotId: string) => Promise<void>;
};

export function WorkspaceSwitcher({
  activeWorkspaceId,
  busy,
  entries,
  error,
  recovery,
  onCreate,
  onCreateSnapshot,
  onDelete,
  onDuplicate,
  onDuplicateProjectWorkspace,
  onEmptyDeleted,
  onListProjectWorkspaces,
  onListSnapshots,
  onListDeleted,
  onMoveProjectWorkspace,
  onOpen,
  onPurgeDeleted,
  onRename,
  onReorder,
  onRestore,
  onRestoreDeleted,
  onRestoreSnapshot,
}: WorkspaceSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [trashExpanded, setTrashExpanded] = useState(false);
  const [trashEntries, setTrashEntries] = useState<WorkspaceTrashEntry[]>([]);
  const [trashLoading, setTrashLoading] = useState(false);
  const [trashError, setTrashError] = useState('');
  const [filesExpanded, setFilesExpanded] = useState(false);
  const [projectWorkspaces, setProjectWorkspaces] = useState<ProjectWorkspaceSummary[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [filesError, setFilesError] = useState('');
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [snapshots, setSnapshots] = useState<WorkspaceSnapshotEntry[]>([]);
  const [snapshotsLoading, setSnapshotsLoading] = useState(false);
  const [snapshotsError, setSnapshotsError] = useState('');
  const [duplicateFile, setDuplicateFile] = useState<ProjectWorkspaceSummary>();
  const [duplicateName, setDuplicateName] = useState('');
  const [duplicateTargetId, setDuplicateTargetId] = useState('');
  const [moveFile, setMoveFile] = useState<ProjectWorkspaceSummary>();
  const [moveTargetId, setMoveTargetId] = useState('');
  const [draggedWorkspaceId, setDraggedWorkspaceId] = useState('');
  const [dropTarget, setDropTarget] = useState<{ workspaceId: string; position: 'before' | 'after' }>();
  const containerRef = useRef<HTMLDivElement>(null);
  const active = entries.find((entry) => entry.id === activeWorkspaceId);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const refreshTrash = async () => {
    setTrashLoading(true);
    setTrashError('');
    try {
      setTrashEntries(await onListDeleted());
    } catch (loadError) {
      setTrashError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setTrashLoading(false);
    }
  };

  useEffect(() => {
    if (open && trashExpanded) void refreshTrash();
  }, [open, trashExpanded]);

  const refreshProjectWorkspaces = async () => {
    if (!activeWorkspaceId) return;
    setFilesLoading(true);
    setFilesError('');
    try {
      setProjectWorkspaces(await onListProjectWorkspaces(activeWorkspaceId));
    } catch (loadError) {
      setFilesError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setFilesLoading(false);
    }
  };

  useEffect(() => {
    setProjectWorkspaces([]);
    setDuplicateFile(undefined);
    setMoveFile(undefined);
    if (open && filesExpanded) void refreshProjectWorkspaces();
  }, [activeWorkspaceId]);

  useEffect(() => {
    if (open && filesExpanded && !projectWorkspaces.length && !filesLoading) void refreshProjectWorkspaces();
  }, [open, filesExpanded]);

  const refreshSnapshots = async () => {
    if (!activeWorkspaceId) return;
    setSnapshotsLoading(true);
    setSnapshotsError('');
    try {
      setSnapshots(await onListSnapshots(activeWorkspaceId));
    } catch (loadError) {
      setSnapshotsError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setSnapshotsLoading(false);
    }
  };

  useEffect(() => {
    setSnapshots([]);
    if (open && historyExpanded) void refreshSnapshots();
  }, [activeWorkspaceId]);

  useEffect(() => {
    if (open && historyExpanded && !snapshots.length && !snapshotsLoading) void refreshSnapshots();
  }, [open, historyExpanded]);

  const create = () => {
    const name = window.prompt('Project name', 'New Project')?.trim();
    if (name) void onCreate(name);
  };
  const rename = (entry: WorkspaceCatalogEntry) => {
    const name = window.prompt('Rename project', entry.name)?.trim();
    if (name && name !== entry.name) void onRename(entry.id, name);
  };
  const duplicate = (entry: WorkspaceCatalogEntry) => {
    const name = window.prompt('Duplicate project as', entry.name)?.trim();
    if (name) void onDuplicate(entry.id, name);
  };
  const beginProjectWorkspaceDuplicate = (projectWorkspace: ProjectWorkspaceSummary) => {
    setDuplicateFile(projectWorkspace);
    setDuplicateName(projectWorkspace.name);
    setDuplicateTargetId(activeWorkspaceId);
  };
  const submitProjectWorkspaceDuplicate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!duplicateFile || !duplicateTargetId || !duplicateName.trim()) return;
    await onDuplicateProjectWorkspace(activeWorkspaceId, duplicateFile.id, duplicateTargetId, duplicateName.trim());
    setDuplicateFile(undefined);
  };
  const beginProjectWorkspaceMove = (projectWorkspace: ProjectWorkspaceSummary) => {
    const target = entries.find((entry) => entry.id !== activeWorkspaceId && entry.status !== 'unavailable');
    if (!target) return;
    setMoveFile(projectWorkspace);
    setMoveTargetId(target.id);
  };
  const submitProjectWorkspaceMove = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!moveFile || !moveTargetId) return;
    await onMoveProjectWorkspace(activeWorkspaceId, moveFile.id, moveTargetId);
    setMoveFile(undefined);
  };
  const remove = async (entry: WorkspaceCatalogEntry) => {
    if (entries.length <= 1 || !window.confirm(`Delete “${entry.name}”? A recovery copy will remain on this device.`)) return;
    await onDelete(entry.id);
    if (trashExpanded) await refreshTrash();
  };
  const restoreDeleted = async (entry: WorkspaceTrashEntry) => {
    await onRestoreDeleted(entry.workspaceId, entry.deletedAt);
    await refreshTrash();
  };
  const purgeDeleted = async (entry: WorkspaceTrashEntry) => {
    if (!window.confirm(`Permanently delete “${entry.name}”? This removes its workspace, backup, snapshots, and local vault from this device. This cannot be undone.`)) return;
    await onPurgeDeleted(entry.workspaceId, entry.deletedAt);
    await refreshTrash();
  };
  const emptyDeleted = async () => {
    if (!trashEntries.length || !window.confirm(`Permanently delete all ${trashEntries.length} recovery ${trashEntries.length === 1 ? 'copy' : 'copies'} from this device? This cannot be undone.`)) return;
    await onEmptyDeleted();
    await refreshTrash();
  };
  const createSnapshot = async () => {
    const message = window.prompt('Snapshot message', 'Manual snapshot')?.trim();
    if (!message) return;
    await onCreateSnapshot(activeWorkspaceId, message);
    await refreshSnapshots();
  };
  const restoreSnapshot = async (snapshot: WorkspaceSnapshotEntry) => {
    if (!window.confirm(`Restore “${snapshot.message}”? The current project will be replaced by this saved version.`)) return;
    await onRestoreSnapshot(activeWorkspaceId, snapshot.id);
    await Promise.all([refreshSnapshots(), filesExpanded ? refreshProjectWorkspaces() : Promise.resolve()]);
  };
  const startProjectDrag = (event: ReactDragEvent<HTMLButtonElement>, workspaceId: string) => {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', workspaceId);
    setDraggedWorkspaceId(workspaceId);
    setDropTarget(undefined);
  };
  const projectDragOver = (event: ReactDragEvent<HTMLElement>, workspaceId: string) => {
    if (!draggedWorkspaceId || draggedWorkspaceId === workspaceId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    const bounds = event.currentTarget.getBoundingClientRect();
    setDropTarget({ workspaceId, position: event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after' });
  };
  const finishProjectDrag = () => {
    setDraggedWorkspaceId('');
    setDropTarget(undefined);
  };
  const dropProject = async (event: ReactDragEvent<HTMLElement>, workspaceId: string) => {
    event.preventDefault();
    const sourceId = draggedWorkspaceId || event.dataTransfer.getData('text/plain');
    const bounds = event.currentTarget.getBoundingClientRect();
    const position = event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after';
    finishProjectDrag();
    if (sourceId && sourceId !== workspaceId) await onReorder(sourceId, workspaceId, position);
  };
  const reorderFromKeyboard = (event: ReactKeyboardEvent<HTMLButtonElement>, entry: WorkspaceCatalogEntry, index: number) => {
    let target: WorkspaceCatalogEntry | undefined;
    let position: 'before' | 'after' = 'before';
    if (event.key === 'ArrowUp') target = entries[index - 1];
    else if (event.key === 'ArrowDown') {
      target = entries[index + 1];
      position = 'after';
    } else if (event.key === 'Home') target = entries[0];
    else if (event.key === 'End') {
      target = entries.at(-1);
      position = 'after';
    } else return;
    if (!target || target.id === entry.id) return;
    event.preventDefault();
    void onReorder(entry.id, target.id, position);
  };

  return (
    <div className="workspace-switcher-wrap" ref={containerRef}>
      <button
        aria-expanded={open}
        aria-haspopup="dialog"
        className="workspace-switcher"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <Icon name="archive" size={17} />
        <span>{active?.name ?? 'Local projects'}</span>
        {active?.status === 'recoverable' ? <i aria-label="Backup opened" className="workspace-warning-dot" /> : null}
        <Icon name="chevron-down" size={15} />
      </button>
      {open ? <section aria-label="Local projects" className="workspace-popover" role="dialog">
        <header>
          <div><strong>Local projects</strong><span>Stored only on this device</span></div>
          <button aria-label="Create project" className="icon-button subtle" disabled={busy} onClick={create} type="button"><Icon name="plus" size={16} /></button>
        </header>
        {recovery ? <div className="workspace-recovery-note"><Icon name="history" size={15} /><span>{recovery.message}</span></div> : null}
        {error ? <div className="workspace-store-error">{error}</div> : null}
        <div className="workspace-project-list">
          {entries.map((entry, index) => {
            const classes = [
              entry.id === activeWorkspaceId ? 'active' : '',
              entry.id === draggedWorkspaceId ? 'dragging' : '',
              dropTarget?.workspaceId === entry.id ? `drop-${dropTarget.position}` : '',
            ].filter(Boolean).join(' ');
            return <article className={classes} key={entry.id} onDragOver={(event) => projectDragOver(event, entry.id)} onDrop={(event) => void dropProject(event, entry.id)}>
              <button
                className="workspace-project-open"
                disabled={busy || entry.id === activeWorkspaceId || entry.status === 'unavailable'}
                onClick={() => void onOpen(entry.id)}
                type="button"
              >
                <Icon name={entry.status === 'unavailable' ? 'x' : entry.status === 'recoverable' ? 'history' : 'folder'} size={16} />
                <span><strong>{entry.name}</strong><small>{entry.status === 'ready' ? 'Local project' : entry.status === 'recoverable' ? 'Backup available' : 'Unreadable'}</small></span>
                {entry.id === activeWorkspaceId ? <Icon name="check" size={15} /> : null}
              </button>
              <div className="workspace-project-actions">
                <button aria-label={`Reorder ${entry.name}`} className="workspace-project-drag" disabled={busy || entries.length <= 1} draggable={!busy && entries.length > 1} onDragEnd={finishProjectDrag} onDragStart={(event) => startProjectDrag(event, entry.id)} onKeyDown={(event) => reorderFromKeyboard(event, entry, index)} title="Drag to reorder · Arrow keys, Home, or End" type="button"><Icon name="grid" size={13} /></button>
                {entry.status === 'recoverable' ? <button aria-label={`Restore ${entry.name}`} disabled={busy} onClick={() => void onRestore(entry.id)} title="Restore latest valid backup" type="button"><Icon name="history" size={14} /></button> : null}
                <button aria-label={`Rename ${entry.name}`} disabled={busy || entry.status === 'unavailable'} onClick={() => rename(entry)} title="Rename" type="button"><Icon name="settings" size={14} /></button>
                <button aria-label={`Duplicate ${entry.name}`} disabled={busy || entry.status === 'unavailable'} onClick={() => duplicate(entry)} title="Duplicate" type="button"><Icon name="copy" size={14} /></button>
                <button aria-label={`Delete ${entry.name}`} disabled={busy || entries.length <= 1} onClick={() => void remove(entry)} title="Delete" type="button"><Icon name="trash" size={14} /></button>
              </div>
            </article>;
          })}
        </div>
        <button aria-expanded={filesExpanded} className="workspace-files-toggle" onClick={() => setFilesExpanded((current) => !current)} type="button">
          <Icon name="grid" size={15} />
          <span><strong>Project files</strong><small>{filesExpanded ? filesLoading ? 'Loading typed workspaces…' : `${projectWorkspaces.length} ${projectWorkspaces.length === 1 ? 'file' : 'files'}` : 'Collections, documents, mocks, environments, and MCP'}</small></span>
          <Icon name={filesExpanded ? 'chevron-up' : 'chevron-down'} size={14} />
        </button>
        {filesExpanded ? <div className="workspace-files-panel">
          {filesError ? <div className="workspace-store-error">{filesError}</div> : null}
          {!filesLoading && !projectWorkspaces.length && !filesError ? <p>No project files.</p> : null}
          {projectWorkspaces.map((projectWorkspace) => <article key={`${projectWorkspace.scope}:${projectWorkspace.id}`}>
            <Icon name={projectWorkspace.scope === 'environment' ? 'braces' : projectWorkspace.scope === 'mcp' ? 'globe' : projectWorkspace.scope === 'mock-server' ? 'cube' : projectWorkspace.scope === 'design' ? 'code' : 'archive'} size={15} />
            <span><strong>{projectWorkspace.name}</strong><small>{projectWorkspace.label}</small></span>
            <div className="workspace-files-actions"><button disabled={busy} onClick={() => beginProjectWorkspaceDuplicate(projectWorkspace)} type="button"><Icon name="copy" size={12} /> Duplicate</button><button disabled={busy || !entries.some((entry) => entry.id !== activeWorkspaceId && entry.status !== 'unavailable')} onClick={() => beginProjectWorkspaceMove(projectWorkspace)} type="button"><Icon name="folder" size={12} /> Move</button></div>
          </article>)}
        </div> : null}
        <button aria-expanded={historyExpanded} className="workspace-history-toggle" onClick={() => setHistoryExpanded((current) => !current)} type="button">
          <Icon name="history" size={15} />
          <span><strong>Project history</strong><small>{historyExpanded ? snapshotsLoading ? 'Loading snapshots…' : `${snapshots.length} saved ${snapshots.length === 1 ? 'version' : 'versions'}` : 'Named local snapshots and restore'}</small></span>
          <Icon name={historyExpanded ? 'chevron-up' : 'chevron-down'} size={14} />
        </button>
        {historyExpanded ? <div className="workspace-history-panel">
          {snapshotsError ? <div className="workspace-store-error">{snapshotsError}</div> : null}
          <div className="workspace-history-toolbar"><span>Up to 50 versions remain on this device.</span><button disabled={busy} onClick={() => void createSnapshot()} type="button"><Icon name="plus" size={12} /> Snapshot</button></div>
          {!snapshotsLoading && !snapshots.length && !snapshotsError ? <p>No project snapshots yet.</p> : null}
          {snapshots.map((snapshot) => {
            const created = new Date(snapshot.createdAt);
            const createdLabel = Number.isNaN(created.getTime()) ? 'Unknown time' : created.toLocaleString();
            return <article key={snapshot.id}><Icon name="history" size={15} /><span><strong>{snapshot.message}</strong><small>{createdLabel} · {snapshot.fileCount} {snapshot.fileCount === 1 ? 'file' : 'files'} · {Math.max(1, Math.ceil(snapshot.sizeBytes / 1024))} KiB</small></span><button disabled={busy} onClick={() => void restoreSnapshot(snapshot)} type="button"><Icon name="history" size={12} /> Restore</button></article>;
          })}
        </div> : null}
        <button className="workspace-create-button" disabled={busy} onClick={create} type="button"><Icon name="plus" size={15} /> New local project</button>
        <button aria-expanded={trashExpanded} className="workspace-trash-toggle" onClick={() => setTrashExpanded((current) => !current)} type="button">
          <Icon name="history" size={15} />
          <span><strong>Recently deleted</strong><small>{trashExpanded ? trashLoading ? 'Loading recovery copies…' : `${trashEntries.length} recovery ${trashEntries.length === 1 ? 'copy' : 'copies'}` : 'Restore device-local projects'}</small></span>
          <Icon name={trashExpanded ? 'chevron-up' : 'chevron-down'} size={14} />
        </button>
        {trashExpanded ? <div className="workspace-trash-panel">
          {trashError ? <div className="workspace-store-error">{trashError}</div> : null}
          {!trashLoading && !trashEntries.length && !trashError ? <p>No deleted local projects.</p> : null}
          {!trashLoading && trashEntries.length ? <div className="workspace-trash-toolbar"><span>Recovery copies remain until permanently deleted.</span><button aria-label="Empty recently deleted projects" disabled={busy} onClick={() => void emptyDeleted()} title="Delete all permanently" type="button"><Icon name="trash" size={12} /> Empty</button></div> : null}
          {trashEntries.map((entry) => {
            const conflicts = entries.some((candidate) => candidate.id === entry.workspaceId);
            const unavailable = entry.status === 'unavailable';
            const deletedAt = new Date(entry.deletedAt);
            const deletedLabel = Number.isNaN(deletedAt.getTime()) ? 'Unknown deletion time' : deletedAt.toLocaleString();
            return <article key={`${entry.workspaceId}:${entry.deletedAt}`}>
              <Icon name={unavailable ? 'x' : 'trash'} size={15} />
              <span><strong>{entry.name}</strong><small>{deletedLabel} · {entry.status === 'ready' ? 'Workspace' : entry.status === 'recoverable' ? 'Backup' : 'Unreadable'}{entry.hasVault ? ' · Vault' : ''}{entry.hasSnapshots ? ' · Snapshots' : ''}</small></span>
              <div className="workspace-trash-actions"><button disabled={busy || unavailable || conflicts} onClick={() => void restoreDeleted(entry)} title={conflicts ? 'A current project already uses this ID' : unavailable ? 'No valid workspace or backup' : 'Restore and open'} type="button"><Icon name="history" size={13} /> Restore</button><button disabled={busy} onClick={() => void purgeDeleted(entry)} title="Delete permanently" type="button"><Icon name="trash" size={13} /> Delete</button></div>
            </article>;
          })}
        </div> : null}
      </section> : null}
      {duplicateFile ? <div className="modal-backdrop workspace-file-duplicate-backdrop" role="presentation" onMouseDown={() => setDuplicateFile(undefined)}>
        <form aria-labelledby="workspace-file-duplicate-title" aria-modal="true" className="modal workspace-file-duplicate-modal" onMouseDown={(event) => event.stopPropagation()} onSubmit={(event) => void submitProjectWorkspaceDuplicate(event)} role="dialog">
          <header><div><small>Duplicate {duplicateFile.label.toLowerCase()}</small><h2 id="workspace-file-duplicate-title">{duplicateFile.name}</h2></div><button aria-label="Close" className="icon-button subtle" onClick={() => setDuplicateFile(undefined)} type="button"><Icon name="x" /></button></header>
          <label>New name<input autoFocus maxLength={200} onChange={(event) => setDuplicateName(event.target.value)} value={duplicateName} /></label>
          <label>Destination project<select onChange={(event) => setDuplicateTargetId(event.target.value)} value={duplicateTargetId}>{entries.filter((entry) => entry.status !== 'unavailable').map((entry) => <option key={entry.id} value={entry.id}>{entry.name}{entry.id === activeWorkspaceId ? ' (current)' : ''}</option>)}</select></label>
          <p>The duplicate receives new resource identities and opens in the destination project. Runtime history is not copied.</p>
          <footer><button className="secondary-button" onClick={() => setDuplicateFile(undefined)} type="button">Cancel</button><button className="primary-button" disabled={busy || !duplicateName.trim() || !duplicateTargetId} type="submit"><Icon name="copy" size={13} /> Duplicate</button></footer>
        </form>
      </div> : null}
      {moveFile ? <div className="modal-backdrop workspace-file-duplicate-backdrop" role="presentation" onMouseDown={() => setMoveFile(undefined)}>
        <form aria-labelledby="workspace-file-move-title" aria-modal="true" className="modal workspace-file-duplicate-modal" onMouseDown={(event) => event.stopPropagation()} onSubmit={(event) => void submitProjectWorkspaceMove(event)} role="dialog">
          <header><div><small>Move {moveFile.label.toLowerCase()}</small><h2 id="workspace-file-move-title">{moveFile.name}</h2></div><button aria-label="Close" className="icon-button subtle" onClick={() => setMoveFile(undefined)} type="button"><Icon name="x" /></button></header>
          <label>Destination project<select autoFocus onChange={(event) => setMoveTargetId(event.target.value)} value={moveTargetId}>{entries.filter((entry) => entry.id !== activeWorkspaceId && entry.status !== 'unavailable').map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label>
          <p>The file keeps its resource identities, moves its owned local evidence, and opens in the destination. Moving the final file leaves the source project empty.</p>
          <footer><button className="secondary-button" onClick={() => setMoveFile(undefined)} type="button">Cancel</button><button className="primary-button" disabled={busy || !moveTargetId} type="submit"><Icon name="folder" size={13} /> Move file</button></footer>
        </form>
      </div> : null}
      {recovery?.kind === 'workspace-backup' && recovery.workspaceId === activeWorkspaceId ? <div className="modal-backdrop workspace-recovery-backdrop" role="presentation">
        <section aria-labelledby="workspace-recovery-title" aria-modal="true" className="modal workspace-recovery-modal" role="dialog">
          <div className="modal-header"><div><span className="eyebrow">Local recovery</span><h2 id="workspace-recovery-title">Project backup opened</h2></div></div>
          <p>{recovery.message}</p>
          <p>The damaged primary file has not been overwritten. Restore the backup to resume editing, or open another healthy project.</p>
          {error ? <div className="workspace-store-error">{error}</div> : null}
          <div className="workspace-recovery-projects">
            {entries.filter((entry) => entry.id !== activeWorkspaceId && entry.status !== 'unavailable').map((entry) => <button disabled={busy} key={entry.id} onClick={() => void onOpen(entry.id)} type="button"><Icon name="folder" size={15} /> Open {entry.name}</button>)}
          </div>
          <div className="modal-actions"><button className="primary-button" disabled={busy} onClick={() => void onRestore(activeWorkspaceId)} type="button"><Icon name="history" size={15} /> Restore latest valid backup</button></div>
        </section>
      </div> : null}
    </div>
  );
}
