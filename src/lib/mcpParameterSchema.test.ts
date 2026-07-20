import { describe, expect, it } from 'vitest';
import type { JsonValue } from '../types';
import {
  initialMcpParameterValue,
  initialMcpToolParameters,
  mcpParameterIssues,
  mcpParameterSchemaNode,
  mcpParameterValueAtPath,
  mcpParameterVariantKey,
  mcpScalarInputValue,
  mcpScalarOptionKey,
  renameMcpParameterValue,
  withMcpParameterValue,
  withoutMcpParameterValue,
} from './mcpParameterSchema';

describe('MCP recursive tool parameter schemas', () => {
  it('resolves nested defaults, arrays, and recursive local references', () => {
    const schema = {
      type: 'object',
      $defs: {
        person: {
          type: 'object',
          properties: {
            name: { type: 'string', default: 'Ada' },
            manager: { $ref: '#/$defs/person' },
          },
        },
      },
      properties: {
        owner: { $ref: '#/$defs/person' },
        tags: { type: 'array', items: { type: 'string' } },
      },
    };

    expect(initialMcpToolParameters(schema)).toEqual({ owner: { name: 'Ada' }, tags: [] });
    const owner = mcpParameterSchemaNode(schema.properties.owner, schema, { name: 'Grace' });
    expect(owner.type).toBe('object');
    expect(owner.properties.map((property) => property.name)).toEqual(['name', 'manager']);
    const manager = mcpParameterSchemaNode(owner.properties[1].schema, schema, { name: 'Lin' });
    expect(manager.properties.map((property) => property.name)).toEqual(['name', 'manager']);
  });

  it('merges allOf, dependent schemas, and if/then/else branches', () => {
    const schema = {
      type: 'object',
      allOf: [{ properties: { mode: { type: 'string', enum: ['simple', 'advanced'], default: 'advanced' } }, required: ['mode'] }],
      properties: { token: { type: 'string' }, confirmation: { type: 'string' } },
      dependentSchemas: { token: { properties: { audience: { type: 'string' } }, required: ['audience'] } },
      dependentRequired: { token: ['confirmation'] },
      if: { properties: { mode: { const: 'advanced' } }, required: ['mode'] },
      then: { properties: { retries: { type: 'integer', default: 3 } }, required: ['retries'] },
      else: { properties: { endpoint: { type: 'string' } } },
    };

    const advanced = mcpParameterSchemaNode(schema, schema, { mode: 'advanced', token: 'reviewed' });
    expect(advanced.properties.map((property) => [property.name, property.required])).toEqual([
      ['token', false], ['confirmation', true], ['mode', true], ['audience', true], ['retries', true],
    ]);
    const simple = mcpParameterSchemaNode(schema, schema, { mode: 'simple' });
    expect(simple.properties.map((property) => property.name)).toEqual(['token', 'confirmation', 'mode', 'endpoint']);
    expect(initialMcpToolParameters(schema)).toEqual({ mode: 'advanced', retries: 3 });
    expect(mcpParameterIssues(schema, { mode: 'advanced', token: 'reviewed' })).toEqual([
      '$.confirmation is required.', '$.audience is required.', '$.retries is required.',
    ]);
    expect(mcpParameterIssues(schema, { mode: 'advanced', token: 'reviewed', confirmation: 'yes', audience: 'tools', retries: 3 })).toEqual([]);
  });

  it('selects oneOf and anyOf branches from values or an explicit form choice', () => {
    const targetSchema: JsonValue = {
      oneOf: [
        { title: 'By ID', type: 'object', properties: { id: { type: 'integer' } }, required: ['id'] },
        { title: 'By name', type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
      ],
    };
    const schema: JsonValue = {
      type: 'object',
      $defs: { target: targetSchema },
      properties: { target: { $ref: '#/$defs/target' } },
    };
    const reference: JsonValue = { $ref: '#/$defs/target' };
    const inferred = mcpParameterSchemaNode(reference, schema, { name: 'tools' });
    expect(inferred.variantIndex).toBe(1);
    expect(inferred.properties.map((property) => property.name)).toEqual(['name']);
    const selected = mcpParameterSchemaNode(reference, schema, { name: 'tools' }, 0);
    expect(selected.variantIndex).toBe(0);
    expect(selected.properties.map((property) => property.name)).toEqual(['id']);
    expect(selected.variants.map((variant) => variant.title)).toEqual(['By ID', 'By name']);
    expect(mcpParameterIssues(reference, { name: 'tools' }, schema, { 'tool:[]': 0 }, 'tool')).toEqual(['$.id is required.']);
  });

  it('preserves typed scalar choices and bounded form metadata', () => {
    const schema = {
      type: 'object',
      required: ['query', 'limit'],
      properties: {
        query: { type: 'string', title: 'Search query', description: 'Words to find', default: 'oauth' },
        limit: { type: 'integer', default: 10 },
        mode: { type: ['string', 'null'], enum: ['fast', 'deep', null] },
        enabled: { type: 'boolean', const: true },
      },
      additionalProperties: { type: 'string' },
    };
    const node = mcpParameterSchemaNode(schema, schema);
    expect(node.properties.map((property) => [property.name, property.required])).toEqual([['query', true], ['limit', true], ['mode', false], ['enabled', false]]);
    expect(node.additionalProperties).toEqual({ type: 'string' });
    expect(initialMcpToolParameters(schema)).toEqual({ query: 'oauth', limit: 10, enabled: true });
    expect(mcpParameterSchemaNode(schema.properties.mode, schema).options.map((option) => option.value)).toEqual(['fast', 'deep', null]);
    expect(mcpScalarInputValue('integer', '4.8')).toBe(4);
    expect(mcpScalarInputValue('number', '-')).toBe('-');
    expect(mcpScalarInputValue('boolean', 'true')).toBe(true);
    expect(mcpScalarOptionKey(false)).toBe('boolean:false');
  });

  it('updates, removes, and renames nested object and array values without mutation', () => {
    const original = { profile: { name: 'Ada', tags: ['one'] }, keep: true };
    const updated = withMcpParameterValue(original, ['profile', 'tags', 1], 'two');
    expect(updated).toEqual({ profile: { name: 'Ada', tags: ['one', 'two'] }, keep: true });
    expect(original).toEqual({ profile: { name: 'Ada', tags: ['one'] }, keep: true });
    expect(mcpParameterValueAtPath(updated, ['profile', 'tags', 1])).toBe('two');
    expect(withoutMcpParameterValue(updated, ['profile', 'tags', 0])).toEqual({ profile: { name: 'Ada', tags: ['two'] }, keep: true });
    expect(renameMcpParameterValue(updated, ['profile'], 'name', 'displayName')).toEqual({ profile: { displayName: 'Ada', tags: ['one', 'two'] }, keep: true });
    expect(renameMcpParameterValue(updated, ['profile'], 'name', 'tags')).toEqual(updated);
    expect(mcpParameterVariantKey('client/tool', ['target', 0])).toBe('client/tool:["target",0]');
  });

  it('stops malformed and over-deep schemas at a reviewable JSON fallback', () => {
    const properties = Object.fromEntries(Array.from({ length: 205 }, (_, index) => [`field${index}`, { type: 'string' }]));
    const bounded = mcpParameterSchemaNode({ type: 'object', properties });
    expect(bounded.properties).toHaveLength(200);
    expect(bounded.truncated).toBe(true);
    expect(mcpParameterSchemaNode({ $ref: '#/$defs/missing' }, { $defs: {} }).type).toBe('unknown');
    expect(initialMcpParameterValue(false)).toBeUndefined();
    expect(mcpParameterIssues(false, 'blocked')).toEqual(['$ is forbidden by the server schema.']);
    expect(mcpParameterIssues({ type: 'object', additionalProperties: false }, { extra: true })).toEqual(['$.extra is not allowed by the server schema.']);
  });
});
