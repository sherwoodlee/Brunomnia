import { describe, expect, it } from 'vitest';
import { initialMcpToolParameters, mcpScalarInputValue, mcpScalarOptionKey, mcpToolParameterSchema } from './mcpParameterSchema';

describe('MCP scalar tool parameter schemas', () => {
  it('normalizes ordered fields, requirements, defaults, enums, and complex fallbacks', () => {
    const schema = mcpToolParameterSchema({
      type: 'object',
      required: ['query', 'limit'],
      properties: {
        query: { type: 'string', title: 'Search query', description: 'Words to find', default: 'oauth' },
        limit: { type: 'integer', default: 10 },
        mode: { type: ['string', 'null'], enum: ['fast', 'deep'] },
        enabled: { type: 'boolean', const: true },
        filters: { type: 'array', items: { type: 'string' } },
      },
    });

    expect(schema.fields.map((field) => field.name)).toEqual(['query', 'limit', 'mode', 'enabled']);
    expect(schema.fields[0]).toMatchObject({ title: 'Search query', description: 'Words to find', required: true, type: 'string' });
    expect(schema.fields[2].options.map((option) => option.value)).toEqual(['fast', 'deep']);
    expect(schema.hasComplexFields).toBe(true);
    expect(initialMcpToolParameters(schema)).toEqual({ query: 'oauth', limit: 10 });
  });

  it('coerces scalar controls without turning incomplete numbers into invalid JSON', () => {
    const schema = mcpToolParameterSchema({ type: 'object', properties: { count: { type: 'integer' }, ratio: { type: 'number' }, enabled: { type: 'boolean' }, query: { type: 'string' } } });
    expect(mcpScalarInputValue(schema.fields[0], '4.8')).toBe(4);
    expect(mcpScalarInputValue(schema.fields[1], '1.25')).toBe(1.25);
    expect(mcpScalarInputValue(schema.fields[1], '-')).toBe('-');
    expect(mcpScalarInputValue(schema.fields[2], 'true')).toBe(true);
    expect(mcpScalarInputValue(schema.fields[3], '42')).toBe('42');
    expect(mcpScalarOptionKey(false)).toBe('boolean:false');
  });
});
