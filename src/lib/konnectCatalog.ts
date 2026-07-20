import type { Environment, KonnectControlPlane, Workspace } from '../types';
import type { SendRequestContext } from './http';
import {
  activeKonnectRegions,
  konnectConfigForRegion,
  loadKonnectControlPlaneResources,
  loadKonnectControlPlanesForRegion,
  reconcileKonnectResources,
  type KonnectSkippedRoute,
  type KonnectSyncCounts,
  zeroKonnectSyncCounts,
} from './konnect';
import {
  createBlankWorkspace,
  createCatalogWorkspaceInactive,
  deleteCatalogWorkspace,
  loadWorkspaceCatalog,
  readCatalogWorkspace,
  saveCatalogWorkspace,
  type WorkspaceCatalogSnapshot,
} from './workspaceCatalog';

export type ManagedKonnectProject = {
  workspaceId: string;
  controlPlaneId: string;
  region: string;
};

export type KonnectCatalogPlan = {
  upserts: Array<{ controlPlane: KonnectControlPlane; workspaceId?: string }>;
  deleteWorkspaceIds: string[];
};

const controlPlaneKey = (region: string, controlPlaneId: string) => JSON.stringify([region, controlPlaneId]);

export const planKonnectCatalogReconciliation = (
  existing: ManagedKonnectProject[],
  incoming: KonnectControlPlane[],
  successfulRegions: ReadonlySet<string>,
): KonnectCatalogPlan => {
  const available = new Map<string, ManagedKonnectProject[]>();
  existing.forEach((project) => {
    const key = controlPlaneKey(project.region, project.controlPlaneId);
    available.set(key, [...(available.get(key) ?? []), project]);
  });
  const retainedWorkspaceIds = new Set<string>();
  const upserts = incoming.map((controlPlane) => {
    const candidates = available.get(controlPlaneKey(controlPlane.region, controlPlane.id)) ?? [];
    const existingProject = candidates.shift();
    if (existingProject) retainedWorkspaceIds.add(existingProject.workspaceId);
    return { controlPlane, workspaceId: existingProject?.workspaceId };
  });
  const deleteWorkspaceIds = existing
    .filter((project) => successfulRegions.has(project.region) && !retainedWorkspaceIds.has(project.workspaceId))
    .map((project) => project.workspaceId);
  return { upserts, deleteWorkspaceIds };
};

export type KonnectCatalogSyncResult = {
  success: true;
  controlPlanes: KonnectSyncCounts;
  services: KonnectSyncCounts;
  routes: KonnectSyncCounts;
  skippedRoutes: KonnectSkippedRoute[];
  skippedRegions: string[];
  durationMs: number;
  coordinator: Workspace;
  catalog: WorkspaceCatalogSnapshot;
};

type SyncKonnectCatalogInput = {
  coordinator: Workspace;
  coordinatorWorkspaceId: string;
  environment: Environment | undefined;
  requestContext: SendRequestContext;
  regions?: readonly string[];
  onProgress?: (message: string) => void;
};

export const konnectCatalogSummaryLines = (result: Pick<KonnectCatalogSyncResult, 'controlPlanes' | 'services' | 'routes' | 'skippedRegions'>) => [
  `Control planes  total ${result.controlPlanes.total} · created ${result.controlPlanes.created} · updated ${result.controlPlanes.updated} · deleted ${result.controlPlanes.deleted}`,
  `Services        total ${result.services.total} · created ${result.services.created} · updated ${result.services.updated} · deleted ${result.services.deleted}`,
  `Routes          total ${result.routes.total} · created ${result.routes.created} · updated ${result.routes.updated} · deleted ${result.routes.deleted} · skipped ${result.routes.skipped}`,
  `Skipped regions ${result.skippedRegions.length}`,
];

const mergeCounts = (target: KonnectSyncCounts, source: KonnectSyncCounts) => {
  target.total += source.total;
  target.created += source.created;
  target.updated += source.updated;
  target.deleted += source.deleted;
  target.skipped += source.skipped;
};

const managedProjectMetadataChanged = (workspace: Workspace, controlPlane: KonnectControlPlane) => (
  workspace.name !== controlPlane.name
  || workspace.konnect.managedControlPlaneId !== controlPlane.id
  || workspace.konnect.managedRegion !== controlPlane.region
  || workspace.konnect.managedClusterType !== controlPlane.clusterType
  || workspace.konnect.managedDeploymentType !== controlPlane.deploymentType
);

const ensureManagedEnvironment = (workspace: Workspace, controlPlane: KonnectControlPlane): Workspace => {
  const root = workspace.environments.find((candidate) => !candidate.parentId);
  if (root) return { ...workspace, activeEnvironmentId: root.id };
  const environment: Environment = {
    id: `konnect-environment-${crypto.randomUUID()}`,
    name: `${controlPlane.name} Environment`,
    variables: [],
  };
  return { ...workspace, activeEnvironmentId: environment.id, environments: [...workspace.environments, environment] };
};

const managedWorkspace = (
  source: Workspace,
  coordinatorWorkspaceId: string,
  controlPlane: KonnectControlPlane,
  syncedAt: string,
): Workspace => ({
  ...source,
  name: controlPlane.name,
  konnect: {
    ...source.konnect,
    enabled: false,
    baseUrl: konnectConfigForRegion(source.konnect, controlPlane.region).baseUrl,
    token: '',
    controlPlaneId: controlPlane.id,
    controlPlanes: [controlPlane],
    managedByWorkspaceId: coordinatorWorkspaceId,
    managedControlPlaneId: controlPlane.id,
    managedRegion: controlPlane.region,
    managedClusterType: controlPlane.clusterType,
    managedDeploymentType: controlPlane.deploymentType,
    lastSyncedAt: syncedAt,
  },
});

const skippedRegionMessage = (region: string, error: unknown) => `${region}: ${error instanceof Error ? error.message : String(error)}`;
const isSingaporePermissionGap = (region: string, error: unknown) => region === 'sg' && /\b403\b/.test(error instanceof Error ? error.message : String(error));

export const syncKonnectCatalog = async ({
  coordinator,
  coordinatorWorkspaceId,
  environment,
  requestContext,
  regions = activeKonnectRegions,
  onProgress,
}: SyncKonnectCatalogInput): Promise<KonnectCatalogSyncResult> => {
  const startedAt = Date.now();
  if (!coordinatorWorkspaceId) throw new Error('The active local project is unavailable.');
  if (coordinator.konnect.managedControlPlaneId) throw new Error('Run all-control-plane sync from a credential-owning local project, not a managed Konnect project.');
  if (!coordinator.konnect.enabled) throw new Error('Enable the Konnect integration before syncing.');

  const initialCatalog = await loadWorkspaceCatalog();
  if (initialCatalog.activeWorkspaceId !== coordinatorWorkspaceId) throw new Error('The Konnect coordinator is no longer the active local project.');
  await saveCatalogWorkspace(coordinatorWorkspaceId, coordinator);
  const readableProjects: Array<{ workspaceId: string; workspace: Workspace } | undefined> = [];
  for (let index = 0; index < initialCatalog.entries.length; index += 20) {
    const batch = await Promise.all(initialCatalog.entries.slice(index, index + 20).map(async (entry) => {
      try {
        return { workspaceId: entry.id, workspace: await readCatalogWorkspace(entry.id) };
      } catch {
        return undefined;
      }
    }));
    readableProjects.push(...batch);
  }
  const existing = readableProjects.flatMap((project): Array<ManagedKonnectProject & { workspace: Workspace }> => {
    if (!project || project.workspace.konnect.managedByWorkspaceId !== coordinatorWorkspaceId) return [];
    const controlPlaneId = project.workspace.konnect.managedControlPlaneId;
    const region = project.workspace.konnect.managedRegion;
    return controlPlaneId && region ? [{ workspaceId: project.workspaceId, workspace: project.workspace, controlPlaneId, region }] : [];
  });
  const existingByWorkspaceId = new Map(existing.map((project) => [project.workspaceId, project.workspace]));
  const controlPlaneCounts = zeroKonnectSyncCounts();
  const serviceCounts = zeroKonnectSyncCounts();
  const routeCounts = zeroKonnectSyncCounts();
  const skippedRoutes: KonnectSkippedRoute[] = [];
  const skippedRegions: string[] = [];
  const successfulRegions = new Set<string>();
  const discovered: KonnectControlPlane[] = [];
  const syncedAt = new Date().toISOString();

  for (const region of regions) {
    onProgress?.(`Fetching control planes in ${region}…`);
    let controlPlanes: KonnectControlPlane[];
    try {
      controlPlanes = await loadKonnectControlPlanesForRegion(coordinator.konnect, region, environment, requestContext);
    } catch (error) {
      if (isSingaporePermissionGap(region, error)) successfulRegions.add(region);
      else skippedRegions.push(skippedRegionMessage(region, error));
      continue;
    }
    discovered.push(...controlPlanes);
    const provisionalPlan = planKonnectCatalogReconciliation(existing, controlPlanes, new Set());
    let regionFailed = false;
    for (const { controlPlane, workspaceId } of provisionalPlan.upserts) {
      controlPlaneCounts.total += 1;
      onProgress?.(`Syncing ${controlPlane.name} in ${region}…`);
      let resources: Awaited<ReturnType<typeof loadKonnectControlPlaneResources>>;
      try {
        resources = await loadKonnectControlPlaneResources(coordinator.konnect, controlPlane, environment, requestContext, onProgress);
      } catch (error) {
        skippedRegions.push(skippedRegionMessage(region, error));
        regionFailed = true;
        break;
      }
      const prior = workspaceId ? existingByWorkspaceId.get(workspaceId) : undefined;
      const base = ensureManagedEnvironment(
        prior ?? createBlankWorkspace(controlPlane.name, coordinator.preferences),
        controlPlane,
      );
      const transient: Workspace = {
        ...base,
        konnect: {
          ...base.konnect,
          ...coordinator.konnect,
          enabled: true,
          controlPlaneId: controlPlane.id,
          controlPlanes: [controlPlane],
        },
      };
      const reconciled = reconcileKonnectResources(transient, resources.services, resources.routes, syncedAt);
      const next = managedWorkspace(reconciled.workspace, coordinatorWorkspaceId, controlPlane, syncedAt);
      if (prior && workspaceId) {
        if (managedProjectMetadataChanged(prior, controlPlane)) controlPlaneCounts.updated += 1;
        await saveCatalogWorkspace(workspaceId, next);
      } else {
        controlPlaneCounts.created += 1;
        await createCatalogWorkspaceInactive(next, `konnect-${crypto.randomUUID()}`);
      }
      mergeCounts(serviceCounts, reconciled.services);
      mergeCounts(routeCounts, reconciled.routes);
      skippedRoutes.push(...reconciled.skippedRoutes);
      onProgress?.(`Synced ${controlPlane.name} in ${region}.`);
    }
    if (!regionFailed) successfulRegions.add(region);
  }

  const plan = planKonnectCatalogReconciliation(existing, discovered, successfulRegions);
  for (const workspaceId of plan.deleteWorkspaceIds) {
    await deleteCatalogWorkspace(workspaceId);
    controlPlaneCounts.deleted += 1;
  }

  const failedRegionNames = new Set(skippedRegions.map((entry) => entry.split(':', 1)[0]));
  const retainedControlPlanes = coordinator.konnect.controlPlanes.filter((controlPlane) => failedRegionNames.has(controlPlane.region));
  const controlPlanes = [...discovered, ...retainedControlPlanes.filter((retained) => !discovered.some((controlPlane) => controlPlaneKey(controlPlane.region, controlPlane.id) === controlPlaneKey(retained.region, retained.id)))];
  const coordinatorWorkspace: Workspace = {
    ...coordinator,
    konnect: {
      ...coordinator.konnect,
      controlPlanes,
      controlPlaneId: controlPlanes.some((controlPlane) => controlPlane.id === coordinator.konnect.controlPlaneId) ? coordinator.konnect.controlPlaneId : controlPlanes[0]?.id ?? '',
      lastSyncedAt: syncedAt,
    },
  };
  await saveCatalogWorkspace(coordinatorWorkspaceId, coordinatorWorkspace);
  const catalog = await loadWorkspaceCatalog();
  if (catalog.activeWorkspaceId !== coordinatorWorkspaceId) throw new Error('The active local project changed during Konnect reconciliation.');
  return {
    success: true,
    controlPlanes: controlPlaneCounts,
    services: serviceCounts,
    routes: routeCounts,
    skippedRoutes,
    skippedRegions,
    durationMs: Date.now() - startedAt,
    coordinator: coordinatorWorkspace,
    catalog,
  };
};
