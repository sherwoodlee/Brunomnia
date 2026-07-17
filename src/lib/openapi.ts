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
  parameters: Array<{ name: string; location: string; required: boolean; description: string; value: string }>;
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

type RuleNode = { value: unknown; path: string };

const childNodes = (node: RuleNode): RuleNode[] => {
  if (Array.isArray(node.value)) return node.value.map((value, index) => ({ value, path: `${node.path}[${index}]` }));
  const object = record(node.value);
  return object ? Object.entries(object).map(([key, value]) => ({ value, path: `${node.path}.${key}` })) : [];
};

const selectRuleNodes = (document: UnknownRecord, expression: string): RuleNode[] => {
  const recursive = expression.match(/^\$\.\.([\w-]+)$/);
  if (recursive) {
    const output: RuleNode[] = [];
    const visit = (node: RuleNode) => {
      childNodes(node).forEach((child) => {
        if (child.path.endsWith(`.${recursive[1]}`)) output.push(child);
        visit(child);
      });
    };
    visit({ value: document, path: '$' });
    return output;
  }
  const normalized = expression.trim().replace(/^\$\.?/, '').replace(/\[['"]([^'"]+)['"]\]/g, '.$1').replace(/\[\*\]/g, '.*').replace(/^\./, '');
  if (!normalized) return [{ value: document, path: '$' }];
  return normalized.split('.').filter(Boolean).reduce<RuleNode[]>((nodes, segment) => nodes.flatMap((node) => {
    if (segment === '*') return childNodes(node);
    if (Array.isArray(node.value) && /^\d+$/.test(segment)) {
      const index = Number(segment);
      return index < node.value.length ? [{ value: node.value[index], path: `${node.path}[${index}]` }] : [];
    }
    const object = record(node.value);
    return object && segment in object ? [{ value: object[segment], path: `${node.path}.${segment}` }] : [];
  }), [{ value: document, path: '$' }]);
};

const fieldNode = (node: RuleNode, field: string): RuleNode => {
  if (!field) return node;
  let current = node;
  for (const segment of field.split('.').filter(Boolean)) {
    const object = record(current.value);
    current = { value: object?.[segment], path: `${current.path}.${segment}` };
  }
  return current;
};

const ruleFails = (value: unknown, functionName: string, options: UnknownRecord) => {
  if (functionName === 'truthy') return !value;
  if (functionName === 'falsy') return Boolean(value);
  if (functionName === 'defined') return value === undefined || value === null;
  if (functionName === 'enumeration') return !Array.isArray(options.values) || !options.values.some((candidate) => candidate === value);
  if (functionName === 'length') {
    const length = typeof value === 'string' || Array.isArray(value) ? value.length : record(value) ? Object.keys(record(value) ?? {}).length : 0;
    return (typeof options.min === 'number' && length < options.min) || (typeof options.max === 'number' && length > options.max);
  }
  if (functionName === 'pattern') {
    if (typeof value !== 'string') return true;
    try {
      if (typeof options.match === 'string' && !new RegExp(options.match).test(value)) return true;
      if (typeof options.notMatch === 'string' && new RegExp(options.notMatch).test(value)) return true;
      return false;
    } catch { return true; }
  }
  if (functionName === 'casing') {
    if (typeof value !== 'string') return true;
    const patterns: Record<string, RegExp> = { camel: /^[a-z][A-Za-z0-9]*$/, pascal: /^[A-Z][A-Za-z0-9]*$/, kebab: /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/, snake: /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/ };
    return !(patterns[asString(options.type)] ?? patterns.camel).test(value);
  }
  return false;
};

const asString = (value: unknown, fallback = '') => typeof value === 'string' ? value : fallback;

const customRulesetIssues = (document: UnknownRecord, source: string): OpenApiIssue[] => {
  if (!source.trim()) return [];
  let ruleset: UnknownRecord;
  try {
    ruleset = record(parse(source)) ?? {};
  } catch (error) {
    return [{ severity: 'error', path: '$ruleset', message: error instanceof Error ? error.message : 'The custom ruleset is invalid.' }];
  }
  const rules = record(ruleset.rules) ?? ruleset;
  const issues: OpenApiIssue[] = [];
  if (ruleset.extends) issues.push({ severity: 'warning', path: '$ruleset.extends', message: 'Remote, package, and inherited Spectral rulesets are not executed by the local safe rules engine.' });
  if (ruleset.functions || ruleset.functionsDir) issues.push({ severity: 'warning', path: '$ruleset.functions', message: 'Custom JavaScript ruleset functions are not executed by the local safe rules engine.' });
  for (const [ruleName, rawRule] of Object.entries(rules)) {
    if (rawRule === false || rawRule === 'off') continue;
    const rule = record(rawRule);
    if (!rule) continue;
    const severityValue = asString(rule.severity, rule.severity === 0 ? 'error' : 'warn').toLowerCase();
    if (severityValue === 'off') continue;
    const severity: OpenApiIssue['severity'] = severityValue === 'error' || severityValue === '0' ? 'error' : 'warning';
    const given = Array.isArray(rule.given) ? rule.given.map((value) => asString(value)).filter(Boolean) : [asString(rule.given, '$')];
    const conditions = Array.isArray(rule.then) ? rule.then : [rule.then];
    given.flatMap((expression) => selectRuleNodes(document, expression)).forEach((selected) => conditions.forEach((rawCondition) => {
      const condition = record(rawCondition);
      if (!condition) return;
      const target = fieldNode(selected, asString(condition.field));
      const functionName = asString(condition.function);
      if (!['truthy', 'falsy', 'defined', 'enumeration', 'length', 'pattern', 'casing'].includes(functionName)) {
        issues.push({ severity: 'warning', path: `$ruleset.rules.${ruleName}`, message: `Ruleset function '${functionName || '(empty)'}' is not supported by the local safe rules engine.` });
        return;
      }
      if (!ruleFails(target.value, functionName, record(condition.functionOptions) ?? {})) return;
      const message = asString(rule.message) || asString(rule.description) || `Custom rule '${ruleName}' failed ${functionName}.`;
      issues.push({ severity, path: target.path.replace(/^\$\.?/, '') || '$', message: message.replace(/{{\s*property\s*}}/g, target.path.split('.').at(-1) ?? '').replace(/{{\s*path\s*}}/g, target.path) });
    }));
  }
  return issues;
};

export const analyzeOpenApi = (contents: string, ruleset = ''): OpenApiAnalysis => {
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
        const schema = record(parameter.schema);
        const example = parameter.example ?? schema?.example ?? schema?.default;
        const value = example === undefined ? '' : typeof example === 'string' ? example : JSON.stringify(example);
        return [{ name: parameter.name, location: parameter.in, required: Boolean(parameter.required), description: asString(parameter.description), value }];
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

  issues.push(...customRulesetIssues(document, ruleset));
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
  const analysis = analyzeOpenApi(design.contents, design.ruleset);
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
    request.url = `${baseUrl}${operation.path}`;
    request.pathParams = operation.parameters.filter((parameter) => parameter.location === 'path').map<KeyValue>((parameter) => ({
      id: `${request.id}-path-${parameter.name}`, name: parameter.name, value: parameter.value, enabled: true, description: parameter.description,
    }));
    request.params = operation.parameters.filter((parameter) => parameter.location === 'query').map<KeyValue>((parameter) => ({
      id: `${request.id}-query-${parameter.name}`, name: parameter.name, value: parameter.value, enabled: parameter.required, description: parameter.description,
    }));
    request.headers = operation.parameters.filter((parameter) => parameter.location === 'header').map<KeyValue>((parameter) => ({
      id: `${request.id}-header-${parameter.name}`, name: parameter.name, value: parameter.value, enabled: parameter.required, description: parameter.description,
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
