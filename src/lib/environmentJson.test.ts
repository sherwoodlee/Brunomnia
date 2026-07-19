import { describe, expect, it } from 'vitest';
import type { KeyValue } from '../types';
import { environmentRowVariables, environmentRowsToObject, environmentVariables, formatEnvironmentJson, parseEnvironmentJson } from './environmentJson';

const row = (id: string, name: string, value: string, enabled = true, valueType: KeyValue['valueType'] = 'string'): KeyValue => ({ id, name, value, enabled, valueType });

describe('raw JSON environments', () => {
  it('parses nested objects into typed rows and preserves stable IDs', () => {
    const parsed = parseEnvironmentJson('{"service":{"host":"api.test","ports":[443]},"retries":3,"enabled":true,"empty":null}', [row('service-row', 'service', '{}', true, 'json')], () => 'new-row');
    expect(parsed.error).toBeUndefined();
    expect(parsed.rows).toEqual([
      expect.objectContaining({ id: 'service-row', name: 'service', value: '{"host":"api.test","ports":[443]}', valueType: 'json' }),
      expect.objectContaining({ name: 'retries', value: '3', valueType: 'string' }),
      expect.objectContaining({ name: 'enabled', value: 'true', valueType: 'string' }),
      expect.objectContaining({ name: 'empty', value: 'null', valueType: 'string' }),
    ]);
  });

  it('drops disabled rows, keeps the final duplicate, and validates typed JSON', () => {
    const rows = [row('disabled', 'hidden', 'x', false), row('first', 'name', 'first'), row('last', 'name', '{"ok":true}', true, 'json')];
    expect(environmentRowsToObject(rows)).toEqual({ object: { name: { ok: true } }, disabledNames: ['hidden'], duplicateNames: ['name'] });
    expect(formatEnvironmentJson(rows).source).toBe('{\n  "name": {\n    "ok": true\n  }\n}');
    expect(environmentRowsToObject([row('bad', 'bad', '{', true, 'json')]).error).toContain('invalid JSON');
  });

  it('rejects non-object roots, unsafe keys, excessive depth, and oversized input', () => {
    expect(parseEnvironmentJson('[]', [], () => 'id').error).toContain('object at the root');
    expect(parseEnvironmentJson('{"a.b":1}', [], () => 'id').error).toContain("contain a '.'");
    expect(parseEnvironmentJson('{"vault":{}}', [], () => 'id').error).toContain('reserved root');
    expect(parseEnvironmentJson('x'.repeat(1_000_001), [], () => 'id').error).toContain('character limit');
    const deep = `${'{"value":'.repeat(52)}null${'}'.repeat(52)}`;
    expect(parseEnvironmentJson(deep, [], () => 'id').error).toContain('nesting limit');
  });

  it('exposes nested dot paths only for JSON-typed rows and applies masking order', () => {
    expect(environmentRowVariables(row('service', 'service', '{"host":"api.test","tls":{"enabled":true}}', true, 'json'))).toEqual({
      service: '{"host":"api.test","tls":{"enabled":true}}',
      'service.host': 'api.test',
      'service.tls': '{"enabled":true}',
      'service.tls.enabled': 'true',
    });
    expect(environmentVariables([
      row('base', 'service', '{"host":"old"}', true, 'json'),
      row('mask', 'service', '', false),
      row('next', 'service.host', 'new'),
    ])).toEqual({ 'service.host': 'new' });
  });

  it('preserves special object keys without changing record prototypes', () => {
    const parsed = parseEnvironmentJson('{"__proto__":{"polluted":true},"constructor":"safe"}', [], () => 'id');
    expect(parsed.rows).toHaveLength(2);
    const object = environmentRowsToObject(parsed.rows ?? []).object!;
    expect(Object.getPrototypeOf(object)).toBe(Object.prototype);
    expect(Object.prototype).not.toHaveProperty('polluted');
    expect(object).toHaveProperty('__proto__');
    expect(object.constructor).toBe('safe');
  });
});
