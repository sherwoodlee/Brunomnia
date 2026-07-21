import { Worker } from 'node:worker_threads';
import { buildPluginWorkerSource, type PluginActionDescriptor, type PluginActionTarget, type PluginNotification } from '../src/lib/plugins';
import type { ApiRequest, HttpResponse, PluginRecord, Workspace } from '../src/types';

type CliPluginOperation =
  | { kind: 'request'; request: ApiRequest }
  | { kind: 'response'; request: ApiRequest; response: HttpResponse }
  | { kind: 'template'; name: string; args: string[]; request: ApiRequest }
  | { kind: 'action'; id: string; actionKind: PluginActionDescriptor['kind']; request: ApiRequest; workspace: Workspace; target?: PluginActionTarget };

type CliPluginWorkerResult = {
  ok: boolean;
  error?: string;
  value?: string;
  handled?: boolean;
  request?: ApiRequest;
  response?: HttpResponse;
  store: Record<string, string>;
  notifications: PluginNotification[];
};

type CliPluginWorkerRpc = {
  kind: 'rpc';
  id: string;
  type: string;
};

const boundedStore = (value: Record<string, string>) => {
  const entries = Object.entries(value);
  if (entries.length > 256) throw new Error('CLI plugin store exceeds 256 entries.');
  let totalBytes = 0;
  const store = Object.fromEntries(entries.map(([key, entryValue]) => {
    if (!key || key.length > 500) throw new Error('CLI plugin store keys must contain 1–500 characters.');
    const normalizedValue = String(entryValue);
    totalBytes += Buffer.byteLength(key) + Buffer.byteLength(normalizedValue);
    return [key, normalizedValue];
  }));
  if (totalBytes > 1_000_000) throw new Error('CLI plugin store exceeds the 1 MB limit.');
  return store;
};

const executeCliPluginOperation = async (
  plugin: PluginRecord,
  operation: CliPluginOperation,
  store: Record<string, string>,
  environment: Record<string, string>,
  timeoutMs = 2_000,
): Promise<CliPluginWorkerResult> => {
  const bootstrap = `
import { parentPort } from 'node:worker_threads';
globalThis.self = globalThis;
globalThis.postMessage = value => parentPort.postMessage(value);
Object.defineProperty(globalThis, 'process', { value: undefined, writable: false, configurable: false });
Object.defineProperty(globalThis, 'global', { value: undefined, writable: false, configurable: false });
parentPort.on('message', data => globalThis.onmessage?.({ data }));
${buildPluginWorkerSource(plugin.source, undefined, plugin.moduleFiles, plugin.entryModuleKey)}
`;
  const workerUrl = new URL(`data:text/javascript;base64,${Buffer.from(bootstrap).toString('base64')}`);
  const worker = new Worker(workerUrl, {
    resourceLimits: { maxOldGenerationSizeMb: 16, maxYoungGenerationSizeMb: 4, stackSizeMb: 2 },
  });
  try {
    const result = await new Promise<CliPluginWorkerResult>((resolveWorker, rejectWorker) => {
      let settled = false;
      const finish = (callback: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        callback();
      };
      const timeout = setTimeout(() => finish(() => rejectWorker(new Error(`Plugin '${plugin.name}' exceeded the ${timeoutMs} ms CLI execution limit.`))), timeoutMs);
      worker.on('error', error => finish(() => rejectWorker(error)));
      worker.on('message', (message: CliPluginWorkerResult | CliPluginWorkerRpc) => {
        if ('kind' in message && message.kind === 'rpc') {
          worker.postMessage({
            __pluginRpcResponse: true,
            id: message.id,
            ok: false,
            error: `CLI plugins cannot use host capability '${message.type}'.`,
          });
          return;
        }
        finish(() => resolveWorker(message as CliPluginWorkerResult));
      });
      worker.postMessage({
        pluginId: plugin.id,
        permissions: plugin.grantedPermissions,
        operation,
        state: {
          request: structuredClone(operation.request),
          response: operation.kind === 'response' ? structuredClone(operation.response) : undefined,
          workspace: operation.kind === 'action' ? structuredClone(operation.workspace) : undefined,
          environment: structuredClone(environment),
          platform: process.platform,
          store: boundedStore(store),
        },
      });
    });
    if (!result.ok) throw new Error(result.error || `Plugin '${plugin.name}' failed.`);
    if ((result.value ?? '').length > 1_000_000) throw new Error(`Plugin '${plugin.name}' returned more than 1 MB.`);
    return {
      ...result,
      store: boundedStore(result.store ?? {}),
      notifications: (result.notifications ?? []).slice(0, 100).map(notification => ({
        type: notification.type,
        title: String(notification.title).slice(0, 500),
        message: String(notification.message).slice(0, 10_000),
      })),
    };
  } finally {
    await worker.terminate().catch(() => undefined);
  }
};

export const createCliPluginRuntime = (
  plugins: PluginRecord[],
  initialData: Record<string, Record<string, string>>,
) => {
  const activePlugins = plugins
    .filter(plugin => plugin.enabled && !plugin.error)
    .slice(0, 50);
  const data = Object.fromEntries(activePlugins.map(plugin => [plugin.id, boundedStore(initialData[plugin.id] ?? {})]));
  const notifications: Array<PluginNotification & { plugin: string }> = [];
  const execute = async (plugin: PluginRecord, operation: CliPluginOperation, environment: Record<string, string>) => {
    const output = await executeCliPluginOperation(plugin, operation, data[plugin.id] ?? {}, environment);
    data[plugin.id] = output.store;
    notifications.push(...output.notifications.map(notification => ({ ...notification, plugin: plugin.name })));
    return output;
  };
  return {
    beforeRequest: async (request: ApiRequest, environment: Record<string, string>) => {
      let current = structuredClone(request);
      for (const plugin of activePlugins.filter(candidate => candidate.grantedPermissions.includes('request:read'))) {
        current = (await execute(plugin, { kind: 'request', request: current }, environment)).request ?? current;
      }
      return current;
    },
    afterResponse: async (request: ApiRequest, response: HttpResponse, environment: Record<string, string>) => {
      let current = structuredClone(response);
      for (const plugin of activePlugins.filter(candidate => candidate.grantedPermissions.includes('response:read'))) {
        current = (await execute(plugin, { kind: 'response', request, response: current }, environment)).response ?? current;
      }
      return current;
    },
    render: async (name: string, args: string[], request: ApiRequest, environment: Record<string, string> = {}) => {
      for (const plugin of activePlugins.filter(candidate => candidate.grantedPermissions.includes('template'))) {
        const output = await execute(plugin, { kind: 'template', name, args, request }, environment);
        if (output.handled) return output.value ?? '';
      }
      return undefined;
    },
    runAction: async (pluginId: string, descriptor: PluginActionDescriptor, request: ApiRequest, workspace: Workspace, target: PluginActionTarget = {}, environment: Record<string, string> = {}) => {
      const plugin = activePlugins.find(candidate => candidate.id === pluginId && candidate.grantedPermissions.includes('action'));
      if (!plugin) throw new Error('The enabled and granted CLI plugin was not found.');
      return (await execute(plugin, { kind: 'action', id: descriptor.id, actionKind: descriptor.kind, request, workspace, target }, environment)).request ?? request;
    },
    notifications,
  };
};

export const createCliPluginTemplateRuntime = createCliPluginRuntime;
