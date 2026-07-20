import { Document, Spectral, type RuleDefinition, type RulesetDefinition } from '@stoplight/spectral-core';
import * as spectralFunctions from '@stoplight/spectral-functions';
import { Yaml } from '@stoplight/spectral-parsers';
import { Resolver } from '@stoplight/spectral-ref-resolver';
import { arazzo, asyncapi, oas } from '@stoplight/spectral-rulesets';
import { parse } from 'yaml';
import type { ApiDesignSourceFile, OpenApiIssue } from '../types';
import {
  API_DESIGN_SOURCE_LIMITS,
  fetchPublicSpecificationSource,
  normalizeApiDesignSourceFiles,
  normalizeRelativeApiDesignPath,
  safeSpecificationRemoteUrl,
  utf8Length,
  type RemoteSourceReader,
} from './apiDesignSources';

type UnknownRecord = Record<string, unknown>;
const MAX_REMOTE_SOURCES = 20;
const MAX_EXTENDS_DEPTH = 5;
const SOURCE_ROOT = '/brunomnia/spec';
const RULESET_ROOT = '/brunomnia/ruleset';
const PROTOTYPE_KEYS = ['__proto__', 'prototype', 'constructor'];
const ALLOWED_RULESET_KEYS = new Set(['extends', 'rules']);
const builtInRulesets: Record<string, RulesetDefinition> = {
  'spectral:oas': oas as unknown as RulesetDefinition,
  'spectral:asyncapi': asyncapi as unknown as RulesetDefinition,
  'spectral:arazzo': arazzo as unknown as RulesetDefinition,
};
const builtInFunctions: Record<string, unknown> = {
  alphabetical: spectralFunctions.alphabetical,
  casing: spectralFunctions.casing,
  defined: spectralFunctions.defined,
  enumeration: spectralFunctions.enumeration,
  falsy: spectralFunctions.falsy,
  length: spectralFunctions.length,
  or: spectralFunctions.or,
  pattern: spectralFunctions.pattern,
  schema: spectralFunctions.schema,
  truthy: spectralFunctions.truthy,
  undefined: spectralFunctions.undefined,
  unreferencedReusableObject: spectralFunctions.unreferencedReusableObject,
  xor: spectralFunctions.xor,
};

const record = (value: unknown): UnknownRecord | undefined => value !== null && typeof value === 'object' && !Array.isArray(value)
  ? value as UnknownRecord : undefined;

const toArray = <T>(value: T | T[] | undefined): T[] => value === undefined ? [] : Array.isArray(value) ? value : [value];

const virtualFiles = (files: ApiDesignSourceFile[], root: string) => new Map(
  normalizeApiDesignSourceFiles(files).map((file) => [`${root}/${file.path}`, file.contents]),
);

const safeField = (ruleName: string, field: unknown) => {
  if (field === undefined) return;
  if (typeof field !== 'string' || /[.\[\]]/.test(field) || PROTOTYPE_KEYS.some((key) => field.includes(key))) {
    throw new Error(`Rule '${ruleName}' has an unsafe field. Fields must be plain property names.`);
  }
};

const ruleFunction = (ruleName: string, name: unknown) => {
  if (typeof name !== 'string' || !(name in builtInFunctions)) {
    throw new Error(`Rule '${ruleName}' uses unsupported function '${String(name)}'. Custom JavaScript functions are disabled.`);
  }
  return builtInFunctions[name] as RuleDefinition['then'] extends Array<infer Entry> ? Entry : never;
};

const compileRule = (ruleName: string, rawRule: unknown) => {
  if (rawRule === true || rawRule === false || typeof rawRule === 'string') return rawRule;
  const rule = record(rawRule);
  if (!rule) throw new Error(`Rule '${ruleName}' must be an object, boolean, or severity string.`);
  if (PROTOTYPE_KEYS.includes(ruleName)) throw new Error(`Rule name '${ruleName}' is not allowed.`);
  for (const given of toArray(rule.given)) {
    if (typeof given !== 'string' || PROTOTYPE_KEYS.some((key) => given.includes(key))) throw new Error(`Rule '${ruleName}' has an unsafe given expression.`);
  }
  if (rule.documentationUrl !== undefined) {
    const documentation = safeSpecificationRemoteUrl(String(rule.documentationUrl));
    if (documentation.protocol !== 'https:') throw new Error(`Rule '${ruleName}' documentationUrl must use HTTPS.`);
  }
  const compileThen = (rawThen: unknown) => {
    const then = record(rawThen);
    if (!then) throw new Error(`Rule '${ruleName}' must declare an object or object array in then.`);
    safeField(ruleName, then.field);
    return { ...then, function: ruleFunction(ruleName, then.function) };
  };
  const then = Array.isArray(rule.then) ? rule.then.map(compileThen) : compileThen(rule.then);
  return { ...rule, then };
};

const parseRuleset = (contents: string, source: string) => {
  let parsed: unknown;
  try { parsed = parse(contents); } catch (error) { throw new Error(`Ruleset '${source}' is invalid: ${error instanceof Error ? error.message : String(error)}`); }
  const ruleset = record(parsed);
  if (!ruleset) throw new Error(`Ruleset '${source}' must be an object.`);
  const unsupported = Object.keys(ruleset).filter((key) => !ALLOWED_RULESET_KEYS.has(key));
  if (unsupported.length) throw new Error(`Ruleset '${source}' contains unsupported top-level keys: ${unsupported.join(', ')}.`);
  if (!Object.keys(ruleset).length) throw new Error(`Ruleset '${source}' must declare rules or extends.`);
  return ruleset;
};

const resolveVirtualPath = (source: string, reference: string, root: string) => {
  const base = source.slice(0, source.lastIndexOf('/') + 1).replace(`${root}/`, '');
  const relative = normalizeRelativeApiDesignPath(`${base}${reference.split('#', 1)[0]}`);
  return `${root}/${relative}`;
};

const compileRuleset = async (
  contents: string,
  source: string,
  files: Map<string, string>,
  fetchRemote: RemoteSourceReader,
  visited = new Set<string>(),
  depth = 0,
): Promise<RulesetDefinition> => {
  if (depth > MAX_EXTENDS_DEPTH) throw new Error(`Ruleset extends exceeds ${MAX_EXTENDS_DEPTH} nested levels at '${source}'.`);
  if (visited.has(source)) throw new Error(`Ruleset extends cycle detected at '${source}'.`);
  const raw = parseRuleset(contents, source);
  const nextVisited = new Set(visited).add(source);
  const inherited: RulesetDefinition[] = [];
  for (const entry of toArray(raw.extends)) {
    if (Array.isArray(entry)) throw new Error(`Ruleset '${source}' uses unsupported tuple extends syntax.`);
    if (typeof entry !== 'string') throw new Error(`Ruleset '${source}' extends entries must be strings.`);
    if (builtInRulesets[entry]) {
      inherited.push(builtInRulesets[entry]);
      continue;
    }
    if (source.startsWith('https://')) {
      const target = safeSpecificationRemoteUrl(new URL(entry, source).href).href;
      inherited.push(await compileRuleset(await fetchRemote(target), target, files, fetchRemote, nextVisited, depth + 1));
      continue;
    }
    if (entry.startsWith('https://')) {
      const target = safeSpecificationRemoteUrl(entry).href;
      inherited.push(await compileRuleset(await fetchRemote(target), target, files, fetchRemote, nextVisited, depth + 1));
      continue;
    }
    if (!entry.startsWith('./') && !entry.startsWith('../')) {
      throw new Error(`Ruleset extends entry '${entry}' is not a built-in identifier, relative YAML file, or HTTPS URL.`);
    }
    const target = resolveVirtualPath(source, entry, RULESET_ROOT);
    const targetContents = files.get(target);
    if (targetContents === undefined) throw new Error(`Ruleset extends file '${entry}' was not selected.`);
    inherited.push(await compileRuleset(targetContents, target, files, fetchRemote, nextVisited, depth + 1));
  }
  const rawRules = raw.rules === undefined ? undefined : record(raw.rules);
  if (raw.rules !== undefined && !rawRules) throw new Error(`Ruleset '${source}' rules must be an object.`);
  const rules = rawRules ? Object.fromEntries(Object.entries(rawRules).map(([name, rule]) => [name, compileRule(name, rule)])) : undefined;
  if (inherited.length && rules) return { extends: inherited, rules } as RulesetDefinition;
  if (inherited.length) return { extends: inherited } as RulesetDefinition;
  if (rules) return { rules } as RulesetDefinition;
  throw new Error(`Ruleset '${source}' must declare rules or extends.`);
};

const createResolver = (files: Map<string, string>, fetchRemote: RemoteSourceReader) => {
  const fetched = new Map<string, Promise<string>>();
  const readRemote = async (rawUrl: string) => {
    const url = safeSpecificationRemoteUrl(rawUrl).href;
    const cached = fetched.get(url);
    if (cached !== undefined) return cached;
    if (fetched.size >= MAX_REMOTE_SOURCES) throw new Error(`Specification references exceed the ${MAX_REMOTE_SOURCES}-source remote limit.`);
    const request = fetchRemote(url).then((contents) => {
      if (utf8Length(contents) > API_DESIGN_SOURCE_LIMITS.fileBytes) throw new Error(`Remote source '${url}' exceeds the 1 MB limit.`);
      return contents;
    });
    fetched.set(url, request);
    return request;
  };
  return new Resolver({
    resolvers: {
      file: { resolve: async (reference) => {
        const path = decodeURIComponent(reference.path());
        const contents = files.get(path);
        if (contents === undefined) throw new Error(`Referenced source '${path.replace(`${SOURCE_ROOT}/`, '')}' was not selected.`);
        return contents;
      } },
      http: { resolve: async (reference) => { throw new Error(`Remote source '${reference.href()}' must use HTTPS.`); } },
      https: { resolve: async (reference) => readRemote(reference.href()) },
    },
  });
};

const diagnosticIssue = (diagnostic: {
  code: string | number;
  message: string;
  path: Array<string | number>;
  severity: number;
  source?: string | null;
  range?: { start: { line: number; character: number } };
}): OpenApiIssue => ({
  severity: diagnostic.severity === 0 ? 'error' : diagnostic.severity === 1 ? 'warning' : diagnostic.severity === 2 ? 'info' : 'hint',
  path: diagnostic.path.length ? diagnostic.path.join('.') : '$',
  message: diagnostic.message,
  code: String(diagnostic.code),
  source: diagnostic.source?.replace(`${SOURCE_ROOT}/`, ''),
  line: diagnostic.range ? diagnostic.range.start.line + 1 : undefined,
  character: diagnostic.range ? diagnostic.range.start.character + 1 : undefined,
});

export const lintOpenApiWithSpectral = async (input: {
  contents: string;
  ruleset?: string;
  sourceFiles?: ApiDesignSourceFile[];
  rulesetFiles?: ApiDesignSourceFile[];
  fetchRemote?: RemoteSourceReader;
}) => {
  const fetchRemote = input.fetchRemote ?? fetchPublicSpecificationSource;
  const specFiles = virtualFiles(input.sourceFiles ?? [], SOURCE_ROOT);
  const rulesetFiles = virtualFiles(input.rulesetFiles ?? input.sourceFiles ?? [], RULESET_ROOT);
  const spectral = new Spectral({ resolver: createResolver(specFiles, fetchRemote) });
  spectral.setRuleset((input.ruleset?.trim()
    ? await compileRuleset(input.ruleset, `${RULESET_ROOT}/.spectral.yaml`, rulesetFiles, fetchRemote)
    : oas) as unknown as RulesetDefinition);
  const document = new Document(input.contents, Yaml, `${SOURCE_ROOT}/openapi.yaml`);
  const result = await spectral.runWithResolved(document);
  return { document: result.resolved as UnknownRecord | undefined, issues: result.results.map(diagnosticIssue) };
};
