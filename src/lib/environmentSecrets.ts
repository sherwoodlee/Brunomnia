import type { Collection, CollectionEnvironment, Environment, KeyValue, Workspace } from '../types';
import type { VaultEntry, VaultSession } from './security';

export const ENVIRONMENT_SECRET_KIND = 'environment' as const;
export const ENVIRONMENT_SECRET_NAME_PREFIX = '__brunomnia_environment__:';

export const isEnvironmentSecretEntry = (entry: VaultEntry) => entry.kind === ENVIRONMENT_SECRET_KIND && Boolean(entry.ownerId);

export const directVaultEntries = (entries: VaultEntry[]) => entries.filter((entry) => !isEnvironmentSecretEntry(entry));

export const environmentSecretEntryName = (ownerId: string) => `${ENVIRONMENT_SECRET_NAME_PREFIX}${ownerId}`;

export const environmentSecretValue = (entries: VaultEntry[], ownerId: string) => entries.find((entry) => isEnvironmentSecretEntry(entry) && entry.ownerId === ownerId)?.value ?? '';

export const upsertEnvironmentSecret = (
  entries: VaultEntry[],
  ownerId: string,
  value: string,
  createId: () => string = () => `environment-secret-${crypto.randomUUID()}`,
  updatedAt = new Date().toISOString(),
) => {
  const existing = entries.find((entry) => isEnvironmentSecretEntry(entry) && entry.ownerId === ownerId);
  const next: VaultEntry = {
    id: existing?.id ?? createId(),
    name: environmentSecretEntryName(ownerId),
    value,
    updatedAt,
    kind: ENVIRONMENT_SECRET_KIND,
    ownerId,
  };
  return existing
    ? entries.map((entry) => entry.id === existing.id ? next : entry)
    : [...entries, next];
};

export const removeEnvironmentSecrets = (entries: VaultEntry[], ownerIds: Iterable<string>) => {
  const removed = new Set(ownerIds);
  return entries.filter((entry) => !isEnvironmentSecretEntry(entry) || !removed.has(entry.ownerId ?? ''));
};

export const duplicateEnvironmentSecrets = (
  sourceRows: KeyValue[],
  targetRows: KeyValue[],
  entries: VaultEntry[],
  createId: () => string = () => `environment-secret-${crypto.randomUUID()}`,
) => sourceRows.reduce((next, source, index) => {
  const target = targetRows[index];
  if (source.valueType !== 'secret' || target?.valueType !== 'secret') return next;
  const sourceEntry = entries.find((entry) => isEnvironmentSecretEntry(entry) && entry.ownerId === source.id);
  return sourceEntry ? upsertEnvironmentSecret(next, target.id, sourceEntry.value, createId, sourceEntry.updatedAt) : next;
}, entries);

export const environmentSecretVariables = (rows: KeyValue[], session: VaultSession) => {
  if (!session.unlocked) return {};
  const values: Record<string, string> = {};
  rows.forEach((row) => {
    const name = row.name.trim();
    if (!name || !row.enabled || row.valueType !== 'secret') return;
    const entry = session.entries.find((candidate) => isEnvironmentSecretEntry(candidate) && candidate.ownerId === row.id);
    if (entry) values[`vault.${name}`] = entry.value;
  });
  return values;
};

export const environmentHasSecrets = (environment: Pick<Environment, 'variables'>) => environment.variables.some((row) => row.valueType === 'secret');

export const collectionEnvironmentHasSecrets = (environment: Pick<CollectionEnvironment, 'variables'>) => environment.variables.some((row) => row.valueType === 'secret');

export const collectionEnvironmentSecretVariables = (collection: Collection | undefined, session: VaultSession) => {
  const selected = collection?.subEnvironments?.find((environment) => environment.id === collection.activeSubEnvironmentId && environment.private === true);
  return selected ? environmentSecretVariables(selected.variables, session) : {};
};

export const collectionWithoutPrivateEnvironments = (collection: Collection, includePrivate = false): Collection => {
  const subEnvironments = (collection.subEnvironments ?? [])
    .filter((environment) => includePrivate || environment.private !== true)
    .map((environment) => ({
      ...environment,
      variables: environment.variables.filter((row) => row.valueType !== 'secret'),
    }));
  return {
    ...collection,
    subEnvironments,
    activeSubEnvironmentId: subEnvironments.some((environment) => environment.id === collection.activeSubEnvironmentId)
      ? collection.activeSubEnvironmentId
      : '',
  };
};

export const mergePrivateCollectionEnvironments = (current: Collection[], shared: Collection[]): Collection[] => shared.map((collection) => {
  const local = current.find((candidate) => candidate.id === collection.id);
  if (!local) return collectionWithoutPrivateEnvironments(collection);
  const privateEnvironments = (local.subEnvironments ?? []).filter((environment) => environment.private === true);
  const privateIds = new Set(privateEnvironments.map((environment) => environment.id));
  const sharedEnvironments = (collection.subEnvironments ?? []).filter((environment) => environment.private !== true && !privateIds.has(environment.id));
  const subEnvironments = [...sharedEnvironments, ...privateEnvironments];
  const activeSubEnvironmentId = privateIds.has(local.activeSubEnvironmentId ?? '')
    ? local.activeSubEnvironmentId
    : sharedEnvironments.some((environment) => environment.id === collection.activeSubEnvironmentId)
      ? collection.activeSubEnvironmentId
      : '';
  return { ...collection, subEnvironments, activeSubEnvironmentId };
});

export const withoutEnvironmentSecrets = (workspace: Workspace): Workspace => ({
  ...workspace,
  collections: workspace.collections.map((collection) => ({
    ...collection,
    subEnvironments: (collection.subEnvironments ?? []).map((environment) => ({
      ...environment,
      variables: environment.variables.filter((row) => row.valueType !== 'secret'),
    })),
  })),
  environments: workspace.environments.map((environment) => ({
    ...environment,
    variables: environment.variables.filter((row) => row.valueType !== 'secret'),
  })),
});
