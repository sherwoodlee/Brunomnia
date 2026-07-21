import type {
  AuthConfig,
  CollaborationCommit,
  CollaborationRepository,
  CollaborationResource,
  CollaborationResourceKind,
  JsonValue,
  McpClient,
  Workspace,
} from '../types';
import { collectionWithoutPrivateEnvironments } from './environmentSecrets';
import { mergeLocalOAuth2RuntimeCredentials } from './oauth2Tokens';
import { publicEnvironments } from './resources';

const MAX_BRANCHES_PER_RESOURCE = 50;
const MAX_COMMITS_PER_RESOURCE = 200;
const branchNamePattern = /^[A-Za-z0-9](?:[A-Za-z0-9._/-]{0,98}[A-Za-z0-9])?$/;

const json = (value: unknown): JsonValue => JSON.parse(JSON.stringify(value)) as JsonValue;
const equal = (left: JsonValue | undefined, right: JsonValue | undefined) => JSON.stringify(left) === JSON.stringify(right);
const record = (value: JsonValue | undefined): Record<string, JsonValue> | undefined => value && typeof value === 'object' && !Array.isArray(value) ? value : undefined;
const resourceKey = (kind: CollaborationResourceKind, id: string) => `${kind}:${id}`;

const clearOAuthRuntime = (auth: AuthConfig): AuthConfig => auth.type === 'oauth2' ? {
  ...auth,
  code: '',
  codeVerifier: '',
  accessToken: '',
  identityToken: '',
  refreshToken: '',
  expiresAt: 0,
} : auth;

const shareableCollection = (workspace: Workspace, id: string) => {
  const collection = workspace.collections.find((candidate) => candidate.id === id);
  if (!collection) throw new Error(`Collaboration resource '${resourceKey('collection', id)}' no longer exists.`);
  const sanitized = collectionWithoutPrivateEnvironments(collection);
  return {
    collection: {
      ...sanitized,
      requests: sanitized.requests.map((request) => ({ ...request, auth: clearOAuthRuntime(request.auth) })),
      folders: (sanitized.folders ?? []).map((folder) => ({ ...folder, auth: folder.auth ? clearOAuthRuntime(folder.auth) : undefined })),
    },
    testSuites: workspace.testSuites.filter((suite) => suite.collectionId === id),
  };
};

const shareableMcpClient = (client: McpClient): McpClient => ({
  ...client,
  token: client.authType === 'oauth2' ? '' : client.token,
  oauthRefreshToken: '',
  oauthIdentityToken: '',
  oauthExpiresAt: 0,
  oauthRegisteredClientId: '',
  oauthRegisteredClientSecret: '',
  oauthRegisteredClientIdIssuedAt: 0,
  oauthRegisteredClientSecretExpiresAt: 0,
  oauthRegisteredTokenEndpointAuthMethod: 'none',
});

const environmentBranch = (workspace: Workspace, id: string) => {
  const environments = publicEnvironments(workspace.environments);
  const selected = new Set([id]);
  let changed = true;
  while (changed) {
    changed = false;
    environments.forEach((environment) => {
      if (environment.parentId && selected.has(environment.parentId) && !selected.has(environment.id)) {
        selected.add(environment.id);
        changed = true;
      }
    });
  }
  const branch = environments.filter((environment) => selected.has(environment.id));
  if (!branch.some((environment) => environment.id === id)) throw new Error(`Collaboration resource '${resourceKey('environment', id)}' no longer exists.`);
  return branch;
};

export const emptyCollaborationRepository = (): CollaborationRepository => ({
  version: 1,
  activeBranches: {},
  branches: [],
  commits: [],
});

export const collaborationResources = (workspace: Workspace): CollaborationResource[] => {
  const environments = publicEnvironments(workspace.environments);
  const environmentIds = new Set(environments.map((environment) => environment.id));
  return [
    ...workspace.collections.map((collection) => ({ key: resourceKey('collection', collection.id), kind: 'collection' as const, id: collection.id, name: collection.name })),
    ...environments.filter((environment) => !environment.parentId || !environmentIds.has(environment.parentId)).map((environment) => ({ key: resourceKey('environment', environment.id), kind: 'environment' as const, id: environment.id, name: environment.name })),
    ...workspace.apiDesigns.map((design) => ({ key: resourceKey('api-design', design.id), kind: 'api-design' as const, id: design.id, name: design.name })),
    ...workspace.mockServers.map((server) => ({ key: resourceKey('mock-server', server.id), kind: 'mock-server' as const, id: server.id, name: server.name })),
    ...workspace.mcpClients.map((client) => ({ key: resourceKey('mcp-client', client.id), kind: 'mcp-client' as const, id: client.id, name: client.name })),
  ];
};

export const collaborationResourceSnapshot = (workspace: Workspace, key: string): JsonValue => {
  const resource = collaborationResources(workspace).find((candidate) => candidate.key === key);
  if (!resource) throw new Error(`Collaboration resource '${key}' no longer exists.`);
  if (resource.kind === 'collection') return json(shareableCollection(workspace, resource.id));
  if (resource.kind === 'environment') return json({ environments: environmentBranch(workspace, resource.id) });
  if (resource.kind === 'api-design') return json({ apiDesign: workspace.apiDesigns.find((candidate) => candidate.id === resource.id) });
  if (resource.kind === 'mock-server') return json({ mockServer: workspace.mockServers.find((candidate) => candidate.id === resource.id) });
  return json({ mcpClient: shareableMcpClient(workspace.mcpClients.find((candidate) => candidate.id === resource.id)!) });
};

export const applyCollaborationSnapshot = (workspace: Workspace, resourceKeyValue: string, snapshot: JsonValue): Workspace => {
  const separator = resourceKeyValue.indexOf(':');
  const kind = resourceKeyValue.slice(0, separator) as CollaborationResourceKind;
  const id = resourceKeyValue.slice(separator + 1);
  const source = record(snapshot);
  if (!separator || !source) throw new Error('The collaboration snapshot is malformed.');
  if (kind === 'collection') {
    const collection = source.collection;
    const testSuites = source.testSuites;
    if (!collection || typeof collection !== 'object' || Array.isArray(collection) || !Array.isArray(testSuites)) throw new Error('The collection snapshot is malformed.');
    const next = json(collection) as unknown as Workspace['collections'][number];
    if (next.id !== id) throw new Error('The collection snapshot identity does not match its resource.');
    return mergeLocalOAuth2RuntimeCredentials(workspace, {
      ...workspace,
      collections: workspace.collections.map((candidate) => candidate.id === id ? next : candidate),
      testSuites: [...workspace.testSuites.filter((suite) => suite.collectionId !== id), ...(json(testSuites) as unknown as Workspace['testSuites'])],
    });
  }
  if (kind === 'environment') {
    if (!Array.isArray(source.environments)) throw new Error('The environment snapshot is malformed.');
    const incoming = json(source.environments) as unknown as Workspace['environments'];
    if (!incoming.some((environment) => environment.id === id)) throw new Error('The environment snapshot identity does not match its resource.');
    const currentBranchIds = new Set(environmentBranch(workspace, id).map((environment) => environment.id));
    return { ...workspace, environments: [...workspace.environments.filter((environment) => !currentBranchIds.has(environment.id)), ...incoming] };
  }
  const field = kind === 'api-design' ? 'apiDesign' : kind === 'mock-server' ? 'mockServer' : kind === 'mcp-client' ? 'mcpClient' : '';
  const value = field ? source[field] : undefined;
  if (!value || typeof value !== 'object' || Array.isArray(value) || value.id !== id) throw new Error('The collaboration snapshot identity does not match its resource.');
  if (kind === 'api-design') return { ...workspace, apiDesigns: workspace.apiDesigns.map((candidate) => candidate.id === id ? json(value) as unknown as Workspace['apiDesigns'][number] : candidate) };
  if (kind === 'mock-server') return { ...workspace, mockServers: workspace.mockServers.map((candidate) => candidate.id === id ? json(value) as unknown as Workspace['mockServers'][number] : candidate) };
  if (kind === 'mcp-client') return mergeLocalOAuth2RuntimeCredentials(workspace, { ...workspace, mcpClients: workspace.mcpClients.map((candidate) => candidate.id === id ? json(value) as unknown as McpClient : candidate) });
  throw new Error(`Collaboration resource '${resourceKeyValue}' is not supported.`);
};

export const activeCollaborationBranch = (repository: CollaborationRepository, key: string) => repository.activeBranches[key] || 'main';
export const collaborationBranches = (repository: CollaborationRepository, key: string) => repository.branches.filter((branch) => branch.resourceKey === key);
export const collaborationCommits = (repository: CollaborationRepository, key: string, branch?: string) => repository.commits
  .filter((commit) => commit.resourceKey === key && (!branch || commit.branch === branch))
  .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));

const branchHead = (repository: CollaborationRepository, key: string, branch = activeCollaborationBranch(repository, key)) => {
  const ref = repository.branches.find((candidate) => candidate.resourceKey === key && candidate.name === branch);
  return ref?.headCommitId ? repository.commits.find((commit) => commit.id === ref.headCommitId) : undefined;
};

export const dirtyCollaborationResources = (workspace: Workspace, repository: CollaborationRepository) => collaborationResources(workspace)
  .filter((resource) => !equal(collaborationResourceSnapshot(workspace, resource.key), branchHead(repository, resource.key)?.snapshot))
  .map((resource) => resource.key);

const pruneCommits = (repository: CollaborationRepository, key: string) => {
  const selected = collaborationCommits(repository, key).slice(0, MAX_COMMITS_PER_RESOURCE);
  const retained = new Set(selected.map((commit) => commit.id));
  return { ...repository, commits: repository.commits.filter((commit) => commit.resourceKey !== key || retained.has(commit.id)) };
};

export const commitCollaborationResources = (
  workspace: Workspace,
  repository: CollaborationRepository,
  keys: string[],
  actor: string,
  message: string,
  now = () => new Date().toISOString(),
  identifier = () => `sync-commit-${crypto.randomUUID()}`,
) => {
  const trimmedMessage = message.trim();
  if (!trimmedMessage) throw new Error('Enter a collaboration commit message.');
  let next = structuredClone(repository);
  const committed: CollaborationCommit[] = [];
  for (const key of [...new Set(keys)].slice(0, 100)) {
    const snapshot = collaborationResourceSnapshot(workspace, key);
    const branch = activeCollaborationBranch(next, key);
    let ref = next.branches.find((candidate) => candidate.resourceKey === key && candidate.name === branch);
    const head = ref?.headCommitId ? next.commits.find((candidate) => candidate.id === ref!.headCommitId) : undefined;
    if (equal(snapshot, head?.snapshot)) continue;
    const createdAt = now();
    const commit: CollaborationCommit = { id: identifier(), resourceKey: key, branch, parentId: head?.id ?? '', actor: actor.trim(), message: trimmedMessage.slice(0, 1_000), createdAt, snapshot };
    next.commits.push(commit);
    if (ref) Object.assign(ref, { headCommitId: commit.id, updatedAt: createdAt });
    else {
      ref = { resourceKey: key, name: branch, headCommitId: commit.id, createdAt, updatedAt: createdAt };
      next.branches.push(ref);
      next.activeBranches[key] = branch;
    }
    next = pruneCommits(next, key);
    committed.push(commit);
  }
  return { repository: next, committed };
};

export const createCollaborationBranch = (repository: CollaborationRepository, key: string, name: string, now = () => new Date().toISOString()) => {
  const branchName = name.trim();
  if (!branchNamePattern.test(branchName) || branchName.includes('..') || branchName.includes('//')) throw new Error('Branch names must be 1-100 safe letters, numbers, dots, slashes, underscores, or dashes.');
  if (collaborationBranches(repository, key).some((branch) => branch.name.toLowerCase() === branchName.toLowerCase())) throw new Error(`Branch '${branchName}' already exists for this resource.`);
  if (collaborationBranches(repository, key).length >= MAX_BRANCHES_PER_RESOURCE) throw new Error(`A resource can retain at most ${MAX_BRANCHES_PER_RESOURCE} branches.`);
  const createdAt = now();
  const headCommitId = branchHead(repository, key)?.id ?? '';
  return {
    ...structuredClone(repository),
    activeBranches: { ...repository.activeBranches, [key]: branchName },
    branches: [...repository.branches, { resourceKey: key, name: branchName, headCommitId, createdAt, updatedAt: createdAt }],
  };
};

export const checkoutCollaborationBranch = (workspace: Workspace, repository: CollaborationRepository, key: string, name: string) => {
  const branch = repository.branches.find((candidate) => candidate.resourceKey === key && candidate.name === name);
  if (!branch) throw new Error(`Branch '${name}' does not exist for this resource.`);
  const head = branch.headCommitId ? repository.commits.find((commit) => commit.id === branch.headCommitId) : undefined;
  return {
    workspace: head ? applyCollaborationSnapshot(workspace, key, head.snapshot) : workspace,
    repository: { ...structuredClone(repository), activeBranches: { ...repository.activeBranches, [key]: name } },
  };
};

export const deleteCollaborationBranch = (repository: CollaborationRepository, key: string, name: string) => {
  if (name === 'main') throw new Error('The main collaboration branch cannot be deleted.');
  if (activeCollaborationBranch(repository, key) === name) throw new Error('Check out another branch before deleting the active branch.');
  if (!repository.branches.some((branch) => branch.resourceKey === key && branch.name === name)) throw new Error(`Branch '${name}' does not exist for this resource.`);
  return { ...structuredClone(repository), branches: repository.branches.filter((branch) => branch.resourceKey !== key || branch.name !== name) };
};

const parentIds = (commit: CollaborationCommit | undefined) => commit ? [commit.parentId, commit.mergeParentId].filter((value): value is string => Boolean(value)) : [];
const ancestorDistances = (repository: CollaborationRepository, startId: string) => {
  const distances = new Map<string, number>();
  const queue: Array<[string, number]> = startId ? [[startId, 0]] : [];
  while (queue.length) {
    const [id, distance] = queue.shift()!;
    if (distances.has(id)) continue;
    distances.set(id, distance);
    const commit = repository.commits.find((candidate) => candidate.id === id);
    parentIds(commit).forEach((parent) => queue.push([parent, distance + 1]));
  }
  return distances;
};

const pointer = (path: string, key: string) => `${path}/${key.replace(/~/g, '~0').replace(/\//g, '~1')}`;

export type CollaborationMergeConflict = { path: string; base?: JsonValue; mine?: JsonValue; theirs?: JsonValue };
export type CollaborationMergePlan = {
  resourceKey: string;
  targetBranch: string;
  sourceBranch: string;
  targetHeadId: string;
  sourceHeadId: string;
  baseCommitId: string;
  mergedSnapshot: JsonValue;
  conflicts: CollaborationMergeConflict[];
};

const mergeValue = (base: JsonValue | undefined, mine: JsonValue | undefined, theirs: JsonValue | undefined, path: string, conflicts: CollaborationMergeConflict[]): JsonValue | undefined => {
  if (equal(mine, theirs)) return mine === undefined ? undefined : json(mine);
  if (equal(mine, base)) return theirs === undefined ? undefined : json(theirs);
  if (equal(theirs, base)) return mine === undefined ? undefined : json(mine);
  const baseRecord = record(base);
  const mineRecord = record(mine);
  const theirsRecord = record(theirs);
  if (mineRecord && theirsRecord && (baseRecord || base === undefined)) {
    const output: Record<string, JsonValue> = {};
    const keys = new Set([...Object.keys(baseRecord ?? {}), ...Object.keys(mineRecord), ...Object.keys(theirsRecord)]);
    keys.forEach((key) => {
      const merged = mergeValue(baseRecord?.[key], mineRecord[key], theirsRecord[key], pointer(path, key), conflicts);
      if (merged !== undefined) output[key] = merged;
    });
    return output;
  }
  conflicts.push({ path: path || '/', base, mine, theirs });
  return mine === undefined ? undefined : json(mine);
};

export const planCollaborationBranchMerge = (repository: CollaborationRepository, key: string, sourceBranch: string): CollaborationMergePlan => {
  const targetBranch = activeCollaborationBranch(repository, key);
  if (sourceBranch === targetBranch) throw new Error('Choose another branch to merge.');
  const mine = branchHead(repository, key, targetBranch);
  const theirs = branchHead(repository, key, sourceBranch);
  if (!mine || !theirs) throw new Error('Both branches need at least one commit before merging.');
  const mineAncestors = ancestorDistances(repository, mine.id);
  const theirsAncestors = ancestorDistances(repository, theirs.id);
  const common = [...mineAncestors.keys()].filter((id) => theirsAncestors.has(id)).sort((left, right) => (mineAncestors.get(left)! + theirsAncestors.get(left)!) - (mineAncestors.get(right)! + theirsAncestors.get(right)!))[0] ?? '';
  const base = common ? repository.commits.find((commit) => commit.id === common) : undefined;
  const conflicts: CollaborationMergeConflict[] = [];
  const mergedSnapshot = mergeValue(base?.snapshot, mine.snapshot, theirs.snapshot, '', conflicts) ?? null;
  return { resourceKey: key, targetBranch, sourceBranch, targetHeadId: mine.id, sourceHeadId: theirs.id, baseCommitId: common, mergedSnapshot, conflicts };
};

const decodePointer = (path: string) => path === '/' ? [] : path.split('/').slice(1).map((part) => part.replace(/~1/g, '/').replace(/~0/g, '~'));
const setPointer = (source: JsonValue, path: string, value: JsonValue | undefined): JsonValue => {
  const parts = decodePointer(path);
  if (!parts.length) return value === undefined ? null : json(value);
  const output = json(source);
  let current = output as Record<string, JsonValue>;
  parts.slice(0, -1).forEach((part) => {
    const next = current[part];
    if (!next || typeof next !== 'object' || Array.isArray(next)) current[part] = {};
    current = current[part] as Record<string, JsonValue>;
  });
  const final = parts.at(-1)!;
  if (value === undefined) delete current[final];
  else current[final] = json(value);
  return output;
};

export const resolveCollaborationBranchMerge = (
  workspace: Workspace,
  repository: CollaborationRepository,
  plan: CollaborationMergePlan,
  resolutions: Record<string, 'mine' | 'theirs' | JsonValue>,
  actor: string,
  message: string,
  now = () => new Date().toISOString(),
  identifier = () => `sync-commit-${crypto.randomUUID()}`,
) => {
  let snapshot = plan.mergedSnapshot;
  plan.conflicts.forEach((conflict) => {
    const resolution = resolutions[conflict.path];
    if (resolution === undefined) throw new Error(`Resolve collaboration conflict '${conflict.path}' before merging.`);
    const value = resolution === 'mine' ? conflict.mine : resolution === 'theirs' ? conflict.theirs : resolution;
    snapshot = setPointer(snapshot, conflict.path, value);
  });
  const createdAt = now();
  const commit: CollaborationCommit = {
    id: identifier(), resourceKey: plan.resourceKey, branch: plan.targetBranch, parentId: plan.targetHeadId, mergeParentId: plan.sourceHeadId,
    actor: actor.trim(), message: message.trim() || `Merge ${plan.sourceBranch} into ${plan.targetBranch}`, createdAt, snapshot,
  };
  const next = structuredClone(repository);
  const branch = next.branches.find((candidate) => candidate.resourceKey === plan.resourceKey && candidate.name === plan.targetBranch);
  if (!branch || branch.headCommitId !== plan.targetHeadId) throw new Error('The target branch changed after the merge preview. Review it again.');
  next.commits.push(commit);
  branch.headCommitId = commit.id;
  branch.updatedAt = createdAt;
  return { workspace: applyCollaborationSnapshot(workspace, plan.resourceKey, snapshot), repository: pruneCommits(next, plan.resourceKey), commit };
};

export const restoreCollaborationCommit = (
  workspace: Workspace,
  repository: CollaborationRepository,
  commitId: string,
  actor: string,
  now = () => new Date().toISOString(),
  identifier = () => `sync-commit-${crypto.randomUUID()}`,
) => {
  const historical = repository.commits.find((commit) => commit.id === commitId);
  if (!historical) throw new Error('The selected collaboration commit no longer exists.');
  const activeBranch = activeCollaborationBranch(repository, historical.resourceKey);
  const head = branchHead(repository, historical.resourceKey, activeBranch);
  const createdAt = now();
  const commit: CollaborationCommit = {
    id: identifier(), resourceKey: historical.resourceKey, branch: activeBranch, parentId: head?.id ?? '', actor: actor.trim(),
    message: `Restore ${historical.message}`.slice(0, 1_000), createdAt, snapshot: json(historical.snapshot),
  };
  const next = structuredClone(repository);
  next.commits.push(commit);
  let branch = next.branches.find((candidate) => candidate.resourceKey === historical.resourceKey && candidate.name === activeBranch);
  if (branch) Object.assign(branch, { headCommitId: commit.id, updatedAt: createdAt });
  else {
    branch = { resourceKey: historical.resourceKey, name: activeBranch, headCommitId: commit.id, createdAt, updatedAt: createdAt };
    next.branches.push(branch);
  }
  return { workspace: applyCollaborationSnapshot(workspace, historical.resourceKey, historical.snapshot), repository: pruneCommits(next, historical.resourceKey), commit };
};
