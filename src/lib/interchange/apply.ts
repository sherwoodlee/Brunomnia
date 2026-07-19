import type { Collection, CookieRecord, Environment, ImportRecord, MockServer, Workspace } from '../../types';
import { sourceId } from './common';
import type { ArtifactImport } from './types';

let importSequence = 0;
const nextBatch = (result: ArtifactImport) => `import-${Date.now().toString(36)}-${(importSequence += 1).toString(36)}-${sourceId('batch', result.format, result.sourceName)}`;

const rekeyCollection = (collection: Collection, batch: string): Collection => {
  const folderIds = new Map((collection.folders ?? []).map((folder) => [folder.id, `${batch}-${folder.id}`]));
  const requestIds = new Map(collection.requests.map((request) => [request.id, `${batch}-${request.id}`]));
  return {
    ...collection,
    id: `${batch}-${collection.id}`,
    environment: (collection.environment ?? []).map((variable) => ({ ...variable, id: `${batch}-${variable.id}` })),
    subEnvironments: (collection.subEnvironments ?? []).map((environment) => ({
      ...environment,
      id: `${batch}-${environment.id}`,
      variables: environment.variables.map((variable) => ({ ...variable, id: `${batch}-${variable.id}` })),
    })),
    activeSubEnvironmentId: collection.activeSubEnvironmentId ? `${batch}-${collection.activeSubEnvironmentId}` : '',
    resourceOrder: (collection.resourceOrder ?? []).flatMap((id) => {
      const mapped = folderIds.get(id) ?? requestIds.get(id);
      return mapped ? [mapped] : [];
    }),
    folders: (collection.folders ?? []).map((folder) => ({
      ...folder,
      id: folderIds.get(folder.id)!,
      parentId: folder.parentId ? folderIds.get(folder.parentId) ?? '' : '',
      headers: folder.headers.map((header) => ({ ...header, id: `${batch}-${header.id}` })),
      environment: folder.environment.map((variable) => ({ ...variable, id: `${batch}-${variable.id}` })),
    })),
    requests: collection.requests.map((request) => ({
      ...request,
      id: requestIds.get(request.id)!,
      folderId: request.folderId ? folderIds.get(request.folderId) ?? '' : '',
      pathParams: request.pathParams.map((row) => ({ ...row, id: `${batch}-${row.id}` })),
      params: request.params.map((row) => ({ ...row, id: `${batch}-${row.id}` })),
      headers: request.headers.map((row) => ({ ...row, id: `${batch}-${row.id}` })),
      formBody: request.formBody.map((row) => ({ ...row, id: `${batch}-${row.id}` })),
      multipartBody: request.multipartBody.map((row) => ({ ...row, id: `${batch}-${row.id}` })),
      grpc: { ...request.grpc, metadata: request.grpc.metadata.map((row) => ({ ...row, id: `${batch}-${row.id}` })) },
    })),
  };
};

const rekeyEnvironments = (environments: Environment[], batch: string): Environment[] => {
  const ids = new Map(environments.map((environment) => [environment.id, `${batch}-${environment.id}`]));
  return environments.map((environment) => ({
    ...environment,
    id: ids.get(environment.id)!,
    parentId: environment.parentId ? ids.get(environment.parentId) ?? '' : '',
    variables: environment.variables.map((variable) => ({ ...variable, id: `${batch}-${variable.id}` })),
  }));
};

const rekeyMock = (server: MockServer, batch: string): MockServer => ({
  ...server,
  id: `${batch}-${server.id}`,
  routes: server.routes.map((route) => ({ ...route, id: `${batch}-${route.id}`, headers: route.headers.map((header) => ({ ...header, id: `${batch}-${header.id}` })) })),
});

const mergeCookies = (current: CookieRecord[], imported: CookieRecord[], batch: string) => {
  const cookies = new Map(current.map((cookie) => [`${cookie.name}\n${cookie.domain}\n${cookie.path}`, cookie]));
  imported.forEach((cookie) => cookies.set(`${cookie.name}\n${cookie.domain}\n${cookie.path}`, { ...cookie, id: `${batch}-${cookie.id}` }));
  return [...cookies.values()];
};

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
  if (result.replacement) return { ...result.replacement, version: 29, imports: [record, ...result.replacement.imports].slice(0, 100) };

  const collections = result.collections.map((collection) => rekeyCollection(collection, batch));
  const collectionIds = new Map(result.collections.map((collection, index) => [collection.id, collections[index].id]));
  const environments = rekeyEnvironments(result.environments, batch);
  const apiDesigns = result.apiDesigns.map((design) => ({
    ...design,
    id: `${batch}-${design.id}`,
    generatedCollectionId: design.generatedCollectionId ? collectionIds.get(design.generatedCollectionId) : undefined,
  }));
  const mockServers = result.mockServers.map((server) => rekeyMock(server, batch));
  const firstRequest = collections.flatMap((collection) => collection.requests)[0];
  return {
    ...workspace,
    version: 29,
    activeRequestId: firstRequest?.id ?? workspace.activeRequestId,
    activeEnvironmentId: environments[0]?.id ?? workspace.activeEnvironmentId,
    collections: [...workspace.collections, ...collections],
    environments: [...workspace.environments, ...environments],
    apiDesigns: [...workspace.apiDesigns, ...apiDesigns],
    mockServers: [...workspace.mockServers, ...mockServers],
    cookies: mergeCookies(workspace.cookies, result.cookies, batch),
    imports: [record, ...workspace.imports].slice(0, 100),
  };
};
