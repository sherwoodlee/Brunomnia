export type ScriptModuleRuntime = {
  atob: (value: string) => string;
  btoa: (value: string) => string;
  crypto: Pick<Crypto, 'randomUUID' | 'getRandomValues'>;
  expect: (value: unknown) => unknown;
  structuredClone: <T>(value: T) => T;
  TextDecoder: typeof TextDecoder;
  TextEncoder: typeof TextEncoder;
  URL: typeof URL;
  URLSearchParams: typeof URLSearchParams;
  setTimeout: typeof setTimeout;
  clearTimeout: typeof clearTimeout;
  setInterval: typeof setInterval;
  clearInterval: typeof clearInterval;
};

/**
 * Builds the finite module set exposed to scripts. Keep this function self-contained:
 * its source is serialized into the disposable browser Worker and is also called by the CLI.
 */
export const createScriptModules = (runtime: ScriptModuleRuntime): Record<string, unknown> => {
  const maximumInput = 5_000_000;
  const boundedText = (value: unknown) => {
    const text = String(value ?? '');
    if (text.length > maximumInput) throw new Error('Script module input exceeds 5 MB.');
    return text;
  };
  const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);
  const typeName = (value: unknown) => value === null ? 'null' : Array.isArray(value) ? 'array' : value instanceof RegExp ? 'regexp' : value instanceof Date ? 'date' : value instanceof Map ? 'map' : value instanceof Set ? 'set' : typeof value;
  const pathValue = (value: unknown, path: unknown) => String(path).replace(/\[(?:'([^']+)'|"([^"]+)"|(\w+))\]/g, (_match, single, quoted, plain) => `.${single ?? quoted ?? plain}`).split('.').filter(Boolean).reduce<unknown>((current, key) => (current as Record<string, unknown> | undefined)?.[key], value);
  const includes = (haystack: unknown, needle: unknown, deep = false) => {
    if (typeof haystack === 'string') return haystack.includes(String(needle));
    if (Array.isArray(haystack)) return haystack.some((item) => deep ? same(item, needle) : item === needle);
    if (haystack instanceof Set) return [...haystack].some((item) => deep ? same(item, needle) : item === needle);
    if (haystack && typeof haystack === 'object' && needle && typeof needle === 'object') return Object.entries(needle as Record<string, unknown>).every(([key, value]) => Object.prototype.hasOwnProperty.call(haystack, key) && (deep ? same((haystack as Record<string, unknown>)[key], value) : (haystack as Record<string, unknown>)[key] === value));
    return false;
  };
  const nestedIncludes = (haystack: unknown, needle: unknown, deep = false) => Boolean(needle && typeof needle === 'object') && Object.entries(needle as Record<string, unknown>).every(([path, expected]) => deep ? same(pathValue(haystack, path), expected) : pathValue(haystack, path) === expected);
  const objectKeys = (value: unknown): unknown[] => value instanceof Map ? [...value.keys()] : value instanceof Set ? [...value.values()] : value && typeof value === 'object' ? Object.keys(value) : [];
  const expectedKeys = (value: unknown): unknown[] => Array.isArray(value) ? value : value && typeof value === 'object' && !(value instanceof Map) && !(value instanceof Set) ? Object.keys(value) : [value];
  const hasKey = (keys: unknown[], expected: unknown, deep = false) => keys.some((key) => deep ? same(key, expected) : key === expected);
  const memberSubset = (actual: unknown, expected: unknown, deep = false) => Array.isArray(actual) && Array.isArray(expected) && expected.every((item) => actual.some((candidate) => deep ? same(candidate, item) : candidate === item));
  const lengthOrSize = (value: unknown) => value instanceof Map || value instanceof Set ? value.size : (value as { length?: number } | null | undefined)?.length;
  const assertCondition = (condition: unknown, message: string) => { if (!condition) throw new Error(message); };
  const measuredValue = (target: unknown, property?: string) => property === undefined && typeof target === 'function' ? (target as () => unknown)() : (target as Record<string, unknown> | null | undefined)?.[property ?? ''];
  const measureMutation = (modifier: () => unknown, target: unknown, property?: string) => { const before = measuredValue(target, property); modifier(); return { before, after: measuredValue(target, property) }; };
  const measureChange = (modifier: () => unknown, target: unknown, property?: string) => { const measured = measureMutation(modifier, target, property); return Number(measured.after) - Number(measured.before); };
  const mutationProperty = (target: unknown, property: unknown) => typeof target === 'function' ? undefined : typeof property === 'string' ? property : undefined;
  const mutationDelta = (target: unknown, propertyOrDelta: unknown, deltaOrMessage: unknown) => Number(typeof target === 'function' ? propertyOrDelta : deltaOrMessage);
  const mutationMessage = (target: unknown, propertyOrMessage: unknown, message: unknown) => typeof (typeof target === 'function' ? propertyOrMessage : message) === 'string' ? String(typeof target === 'function' ? propertyOrMessage : message) : undefined;
  const deltaMessage = (target: unknown, deltaOrMessage: unknown, message: unknown) => typeof (typeof target === 'function' ? deltaOrMessage : message) === 'string' ? String(typeof target === 'function' ? deltaOrMessage : message) : undefined;
  const assertion = Object.assign((condition: unknown, message?: string) => { if (!condition) throw new Error(message || 'Assertion failed'); }, {
    ok(condition: unknown, message?: string) { if (!condition) throw new Error(message || 'Expected value to be truthy'); },
    equal(actual: unknown, expected: unknown, message?: string) { if (actual != expected) throw new Error(message || 'Expected values to be equal'); },
    notEqual(actual: unknown, expected: unknown, message?: string) { if (actual == expected) throw new Error(message || 'Expected values not to be equal'); },
    strictEqual(actual: unknown, expected: unknown, message?: string) { if (actual !== expected) throw new Error(message || 'Expected values to be strictly equal'); },
    notStrictEqual(actual: unknown, expected: unknown, message?: string) { if (actual === expected) throw new Error(message || 'Expected values not to be strictly equal'); },
    deepEqual(actual: unknown, expected: unknown, message?: string) { if (!same(actual, expected)) throw new Error(message || 'Expected values to be deeply equal'); },
    deepStrictEqual(actual: unknown, expected: unknown, message?: string) { if (!same(actual, expected)) throw new Error(message || 'Expected values to be deeply equal'); },
    fail(message?: string) { throw new Error(message || 'Assertion failed'); },
    match(value: unknown, expression: RegExp, message?: string) { if (!expression.test(String(value))) throw new Error(message || 'Expected value to match expression'); },
    doesNotMatch(value: unknown, expression: RegExp, message?: string) { if (expression.test(String(value))) throw new Error(message || 'Expected value not to match expression'); },
    throws(callback: () => unknown, expression?: RegExp) { try { callback(); } catch (error) { if (!expression || expression.test(String(error))) return error; throw error; } throw new Error('Expected function to throw'); },
    doesNotThrow(callback: () => unknown) { callback(); },
    async rejects(callback: Promise<unknown> | (() => Promise<unknown>), expression?: RegExp) { try { await (typeof callback === 'function' ? callback() : callback); } catch (error) { if (!expression || expression.test(String(error))) return error; throw error; } throw new Error('Expected promise to reject'); },
  });
  Object.assign(assertion, {
    notOk(value: unknown, message?: string) { assertCondition(!value, message || 'Expected value to be falsy'); },
    isOk(value: unknown, message?: string) { assertCondition(Boolean(value), message || 'Expected value to be truthy'); },
    isNotOk(value: unknown, message?: string) { assertCondition(!value, message || 'Expected value to be falsy'); },
    notDeepEqual(actual: unknown, expected: unknown, message?: string) { assertCondition(!same(actual, expected), message || 'Expected values not to be deeply equal'); },
    notDeepStrictEqual(actual: unknown, expected: unknown, message?: string) { assertCondition(!same(actual, expected), message || 'Expected values not to be deeply equal'); },
    isTrue(value: unknown, message?: string) { assertCondition(value === true, message || 'Expected value to be true'); },
    isNotTrue(value: unknown, message?: string) { assertCondition(value !== true, message || 'Expected value not to be true'); },
    isFalse(value: unknown, message?: string) { assertCondition(value === false, message || 'Expected value to be false'); },
    isNotFalse(value: unknown, message?: string) { assertCondition(value !== false, message || 'Expected value not to be false'); },
    isNull(value: unknown, message?: string) { assertCondition(value === null, message || 'Expected value to be null'); },
    isNotNull(value: unknown, message?: string) { assertCondition(value !== null, message || 'Expected value not to be null'); },
    isNaN(value: unknown, message?: string) { assertCondition(typeof value === 'number' && Number.isNaN(value), message || 'Expected value to be NaN'); },
    isNotNaN(value: unknown, message?: string) { assertCondition(!(typeof value === 'number' && Number.isNaN(value)), message || 'Expected value not to be NaN'); },
    exists(value: unknown, message?: string) { assertCondition(value !== null && value !== undefined, message || 'Expected value to exist'); },
    notExists(value: unknown, message?: string) { assertCondition(value === null || value === undefined, message || 'Expected value not to exist'); },
    isUndefined(value: unknown, message?: string) { assertCondition(value === undefined, message || 'Expected value to be undefined'); },
    isDefined(value: unknown, message?: string) { assertCondition(value !== undefined, message || 'Expected value to be defined'); },
    isFunction(value: unknown, message?: string) { assertCondition(typeof value === 'function', message || 'Expected value to be a function'); },
    isNotFunction(value: unknown, message?: string) { assertCondition(typeof value !== 'function', message || 'Expected value not to be a function'); },
    isObject(value: unknown, message?: string) { assertCondition(typeName(value) === 'object', message || 'Expected value to be an object'); },
    isNotObject(value: unknown, message?: string) { assertCondition(typeName(value) !== 'object', message || 'Expected value not to be an object'); },
    isArray(value: unknown, message?: string) { assertCondition(Array.isArray(value), message || 'Expected value to be an array'); },
    isNotArray(value: unknown, message?: string) { assertCondition(!Array.isArray(value), message || 'Expected value not to be an array'); },
    isString(value: unknown, message?: string) { assertCondition(typeof value === 'string', message || 'Expected value to be a string'); },
    isNotString(value: unknown, message?: string) { assertCondition(typeof value !== 'string', message || 'Expected value not to be a string'); },
    isNumber(value: unknown, message?: string) { assertCondition(typeof value === 'number', message || 'Expected value to be a number'); },
    isNotNumber(value: unknown, message?: string) { assertCondition(typeof value !== 'number', message || 'Expected value not to be a number'); },
    isFinite(value: unknown, message?: string) { assertCondition(typeof value === 'number' && Number.isFinite(value), message || 'Expected value to be finite'); },
    isBoolean(value: unknown, message?: string) { assertCondition(typeof value === 'boolean', message || 'Expected value to be a boolean'); },
    isNotBoolean(value: unknown, message?: string) { assertCondition(typeof value !== 'boolean', message || 'Expected value not to be a boolean'); },
    typeOf(value: unknown, expected: string, message?: string) { assertCondition(typeName(value) === expected.toLowerCase(), message || `Expected value to have type ${expected}`); },
    notTypeOf(value: unknown, expected: string, message?: string) { assertCondition(typeName(value) !== expected.toLowerCase(), message || `Expected value not to have type ${expected}`); },
    instanceOf(value: unknown, expected: new (...args: never[]) => unknown, message?: string) { assertCondition(value instanceof expected, message || `Expected value to be an instance of ${expected.name}`); },
    notInstanceOf(value: unknown, expected: new (...args: never[]) => unknown, message?: string) { assertCondition(!(value instanceof expected), message || `Expected value not to be an instance of ${expected.name}`); },
    include(haystack: unknown, needle: unknown, message?: string) { assertCondition(includes(haystack, needle), message || 'Expected value to include member'); },
    notInclude(haystack: unknown, needle: unknown, message?: string) { assertCondition(!includes(haystack, needle), message || 'Expected value not to include member'); },
    deepInclude(haystack: unknown, needle: unknown, message?: string) { assertCondition(includes(haystack, needle, true), message || 'Expected value to deeply include member'); },
    notDeepInclude(haystack: unknown, needle: unknown, message?: string) { assertCondition(!includes(haystack, needle, true), message || 'Expected value not to deeply include member'); },
    nestedInclude(haystack: unknown, needle: unknown, message?: string) { assertCondition(nestedIncludes(haystack, needle), message || 'Expected value to include nested properties'); },
    notNestedInclude(haystack: unknown, needle: unknown, message?: string) { assertCondition(!nestedIncludes(haystack, needle), message || 'Expected value not to include nested properties'); },
    deepNestedInclude(haystack: unknown, needle: unknown, message?: string) { assertCondition(nestedIncludes(haystack, needle, true), message || 'Expected value to deeply include nested properties'); },
    notDeepNestedInclude(haystack: unknown, needle: unknown, message?: string) { assertCondition(!nestedIncludes(haystack, needle, true), message || 'Expected value not to deeply include nested properties'); },
    ownInclude(haystack: unknown, needle: unknown, message?: string) { assertCondition(includes(haystack, needle), message || 'Expected value to include own properties'); },
    notOwnInclude(haystack: unknown, needle: unknown, message?: string) { assertCondition(!includes(haystack, needle), message || 'Expected value not to include own properties'); },
    deepOwnInclude(haystack: unknown, needle: unknown, message?: string) { assertCondition(includes(haystack, needle, true), message || 'Expected value to deeply include own properties'); },
    notDeepOwnInclude(haystack: unknown, needle: unknown, message?: string) { assertCondition(!includes(haystack, needle, true), message || 'Expected value not to deeply include own properties'); },
    notMatch(value: unknown, expression: RegExp, message?: string) { assertCondition(!expression.test(String(value)), message || 'Expected value not to match expression'); },
    property(value: unknown, name: string, message?: string) { assertCondition(value != null && name in Object(value), message || `Expected property '${name}'`); },
    notProperty(value: unknown, name: string, message?: string) { assertCondition(value == null || !(name in Object(value)), message || `Expected no property '${name}'`); },
    propertyVal(value: unknown, name: string, expected: unknown, message?: string) { assertCondition(value != null && name in Object(value) && (value as Record<string, unknown>)[name] === expected, message || `Expected property '${name}' to equal value`); },
    notPropertyVal(value: unknown, name: string, expected: unknown, message?: string) { assertCondition(value == null || !(name in Object(value)) || (value as Record<string, unknown>)[name] !== expected, message || `Expected property '${name}' not to equal value`); },
    deepPropertyVal(value: unknown, name: string, expected: unknown, message?: string) { assertCondition(value != null && name in Object(value) && same((value as Record<string, unknown>)[name], expected), message || `Expected property '${name}' to deeply equal value`); },
    notDeepPropertyVal(value: unknown, name: string, expected: unknown, message?: string) { assertCondition(value == null || !(name in Object(value)) || !same((value as Record<string, unknown>)[name], expected), message || `Expected property '${name}' not to deeply equal value`); },
    nestedProperty(value: unknown, path: string, message?: string) { assertCondition(pathValue(value, path) !== undefined, message || `Expected nested property '${path}'`); },
    notNestedProperty(value: unknown, path: string, message?: string) { assertCondition(pathValue(value, path) === undefined, message || `Expected no nested property '${path}'`); },
    nestedPropertyVal(value: unknown, path: string, expected: unknown, message?: string) { assertCondition(pathValue(value, path) === expected, message || `Expected nested property '${path}' to equal value`); },
    notNestedPropertyVal(value: unknown, path: string, expected: unknown, message?: string) { assertCondition(pathValue(value, path) !== expected, message || `Expected nested property '${path}' not to equal value`); },
    deepNestedPropertyVal(value: unknown, path: string, expected: unknown, message?: string) { assertCondition(same(pathValue(value, path), expected), message || `Expected nested property '${path}' to deeply equal value`); },
    notDeepNestedPropertyVal(value: unknown, path: string, expected: unknown, message?: string) { assertCondition(!same(pathValue(value, path), expected), message || `Expected nested property '${path}' not to deeply equal value`); },
    lengthOf(value: unknown, expected: number, message?: string) { assertCondition(lengthOrSize(value) === expected, message || `Expected length or size ${expected}`); },
    hasAnyKeys(value: unknown, keys: unknown, message?: string) { const actual = objectKeys(value); assertCondition(expectedKeys(keys).some((key) => hasKey(actual, key)), message || 'Expected value to have any key'); },
    hasAllKeys(value: unknown, keys: unknown, message?: string) { const actual = objectKeys(value); const expected = expectedKeys(keys); assertCondition(actual.length === expected.length && expected.every((key) => hasKey(actual, key)), message || 'Expected value to have all keys'); },
    containsAllKeys(value: unknown, keys: unknown, message?: string) { const actual = objectKeys(value); assertCondition(expectedKeys(keys).every((key) => hasKey(actual, key)), message || 'Expected value to contain all keys'); },
    containsAnyKeys(value: unknown, keys: unknown, message?: string) { const actual = objectKeys(value); assertCondition(expectedKeys(keys).some((key) => hasKey(actual, key)), message || 'Expected value to contain any key'); },
    doesNotHaveAnyKeys(value: unknown, keys: unknown, message?: string) { const actual = objectKeys(value); assertCondition(expectedKeys(keys).every((key) => !hasKey(actual, key)), message || 'Expected value to have none of the keys'); },
    doesNotHaveAllKeys(value: unknown, keys: unknown, message?: string) { const actual = objectKeys(value); assertCondition(!expectedKeys(keys).every((key) => hasKey(actual, key)), message || 'Expected value not to have all keys'); },
    hasAnyDeepKeys(value: unknown, keys: unknown, message?: string) { const actual = objectKeys(value); assertCondition(expectedKeys(keys).some((key) => hasKey(actual, key, true)), message || 'Expected value to have any deep key'); },
    hasAllDeepKeys(value: unknown, keys: unknown, message?: string) { const actual = objectKeys(value); const expected = expectedKeys(keys); assertCondition(actual.length === expected.length && expected.every((key) => hasKey(actual, key, true)), message || 'Expected value to have all deep keys'); },
    containsAllDeepKeys(value: unknown, keys: unknown, message?: string) { const actual = objectKeys(value); assertCondition(expectedKeys(keys).every((key) => hasKey(actual, key, true)), message || 'Expected value to contain all deep keys'); },
    doesNotHaveAnyDeepKeys(value: unknown, keys: unknown, message?: string) { const actual = objectKeys(value); assertCondition(expectedKeys(keys).every((key) => !hasKey(actual, key, true)), message || 'Expected value to have none of the deep keys'); },
    doesNotHaveAllDeepKeys(value: unknown, keys: unknown, message?: string) { const actual = objectKeys(value); assertCondition(!expectedKeys(keys).every((key) => hasKey(actual, key, true)), message || 'Expected value not to have all deep keys'); },
    operator(left: unknown, operator: string, right: unknown, message?: string) { const valid = operator === '==' ? left == right : operator === '===' ? left === right : operator === '!=' ? left != right : operator === '!==' ? left !== right : operator === '>' ? (left as number) > (right as number) : operator === '>=' ? (left as number) >= (right as number) : operator === '<' ? (left as number) < (right as number) : operator === '<=' ? (left as number) <= (right as number) : false; assertCondition(valid, message || `Expected ${left} ${operator} ${right}`); },
    closeTo(actual: number, expected: number, delta: number, message?: string) { assertCondition(Math.abs(actual - expected) <= delta, message || `Expected ${actual} to be within ${delta} of ${expected}`); },
    approximately(actual: number, expected: number, delta: number, message?: string) { assertCondition(Math.abs(actual - expected) <= delta, message || `Expected ${actual} to approximate ${expected}`); },
    isAbove(actual: number, expected: number, message?: string) { assertCondition(actual > expected, message || `Expected ${actual} to be above ${expected}`); },
    isAtLeast(actual: number, expected: number, message?: string) { assertCondition(actual >= expected, message || `Expected ${actual} to be at least ${expected}`); },
    isBelow(actual: number, expected: number, message?: string) { assertCondition(actual < expected, message || `Expected ${actual} to be below ${expected}`); },
    isAtMost(actual: number, expected: number, message?: string) { assertCondition(actual <= expected, message || `Expected ${actual} to be at most ${expected}`); },
    isWithin(actual: number, start: number, finish: number, message?: string) { assertCondition(actual >= start && actual <= finish, message || `Expected ${actual} to be within ${start}..${finish}`); },
    oneOf(value: unknown, list: unknown[], message?: string) { assertCondition(list.includes(value), message || 'Expected value to be one of the list'); },
    sameMembers(actual: unknown[], expected: unknown[], message?: string) { assertCondition(actual.length === expected.length && memberSubset(actual, expected), message || 'Expected arrays to have the same members'); },
    notSameMembers(actual: unknown[], expected: unknown[], message?: string) { assertCondition(!(actual.length === expected.length && memberSubset(actual, expected)), message || 'Expected arrays not to have the same members'); },
    sameDeepMembers(actual: unknown[], expected: unknown[], message?: string) { assertCondition(actual.length === expected.length && memberSubset(actual, expected, true), message || 'Expected arrays to have the same deep members'); },
    notSameDeepMembers(actual: unknown[], expected: unknown[], message?: string) { assertCondition(!(actual.length === expected.length && memberSubset(actual, expected, true)), message || 'Expected arrays not to have the same deep members'); },
    includeMembers(actual: unknown[], expected: unknown[], message?: string) { assertCondition(memberSubset(actual, expected), message || 'Expected array to include members'); },
    notIncludeMembers(actual: unknown[], expected: unknown[], message?: string) { assertCondition(!memberSubset(actual, expected), message || 'Expected array not to include all members'); },
    includeDeepMembers(actual: unknown[], expected: unknown[], message?: string) { assertCondition(memberSubset(actual, expected, true), message || 'Expected array to deeply include members'); },
    notIncludeDeepMembers(actual: unknown[], expected: unknown[], message?: string) { assertCondition(!memberSubset(actual, expected, true), message || 'Expected array not to deeply include all members'); },
    sameOrderedMembers(actual: unknown[], expected: unknown[], message?: string) { assertCondition(same(actual, expected), message || 'Expected arrays to have ordered members'); },
    notSameOrderedMembers(actual: unknown[], expected: unknown[], message?: string) { assertCondition(!same(actual, expected), message || 'Expected arrays not to have ordered members'); },
    sameDeepOrderedMembers(actual: unknown[], expected: unknown[], message?: string) { assertCondition(same(actual, expected), message || 'Expected arrays to have deep ordered members'); },
    notSameDeepOrderedMembers(actual: unknown[], expected: unknown[], message?: string) { assertCondition(!same(actual, expected), message || 'Expected arrays not to have deep ordered members'); },
    includeOrderedMembers(actual: unknown[], expected: unknown[], message?: string) { assertCondition(same(actual.slice(0, expected.length), expected), message || 'Expected array to include ordered members'); },
    notIncludeOrderedMembers(actual: unknown[], expected: unknown[], message?: string) { assertCondition(!same(actual.slice(0, expected.length), expected), message || 'Expected array not to include ordered members'); },
    includeDeepOrderedMembers(actual: unknown[], expected: unknown[], message?: string) { assertCondition(same(actual.slice(0, expected.length), expected), message || 'Expected array to include deep ordered members'); },
    notIncludeDeepOrderedMembers(actual: unknown[], expected: unknown[], message?: string) { assertCondition(!same(actual.slice(0, expected.length), expected), message || 'Expected array not to include deep ordered members'); },
    changes(modifier: () => unknown, target: unknown, propertyOrMessage?: string, message?: string) { const property = mutationProperty(target, propertyOrMessage); const measured = measureMutation(modifier, target, property); assertCondition(!same(measured.before, measured.after), mutationMessage(target, propertyOrMessage, message) || 'Expected value to change'); },
    changesBy(modifier: () => unknown, target: unknown, propertyOrDelta: string | number | undefined, deltaOrMessage?: number | string, message?: string) { const delta = mutationDelta(target, propertyOrDelta, deltaOrMessage); assertCondition(measureChange(modifier, target, mutationProperty(target, propertyOrDelta)) === delta, deltaMessage(target, deltaOrMessage, message) || `Expected value to change by ${delta}`); },
    doesNotChange(modifier: () => unknown, target: unknown, propertyOrMessage?: string, message?: string) { const property = mutationProperty(target, propertyOrMessage); const measured = measureMutation(modifier, target, property); assertCondition(same(measured.before, measured.after), mutationMessage(target, propertyOrMessage, message) || 'Expected value not to change'); },
    changesButNotBy(modifier: () => unknown, target: unknown, propertyOrDelta: string | number | undefined, deltaOrMessage?: number | string, message?: string) { const delta = mutationDelta(target, propertyOrDelta, deltaOrMessage); const change = measureChange(modifier, target, mutationProperty(target, propertyOrDelta)); assertCondition(change !== 0 && change !== delta, deltaMessage(target, deltaOrMessage, message) || `Expected value to change but not by ${delta}`); },
    increases(modifier: () => unknown, target: unknown, propertyOrMessage?: string, message?: string) { assertCondition(measureChange(modifier, target, mutationProperty(target, propertyOrMessage)) > 0, mutationMessage(target, propertyOrMessage, message) || 'Expected value to increase'); },
    increasesBy(modifier: () => unknown, target: unknown, propertyOrDelta: string | number | undefined, deltaOrMessage?: number | string, message?: string) { const delta = mutationDelta(target, propertyOrDelta, deltaOrMessage); assertCondition(measureChange(modifier, target, mutationProperty(target, propertyOrDelta)) === delta && delta > 0, deltaMessage(target, deltaOrMessage, message) || `Expected value to increase by ${delta}`); },
    doesNotIncrease(modifier: () => unknown, target: unknown, propertyOrMessage?: string, message?: string) { assertCondition(measureChange(modifier, target, mutationProperty(target, propertyOrMessage)) <= 0, mutationMessage(target, propertyOrMessage, message) || 'Expected value not to increase'); },
    increasesButNotBy(modifier: () => unknown, target: unknown, propertyOrDelta: string | number | undefined, deltaOrMessage?: number | string, message?: string) { const delta = mutationDelta(target, propertyOrDelta, deltaOrMessage); const change = measureChange(modifier, target, mutationProperty(target, propertyOrDelta)); assertCondition(change > 0 && change !== delta, deltaMessage(target, deltaOrMessage, message) || `Expected value to increase but not by ${delta}`); },
    decreases(modifier: () => unknown, target: unknown, propertyOrMessage?: string, message?: string) { assertCondition(measureChange(modifier, target, mutationProperty(target, propertyOrMessage)) < 0, mutationMessage(target, propertyOrMessage, message) || 'Expected value to decrease'); },
    decreasesBy(modifier: () => unknown, target: unknown, propertyOrDelta: string | number | undefined, deltaOrMessage?: number | string, message?: string) { const delta = mutationDelta(target, propertyOrDelta, deltaOrMessage); assertCondition(measureChange(modifier, target, mutationProperty(target, propertyOrDelta)) === -Math.abs(delta), deltaMessage(target, deltaOrMessage, message) || `Expected value to decrease by ${delta}`); },
    doesNotDecrease(modifier: () => unknown, target: unknown, propertyOrMessage?: string, message?: string) { assertCondition(measureChange(modifier, target, mutationProperty(target, propertyOrMessage)) >= 0, mutationMessage(target, propertyOrMessage, message) || 'Expected value not to decrease'); },
    doesNotDecreaseBy(modifier: () => unknown, target: unknown, propertyOrDelta: string | number | undefined, deltaOrMessage?: number | string, message?: string) { const delta = mutationDelta(target, propertyOrDelta, deltaOrMessage); assertCondition(measureChange(modifier, target, mutationProperty(target, propertyOrDelta)) !== -Math.abs(delta), deltaMessage(target, deltaOrMessage, message) || `Expected value not to decrease by ${delta}`); },
    decreasesButNotBy(modifier: () => unknown, target: unknown, propertyOrDelta: string | number | undefined, deltaOrMessage?: number | string, message?: string) { const delta = mutationDelta(target, propertyOrDelta, deltaOrMessage); const change = measureChange(modifier, target, mutationProperty(target, propertyOrDelta)); assertCondition(change < 0 && change !== -Math.abs(delta), deltaMessage(target, deltaOrMessage, message) || `Expected value to decrease but not by ${delta}`); },
    throws(callback: () => unknown, errorLike?: unknown, matcher?: string | RegExp, message?: string) { try { callback(); } catch (error) { const typeMatches = !errorLike || errorLike instanceof RegExp || typeof errorLike === 'string' || (typeof errorLike === 'function' && error instanceof (errorLike as new (...args: never[]) => Error)) || error === errorLike; const expectedMessage = errorLike instanceof RegExp || typeof errorLike === 'string' ? errorLike : matcher; const messageMatches = !expectedMessage || (expectedMessage instanceof RegExp ? expectedMessage.test(String((error as Error).message ?? error)) : String((error as Error).message ?? error).includes(expectedMessage)); assertCondition(typeMatches && messageMatches, message || 'Thrown error did not match expectation'); return error; } throw new Error(message || 'Expected function to throw'); },
    doesNotThrow(callback: () => unknown, message?: string) { try { callback(); } catch (error) { throw new Error(message || `Expected function not to throw: ${error}`); } },
    respondTo(value: unknown, method: string, message?: string) { const target = typeof value === 'function' ? value.prototype : value; assertCondition(typeof (target as Record<string, unknown> | null | undefined)?.[method] === 'function', message || `Expected value to respond to '${method}'`); },
    notRespondTo(value: unknown, method: string, message?: string) { const target = typeof value === 'function' ? value.prototype : value; assertCondition(typeof (target as Record<string, unknown> | null | undefined)?.[method] !== 'function', message || `Expected value not to respond to '${method}'`); },
    satisfies(value: unknown, predicate: (value: unknown) => unknown, message?: string) { assertCondition(Boolean(predicate(value)), message || 'Expected value to satisfy predicate'); },
    ifError(value: unknown) { if (value) throw value; },
    isExtensible(value: object, message?: string) { assertCondition(Object.isExtensible(value), message || 'Expected object to be extensible'); },
    isNotExtensible(value: object, message?: string) { assertCondition(!Object.isExtensible(value), message || 'Expected object not to be extensible'); },
    isSealed(value: object, message?: string) { assertCondition(Object.isSealed(value), message || 'Expected object to be sealed'); },
    isNotSealed(value: object, message?: string) { assertCondition(!Object.isSealed(value), message || 'Expected object not to be sealed'); },
    isFrozen(value: object, message?: string) { assertCondition(Object.isFrozen(value), message || 'Expected object to be frozen'); },
    isNotFrozen(value: object, message?: string) { assertCondition(!Object.isFrozen(value), message || 'Expected object not to be frozen'); },
    isEmpty(value: unknown, message?: string) { assertCondition((lengthOrSize(value) ?? (value && typeof value === 'object' ? Object.keys(value).length : undefined)) === 0, message || 'Expected value to be empty'); },
    isNotEmpty(value: unknown, message?: string) { assertCondition((lengthOrSize(value) ?? (value && typeof value === 'object' ? Object.keys(value).length : undefined)) !== 0, message || 'Expected value not to be empty'); },
  });

  const pathParts = (path: unknown) => Array.isArray(path) ? path.map(String) : String(path).replace(/\[(\w+)\]/g, '.$1').split('.').filter(Boolean);
  const lodash: Record<string, unknown> = {};
  const lodashGet = (value: unknown, path: unknown, fallback?: unknown) => pathParts(path).reduce<unknown>((current, key) => (current as Record<string, unknown> | undefined)?.[key], value) ?? fallback;
  const lodashSet = (value: Record<string, unknown>, path: unknown, next: unknown) => {
    const parts = pathParts(path);
    let current = value;
    parts.forEach((part, index) => {
      if (index === parts.length - 1) current[part] = next;
      else current = current[part] && typeof current[part] === 'object' ? current[part] as Record<string, unknown> : (current[part] = {}) as Record<string, unknown>;
    });
    return value;
  };
  const deepMerge = (target: Record<string, unknown>, source: Record<string, unknown>) => {
    Object.entries(source).forEach(([key, value]) => {
      if (value && typeof value === 'object' && !Array.isArray(value)) target[key] = deepMerge(target[key] && typeof target[key] === 'object' && !Array.isArray(target[key]) ? target[key] as Record<string, unknown> : {}, value as Record<string, unknown>);
      else target[key] = runtime.structuredClone(value);
    });
    return target;
  };
  const words = (value: unknown) => String(value).trim().replace(/([a-z0-9])([A-Z])/g, '$1 $2').split(/[^A-Za-z0-9]+/).filter(Boolean).map((word) => word.toLowerCase());
  Object.assign(lodash, {
    clone: (value: unknown) => Array.isArray(value) ? [...value] : value && typeof value === 'object' ? { ...value as Record<string, unknown> } : value,
    cloneDeep: runtime.structuredClone,
    get: lodashGet,
    set: lodashSet,
    has: (value: unknown, path: unknown) => lodashGet(value, path, undefined) !== undefined,
    merge: (target: Record<string, unknown>, ...sources: Record<string, unknown>[]) => sources.reduce(deepMerge, target),
    isEqual: same,
    isEmpty: (value: unknown) => value == null || (typeof value === 'string' || Array.isArray(value) ? value.length === 0 : typeof value === 'object' ? Object.keys(value).length === 0 : true),
    isArray: Array.isArray,
    isObject: (value: unknown) => value !== null && typeof value === 'object',
    map: (value: unknown[] | Record<string, unknown>, callback: (item: unknown, key: string | number) => unknown) => Array.isArray(value) ? value.map(callback) : Object.entries(value ?? {}).map(([key, item]) => callback(item, key)),
    filter: (value: unknown[], callback: (item: unknown, index: number) => boolean) => Array.from(value ?? []).filter(callback),
    find: (value: unknown[], callback: (item: unknown, index: number) => boolean) => Array.from(value ?? []).find(callback),
    reduce: (value: unknown[], callback: (total: unknown, item: unknown, index: number) => unknown, initial: unknown) => Array.from(value ?? []).reduce(callback, initial),
    each: (value: unknown[] | Record<string, unknown>, callback: (item: unknown, key: string | number) => unknown) => { (Array.isArray(value) ? value.map((item, index) => [index, item] as const) : Object.entries(value ?? {})).forEach(([key, item]) => callback(item, key)); return value; },
    forEach: (value: unknown[] | Record<string, unknown>, callback: (item: unknown, key: string | number) => unknown) => { (Array.isArray(value) ? value.map((item, index) => [index, item] as const) : Object.entries(value ?? {})).forEach(([key, item]) => callback(item, key)); return value; },
    keys: (value: unknown) => Object.keys(value ?? {}),
    values: (value: unknown) => Object.values(value ?? {}),
    pick: (value: Record<string, unknown>, names: string[]) => Object.fromEntries(names.filter((name) => Object.prototype.hasOwnProperty.call(value, name)).map((name) => [name, value[name]])),
    omit: (value: Record<string, unknown>, names: string[]) => Object.fromEntries(Object.entries(value).filter(([name]) => !names.includes(name))),
    groupBy: (value: unknown[], callback: ((item: unknown) => unknown) | string) => Array.from(value ?? []).reduce<Record<string, unknown[]>>((groups, item) => { const key = String(typeof callback === 'function' ? callback(item) : lodashGet(item, callback)); (groups[key] ??= []).push(item); return groups; }, {}),
    uniq: (value: unknown[]) => [...new Set(value)],
    uniqBy: (value: unknown[], callback: ((item: unknown) => unknown) | string) => { const seen = new Set(); return Array.from(value ?? []).filter((item) => { const key = typeof callback === 'function' ? callback(item) : lodashGet(item, callback); if (seen.has(key)) return false; seen.add(key); return true; }); },
    flatten: (value: unknown[][]) => Array.from(value ?? []).flat(),
    flattenDeep: (value: unknown[][]) => Array.from(value ?? []).flat(Infinity),
    sortBy: (value: unknown[], callback: ((item: unknown) => unknown) | string) => [...value].sort((left, right) => { const a = typeof callback === 'function' ? callback(left) : lodashGet(left, callback); const b = typeof callback === 'function' ? callback(right) : lodashGet(right, callback); return a! < b! ? -1 : a! > b! ? 1 : 0; }),
    camelCase: (value: unknown) => words(value).map((word, index) => index ? word[0].toUpperCase() + word.slice(1) : word).join(''),
    kebabCase: (value: unknown) => words(value).join('-'),
    snakeCase: (value: unknown) => words(value).join('_'),
    startCase: (value: unknown) => words(value).map((word) => word[0].toUpperCase() + word.slice(1)).join(' '),
  });

  const querystring = {
    escape: encodeURIComponent,
    unescape: decodeURIComponent,
    parse(value: unknown, separator = '&', equals = '=') {
      const output: Record<string, string | string[]> = {};
      boundedText(value).split(separator).filter(Boolean).slice(0, 10_000).forEach((part) => {
        const index = part.indexOf(equals);
        const key = decodeURIComponent((index < 0 ? part : part.slice(0, index)).replace(/\+/g, ' '));
        const item = decodeURIComponent((index < 0 ? '' : part.slice(index + equals.length)).replace(/\+/g, ' '));
        output[key] = output[key] === undefined ? item : Array.isArray(output[key]) ? [...output[key], item] : [output[key], item];
      });
      return output;
    },
    stringify(value: Record<string, unknown>, separator = '&', equals = '=') {
      return Object.entries(value ?? {}).flatMap(([key, item]) => (Array.isArray(item) ? item : [item]).map((entry) => `${encodeURIComponent(key)}${equals}${encodeURIComponent(String(entry ?? ''))}`)).join(separator);
    },
  };

  const parseCsv = (input: unknown, options: Record<string, unknown> = {}) => {
    const text = boundedText(input);
    const delimiter = String(options.delimiter ?? ',');
    const records: string[][] = [];
    let row: string[] = [];
    let value = '';
    let quoted = false;
    for (let index = 0; index < text.length; index += 1) {
      const character = text[index];
      if (character === '"' && quoted && text[index + 1] === '"') { value += '"'; index += 1; }
      else if (character === '"') quoted = !quoted;
      else if (!quoted && text.startsWith(delimiter, index)) { row.push(options.trim ? value.trim() : value); value = ''; index += delimiter.length - 1; }
      else if (!quoted && (character === '\n' || character === '\r')) {
        if (character === '\r' && text[index + 1] === '\n') index += 1;
        row.push(options.trim ? value.trim() : value); value = '';
        if (!(options.skip_empty_lines && row.every((item) => !item))) records.push(row);
        row = [];
        if (records.length > 100_000) throw new Error('CSV input exceeds 100,000 records.');
      } else value += character;
    }
    if (quoted) throw new Error('CSV input has an unterminated quoted field.');
    if (value || row.length) { row.push(options.trim ? value.trim() : value); if (!(options.skip_empty_lines && row.every((item) => !item))) records.push(row); }
    if (options.columns) {
      const headers = Array.isArray(options.columns) ? options.columns.map(String) : records.shift() ?? [];
      return records.map((record) => Object.fromEntries(headers.map((header, index) => [header, record[index] ?? ''])));
    }
    return records;
  };
  const csvParse = Object.assign((input: unknown, options?: Record<string, unknown> | ((error: Error | undefined, records?: unknown) => void), callback?: (error: Error | undefined, records?: unknown) => void) => {
    const done = typeof options === 'function' ? options : callback;
    try { const result = parseCsv(input, typeof options === 'object' ? options : {}); if (done) { runtime.setTimeout(() => done(undefined, result), 0); return undefined; } return result; }
    catch (error) { if (done) { runtime.setTimeout(() => done(error instanceof Error ? error : new Error(String(error))), 0); return undefined; } throw error; }
  }, { parse: parseCsv, sync: parseCsv });

  const validateSchema = (schema: unknown, data: unknown, schemas: Map<string, unknown>, path = '', depth = 0): Array<Record<string, string>> => {
    if (depth > 100) return [{ instancePath: path, message: 'schema nesting exceeds 100 levels' }];
    if (typeof schema === 'boolean') return schema ? [] : [{ instancePath: path, message: 'boolean schema rejected value' }];
    if (!schema || typeof schema !== 'object') return [];
    const source = schema as Record<string, unknown>;
    if (typeof source.$ref === 'string') {
      if (source.$ref.startsWith('#/')) return [{ instancePath: path, message: 'local $ref requires compilation through a root schema' }];
      const referenced = schemas.get(source.$ref);
      return referenced ? validateSchema(referenced, data, schemas, path, depth + 1) : [{ instancePath: path, message: `unresolved reference ${source.$ref}` }];
    }
    const errors: Array<Record<string, string>> = [];
    const types = Array.isArray(source.type) ? source.type : source.type ? [source.type] : [];
    const matchesType = (type: unknown) => type === 'null' ? data === null : type === 'array' ? Array.isArray(data) : type === 'integer' ? Number.isInteger(data) : type === 'number' ? typeof data === 'number' && Number.isFinite(data) : type === 'object' ? Boolean(data) && typeof data === 'object' && !Array.isArray(data) : typeof data === type;
    if (types.length && !types.some(matchesType)) errors.push({ instancePath: path, message: `must be ${types.join(' or ')}` });
    if (source.const !== undefined && !same(data, source.const)) errors.push({ instancePath: path, message: 'must equal constant' });
    if (Array.isArray(source.enum) && !source.enum.some((value) => same(value, data))) errors.push({ instancePath: path, message: 'must be equal to one of the allowed values' });
    if (typeof data === 'string') {
      if (typeof source.minLength === 'number' && data.length < source.minLength) errors.push({ instancePath: path, message: `must NOT have fewer than ${source.minLength} characters` });
      if (typeof source.maxLength === 'number' && data.length > source.maxLength) errors.push({ instancePath: path, message: `must NOT have more than ${source.maxLength} characters` });
      if (typeof source.pattern === 'string' && !(new RegExp(source.pattern).test(data))) errors.push({ instancePath: path, message: `must match pattern ${source.pattern}` });
      if (source.format === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data)) errors.push({ instancePath: path, message: 'must match format email' });
      if ((source.format === 'uri' || source.format === 'url')) { try { new runtime.URL(data); } catch { errors.push({ instancePath: path, message: `must match format ${source.format}` }); } }
    }
    if (typeof data === 'number') {
      if (typeof source.minimum === 'number' && data < source.minimum) errors.push({ instancePath: path, message: `must be >= ${source.minimum}` });
      if (typeof source.maximum === 'number' && data > source.maximum) errors.push({ instancePath: path, message: `must be <= ${source.maximum}` });
    }
    if (Array.isArray(data)) {
      if (typeof source.minItems === 'number' && data.length < source.minItems) errors.push({ instancePath: path, message: `must NOT have fewer than ${source.minItems} items` });
      if (typeof source.maxItems === 'number' && data.length > source.maxItems) errors.push({ instancePath: path, message: `must NOT have more than ${source.maxItems} items` });
      if (source.uniqueItems && new Set(data.map((item) => JSON.stringify(item))).size !== data.length) errors.push({ instancePath: path, message: 'must NOT have duplicate items' });
      if (source.items !== undefined) data.forEach((item, index) => errors.push(...validateSchema(source.items, item, schemas, `${path}/${index}`, depth + 1)));
    }
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      const object = data as Record<string, unknown>;
      const required = Array.isArray(source.required) ? source.required.map(String) : [];
      required.filter((name) => !Object.prototype.hasOwnProperty.call(object, name)).forEach((name) => errors.push({ instancePath: path, message: `must have required property '${name}'` }));
      const properties = source.properties && typeof source.properties === 'object' ? source.properties as Record<string, unknown> : {};
      Object.entries(properties).filter(([name]) => Object.prototype.hasOwnProperty.call(object, name)).forEach(([name, child]) => errors.push(...validateSchema(child, object[name], schemas, `${path}/${name}`, depth + 1)));
      if (source.additionalProperties === false) Object.keys(object).filter((name) => !Object.prototype.hasOwnProperty.call(properties, name)).forEach((name) => errors.push({ instancePath: `${path}/${name}`, message: 'must NOT have additional properties' }));
    }
    if (Array.isArray(source.allOf)) source.allOf.forEach((item) => errors.push(...validateSchema(item, data, schemas, path, depth + 1)));
    if (Array.isArray(source.anyOf) && !source.anyOf.some((item) => validateSchema(item, data, schemas, path, depth + 1).length === 0)) errors.push({ instancePath: path, message: 'must match a schema in anyOf' });
    if (Array.isArray(source.oneOf) && source.oneOf.filter((item) => validateSchema(item, data, schemas, path, depth + 1).length === 0).length !== 1) errors.push({ instancePath: path, message: 'must match exactly one schema in oneOf' });
    if (source.not && validateSchema(source.not, data, schemas, path, depth + 1).length === 0) errors.push({ instancePath: path, message: 'must NOT be valid' });
    return errors.slice(0, 1_000);
  };
  class Ajv {
    schemas = new Map<string, unknown>();
    errors: Array<Record<string, string>> | null = null;
    constructor(options?: Record<string, unknown>) { void options; }
    addSchema(schema: unknown, key?: string) { const id = key ?? (schema as Record<string, unknown> | undefined)?.$id; if (id) this.schemas.set(String(id), schema); return this; }
    getSchema(key: string) { const schema = this.schemas.get(key); return schema === undefined ? undefined : this.compile(schema); }
    compile(schema: unknown) { const validate = ((data: unknown) => { const errors = validateSchema(schema, data, this.schemas); validate.errors = errors.length ? errors : null; this.errors = validate.errors; return errors.length === 0; }) as ((data: unknown) => boolean) & { errors: Array<Record<string, string>> | null }; validate.errors = null; return validate; }
    validate(schema: unknown, data: unknown) { const candidate = typeof schema === 'string' ? this.schemas.get(schema) : schema; if (candidate === undefined) throw new Error(`Unknown schema '${schema}'`); return this.compile(candidate)(data); }
  }
  Object.assign(Ajv, { default: Ajv });
  const tv4Schemas = new Map<string, unknown>();
  const tv4: Record<string, unknown> = {
    error: null,
    addSchema(key: string | Record<string, unknown>, schema?: unknown) { if (typeof key === 'string') tv4Schemas.set(key, schema); else if (key.id || key.$id) tv4Schemas.set(String(key.id ?? key.$id), key); return tv4; },
    getSchema: (key: string) => tv4Schemas.get(key),
    validate(data: unknown, schema: unknown) { const errors = validateSchema(schema, data, tv4Schemas); tv4.error = errors[0] ?? null; return errors.length === 0; },
    validateResult(data: unknown, schema: unknown) { const errors = validateSchema(schema, data, tv4Schemas); return { valid: errors.length === 0, error: errors[0] ?? null, missing: [] }; },
    validateMultiple(data: unknown, schema: unknown) { const errors = validateSchema(schema, data, tv4Schemas); return { valid: errors.length === 0, errors, missing: [] }; },
    reset() { tv4Schemas.clear(); tv4.error = null; },
  };

  const bytesToHex = (bytes: Uint8Array) => [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('');
  const hexToBytes = (hex: string) => new Uint8Array((hex.match(/.{1,2}/g) ?? []).map((value) => parseInt(value, 16)));
  const bytesToBase64 = (bytes: Uint8Array) => runtime.btoa([...bytes].map((value) => String.fromCharCode(value)).join(''));
  const base64ToBytes = (value: string) => new Uint8Array([...runtime.atob(value)].map((character) => character.charCodeAt(0)));
  const wordArray = (bytes: Uint8Array) => ({ sigBytes: bytes.length, words: Array.from({ length: Math.ceil(bytes.length / 4) }, (_, index) => ((bytes[index * 4] ?? 0) << 24) | ((bytes[index * 4 + 1] ?? 0) << 16) | ((bytes[index * 4 + 2] ?? 0) << 8) | (bytes[index * 4 + 3] ?? 0)), bytes, toString(encoder?: { stringify: (value: { bytes: Uint8Array }) => string }) { return (encoder ?? cryptoEnc.Hex).stringify(this); } });
  const inputBytes = (value: unknown) => value && typeof value === 'object' && 'bytes' in value ? (value as { bytes: Uint8Array }).bytes : new runtime.TextEncoder().encode(boundedText(value));
  const sha256Hex = (input: unknown) => {
    const bytes = inputBytes(input);
    const k = new Uint32Array([0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]);
    const length = bytes.length;
    const paddedLength = Math.ceil((length + 9) / 64) * 64;
    const padded = new Uint8Array(paddedLength); padded.set(bytes); padded[length] = 0x80;
    const bits = length * 8; for (let index = 0; index < 8; index += 1) padded[paddedLength - 1 - index] = Math.floor(bits / 2 ** (index * 8)) & 0xff;
    const hash = new Uint32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]);
    const rotate = (value: number, amount: number) => (value >>> amount) | (value << (32 - amount));
    for (let offset = 0; offset < padded.length; offset += 64) {
      const w = new Uint32Array(64);
      for (let index = 0; index < 16; index += 1) w[index] = (padded[offset + index * 4] << 24) | (padded[offset + index * 4 + 1] << 16) | (padded[offset + index * 4 + 2] << 8) | padded[offset + index * 4 + 3];
      for (let index = 16; index < 64; index += 1) { const a = rotate(w[index - 15], 7) ^ rotate(w[index - 15], 18) ^ (w[index - 15] >>> 3); const b = rotate(w[index - 2], 17) ^ rotate(w[index - 2], 19) ^ (w[index - 2] >>> 10); w[index] = (w[index - 16] + a + w[index - 7] + b) >>> 0; }
      let [a,b,c,d,e,f,g,h] = hash;
      for (let index = 0; index < 64; index += 1) { const s1 = rotate(e, 6) ^ rotate(e, 11) ^ rotate(e, 25); const choice = (e & f) ^ (~e & g); const t1 = (h + s1 + choice + k[index] + w[index]) >>> 0; const s0 = rotate(a, 2) ^ rotate(a, 13) ^ rotate(a, 22); const majority = (a & b) ^ (a & c) ^ (b & c); const t2 = (s0 + majority) >>> 0; h=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0; }
      [a,b,c,d,e,f,g,h].forEach((value, index) => { hash[index] = (hash[index] + value) >>> 0; });
    }
    return [...hash].map((value) => value.toString(16).padStart(8, '0')).join('');
  };
  const cryptoEnc = {
    Hex: { stringify: (value: { bytes: Uint8Array }) => bytesToHex(value.bytes), parse: (value: string) => wordArray(hexToBytes(value)) },
    Utf8: { stringify: (value: { bytes: Uint8Array }) => new runtime.TextDecoder().decode(value.bytes), parse: (value: string) => wordArray(new runtime.TextEncoder().encode(boundedText(value))) },
    Base64: { stringify: (value: { bytes: Uint8Array }) => bytesToBase64(value.bytes), parse: (value: string) => wordArray(base64ToBytes(value)) },
  };
  const cryptoJs = {
    enc: cryptoEnc,
    lib: { WordArray: { create: (wordsOrBytes?: number[] | Uint8Array, sigBytes?: number) => { if (wordsOrBytes instanceof Uint8Array) return wordArray(wordsOrBytes.slice(0, sigBytes)); const values = wordsOrBytes ?? []; const bytes = new Uint8Array((sigBytes ?? values.length * 4)); values.forEach((word, index) => { bytes[index * 4] = word >>> 24; bytes[index * 4 + 1] = word >>> 16; bytes[index * 4 + 2] = word >>> 8; bytes[index * 4 + 3] = word; }); return wordArray(bytes); }, random: (length: number) => wordArray(runtime.crypto.getRandomValues(new Uint8Array(Math.min(1_000_000, Math.max(0, length))))) } },
    SHA256: (value: unknown) => wordArray(hexToBytes(sha256Hex(value))),
  };

  type MiniNode = { type: 'root' | 'tag' | 'text'; name: string; attrs: Record<string, string>; children: MiniNode[]; parent?: MiniNode; text?: string };
  const parseMarkup = (input: unknown) => {
    const root: MiniNode = { type: 'root', name: 'root', attrs: {}, children: [] };
    const stack = [root];
    const tokens = boundedText(input).match(/<!--[\s\S]*?-->|<\/?[^>]+>|[^<]+/g) ?? [];
    tokens.slice(0, 100_000).forEach((token) => {
      if (token.startsWith('<!--')) return;
      if (token.startsWith('</')) { if (stack.length > 1) stack.pop(); return; }
      if (token.startsWith('<')) {
        const match = token.match(/^<\s*([^\s/>]+)([\s\S]*?)\/?\s*>$/); if (!match) return;
        const node: MiniNode = { type: 'tag', name: match[1].toLowerCase(), attrs: {}, children: [], parent: stack.at(-1) };
        match[2].replace(/([^\s=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g, (_all, name, quoted, single, plain) => { node.attrs[String(name).toLowerCase()] = String(quoted ?? single ?? plain ?? ''); return ''; });
        stack.at(-1)!.children.push(node);
        if (!token.endsWith('/>') && !/^(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/.test(node.name)) stack.push(node);
      } else if (token) stack.at(-1)!.children.push({ type: 'text', name: '#text', attrs: {}, children: [], parent: stack.at(-1), text: token });
    });
    return root;
  };
  const descendants = (node: MiniNode): MiniNode[] => node.children.flatMap((child) => [child, ...descendants(child)]);
  const nodeText = (node: MiniNode): string => node.type === 'text' ? node.text ?? '' : node.children.map(nodeText).join('');
  const serializeNode = (node: MiniNode): string => node.type === 'text' ? node.text ?? '' : node.type === 'root' ? node.children.map(serializeNode).join('') : `<${node.name}${Object.entries(node.attrs).map(([name, value]) => ` ${name}="${value}"`).join('')}>${node.children.map(serializeNode).join('')}</${node.name}>`;
  const matchesSelector = (node: MiniNode, selector: string) => {
    if (node.type !== 'tag') return false;
    const attr = selector.match(/\[([^=\]]+)(?:=['"]?([^'"\]]+)['"]?)?\]/); if (attr && (!(attr[1].toLowerCase() in node.attrs) || (attr[2] !== undefined && node.attrs[attr[1].toLowerCase()] !== attr[2]))) return false;
    const id = selector.match(/#([\w-]+)/)?.[1]; if (id && node.attrs.id !== id) return false;
    const classes = [...selector.matchAll(/\.([\w-]+)/g)].map((match) => match[1]); const classNames = (node.attrs.class ?? '').split(/\s+/); if (classes.some((name) => !classNames.includes(name))) return false;
    const tag = selector.match(/^([A-Za-z][\w-]*)/)?.[1]; return !tag || node.name === tag.toLowerCase();
  };
  const queryNodes = (root: MiniNode, selector: string) => selector.split(',').flatMap((group) => {
    const chain = group.trim().split(/\s+/);
    return descendants(root).filter((node) => {
      if (!matchesSelector(node, chain.at(-1)!)) return false;
      let ancestor = node.parent;
      for (let index = chain.length - 2; index >= 0; index -= 1) { while (ancestor && !matchesSelector(ancestor, chain[index])) ancestor = ancestor.parent; if (!ancestor) return false; ancestor = ancestor.parent; }
      return true;
    });
  });
  const cheerioLoad = (input: unknown) => {
    const root = parseMarkup(input);
    const wrap = (nodes: MiniNode[]) => {
      const selection: Record<string, unknown> & { length: number } = {
        length: nodes.length,
        get: (index?: number) => index === undefined ? nodes : nodes[index < 0 ? nodes.length + index : index],
        toArray: () => [...nodes],
        first: () => wrap(nodes.slice(0, 1)),
        last: () => wrap(nodes.slice(-1)),
        eq: (index: number) => wrap(nodes.slice(index < 0 ? nodes.length + index : index, (index < 0 ? nodes.length + index : index) + 1)),
        text: (value?: unknown) => { if (value === undefined) return nodes.map(nodeText).join(''); nodes.forEach((node) => { node.children = [{ type: 'text', name: '#text', attrs: {}, children: [], parent: node, text: String(value) }]; }); return selection; },
        html: (value?: unknown) => { if (value === undefined) return nodes[0]?.children.map(serializeNode).join('') ?? null; nodes.forEach((node) => { const parsed = parseMarkup(value); node.children = parsed.children.map((child) => ({ ...child, parent: node })); }); return selection; },
        attr: (name: string, value?: unknown) => { if (value === undefined) return nodes[0]?.attrs[name.toLowerCase()]; nodes.forEach((node) => { node.attrs[name.toLowerCase()] = String(value); }); return selection; },
        find: (selector: string) => wrap(nodes.flatMap((node) => queryNodes(node, selector))),
        each: (callback: (index: number, node: MiniNode) => unknown) => { nodes.forEach((node, index) => callback(index, node)); return selection; },
        map: (callback: (index: number, node: MiniNode) => unknown) => { const values = nodes.map((node, index) => callback(index, node)); return { get: () => values, toArray: () => values }; },
      };
      nodes.forEach((node, index) => { selection[index] = node; });
      return selection;
    };
    const select = ((selectorOrNode: string | MiniNode) => typeof selectorOrNode === 'string' ? wrap(queryNodes(root, selectorOrNode)) : wrap([selectorOrNode])) as ((selectorOrNode: string | MiniNode) => ReturnType<typeof wrap>) & Record<string, unknown>;
    select.root = () => wrap([root]); select.html = () => serializeNode(root); select.text = () => nodeText(root); return select;
  };
  const cheerio = { load: cheerioLoad };

  const xmlNodeObject = (node: MiniNode, options: Record<string, unknown>): unknown => {
    const children = node.children.filter((child) => child.type === 'tag');
    const text = node.children.filter((child) => child.type === 'text').map(nodeText).join('').trim();
    if (!children.length && !Object.keys(node.attrs).length) return text;
    const output: Record<string, unknown> = {};
    if (Object.keys(node.attrs).length) output[String(options.attrkey ?? '$')] = { ...node.attrs };
    if (text) output[String(options.charkey ?? '_')] = text;
    children.forEach((child) => { const value = xmlNodeObject(child, options); const key = child.name; if (output[key] === undefined) output[key] = options.explicitArray === false ? value : [value]; else if (Array.isArray(output[key])) (output[key] as unknown[]).push(value); else output[key] = [output[key], value]; });
    return output;
  };
  const parseXml = (input: unknown, options: Record<string, unknown> = {}) => { const root = parseMarkup(input); const first = root.children.find((child) => child.type === 'tag'); if (!first) throw new Error('XML contains no root element.'); return { [first.name]: xmlNodeObject(first, options) }; };
  class XmlParser { constructor(public options: Record<string, unknown> = {}) {} parseString(input: unknown, callback: (error: Error | null, value?: unknown) => void) { try { callback(null, parseXml(input, this.options)); } catch (error) { callback(error instanceof Error ? error : new Error(String(error))); } } parseStringPromise(input: unknown) { return Promise.resolve(parseXml(input, this.options)); } }
  class XmlBuilder { constructor(public options: Record<string, unknown> = {}) {} buildObject(value: Record<string, unknown>) { void this.options; const build = (name: string, item: unknown): string => { if (Array.isArray(item)) return item.map((entry) => build(name, entry)).join(''); if (item && typeof item === 'object') { const object = item as Record<string, unknown>; const attrs = object.$ && typeof object.$ === 'object' ? Object.entries(object.$ as Record<string, unknown>).map(([key, entry]) => ` ${key}="${String(entry)}"`).join('') : ''; return `<${name}${attrs}>${object._ ?? ''}${Object.entries(object).filter(([key]) => key !== '$' && key !== '_').map(([key, entry]) => build(key, entry)).join('')}</${name}>`; } return `<${name}>${String(item ?? '')}</${name}>`; }; const [name, item] = Object.entries(value)[0] ?? ['root', '']; return build(name, item); } }
  const xml2js = { Parser: XmlParser, Builder: XmlBuilder, parseString: (input: unknown, options: Record<string, unknown> | ((error: Error | null, value?: unknown) => void), callback?: (error: Error | null, value?: unknown) => void) => { const done = typeof options === 'function' ? options : callback; return new XmlParser(typeof options === 'object' ? options : {}).parseString(input, done ?? (() => undefined)); }, parseStringPromise: (input: unknown, options?: Record<string, unknown>) => Promise.resolve(parseXml(input, options)), processors: {} };

  const momentFormat = (date: Date, pattern = 'YYYY-MM-DDTHH:mm:ssZ', utc = false) => {
    const get = (name: 'FullYear' | 'Month' | 'Date' | 'Hours' | 'Minutes' | 'Seconds' | 'Milliseconds') => (date as unknown as Record<string, () => number>)[`get${utc ? 'UTC' : ''}${name}`]();
    const offset = utc ? 0 : -date.getTimezoneOffset(); const zone = offset === 0 ? '+00:00' : `${offset < 0 ? '-' : '+'}${String(Math.floor(Math.abs(offset) / 60)).padStart(2, '0')}:${String(Math.abs(offset) % 60).padStart(2, '0')}`;
    return pattern.replace(/YYYY|MM|DD|HH|mm|ss|SSS|X|x|Z/g, (token) => ({ YYYY: String(get('FullYear')), MM: String(get('Month') + 1).padStart(2, '0'), DD: String(get('Date')).padStart(2, '0'), HH: String(get('Hours')).padStart(2, '0'), mm: String(get('Minutes')).padStart(2, '0'), ss: String(get('Seconds')).padStart(2, '0'), SSS: String(get('Milliseconds')).padStart(3, '0'), X: String(Math.floor(date.getTime() / 1000)), x: String(date.getTime()), Z: zone })[token]!);
  };
  const moment = ((input?: unknown) => {
    const date = input && typeof input === 'object' && '_date' in input ? new Date((input as { _date: Date })._date) : input === undefined ? new Date() : new Date(input as string | number | Date);
    let utc = false;
    const api: Record<string, unknown> & { _date: Date } = { _date: date };
    const unitMs = (unit: unknown) => /^s/.test(String(unit)) ? 1000 : /^m(?!o)/.test(String(unit)) ? 60_000 : /^h/.test(String(unit)) ? 3_600_000 : /^d/.test(String(unit)) ? 86_400_000 : /^w/.test(String(unit)) ? 604_800_000 : 0;
    Object.assign(api, { isValid: () => !Number.isNaN(date.getTime()), toDate: () => new Date(date), toISOString: () => date.toISOString(), valueOf: () => date.getTime(), unix: () => Math.floor(date.getTime() / 1000), format: (pattern?: string) => momentFormat(date, pattern, utc), clone: () => moment(api), utc: () => { utc = true; return api; }, local: () => { utc = false; return api; }, add: (amount: number, unit: string) => { if (/^mo/.test(unit)) date.setMonth(date.getMonth() + amount); else if (/^y/.test(unit)) date.setFullYear(date.getFullYear() + amount); else date.setTime(date.getTime() + amount * unitMs(unit)); return api; }, subtract: (amount: number, unit: string) => { (api.add as (amount: number, unit: string) => unknown)(-amount, unit); return api; }, diff: (other: unknown, unit = 'milliseconds') => { const difference = date.getTime() - (moment(other).valueOf as () => number)(); const divisor = unitMs(unit) || 1; return Math.trunc(difference / divisor); } });
    return api;
  }) as ((input?: unknown) => Record<string, unknown> & { _date: Date }) & Record<string, unknown>;
  moment.utc = (input?: unknown) => (moment(input).utc as () => unknown)(); moment.unix = (value: number) => moment(value * 1000); moment.isMoment = (value: unknown) => Boolean(value && typeof value === 'object' && '_date' in value); moment.duration = (value: number, unit = 'milliseconds') => ({ asMilliseconds: () => value * (/^s/.test(unit) ? 1000 : /^m/.test(unit) ? 60_000 : /^h/.test(unit) ? 3_600_000 : /^d/.test(unit) ? 86_400_000 : 1), humanize: () => `${value} ${unit}` });

  class PropertyList<T extends { id?: string; key?: string; name?: string }> {
    members: T[];
    constructor(_parent?: unknown, initial: T[] = []) { this.members = Array.isArray(initial) ? initial.map((item) => item) : []; }
    add(item: T) { this.members.push(item); return item; }
    get(id: string) { return this.members.find((item) => item.id === id || item.key === id || item.name === id); }
    remove(id: string) { const index = this.members.findIndex((item) => item.id === id || item.key === id || item.name === id); return index < 0 ? undefined : this.members.splice(index, 1)[0]; }
    all() { return [...this.members]; }
    each(callback: (item: T, index: number) => void) { this.members.forEach(callback); }
    toJSON() { return this.members.map((item) => typeof (item as { toJSON?: () => unknown }).toJSON === 'function' ? (item as { toJSON: () => unknown }).toJSON() : item); }
    get count() { return this.members.length; }
  }
  class Variable { id: string; key: string; value: unknown; type: string; constructor(input: Record<string, unknown> = {}) { this.id = String(input.id ?? runtime.crypto.randomUUID()); this.key = String(input.key ?? input.name ?? ''); this.value = input.value ?? ''; this.type = String(input.type ?? 'any'); } toJSON() { return { id: this.id, key: this.key, value: this.value, type: this.type }; } }
  class Header { id: string; key: string; value: string; disabled: boolean; constructor(input: Record<string, unknown> | string = {}) { const source = typeof input === 'string' ? { key: input.split(':')[0], value: input.split(':').slice(1).join(':').trim() } : input; this.id = String(source.id ?? runtime.crypto.randomUUID()); this.key = String(source.key ?? source.name ?? ''); this.value = String(source.value ?? ''); this.disabled = source.disabled === true; } toJSON() { return { key: this.key, value: this.value, disabled: this.disabled }; } }
  class Url { raw: string; constructor(input: unknown = '') { this.raw = typeof input === 'string' ? input : String((input as Record<string, unknown>)?.raw ?? ''); } toString() { return this.raw; } toJSON() { return this.raw; } }
  class RequestBody { mode: string; raw: string; constructor(input: Record<string, unknown> = {}) { this.mode = String(input.mode ?? 'raw'); this.raw = String(input.raw ?? ''); Object.assign(this, input); } toJSON() { return { ...this }; } }
  class Request { id: string; name: string; method: string; url: Url; headers: PropertyList<Header>; body: RequestBody; constructor(input: Record<string, unknown> = {}) { this.id = String(input.id ?? runtime.crypto.randomUUID()); this.name = String(input.name ?? ''); this.method = String(input.method ?? 'GET'); this.url = new Url(input.url); this.headers = new PropertyList(this, (Array.isArray(input.header) ? input.header : Array.isArray(input.headers) ? input.headers : []).map((item) => new Header(item as Record<string, unknown>))); this.body = new RequestBody(input.body as Record<string, unknown>); } toJSON() { return { id: this.id, name: this.name, method: this.method, url: this.url.toJSON(), header: this.headers.toJSON(), body: this.body.toJSON() }; } }
  class Response { id: string; name: string; code: number; status: string; body: string; headers: PropertyList<Header>; constructor(input: Record<string, unknown> = {}) { this.id = String(input.id ?? runtime.crypto.randomUUID()); this.name = String(input.name ?? ''); this.code = Number(input.code ?? 0); this.status = String(input.status ?? ''); this.body = String(input.body ?? ''); this.headers = new PropertyList(this, (Array.isArray(input.header) ? input.header : []).map((item) => new Header(item as Record<string, unknown>))); } toJSON() { return { id: this.id, name: this.name, code: this.code, status: this.status, body: this.body, header: this.headers.toJSON() }; } }
  class Item { id: string; name: string; request?: Request; items?: PropertyList<Item>; constructor(input: Record<string, unknown> = {}) { this.id = String(input.id ?? runtime.crypto.randomUUID()); this.name = String(input.name ?? ''); if (input.request) this.request = new Request(input.request as Record<string, unknown>); if (Array.isArray(input.item)) this.items = new PropertyList(this, input.item.map((item) => new Item(item))); } toJSON() { return { id: this.id, name: this.name, ...(this.request ? { request: this.request.toJSON() } : {}), ...(this.items ? { item: this.items.toJSON() } : {}) }; } }
  class Collection { id: string; name: string; items: PropertyList<Item>; variables: PropertyList<Variable>; constructor(input: Record<string, unknown> = {}) { const info = input.info && typeof input.info === 'object' ? input.info as Record<string, unknown> : {}; this.id = String(info._postman_id ?? input.id ?? runtime.crypto.randomUUID()); this.name = String(info.name ?? input.name ?? ''); this.items = new PropertyList(this, (Array.isArray(input.item) ? input.item : []).map((item) => new Item(item))); this.variables = new PropertyList(this, (Array.isArray(input.variable) ? input.variable : []).map((item) => new Variable(item))); } toJSON() { return { info: { _postman_id: this.id, name: this.name }, item: this.items.toJSON(), variable: this.variables.toJSON() }; } }
  const postmanCollection = { Collection, Item, ItemGroup: Item, Request, Response, Header, HeaderList: PropertyList, Variable, VariableList: PropertyList, PropertyList, Url, RequestBody };

  class BufferPolyfill extends Uint8Array {
    static from(value: string | ArrayLike<number> | ArrayBuffer, encoding = 'utf8') { if (typeof value === 'string') return new BufferPolyfill(encoding === 'base64' ? base64ToBytes(value) : encoding === 'hex' ? hexToBytes(value) : new runtime.TextEncoder().encode(value)); if (value instanceof ArrayBuffer) return new BufferPolyfill(new Uint8Array(value)); return new BufferPolyfill(Array.from(value)); }
    static alloc(length: number, fill = 0) { const buffer = new BufferPolyfill(Math.min(5_000_000, Math.max(0, length))); buffer.fill(typeof fill === 'number' ? fill : 0); return buffer; }
    static concat(values: Uint8Array[]) { return BufferPolyfill.from(values.flatMap((value) => [...value])); }
    static isBuffer(value: unknown) { return value instanceof BufferPolyfill; }
    static byteLength(value: string) { return new runtime.TextEncoder().encode(value).length; }
    toString(encoding = 'utf8') { return encoding === 'hex' ? bytesToHex(this) : encoding === 'base64' ? bytesToBase64(this) : new runtime.TextDecoder().decode(this); }
  }
  class EventEmitter {
    listeners = new Map<string | symbol, Array<(...args: unknown[]) => void>>();
    on(name: string | symbol, callback: (...args: unknown[]) => void) { const values = this.listeners.get(name) ?? []; values.push(callback); this.listeners.set(name, values); return this; }
    addListener(name: string | symbol, callback: (...args: unknown[]) => void) { return this.on(name, callback); }
    once(name: string | symbol, callback: (...args: unknown[]) => void) { const wrapped = (...args: unknown[]) => { this.off(name, wrapped); callback(...args); }; return this.on(name, wrapped); }
    off(name: string | symbol, callback: (...args: unknown[]) => void) { this.listeners.set(name, (this.listeners.get(name) ?? []).filter((item) => item !== callback)); return this; }
    removeListener(name: string | symbol, callback: (...args: unknown[]) => void) { return this.off(name, callback); }
    removeAllListeners(name?: string | symbol) { if (name === undefined) this.listeners.clear(); else this.listeners.delete(name); return this; }
    emit(name: string | symbol, ...args: unknown[]) { (this.listeners.get(name) ?? []).slice().forEach((callback) => callback(...args)); return (this.listeners.get(name)?.length ?? 0) > 0; }
    listenerCount(name: string | symbol) { return this.listeners.get(name)?.length ?? 0; }
  }
  const pathModule = {
    sep: '/', delimiter: ':',
    normalize: (value: string) => {
      const absolute = value.startsWith('/'); const trailing = value.length > 1 && value.endsWith('/'); const output: string[] = [];
      value.split('/').forEach((part) => { if (!part || part === '.') return; if (part === '..') { if (output.length && output.at(-1) !== '..') output.pop(); else if (!absolute) output.push('..'); } else output.push(part); });
      const normalized = `${absolute ? '/' : ''}${output.join('/')}` || (absolute ? '/' : '.');
      return trailing && normalized !== '/' && normalized !== '.' ? `${normalized}/` : normalized;
    },
    join: (...values: string[]) => pathModule.normalize(values.filter(Boolean).join('/')),
    resolve: (...values: string[]) => { let joined = ''; for (let index = values.length - 1; index >= 0; index -= 1) { joined = `${values[index]}/${joined}`; if (values[index].startsWith('/')) break; } return pathModule.normalize(joined.startsWith('/') ? joined : `/${joined}`); },
    dirname: (value: string) => value.replace(/\/[^/]*\/?$/, '') || '.',
    basename: (value: string, suffix?: string) => { const name = value.split('/').filter(Boolean).at(-1) ?? ''; return suffix && name.endsWith(suffix) ? name.slice(0, -suffix.length) : name; },
    extname: (value: string) => { const name = value.split('/').at(-1) ?? ''; const index = name.lastIndexOf('.'); return index > 0 ? name.slice(index) : ''; },
    isAbsolute: (value: string) => value.startsWith('/'),
    parse: (value: string) => { const dir = pathModule.dirname(value); const base = pathModule.basename(value); const ext = pathModule.extname(value); return { root: value.startsWith('/') ? '/' : '', dir, base, ext, name: base.slice(0, base.length - ext.length) }; },
    format: (value: Record<string, string>) => `${value.dir || value.root || ''}${value.dir || value.root ? '/' : ''}${value.base || `${value.name || ''}${value.ext || ''}`}`.replace(/\/+/g, '/'),
  };
  const util = {
    format: (format: unknown, ...values: unknown[]) => typeof format !== 'string' ? [format, ...values].map((value) => typeof value === 'object' ? JSON.stringify(value) : String(value)).join(' ') : boundedText(format).replace(/%[sdifoOj%]/g, (token) => { if (token === '%%') return '%'; const value = values.shift(); if (token === '%d' || token === '%i') return String(parseInt(String(value), 10)); if (token === '%f') return String(parseFloat(String(value))); if (token === '%j' || token === '%o' || token === '%O') return JSON.stringify(value); return String(value); }) + (values.length ? ` ${values.map(String).join(' ')}` : ''),
    inspect: (value: unknown) => typeof value === 'string' ? `'${value}'` : JSON.stringify(value, null, 2),
    types: { isDate: (value: unknown) => value instanceof Date, isRegExp: (value: unknown) => value instanceof RegExp, isPromise: (value: unknown) => Boolean(value && typeof (value as PromiseLike<unknown>).then === 'function') },
    promisify: (callback: (...args: unknown[]) => void) => (...args: unknown[]) => new Promise((resolve, reject) => callback(...args, (error: unknown, value: unknown) => error ? reject(error) : resolve(value))),
  };
  class Readable extends EventEmitter { chunks: unknown[] = []; push(chunk: unknown) { if (chunk === null) { this.emit('end'); return false; } this.chunks.push(chunk); this.emit('data', chunk); return true; } pipe(destination: { write: (chunk: unknown) => unknown; end?: () => unknown }) { this.on('data', (chunk) => destination.write(chunk)); this.on('end', () => destination.end?.()); return destination; } }
  class Writable extends EventEmitter { chunks: unknown[] = []; write(chunk: unknown) { this.chunks.push(chunk); this.emit('data', chunk); return true; } end(chunk?: unknown) { if (chunk !== undefined) this.write(chunk); this.emit('finish'); } }
  class Transform extends Readable { write(chunk: unknown) { return this.push(chunk); } end(chunk?: unknown) { if (chunk !== undefined) this.write(chunk); this.push(null); } }
  class StringDecoder { decoder: TextDecoder; constructor(encoding = 'utf-8') { this.decoder = new runtime.TextDecoder(encoding); } write(value: Uint8Array) { return this.decoder.decode(value, { stream: true }); } end(value?: Uint8Array) { return (value ? this.decoder.decode(value, { stream: true }) : '') + this.decoder.decode(); } }
  const uuid = { v4: () => runtime.crypto.randomUUID(), v1: () => { const bytes = runtime.crypto.getRandomValues(new Uint8Array(16)); const time = BigInt(Date.now()) * 10_000n + 0x01b21dd213814000n; bytes[0] = Number(time >> 24n) & 0xff; bytes[1] = Number(time >> 16n) & 0xff; bytes[2] = Number(time >> 8n) & 0xff; bytes[3] = Number(time) & 0xff; bytes[6] = (bytes[6] & 0x0f) | 0x10; bytes[8] = (bytes[8] & 0x3f) | 0x80; const hex = bytesToHex(bytes); return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`; }, validate: (value: unknown) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value)), version: (value: unknown) => parseInt(String(value).split('-')[2]?.[0] ?? '0', 16) };
  const punycode = { toASCII: (value: string) => { try { return new runtime.URL(`http://${value}`).hostname; } catch { return value; } }, toUnicode: (value: string) => value, ucs2: { decode: (value: string) => [...value].map((character) => character.codePointAt(0)), encode: (values: number[]) => String.fromCodePoint(...values) }, version: 'bounded' };

  const modules: Record<string, unknown> = {
    ajv: Ajv,
    assert: assertion,
    atob: runtime.atob,
    btoa: runtime.btoa,
    buffer: { Buffer: BufferPolyfill, SlowBuffer: BufferPolyfill, INSPECT_MAX_BYTES: 50 },
    chai: { expect: runtime.expect, assert: assertion },
    cheerio,
    'crypto-js': cryptoJs,
    'csv-parse': csvParse,
    'csv-parse/sync': { parse: parseCsv },
    'csv-parse/lib/sync': parseCsv,
    events: Object.assign(EventEmitter, { EventEmitter, once: (emitter: EventEmitter, name: string) => new Promise((resolve) => emitter.once(name, (...values) => resolve(values))) }),
    lodash,
    moment,
    path: Object.assign({}, pathModule, { posix: pathModule }),
    'postman-collection': postmanCollection,
    punycode,
    querystring,
    stream: { Readable, Writable, Transform, Duplex: Transform, PassThrough: Transform },
    'string-decoder': { StringDecoder },
    timers: { setTimeout: runtime.setTimeout, clearTimeout: runtime.clearTimeout, setInterval: runtime.setInterval, clearInterval: runtime.clearInterval },
    tv4,
    url: { URL: runtime.URL, URLSearchParams: runtime.URLSearchParams, parse: (value: string) => { const url = new runtime.URL(value); return { href: url.href, protocol: url.protocol, host: url.host, hostname: url.hostname, port: url.port, pathname: url.pathname, search: url.search, query: querystring.parse(url.search.slice(1)), hash: url.hash }; }, format: (value: Record<string, unknown>) => value.href ? String(value.href) : `${value.protocol ?? 'http:'}//${value.host ?? value.hostname ?? ''}${value.pathname ?? ''}${value.search ?? ''}${value.hash ?? ''}`, resolve: (from: string, to: string) => new runtime.URL(to, from).toString() },
    util,
    uuid,
    xml2js,
  };
  return modules;
};
