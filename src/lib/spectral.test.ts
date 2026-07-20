import { describe, expect, it } from 'vitest';
import type { ApiDesign } from '../types';
import { generateCollectionFromOpenApi } from './openapi';
import { analyzeOpenApiDesign } from './openapiSpectral';
import { normalizeApiDesignSourceFiles } from './apiDesignSources';
import { lintOpenApiWithSpectral } from './spectral';

const source = (schemaReference: string) => `openapi: 3.0.3
info:
  title: Pet API
  version: 1.0.0
  description: Pet operations
  contact: { name: API Team }
servers: [{ url: https://api.example.com }]
paths:
  /pets:
    post:
      operationId: createPet
      summary: Create pet
      tags: [pets]
      requestBody:
        content:
          application/json:
            schema: { $ref: '${schemaReference}' }
      responses:
        '200': { description: ok }
`;

const petSchema = `Pet:
  type: object
  required: [id]
  properties:
    id: { type: string }
`;

describe('Spectral API design runtime', () => {
  it('resolves selected multi-file references for linting and request generation', async () => {
    const design: ApiDesign = {
      id: 'pets',
      name: 'Pets',
      contents: source('./schemas/pet%20one.yaml#/Pet'),
      sourceFiles: [{ path: 'schemas/pet one.yaml', contents: petSchema }],
    };
    const analysis = await analyzeOpenApiDesign(design);
    expect(analysis.issues.some((issue) => issue.code === 'invalid-ref')).toBe(false);
    expect((analysis.document?.paths as Record<string, any>)['/pets'].post.requestBody.content['application/json'].schema.properties.id.type).toBe('string');

    const collection = generateCollectionFromOpenApi(design, analysis);
    expect(collection.requests[0]).toMatchObject({ method: 'POST', url: 'https://api.example.com/pets', bodyMode: 'json' });
    expect(JSON.parse(collection.requests[0].body)).toEqual({ id: '' });
  }, 20_000);

  it('loads nested local ruleset extends with every exported safe built-in function', async () => {
    const functions = [
      ['alphabetical', ''], ['casing', ', functionOptions: { type: camel }'], ['defined', ''],
      ['enumeration', ', functionOptions: { values: [x] }'], ['falsy', ''], ['length', ', functionOptions: { min: 0 }'],
      ['or', ', functionOptions: { properties: [one, two] }'], ['pattern', ", functionOptions: { match: '.*' }"],
      ['schema', ', functionOptions: { schema: {} }'], ['truthy', ''], ['undefined', ''],
      ['unreferencedReusableObject', ", functionOptions: { reusableObjectsLocation: '#/components/schemas' }"],
      ['xor', ', functionOptions: { properties: [one, two] }'],
    ];
    const inertRules = functions.map(([name, options]) => `  safe-${name}:
    given: $.never.selected
    then: { function: ${name}${options} }
`).join('');
    const lint = await lintOpenApiWithSpectral({
      contents: source('./schemas/pet.yaml#/Pet'),
      ruleset: 'extends: ./rules/base.yaml\n',
      sourceFiles: [
        { path: 'schemas/pet.yaml', contents: petSchema },
        { path: 'rules/base.yaml', contents: `rules:\n${inertRules}  operation-summary:\n    severity: error\n    given: $.paths.*.*\n    then: { field: summary, function: truthy }\n` },
      ],
    });
    expect(lint.issues).toEqual([]);
  }, 20_000);

  it('resolves HTTPS document references and remote ruleset extends through the bounded reader', async () => {
    const requested: string[] = [];
    const remote = new Map([
      ['https://spec.example/schemas/pet.yaml', petSchema],
      ['https://rules.example/base.yaml', 'extends: ./nested.yaml\nrules:\n  operation-summary:\n    severity: error\n    given: $.paths.*.*\n    then: { field: summary, function: truthy }\n'],
      ['https://rules.example/nested.yaml', 'rules:\n  info-title:\n    given: $.info\n    then: { field: title, function: truthy }\n'],
    ]);
    const fetchRemote = async (url: string) => {
      requested.push(url);
      const contents = remote.get(url);
      if (!contents) throw new Error(`Unexpected URL ${url}`);
      return contents;
    };
    const lint = await lintOpenApiWithSpectral({
      contents: source('https://spec.example/schemas/pet.yaml#/Pet'),
      ruleset: 'extends: https://rules.example/base.yaml\n',
      fetchRemote,
    });
    expect(lint.issues).toEqual([]);
    expect(requested).toEqual(['https://rules.example/base.yaml', 'https://rules.example/nested.yaml', 'https://spec.example/schemas/pet.yaml']);
  }, 20_000);

  it('rejects unsafe, executable, cyclic, and package ruleset sources', async () => {
    const unsafeReference = await lintOpenApiWithSpectral({
      contents: source('https://127.0.0.1/schema.yaml#/Pet'),
      ruleset: 'rules:\n  okay: { given: $, then: { function: truthy } }\n',
      fetchRemote: async () => petSchema,
    });
    expect(unsafeReference.issues).toContainEqual(expect.objectContaining({ code: 'invalid-ref', message: expect.stringMatching(/private or loopback/) }));
    await expect(lintOpenApiWithSpectral({
      contents: source('./pet.yaml#/Pet'),
      ruleset: 'functions: [danger]\nrules: {}\n',
      sourceFiles: [{ path: 'pet.yaml', contents: petSchema }],
    })).rejects.toThrow(/unsupported top-level keys: functions/);
    await expect(lintOpenApiWithSpectral({
      contents: source('./pet.yaml#/Pet'),
      ruleset: 'extends: company-spectral-config\n',
      sourceFiles: [{ path: 'pet.yaml', contents: petSchema }],
    })).rejects.toThrow(/not a built-in identifier/);
    await expect(lintOpenApiWithSpectral({
      contents: source('./pet.yaml#/Pet'),
      ruleset: 'extends: ./a.yaml\n',
      sourceFiles: [
        { path: 'pet.yaml', contents: petSchema },
        { path: 'a.yaml', contents: 'extends: ./.spectral.yaml\n' },
        { path: '.spectral.yaml', contents: 'extends: ./a.yaml\n' },
      ],
    })).rejects.toThrow(/cycle detected/);
  }, 20_000);

  it('normalizes selected source paths and enforces count, uniqueness, and size bounds', () => {
    expect(normalizeApiDesignSourceFiles([{ path: './schemas\\pet.yaml', contents: petSchema }])[0].path).toBe('schemas/pet.yaml');
    expect(() => normalizeApiDesignSourceFiles([{ path: '../pet.yaml', contents: petSchema }])).toThrow(/escapes/);
    expect(() => normalizeApiDesignSourceFiles([
      { path: 'pet.yaml', contents: petSchema },
      { path: './pet.yaml', contents: petSchema },
    ])).toThrow(/duplicated/);
    expect(() => normalizeApiDesignSourceFiles([{ path: 'large.yaml', contents: 'x'.repeat(1_000_001) }])).toThrow(/1 MB/);
    expect(() => normalizeApiDesignSourceFiles(Array.from({ length: 101 }, (_, index) => ({ path: `${index}.yaml`, contents: '{}' })))).toThrow(/at most 100/);
  });
});
