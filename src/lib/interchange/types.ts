import type { ApiDesign, Collection, CookieRecord, Environment, ImportFormat, ImportWarning, McpClient, MockServer, UnitTestSuite, Workspace } from '../../types';

export type ArtifactResources = {
  collections: Collection[];
  environments: Environment[];
  apiDesigns: ApiDesign[];
  mockServers: MockServer[];
  cookies: CookieRecord[];
  testSuites: UnitTestSuite[];
  mcpClients: McpClient[];
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
  cookies: [],
  testSuites: [],
  mcpClients: [],
});
