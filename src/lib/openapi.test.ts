import { describe, expect, it } from 'vitest';
import { analyzeOpenApi, generateCollectionFromOpenApi } from './openapi';

const source = `openapi: 3.1.0
info: { title: Pet API, version: 1.0.0 }
servers: [{ url: https://api.example.com }]
paths:
  /pets/{petId}:
    get:
      operationId: getPet
      parameters:
        - { in: path, name: petId, required: true, schema: { type: string } }
      responses: { '200': { description: ok } }
`;

describe('OpenAPI design tools', () => {
  it('analyzes valid operations and generates requests', () => {
    const analysis = analyzeOpenApi(source);
    expect(analysis.issues).toEqual([]);
    expect(analysis.operations[0]).toMatchObject({ id: 'getPet', method: 'GET', path: '/pets/{petId}' });

    const collection = generateCollectionFromOpenApi({ id: 'pets', name: 'Pets', contents: source });
    expect(collection.requests[0].url).toBe('https://api.example.com/pets/{{ petId }}');
  });

  it('reports structural and path parameter errors', () => {
    const analysis = analyzeOpenApi('openapi: 3.1.0\ninfo: {}\npaths:\n  pets/{id}:\n    get: {}');
    expect(analysis.issues.filter((issue) => issue.severity === 'error').length).toBeGreaterThan(3);
  });
});
