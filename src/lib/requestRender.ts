import type { ApiRequest, CookieRecord, Environment, StoredResponse } from '../types';
import { environmentMap } from './request';
import { renderTemplate, type TemplateContext } from './templates';

export type RequestRenderContext = {
  cookies?: CookieRecord[];
  responses?: StoredResponse[];
  environmentId?: string;
  requestAncestors?: string[];
  renderPurpose?: TemplateContext['renderPurpose'];
  prompt?: TemplateContext['prompt'];
  resolveResponse?: TemplateContext['resolveResponse'];
  requestChain?: string[];
  osInfo?: TemplateContext['osInfo'];
  customTag?: (name: string, args: string[]) => Promise<string | undefined>;
  externalSecret?: (input: { provider: 'aws' | 'gcp' | 'azure' | 'hashicorp'; reference: string; scope?: string; field?: string; version?: string; credentialId?: string; appName?: string }) => Promise<string>;
  readFile?: (path: string) => Promise<string>;
};

export type RequestSendRenderContext = RequestRenderContext & {
  filterResponsesByEnv?: boolean;
  vault?: Record<string, string>;
  pluginRuntime?: {
    templateTag: (name: string, args: string[], request: ApiRequest) => Promise<string | undefined>;
  };
};

const sendRenderContext = (
  request: ApiRequest,
  environment: Environment | undefined,
  context: RequestSendRenderContext,
): { variables: Record<string, string>; context: RequestRenderContext } => ({
  variables: { ...environmentMap(environment), ...(context.vault ?? {}) },
  context: {
    ...context,
    environmentId: environment?.id,
    responses: context.responses,
    customTag: context.customTag ?? (context.pluginRuntime
      ? (name, args) => context.pluginRuntime!.templateTag(name, args, request)
      : undefined),
  },
});

const renderRows = async (rows: ApiRequest['headers'], render: (value: string) => Promise<string>) => Promise.all(rows.map(async (row) => ({
  ...row,
  name: await render(row.name),
  value: await render(row.value),
})));

export const renderApiRequest = async (
  request: ApiRequest,
  variables: Record<string, string>,
  context: RequestRenderContext = {},
): Promise<ApiRequest> => {
  const templateContext = {
    variables,
    cookies: context.cookies ?? [],
    responses: context.responses ?? [],
    environmentId: context.environmentId,
    request,
    requestAncestors: context.requestAncestors,
    renderPurpose: context.renderPurpose ?? 'send',
    prompt: context.prompt,
    resolveResponse: context.resolveResponse,
    requestChain: context.requestChain,
    osInfo: context.osInfo,
    customTag: context.customTag,
    externalSecret: context.externalSecret,
    readFile: context.readFile,
  };
  const render = (value: string) => renderTemplate(value, templateContext);
  const renderBody = request.renderBodyTemplates !== false ? render : async (value: string) => value;
  const authEntries = await Promise.all(Object.entries(request.auth).map(async ([key, value]) => [key, typeof value === 'string' ? await render(value) : value]));
  return {
    ...request,
    name: await render(request.name),
    url: await render(request.url),
    pathParams: await renderRows(request.pathParams, render),
    params: await renderRows(request.params, render),
    headers: await renderRows(request.headers, render),
    body: await renderBody(request.body),
    formBody: await renderRows(request.formBody, renderBody),
    multipartBody: await Promise.all(request.multipartBody.map(async (part) => ({
      ...part,
      name: await renderBody(part.name),
      value: await renderBody(part.value),
      contentType: await renderBody(part.contentType ?? ''),
      fileName: await renderBody(part.fileName ?? ''),
    }))),
    auth: Object.fromEntries(authEntries) as ApiRequest['auth'],
    graphql: { ...request.graphql, query: request.graphql.query, variables: await renderBody(request.graphql.variables), operationName: request.graphql.operationName },
    grpc: { ...request.grpc, service: await render(request.grpc.service), method: await render(request.grpc.method), protoText: await render(request.grpc.protoText), input: await render(request.grpc.input), metadata: await renderRows(request.grpc.metadata, render) },
    transport: {
      ...request.transport,
      proxyUrl: await render(request.transport.proxyUrl),
      proxyExclusions: await render(request.transport.proxyExclusions),
      clientCertificateDomains: await render(request.transport.clientCertificateDomains),
    },
  };
};

export const renderRequestValue = (
  value: string,
  request: ApiRequest,
  environment: Environment | undefined,
  context: RequestSendRenderContext = {},
) => {
  const prepared = sendRenderContext(request, environment, context);
  return renderTemplate(value, {
    variables: prepared.variables,
    cookies: prepared.context.cookies ?? [],
    responses: prepared.context.responses ?? [],
    environmentId: prepared.context.environmentId,
    request,
    requestAncestors: prepared.context.requestAncestors,
    renderPurpose: prepared.context.renderPurpose ?? 'send',
    prompt: prepared.context.prompt,
    resolveResponse: prepared.context.resolveResponse,
    requestChain: prepared.context.requestChain,
    osInfo: prepared.context.osInfo,
    customTag: prepared.context.customTag,
    externalSecret: prepared.context.externalSecret,
    readFile: prepared.context.readFile,
  });
};

export const renderRealtimeConnectionRequest = async (
  request: ApiRequest,
  environment: Environment | undefined,
  context: RequestSendRenderContext = {},
): Promise<ApiRequest> => {
  const prepared = sendRenderContext(request, environment, context);
  const render = (value: string) => renderTemplate(value, {
    variables: prepared.variables,
    cookies: prepared.context.cookies ?? [],
    responses: prepared.context.responses ?? [],
    environmentId: prepared.context.environmentId,
    request,
    requestAncestors: prepared.context.requestAncestors,
    renderPurpose: prepared.context.renderPurpose ?? 'send',
    prompt: prepared.context.prompt,
    resolveResponse: prepared.context.resolveResponse,
    requestChain: prepared.context.requestChain,
    osInfo: prepared.context.osInfo,
    customTag: prepared.context.customTag,
    externalSecret: prepared.context.externalSecret,
    readFile: prepared.context.readFile,
  });
  const authEntries = await Promise.all(Object.entries(request.auth).map(async ([key, value]) => [key, typeof value === 'string' ? await render(value) : value]));
  return {
    ...request,
    url: await render(request.url),
    pathParams: await renderRows(request.pathParams, render),
    params: await renderRows(request.params, render),
    headers: await renderRows(request.headers, render),
    auth: Object.fromEntries(authEntries) as ApiRequest['auth'],
    graphql: request.protocol === 'graphql' && request.renderBodyTemplates !== false
      ? { ...request.graphql, variables: await render(request.graphql.variables) }
      : request.graphql,
    socketIo: request.protocol === 'socketio'
      ? {
        ...request.socketIo,
        path: await render(request.socketIo.path),
        eventListeners: await Promise.all(request.socketIo.eventListeners.map(async (listener) => ({ ...listener, eventName: await render(listener.eventName) }))),
      }
      : request.socketIo,
    transport: {
      ...request.transport,
      proxyUrl: await render(request.transport.proxyUrl),
      proxyExclusions: await render(request.transport.proxyExclusions),
      clientCertificateDomains: await render(request.transport.clientCertificateDomains),
    },
  };
};
