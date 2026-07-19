import { invoke, isTauri } from '@tauri-apps/api/core';
import type { Workspace } from '../types';
import { migrateWorkspace } from './storage';
import { publicEnvironments } from './resources';
import { mergeLocalOAuth2RuntimeCredentials, withoutOAuth2RuntimeCredentials } from './oauth2Tokens';
import { emptyWorkspaceCertificates } from './certificates';

export type ProjectWriteResult = { path: string; filesWritten: number; filesUnchanged: number; filesRemoved: number };
export type GitFileStatus = { path: string; indexStatus: string; worktreeStatus: string; staged: boolean; conflicted: boolean };
export type GitRemote = { name: string; fetchUrl: string; pushUrl: string };
export type GitRemoteBranch = { remote: string; branch: string; trackingRef: string };
export type GitStatus = {
  branch: string;
  upstream: string;
  ahead: number;
  behind: number;
  canPush: boolean;
  files: GitFileStatus[];
  branches: string[];
  remoteBranches: GitRemoteBranch[];
  remotes: GitRemote[];
  mergeInProgress: boolean;
  rebaseInProgress: boolean;
};
export type GitOperation = { summary: string; stdout: string; stderr: string; status: GitStatus };
export type GitConflict = { path: string; base: string; ours: string; theirs: string; working: string; binary: boolean };
export type GitCommitSummary = { oid: string; shortOid: string; message: string; authorName: string; authorEmail: string; authoredAt: string; parents: string[]; refs: string[] };
export type GitCommitPatch = { oid: string; patch: string };
export type LocalPluginSource = { source: string; name: string; version: string; description: string; path: string };

const nativeOnly = () => {
  if (!isTauri()) throw new Error('Filesystem projects and Git operations are available in the Tauri desktop app.');
};

export const writeProject = async (path: string, workspace: Workspace) => {
  nativeOnly();
  const environments = publicEnvironments(workspace.environments);
  const projectWorkspace = withoutOAuth2RuntimeCredentials({ ...workspace, certificates: emptyWorkspaceCertificates(), environments, activeEnvironmentId: environments.some((environment) => environment.id === workspace.activeEnvironmentId) ? workspace.activeEnvironmentId : environments[0]?.id ?? '' });
  return invoke<ProjectWriteResult>('project_write', { input: { path, workspace: projectWorkspace } });
};

export const readProject = async (path: string, current: Workspace): Promise<Workspace> => {
  nativeOnly();
  const project = await invoke<Partial<Workspace>>('project_read', { path });
  const currentPublicIds = new Set(publicEnvironments(current.environments).map((environment) => environment.id));
  const privateEnvironments = current.environments.filter((environment) => !currentPublicIds.has(environment.id));
  const privateIds = new Set(privateEnvironments.map((environment) => environment.id));
  const projectEnvironments = publicEnvironments(project.environments ?? []).filter((environment) => !privateIds.has(environment.id));
  const merged = migrateWorkspace({
    ...current,
    ...project,
    format: 'brunomnia',
    version: 34,
    history: current.history,
    runnerReports: current.runnerReports,
    imports: current.imports,
    cookies: current.cookies,
    responses: current.responses,
    streamSessions: current.streamSessions,
    certificates: current.certificates,
    plugins: current.plugins,
    pluginData: current.pluginData,
    activePluginTheme: current.activePluginTheme,
    environments: [...projectEnvironments, ...privateEnvironments],
    activeEnvironmentId: privateEnvironments.some((environment) => environment.id === current.activeEnvironmentId) ? current.activeEnvironmentId : project.activeEnvironmentId ?? current.activeEnvironmentId,
    project: { ...current.project, mode: current.project.mode === 'git' ? 'git' : 'folder', path },
  });
  return mergeLocalOAuth2RuntimeCredentials(current, merged);
};

export const initGitProject = async (path: string, defaultBranch = 'main') => {
  nativeOnly();
  return invoke<GitStatus>('project_git_init', { path, defaultBranch });
};
export const cloneGitProject = async (remote: string, path: string) => {
  nativeOnly();
  return invoke<GitStatus>('project_git_clone', { remote, path });
};
export const getGitStatus = async (path: string) => {
  nativeOnly();
  return invoke<GitStatus>('project_git_status', { path });
};
export const stageGitFiles = async (path: string, paths: string[]) => invoke<GitStatus>('project_git_stage', { path, paths });
export const unstageGitFiles = async (path: string, paths: string[]) => invoke<GitStatus>('project_git_unstage', { path, paths });
export const discardGitFiles = async (path: string, paths: string[]) => invoke<GitStatus>('project_git_discard', { path, paths });
export const getGitDiff = async (path: string, staged: boolean) => invoke<string>('project_git_diff', { path, staged });
export const getGitFileDiff = async (path: string, staged: boolean, file: string) => invoke<string>('project_git_file_diff', { path, staged, file });
export const getGitHistory = async (path: string, limit = 35) => invoke<GitCommitSummary[]>('project_git_history', { path, limit });
export const getGitCommitPatch = async (path: string, oid: string) => invoke<GitCommitPatch>('project_git_commit_patch', { path, oid });
export const commitGitChanges = async (path: string, message: string, authorName: string, authorEmail: string) => invoke<GitOperation>('project_git_commit', { input: { path, message, authorName, authorEmail } });
export const checkoutGitBranch = async (path: string, branch: string, create = false) => invoke<GitOperation>('project_git_checkout', { path, branch, create });
export const deleteGitBranch = async (path: string, branch: string) => invoke<GitOperation>('project_git_delete_branch', { path, branch });
export const fetchGitRemote = async (path: string, remote: string) => invoke<GitOperation>('project_git_fetch', { path, remote });
export const checkoutGitRemoteBranch = async (path: string, remote: string, branch: string) => invoke<GitOperation>('project_git_checkout_remote', { path, remote, branch });
export const setGitRemote = async (path: string, name: string, url: string) => invoke<GitStatus>('project_git_set_remote', { path, name, url });
export const pullGitProject = async (path: string, remote: string, branch: string) => invoke<GitOperation>('project_git_pull', { input: { path, remote, branch } });
export const validateGitRemoteAccess = async (path: string, remote: string) => invoke<void>('project_git_validate_remote_access', { path, remote });
export const pushGitProject = async (path: string, remote: string, branch: string) => invoke<GitOperation>('project_git_push', { input: { path, remote, branch } });
export const mergeGitBranch = async (path: string, branch: string) => invoke<GitOperation>('project_git_merge', { path, branch });
export const abortGitMerge = async (path: string) => invoke<GitStatus>('project_git_abort_merge', { path });
export const getGitConflicts = async (path: string) => invoke<GitConflict[]>('project_git_conflicts', { path });
export const resolveGitConflict = async (path: string, file: string, contents: string) => invoke<GitStatus>('project_git_resolve_conflict', { path, file, contents });
export const resolveGitConflictSide = async (path: string, file: string, side: 'ours' | 'theirs') => invoke<GitStatus>('project_git_resolve_conflict_side', { path, file, side });
export const readLocalPluginSource = async (path: string) => {
  nativeOnly();
  return invoke<LocalPluginSource>('plugin_read_source', { path });
};
