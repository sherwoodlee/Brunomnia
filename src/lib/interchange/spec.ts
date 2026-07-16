import { parse } from 'yaml';
import { generateCollectionFromOpenApi } from '../openapi';
import type { ApiDesign, ApiRequest, Collection, ImportWarning, KeyValue } from '../../types';
import { asArray, asRecord, asString, fileStem, keyValues, normalizeMethod, objectVariables, requestFrom, sourceId, sourceMetadata, type UnknownRecord } from './common';
import type { ArtifactImport } from './types';
import { emptyResources } from './types';

const operationMethods = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace']);

export const parseSpecDocument = (contents: string): UnknownRecord | undefined => {
  try {
    return asRecord(parse(contents));
  } catch {
    return undefined;
  }
};

export const importOpenApi = (contents: string, sourceName: string, document: UnknownRecord): ArtifactImport => {
  const warnings: ImportWarning[] = [];
  const title = asString(asRecord(document.info)?.title, fileStem(sourceName));
  const design: ApiDesign = {
    id: sourceId('design', 'openapi-3', sourceName),
    name: title,
    contents,
    source: sourceMetadata('openapi-3', sourceName),
  };
  let collections: Collection[] = [];
  try {
    const collection = generateCollectionFromOpenApi(design);
    design.generatedCollectionId = collection.id;
    collections = [{ ...collection, source: sourceMetadata('openapi-3', sourceName) }];
  } catch (error) {
    warnings.push({ code: 'openapi-generation', message: error instanceof Error ? error.message : String(error), resource: title });
  }
  return {
    ...emptyResources(),
    format: 'openapi-3',
    sourceName,
    warnings,
    metadata: { version: asString(document.openapi), title },
    collections,
    apiDesigns: [design],
  };
};

const swaggerBody = (request: ApiRequest, parameters: unknown[], consumes: string[]) => {
  const bodyParameter = parameters.map(asRecord).find((parameter) => parameter?.in === 'body');
  const formParameters = parameters.map(asRecord).filter((parameter) => parameter?.in === 'formData');
  if (bodyParameter) {
    const schema = asRecord(bodyParameter.schema);
    const example = schema?.example ?? schema?.default ?? {};
    request.bodyMode = consumes.includes('text/plain') ? 'text' : 'json';
    request.body = typeof example === 'string' ? example : JSON.stringify(example, null, 2);
  } else if (formParameters.length) {
    const multipart = consumes.includes('multipart/form-data');
    if (multipart) {
      request.bodyMode = 'multipart';
      request.multipartBody = formParameters.map((parameter, index) => ({
        id: `${request.id}-form-${index}`,
        name: asString(parameter?.name),
        value: asString(parameter?.default),
        enabled: Boolean(parameter?.required),
        kind: parameter?.type === 'file' ? 'file' : 'text',
      }));
    } else {
      request.bodyMode = 'form-urlencoded';
      request.formBody = formParameters.map((parameter, index) => ({
        id: `${request.id}-form-${index}`,
        name: asString(parameter?.name),
        value: asString(parameter?.default),
        enabled: Boolean(parameter?.required),
      }));
    }
  } else {
    request.bodyMode = 'none';
  }
};

const swaggerAuth = (request: ApiRequest, document: UnknownRecord, operation: UnknownRecord, warnings: ImportWarning[]) => {
  const security = asArray(operation.security ?? document.security);
  const selected = asRecord(security[0]);
  const name = selected ? Object.keys(selected)[0] : '';
  const definition = asRecord(asRecord(document.securityDefinitions)?.[name]);
  if (!definition) return;
  if (definition.type === 'basic') {
    request.auth = { ...request.auth, type: 'basic' };
  } else if (definition.type === 'apiKey') {
    request.auth = {
      ...request.auth,
      type: 'api-key',
      apiKeyName: asString(definition.name, name),
      apiKeyLocation: definition.in === 'query' ? 'query' : 'header',
    };
  } else {
    request.source = sourceMetadata('swagger-2', request.source?.sourceId, { authentication: definition });
    warnings.push({ code: 'unsupported-auth', message: `Swagger authentication '${asString(definition.type, name)}' was preserved as source metadata.`, resource: request.name });
  }
};

export const importSwagger = (_contents: string, sourceName: string, document: UnknownRecord): ArtifactImport => {
  const warnings: ImportWarning[] = [];
  const info = asRecord(document.info);
  const title = asString(info?.title, fileStem(sourceName));
  const scheme = asString(asArray(document.schemes)[0], 'https');
  const host = asString(document.host, '{{ baseUrl }}');
  const basePath = asString(document.basePath).replace(/\/$/, '');
  const baseUrl = host.includes('://') ? `${host}${basePath}` : `${scheme}://${host}${basePath}`;
  const globalConsumes = asArray(document.consumes).map((value) => asString(value));
  const requests: ApiRequest[] = [];
  const tagVariables: KeyValue[] = objectVariables(document['x-variables'], 'swagger-variable');

  for (const [path, rawPathItem] of Object.entries(asRecord(document.paths) ?? {})) {
    const pathItem = asRecord(rawPathItem);
    if (!pathItem) continue;
    for (const [method, rawOperation] of Object.entries(pathItem)) {
      if (!operationMethods.has(method)) continue;
      const operation = asRecord(rawOperation);
      if (!operation) continue;
      const identity = asString(operation.operationId, `${method}-${path}`);
      const request = requestFrom('swagger-2', identity, requests.length);
      request.name = asString(operation.summary, identity);
      request.method = normalizeMethod(method, warnings, request.name);
      request.url = `${baseUrl}${path.replace(/{([^}]+)}/g, '{{ $1 }}')}`;
      const parameters = [...asArray(pathItem.parameters), ...asArray(operation.parameters)];
      request.params = keyValues(parameters.filter((parameter) => asRecord(parameter)?.in === 'query'), `${request.id}-query`);
      request.headers = keyValues(parameters.filter((parameter) => asRecord(parameter)?.in === 'header'), `${request.id}-header`);
      const consumes = asArray(operation.consumes).map((value) => asString(value));
      swaggerBody(request, parameters, consumes.length ? consumes : globalConsumes);
      if (request.bodyMode !== 'none' && !request.headers.some((header) => header.name.toLowerCase() === 'content-type')) {
        request.headers.push({ id: `${request.id}-content-type`, name: 'Content-Type', value: consumes[0] || globalConsumes[0] || 'application/json', enabled: true });
      }
      swaggerAuth(request, document, operation, warnings);
      requests.push(request);
    }
  }

  if (!requests.length) warnings.push({ code: 'no-operations', message: 'The Swagger document did not contain importable operations.', resource: title });
  const collection: Collection = {
    id: sourceId('collection', 'swagger-2', sourceName),
    name: title,
    expanded: true,
    requests,
    source: sourceMetadata('swagger-2', sourceName, { version: document.swagger }),
  };
  return {
    ...emptyResources(),
    format: 'swagger-2', sourceName, warnings,
    metadata: { version: asString(document.swagger), title, baseUrl },
    collections: [collection],
    environments: tagVariables.length ? [{ id: sourceId('environment', 'swagger-2', sourceName), name: `${title} variables`, variables: tagVariables, source: sourceMetadata('swagger-2', sourceName) }] : [],
  };
};
