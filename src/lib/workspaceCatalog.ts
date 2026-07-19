import { invoke, isTauri } from '@tauri-apps/api/core';
import { cloneSeedWorkspace, createBlankRequest } from '../data/seed';
import type { AppPreferences, Workspace } from '../types';
import { migrateWorkspace } from './storage';

const legacyStorageKey = 'brunomnia.workspace.v1';
const catalogStorageKey = 'brunomnia.projects.v1';
const catalogBackupStorageKey = 'brunomnia.projects.backup.v1';
const projectStorageKey = (id: string) => `brunomnia.project.${id}.v1`;
const projectBackupStorageKey = (id: string) => `brunomnia.project.${id}.backup.v1`;
const projectTrashStorageKey = (id: string, deletedAt: number, backup = false) => `brunomnia.trash.${id}.${deletedAt}${backup ? '.backup' : ''}.v1`;
const maxCatalogWorkspaces = 500;
const maxTrashEntries = 1_000;
const workspaceIdPattern = /^[A-Za-z0-9_-]{1,128}$/;
const browserTrashKeyPattern = /^brunomnia\.trash\.([A-Za-z0-9_-]{1,128})\.(\d{1,16})(\.backup)?\.v1$/;

export type WorkspaceCatalogEntry = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt: string;
  status: 'ready' | 'recoverable' | 'unavailable';
};

export type WorkspaceRecovery = {
  kind: 'catalog-backup' | 'catalog-rebuilt' | 'legacy-corrupt' | 'workspace-backup';
  workspaceId: string;
  message: string;
};

export type WorkspaceCatalogSnapshot = {
  activeWorkspaceId: string;
  entries: WorkspaceCatalogEntry[];
  workspace: Workspace;
  recovery?: WorkspaceRecovery;
};

export type WorkspaceTrashEntry = {
  workspaceId: string;
  name: string;
  deletedAt: number;
  status: WorkspaceCatalogEntry['status'];
  hasBackup: boolean;
  hasVault: boolean;
};

export type WorkspaceOrderPosition = 'before' | 'after';

type BrowserCatalogEntry = Omit<WorkspaceCatalogEntry, 'status'>;
type BrowserCatalog = { version: 1; activeWorkspaceId: string; entries: BrowserCatalogEntry[] };
type BrowserTrashFiles = { workspaceId: string; deletedAt: number; primary?: string; backup?: string };

const isWorkspaceEnvelope = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return candidate.format === 'brunomnia' && Array.isArray(candidate.collections);
};

export const createBlankWorkspace = (name: string, preferences: AppPreferences): Workspace => {
  const workspace = cloneSeedWorkspace();
  const request = createBlankRequest(`request-${crypto.randomUUID()}`);
  const environmentId = `environment-${crypto.randomUUID()}`;
  return {
    ...workspace,
    name: name.trim().slice(0, 200) || 'Untitled Project',
    activeRequestId: request.id,
    activeEnvironmentId: environmentId,
    collections: [{
      id: `collection-${crypto.randomUUID()}`,
      name: 'Requests',
      expanded: true,
      requests: [request],
      folders: [],
      resourceOrder: [request.id],
      environment: [],
      subEnvironments: [],
      activeSubEnvironmentId: '',
      documentation: '',
    }],
    environments: [{ id: environmentId, name: 'Base Environment', variables: [], parentId: '', private: false }],
    history: [],
    apiDesigns: [],
    mockServers: [],
    runnerReports: [],
    imports: [],
    cookies: [],
    responses: [],
    streamSessions: [],
    responseFilters: {},
    project: { mode: 'local', path: '', remoteUrl: '', remoteName: 'origin', authorName: '', authorEmail: '', autoSave: true },
    plugins: [],
    pluginData: {},
    activePluginTheme: '',
    collaboration: { mode: 'off', path: '', actor: 'Local owner', revision: 0 },
    governance: structuredClone(workspace.governance),
    mcpClients: [],
    ai: structuredClone(workspace.ai),
    konnect: structuredClone(workspace.konnect),
    preferences: structuredClone(preferences),
  };
};

export const createWorkspaceDuplicate = (source: Workspace, name: string, preferences: AppPreferences): Workspace => {
  const copy = structuredClone(source);
  copy.name = name.replace(/[\r\n\0]/g, ' ').trim().slice(0, 200) || source.name;
  copy.history = [];
  copy.responses = [];
  copy.streamSessions = [];
  copy.runnerReports = [];
  copy.project = { mode: 'local', path: '', remoteUrl: '', remoteName: 'origin', authorName: '', authorEmail: '', autoSave: true };
  copy.collaboration = { mode: 'off', path: '', actor: copy.collaboration.actor || 'Local owner', revision: 0 };
  copy.preferences = structuredClone(preferences);
  return copy;
};

const catalogWorkspaceId = () => `workspace-${crypto.randomUUID()}`;
const catalogName = (workspace: Workspace) => workspace.name.replace(/[\r\n\0]/g, ' ').trim().slice(0, 200) || 'Untitled Project';
const catalogNow = () => new Date().toISOString();

const browserCatalogEntry = (id: string, workspace: Workspace): BrowserCatalogEntry => {
  const now = catalogNow();
  return { id, name: catalogName(workspace), createdAt: now, updatedAt: now, lastOpenedAt: now };
};

const parseBrowserWorkspace = (raw: string | null): Workspace | undefined => {
  if (!raw) return undefined;
  try {
    const value: unknown = JSON.parse(raw);
    return isWorkspaceEnvelope(value) ? migrateWorkspace(value) : undefined;
  } catch {
    return undefined;
  }
};

const parseBrowserTrashKey = (key: string): { workspaceId: string; deletedAt: number; backup: boolean } | undefined => {
  const match = browserTrashKeyPattern.exec(key);
  if (!match) return undefined;
  const deletedAt = Number(match[2]);
  if (!Number.isSafeInteger(deletedAt) || deletedAt < 0) return undefined;
  return { workspaceId: match[1], deletedAt, backup: Boolean(match[3]) };
};

const browserTrashEntries = (): WorkspaceTrashEntry[] => {
  const groups = new Map<string, BrowserTrashFiles>();
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    const parsed = key ? parseBrowserTrashKey(key) : undefined;
    if (!key || !parsed) continue;
    const groupKey = `${parsed.workspaceId}:${parsed.deletedAt}`;
    const group = groups.get(groupKey) ?? { workspaceId: parsed.workspaceId, deletedAt: parsed.deletedAt };
    const value = localStorage.getItem(key);
    if (value !== null) {
      if (parsed.backup) group.backup = value;
      else group.primary = value;
    }
    groups.set(groupKey, group);
  }
  return [...groups.values()]
    .map((group): WorkspaceTrashEntry => {
      const primary = parseBrowserWorkspace(group.primary ?? null);
      const backup = parseBrowserWorkspace(group.backup ?? null);
      const workspace = primary ?? backup;
      return {
        workspaceId: group.workspaceId,
        name: workspace ? catalogName(workspace) : group.workspaceId,
        deletedAt: group.deletedAt,
        status: primary ? 'ready' : backup ? 'recoverable' : 'unavailable',
        hasBackup: group.backup !== undefined,
        hasVault: false,
      };
    })
    .sort((left, right) => right.deletedAt - left.deletedAt || left.workspaceId.localeCompare(right.workspaceId))
    .slice(0, maxTrashEntries);
};

const readBrowserWorkspace = (id: string): { workspace?: Workspace; status: WorkspaceCatalogEntry['status'] } => {
  const primary = parseBrowserWorkspace(localStorage.getItem(projectStorageKey(id)));
  if (primary) return { workspace: primary, status: 'ready' };
  const backup = parseBrowserWorkspace(localStorage.getItem(projectBackupStorageKey(id)));
  return backup ? { workspace: backup, status: 'recoverable' } : { status: 'unavailable' };
};

const parseBrowserCatalogValue = (raw: string | null): BrowserCatalog | undefined => {
  try {
    const value: unknown = JSON.parse(raw ?? 'null');
    if (!value || typeof value !== 'object') return undefined;
    const source = value as Record<string, unknown>;
    if (source.version !== 1 || !Array.isArray(source.entries) || source.entries.length > maxCatalogWorkspaces) return undefined;
    const seenIds = new Set<string>();
    const entries = source.entries.flatMap((value): BrowserCatalogEntry[] => {
      if (!value || typeof value !== 'object') return [];
      const entry = value as Record<string, unknown>;
      if (typeof entry.id !== 'string' || !workspaceIdPattern.test(entry.id) || seenIds.has(entry.id)) return [];
      seenIds.add(entry.id);
      const now = catalogNow();
      return [{
        id: entry.id,
        name: typeof entry.name === 'string' ? entry.name.slice(0, 200) : 'Untitled Project',
        createdAt: typeof entry.createdAt === 'string' ? entry.createdAt : now,
        updatedAt: typeof entry.updatedAt === 'string' ? entry.updatedAt : now,
        lastOpenedAt: typeof entry.lastOpenedAt === 'string' ? entry.lastOpenedAt : now,
      }];
    });
    const activeWorkspaceId = typeof source.activeWorkspaceId === 'string' ? source.activeWorkspaceId : '';
    return { version: 1, activeWorkspaceId, entries };
  } catch {
    return undefined;
  }
};

const parseBrowserCatalog = () => parseBrowserCatalogValue(localStorage.getItem(catalogStorageKey))
  ?? parseBrowserCatalogValue(localStorage.getItem(catalogBackupStorageKey));

const writeBrowserCatalog = (catalog: BrowserCatalog) => {
  const current = localStorage.getItem(catalogStorageKey);
  if (parseBrowserCatalogValue(current)) localStorage.setItem(catalogBackupStorageKey, current!);
  localStorage.setItem(catalogStorageKey, JSON.stringify(catalog));
};

const browserSnapshot = (catalog: BrowserCatalog, recovery?: WorkspaceRecovery): WorkspaceCatalogSnapshot => {
  let activeWorkspaceId = catalog.activeWorkspaceId;
  let active = catalog.entries.find((entry) => entry.id === activeWorkspaceId);
  let loaded = active ? readBrowserWorkspace(active.id) : { status: 'unavailable' as const };
  if (!active || !loaded.workspace) {
    active = catalog.entries.find((entry) => readBrowserWorkspace(entry.id).workspace);
    if (!active) throw new Error('No valid or recoverable local project is available.');
    activeWorkspaceId = active.id;
    loaded = readBrowserWorkspace(active.id);
  }
  catalog.activeWorkspaceId = activeWorkspaceId;
  const now = catalogNow();
  catalog.entries = catalog.entries.map((entry) => entry.id === activeWorkspaceId ? { ...entry, lastOpenedAt: now } : entry);
  writeBrowserCatalog(catalog);
  const entries = catalog.entries.map((entry): WorkspaceCatalogEntry => ({ ...entry, status: readBrowserWorkspace(entry.id).status }));
  return {
    activeWorkspaceId,
    entries,
    workspace: loaded.workspace!,
    recovery: loaded.status === 'recoverable'
      ? { kind: 'workspace-backup', workspaceId: activeWorkspaceId, message: 'The active project file is unreadable. Brunomnia opened its latest valid backup until you restore it.' }
      : recovery,
  };
};

const initializeBrowserCatalog = (): WorkspaceCatalogSnapshot => {
  const primaryCatalog = parseBrowserCatalogValue(localStorage.getItem(catalogStorageKey));
  const backupCatalog = parseBrowserCatalogValue(localStorage.getItem(catalogBackupStorageKey));
  let catalog = primaryCatalog ?? backupCatalog;
  let recovery: WorkspaceRecovery | undefined;
  if (!primaryCatalog && backupCatalog) recovery = { kind: 'catalog-backup', workspaceId: '', message: 'The browser project catalog was restored from its latest valid backup.' };
  if (!catalog?.entries.length) {
    const legacyRaw = localStorage.getItem(legacyStorageKey);
    const legacy = parseBrowserWorkspace(legacyRaw);
    const workspace = legacy ?? cloneSeedWorkspace();
    const id = legacy ? 'local-workspace' : catalogWorkspaceId();
    localStorage.setItem(projectStorageKey(id), JSON.stringify(workspace));
    catalog = { version: 1, activeWorkspaceId: id, entries: [browserCatalogEntry(id, workspace)] };
    if (legacyRaw && !legacy) recovery = { kind: 'legacy-corrupt', workspaceId: '', message: 'The legacy browser workspace was unreadable and remains preserved in local storage.' };
  }
  return browserSnapshot(catalog, recovery);
};

const normalizeCatalogSnapshot = (snapshot: Omit<WorkspaceCatalogSnapshot, 'workspace'> & { workspace: unknown }): WorkspaceCatalogSnapshot => ({
  activeWorkspaceId: snapshot.activeWorkspaceId,
  entries: snapshot.entries.filter((entry) => workspaceIdPattern.test(entry.id)).slice(0, maxCatalogWorkspaces),
  workspace: migrateWorkspace(snapshot.workspace),
  recovery: snapshot.recovery,
});

const normalizeTrashEntries = (value: unknown): WorkspaceTrashEntry[] => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((candidate): WorkspaceTrashEntry[] => {
    if (!candidate || typeof candidate !== 'object') return [];
    const entry = candidate as Record<string, unknown>;
    if (typeof entry.workspaceId !== 'string' || !workspaceIdPattern.test(entry.workspaceId)) return [];
    if (typeof entry.deletedAt !== 'number' || !Number.isSafeInteger(entry.deletedAt) || entry.deletedAt < 0) return [];
    if (entry.status !== 'ready' && entry.status !== 'recoverable' && entry.status !== 'unavailable') return [];
    return [{
      workspaceId: entry.workspaceId,
      name: typeof entry.name === 'string' ? entry.name.replace(/[\r\n\0]/g, ' ').trim().slice(0, 200) || entry.workspaceId : entry.workspaceId,
      deletedAt: entry.deletedAt,
      status: entry.status,
      hasBackup: entry.hasBackup === true,
      hasVault: entry.hasVault === true,
    }];
  }).sort((left, right) => right.deletedAt - left.deletedAt || left.workspaceId.localeCompare(right.workspaceId)).slice(0, maxTrashEntries);
};

export const loadWorkspaceCatalog = async (): Promise<WorkspaceCatalogSnapshot> => {
  if (isTauri()) {
    const snapshot = await invoke<Omit<WorkspaceCatalogSnapshot, 'workspace'> & { workspace: unknown }>('workspace_catalog_load', { defaultWorkspace: cloneSeedWorkspace() });
    return normalizeCatalogSnapshot(snapshot);
  }
  return initializeBrowserCatalog();
};

export const listDeletedCatalogWorkspaces = async (): Promise<WorkspaceTrashEntry[]> => {
  if (isTauri()) return normalizeTrashEntries(await invoke('workspace_catalog_list_trash'));
  return browserTrashEntries();
};

export const saveCatalogWorkspace = async (workspaceId: string, workspace: Workspace): Promise<void> => {
  if (!workspaceIdPattern.test(workspaceId)) throw new Error('The active project ID is invalid.');
  if (isTauri()) {
    await invoke('workspace_catalog_save', { workspaceId, workspace });
    return;
  }
  const catalog = parseBrowserCatalog();
  if (!catalog?.entries.some((entry) => entry.id === workspaceId)) throw new Error('This local project no longer exists.');
  const current = localStorage.getItem(projectStorageKey(workspaceId));
  if (parseBrowserWorkspace(current)) localStorage.setItem(projectBackupStorageKey(workspaceId), current!);
  localStorage.setItem(projectStorageKey(workspaceId), JSON.stringify(workspace));
  const now = catalogNow();
  catalog.entries = catalog.entries.map((entry) => entry.id === workspaceId ? { ...entry, name: catalogName(workspace), updatedAt: now } : entry);
  writeBrowserCatalog(catalog);
};

export const openCatalogWorkspace = async (workspaceId: string): Promise<WorkspaceCatalogSnapshot> => {
  if (!workspaceIdPattern.test(workspaceId)) throw new Error('The selected project ID is invalid.');
  if (isTauri()) {
    const snapshot = await invoke<Omit<WorkspaceCatalogSnapshot, 'workspace'> & { workspace: unknown }>('workspace_catalog_open', { workspaceId });
    return normalizeCatalogSnapshot(snapshot);
  }
  const catalog = parseBrowserCatalog();
  if (!catalog?.entries.some((entry) => entry.id === workspaceId)) throw new Error('This local project no longer exists.');
  if (!readBrowserWorkspace(workspaceId).workspace) throw new Error('This local project and its backup are unreadable.');
  catalog.activeWorkspaceId = workspaceId;
  return browserSnapshot(catalog);
};

export const readCatalogWorkspace = async (workspaceId: string): Promise<Workspace> => {
  if (!workspaceIdPattern.test(workspaceId)) throw new Error('The selected project ID is invalid.');
  if (isTauri()) return migrateWorkspace(await invoke('workspace_catalog_read', { workspaceId }));
  const catalog = parseBrowserCatalog();
  if (!catalog?.entries.some((entry) => entry.id === workspaceId)) throw new Error('This local project no longer exists.');
  const workspace = readBrowserWorkspace(workspaceId).workspace;
  if (!workspace) throw new Error('This local project and its backup are unreadable.');
  return workspace;
};

export const createCatalogWorkspace = async (workspace: Workspace, workspaceId = catalogWorkspaceId()): Promise<WorkspaceCatalogSnapshot> => {
  if (!workspaceIdPattern.test(workspaceId)) throw new Error('The new project ID is invalid.');
  if (isTauri()) {
    const snapshot = await invoke<Omit<WorkspaceCatalogSnapshot, 'workspace'> & { workspace: unknown }>('workspace_catalog_create', { workspaceId, workspace });
    return normalizeCatalogSnapshot(snapshot);
  }
  const catalog = parseBrowserCatalog() ?? { version: 1 as const, activeWorkspaceId: '', entries: [] };
  if (catalog.entries.length >= maxCatalogWorkspaces) throw new Error(`At most ${maxCatalogWorkspaces} local projects can be stored.`);
  if (catalog.entries.some((entry) => entry.id === workspaceId)) throw new Error('A local project with this ID already exists.');
  localStorage.setItem(projectStorageKey(workspaceId), JSON.stringify(workspace));
  catalog.entries.push(browserCatalogEntry(workspaceId, workspace));
  catalog.activeWorkspaceId = workspaceId;
  return browserSnapshot(catalog);
};

export const renameCatalogWorkspace = async (workspaceId: string, name: string): Promise<WorkspaceCatalogSnapshot> => {
  if (!workspaceIdPattern.test(workspaceId)) throw new Error('The selected project ID is invalid.');
  const normalizedName = name.replace(/[\r\n\0]/g, ' ').trim().slice(0, 200) || 'Untitled Project';
  if (isTauri()) {
    const snapshot = await invoke<Omit<WorkspaceCatalogSnapshot, 'workspace'> & { workspace: unknown }>('workspace_catalog_rename', { workspaceId, name: normalizedName });
    return normalizeCatalogSnapshot(snapshot);
  }
  const catalog = parseBrowserCatalog();
  const entry = catalog?.entries.find((entry) => entry.id === workspaceId);
  const loaded = readBrowserWorkspace(workspaceId).workspace;
  if (!catalog || !entry || !loaded) throw new Error('This local project cannot be renamed.');
  loaded.name = normalizedName;
  await saveCatalogWorkspace(workspaceId, loaded);
  entry.name = normalizedName;
  entry.updatedAt = catalogNow();
  writeBrowserCatalog(catalog);
  return browserSnapshot(catalog);
};

export const reorderCatalogWorkspace = async (workspaceId: string, targetWorkspaceId: string, position: WorkspaceOrderPosition): Promise<WorkspaceCatalogSnapshot> => {
  if (!workspaceIdPattern.test(workspaceId) || !workspaceIdPattern.test(targetWorkspaceId)) throw new Error('The project reorder selection is invalid.');
  if (position !== 'before' && position !== 'after') throw new Error('Project reorder position must be before or after.');
  if (isTauri()) {
    const snapshot = await invoke<Omit<WorkspaceCatalogSnapshot, 'workspace'> & { workspace: unknown }>('workspace_catalog_reorder', { workspaceId, targetWorkspaceId, position });
    return normalizeCatalogSnapshot(snapshot);
  }
  const catalog = parseBrowserCatalog();
  if (!catalog) throw new Error('The local project catalog is unavailable.');
  const sourceIndex = catalog.entries.findIndex((entry) => entry.id === workspaceId);
  if (sourceIndex < 0) throw new Error('The project being reordered no longer exists.');
  if (!catalog.entries.some((entry) => entry.id === targetWorkspaceId)) throw new Error('The reorder destination no longer exists.');
  if (workspaceId === targetWorkspaceId) return browserSnapshot(catalog);
  const [entry] = catalog.entries.splice(sourceIndex, 1);
  const targetIndex = catalog.entries.findIndex((candidate) => candidate.id === targetWorkspaceId);
  catalog.entries.splice(position === 'after' ? targetIndex + 1 : targetIndex, 0, entry);
  return browserSnapshot(catalog);
};

export const deleteCatalogWorkspace = async (workspaceId: string): Promise<WorkspaceCatalogSnapshot> => {
  if (!workspaceIdPattern.test(workspaceId)) throw new Error('The selected project ID is invalid.');
  if (isTauri()) {
    const snapshot = await invoke<Omit<WorkspaceCatalogSnapshot, 'workspace'> & { workspace: unknown }>('workspace_catalog_delete', { workspaceId });
    return normalizeCatalogSnapshot(snapshot);
  }
  const catalog = parseBrowserCatalog();
  if (!catalog || catalog.entries.length <= 1) throw new Error('The last local project cannot be deleted.');
  const index = catalog.entries.findIndex((entry) => entry.id === workspaceId);
  if (index < 0) throw new Error('This local project no longer exists.');
  const suffix = Date.now();
  const primary = localStorage.getItem(projectStorageKey(workspaceId));
  const backup = localStorage.getItem(projectBackupStorageKey(workspaceId));
  if (primary) localStorage.setItem(projectTrashStorageKey(workspaceId, suffix), primary);
  if (backup) localStorage.setItem(projectTrashStorageKey(workspaceId, suffix, true), backup);
  localStorage.removeItem(projectStorageKey(workspaceId));
  localStorage.removeItem(projectBackupStorageKey(workspaceId));
  catalog.entries.splice(index, 1);
  if (catalog.activeWorkspaceId === workspaceId) catalog.activeWorkspaceId = catalog.entries[Math.min(index, catalog.entries.length - 1)].id;
  return browserSnapshot(catalog);
};

export const restoreDeletedCatalogWorkspace = async (workspaceId: string, deletedAt: number): Promise<WorkspaceCatalogSnapshot> => {
  if (!workspaceIdPattern.test(workspaceId)) throw new Error('The deleted project ID is invalid.');
  if (!Number.isSafeInteger(deletedAt) || deletedAt < 0) throw new Error('The deleted-project recovery timestamp is invalid.');
  if (isTauri()) {
    const snapshot = await invoke<Omit<WorkspaceCatalogSnapshot, 'workspace'> & { workspace: unknown }>('workspace_catalog_restore_trash', { workspaceId, deletedAt });
    return normalizeCatalogSnapshot(snapshot);
  }
  const catalog = parseBrowserCatalog();
  if (!catalog) throw new Error('The local project catalog is unavailable.');
  if (catalog.entries.length >= maxCatalogWorkspaces) throw new Error(`At most ${maxCatalogWorkspaces} local projects can be stored.`);
  if (catalog.entries.some((entry) => entry.id === workspaceId)) throw new Error("A current local project already uses this deleted project's ID.");
  if (localStorage.getItem(projectStorageKey(workspaceId)) !== null || localStorage.getItem(projectBackupStorageKey(workspaceId)) !== null) {
    throw new Error('Existing local files conflict with this deleted project restore.');
  }

  const primaryKey = projectTrashStorageKey(workspaceId, deletedAt);
  const backupKey = projectTrashStorageKey(workspaceId, deletedAt, true);
  const primaryRaw = localStorage.getItem(primaryKey);
  const backupRaw = localStorage.getItem(backupKey);
  const primary = parseBrowserWorkspace(primaryRaw);
  const backup = parseBrowserWorkspace(backupRaw);
  const workspace = primary ?? backup;
  if (!workspace) throw new Error('This deleted project does not contain a valid workspace or backup.');

  if (primaryRaw && !primary) localStorage.setItem(`brunomnia.recovery.${workspaceId}.${deletedAt}.deleted-workspace.invalid.v1`, primaryRaw);
  if (backupRaw && !backup) localStorage.setItem(`brunomnia.recovery.${workspaceId}.${deletedAt}.deleted-backup.invalid.v1`, backupRaw);
  localStorage.setItem(projectStorageKey(workspaceId), JSON.stringify(workspace));
  if (backup) localStorage.setItem(projectBackupStorageKey(workspaceId), JSON.stringify(backup));
  catalog.entries.push(browserCatalogEntry(workspaceId, workspace));
  catalog.activeWorkspaceId = workspaceId;
  const snapshot = browserSnapshot(catalog);
  localStorage.removeItem(primaryKey);
  localStorage.removeItem(backupKey);
  return snapshot;
};

export const restoreCatalogWorkspaceBackup = async (workspaceId: string): Promise<WorkspaceCatalogSnapshot> => {
  if (!workspaceIdPattern.test(workspaceId)) throw new Error('The selected project ID is invalid.');
  if (isTauri()) {
    const snapshot = await invoke<Omit<WorkspaceCatalogSnapshot, 'workspace'> & { workspace: unknown }>('workspace_catalog_restore_backup', { workspaceId });
    return normalizeCatalogSnapshot(snapshot);
  }
  const backup = localStorage.getItem(projectBackupStorageKey(workspaceId));
  if (!parseBrowserWorkspace(backup)) throw new Error('This project does not have a valid backup to restore.');
  const invalid = localStorage.getItem(projectStorageKey(workspaceId));
  if (invalid) localStorage.setItem(`brunomnia.recovery.${workspaceId}.${Date.now()}.invalid.v1`, invalid);
  localStorage.setItem(projectStorageKey(workspaceId), backup!);
  return openCatalogWorkspace(workspaceId);
};
