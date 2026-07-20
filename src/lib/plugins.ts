import type { ApiRequest, HttpResponse, PluginPermission, PluginRecord, Workspace } from '../types';

export type PluginTemplateDescriptor = { name: string; displayName: string; description: string };
export type PluginActionDescriptor = { id: string; label: string; kind: 'request' | 'workspace' | 'document' };
export type PluginThemeDescriptor = { id: string; pluginId: string; name: string; displayName: string; colors: Record<string, string> };
export type PluginDescriptor = { templates: PluginTemplateDescriptor[]; actions: PluginActionDescriptor[]; themes: PluginThemeDescriptor[] };
export type PluginNotification = { type: 'log' | 'alert'; title: string; message: string };

export type PluginHostCallbacks = {
  network?: (request: ApiRequest) => Promise<HttpResponse>;
  prompt?: (title: string, defaultValue: string) => Promise<string>;
  readClipboard?: () => Promise<string>;
  writeClipboard?: (value: string) => Promise<void>;
};

type PluginOperation =
  | { kind: 'describe' }
  | { kind: 'request'; request: ApiRequest }
  | { kind: 'response'; request: ApiRequest; response: HttpResponse }
  | { kind: 'template'; name: string; args: string[]; request: ApiRequest }
  | { kind: 'action'; id: string; actionKind: PluginActionDescriptor['kind']; request: ApiRequest; workspace?: Workspace };

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

const permissionList: PluginPermission[] = ['request:read', 'request:write', 'response:read', 'response:write', 'store', 'network', 'app:prompt', 'app:clipboard', 'template', 'action', 'theme'];
export const pluginPermissions = [...permissionList];
export const pluginPermissionLabels: Record<PluginPermission, string> = {
  'request:read': 'Read requests', 'request:write': 'Modify requests', 'response:read': 'Read responses', 'response:write': 'Modify responses', store: 'Plugin-local storage', network: 'Send network requests', 'app:prompt': 'Show prompts', 'app:clipboard': 'Read/write clipboard', template: 'Custom template tags', action: 'Request/workspace actions', theme: 'Theme colors',
};

export const inferPluginPermissions = (source: string): PluginPermission[] => {
  const permissions = new Set<PluginPermission>();
  if (/\brequestHooks\b/.test(source)) { permissions.add('request:read'); permissions.add('request:write'); }
  if (/\bresponseHooks\b/.test(source)) { permissions.add('response:read'); permissions.add('response:write'); }
  if (/\btemplateTags\b/.test(source)) permissions.add('template');
  if (/\b(?:request|workspace|document)Actions\b/.test(source)) permissions.add('action');
  if (/\bthemes\b/.test(source)) permissions.add('theme');
  if (/\bcontext\.store\b|\bstore\.(?:get|set|remove|clear|all|has)Item\b/.test(source)) permissions.add('store');
  if (/\bcontext\.network\b|\bnetwork\.sendRequest\b/.test(source)) permissions.add('network');
  if (/\bcontext\.app\.prompt\b|\bapp\.prompt\b/.test(source)) permissions.add('app:prompt');
  if (/\bcontext\.app\.clipboard\b|\bapp\.clipboard\b/.test(source)) permissions.add('app:clipboard');
  return permissionList.filter((permission) => permissions.has(permission));
};

export const validatePluginSource = (source: string) => {
  if (!source.trim()) throw new Error('Plugin source is empty.');
  if (source.length > 1_000_000) throw new Error('Plugin source exceeds the 1 MB local limit.');
  if (/\bimport\s*(?:\/\*[\s\S]*?\*\/\s*)?\(/.test(source) || /(^|[;\n])\s*import\s/m.test(source)) throw new Error('ES module imports are not available in the isolated plugin runtime.');
  if (/(^|[;\n])\s*export\s/m.test(source)) throw new Error('ES module exports are not available in the isolated plugin runtime.');
};

const safeIdentifier = () => `__br_${crypto.randomUUID().replace(/-/g, '')}`;

export const buildPluginWorkerSource = (source: string, nonce = safeIdentifier()) => {
  validatePluginSource(source);
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
  return `
const ${host} = self;
const ${post} = ${host}.postMessage.bind(${host});
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
      return new SafeBuffer(new TextEncoder().encode(typeof value === 'string' ? value : JSON.stringify(value)));
    }
    toString(encoding = 'utf8') { return encoding === 'base64' ? btoa(String.fromCharCode(...this)) : new TextDecoder().decode(this); }
  }
  const safeConsole = {
    log: (...values) => ${notifications}.push({ type: 'log', title: 'Plugin log', message: values.map(String).join(' ') }),
    info: (...values) => ${notifications}.push({ type: 'log', title: 'Plugin info', message: values.map(String).join(' ') }),
    warn: (...values) => ${notifications}.push({ type: 'log', title: 'Plugin warning', message: values.map(String).join(' ') }),
    error: (...values) => ${notifications}.push({ type: 'log', title: 'Plugin error', message: values.map(String).join(' ') }),
  };
  const safeRequire = name => {
    if (name === 'buffer') return { Buffer: SafeBuffer };
    throw new Error("Module '" + name + "' is not available in the isolated plugin runtime.");
  };
  const module = { exports: {} }; let exports = module.exports;
  try {
    await (async (module, exports, require, Buffer, console, crypto, TextEncoder, TextDecoder, URL, setTimeout, clearTimeout, globalThis, self, window, document, navigator, fetch, XMLHttpRequest, WebSocket, EventSource, Worker, importScripts, indexedDB, caches, postMessage, Function, WebAssembly) => {
      'use strict';
${source}
    })(module, exports, safeRequire, SafeBuffer, safeConsole, crypto, TextEncoder, TextDecoder, URL, setTimeout, clearTimeout, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined);
    const ${exportsValue} = module.exports || {};
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
      prompt: async (title, options = {}) => { requirePermission('app:prompt'); return ${rpc}('prompt', { title: String(title), defaultValue: String(options.defaultValue ?? '') }); },
      clipboard: {
        readText: async () => { requirePermission('app:clipboard'); return ${rpc}('clipboard-read', {}); },
        writeText: async value => { requirePermission('app:clipboard'); return ${rpc}('clipboard-write', { value: String(value) }); },
      },
      getInfo: () => ({ name: 'Brunomnia', version: '0.1.0' }),
    };
    const network = { sendRequest: async request => { requirePermission('network'); return ${rpc}('network', { request }); } };
    const ${requestApi} = request => ({
      getId: () => request.id, getName: () => request.name, setName: value => { requirePermission('request:write'); request.name = String(value); },
      getUrl: () => request.url, setUrl: value => { requirePermission('request:write'); request.url = String(value); },
      getMethod: () => request.method, setMethod: value => { requirePermission('request:write'); request.method = String(value).toUpperCase(); },
      getBody: () => request.body, setBody: value => { requirePermission('request:write'); request.body = typeof value === 'string' ? value : String(value?.toString?.() ?? value); },
      getHeader: name => request.headers.find(header => header.enabled && header.name.toLowerCase() === String(name).toLowerCase())?.value ?? null,
      getHeaders: () => request.headers.filter(header => header.enabled).map(header => ({ name: header.name, value: header.value })),
      hasHeader: name => request.headers.some(header => header.enabled && header.name.toLowerCase() === String(name).toLowerCase()),
      setHeader: (name, value) => { requirePermission('request:write'); const existing = request.headers.find(header => header.name.toLowerCase() === String(name).toLowerCase()); if (existing) { existing.value = String(value); existing.enabled = true; } else request.headers.push({ id: 'plugin-' + Date.now() + '-' + request.headers.length, name: String(name), value: String(value), enabled: true }); },
      removeHeader: name => { requirePermission('request:write'); request.headers = request.headers.filter(header => header.name.toLowerCase() !== String(name).toLowerCase()); },
    });
    const ${responseApi} = response => ({
      getRequestId: () => ${state}.request?.id ?? '', getStatusCode: () => response.status, getStatusMessage: () => response.statusText,
      getBytesRead: () => response.wireSizeBytes ?? response.sizeBytes, getTime: () => response.durationMs, getBody: () => response.bodyBase64 === undefined ? SafeBuffer.from(response.body) : SafeBuffer.from(response.bodyBase64, 'base64'),
      setBody: body => { requirePermission('response:write'); if (body instanceof Uint8Array) { response.body = new TextDecoder().decode(body); const chunks = []; for (let offset = 0; offset < body.byteLength; offset += 8192) chunks.push(String.fromCharCode(...body.subarray(offset, offset + 8192))); response.bodyBase64 = btoa(chunks.join('')); response.sizeBytes = body.byteLength; } else { response.body = String(body); delete response.bodyBase64; response.sizeBytes = new TextEncoder().encode(response.body).length; } },
      getHeader: name => Object.entries(response.headers).find(([key]) => key.toLowerCase() === String(name).toLowerCase())?.[1] ?? null,
      getHeaders: () => Object.entries(response.headers).map(([name, value]) => ({ name, value })),
      hasHeader: name => Object.keys(response.headers).some(key => key.toLowerCase() === String(name).toLowerCase()),
    });
    const ${contextApi} = (request, response) => ({ app, store, network, request: request ? ${requestApi}(request) : undefined, response: response ? ${responseApi}(response) : undefined });
    const descriptor = () => ({
      templates: Array.isArray(${exportsValue}.templateTags) ? ${exportsValue}.templateTags.map(tag => ({ name: String(tag.name || ''), displayName: String(tag.displayName || tag.name || ''), description: String(tag.description || '') })).filter(tag => tag.name) : [],
      actions: [
        ...(Array.isArray(${exportsValue}.requestActions) ? ${exportsValue}.requestActions.map((action, index) => ({ id: 'request:' + index, label: String(action.label || 'Request action'), kind: 'request' })) : []),
        ...(Array.isArray(${exportsValue}.workspaceActions) ? ${exportsValue}.workspaceActions.map((action, index) => ({ id: 'workspace:' + index, label: String(action.label || 'Workspace action'), kind: 'workspace' })) : []),
        ...(Array.isArray(${exportsValue}.documentActions) ? ${exportsValue}.documentActions.map((action, index) => ({ id: 'document:' + index, label: String(action.label || 'Document action'), kind: 'document' })) : []),
      ],
      themes: Array.isArray(${exportsValue}.themes) ? ${exportsValue}.themes.map((theme, index) => ({ id: 'theme:' + index, pluginId: ${input}.pluginId, name: String(theme.name || index), displayName: String(theme.displayName || theme.name || 'Plugin theme'), colors: {
        background: String(theme.theme?.background?.default || ''), foreground: String(theme.theme?.foreground?.default || ''), highlight: String(theme.theme?.highlight?.default || ''), success: String(theme.theme?.background?.success || ''), danger: String(theme.theme?.background?.danger || ''),
      } })) : [],
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
      const actions = kind === 'request' ? ${exportsValue}.requestActions : kind === 'workspace' ? ${exportsValue}.workspaceActions : ${exportsValue}.documentActions;
      const action = Array.isArray(actions) ? actions[index] : undefined; if (!action) throw new Error('Plugin action was not found.');
      const request = ${state}.request; const originalRequest = structuredClone(request); await action.action(${contextApi}(request), kind === 'request' ? { request } : kind === 'workspace' ? { workspace: ${state}.workspace, requests: ${state}.workspace?.collections?.flatMap(collection => collection.requests) || [] } : ${state}.workspace?.apiDesigns?.[0]); result.request = ${permissions}.has('request:write') ? request : originalRequest;
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
  const source = buildPluginWorkerSource(plugin.source);
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
                value = await callbacks.network(data.payload.request as ApiRequest);
              } else if (data.type === 'prompt') {
                if (!callbacks.prompt) throw new Error('The host did not provide plugin prompt access.');
                value = await callbacks.prompt(String(data.payload.title ?? ''), String(data.payload.defaultValue ?? ''));
              } else if (data.type === 'clipboard-read') {
                if (!callbacks.readClipboard) throw new Error('The host did not provide clipboard access.');
                value = await callbacks.readClipboard();
              } else if (data.type === 'clipboard-write') {
                if (!callbacks.writeClipboard) throw new Error('The host did not provide clipboard access.');
                value = await callbacks.writeClipboard(String(data.payload.value ?? ''));
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
      worker.postMessage({ pluginId: plugin.id, permissions: plugin.grantedPermissions, operation, state: { request: 'request' in operation ? structuredClone(operation.request) : undefined, response: 'response' in operation ? structuredClone(operation.response) : undefined, workspace: 'workspace' in operation ? structuredClone(operation.workspace) : undefined, store: { ...store } } });
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

export const runPluginAction = async (plugin: PluginRecord, descriptor: PluginActionDescriptor, request: ApiRequest, workspace: Workspace, store: Record<string, string>, callbacks: PluginHostCallbacks = {}) => executePlugin(plugin, { kind: 'action', id: descriptor.id, actionKind: descriptor.kind, request, workspace }, store, callbacks);

export const createPluginRuntime = (plugins: PluginRecord[], state: PluginRunState, callbacks: PluginHostCallbacks = {}) => ({
  beforeRequest: (request: ApiRequest) => runPluginRequestHooks(plugins, request, state, callbacks),
  afterResponse: (request: ApiRequest, response: HttpResponse) => runPluginResponseHooks(plugins, request, response, state, callbacks),
  templateTag: (name: string, args: string[], request: ApiRequest) => runPluginTemplateTag(plugins, name, args, request, state, callbacks),
});

const colorValue = (value: string) => value && typeof CSS !== 'undefined' && CSS.supports('color', value) ? value : '';
export const applyPluginTheme = (theme?: PluginThemeDescriptor) => {
  const root = document.documentElement;
  const mappings: Array<[string, string]> = [['--bg', theme?.colors.background ?? ''], ['--text', theme?.colors.foreground ?? ''], ['--accent', theme?.colors.highlight ?? ''], ['--mint', theme?.colors.success ?? ''], ['--red', theme?.colors.danger ?? '']];
  mappings.forEach(([property, value]) => {
    const safe = colorValue(value);
    if (safe) root.style.setProperty(property, safe); else root.style.removeProperty(property);
  });
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
