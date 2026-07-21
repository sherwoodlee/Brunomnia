import type { ApiRequest, HttpResponse, PluginDependencyPackage, PluginPermission, PluginRecord, Workspace } from '../types';
import { createBlankRequest } from '../data/seed';
import { buildPluginModuleRegistrySource, canonicalPluginModule, inferPluginModules, pluginBaselineModules, pluginCuratedModules, pluginDependencyPackageName, pluginModuleVersions, validateRegistryPluginName } from './pluginModules';
import { templateOsInfo } from './templates';

export { inferPluginModules, pluginBaselineModules, pluginCuratedModules, pluginDependencyPackageName, pluginModuleVersions, validateRegistryPluginName };

export type PluginTemplateDescriptor = { name: string; displayName: string; description: string };
export type PluginActionDescriptor = { id: string; label: string; kind: 'request' | 'request-group' | 'workspace' | 'document' };
export type PluginThemeDescriptor = { id: string; pluginId: string; name: string; displayName: string; colors: Record<string, string>; rawCss: string };
export type PluginDescriptor = { templates: PluginTemplateDescriptor[]; actions: PluginActionDescriptor[]; themes: PluginThemeDescriptor[] };
export type PluginNotification = { type: 'log' | 'alert'; title: string; message: string };
export type PluginActionTarget = { requestId?: string; collectionId?: string; folderId?: string; designId?: string };
export type ContextualPluginActionKind = Exclude<PluginActionDescriptor['kind'], 'workspace'>;
export type ContextualPluginAction = {
  key: string;
  pluginId: string;
  pluginName: string;
  descriptor: PluginActionDescriptor & { kind: ContextualPluginActionKind };
  authorityKey: string;
};
export type ContextualPluginActionDiscovery = {
  actions: ContextualPluginAction[];
  errors: Array<{ pluginId: string; pluginName: string; message: string }>;
};

export type PluginHostCallbacks = {
  network?: (request: ApiRequest) => Promise<HttpResponse>;
  prompt?: (title: string, defaultValue: string) => Promise<string>;
  dialog?: (title: string, message: string) => Promise<void>;
  readClipboard?: () => Promise<string>;
  writeClipboard?: (value: string) => Promise<void>;
  clearClipboard?: () => Promise<void>;
  getPath?: (name: string) => Promise<string>;
  showSaveDialog?: (defaultPath: string) => Promise<string | null>;
  importData?: (source: 'raw' | 'uri', value: string) => Promise<void>;
  exportData?: (format: 'insomnia' | 'har', options: Record<string, unknown>) => Promise<string>;
  environment?: Record<string, unknown>;
  osInfo?: () => Promise<Record<string, unknown>>;
};

type PluginOperation =
  | { kind: 'describe' }
  | { kind: 'request'; request: ApiRequest }
  | { kind: 'response'; request: ApiRequest; response: HttpResponse }
  | { kind: 'template'; name: string; args: string[]; request: ApiRequest }
  | { kind: 'action'; id: string; actionKind: PluginActionDescriptor['kind']; request: ApiRequest; workspace: Workspace; target?: PluginActionTarget };

type PluginWorkerResult = {
  ok: boolean;
  error?: string;
  descriptor?: PluginDescriptor;
  request?: ApiRequest;
  response?: HttpResponse;
  value?: string;
  handled?: boolean;
  store: Record<string, string>;
  notifications: PluginNotification[];
};

export type PluginActionResult = Pick<PluginWorkerResult, 'request' | 'store' | 'notifications'>;

const permissionList: PluginPermission[] = ['request:read', 'request:write', 'response:read', 'response:write', 'store', 'network', 'app:prompt', 'app:clipboard', 'app:file', 'data:read', 'data:write', 'data:private', 'template', 'action', 'theme'];
export const pluginPermissions = [...permissionList];
export const pluginPermissionLabels: Record<PluginPermission, string> = {
  'request:read': 'Read requests', 'request:write': 'Modify requests', 'response:read': 'Read responses', 'response:write': 'Modify responses', store: 'Plugin-local storage', network: 'Send network requests', 'app:prompt': 'Show prompts', 'app:clipboard': 'Read/write clipboard', 'app:file': 'Choose local paths', 'data:read': 'Export project data', 'data:write': 'Import project data', 'data:private': 'Include private environments', template: 'Custom template tags', action: 'Request/folder/workspace actions', theme: 'Theme colors and CSS',
};

export const inferPluginPermissions = (source: string): PluginPermission[] => {
  const permissions = new Set<PluginPermission>();
  if (/\brequestHooks\b/.test(source)) { permissions.add('request:read'); permissions.add('request:write'); }
  if (/\bresponseHooks\b/.test(source)) { permissions.add('response:read'); permissions.add('response:write'); }
  if (/\b(?:context\.)?request\.(?:get|has)[A-Z]/.test(source)) permissions.add('request:read');
  if (/\b(?:context\.)?request\.(?:set|add|remove|setting)[A-Z]/.test(source)) permissions.add('request:write');
  if (/\b(?:context\.)?response\.(?:get|has)[A-Z]/.test(source)) permissions.add('response:read');
  if (/\b(?:context\.)?response\.setBody\b/.test(source)) permissions.add('response:write');
  if (/\btemplateTags\b/.test(source)) permissions.add('template');
  if (/\b(?:request|requestGroup|workspace|document)Actions\b/.test(source)) permissions.add('action');
  if (/\bthemes\b/.test(source)) permissions.add('theme');
  if (/\bcontext\.store\b|\bstore\.(?:get|set|remove|clear|all|has)Item\b/.test(source)) permissions.add('store');
  if (/\bcontext\.network\b|\bnetwork\.sendRequest\b/.test(source)) permissions.add('network');
  if (/\bcontext\.app\.(?:prompt|dialog)\b|\bapp\.(?:prompt|dialog)\b/.test(source)) permissions.add('app:prompt');
  if (/\bcontext\.app\.clipboard\b|\bapp\.clipboard\b/.test(source)) permissions.add('app:clipboard');
  if (/\bcontext\.app\.(?:getPath|showSaveDialog)\b|\bapp\.(?:getPath|showSaveDialog)\b/.test(source)) permissions.add('app:file');
  if (/\bcontext\.data\.export\b|\bdata\.export\b/.test(source)) permissions.add('data:read');
  if (/\bcontext\.data\.import\b|\bdata\.import\b/.test(source)) permissions.add('data:write');
  if (/\bincludePrivate\s*:\s*true\b/.test(source)) permissions.add('data:private');
  return permissionList.filter((permission) => permissions.has(permission));
};

export const validatePluginSource = (source: string) => {
  if (!source.trim()) throw new Error('Plugin source is empty.');
  if (source.length > 1_000_000) throw new Error('Plugin source exceeds the 1 MB local limit.');
  if (/\bimport\s*(?:\/\*[\s\S]*?\*\/\s*)?\(/.test(source) || /(^|[;\n])\s*import\s/m.test(source)) throw new Error('ES module imports are not available in the isolated plugin runtime.');
  if (/(^|[;\n])\s*export\s/m.test(source)) throw new Error('ES module exports are not available in the isolated plugin runtime.');
};

const normalizePluginNetworkRequest = (value: unknown): ApiRequest => {
  const raw = value && typeof value === 'object' ? value as Partial<ApiRequest> & { _id?: string; parameters?: Array<{ name?: unknown; value?: unknown; disabled?: unknown }> } : {};
  const request = createBlankRequest(typeof raw.id === 'string' ? raw.id : typeof raw._id === 'string' ? raw._id : `plugin-network-${crypto.randomUUID()}`);
  if (typeof raw.name === 'string') request.name = raw.name;
  if (typeof raw.url === 'string') request.url = raw.url;
  if (typeof raw.method === 'string') request.method = raw.method.toUpperCase();
  if (typeof raw.protocol === 'string' && ['http', 'graphql'].includes(raw.protocol)) request.protocol = raw.protocol as ApiRequest['protocol'];
  const rows = (entries: unknown, prefix: string) => Array.isArray(entries) ? entries.flatMap((entry, index) => {
    if (!entry || typeof entry !== 'object') return [];
    const row = entry as { id?: unknown; name?: unknown; value?: unknown; enabled?: unknown; disabled?: unknown; description?: unknown };
    return [{ id: typeof row.id === 'string' ? row.id : `${request.id}-${prefix}-${index}`, name: String(row.name ?? ''), value: String(row.value ?? ''), enabled: row.enabled !== false && row.disabled !== true, description: String(row.description ?? '') }];
  }) : [];
  if (Array.isArray(raw.headers)) request.headers = rows(raw.headers, 'header');
  if (Array.isArray(raw.params) || Array.isArray(raw.parameters)) request.params = rows(raw.params ?? raw.parameters, 'parameter');
  if (raw.auth && typeof raw.auth === 'object') request.auth = { ...request.auth, ...structuredClone(raw.auth) };
  if (raw.transport && typeof raw.transport === 'object') request.transport = { ...request.transport, ...structuredClone(raw.transport) };
  if (typeof raw.body === 'string') { request.body = raw.body; request.bodyMode = raw.body ? 'text' : 'none'; }
  else if (raw.body && typeof raw.body === 'object') {
    const body = raw.body as { mimeType?: unknown; text?: unknown };
    request.body = String(body.text ?? '');
    request.bodyMode = String(body.mimeType ?? '').includes('json') ? 'json' : request.body ? 'text' : 'none';
  }
  return request;
};

const safeIdentifier = () => `__br_${crypto.randomUUID().replace(/-/g, '')}`;

const safePluginModuleKey = (key: string) => {
  const parts = key.split('/');
  return Boolean(key) && key.length <= 1_000 && !key.startsWith('/') && !key.includes('\\') && !key.includes('\0') && /\.(?:c?js|json)$/.test(key) && parts.every((part) => Boolean(part) && part !== '.' && part !== '..');
};

const validateModuleSource = (key: string, value: string, label: string) => {
  if (typeof value !== 'string') throw new Error(`${label} module '${key}' must contain text.`);
  const bytes = new TextEncoder().encode(value).byteLength;
  if (bytes > 1_000_000) throw new Error(`${label} module '${key}' exceeds the 1 MB limit.`);
  if (/\.(?:c?js)$/.test(key) && value.trim()) {
    if (/\bimport\s*(?:\/\*[\s\S]*?\*\/\s*)?\(/.test(value) || /(^|[;\n])\s*import\s/m.test(value)) throw new Error(`${label} module '${key}' uses unavailable ES module imports.`);
    if (/(^|[;\n])\s*export\s/m.test(value)) throw new Error(`${label} module '${key}' uses unavailable ES module exports.`);
  }
  return bytes;
};

const normalizedPluginModules = (source: string, moduleFiles?: Record<string, string>, entryModuleKey?: string) => {
  validatePluginSource(source);
  const files: Record<string, string> = moduleFiles && Object.keys(moduleFiles).length ? { ...moduleFiles } : { 'index.js': source };
  const entry = entryModuleKey && entryModuleKey in files ? entryModuleKey : 'index.js';
  files[entry] = source;
  const entries = Object.entries(files);
  if (entries.length > 500) throw new Error('Plugin package exceeds the 500-module limit.');
  let totalBytes = 0;
  for (const [key, value] of entries) {
    if (!safePluginModuleKey(key) || key.split('/').includes('node_modules')) throw new Error(`Plugin module path '${key}' is not safe.`);
    totalBytes += validateModuleSource(key, value, 'Plugin');
    if (totalBytes > 5_000_000) throw new Error('Plugin package exceeds the 5 MB aggregate module limit.');
  }
  return { files, entry };
};

const normalizedDependencyModules = (moduleFiles: Record<string, string> = {}, packages: Record<string, PluginDependencyPackage> = {}) => {
  const packageEntries = Object.entries(packages);
  const fileEntries = Object.entries(moduleFiles);
  if (packageEntries.length > 50) throw new Error('Plugin dependencies exceed the 50-package limit.');
  if (fileEntries.length > 2_000) throw new Error('Plugin dependencies exceed the 2,000-module limit.');
  let totalBytes = 0;
  for (const [key, value] of fileEntries) {
    if (!safePluginModuleKey(key) || !key.startsWith('node_modules/')) throw new Error(`Plugin dependency module path '${key}' is not safe.`);
    totalBytes += validateModuleSource(key, value, 'Plugin dependency');
    if (totalBytes > 20_000_000) throw new Error('Plugin dependencies exceed the 20 MB aggregate module limit.');
  }
  for (const [name, dependency] of packageEntries) {
    if (pluginDependencyPackageName(name) !== name) throw new Error(`Plugin dependency package '${name}' is not safe.`);
    if (!dependency || typeof dependency.version !== 'string' || dependency.version.length > 200) throw new Error(`Plugin dependency package '${name}' has invalid metadata.`);
    if (!dependency.entryModuleKey.startsWith(`node_modules/${name}/`) || !(dependency.entryModuleKey in moduleFiles)) throw new Error(`Plugin dependency package '${name}' has an invalid entry module.`);
  }
  return { files: { ...moduleFiles }, packages: structuredClone(packages) };
};

export const pluginSourceText = (plugin: Pick<PluginRecord, 'source' | 'moduleFiles' | 'entryModuleKey' | 'dependencyModuleFiles'>) => {
  const files: Record<string, string> = plugin.moduleFiles ? { ...plugin.moduleFiles } : { 'index.js': plugin.source };
  files[plugin.entryModuleKey && plugin.entryModuleKey in files ? plugin.entryModuleKey : 'index.js'] = plugin.source;
  return [...Object.values(files), ...Object.values(plugin.dependencyModuleFiles ?? {})].join('\n');
};

export const buildPluginWorkerSource = (source: string, nonce = safeIdentifier(), moduleFiles?: Record<string, string>, entryModuleKey?: string, grantedModules: string[] = [], dependencyModuleFiles?: Record<string, string>, dependencyPackages?: Record<string, PluginDependencyPackage>) => {
  const packageModules = normalizedPluginModules(source, moduleFiles, entryModuleKey);
  const dependencyModules = normalizedDependencyModules(dependencyModuleFiles, dependencyPackages);
  const moduleGrants = [...new Set(grantedModules.map(canonicalPluginModule))];
  const moduleRegistry = buildPluginModuleRegistrySource(grantedModules, nonce);
  const host = `${nonce}_host`;
  const pending = `${nonce}_pending`;
  const state = `${nonce}_state`;
  const rpc = `${nonce}_rpc`;
  const permissions = `${nonce}_permissions`;
  const notifications = `${nonce}_notifications`;
  const exportsValue = `${nonce}_exports`;
  const requestApi = `${nonce}_requestApi`;
  const responseApi = `${nonce}_responseApi`;
  const contextApi = `${nonce}_contextApi`;
  const post = `${nonce}_post`;
  const input = `${nonce}_input`;
  const nativeFunction = `${nonce}_nativeFunction`;
  const packageFiles = `${nonce}_packageFiles`;
  const dependencyFiles = `${nonce}_dependencyFiles`;
  const dependencyMetadata = `${nonce}_dependencyMetadata`;
  const grantedModuleSet = `${nonce}_grantedModuleSet`;
  const reservedModuleSet = `${nonce}_reservedModuleSet`;
  const packageCache = `${nonce}_packageCache`;
  const osInfo = `${nonce}_osInfo`;
  const processStub = `${nonce}_process`;
  const safeGlobal = `${nonce}_global`;
  return `
const ${host} = self;
const ${post} = ${host}.postMessage.bind(${host});
const ${nativeFunction} = Function;
const ${pending} = new Map();
let ${nonce}_sequence = 0;
const ${rpc} = (type, payload) => new Promise((resolve, reject) => {
  const id = '${nonce}-' + (++${nonce}_sequence);
  ${pending}.set(id, { resolve, reject });
  ${post}({ kind: 'rpc', id, type, payload });
});
${host}.onmessage = async ({ data: ${input} }) => {
  if (${input} && ${input}.__pluginRpcResponse) {
    const call = ${pending}.get(${input}.id); if (!call) return;
    ${pending}.delete(${input}.id); ${input}.ok ? call.resolve(${input}.value) : call.reject(new Error(${input}.error || 'Plugin host call failed.')); return;
  }
  const ${state} = structuredClone(${input}.state);
  const ${permissions} = new Set(${input}.permissions || []);
  const ${notifications} = [];
  const requirePermission = permission => { if (!${permissions}.has(permission)) throw new Error('Plugin permission not granted: ' + permission); };
  const constructors = [Function, (async () => {}).constructor, (function* () {}).constructor, (async function* () {}).constructor];
  constructors.forEach(constructor => { try { Object.defineProperty(constructor.prototype, 'constructor', { value: undefined, writable: false, configurable: false }); } catch {} });
  const deniedGlobals = ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'Worker', 'SharedWorker', 'importScripts', 'indexedDB', 'caches', 'postMessage', 'eval'];
  deniedGlobals.forEach(name => { try { Object.defineProperty(${host}, name, { value: undefined, writable: false, configurable: false }); } catch {} });
  class SafeBuffer extends Uint8Array {
    static from(value, encoding = 'utf8') {
      if (value instanceof Uint8Array) return new SafeBuffer(value);
      if (encoding === 'base64') return new SafeBuffer(Uint8Array.from(atob(String(value)), character => character.charCodeAt(0)));
      if (encoding === 'hex') return new SafeBuffer(Uint8Array.from((String(value).match(/.{1,2}/g) || []).map(part => parseInt(part, 16))));
      if (encoding === 'latin1' || encoding === 'binary') return new SafeBuffer(Uint8Array.from(String(value), character => character.charCodeAt(0) & 255));
      return new SafeBuffer(new TextEncoder().encode(typeof value === 'string' ? value : JSON.stringify(value)));
    }
    static alloc(size, fill = 0) { const value = new SafeBuffer(Math.max(0, Math.min(1000000, Number(size) || 0))); value.fill(typeof fill === 'number' ? fill : 0); return value; }
    static isBuffer(value) { return value instanceof SafeBuffer; }
    static concat(values) { const length = values.reduce((sum, value) => sum + value.length, 0); const output = new SafeBuffer(length); let offset = 0; values.forEach(value => { output.set(value, offset); offset += value.length; }); return output; }
    toString(encoding = 'utf8') { if (encoding === 'base64') return btoa(String.fromCharCode(...this)); if (encoding === 'hex') return Array.from(this, value => value.toString(16).padStart(2, '0')).join(''); if (encoding === 'latin1' || encoding === 'binary') return String.fromCharCode(...this); return new TextDecoder().decode(this); }
  }
  const ${osInfo} = ${state}.osInfo && typeof ${state}.osInfo === 'object' ? structuredClone(${state}.osInfo) : {};
  const ${processStub} = Object.freeze({
    platform: String(${osInfo}.platform || 'unknown'), arch: String(${osInfo}.arch || 'unknown'), version: '',
    versions: Object.freeze({}), env: Object.freeze({}), argv: Object.freeze([]),
    nextTick: (callback, ...args) => { Promise.resolve().then(() => callback(...args)); },
  });
  try { Object.defineProperty(${host}, 'process', { value: ${processStub}, writable: false, configurable: false, enumerable: true }); } catch {}
  if (${input}.operation?.kind === 'template') {
    try { Object.defineProperty(${host}, 'INSOMNIA_TEMPLATE_SANDBOX', { value: true, writable: false, configurable: false, enumerable: true }); } catch {}
  }
  const ${safeGlobal} = Object.create(null);
  Object.assign(${safeGlobal}, {
    Buffer: SafeBuffer, URL, URLSearchParams, TextEncoder, TextDecoder, process: ${processStub}, crypto: ${host}.crypto,
    setTimeout, clearTimeout, INSOMNIA_TEMPLATE_SANDBOX: ${input}.operation?.kind === 'template' ? true : undefined,
  });
  ${safeGlobal}.globalThis = ${safeGlobal}; ${safeGlobal}.self = ${safeGlobal}; Object.freeze(${safeGlobal});
${moduleRegistry.source}
  const safeConsole = {
    log: (...values) => ${notifications}.push({ type: 'log', title: 'Plugin log', message: values.map(String).join(' ') }),
    info: (...values) => ${notifications}.push({ type: 'log', title: 'Plugin info', message: values.map(String).join(' ') }),
    warn: (...values) => ${notifications}.push({ type: 'log', title: 'Plugin warning', message: values.map(String).join(' ') }),
    error: (...values) => ${notifications}.push({ type: 'log', title: 'Plugin error', message: values.map(String).join(' ') }),
  };
  const ${packageFiles} = JSON.parse(${JSON.stringify(JSON.stringify(packageModules.files))});
  const ${dependencyFiles} = JSON.parse(${JSON.stringify(JSON.stringify(dependencyModules.files))});
  const ${dependencyMetadata} = JSON.parse(${JSON.stringify(JSON.stringify(dependencyModules.packages))});
  const ${grantedModuleSet} = new Set(${JSON.stringify(moduleGrants)});
  const ${reservedModuleSet} = new Set(${JSON.stringify([...pluginBaselineModules, ...pluginCuratedModules])});
  const ${packageCache} = Object.create(null);
  const normalizeModuleKey = value => {
    const output = [];
    for (const part of String(value).split('/')) {
      if (!part || part === '.') continue;
      if (part === '..') { if (!output.length) return null; output.pop(); }
      else output.push(part);
    }
    return output.join('/');
  };
  const resolveModuleKey = (files, fromKey, specifier, seen = new Set()) => {
    const fromParts = String(fromKey).split('/'); fromParts.pop();
    const normalized = normalizeModuleKey(fromParts.concat(String(specifier).split('/')).join('/'));
    if (!normalized || seen.has(normalized)) return null;
    seen.add(normalized);
    const direct = [normalized, normalized + '.js', normalized + '.cjs', normalized + '.json'].find(candidate => Object.prototype.hasOwnProperty.call(files, candidate));
    if (direct) return direct;
    const manifestKey = normalized + '/package.json';
    if (Object.prototype.hasOwnProperty.call(files, manifestKey)) {
      try {
        const manifest = JSON.parse(files[manifestKey]);
        const main = typeof manifest.main === 'string' && manifest.main ? manifest.main : 'index.js';
        const fromManifest = resolveModuleKey(files, manifestKey, './' + main, seen);
        if (fromManifest) return fromManifest;
      } catch {}
    }
    return [normalized + '/index.js', normalized + '/index.cjs', normalized + '/index.json'].find(candidate => Object.prototype.hasOwnProperty.call(files, candidate)) || null;
  };
  const dependencyPackageName = specifier => {
    const parts = String(specifier).split('/');
    if (parts.some(part => !part || part === '.' || part === '..')) return '';
    return String(specifier).startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
  };
  const dependencyPackageForKey = key => dependencyPackageName(String(key).slice('node_modules/'.length));
  const resolveDependencyKey = specifier => {
    const packageName = dependencyPackageName(specifier);
    const dependency = ${dependencyMetadata}[packageName];
    if (!dependency) return null;
    if (specifier === packageName) return dependency.entryModuleKey;
    return resolveModuleKey(${dependencyFiles}, 'node_modules/' + packageName + '/index.js', './' + specifier.slice(packageName.length + 1));
  };
  const loadPluginModule = key => {
    if (Object.prototype.hasOwnProperty.call(${packageCache}, key)) return ${packageCache}[key].exports;
    const files = key.startsWith('node_modules/') ? ${dependencyFiles} : ${packageFiles};
    if (!Object.prototype.hasOwnProperty.call(files, key)) throw new Error("Cannot find plugin module '" + key + "'.");
    const module = { exports: {}, filename: key }; ${packageCache}[key] = module;
    if (key.endsWith('.json')) { module.exports = JSON.parse(files[key]); return module.exports; }
    const localRequire = name => {
      const specifier = String(name);
      if (specifier.startsWith('./') || specifier.startsWith('../')) {
        const resolved = resolveModuleKey(files, key, specifier);
        if (!resolved) throw new Error("Cannot find module '" + specifier + "' from '" + key + "'.");
        if (key.startsWith('node_modules/')) {
          const packagePrefix = 'node_modules/' + dependencyPackageForKey(key) + '/';
          if (!resolved.startsWith(packagePrefix)) throw new Error("Dependency-relative module '" + specifier + "' escaped package '" + dependencyPackageForKey(key) + "'.");
        }
        return loadPluginModule(resolved);
      }
      if (${reservedModuleSet}.has(specifier)) return ${moduleRegistry.safeRequire}(specifier);
      const dependencyKey = resolveDependencyKey(specifier);
      if (dependencyKey) {
        const packageName = dependencyPackageName(specifier);
        if (!${grantedModuleSet}.has(specifier) && !${grantedModuleSet}.has(packageName)) throw new Error("Module '" + specifier + "' not permitted by manifest");
        return loadPluginModule(dependencyKey);
      }
      return ${moduleRegistry.safeRequire}(specifier);
    };
    const directory = key.includes('/') ? key.slice(0, key.lastIndexOf('/')) : '.';
    const compiled = ${nativeFunction}('module', 'exports', 'require', '__dirname', '__filename', 'Buffer', 'console', 'TextEncoder', 'TextDecoder', 'URL', 'setTimeout', 'clearTimeout', 'globalThis', 'self', 'window', 'document', 'navigator', 'fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'Worker', 'importScripts', 'indexedDB', 'caches', 'postMessage', 'Function', 'WebAssembly', "'use strict';\\n" + files[key]);
    compiled(module, module.exports, localRequire, directory, key, SafeBuffer, safeConsole, TextEncoder, TextDecoder, URL, setTimeout, clearTimeout, ${safeGlobal}, ${safeGlobal}, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined);
    return module.exports;
  };
  try {
    const ${exportsValue} = loadPluginModule(${JSON.stringify(packageModules.entry)}) || {};
    const store = {
      hasItem: async key => { requirePermission('store'); return Object.prototype.hasOwnProperty.call(${state}.store, key); },
      getItem: async key => { requirePermission('store'); return ${state}.store[key] ?? null; },
      setItem: async (key, value) => { requirePermission('store'); ${state}.store[key] = String(value); },
      removeItem: async key => { requirePermission('store'); delete ${state}.store[key]; },
      clear: async () => { requirePermission('store'); Object.keys(${state}.store).forEach(key => delete ${state}.store[key]); },
      all: async () => { requirePermission('store'); return Object.entries(${state}.store).map(([key, value]) => ({ key, value })); },
    };
    const app = {
      alert: async (title, message = '') => { ${notifications}.push({ type: 'alert', title: String(title), message: String(message) }); },
      dialog: async (title, body) => { requirePermission('app:prompt'); return ${rpc}('dialog', { title: String(title), message: String(body?.outerHTML ?? body ?? '') }); },
      prompt: async (title, options = {}) => { requirePermission('app:prompt'); return ${rpc}('prompt', { title: String(title), defaultValue: String(options.defaultValue ?? '') }); },
      getPath: async name => { requirePermission('app:file'); return ${rpc}('path', { name: String(name) }); },
      showSaveDialog: async (options = {}) => { requirePermission('app:file'); return ${rpc}('save-dialog', { defaultPath: String(options.defaultPath ?? '') }); },
      clipboard: {
        readText: async () => { requirePermission('app:clipboard'); return ${rpc}('clipboard-read', {}); },
        writeText: async value => { requirePermission('app:clipboard'); return ${rpc}('clipboard-write', { value: String(value) }); },
        clear: async () => { requirePermission('app:clipboard'); return ${rpc}('clipboard-clear', {}); },
      },
      getInfo: () => ({ name: 'Brunomnia', version: '0.1.0', platform: String(${state}.platform || 'unknown') }),
    };
    const data = {
      import: {
        uri: async uri => { requirePermission('data:write'); return ${rpc}('data-import', { source: 'uri', value: String(uri) }); },
        raw: async value => { requirePermission('data:write'); return ${rpc}('data-import', { source: 'raw', value: String(value) }); },
      },
      export: {
        insomnia: async (options = {}) => { requirePermission('data:read'); if (options.includePrivate) requirePermission('data:private'); return ${rpc}('data-export', { format: 'insomnia', options }); },
        har: async (options = {}) => { requirePermission('data:read'); if (options.includePrivate) requirePermission('data:private'); return ${rpc}('data-export', { format: 'har', options }); },
      },
    };
    const network = { sendRequest: async request => { requirePermission('network'); const response = await ${rpc}('network', { request }); return { ...response, statusCode: response.status, statusMessage: response.statusText, elapsedTime: response.durationMs, bytesRead: response.wireSizeBytes ?? response.sizeBytes }; } };
    const util = { nodeOS: async () => structuredClone(${osInfo}) };
    const nextRow = (prefix, rows, name, value) => ({ id: 'plugin-' + prefix + '-' + Date.now() + '-' + rows.length, name: String(name), value: String(value), enabled: true });
    const requestBody = request => {
      if (request.protocol === 'graphql') return { mimeType: 'application/graphql', text: request.graphql?.query || '' };
      if (request.bodyMode === 'form-urlencoded') return { mimeType: 'application/x-www-form-urlencoded', params: (request.formBody || []).map(row => ({ name: row.name, value: row.value, description: row.description, disabled: !row.enabled, multiline: row.multiline, id: row.id })) };
      if (request.bodyMode === 'multipart') return { mimeType: 'multipart/form-data', params: (request.multipartBody || []).map(row => ({ name: row.name, value: row.value, description: row.description, disabled: !row.enabled, multiline: row.multiline, id: row.id, fileName: row.fileName || row.file?.fileName, type: row.kind === 'file' ? 'file' : 'text' })) };
      if (request.bodyMode === 'binary') return { mimeType: request.binaryBody?.mimeType || 'application/octet-stream', fileName: request.binaryBody?.fileName || '' };
      const mimeType = (request.headers || []).find(header => header.enabled && String(header.name).toLowerCase() === 'content-type')?.value || (request.bodyMode === 'json' ? 'application/json' : 'text/plain');
      return request.bodyMode === 'none' ? {} : { mimeType, text: request.body || '' };
    };
    const setRequestBody = (request, value) => {
      const body = typeof value === 'string' ? { text: value } : value && typeof value === 'object' ? value : {};
      const mimeType = String(body.mimeType || '').toLowerCase();
      if (request.protocol === 'graphql' && mimeType === 'application/graphql') { request.graphql.query = String(body.text || ''); return; }
      if (mimeType === 'application/x-www-form-urlencoded') {
        request.bodyMode = 'form-urlencoded'; request.formBody = (Array.isArray(body.params) ? body.params : []).map((row, index) => ({ id: String(row.id || 'plugin-form-' + index), name: String(row.name || ''), value: String(row.value || ''), enabled: row.disabled !== true, description: String(row.description || ''), multiline: Boolean(row.multiline) })); return;
      }
      if (mimeType === 'multipart/form-data') {
        request.bodyMode = 'multipart'; request.multipartBody = (Array.isArray(body.params) ? body.params : []).map((row, index) => ({ id: String(row.id || 'plugin-part-' + index), name: String(row.name || ''), value: String(row.value || ''), enabled: row.disabled !== true, description: String(row.description || ''), multiline: Boolean(row.multiline), kind: row.type === 'file' || row.fileName ? 'file' : 'text', fileName: String(row.fileName || ''), contentType: String(row.contentType || '') })); return;
      }
      request.bodyMode = mimeType.includes('json') ? 'json' : body.text === undefined && !mimeType ? 'none' : 'text'; request.body = String(body.text || '');
      if (mimeType) {
        const existing = request.headers.find(header => String(header.name).toLowerCase() === 'content-type');
        if (existing) { existing.value = String(body.mimeType); existing.enabled = true; } else request.headers.push(nextRow('header', request.headers, 'Content-Type', body.mimeType));
      }
    };
    const read = value => { requirePermission('request:read'); return value; };
    const ${requestApi} = request => ({
      getId: () => read(request.id), getName: () => read(request.name), setName: value => { requirePermission('request:write'); request.name = String(value); },
      getUrl: () => read(request.url), setUrl: value => { requirePermission('request:write'); request.url = String(value); },
      getMethod: () => read(request.method), setMethod: value => { requirePermission('request:write'); request.method = String(value).toUpperCase(); },
      getBody: () => read(structuredClone(requestBody(request))), setBody: value => { requirePermission('request:write'); setRequestBody(request, value); },
      getBodyText: () => read(String(requestBody(request).text || '')), setBodyText: value => { requirePermission('request:write'); const body = requestBody(request); setRequestBody(request, { ...body, text: String(value) }); },
      getHeader: name => read(request.headers.filter(header => header.enabled && header.name.toLowerCase() === String(name).toLowerCase()).at(-1)?.value ?? null),
      getHeaders: () => read(request.headers.filter(header => header.enabled).map(header => ({ name: header.name, value: header.value }))),
      hasHeader: name => read(request.headers.some(header => header.enabled && header.name.toLowerCase() === String(name).toLowerCase())),
      setHeader: (name, value) => { requirePermission('request:write'); const existing = request.headers.find(header => header.name.toLowerCase() === String(name).toLowerCase()); if (existing) { existing.value = String(value); existing.enabled = true; } else request.headers.push(nextRow('header', request.headers, name, value)); },
      addHeader: (name, value) => { requirePermission('request:write'); if (!request.headers.some(header => header.name.toLowerCase() === String(name).toLowerCase())) request.headers.push(nextRow('header', request.headers, name, value)); },
      removeHeader: name => { requirePermission('request:write'); request.headers = request.headers.filter(header => header.name.toLowerCase() !== String(name).toLowerCase()); },
      getParameter: name => read(request.params.filter(parameter => parameter.enabled && parameter.name === String(name)).at(-1)?.value ?? null),
      getParameters: () => read(request.params.filter(parameter => parameter.enabled).map(parameter => ({ name: parameter.name, value: parameter.value }))),
      hasParameter: name => read(request.params.some(parameter => parameter.enabled && parameter.name === String(name))),
      setParameter: (name, value) => { requirePermission('request:write'); const existing = request.params.find(parameter => parameter.name === String(name)); if (existing) { existing.value = String(value); existing.enabled = true; } else request.params.push(nextRow('parameter', request.params, name, value)); },
      addParameter: (name, value) => { requirePermission('request:write'); if (!request.params.some(parameter => parameter.name === String(name))) request.params.push(nextRow('parameter', request.params, name, value)); },
      removeParameter: name => { requirePermission('request:write'); request.params = request.params.filter(parameter => parameter.name !== String(name)); },
      getEnvironmentVariable: name => read(structuredClone(${state}.environment?.[String(name)] ?? null)),
      getEnvironment: () => read(structuredClone(${state}.environment || {})),
      setAuthenticationParameter: (name, value) => { requirePermission('request:write'); const key = String(name); if (['__proto__', 'prototype', 'constructor'].includes(key)) throw new Error('Unsafe authentication property.'); request.auth[key] = value; },
      getAuthentication: () => read(structuredClone(request.auth || {})),
      setCookie: (name, value) => { requirePermission('request:write'); const cookies = Object.fromEntries(String(request.headers.find(header => header.enabled && header.name.toLowerCase() === 'cookie')?.value || '').split(';').map(part => part.trim()).filter(Boolean).map(part => { const index = part.indexOf('='); return [index < 0 ? part : part.slice(0, index), index < 0 ? '' : part.slice(index + 1)]; })); cookies[String(name)] = String(value); const serialized = Object.entries(cookies).map(([key, entry]) => key + '=' + entry).join('; '); const existing = request.headers.find(header => header.name.toLowerCase() === 'cookie'); if (existing) { existing.value = serialized; existing.enabled = true; } else request.headers.push(nextRow('header', request.headers, 'Cookie', serialized)); },
      settingSendCookies: enabled => { requirePermission('request:write'); request.transport.sendCookies = Boolean(enabled); },
      settingStoreCookies: enabled => { requirePermission('request:write'); request.transport.storeCookies = Boolean(enabled); },
      settingEncodeUrl: enabled => { requirePermission('request:write'); request.encodeUrl = Boolean(enabled); },
      settingDisableRenderRequestBody: enabled => { requirePermission('request:write'); request.renderBodyTemplates = !Boolean(enabled); },
      settingFollowRedirects: enabled => { requirePermission('request:write'); const mode = enabled === 'global' || enabled === 'on' || enabled === 'off' ? enabled : enabled ? 'on' : 'off'; request.transport.followRedirectsMode = mode; request.transport.followRedirects = mode !== 'off'; },
    });
    const responseBytes = response => response.bodyBase64 === undefined ? SafeBuffer.from(response.body) : SafeBuffer.from(response.bodyBase64, 'base64');
    const responseLines = response => Array.isArray(response.headerLines) && response.headerLines.length ? response.headerLines : Object.entries(response.headers || {}).map(([name, value]) => ({ name, value }));
    const bodyStream = bytes => {
      const listeners = { data: [], end: [] };
      const stream = {
        pipe(destination) { destination?.write?.(bytes); destination?.end?.(); return destination; },
        on(event, listener) { if (listeners[event]) listeners[event].push(listener); queueMicrotask(() => { if (event === 'data') listener(bytes); if (event === 'end') listener(); }); return stream; },
        async *[Symbol.asyncIterator]() { yield bytes; },
      };
      return stream;
    };
    const responseRead = value => { requirePermission('response:read'); return value; };
    const ${responseApi} = response => ({
      getRequestId: () => responseRead(${state}.request?.id ?? ''), getStatusCode: () => responseRead(response.status), getStatusMessage: () => responseRead(response.statusText),
      getBytesRead: () => responseRead(response.wireSizeBytes ?? response.sizeBytes), getTime: () => responseRead(response.durationMs), getBody: () => responseRead(responseBytes(response)), getBodyStream: () => responseRead(bodyStream(responseBytes(response))),
      setBody: body => { requirePermission('response:write'); const bytes = body instanceof Uint8Array ? body : SafeBuffer.from(String(body)); response.body = new TextDecoder().decode(bytes); const chunks = []; for (let offset = 0; offset < bytes.byteLength; offset += 8192) chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + 8192))); response.bodyBase64 = btoa(chunks.join('')); response.sizeBytes = bytes.byteLength; },
      getHeader: name => responseRead((() => { const values = responseLines(response).filter(header => header.name.toLowerCase() === String(name).toLowerCase()).map(header => header.value); return values.length > 1 ? values : values[0] ?? null; })()),
      getHeaders: () => responseRead(responseLines(response).map(({ name, value }) => ({ name, value }))),
      hasHeader: name => responseRead(responseLines(response).some(header => header.name.toLowerCase() === String(name).toLowerCase())),
    });
    const ${contextApi} = (request, response) => ({ app, data, store, network, util, request: request ? ${requestApi}(request) : undefined, response: response ? ${responseApi}(response) : undefined });
    const descriptor = () => ({
      templates: Array.isArray(${exportsValue}.templateTags) ? ${exportsValue}.templateTags.map(tag => ({ name: String(tag.name || ''), displayName: String(tag.displayName || tag.name || ''), description: String(tag.description || '') })).filter(tag => tag.name) : [],
      actions: [
        ...(Array.isArray(${exportsValue}.requestActions) ? ${exportsValue}.requestActions.map((action, index) => ({ id: 'request:' + index, label: String(action.label || 'Request action'), kind: 'request' })) : []),
        ...(Array.isArray(${exportsValue}.requestGroupActions) ? ${exportsValue}.requestGroupActions.map((action, index) => ({ id: 'request-group:' + index, label: String(action.label || 'Folder action'), kind: 'request-group' })) : []),
        ...(Array.isArray(${exportsValue}.workspaceActions) ? ${exportsValue}.workspaceActions.map((action, index) => ({ id: 'workspace:' + index, label: String(action.label || 'Workspace action'), kind: 'workspace' })) : []),
        ...(Array.isArray(${exportsValue}.documentActions) ? ${exportsValue}.documentActions.map((action, index) => ({ id: 'document:' + index, label: String(action.label || 'Document action'), kind: 'document' })) : []),
      ],
      themes: Array.isArray(${exportsValue}.themes) ? ${exportsValue}.themes.map((theme, index) => ({ id: 'theme:' + index, pluginId: ${input}.pluginId, name: String(theme.name || index), displayName: String(theme.displayName || theme.name || 'Plugin theme'), colors: {
        background: String(theme.theme?.background?.default || ''), foreground: String(theme.theme?.foreground?.default || ''), highlight: String(theme.theme?.highlight?.default || ''), success: String(theme.theme?.background?.success || ''), danger: String(theme.theme?.background?.danger || ''),
        ...Object.fromEntries(Object.entries(theme.theme?.styles || {}).flatMap(([target, values]) => ['background', 'foreground', 'highlight'].flatMap(kind => values?.[kind]?.default ? [[target + '-' + kind, String(values[kind].default)]] : []))),
      }, rawCss: String(theme.theme?.rawCss || '').slice(0, 100000) })) : [],
    });
    let result = { ok: true, store: ${state}.store, notifications: ${notifications} };
    if (${input}.operation.kind === 'describe') result.descriptor = descriptor();
    else if (${input}.operation.kind === 'request') {
      requirePermission('request:read'); const request = ${state}.request;
      for (const hook of Array.isArray(${exportsValue}.requestHooks) ? ${exportsValue}.requestHooks : []) await hook(${contextApi}(request));
      result.request = request;
    } else if (${input}.operation.kind === 'response') {
      requirePermission('response:read'); const response = ${state}.response;
      for (const hook of Array.isArray(${exportsValue}.responseHooks) ? ${exportsValue}.responseHooks : []) await hook(${contextApi}(${state}.request, response));
      result.response = response;
    } else if (${input}.operation.kind === 'template') {
      requirePermission('template'); const tag = (Array.isArray(${exportsValue}.templateTags) ? ${exportsValue}.templateTags : []).find(candidate => candidate.name === ${input}.operation.name);
      result.handled = Boolean(tag); if (tag) result.value = String(await tag.run(${contextApi}(${state}.request), ...(${input}.operation.args || [])) ?? '');
    } else if (${input}.operation.kind === 'action') {
      requirePermission('action'); const [kind, rawIndex] = ${input}.operation.id.split(':'); const index = Number(rawIndex);
      const actions = kind === 'request' ? ${exportsValue}.requestActions : kind === 'request-group' ? ${exportsValue}.requestGroupActions : kind === 'workspace' ? ${exportsValue}.workspaceActions : ${exportsValue}.documentActions;
      const action = Array.isArray(actions) ? actions[index] : undefined; if (!action) throw new Error('Plugin action was not found.');
      const request = ${state}.request; const originalRequest = structuredClone(request); const workspace = ${state}.workspace || {}; const target = ${input}.operation.target || {};
      const collection = (workspace.collections || []).find(candidate => candidate.id === target.collectionId || candidate.requests?.some(candidateRequest => candidateRequest.id === request?.id));
      const requestGroup = (collection?.folders || []).find(folder => folder.id === target.folderId || folder.id === request?.folderId);
      const folderIds = new Set(requestGroup ? [requestGroup.id] : []); let changed = true; while (changed) { changed = false; for (const folder of collection?.folders || []) if (folderIds.has(folder.parentId) && !folderIds.has(folder.id)) { folderIds.add(folder.id); changed = true; } }
      const folderRequests = (collection?.requests || []).filter(candidate => folderIds.has(candidate.folderId));
      const design = (workspace.apiDesigns || []).find(candidate => candidate.id === target.designId) || workspace.apiDesigns?.[0];
      let parsedContents = {}; try { parsedContents = JSON.parse(design?.contents || '{}'); } catch {}
      const models = kind === 'request' ? { requestGroup, request } : kind === 'request-group' ? { requestGroup, requests: folderRequests } : kind === 'workspace' ? { workspace: target.designId ? design : collection || workspace, requestGroups: collection?.folders || [], requests: collection?.requests || [] } : { contents: parsedContents, rawContents: design?.contents || '', format: 'openapi', formatVersion: String(parsedContents.openapi || parsedContents.swagger || '') };
      await action.action(${contextApi}(request), models); result.request = ${permissions}.has('request:write') ? request : originalRequest;
    }
    ${post}(result);
  } catch (error) {
    ${post}({ ok: false, error: error instanceof Error ? error.message : String(error), store: ${state}.store || {}, notifications: ${notifications} });
  }
};
`;
};

const executePlugin = async (
  plugin: PluginRecord,
  operation: PluginOperation,
  store: Record<string, string>,
  callbacks: PluginHostCallbacks = {},
  timeoutMs = 2000,
): Promise<PluginWorkerResult> => {
  const osInfo = await (callbacks.osInfo ? callbacks.osInfo() : templateOsInfo());
  const source = buildPluginWorkerSource(plugin.source, safeIdentifier(), plugin.moduleFiles, plugin.entryModuleKey, plugin.grantedModules ?? [], plugin.dependencyModuleFiles, plugin.dependencyPackages);
  const blob = new Blob([source], { type: 'text/javascript' });
  const workerUrl = URL.createObjectURL(blob);
  const worker = new Worker(workerUrl);
  try {
    return await new Promise<PluginWorkerResult>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error(`Plugin '${plugin.name}' exceeded the ${timeoutMs} ms execution limit.`)), timeoutMs);
      worker.onerror = (event) => { window.clearTimeout(timeout); reject(new Error(event.message || `Plugin '${plugin.name}' failed.`)); };
      worker.onmessage = (event: MessageEvent<PluginWorkerResult | { kind: 'rpc'; id: string; type: string; payload: Record<string, unknown> }>) => {
        const data = event.data;
        if ('kind' in data && data.kind === 'rpc') {
          void (async () => {
            try {
              let value: unknown;
              if (data.type === 'network') {
                if (!callbacks.network) throw new Error('The host did not provide plugin network access.');
                value = await callbacks.network(normalizePluginNetworkRequest(data.payload.request));
              } else if (data.type === 'prompt') {
                if (!callbacks.prompt) throw new Error('The host did not provide plugin prompt access.');
                value = await callbacks.prompt(String(data.payload.title ?? ''), String(data.payload.defaultValue ?? ''));
              } else if (data.type === 'dialog') {
                if (!callbacks.dialog) throw new Error('The host did not provide plugin dialog access.');
                value = await callbacks.dialog(String(data.payload.title ?? ''), String(data.payload.message ?? ''));
              } else if (data.type === 'clipboard-read') {
                if (!callbacks.readClipboard) throw new Error('The host did not provide clipboard access.');
                value = await callbacks.readClipboard();
              } else if (data.type === 'clipboard-write') {
                if (!callbacks.writeClipboard) throw new Error('The host did not provide clipboard access.');
                value = await callbacks.writeClipboard(String(data.payload.value ?? ''));
              } else if (data.type === 'clipboard-clear') {
                if (!callbacks.clearClipboard) throw new Error('The host did not provide clipboard access.');
                value = await callbacks.clearClipboard();
              } else if (data.type === 'path') {
                if (!callbacks.getPath) throw new Error('The host did not provide plugin path access.');
                value = await callbacks.getPath(String(data.payload.name ?? ''));
              } else if (data.type === 'save-dialog') {
                if (!callbacks.showSaveDialog) throw new Error('The host did not provide plugin save-dialog access.');
                value = await callbacks.showSaveDialog(String(data.payload.defaultPath ?? ''));
              } else if (data.type === 'data-import') {
                if (!callbacks.importData) throw new Error('The host did not provide plugin import access.');
                value = await callbacks.importData(data.payload.source === 'uri' ? 'uri' : 'raw', String(data.payload.value ?? ''));
              } else if (data.type === 'data-export') {
                if (!callbacks.exportData) throw new Error('The host did not provide plugin export access.');
                value = await callbacks.exportData(data.payload.format === 'har' ? 'har' : 'insomnia', data.payload.options && typeof data.payload.options === 'object' ? data.payload.options as Record<string, unknown> : {});
              } else throw new Error(`Unknown plugin host call '${data.type}'.`);
              worker.postMessage({ __pluginRpcResponse: true, id: data.id, ok: true, value });
            } catch (caught) {
              worker.postMessage({ __pluginRpcResponse: true, id: data.id, ok: false, error: caught instanceof Error ? caught.message : String(caught) });
            }
          })();
          return;
        }
        window.clearTimeout(timeout);
        resolve(data as PluginWorkerResult);
      };
      worker.postMessage({ pluginId: plugin.id, permissions: plugin.grantedPermissions, operation, state: { request: 'request' in operation ? structuredClone(operation.request) : undefined, response: 'response' in operation ? structuredClone(operation.response) : undefined, workspace: 'workspace' in operation ? structuredClone(operation.workspace) : undefined, environment: structuredClone(callbacks.environment ?? {}), platform: navigator.platform, osInfo: structuredClone(osInfo), store: { ...store } } });
    }).then((result) => {
      if (!result.ok) throw new Error(result.error || `Plugin '${plugin.name}' failed.`);
      return result;
    });
  } finally {
    worker.terminate();
    URL.revokeObjectURL(workerUrl);
  }
};

export const describePlugin = async (plugin: PluginRecord) => (await executePlugin(plugin, { kind: 'describe' }, {})).descriptor ?? { templates: [], actions: [], themes: [] };

export type PluginRunState = {
  data: Record<string, Record<string, string>>;
  notifications: PluginNotification[];
};

const activePlugins = (plugins: PluginRecord[]) => plugins.filter((plugin) => plugin.enabled && !plugin.error);

export const runPluginRequestHooks = async (plugins: PluginRecord[], request: ApiRequest, state: PluginRunState, callbacks: PluginHostCallbacks = {}) => {
  let current = structuredClone(request);
  for (const plugin of activePlugins(plugins).filter((candidate) => candidate.grantedPermissions.includes('request:read'))) {
    const output = await executePlugin(plugin, { kind: 'request', request: current }, state.data[plugin.id] ?? {}, callbacks);
    current = output.request ?? current;
    state.data[plugin.id] = output.store;
    state.notifications.push(...output.notifications);
  }
  return current;
};

export const runPluginResponseHooks = async (plugins: PluginRecord[], request: ApiRequest, response: HttpResponse, state: PluginRunState, callbacks: PluginHostCallbacks = {}) => {
  let current = structuredClone(response);
  for (const plugin of activePlugins(plugins).filter((candidate) => candidate.grantedPermissions.includes('response:read'))) {
    const output = await executePlugin(plugin, { kind: 'response', request, response: current }, state.data[plugin.id] ?? {}, callbacks);
    current = output.response ?? current;
    state.data[plugin.id] = output.store;
    state.notifications.push(...output.notifications);
  }
  return current;
};

export const runPluginTemplateTag = async (plugins: PluginRecord[], name: string, args: string[], request: ApiRequest, state: PluginRunState, callbacks: PluginHostCallbacks = {}) => {
  for (const plugin of activePlugins(plugins).filter((candidate) => candidate.grantedPermissions.includes('template'))) {
    const output = await executePlugin(plugin, { kind: 'template', name, args, request }, state.data[plugin.id] ?? {}, callbacks);
    state.data[plugin.id] = output.store;
    state.notifications.push(...output.notifications);
    if (output.handled) return output.value ?? '';
  }
  return undefined;
};

export const runPluginAction = async (plugin: PluginRecord, descriptor: PluginActionDescriptor, request: ApiRequest, workspace: Workspace, store: Record<string, string>, callbacks: PluginHostCallbacks = {}, target?: PluginActionTarget) => executePlugin(plugin, { kind: 'action', id: descriptor.id, actionKind: descriptor.kind, request, workspace, target }, store, callbacks);

export const pluginActionAuthorityKey = (plugin: PluginRecord) => JSON.stringify({
  source: plugin.source,
  moduleFiles: plugin.moduleFiles,
  entryModuleKey: plugin.entryModuleKey,
  dependencyModuleFiles: plugin.dependencyModuleFiles,
  dependencyPackages: plugin.dependencyPackages,
  enabled: plugin.enabled,
  error: plugin.error,
  grantedModules: plugin.grantedModules,
  grantedPermissions: plugin.grantedPermissions,
});

export const discoverContextualPluginActions = async (
  plugins: PluginRecord[],
  describe: (plugin: PluginRecord) => Promise<PluginDescriptor> = describePlugin,
): Promise<ContextualPluginActionDiscovery> => {
  const candidates = plugins.filter((plugin) => plugin.enabled && !plugin.error && plugin.grantedPermissions.includes('action'));
  const discovered = await Promise.all(candidates.map(async (plugin) => {
    try {
      const descriptor = await describe(plugin);
      const authorityKey = pluginActionAuthorityKey(plugin);
      const actions = descriptor.actions.flatMap((action): ContextualPluginAction[] => {
        if (action.kind === 'workspace') return [];
        return [{ key: `${plugin.id}:${action.id}`, pluginId: plugin.id, pluginName: plugin.name, descriptor: action as PluginActionDescriptor & { kind: ContextualPluginActionKind }, authorityKey }];
      });
      return { actions, error: undefined };
    } catch (caught) {
      return {
        actions: [],
        error: { pluginId: plugin.id, pluginName: plugin.name, message: caught instanceof Error ? caught.message : String(caught) },
      };
    }
  }));
  return {
    actions: discovered.flatMap((result) => result.actions),
    errors: discovered.flatMap((result) => result.error ? [result.error] : []),
  };
};

export const contextualPluginActionsFor = (actions: ContextualPluginAction[], kind: ContextualPluginActionKind) => actions.filter((action) => action.descriptor.kind === kind);

export const resolveContextualPluginActionInvocation = (
  workspace: Workspace,
  action: ContextualPluginAction,
  requestedTarget: PluginActionTarget,
): { request: ApiRequest; target: PluginActionTarget } => {
  if (!action.descriptor.id.startsWith(`${action.descriptor.kind}:`)) throw new Error('Plugin action identity does not match its placement.');
  if (action.descriptor.kind === 'request') {
    if (!requestedTarget.requestId) throw new Error('Request actions require a request target.');
    const collection = workspace.collections.find((candidate) => candidate.requests.some((request) => request.id === requestedTarget.requestId));
    const request = collection?.requests.find((candidate) => candidate.id === requestedTarget.requestId);
    if (!collection || !request || (requestedTarget.collectionId && requestedTarget.collectionId !== collection.id)) throw new Error('The request action target is no longer available.');
    return { request, target: { requestId: request.id, collectionId: collection.id, folderId: request.folderId || undefined } };
  }
  if (action.descriptor.kind === 'request-group') {
    if (!requestedTarget.collectionId || !requestedTarget.folderId) throw new Error('Folder actions require a collection and folder target.');
    const collection = workspace.collections.find((candidate) => candidate.id === requestedTarget.collectionId);
    const folder = collection?.folders?.find((candidate) => candidate.id === requestedTarget.folderId);
    if (!collection || !folder) throw new Error('The folder action target is no longer available.');
    const request = collection.requests.find((candidate) => candidate.folderId === folder.id)
      ?? collection.requests[0]
      ?? { ...createBlankRequest(`plugin-folder-${folder.id}`), folderId: folder.id };
    return { request, target: { collectionId: collection.id, folderId: folder.id } };
  }
  if (!requestedTarget.designId || !workspace.apiDesigns.some((design) => design.id === requestedTarget.designId)) throw new Error('The document action target is no longer available.');
  const request = workspace.collections.flatMap((collection) => collection.requests).find((candidate) => candidate.id === workspace.activeRequestId)
    ?? workspace.collections.flatMap((collection) => collection.requests)[0]
    ?? createBlankRequest(`plugin-document-${requestedTarget.designId}`);
  return { request, target: { designId: requestedTarget.designId } };
};

export const applyContextualPluginActionResult = (
  workspace: Workspace,
  action: ContextualPluginAction,
  output: PluginActionResult,
): Workspace => {
  const plugin = workspace.plugins.find((candidate) => candidate.id === action.pluginId);
  if (!plugin || !plugin.enabled || plugin.error || !plugin.grantedPermissions.includes('action') || pluginActionAuthorityKey(plugin) !== action.authorityKey) return workspace;
  return {
    ...workspace,
    collections: output.request ? workspace.collections.map((collection) => ({
      ...collection,
      requests: collection.requests.map((request) => request.id === output.request?.id ? output.request : request),
    })) : workspace.collections,
    pluginData: { ...workspace.pluginData, [plugin.id]: { ...output.store } },
  };
};

export const createPluginRuntime = (plugins: PluginRecord[], state: PluginRunState, callbacks: PluginHostCallbacks = {}) => ({
  beforeRequest: (request: ApiRequest) => runPluginRequestHooks(plugins, request, state, callbacks),
  afterResponse: (request: ApiRequest, response: HttpResponse) => runPluginResponseHooks(plugins, request, response, state, callbacks),
  templateTag: (name: string, args: string[], request: ApiRequest) => runPluginTemplateTag(plugins, name, args, request, state, callbacks),
});

const colorValue = (value: string) => value && typeof CSS !== 'undefined' && CSS.supports('color', value) ? value : '';
const safeThemeCss = (value: string) => /@import|url\s*\(|expression\s*\(|javascript\s*:|behavior\s*:/i.test(value) ? '' : value.slice(0, 100_000);
export const applyPluginTheme = (theme?: PluginThemeDescriptor) => {
  const root = document.documentElement;
  const mappings: Array<[string, string]> = [['--bg', theme?.colors.background ?? ''], ['--text', theme?.colors.foreground ?? ''], ['--accent', theme?.colors.highlight ?? ''], ['--mint', theme?.colors.success ?? ''], ['--red', theme?.colors.danger ?? '']];
  mappings.forEach(([property, value]) => {
    const safe = colorValue(value);
    if (safe) root.style.setProperty(property, safe); else root.style.removeProperty(property);
  });
  const styleId = 'brunomnia-plugin-theme-css';
  document.getElementById(styleId)?.remove();
  const css = safeThemeCss(theme?.rawCss ?? '');
  if (css) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = css;
    document.head.append(style);
  }
};

export const pluginStarterSource = `module.exports.requestHooks = [context => {
  if (!context.request.hasHeader('X-Brunomnia-Plugin')) {
    context.request.setHeader('X-Brunomnia-Plugin', 'enabled');
  }
}];

module.exports.templateTags = [{
  name: 'plugin_value',
  displayName: 'Plugin value',
  description: 'Returns a locally stored plugin value',
  async run(context, fallback = 'hello') {
    return (await context.store.getItem('value')) || fallback;
  },
}];

module.exports.requestActions = [{
  label: 'Store request name',
  async action(context, { request }) {
    await context.store.setItem('value', request.name);
    await context.app.alert('Plugin action', 'Stored the active request name.');
  },
}];
`;
