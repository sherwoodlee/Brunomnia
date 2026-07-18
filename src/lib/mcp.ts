import { invoke, isTauri } from '@tauri-apps/api/core';
import type { Environment, JsonValue, McpClient, McpPrompt, McpResource, McpTool } from '../types';
import { createBlankRequest } from '../data/seed';
import { sendRequest, type SendRequestContext } from './http';
import { isProtectedSecretReference, isSensitiveSecretName } from './security';

type McpEvent = { direction: 'client' | 'server' | 'stderr'; method: string; detail: string; timestamp: string };
type McpOperationResult = { result: unknown; events: McpEvent[]; sessionId?: string };
type StdioOutput = { result: unknown; events: unknown[]; stderr: string };

const now = () => new Date().toISOString();
const requestId = () => `mcp-${Date.now().toString(36)}-${crypto.randomUUID()}`;
const asRecord = (value: unknown) => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
const asString = (value: unknown) => typeof value === 'string' ? value : '';

const validateHttpEndpoint = (value: string) => {
  const url = new URL(value);
  if (url.username || url.password) throw new Error('MCP endpoint URLs cannot contain credentials. Use the Auth fields or vault-backed headers.');
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('MCP HTTP endpoints must use http or https.');
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '::1';
  if (url.protocol !== 'https:' && !local) throw new Error('Remote MCP endpoints must use HTTPS; plain HTTP is limited to loopback servers.');
  return url.toString();
};

const assertProtectedCredentials = (client: McpClient) => {
  if (client.authType === 'bearer' && (!client.token.trim() || !isProtectedSecretReference(client.token))) {
    throw new Error('MCP bearer tokens must be a complete local-vault or approved external-vault reference.');
  }
  if (client.authType === 'basic' && (!client.password.trim() || !isProtectedSecretReference(client.password))) {
    throw new Error('MCP Basic passwords must be a complete local-vault or approved external-vault reference.');
  }
  const unsafeHeader = client.headers.find((header) => header.enabled && header.value.trim() && isSensitiveSecretName(header.name) && !isProtectedSecretReference(header.value));
  if (unsafeHeader) throw new Error(`MCP sensitive header '${unsafeHeader.name}' must use a complete local-vault or approved external-vault reference.`);
};

const responseMessages = (body: string): unknown[] => {
  const source = body.trim();
  if (!source) return [];
  if (source.startsWith('{') || source.startsWith('[')) {
    const parsed: unknown = JSON.parse(source);
    return Array.isArray(parsed) ? parsed : [parsed];
  }
  const messages: unknown[] = [];
  let data: string[] = [];
  const flush = () => {
    const value = data.join('\n').trim();
    data = [];
    if (value && value !== '[DONE]') messages.push(JSON.parse(value));
  };
  source.split(/\r?\n/).forEach((line) => {
    if (!line.trim()) flush();
    else if (line.startsWith('data:')) data.push(line.slice(5).trimStart());
  });
  flush();
  if (!messages.length) throw new Error('The MCP server returned neither JSON nor JSON-bearing SSE events.');
  return messages;
};

const operationResult = (messages: unknown[], id: string): { result: unknown; events: McpEvent[] } => {
  const events: McpEvent[] = [];
  for (const value of messages) {
    const message = asRecord(value);
    if (!message) continue;
    if (message.id === id) {
      if (message.error) throw new Error(`MCP error: ${JSON.stringify(message.error)}`);
      return { result: message.result, events };
    }
    events.push({ direction: 'server', method: asString(message.method) || 'message', detail: JSON.stringify(message), timestamp: now() });
  }
  throw new Error('The MCP server did not return the matching JSON-RPC response.');
};

export const parseMcpJsonRpcResponse = (body: string, id: string) => operationResult(responseMessages(body), id);

const httpRequest = async (
  client: McpClient,
  method: string,
  params: unknown,
  environment: Environment | undefined,
  context: SendRequestContext,
  sessionId = '',
  notification = false,
): Promise<McpOperationResult> => {
  assertProtectedCredentials(client);
  const id = requestId();
  const request = createBlankRequest(id);
  request.name = `${client.name} · ${method}`;
  request.method = 'POST';
  request.url = validateHttpEndpoint(client.url);
  request.bodyMode = 'json';
  request.body = JSON.stringify(notification
    ? { jsonrpc: '2.0', method, params }
    : { jsonrpc: '2.0', id, method, params });
  request.headers = [
    { id: `${id}-content-type`, name: 'Content-Type', value: 'application/json', enabled: true },
    { id: `${id}-accept`, name: 'Accept', value: 'application/json, text/event-stream', enabled: true },
    ...(sessionId ? [{ id: `${id}-session`, name: 'Mcp-Session-Id', value: sessionId, enabled: true }] : []),
    ...client.headers,
  ];
  request.auth = {
    ...request.auth,
    type: client.authType,
    token: client.token,
    username: client.username,
    password: client.password,
    disabled: client.authType === 'none',
  };
  request.transport = { ...request.transport, followRedirects: false, followRedirectsMode: 'off', timeoutMode: 'custom', timeoutMs: 30_000, sendCookies: false, storeCookies: false };
  const response = await sendRequest(request, environment, context);
  if (response.status === 401) throw new Error('MCP authentication failed with 401. Configure a PAT, Basic credentials, or a supported OAuth token.');
  if (response.status < 200 || response.status >= 300) throw new Error(`MCP HTTP request failed (${response.status}): ${response.body.slice(0, 2_000)}`);
  const nextSession = Object.entries(response.headers).find(([name]) => name.toLowerCase() === 'mcp-session-id')?.[1] ?? sessionId;
  const events: McpEvent[] = [{ direction: 'client', method, detail: notification ? 'notification' : id, timestamp: now() }];
  if (notification || !response.body.trim()) return { result: undefined, events, sessionId: nextSession };
  const parsed = parseMcpJsonRpcResponse(response.body, id);
  return { result: parsed.result, events: [...events, ...parsed.events], sessionId: nextSession };
};

const httpSession = async (client: McpClient, environment: Environment | undefined, context: SendRequestContext) => {
  const initialized = await httpRequest(client, 'initialize', {
    protocolVersion: '2025-06-18',
    capabilities: { roots: { listChanged: false } },
    clientInfo: { name: 'Brunomnia', version: '0.1.0' },
  }, environment, context);
  const notification = await httpRequest(client, 'notifications/initialized', {}, environment, context, initialized.sessionId, true);
  return { sessionId: notification.sessionId ?? initialized.sessionId ?? '', events: [...initialized.events, ...notification.events] };
};

const stdioRequest = async (client: McpClient, method: string, params: unknown): Promise<McpOperationResult> => {
  if (!isTauri()) throw new Error('MCP STDIO servers require the Tauri desktop app.');
  if (!client.command.trim()) throw new Error('Enter the MCP STDIO executable and arguments. Brunomnia never invokes a shell.');
  const output = await invoke<StdioOutput>('mcp_stdio_call', { input: { command: client.command, args: client.args, method, params, roots: client.roots, timeoutMs: 30_000 } });
  const events: McpEvent[] = output.events.map((event) => ({ direction: 'server', method: asString(asRecord(event)?.method) || 'message', detail: JSON.stringify(event), timestamp: now() }));
  if (output.stderr) events.push({ direction: 'stderr', method: 'stderr', detail: output.stderr, timestamp: now() });
  return { result: output.result, events };
};

const operation = async (
  client: McpClient,
  method: string,
  params: unknown,
  environment: Environment | undefined,
  context: SendRequestContext,
  sessionId?: string,
) => client.transport === 'stdio'
  ? stdioRequest(client, method, params)
  : httpRequest(client, method, params, environment, context, sessionId);

const toolList = (value: unknown): McpTool[] => {
  const tools = asRecord(value)?.tools;
  return !Array.isArray(tools) ? [] : tools.flatMap((item): McpTool[] => {
    const tool = asRecord(item);
    const name = asString(tool?.name);
    return tool && name ? [{ name, description: asString(tool.description), inputSchema: (tool.inputSchema ?? {}) as JsonValue }] : [];
  });
};

const promptList = (value: unknown): McpPrompt[] => {
  const prompts = asRecord(value)?.prompts;
  return !Array.isArray(prompts) ? [] : prompts.flatMap((item): McpPrompt[] => {
    const prompt = asRecord(item);
    const name = asString(prompt?.name);
    if (!prompt || !name) return [];
    const args = Array.isArray(prompt.arguments) ? prompt.arguments.flatMap((item): McpPrompt['arguments'] => {
      const argument = asRecord(item);
      const argumentName = asString(argument?.name);
      return argument && argumentName ? [{ name: argumentName, description: asString(argument.description), required: argument.required === true }] : [];
    }) : [];
    return [{ name, description: asString(prompt.description), arguments: args }];
  });
};

const resourceList = (value: unknown, key: 'resources' | 'resourceTemplates'): McpResource[] => {
  const resources = asRecord(value)?.[key];
  return !Array.isArray(resources) ? [] : resources.flatMap((item): McpResource[] => {
    const resource = asRecord(item);
    const uri = asString(resource?.uri) || asString(resource?.uriTemplate);
    return resource && uri ? [{ uri, name: asString(resource.name) || uri, description: asString(resource.description), mimeType: asString(resource.mimeType) }] : [];
  });
};

export const discoverMcpClient = async (client: McpClient, environment: Environment | undefined, context: SendRequestContext) => {
  if (!client.enabled) throw new Error('Review the MCP endpoint or command, then enable this client before connecting.');
  const session = client.transport === 'http' ? await httpSession(client, environment, context) : { sessionId: '', events: [] as McpEvent[] };
  const events = [...session.events];
  const warnings: string[] = [];
  const list = async (method: string, key: 'tools' | 'prompts' | 'resources' | 'resourceTemplates') => {
    const values: unknown[] = [];
    let cursor = '';
    for (let page = 0; page < 100; page += 1) {
      try {
        const response = await operation(client, method, cursor ? { cursor } : {}, environment, context, session.sessionId);
        events.push(...response.events);
        values.push(response.result);
        cursor = asString(asRecord(response.result)?.nextCursor);
        if (!cursor) break;
      } catch (error) {
        warnings.push(`${method}: ${error instanceof Error ? error.message : String(error)}`);
        break;
      }
    }
    if (key === 'tools') return values.flatMap(toolList).slice(0, 5_000);
    if (key === 'prompts') return values.flatMap(promptList).slice(0, 5_000);
    return values.flatMap((value) => resourceList(value, key)).slice(0, 5_000);
  };
  const tools = await list('tools/list', 'tools') as McpTool[];
  const prompts = await list('prompts/list', 'prompts') as McpPrompt[];
  const resources = await list('resources/list', 'resources') as McpResource[];
  const resourceTemplates = await list('resources/templates/list', 'resourceTemplates') as McpResource[];
  return { client: { ...client, tools, prompts, resources, resourceTemplates, lastSyncedAt: now() }, events, warnings };
};

export const invokeMcpOperation = async (
  client: McpClient,
  kind: 'tool' | 'prompt' | 'resource',
  name: string,
  parameters: Record<string, unknown>,
  environment: Environment | undefined,
  context: SendRequestContext,
) => {
  if (!client.enabled) throw new Error('Enable this MCP client before invoking operations.');
  const session = client.transport === 'http' ? await httpSession(client, environment, context) : { sessionId: '', events: [] as McpEvent[] };
  const method = kind === 'tool' ? 'tools/call' : kind === 'prompt' ? 'prompts/get' : 'resources/read';
  const params = kind === 'tool' ? { name, arguments: parameters } : kind === 'prompt' ? { name, arguments: parameters } : { uri: name };
  const response = await operation(client, method, params, environment, context, session.sessionId);
  return { result: response.result, events: [...session.events, ...response.events] };
};

export type { McpEvent };
