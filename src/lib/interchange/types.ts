import type { ApiDesign, Collection, Environment, ImportFormat, ImportWarning, MockServer, Workspace } from '../../types';

export type ArtifactResources = {
  collections: Collection[];
  environments: Environment[];
  apiDesigns: ApiDesign[];
  mockServers: MockServer[];
};

export type ArtifactImport = ArtifactResources & {
  format: ImportFormat;
  sourceName: string;
  warnings: ImportWarning[];
  metadata: Record<string, string>;
  replacement?: Workspace;
};

export type ExportFormat = 'brunomnia' | 'insomnia-v4' | 'insomnia-v5' | 'har' | 'openapi';
export type ExportScope = 'all' | 'collection' | 'design';

export type ArtifactExport = {
  contents: string;
  fileName: string;
  mimeType: string;
  warnings: ImportWarning[];
};

export const emptyResources = (): ArtifactResources => ({
  collections: [],
  environments: [],
  apiDesigns: [],
  mockServers: [],
});
