export type ScriptExpect = ((actual: unknown, message?: string) => any) & { fail: (...args: unknown[]) => never };

/**
 * Builds the finite chainable assertion surface exposed to scripts. Keep this
 * function self-contained: its source is serialized into the disposable Worker.
 */
export const createScriptExpect = (): ScriptExpect => {
  const same = (left: unknown, right: unknown) => {
    try { return JSON.stringify(left) === JSON.stringify(right); } catch { return left === right; }
  };
  const tag = (value: unknown) => Object.prototype.toString.call(value).slice(8, -1).toLowerCase();
  const typeName = (value: unknown) => value && typeof value === 'object' && Symbol.toStringTag in value ? String((value as { [Symbol.toStringTag]: unknown })[Symbol.toStringTag]).toLowerCase() : tag(value);
  const sizeOf = (value: unknown) => value instanceof Map || value instanceof Set ? value.size : (value as { length?: number } | null | undefined)?.length;
  const pathResult = (value: unknown, path: unknown) => {
    const parts = String(path).replace(/\\([.\[\]\\])/g, (_match, escaped) => `\u0000${escaped.charCodeAt(0)}\u0000`).replace(/\[(?:'([^']+)'|"([^"]+)"|(\w+))\]/g, (_match, single, quoted, plain) => `.${single ?? quoted ?? plain}`).split('.').filter(Boolean).map((part) => part.replace(/\u0000(\d+)\u0000/g, (_match, code) => String.fromCharCode(Number(code))));
    let current = value;
    for (const part of parts) {
      if (current == null || !(part in Object(current))) return { found: false, value: undefined };
      current = (current as Record<string, unknown>)[part];
    }
    return { found: true, value: current };
  };
  const keysOf = (value: unknown): unknown[] => value instanceof Map ? [...value.keys()] : value instanceof Set ? [...value.values()] : value && (typeof value === 'object' || typeof value === 'function') ? Object.keys(value) : [];
  const includes = (actual: unknown, expected: unknown, flags: Record<string, unknown>) => {
    const compare = (left: unknown, right: unknown) => flags.deep ? same(left, right) : left === right;
    if (typeof actual === 'string') return actual.includes(String(expected));
    if (Array.isArray(actual)) return actual.some((item) => compare(item, expected));
    if (actual instanceof Set || actual instanceof Map) return [...actual.values()].some((item) => compare(item, expected));
    if (!actual || typeof actual !== 'object' || !expected || typeof expected !== 'object') return false;
    return Object.entries(expected as Record<string, unknown>).every(([name, value]) => {
      if (flags.nested) { const result = pathResult(actual, name); return result.found && compare(result.value, value); }
      const exists = flags.own ? Object.prototype.hasOwnProperty.call(actual, name) : name in Object(actual);
      return exists && compare((actual as Record<string, unknown>)[name], value);
    });
  };
  const memberSubset = (actual: unknown[], expected: unknown[], deep: boolean) => expected.every((item) => actual.some((candidate) => deep ? same(candidate, item) : candidate === item));
  const readMutation = (target: unknown, property?: string) => typeof target === 'function' && property === undefined ? (target as () => unknown)() : (target as Record<string, unknown> | null | undefined)?.[property ?? ''];

  type Flags = { negated?: boolean; deep?: boolean; nested?: boolean; own?: boolean; ordered?: boolean; any?: boolean; contains?: boolean; itself?: boolean; mutation?: 'change' | 'increase' | 'decrease' };
  const expect = ((initial: unknown, baseMessage?: string) => {
    const make = (actual: unknown, flags: Flags = {}): any => {
      let proxy: any;
      const verify = (condition: unknown, fallback: string, message?: unknown) => {
        if (flags.negated ? Boolean(condition) : !condition) throw new Error(typeof message === 'string' ? message : baseMessage || fallback);
      };
      const next = (value = actual, nextFlags = flags) => make(value, nextFlags);
      const method = (name: string, args: unknown[]) => {
        if (name === 'a') { const expected = String(args[0]).toLowerCase(); verify(typeName(actual) === expected, `Expected value to be a ${expected}`, args[1]); return proxy; }
        if (name === 'include') { verify(includes(actual, args[0], flags), 'Expected value to include the requested member', args[1]); return proxy; }
        if (name === 'equal') { verify(flags.deep ? same(actual, args[0]) : actual === args[0], 'Expected values to equal', args[1]); return proxy; }
        if (name === 'eql') { verify(same(actual, args[0]), 'Expected values to deeply equal', args[1]); return proxy; }
        if (name === 'above') { verify((actual as number | Date) > (args[0] as number | Date), `Expected ${actual} to be above ${args[0]}`, args[1]); return proxy; }
        if (name === 'least') { verify((actual as number | Date) >= (args[0] as number | Date), `Expected ${actual} to be at least ${args[0]}`, args[1]); return proxy; }
        if (name === 'below') { verify((actual as number | Date) < (args[0] as number | Date), `Expected ${actual} to be below ${args[0]}`, args[1]); return proxy; }
        if (name === 'most') { verify((actual as number | Date) <= (args[0] as number | Date), `Expected ${actual} to be at most ${args[0]}`, args[1]); return proxy; }
        if (name === 'within') { verify((actual as number | Date) >= (args[0] as number | Date) && (actual as number | Date) <= (args[1] as number | Date), `Expected ${actual} to be within the requested range`, args[2]); return proxy; }
        if (name === 'instanceof') { verify(typeof args[0] === 'function' && actual instanceof (args[0] as new (...values: never[]) => unknown), 'Expected value to be an instance of the constructor', args[1]); return proxy; }
        if (name === 'property' || name === 'ownProperty') {
          const property = String(args[0]);
          const result = flags.nested && name !== 'ownProperty' ? pathResult(actual, property) : { found: actual != null && (name === 'ownProperty' || flags.own ? Object.prototype.hasOwnProperty.call(actual, property) : property in Object(actual)), value: actual == null ? undefined : (actual as Record<string, unknown>)[property] };
          verify(result.found && (args.length < 2 || (flags.deep ? same(result.value, args[1]) : result.value === args[1])), `Expected value to have property ${property}`, args[2]);
          return next(result.value);
        }
        if (name === 'ownPropertyDescriptor') {
          const descriptor = actual == null ? undefined : Object.getOwnPropertyDescriptor(Object(actual), String(args[0]));
          verify(Boolean(descriptor) && (args.length < 2 || same(descriptor, args[1])), `Expected an own property descriptor for ${args[0]}`, args[2]);
          return next(descriptor);
        }
        if (name === 'lengthOf') { const length = sizeOf(actual); verify(length === args[0], `Expected length or size ${args[0]} but got ${length}`, args[1]); return proxy; }
        if (name === 'match') { verify(args[0] instanceof RegExp && args[0].test(String(actual)), `Expected value to match ${args[0]}`, args[1]); return proxy; }
        if (name === 'string') { verify(typeof actual === 'string' && actual.includes(String(args[0])), `Expected string to contain ${args[0]}`, args[1]); return proxy; }
        if (name === 'keys') {
          const single = args[0];
          const expected = (args.length === 1 && Array.isArray(single) ? single : args.length === 1 && single && typeof single === 'object' && !(single instanceof Map) && !(single instanceof Set) ? Object.keys(single) : args).map((value) => value);
          const actualKeys = keysOf(actual);
          const has = (key: unknown) => actualKeys.some((candidate) => flags.deep ? same(candidate, key) : candidate === key || String(candidate) === String(key));
          const condition = flags.any ? expected.some(has) : expected.every(has) && (flags.contains || actualKeys.length === expected.length);
          verify(condition, `Expected value to have ${flags.any ? 'any' : 'all'} requested keys`);
          return proxy;
        }
        if (name === 'throw') {
          let thrown: unknown;
          try { (actual as () => unknown)(); } catch (error) { thrown = error; }
          const expected = args[0];
          const matcher = expected instanceof RegExp || typeof expected === 'string' ? expected : args[1];
          const typeMatches = thrown !== undefined && (!expected || expected instanceof RegExp || typeof expected === 'string' || (typeof expected === 'function' && thrown instanceof (expected as new (...values: never[]) => unknown)) || thrown === expected);
          const text = String((thrown as Error | undefined)?.message ?? thrown);
          const messageMatches = !matcher || (matcher instanceof RegExp ? matcher.test(text) : text.includes(String(matcher)));
          verify(typeMatches && messageMatches, 'Expected function to throw a matching error', args[2]);
          return next(thrown);
        }
        if (name === 'respondTo') { const target = typeof actual === 'function' && !flags.itself ? actual.prototype : actual; verify(typeof (target as Record<string, unknown> | null | undefined)?.[String(args[0])] === 'function', `Expected value to respond to ${args[0]}`, args[1]); return proxy; }
        if (name === 'satisfy') { verify(typeof args[0] === 'function' && Boolean((args[0] as (value: unknown) => unknown)(actual)), 'Expected value to satisfy predicate', args[1]); return proxy; }
        if (name === 'closeTo') { verify(typeof actual === 'number' && Math.abs(actual - Number(args[0])) <= Number(args[1]), `Expected ${actual} to be close to ${args[0]}`, args[2]); return proxy; }
        if (name === 'members') {
          const expected = Array.isArray(args[0]) ? args[0] : [];
          const values = Array.isArray(actual) ? actual : [];
          const condition = flags.ordered ? same(values.slice(0, flags.contains ? expected.length : values.length), expected) : memberSubset(values, expected, Boolean(flags.deep)) && (flags.contains || values.length === expected.length);
          verify(condition, 'Expected arrays to have the requested members', args[1]);
          return proxy;
        }
        if (name === 'oneOf') { verify(Array.isArray(args[0]) && args[0].includes(actual), 'Expected value to be one of the requested values', args[1]); return proxy; }
        if (name === 'change' || name === 'increase' || name === 'decrease') {
          const target = args[0];
          const property = typeof target === 'function' ? undefined : typeof args[1] === 'string' ? args[1] : undefined;
          const before = readMutation(target, property);
          (actual as () => unknown)();
          const after = readMutation(target, property);
          const delta = Number(after) - Number(before);
          const condition = name === 'change' ? !same(before, after) : name === 'increase' ? delta > 0 : delta < 0;
          verify(condition, `Expected function to ${name}`, typeof target === 'function' ? args[1] : args[2]);
          return next(delta, { ...flags, mutation: name });
        }
        if (name === 'by') { const expected = flags.mutation === 'decrease' ? -Math.abs(Number(args[0])) : Number(args[0]); verify(actual === expected, `Expected change by ${args[0]}`, args[1]); return proxy; }
        if (name === 'toBe') { verify(actual === args[0], 'Expected values to be identical', args[1]); return proxy; }
        if (name === 'toEqual') { verify(same(actual, args[0]), 'Expected values to deeply equal', args[1]); return proxy; }
        if (name === 'toContain') { verify(includes(actual, args[0], flags), 'Expected value to contain member', args[1]); return proxy; }
        if (name === 'toBeTruthy') { verify(Boolean(actual), 'Expected value to be truthy'); return proxy; }
        if (name === 'toBeLessThan') { verify(Number(actual) < Number(args[0]), `Expected ${actual} to be less than ${args[0]}`); return proxy; }
        if (name === 'toBeGreaterThan') { verify(Number(actual) > Number(args[0]), `Expected ${actual} to be greater than ${args[0]}`); return proxy; }
        return proxy;
      };
      const aliases: Record<string, string> = {
        an: 'a', includes: 'include', contain: 'include', contains: 'include', equals: 'equal', eq: 'equal', eqls: 'eql',
        gt: 'above', greaterThan: 'above', gte: 'least', lt: 'below', lessThan: 'below', lte: 'most', instanceOf: 'instanceof',
        ownProperty: 'ownProperty', haveOwnProperty: 'ownProperty', haveOwnPropertyDescriptor: 'ownPropertyDescriptor', length: 'lengthOf', matches: 'match', key: 'keys', throws: 'throw', Throw: 'throw',
        respondsTo: 'respondTo', satisfies: 'satisfy', approximately: 'closeTo', changes: 'change', increases: 'increase', decreases: 'decrease',
      };
      const methods = new Set(['a', 'include', 'equal', 'eql', 'above', 'least', 'below', 'most', 'within', 'instanceof', 'property', 'ownProperty', 'ownPropertyDescriptor', 'lengthOf', 'match', 'string', 'keys', 'throw', 'respondTo', 'satisfy', 'closeTo', 'members', 'oneOf', 'change', 'increase', 'decrease', 'by', 'toBe', 'toEqual', 'toContain', 'toBeTruthy', 'toBeLessThan', 'toBeGreaterThan']);
      const language = new Set(['to', 'be', 'been', 'is', 'that', 'which', 'and', 'has', 'have', 'with', 'at', 'of', 'same', 'but', 'does', 'still', 'also']);
      const target = {};
      proxy = new Proxy(target, {
        get(_object, key) {
          if (typeof key !== 'string') return undefined;
          if (language.has(key)) return proxy;
          if (key === 'not') return next(actual, { ...flags, negated: !flags.negated });
          if (key === 'all') return next(actual, { ...flags, any: false });
          if (['deep', 'nested', 'own', 'ordered', 'any', 'itself'].includes(key)) return next(actual, { ...flags, [key]: true });
          const getterConditions: Record<string, [unknown, string]> = {
            ok: [Boolean(actual), 'Expected value to be truthy'], true: [actual === true, 'Expected value to be true'], false: [actual === false, 'Expected value to be false'],
            null: [actual === null, 'Expected value to be null'], undefined: [actual === undefined, 'Expected value to be undefined'], NaN: [typeof actual === 'number' && Number.isNaN(actual), 'Expected value to be NaN'],
            exist: [actual !== null && actual !== undefined, 'Expected value to exist'], empty: [(sizeOf(actual) ?? (actual && typeof actual === 'object' ? Object.keys(actual).length : undefined)) === 0, 'Expected value to be empty'],
            arguments: [tag(actual) === 'arguments', 'Expected value to be arguments'], extensible: [Boolean(actual && typeof actual === 'object' && Object.isExtensible(actual)), 'Expected value to be extensible'],
            sealed: [Boolean(actual && typeof actual === 'object' && Object.isSealed(actual)), 'Expected value to be sealed'], frozen: [Boolean(actual && typeof actual === 'object' && Object.isFrozen(actual)), 'Expected value to be frozen'],
            finite: [typeof actual === 'number' && Number.isFinite(actual), 'Expected value to be finite'],
          };
          if (key === 'exists') return Reflect.get(proxy, 'exist');
          if (key === 'Arguments') return Reflect.get(proxy, 'arguments');
          if (key in getterConditions) { const [condition, message] = getterConditions[key]; verify(condition, message); return proxy; }
          const canonical = aliases[key] ?? key;
          if (!methods.has(canonical)) return undefined;
          const callable = (...args: unknown[]) => method(canonical, args);
          return new Proxy(callable, {
            get(_function, child) {
              const chainFlags = canonical === 'include' ? { ...flags, contains: true } : flags;
              const chainActual = canonical === 'lengthOf' ? sizeOf(actual) : actual;
              return Reflect.get(make(chainActual, chainFlags), child);
            },
          });
        },
      });
      return proxy;
    };
    return make(initial);
  }) as ScriptExpect;
  expect.fail = (...args: unknown[]): never => { throw new Error(typeof args[0] === 'string' && args.length === 1 ? args[0] : typeof args[2] === 'string' ? args[2] : 'Assertion failed'); };
  return expect;
};
