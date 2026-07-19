import type { ApiRequest, CookieRecord, StoredResponse } from '../types';
import { renderTemplate } from './templates';

export type RequestRenderContext = {
  cookies?: CookieRecord[];
  responses?: StoredResponse[];
  customTag?: (name: string, args: string[]) => Promise<string | undefined>;
  externalSecret?: (input: { provider: 'aws' | 'gcp' | 'azure' | 'hashicorp'; reference: string; scope?: string; field?: string; version?: string }) => Promise<string>;
};

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
    request,
    customTag: context.customTag,
    externalSecret: context.externalSecret,
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
