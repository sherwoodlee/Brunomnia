import type { Collection, Environment, ImportRecord, MockServer, Workspace } from '../../types';
import { sourceId } from './common';
import type { ArtifactImport } from './types';

let importSequence = 0;
const nextBatch = (result: ArtifactImport) => `import-${Date.now().toString(36)}-${(importSequence += 1).toString(36)}-${sourceId('batch', result.format, result.sourceName)}`;

const rekeyCollection = (collection: Collection, batch: string): Collection => ({
  ...collection,
  id: `${batch}-${collection.id}`,
  requests: collection.requests.map((request) => ({ ...request, id: `${batch}-${request.id}` })),
});

const rekeyEnvironment = (environment: Environment, batch: string): Environment => ({
  ...environment,
  id: `${batch}-${environment.id}`,
  variables: environment.variables.map((variable) => ({ ...variable, id: `${batch}-${variable.id}` })),
});

const rekeyMock = (server: MockServer, batch: string): MockServer => ({
  ...server,
  id: `${batch}-${server.id}`,
  routes: server.routes.map((route) => ({ ...route, id: `${batch}-${route.id}`, headers: route.headers.map((header) => ({ ...header, id: `${batch}-${header.id}` })) })),
});

export const applyArtifactImport = (workspace: Workspace, result: ArtifactImport): Workspace => {
  const batch = nextBatch(result);
  const record: ImportRecord = {
    id: batch,
    format: result.format,
    sourceName: result.sourceName,
    importedAt: new Date().toISOString(),
    warnings: result.warnings,
    metadata: result.metadata,
  };
  if (result.replacement) return { ...result.replacement, version: 4, imports: [record, ...result.replacement.imports].slice(0, 100) };

  const collections = result.collections.map((collection) => rekeyCollection(collection, batch));
  const collectionIds = new Map(result.collections.map((collection, index) => [collection.id, collections[index].id]));
  const environments = result.environments.map((environment) => rekeyEnvironment(environment, batch));
  const apiDesigns = result.apiDesigns.map((design) => ({
    ...design,
    id: `${batch}-${design.id}`,
    generatedCollectionId: design.generatedCollectionId ? collectionIds.get(design.generatedCollectionId) : undefined,
  }));
  const mockServers = result.mockServers.map((server) => rekeyMock(server, batch));
  const firstRequest = collections.flatMap((collection) => collection.requests)[0];
  return {
    ...workspace,
    version: 4,
    activeRequestId: firstRequest?.id ?? workspace.activeRequestId,
    activeEnvironmentId: environments[0]?.id ?? workspace.activeEnvironmentId,
    collections: [...workspace.collections, ...collections],
    environments: [...workspace.environments, ...environments],
    apiDesigns: [...workspace.apiDesigns, ...apiDesigns],
    mockServers: [...workspace.mockServers, ...mockServers],
    imports: [record, ...workspace.imports].slice(0, 100),
  };
};
