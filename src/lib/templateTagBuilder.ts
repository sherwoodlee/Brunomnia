import type { ApiRequest, AuthConfig, KeyValue } from '../types';

export type TemplateTagKind = 'environment' | 'faker' | 'uuid' | 'now' | 'base64' | 'hash' | 'jsonpath' | 'cookie' | 'response' | 'request' | 'prompt' | 'file' | 'external';
export type TemplateTagInsertMode = 'append' | 'replace';
export type TemplateTagDestination = { id: string; label: string };

const quoted = (value: string) => `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
const tag = (name: string, values: string[]) => `{% ${name}${values.length ? ` ${values.map(quoted).join(', ')}` : ''} %}`;

export const buildTemplateTag = (kind: TemplateTagKind, values: Record<string, string>) => {
  if (kind === 'environment') return `{{ ${values.name.trim()} }}`;
  if (kind === 'faker') return `{{ faker.${values.name || 'randomUUID'} }}`;
  if (kind === 'uuid') return tag('uuid', [values.version || 'v4']);
  if (kind === 'now') return tag('now', [values.format || 'iso-8601']);
  if (kind === 'base64') return tag('base64', [values.operation || 'encode', values.encoding || 'normal', values.value || '']);
  if (kind === 'hash') return tag('hash', [values.algorithm || 'sha256', values.output || 'hex', values.value || '']);
  if (kind === 'jsonpath') return tag('jsonpath', [values.value || '{}', values.path || '$']);
  if (kind === 'cookie') return values.url ? tag('cookie', [values.url, values.name || '']) : tag('cookie', [values.name || '']);
  if (kind === 'response') return tag('response', [values.attribute || 'body', values.request || '', values.path || '']);
  if (kind === 'request') return tag('request', [values.attribute || 'url']);
  if (kind === 'prompt') return tag('prompt', [values.message || 'Enter a value', values.value || '']);
  if (kind === 'file') return tag('file', [values.path || '']);
  return tag('external', [values.provider || 'aws', values.reference || '', values.scope || '', values.field || '', values.version || '']);
};

const rowDestinations = (prefix: string, label: string, rows: KeyValue[]) => rows.flatMap((row, index) => {
  const name = row.name || `row ${index + 1}`;
  return [
    { id: `${prefix}:${row.id}`, label: `${label} value · ${name}` },
    { id: `${prefix}-name:${row.id}`, label: `${label} name · ${name}` },
  ];
});

const authFields: Record<AuthConfig['type'], Array<keyof AuthConfig>> = {
  none: [],
  bearer: ['token', 'prefix'],
  basic: ['username', 'password'],
  'api-key': ['apiKeyName', 'apiKeyValue'],
  digest: ['username', 'password'],
  oauth1: ['consumerKey', 'consumerSecret', 'tokenKey', 'tokenSecret', 'privateKey', 'version', 'nonce', 'timestamp', 'callback', 'realm', 'verifier'],
  oauth2: ['accessTokenUrl', 'authorizationUrl', 'clientId', 'clientSecret', 'audience', 'scope', 'resource', 'origin', 'redirectUrl', 'state', 'code', 'accessToken', 'identityToken', 'refreshToken', 'tokenPrefix', 'codeVerifier'],
  ntlm: ['username', 'password', 'ntlmDomain', 'ntlmWorkstation'],
  iam: ['awsAccessKeyId', 'awsSecretAccessKey', 'awsSessionToken', 'awsRegion', 'awsService'],
  hawk: ['hawkId', 'hawkKey', 'hawkExt'],
  asap: ['asapIssuer', 'asapSubject', 'asapAudience', 'asapAdditionalClaims', 'asapPrivateKey', 'asapKeyId'],
  netrc: ['netrc'],
};

export const templateTagDestinations = (request: ApiRequest): TemplateTagDestination[] => [
  { id: 'name', label: 'Request name' },
  { id: 'url', label: 'Request URL' },
  ...(request.protocol === 'graphql' ? [{ id: 'graphql:variables', label: 'GraphQL variables' }] : []),
  ...(request.protocol === 'http' && (request.bodyMode === 'json' || request.bodyMode === 'text') ? [{ id: 'body', label: 'Request body' }] : []),
  ...rowDestinations('path', 'Path parameter', request.pathParams),
  ...rowDestinations('query', 'Query parameter', request.params),
  ...rowDestinations('header', 'Header', request.headers),
  ...rowDestinations('form', 'Form field', request.formBody),
  ...request.multipartBody.flatMap((part, index) => {
    const name = part.name || `part ${index + 1}`;
    return [
      ...(part.kind === 'text' ? [{ id: `multipart:${part.id}`, label: `Multipart value · ${name}` }] : []),
      { id: `multipart-name:${part.id}`, label: `Multipart name · ${name}` },
      { id: `multipart-content-type:${part.id}`, label: `Multipart content type · ${name}` },
      ...(part.kind === 'file' ? [{ id: `multipart-file-name:${part.id}`, label: `Multipart filename · ${name}` }] : []),
    ];
  }),
  ...authFields[request.auth.type].filter((field) => typeof request.auth[field] === 'string').map((field) => ({ id: `auth:${String(field)}`, label: `Authentication · ${String(field)}` })),
  { id: 'transport:proxyUrl', label: 'Transport · proxy URL' },
  { id: 'transport:proxyExclusions', label: 'Transport · proxy exclusions' },
  { id: 'transport:clientCertificateDomains', label: 'Transport · client certificate domains' },
  ...(request.protocol === 'grpc' ? [
    { id: 'grpc:service', label: 'gRPC service' },
    { id: 'grpc:method', label: 'gRPC method' },
    { id: 'grpc:protoText', label: 'gRPC proto source' },
    { id: 'grpc:input', label: 'gRPC input' },
    ...rowDestinations('grpc-metadata', 'gRPC metadata', request.grpc.metadata),
  ] : []),
];

const inserted = (current: string, value: string, mode: TemplateTagInsertMode) => mode === 'replace' ? value : `${current}${value}`;
const updateRows = (rows: KeyValue[], id: string, field: 'name' | 'value', value: string, mode: TemplateTagInsertMode, destination: string) => {
  if (!rows.some((row) => row.id === id)) throw new Error(`Template tag destination '${destination}' is no longer available.`);
  return rows.map((row) => row.id === id ? { ...row, [field]: inserted(row[field], value, mode) } : row);
};

export const insertTemplateTag = (
  request: ApiRequest,
  destination: string,
  value: string,
  mode: TemplateTagInsertMode,
): ApiRequest => {
  if (destination === 'name') return { ...request, name: inserted(request.name, value, mode) };
  if (destination === 'url') return { ...request, url: inserted(request.url, value, mode) };
  if (destination === 'body') return { ...request, body: inserted(request.body, value, mode) };
  if (destination === 'graphql:variables') return { ...request, graphql: { ...request.graphql, variables: inserted(request.graphql.variables, value, mode) } };
  const separator = destination.indexOf(':');
  const kind = separator < 0 ? destination : destination.slice(0, separator);
  const id = separator < 0 ? '' : destination.slice(separator + 1);
  if (kind === 'path' || kind === 'path-name') return { ...request, pathParams: updateRows(request.pathParams, id, kind.endsWith('-name') ? 'name' : 'value', value, mode, destination) };
  if (kind === 'query' || kind === 'query-name') return { ...request, params: updateRows(request.params, id, kind.endsWith('-name') ? 'name' : 'value', value, mode, destination) };
  if (kind === 'header' || kind === 'header-name') return { ...request, headers: updateRows(request.headers, id, kind.endsWith('-name') ? 'name' : 'value', value, mode, destination) };
  if (kind === 'form' || kind === 'form-name') return { ...request, formBody: updateRows(request.formBody, id, kind.endsWith('-name') ? 'name' : 'value', value, mode, destination) };
  if (kind === 'multipart') {
    if (!request.multipartBody.some((part) => part.id === id && part.kind === 'text')) throw new Error(`Template tag destination '${destination}' is no longer available.`);
    return { ...request, multipartBody: request.multipartBody.map((part) => part.id === id ? { ...part, value: inserted(part.value, value, mode) } : part) };
  }
  if (kind === 'multipart-name' || kind === 'multipart-content-type' || kind === 'multipart-file-name') {
    const field = kind === 'multipart-name' ? 'name' : kind === 'multipart-content-type' ? 'contentType' : 'fileName';
    if (!request.multipartBody.some((part) => part.id === id)) throw new Error(`Template tag destination '${destination}' is no longer available.`);
    return { ...request, multipartBody: request.multipartBody.map((part) => part.id === id ? { ...part, [field]: inserted(part[field] ?? '', value, mode) } : part) };
  }
  if (kind === 'auth') {
    const field = id as keyof AuthConfig;
    if (!authFields[request.auth.type].includes(field) || typeof request.auth[field] !== 'string') throw new Error(`Template tag destination '${destination}' is no longer available.`);
    return { ...request, auth: { ...request.auth, [field]: inserted(request.auth[field] as string, value, mode) } };
  }
  if (kind === 'transport' && ['proxyUrl', 'proxyExclusions', 'clientCertificateDomains'].includes(id)) {
    const field = id as 'proxyUrl' | 'proxyExclusions' | 'clientCertificateDomains';
    return { ...request, transport: { ...request.transport, [field]: inserted(request.transport[field], value, mode) } };
  }
  if (kind === 'grpc' && ['service', 'method', 'protoText', 'input'].includes(id)) {
    const field = id as 'service' | 'method' | 'protoText' | 'input';
    return { ...request, grpc: { ...request.grpc, [field]: inserted(request.grpc[field], value, mode) } };
  }
  if (kind === 'grpc-metadata' || kind === 'grpc-metadata-name') return { ...request, grpc: { ...request.grpc, metadata: updateRows(request.grpc.metadata, id, kind.endsWith('-name') ? 'name' : 'value', value, mode, destination) } };
  throw new Error(`Template tag destination '${destination}' is no longer available.`);
};
