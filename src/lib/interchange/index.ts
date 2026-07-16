import { parseAllDocuments } from 'yaml';
import type { ArtifactImport } from './types';
import { migrateWorkspace } from '../storage';
import { asRecord, asString, type UnknownRecord } from './common';
import { importCurl, isCurl } from './curl';
import { importHar, isHar } from './har';
import { importInsomniaV4, importInsomniaV5, isInsomniaV4, isInsomniaV5 } from './insomnia';
import { importPostman, importPostmanEnvironment, isPostmanCollection, isPostmanEnvironment } from './postman';
import { importOpenApi, importSwagger, parseSpecDocument } from './spec';
import { importWsdl, isWsdl } from './wsdl';

const parsedDocuments = (contents: string): UnknownRecord[] => parseAllDocuments(contents)
  .filter((document) => document.errors.length === 0)
  .flatMap((document) => {
    const value = asRecord(document.toJSON());
    return value ? [value] : [];
  });

export const importArtifact = (contents: string, sourceName = 'Imported artifact'): ArtifactImport => {
  if (!contents.trim()) throw new Error('The import is empty.');
  if (contents.length > 20_000_000) throw new Error('The import exceeds the 20 MB local conversion limit.');
  if (isCurl(contents)) return importCurl(contents, sourceName);
  if (isWsdl(contents)) return importWsdl(contents, sourceName);

  const documents = parsedDocuments(contents);
  const first = documents[0] ?? parseSpecDocument(contents);
  if (!first) throw new Error('The import is not valid JSON, YAML, WSDL, or cURL text.');
  if (first.format === 'brunomnia') {
    const replacement = migrateWorkspace(first);
    return {
      format: 'brunomnia', sourceName, warnings: [], replacement,
      metadata: { version: String(replacement.version), collections: String(replacement.collections.length) },
      collections: [], environments: [], apiDesigns: [], mockServers: [],
    };
  }
  if (documents.some(isInsomniaV5)) return importInsomniaV5(sourceName, documents.filter(isInsomniaV5));
  if (isInsomniaV4(first)) return importInsomniaV4(sourceName, first);
  if (isPostmanCollection(first)) return importPostman(sourceName, first);
  if (isPostmanEnvironment(first)) return importPostmanEnvironment(sourceName, first);
  if (isHar(first)) return importHar(sourceName, first);
  if (asString(first.openapi).startsWith('3.')) return importOpenApi(contents, sourceName, first);
  if (asString(first.swagger) === '2.0') return importSwagger(contents, sourceName, first);
  throw new Error('Unsupported import. Brunomnia accepts Brunomnia JSON, Insomnia v4/v5, Postman 2.0/2.1, HAR, OpenAPI 3.x, Swagger 2, WSDL, and cURL.');
};

export const importSummary = (result: ArtifactImport) => {
  const resources = [
    result.collections.length ? `${result.collections.length} collection${result.collections.length === 1 ? '' : 's'}` : '',
    result.collections.reduce((total, collection) => total + collection.requests.length, 0) ? `${result.collections.reduce((total, collection) => total + collection.requests.length, 0)} requests` : '',
    result.environments.length ? `${result.environments.length} environment${result.environments.length === 1 ? '' : 's'}` : '',
    result.apiDesigns.length ? `${result.apiDesigns.length} design${result.apiDesigns.length === 1 ? '' : 's'}` : '',
    result.mockServers.length ? `${result.mockServers.length} mock${result.mockServers.length === 1 ? '' : 's'}` : '',
  ].filter(Boolean);
  return result.replacement ? `Replace with Brunomnia workspace · ${result.replacement.collections.length} collections` : resources.join(' · ') || 'No supported resources';
};

export type { ArtifactImport, ArtifactExport, ExportFormat, ExportScope } from './types';
export { applyArtifactImport } from './apply';
