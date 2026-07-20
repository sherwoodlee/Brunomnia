import { invoke, isTauri } from '@tauri-apps/api/core';
import { cloneSeedWorkspace } from '../data/seed';
import type { AppPreferences, Workspace } from '../types';
import { duplicateProjectWorkspace, listProjectWorkspaces, moveProjectWorkspace, type ProjectWorkspaceSummary } from './projectWorkspaces';
import { migrateWorkspace } from './storage';
import { assembleWorkspacePhysicalStore, isWorkspacePhysicalManifest, splitWorkspacePhysicalStore } from './workspacePhysicalStore';

const legacyStorageKey = 'brunomnia.workspace.v1';
const catalogStorageKey = 'brunomnia.projects.v1';
const catalogBackupStorageKey = 'brunomnia.projects.backup.v1';
const projectStorageKey = (id: string) => `brunomnia.project.${id}.v1`;
const projectBackupStorageKey = (id: string) => `brunomnia.project.${id}.backup.v1`;
const projectFileStorageKey = (workspaceId: string, generation: string, index: number) => `brunomnia.project-file.${workspaceId}.${generation}.${index}.v1`;
const projectTrashStorageKey = (id: string, deletedAt: number, kind: 'workspace' | 'backup' | 'metadata' = 'workspace') => `brunomnia.trash.${id}.${deletedAt}${kind === 'workspace' ? '' : `.${kind}`}.v1`;
const projectSnapshotStorageKey = (workspaceId: string, snapshotId: string) => `brunomnia.snapshot.${workspaceId}.${snapshotId}.v1`;
const projectTrashSnapshotStorageKey = (workspaceId: string, deletedAt: number, snapshotId: string) => `brunomnia.trash-snapshot.${workspaceId}.${deletedAt}.${snapshotId}.v1`;
const maxCatalogWorkspaces = 500;
const maxTrashEntries = 1_000;
const maxWorkspaceSnapshots = 50;
const maxWorkspaceSnapshotBytes = 100_000_000;
const workspaceIdPattern = /^[A-Za-z0-9_-]{1,128}$/;
const browserTrashKeyPattern = /^brunomnia\.trash\.([A-Za-z0-9_-]{1,128})\.(\d{1,16})(?:\.(backup|metadata))?\.v1$/;
const browserSnapshotKeyPattern = /^brunomnia\.snapshot\.([A-Za-z0-9_-]{1,128})\.([A-Za-z0-9_-]{1,128})\.v1$/;
const browserTrashSnapshotKeyPattern = /^brunomnia\.trash-snapshot\.([A-Za-z0-9_-]{1,128})\.(\d{1,16})\.([A-Za-z0-9_-]{1,128})\.v1$/;

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
  hasSnapshots: boolean;
};

export type WorkspaceSnapshotEntry = {
  id: string;
  message: string;
  createdAt: string;
  fileCount: number;
  sizeBytes: number;
};

export type WorkspaceOrderPosition = 'before' | 'after';

type BrowserCatalogEntry = Omit<WorkspaceCatalogEntry, 'status'>;
type BrowserCatalog = { version: 1; activeWorkspaceId: string; entries: BrowserCatalogEntry[] };
type BrowserTrashFiles = { workspaceId: string; deletedAt: number; primary?: string; backup?: string; metadata?: string };
type BrowserSnapshotFile = Omit<WorkspaceSnapshotEntry, 'sizeBytes'> & { version: 1; workspaceId: string; workspace: Workspace };

const isWorkspaceEnvelope = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return candidate.format === 'brunomnia' && Array.isArray(candidate.collections);
};

export const createBlankWorkspace = (name: string, preferences: AppPreferences): Workspace => {
  const workspace = cloneSeedWorkspace();
  return {
    ...workspace,
    name: name.trim().slice(0, 200) || 'Untitled Project',
    activeRequestId: '',
    activeEnvironmentId: '',
    collections: [],
    environments: [],
    history: [],
    apiDesigns: [],
    mockServers: [],
    testSuites: [],
    unitTestResults: [],
    runnerReports: [],
    imports: [],
    cookies: [],
    fileState: {},
    responses: [],
    streamSessions: [],
    mcpSessions: [],
    responseFilters: {},
    project: { mode: 'local', path: '', remoteUrl: '', remoteName: 'origin', authorName: '', authorEmail: '', autoSave: true, gitCredentialId: '' },
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
  copy.project = { mode: 'local', path: '', remoteUrl: '', remoteName: 'origin', authorName: '', authorEmail: '', autoSave: true, gitCredentialId: '' };
  copy.collaboration = { mode: 'off', path: '', actor: copy.collaboration.actor || 'Local owner', revision: 0 };
  if (copy.konnect.managedControlPlaneId) copy.konnect = {
    ...copy.konnect,
    enabled: false,
    token: '',
    managedByWorkspaceId: undefined,
    managedControlPlaneId: undefined,
    managedRegion: undefined,
    managedClusterType: undefined,
    managedDeploymentType: undefined,
  };
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

const parseBrowserWorkspace = (raw: string | null, workspaceId?: string): Workspace | undefined => {
  if (!raw) return undefined;
  try {
    const value: unknown = JSON.parse(raw);
    if (isWorkspaceEnvelope(value)) return migrateWorkspace(value);
    if (isWorkspacePhysicalManifest(value)) {
      if (workspaceId && value.records.some((reference) => !reference.key.startsWith(`brunomnia.project-file.${workspaceId}.`))) return undefined;
      return migrateWorkspace(assembleWorkspacePhysicalStore(value, (key) => {
        const stored = localStorage.getItem(key);
        return stored === null ? undefined : JSON.parse(stored);
      }));
    }
    return undefined;
  } catch {
    return undefined;
  }
};

const browserPhysicalRecordKeys = (raw: string | null, workspaceId?: string) => {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return isWorkspacePhysicalManifest(value)
      ? value.records.filter((reference) => !workspaceId || reference.key.startsWith(`brunomnia.project-file.${workspaceId}.`)).map((reference) => reference.key)
      : [];
  } catch {
    return [];
  }
};

const removeBrowserPhysicalRecords = (raw: string | null, workspaceId: string, retained = new Set<string>()) => {
  browserPhysicalRecordKeys(raw, workspaceId).filter((key) => !retained.has(key)).forEach((key) => localStorage.removeItem(key));
};

const writeBrowserWorkspace = (workspaceId: string, workspace: Workspace, rotate = false) => {
  const generation = crypto.randomUUID();
  const split = splitWorkspacePhysicalStore(workspace, (_scope, _id, index) => projectFileStorageKey(workspaceId, generation, index));
  const written: string[] = [];
  try {
    split.records.forEach(({ key, record }) => {
      localStorage.setItem(key, JSON.stringify(record));
      written.push(key);
    });
    const current = localStorage.getItem(projectStorageKey(workspaceId));
    if (rotate && parseBrowserWorkspace(current, workspaceId)) {
      const currentKeys = new Set(browserPhysicalRecordKeys(current, workspaceId));
      removeBrowserPhysicalRecords(localStorage.getItem(projectBackupStorageKey(workspaceId)), workspaceId, currentKeys);
      localStorage.setItem(projectBackupStorageKey(workspaceId), current!);
    }
    localStorage.setItem(projectStorageKey(workspaceId), JSON.stringify(split.manifest));
  } catch (error) {
    written.forEach((key) => localStorage.removeItem(key));
    throw error;
  }
};

const parseBrowserTrashKey = (key: string): { workspaceId: string; deletedAt: number; kind: 'workspace' | 'backup' | 'metadata' } | undefined => {
  const match = browserTrashKeyPattern.exec(key);
  if (!match) return undefined;
  const deletedAt = Number(match[2]);
  if (!Number.isSafeInteger(deletedAt) || deletedAt < 0) return undefined;
  return { workspaceId: match[1], deletedAt, kind: match[3] === 'backup' || match[3] === 'metadata' ? match[3] : 'workspace' };
};

const parseBrowserTrashMetadata = (raw: string | undefined, workspaceId: string): BrowserCatalogEntry | undefined => {
  if (!raw) return undefined;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object') return undefined;
    const entry = value as Record<string, unknown>;
    if (entry.id !== workspaceId || typeof entry.name !== 'string') return undefined;
    if (typeof entry.createdAt !== 'string' || entry.createdAt.length > 64) return undefined;
    if (typeof entry.updatedAt !== 'string' || entry.updatedAt.length > 64) return undefined;
    if (typeof entry.lastOpenedAt !== 'string' || entry.lastOpenedAt.length > 64) return undefined;
    return {
      id: workspaceId,
      name: entry.name.replace(/[\r\n\0]/g, ' ').trim().slice(0, 200) || 'Untitled Project',
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
      lastOpenedAt: entry.lastOpenedAt,
    };
  } catch {
    return undefined;
  }
};

const normalizeSnapshotMessage = (message: string) => message.replace(/[\r\n\0]/g, ' ').trim().slice(0, 200);

const parseBrowserSnapshotKey = (key: string): { workspaceId: string; snapshotId: string } | undefined => {
  const match = browserSnapshotKeyPattern.exec(key);
  return match ? { workspaceId: match[1], snapshotId: match[2] } : undefined;
};

const parseBrowserTrashSnapshotKey = (key: string): { workspaceId: string; deletedAt: number; snapshotId: string } | undefined => {
  const match = browserTrashSnapshotKeyPattern.exec(key);
  if (!match) return undefined;
  const deletedAt = Number(match[2]);
  if (!Number.isSafeInteger(deletedAt) || deletedAt < 0) return undefined;
  return { workspaceId: match[1], deletedAt, snapshotId: match[3] };
};

const parseBrowserSnapshotFile = (raw: string, workspaceId: string, snapshotId: string): BrowserSnapshotFile | undefined => {
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object') return undefined;
    const source = value as Record<string, unknown>;
    if (source.version !== 1 || source.id !== snapshotId || source.workspaceId !== workspaceId) return undefined;
    if (typeof source.message !== 'string' || !normalizeSnapshotMessage(source.message)) return undefined;
    if (typeof source.createdAt !== 'string' || source.createdAt.length > 64 || Number.isNaN(new Date(source.createdAt).getTime())) return undefined;
    if (!isWorkspaceEnvelope(source.workspace)) return undefined;
    const workspace = migrateWorkspace(source.workspace);
    return {
      version: 1,
      id: snapshotId,
      workspaceId,
      message: normalizeSnapshotMessage(source.message),
      createdAt: source.createdAt,
      fileCount: listProjectWorkspaces(workspace).length,
      workspace,
    };
  } catch {
    return undefined;
  }
};

const browserWorkspaceSnapshots = (workspaceId: string) => {
  const snapshots: Array<{ key: string; raw: string; snapshot: BrowserSnapshotFile; sizeBytes: number }> = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    const parsed = key ? parseBrowserSnapshotKey(key) : undefined;
    if (!key || parsed?.workspaceId !== workspaceId) continue;
    const raw = localStorage.getItem(key);
    const snapshot = raw === null ? undefined : parseBrowserSnapshotFile(raw, workspaceId, parsed.snapshotId);
    if (raw !== null && snapshot) snapshots.push({ key, raw, snapshot, sizeBytes: new TextEncoder().encode(raw).byteLength });
  }
  return snapshots.sort((left, right) => right.snapshot.createdAt.localeCompare(left.snapshot.createdAt) || right.snapshot.id.localeCompare(left.snapshot.id));
};

const browserWorkspaceSnapshotKeys = (workspaceId: string) => {
  const keys: Array<{ key: string; snapshotId: string }> = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    const parsed = key ? parseBrowserSnapshotKey(key) : undefined;
    if (key && parsed?.workspaceId === workspaceId) keys.push({ key, snapshotId: parsed.snapshotId });
  }
  return keys;
};

const browserTrashSnapshotKeys = (workspaceId: string, deletedAt: number) => {
  const keys: Array<{ key: string; snapshotId: string }> = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    const parsed = key ? parseBrowserTrashSnapshotKey(key) : undefined;
    if (key && parsed?.workspaceId === workspaceId && parsed.deletedAt === deletedAt) keys.push({ key, snapshotId: parsed.snapshotId });
  }
  return keys;
};

const browserTrashEntries = (): WorkspaceTrashEntry[] => {
  const groups = new Map<string, BrowserTrashFiles>();
  const snapshotGroups = new Set<string>();
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    const parsedSnapshot = key ? parseBrowserTrashSnapshotKey(key) : undefined;
    if (parsedSnapshot) {
      const groupKey = `${parsedSnapshot.workspaceId}:${parsedSnapshot.deletedAt}`;
      snapshotGroups.add(groupKey);
      if (!groups.has(groupKey)) groups.set(groupKey, { workspaceId: parsedSnapshot.workspaceId, deletedAt: parsedSnapshot.deletedAt });
      continue;
    }
    const parsed = key ? parseBrowserTrashKey(key) : undefined;
    if (!key || !parsed) continue;
    const groupKey = `${parsed.workspaceId}:${parsed.deletedAt}`;
    const group = groups.get(groupKey) ?? { workspaceId: parsed.workspaceId, deletedAt: parsed.deletedAt };
    const value = localStorage.getItem(key);
    if (value !== null) {
      if (parsed.kind === 'backup') group.backup = value;
      else if (parsed.kind === 'metadata') group.metadata = value;
      else group.primary = value;
    }
    groups.set(groupKey, group);
  }
  return [...groups.values()]
    .map((group): WorkspaceTrashEntry => {
      const primary = parseBrowserWorkspace(group.primary ?? null, group.workspaceId);
      const backup = parseBrowserWorkspace(group.backup ?? null, group.workspaceId);
      const workspace = primary ?? backup;
      const metadata = parseBrowserTrashMetadata(group.metadata, group.workspaceId);
      return {
        workspaceId: group.workspaceId,
        name: metadata?.name ?? (workspace ? catalogName(workspace) : group.workspaceId),
        deletedAt: group.deletedAt,
        status: primary ? 'ready' : backup ? 'recoverable' : 'unavailable',
        hasBackup: group.backup !== undefined,
        hasVault: false,
        hasSnapshots: snapshotGroups.has(`${group.workspaceId}:${group.deletedAt}`),
      };
    })
    .sort((left, right) => right.deletedAt - left.deletedAt || left.workspaceId.localeCompare(right.workspaceId))
    .slice(0, maxTrashEntries);
};

const readBrowserWorkspace = (id: string): { workspace?: Workspace; status: WorkspaceCatalogEntry['status'] } => {
  const primary = parseBrowserWorkspace(localStorage.getItem(projectStorageKey(id)), id);
  if (primary) return { workspace: primary, status: 'ready' };
  const backup = parseBrowserWorkspace(localStorage.getItem(projectBackupStorageKey(id)), id);
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
    const workspace = legacy ?? createBlankWorkspace('Local Workspace', cloneSeedWorkspace().preferences);
    const id = legacy ? 'local-workspace' : catalogWorkspaceId();
    writeBrowserWorkspace(id, workspace);
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
      hasSnapshots: entry.hasSnapshots === true,
    }];
  }).sort((left, right) => right.deletedAt - left.deletedAt || left.workspaceId.localeCompare(right.workspaceId)).slice(0, maxTrashEntries);
};

const normalizeSnapshotEntries = (value: unknown): WorkspaceSnapshotEntry[] => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((candidate): WorkspaceSnapshotEntry[] => {
    if (!candidate || typeof candidate !== 'object') return [];
    const entry = candidate as Record<string, unknown>;
    if (typeof entry.id !== 'string' || !workspaceIdPattern.test(entry.id)) return [];
    if (typeof entry.message !== 'string' || !normalizeSnapshotMessage(entry.message)) return [];
    if (typeof entry.createdAt !== 'string' || entry.createdAt.length > 64 || Number.isNaN(new Date(entry.createdAt).getTime())) return [];
    if (typeof entry.fileCount !== 'number' || !Number.isSafeInteger(entry.fileCount) || entry.fileCount < 0) return [];
    if (typeof entry.sizeBytes !== 'number' || !Number.isSafeInteger(entry.sizeBytes) || entry.sizeBytes < 0) return [];
    return [{
      id: entry.id,
      message: normalizeSnapshotMessage(entry.message),
      createdAt: entry.createdAt,
      fileCount: entry.fileCount,
      sizeBytes: entry.sizeBytes,
    }];
  }).sort((left, right) => right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id)).slice(0, maxWorkspaceSnapshots);
};

export const loadWorkspaceCatalog = async (): Promise<WorkspaceCatalogSnapshot> => {
  if (isTauri()) {
    const snapshot = await invoke<Omit<WorkspaceCatalogSnapshot, 'workspace'> & { workspace: unknown }>('workspace_catalog_load', { defaultWorkspace: createBlankWorkspace('Local Workspace', cloneSeedWorkspace().preferences) });
    return normalizeCatalogSnapshot(snapshot);
  }
  return initializeBrowserCatalog();
};

export const listDeletedCatalogWorkspaces = async (): Promise<WorkspaceTrashEntry[]> => {
  if (isTauri()) return normalizeTrashEntries(await invoke('workspace_catalog_list_trash'));
  return browserTrashEntries();
};

export const listCatalogWorkspaceSnapshots = async (workspaceId: string): Promise<WorkspaceSnapshotEntry[]> => {
  if (!workspaceIdPattern.test(workspaceId)) throw new Error('The selected project ID is invalid.');
  if (isTauri()) return normalizeSnapshotEntries(await invoke('workspace_catalog_list_snapshots', { workspaceId }));
  const catalog = parseBrowserCatalog();
  if (!catalog?.entries.some((entry) => entry.id === workspaceId)) throw new Error('This local project no longer exists.');
  return browserWorkspaceSnapshots(workspaceId).slice(0, maxWorkspaceSnapshots).map(({ snapshot, sizeBytes }) => ({
    id: snapshot.id,
    message: snapshot.message,
    createdAt: snapshot.createdAt,
    fileCount: snapshot.fileCount,
    sizeBytes,
  }));
};

export const createCatalogWorkspaceSnapshot = async (workspaceId: string, message: string): Promise<WorkspaceSnapshotEntry> => {
  if (!workspaceIdPattern.test(workspaceId)) throw new Error('The selected project ID is invalid.');
  const normalizedMessage = normalizeSnapshotMessage(message);
  if (!normalizedMessage) throw new Error('A snapshot message is required.');
  if (isTauri()) {
    const [entry] = normalizeSnapshotEntries([await invoke('workspace_catalog_create_snapshot', { workspaceId, message: normalizedMessage })]);
    if (!entry) throw new Error('The native snapshot response was invalid.');
    return entry;
  }
  const catalog = parseBrowserCatalog();
  if (!catalog?.entries.some((entry) => entry.id === workspaceId)) throw new Error('This local project no longer exists.');
  const workspace = readBrowserWorkspace(workspaceId).workspace;
  if (!workspace) throw new Error('This local project and its backup are unreadable.');
  const id = `snapshot-${crypto.randomUUID()}`;
  const snapshot: BrowserSnapshotFile = {
    version: 1,
    id,
    workspaceId,
    message: normalizedMessage,
    createdAt: new Date().toISOString(),
    fileCount: listProjectWorkspaces(workspace).length,
    workspace,
  };
  const raw = JSON.stringify(snapshot);
  const sizeBytes = new TextEncoder().encode(raw).byteLength;
  if (sizeBytes > maxWorkspaceSnapshotBytes) throw new Error('The project snapshot exceeds the 100 MB storage limit.');
  localStorage.setItem(projectSnapshotStorageKey(workspaceId, id), raw);
  const snapshots = browserWorkspaceSnapshots(workspaceId);
  const retainedKeys = new Set(snapshots.slice(0, maxWorkspaceSnapshots).map((entry) => entry.key));
  browserWorkspaceSnapshotKeys(workspaceId).filter((entry) => !retainedKeys.has(entry.key)).forEach((entry) => localStorage.removeItem(entry.key));
  return { id, message: snapshot.message, createdAt: snapshot.createdAt, fileCount: snapshot.fileCount, sizeBytes };
};

export const restoreCatalogWorkspaceSnapshot = async (workspaceId: string, snapshotId: string): Promise<WorkspaceCatalogSnapshot> => {
  if (!workspaceIdPattern.test(workspaceId) || !workspaceIdPattern.test(snapshotId)) throw new Error('The project snapshot selection is invalid.');
  if (isTauri()) {
    const snapshot = await invoke<Omit<WorkspaceCatalogSnapshot, 'workspace'> & { workspace: unknown }>('workspace_catalog_restore_snapshot', { workspaceId, snapshotId });
    return normalizeCatalogSnapshot(snapshot);
  }
  const raw = localStorage.getItem(projectSnapshotStorageKey(workspaceId, snapshotId));
  const snapshot = raw === null ? undefined : parseBrowserSnapshotFile(raw, workspaceId, snapshotId);
  if (!snapshot) throw new Error('This project snapshot is invalid or no longer exists.');
  await saveCatalogWorkspace(workspaceId, snapshot.workspace);
  return openCatalogWorkspace(workspaceId);
};

export const saveCatalogWorkspace = async (workspaceId: string, workspace: Workspace): Promise<void> => {
  if (!workspaceIdPattern.test(workspaceId)) throw new Error('The active project ID is invalid.');
  if (isTauri()) {
    await invoke('workspace_catalog_save', { workspaceId, workspace });
    return;
  }
  const catalog = parseBrowserCatalog();
  if (!catalog?.entries.some((entry) => entry.id === workspaceId)) throw new Error('This local project no longer exists.');
  writeBrowserWorkspace(workspaceId, workspace, true);
  const now = catalogNow();
  catalog.entries = catalog.entries.map((entry) => entry.id === workspaceId ? { ...entry, name: catalogName(workspace), updatedAt: now } : entry);
  writeBrowserCatalog(catalog);
};

export const getCatalogWorkspaceCliPath = async (workspaceId: string): Promise<string> => {
  if (!workspaceIdPattern.test(workspaceId)) throw new Error('The active project ID is invalid.');
  if (!isTauri()) throw new Error('Browser-local projects do not have a CLI-readable filesystem path.');
  return invoke<string>('workspace_catalog_cli_path', { workspaceId });
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

export const listCatalogProjectWorkspaces = async (workspaceId: string): Promise<ProjectWorkspaceSummary[]> => listProjectWorkspaces(await readCatalogWorkspace(workspaceId));

export const duplicateCatalogProjectWorkspace = async (
  sourceWorkspaceId: string,
  projectWorkspaceId: string,
  targetWorkspaceId: string,
  name: string,
): Promise<WorkspaceCatalogSnapshot> => {
  if (!workspaceIdPattern.test(sourceWorkspaceId) || !workspaceIdPattern.test(targetWorkspaceId)) throw new Error('The project file copy selection is invalid.');
  const source = await readCatalogWorkspace(sourceWorkspaceId);
  const target = sourceWorkspaceId === targetWorkspaceId ? source : await readCatalogWorkspace(targetWorkspaceId);
  const duplicated = duplicateProjectWorkspace(source, target, projectWorkspaceId, name);
  await saveCatalogWorkspace(targetWorkspaceId, duplicated.workspace);
  return openCatalogWorkspace(targetWorkspaceId);
};

export const moveCatalogProjectWorkspace = async (
  sourceWorkspaceId: string,
  projectWorkspaceId: string,
  targetWorkspaceId: string,
): Promise<WorkspaceCatalogSnapshot> => {
  if (!workspaceIdPattern.test(sourceWorkspaceId) || !workspaceIdPattern.test(targetWorkspaceId)) throw new Error('The project file move selection is invalid.');
  if (sourceWorkspaceId === targetWorkspaceId) throw new Error('Choose a different destination project to move this file.');
  const source = await readCatalogWorkspace(sourceWorkspaceId);
  const target = await readCatalogWorkspace(targetWorkspaceId);
  const moved = moveProjectWorkspace(source, target, projectWorkspaceId);
  try {
    await saveCatalogWorkspace(targetWorkspaceId, moved.target);
  } catch (error) {
    try {
      await saveCatalogWorkspace(targetWorkspaceId, target);
    } catch (rollbackError) {
      throw new Error(`The file move failed and destination rollback also failed: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`);
    }
    throw error;
  }
  try {
    await saveCatalogWorkspace(sourceWorkspaceId, moved.source);
  } catch (error) {
    const rollbacks = await Promise.allSettled([
      saveCatalogWorkspace(sourceWorkspaceId, source),
      saveCatalogWorkspace(targetWorkspaceId, target),
    ]);
    const rollbackFailure = rollbacks.find((result) => result.status === 'rejected');
    if (rollbackFailure?.status === 'rejected') throw new Error(`The file move failed and catalog rollback also failed: ${rollbackFailure.reason instanceof Error ? rollbackFailure.reason.message : String(rollbackFailure.reason)}`);
    throw error;
  }
  return openCatalogWorkspace(targetWorkspaceId);
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
  if (browserWorkspaceSnapshotKeys(workspaceId).length) throw new Error('Existing local snapshot history conflicts with this project ID.');
  writeBrowserWorkspace(workspaceId, workspace);
  catalog.entries.push(browserCatalogEntry(workspaceId, workspace));
  catalog.activeWorkspaceId = workspaceId;
  return browserSnapshot(catalog);
};

export const createCatalogWorkspaceInactive = async (workspace: Workspace, workspaceId = catalogWorkspaceId()): Promise<WorkspaceCatalogSnapshot> => {
  if (!workspaceIdPattern.test(workspaceId)) throw new Error('The new project ID is invalid.');
  if (isTauri()) {
    const snapshot = await invoke<Omit<WorkspaceCatalogSnapshot, 'workspace'> & { workspace: unknown }>('workspace_catalog_create_inactive', { workspaceId, workspace });
    return normalizeCatalogSnapshot(snapshot);
  }
  const catalog = parseBrowserCatalog() ?? { version: 1 as const, activeWorkspaceId: '', entries: [] };
  if (catalog.entries.length >= maxCatalogWorkspaces) throw new Error(`At most ${maxCatalogWorkspaces} local projects can be stored.`);
  if (catalog.entries.some((entry) => entry.id === workspaceId)) throw new Error('A local project with this ID already exists.');
  if (browserWorkspaceSnapshotKeys(workspaceId).length) throw new Error('Existing local snapshot history conflicts with this project ID.');
  writeBrowserWorkspace(workspaceId, workspace);
  catalog.entries.push(browserCatalogEntry(workspaceId, workspace));
  if (!catalog.activeWorkspaceId) catalog.activeWorkspaceId = workspaceId;
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
  const metadata = catalog.entries[index];
  const primary = localStorage.getItem(projectStorageKey(workspaceId));
  const backup = localStorage.getItem(projectBackupStorageKey(workspaceId));
  const snapshots = browserWorkspaceSnapshotKeys(workspaceId);
  localStorage.setItem(projectTrashStorageKey(workspaceId, suffix, 'metadata'), JSON.stringify(metadata));
  if (primary) localStorage.setItem(projectTrashStorageKey(workspaceId, suffix), primary);
  if (backup) localStorage.setItem(projectTrashStorageKey(workspaceId, suffix, 'backup'), backup);
  snapshots.forEach(({ key, snapshotId }) => {
    const raw = localStorage.getItem(key);
    if (raw !== null) localStorage.setItem(projectTrashSnapshotStorageKey(workspaceId, suffix, snapshotId), raw);
    localStorage.removeItem(key);
  });
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
  const backupKey = projectTrashStorageKey(workspaceId, deletedAt, 'backup');
  const metadataKey = projectTrashStorageKey(workspaceId, deletedAt, 'metadata');
  const primaryRaw = localStorage.getItem(primaryKey);
  const backupRaw = localStorage.getItem(backupKey);
  const metadataRaw = localStorage.getItem(metadataKey) ?? undefined;
  const trashedSnapshots = browserTrashSnapshotKeys(workspaceId, deletedAt);
  const primary = parseBrowserWorkspace(primaryRaw, workspaceId);
  const backup = parseBrowserWorkspace(backupRaw, workspaceId);
  const metadata = parseBrowserTrashMetadata(metadataRaw, workspaceId);
  const workspace = primary ?? backup;
  if (!workspace) throw new Error('This deleted project does not contain a valid workspace or backup.');
  if (browserWorkspaceSnapshotKeys(workspaceId).length) throw new Error('Existing local snapshot history conflicts with this deleted project restore.');

  if (primaryRaw && !primary) localStorage.setItem(`brunomnia.recovery.${workspaceId}.${deletedAt}.deleted-workspace.invalid.v1`, primaryRaw);
  if (backupRaw && !backup) localStorage.setItem(`brunomnia.recovery.${workspaceId}.${deletedAt}.deleted-backup.invalid.v1`, backupRaw);
  if (metadataRaw && !metadata) localStorage.setItem(`brunomnia.recovery.${workspaceId}.${deletedAt}.deleted-metadata.invalid.v1`, metadataRaw);
  if (primary) localStorage.setItem(projectStorageKey(workspaceId), primaryRaw!);
  else localStorage.setItem(projectStorageKey(workspaceId), backupRaw!);
  if (backup) localStorage.setItem(projectBackupStorageKey(workspaceId), backupRaw!);
  catalog.entries.push(metadata ? { ...metadata, name: catalogName(workspace) } : browserCatalogEntry(workspaceId, workspace));
  catalog.activeWorkspaceId = workspaceId;
  trashedSnapshots.forEach(({ key, snapshotId }) => {
    const raw = localStorage.getItem(key);
    if (raw !== null) localStorage.setItem(projectSnapshotStorageKey(workspaceId, snapshotId), raw);
    localStorage.removeItem(key);
  });
  const snapshot = browserSnapshot(catalog);
  localStorage.removeItem(primaryKey);
  localStorage.removeItem(backupKey);
  localStorage.removeItem(metadataKey);
  return snapshot;
};

export const purgeDeletedCatalogWorkspace = async (workspaceId: string, deletedAt: number): Promise<void> => {
  if (!workspaceIdPattern.test(workspaceId)) throw new Error('The deleted project ID is invalid.');
  if (!Number.isSafeInteger(deletedAt) || deletedAt < 0) throw new Error('The deleted-project recovery timestamp is invalid.');
  if (isTauri()) {
    await invoke('workspace_catalog_purge_trash', { workspaceId, deletedAt });
    return;
  }
  const keys = [
    projectTrashStorageKey(workspaceId, deletedAt),
    projectTrashStorageKey(workspaceId, deletedAt, 'backup'),
    projectTrashStorageKey(workspaceId, deletedAt, 'metadata'),
    ...browserTrashSnapshotKeys(workspaceId, deletedAt).map((entry) => entry.key),
  ].filter((key) => localStorage.getItem(key) !== null);
  if (!keys.length) throw new Error('This deleted-project recovery copy no longer exists.');
  const retained = new Set<string>();
  keys.forEach((key) => browserPhysicalRecordKeys(localStorage.getItem(key), workspaceId).forEach((recordKey) => retained.add(recordKey)));
  keys.forEach((key) => localStorage.removeItem(key));
  retained.forEach((key) => localStorage.removeItem(key));
};

export const emptyDeletedCatalogWorkspaces = async (): Promise<void> => {
  if (isTauri()) {
    await invoke('workspace_catalog_empty_trash');
    return;
  }
  const keys: string[] = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key && (parseBrowserTrashKey(key) || parseBrowserTrashSnapshotKey(key))) keys.push(key);
  }
  const physicalKeys = new Set<string>();
  keys.forEach((key) => {
    const workspaceId = parseBrowserTrashKey(key)?.workspaceId;
    browserPhysicalRecordKeys(localStorage.getItem(key), workspaceId).forEach((recordKey) => physicalKeys.add(recordKey));
  });
  keys.forEach((key) => localStorage.removeItem(key));
  physicalKeys.forEach((key) => localStorage.removeItem(key));
};

export const restoreCatalogWorkspaceBackup = async (workspaceId: string): Promise<WorkspaceCatalogSnapshot> => {
  if (!workspaceIdPattern.test(workspaceId)) throw new Error('The selected project ID is invalid.');
  if (isTauri()) {
    const snapshot = await invoke<Omit<WorkspaceCatalogSnapshot, 'workspace'> & { workspace: unknown }>('workspace_catalog_restore_backup', { workspaceId });
    return normalizeCatalogSnapshot(snapshot);
  }
  const backup = localStorage.getItem(projectBackupStorageKey(workspaceId));
  if (!parseBrowserWorkspace(backup, workspaceId)) throw new Error('This project does not have a valid backup to restore.');
  const invalid = localStorage.getItem(projectStorageKey(workspaceId));
  if (invalid) localStorage.setItem(`brunomnia.recovery.${workspaceId}.${Date.now()}.invalid.v1`, invalid);
  localStorage.setItem(projectStorageKey(workspaceId), backup!);
  return openCatalogWorkspace(workspaceId);
};
