import { parse, stringify } from 'yaml';
import { createBlankRequest } from '../data/seed';
import type { ApiDesign, Collection, HttpMethod, KeyValue, OpenApiIssue } from '../types';

const operationMethods = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace']);

type UnknownRecord = Record<string, unknown>;

export type OpenApiOperation = {
  id: string;
  method: HttpMethod;
  path: string;
  summary: string;
  description: string;
  parameters: Array<{ name: string; location: string; required: boolean }>;
};

export type OpenApiAnalysis = {
  document?: UnknownRecord;
  issues: OpenApiIssue[];
  operations: OpenApiOperation[];
  title: string;
  version: string;
};

const record = (value: unknown): UnknownRecord | undefined => value && typeof value === 'object' && !Array.isArray(value)
  ? value as UnknownRecord : undefined;

const pathLabel = (...parts: string[]) => parts.join('.').replace(/\.\[/g, '[');

export const analyzeOpenApi = (contents: string): OpenApiAnalysis => {
  const issues: OpenApiIssue[] = [];
  let parsed: unknown;
  try {
    parsed = parse(contents);
  } catch (error) {
    return {
      issues: [{ severity: 'error', path: '$', message: error instanceof Error ? error.message : 'Invalid YAML or JSON.' }],
      operations: [],
      title: 'Invalid document',
      version: '',
    };
  }

  const document = record(parsed);
  if (!document) {
    return { issues: [{ severity: 'error', path: '$', message: 'The document root must be an object.' }], operations: [], title: 'Invalid document', version: '' };
  }
  const openapi = typeof document.openapi === 'string' ? document.openapi : '';
  if (!openapi.startsWith('3.')) issues.push({ severity: 'error', path: 'openapi', message: 'Brunomnia expects an OpenAPI 3.x document.' });

  const info = record(document.info);
  const title = typeof info?.title === 'string' ? info.title : 'Untitled API';
  const version = typeof info?.version === 'string' ? info.version : '';
  if (!info?.title) issues.push({ severity: 'error', path: 'info.title', message: 'Add an API title.' });
  if (!info?.version) issues.push({ severity: 'error', path: 'info.version', message: 'Add an API version.' });

  const paths = record(document.paths);
  if (!paths || Object.keys(paths).length === 0) issues.push({ severity: 'error', path: 'paths', message: 'Define at least one API path.' });
  const operations: OpenApiOperation[] = [];
  const operationIds = new Set<string>();

  for (const [path, rawPathItem] of Object.entries(paths ?? {})) {
    if (!path.startsWith('/')) issues.push({ severity: 'error', path: pathLabel('paths', path), message: 'Path keys must begin with /.' });
    const pathItem = record(rawPathItem);
    if (!pathItem) continue;
    for (const [method, rawOperation] of Object.entries(pathItem)) {
      if (!operationMethods.has(method)) continue;
      const operation = record(rawOperation);
      if (!operation) continue;
      const operationPath = pathLabel('paths', path, method);
      const operationId = typeof operation.operationId === 'string' && operation.operationId
        ? operation.operationId : `${method}-${path.replace(/[^a-z0-9]+/gi, '-')}`;
      if (!operation.operationId) issues.push({ severity: 'warning', path: `${operationPath}.operationId`, message: 'Add an operationId for stable generated request names.' });
      if (operationIds.has(operationId)) issues.push({ severity: 'error', path: `${operationPath}.operationId`, message: `Duplicate operationId: ${operationId}.` });
      operationIds.add(operationId);
      const responses = record(operation.responses);
      if (!responses || Object.keys(responses).length === 0) issues.push({ severity: 'error', path: `${operationPath}.responses`, message: 'Every operation needs at least one response.' });

      const rawParameters = [
        ...(Array.isArray(pathItem.parameters) ? pathItem.parameters : []),
        ...(Array.isArray(operation.parameters) ? operation.parameters : []),
      ];
      const parameters = rawParameters.flatMap((rawParameter) => {
        const parameter = record(rawParameter);
        if (!parameter || typeof parameter.name !== 'string' || typeof parameter.in !== 'string') return [];
        return [{ name: parameter.name, location: parameter.in, required: Boolean(parameter.required) }];
      });
      for (const match of path.matchAll(/{([^}]+)}/g)) {
        if (!parameters.some((parameter) => parameter.location === 'path' && parameter.name === match[1] && parameter.required)) {
          issues.push({ severity: 'error', path: `${operationPath}.parameters`, message: `Path parameter {${match[1]}} must be declared and required.` });
        }
      }
      operations.push({
        id: operationId,
        method: method.toUpperCase() as HttpMethod,
        path,
        summary: typeof operation.summary === 'string' ? operation.summary : operationId,
        description: typeof operation.description === 'string' ? operation.description : '',
        parameters,
      });
    }
  }

  return { document, issues, operations, title, version };
};

const schemaExample = (schema: UnknownRecord | undefined): unknown => {
  if (!schema) return {};
  if ('example' in schema) return schema.example;
  if ('default' in schema) return schema.default;
  if (schema.type === 'array') return [schemaExample(record(schema.items))];
  if (schema.type === 'object' || schema.properties) {
    return Object.fromEntries(Object.entries(record(schema.properties) ?? {}).map(([name, property]) => [name, schemaExample(record(property))]));
  }
  if (schema.type === 'integer' || schema.type === 'number') return 0;
  if (schema.type === 'boolean') return false;
  return '';
};

export const generateCollectionFromOpenApi = (design: ApiDesign): Collection => {
  const analysis = analyzeOpenApi(design.contents);
  if (!analysis.document || analysis.issues.some((issue) => issue.severity === 'error')) {
    throw new Error('Resolve OpenAPI errors before generating a collection.');
  }
  const server = Array.isArray(analysis.document.servers)
    ? record(analysis.document.servers[0])?.url
    : undefined;
  const baseUrl = typeof server === 'string' ? server.replace(/\/$/, '') : '{{ baseUrl }}';
  const paths = record(analysis.document.paths) ?? {};
  const requests = analysis.operations.map((operation, index) => {
    const request = createBlankRequest(`openapi-${design.id}-${index}`);
    const operationDocument = record(record(paths[operation.path])?.[operation.method.toLowerCase()]);
    const content = record(record(operationDocument?.requestBody)?.content);
    const jsonSchema = record(record(content?.['application/json'])?.schema);
    request.name = operation.summary;
    request.method = operation.method;
    request.url = `${baseUrl}${operation.path.replace(/{([^}]+)}/g, '{{ $1 }}')}`;
    request.params = operation.parameters.filter((parameter) => parameter.location === 'query').map<KeyValue>((parameter) => ({
      id: `${request.id}-query-${parameter.name}`, name: parameter.name, value: '', enabled: parameter.required,
    }));
    request.headers = operation.parameters.filter((parameter) => parameter.location === 'header').map<KeyValue>((parameter) => ({
      id: `${request.id}-header-${parameter.name}`, name: parameter.name, value: '', enabled: parameter.required,
    }));
    if (jsonSchema || content?.['application/json']) {
      request.bodyMode = 'json';
      request.body = JSON.stringify(schemaExample(jsonSchema), null, 2);
      request.headers.push({ id: `${request.id}-content-type`, name: 'Content-Type', value: 'application/json', enabled: true });
    } else {
      request.bodyMode = 'none';
    }
    return request;
  });
  return { id: `collection-${design.id}`, name: analysis.title, expanded: true, requests };
};

export const formatOpenApi = (contents: string): string => {
  const document = parse(contents);
  return stringify(document, { lineWidth: 100 });
};
