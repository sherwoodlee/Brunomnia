import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { analyzeOpenApi, exportOpenApiSpecification, generateCollectionFromOpenApi } from './openapi';

const source = `openapi: 3.1.0
info: { title: Pet API, version: 1.0.0 }
servers: [{ url: https://api.example.com }]
paths:
  /pets/{petId}:
    get:
      operationId: getPet
      parameters:
        - { in: path, name: petId, required: true, description: Pet identifier, example: pet/one, schema: { type: string } }
      responses: { '200': { description: ok } }
`;

describe('OpenAPI design tools', () => {
  it('analyzes valid operations and generates requests', () => {
    const analysis = analyzeOpenApi(source);
    expect(analysis.issues).toEqual([]);
    expect(analysis.operations[0]).toMatchObject({ id: 'getPet', method: 'GET', path: '/pets/{petId}' });

    const collection = generateCollectionFromOpenApi({ id: 'pets', name: 'Pets', contents: source });
    expect(collection.requests[0].url).toBe('https://api.example.com/pets/{petId}');
    expect(collection.requests[0].pathParams[0]).toMatchObject({ name: 'petId', value: 'pet/one', enabled: true, description: 'Pet identifier' });
  });

  it('reports structural and path parameter errors', () => {
    const analysis = analyzeOpenApi('openapi: 3.1.0\ninfo: {}\npaths:\n  pets/{id}:\n    get: {}');
    expect(analysis.issues.filter((issue) => issue.severity === 'error').length).toBeGreaterThan(3);
  });

  it('runs safe Spectral-style custom rules without executing JavaScript', () => {
    const ruleset = `rules:
  operation-summary:
    message: Every operation needs a summary
    severity: error
    given: $.paths.*.*
    then: { field: summary, function: truthy }
  operation-id-casing:
    given: $..operationId
    then:
      function: pattern
      functionOptions: { match: '^[a-z][A-Za-z0-9]+$' }
`;
    const analysis = analyzeOpenApi(source, ruleset);
    expect(analysis.issues).toContainEqual({ severity: 'error', path: 'paths./pets/{petId}.get.summary', message: 'Every operation needs a summary' });
    expect(analysis.issues.some((issue) => issue.message.includes('operation-id-casing'))).toBe(false);
    const unsupported = analyzeOpenApi(source, 'extends: spectral:oas\nrules:\n  custom: { given: $, then: { function: customJavaScript } }');
    expect(unsupported.issues.some((issue) => issue.path === '$ruleset.extends')).toBe(true);
    expect(unsupported.issues.some((issue) => issue.message.includes("customJavaScript"))).toBe(true);
  });

  it('removes nested Kong annotations only when explicitly requested', () => {
    const annotated = `${source}x-kong-name: pets\nx-visible: retained\ncomponents:\n  schemas:\n    Pet:\n      type: object\n      x-kong-plugin: hidden\n      properties:\n        id: { type: string, x-kong-field: hidden, x-visible: retained }\n`;
    expect(exportOpenApiSpecification(annotated)).toBe(annotated);
    const exported = parse(exportOpenApiSpecification(annotated, true));
    expect(exported['x-kong-name']).toBeUndefined();
    expect(exported['x-visible']).toBe('retained');
    expect(exported.components.schemas.Pet['x-kong-plugin']).toBeUndefined();
    expect(exported.components.schemas.Pet.properties.id).toEqual({ type: 'string', 'x-visible': 'retained' });
    expect(() => exportOpenApiSpecification('root: &root\n  self: *root\n', true)).toThrow(/cyclic YAML aliases/);
  });
});
