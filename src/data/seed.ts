import type { ApiRequest, Collection, HttpMethod, Workspace } from '../types';
import { defaultPreferences } from '../lib/preferences';

const seedProtoText = `syntax = "proto3";
package brunomnia.orders.v1;

service OrdersService {
  rpc GetOrder (GetOrderRequest) returns (Order);
  rpc WatchOrders (WatchOrdersRequest) returns (stream Order);
}

message GetOrderRequest { string id = 1; }
message WatchOrdersRequest { string status = 1; }
message Order { string id = 1; string status = 2; double total = 3; }`;

const createRequest = (id: string, name: string, method: HttpMethod, url: string): ApiRequest => ({
  id,
  name,
  protocol: 'http',
  method,
  url,
  pathParams: [],
  params: [],
  headers: [{ id: `${id}-content-type`, name: 'Content-Type', value: 'application/json', enabled: method !== 'GET' }],
  disableUserAgentHeader: false,
  bodyMode: method === 'GET' ? 'none' : 'json',
  renderBodyTemplates: true,
  body: '',
  formBody: [],
  multipartBody: [],
  auth: {
    type: 'none',
    disabled: false,
    token: '',
    prefix: 'Bearer',
    username: '',
    password: '',
    apiKeyName: 'X-API-Key',
    apiKeyValue: '',
    apiKeyLocation: 'header',
    oauth1SignatureMethod: 'HMAC-SHA1', consumerKey: '', consumerSecret: '', tokenKey: '', tokenSecret: '', privateKey: '', version: '1.0', nonce: '', timestamp: '', callback: '', realm: '', verifier: '', includeBodyHash: false,
    oauth2GrantType: 'authorization_code', accessTokenUrl: '', authorizationUrl: '', clientId: '', clientSecret: '', audience: '', scope: '', resource: '', origin: '', redirectUrl: 'http://localhost/', credentialsInBody: false, state: '', code: '', accessToken: '', identityToken: '', refreshToken: '', expiresAt: 0, tokenPrefix: 'Bearer', usePkce: false, pkceMethod: 'S256', codeVerifier: '', responseType: 'code',
    ntlmDomain: '', ntlmWorkstation: 'BRUNOMNIA',
    awsAccessKeyId: '', awsSecretAccessKey: '', awsSessionToken: '', awsRegion: 'us-east-1', awsService: 'execute-api',
    hawkId: '', hawkKey: '', hawkExt: '', hawkAlgorithm: 'sha256', hawkValidatePayload: true,
    asapIssuer: '', asapSubject: '', asapAudience: '', asapAdditionalClaims: '{}', asapPrivateKey: '', asapKeyId: '',
    netrc: '',
  },
  graphql: {
    query: 'query GetViewer {\n  viewer {\n    id\n    name\n  }\n}',
    variables: '{}',
    operationName: 'GetViewer',
    schemaEndpoint: '',
    schemaFetchedAt: '',
    schemaSource: 'remote',
    schemaFileName: '',
    includeInputValueDeprecation: false,
    schemaIncludesInputValueDeprecation: false,
  },
  grpc: {
    service: '',
    method: '',
    descriptorSource: 'reflection',
    reflectionApiUrl: 'https://buf.build',
    reflectionApiKey: '',
    reflectionApiModule: 'buf.build/connectrpc/eliza',
    protoText: seedProtoText,
    protoFiles: [{ id: `${id}-grpc-schema`, path: 'schema.proto', text: seedProtoText }],
    protoEntryPath: 'schema.proto',
    protoActivePath: 'schema.proto',
    descriptorSetBase64: '',
    input: '{}',
    metadata: [],
  },
  transport: {
    followRedirects: true,
    followRedirectsMode: 'global',
    timeoutMode: 'global',
    timeoutMs: 60000,
    validateCertificatesMode: 'global',
    validateCertificates: true,
    proxyMode: 'global',
    proxyUrl: '',
    proxyExclusions: '',
    clientCertificatePem: '',
    clientKeyPem: '',
    clientCertificatePfxBase64: '',
    clientCertificatePassphrase: '',
    clientCertificateDomains: '',
    caCertificatePem: '',
    sendCookies: true,
    storeCookies: true,
  },
  sse: {
    autoReconnect: true,
    reconnectDelayMs: 1000,
    maxReconnects: 0,
    respectServerRetry: true,
    sendLastEventId: true,
  },
  socketIo: {
    path: '/socket.io',
    eventName: 'message',
    args: [{ id: `${id}-socketio-arg`, value: '{}', mode: 'json' }],
    ack: false,
    eventListeners: [],
  },
  preRequestScript: '// Runs before the request\n',
  tests: `insomnia.test('Status is successful', () => {
  expect(insomnia.response.status).toBeLessThan(400);
});
`,
});

const orders = createRequest('create-order', 'Create Order', 'POST', 'https://api.acme.dev/v1/orders');
orders.body = JSON.stringify(
  {
    customerId: 'cus_12345',
    items: [
      { productId: 'prod_98765', quantity: 2, unitPrice: 49.99 },
      { productId: 'prod_56789', quantity: 1, unitPrice: 19.99 },
    ],
    shippingAddress: { line1: '123 Market St', line2: 'Apt 4B' },
  },
  null,
  2,
);

const collection = (id: string, name: string, requests: ApiRequest[]): Collection => ({
  id,
  name,
  expanded: true,
  requests,
  folders: [],
  environment: [],
  environmentEditorMode: 'table',
  documentation: '',
});

export const seedWorkspace: Workspace = {
  format: 'brunomnia',
  version: 38,
  name: 'Local Workspace',
  activeRequestId: orders.id,
  activeEnvironmentId: 'development',
  collections: [
    collection('orders', 'Orders', [
      createRequest('list-orders', 'List Orders', 'GET', 'https://api.acme.dev/v1/orders'),
      orders,
      createRequest('get-order', 'Get Order', 'GET', 'https://api.acme.dev/v1/orders/{{ orderId }}'),
      createRequest('update-order', 'Update Order', 'PATCH', 'https://api.acme.dev/v1/orders/{{ orderId }}'),
      createRequest('delete-order', 'Delete Order', 'DELETE', 'https://api.acme.dev/v1/orders/{{ orderId }}'),
    ]),
    collection('customers', 'Customers', [
      createRequest('list-customers', 'List Customers', 'GET', 'https://api.acme.dev/v1/customers'),
      createRequest('create-customer', 'Create Customer', 'POST', 'https://api.acme.dev/v1/customers'),
    ]),
    collection('products', 'Products', [
      createRequest('list-products', 'List Products', 'GET', 'https://api.acme.dev/v1/products'),
      createRequest('get-product', 'Get Product', 'GET', 'https://api.acme.dev/v1/products/{{ productId }}'),
    ]),
    collection('health', 'Health', [
      createRequest('health-check', 'Health Check', 'GET', 'https://api.acme.dev/health'),
    ]),
    collection('protocols', 'Protocol Lab', [
      {
        ...createRequest('graphql-viewer', 'GraphQL Viewer', 'POST', 'https://api.acme.dev/graphql'),
        protocol: 'graphql',
      },
      {
        ...createRequest('live-orders', 'Live Orders', 'GET', 'wss://ws.acme.dev/orders'),
        protocol: 'websocket',
      },
      {
        ...createRequest('socketio-orders', 'Socket.IO Orders', 'GET', 'https://socket.acme.dev/orders'),
        protocol: 'socketio',
        socketIo: {
          path: '/socket.io',
          eventName: 'message',
          args: [{ id: 'socketio-orders-arg', value: '{\n  "status": "pending"\n}', mode: 'json' }],
          ack: true,
          eventListeners: [{ id: 'socketio-orders-listener', eventName: 'order.updated', description: 'Order lifecycle updates', enabled: true }],
        },
      },
      {
        ...createRequest('order-events', 'Order Events', 'GET', 'https://events.acme.dev/orders'),
        protocol: 'sse',
      },
      {
        ...createRequest('grpc-orders', 'Orders gRPC', 'POST', 'http://127.0.0.1:50051'),
        protocol: 'grpc',
      },
    ]),
  ],
  environments: [
    {
      id: 'base-environment',
      name: 'Base Environment',
      variables: [
        { id: 'base-order-id', name: 'orderId', value: 'ord_abc123', enabled: true },
        { id: 'base-product-id', name: 'productId', value: 'prod_98765', enabled: true },
      ],
      environmentEditorMode: 'table',
      parentId: '', private: false, color: '#7e8a91',
    },
    {
      id: 'development',
      name: 'Development',
      variables: [{ id: 'dev-base-url', name: 'baseUrl', value: 'https://api.acme.dev', enabled: true }],
      environmentEditorMode: 'table',
      parentId: 'base-environment', private: false, color: '#66c68d',
    },
    {
      id: 'production',
      name: 'Production',
      variables: [{ id: 'prod-base-url', name: 'baseUrl', value: 'https://api.acme.com', enabled: true }],
      environmentEditorMode: 'table',
      parentId: 'base-environment', private: false, color: '#ff9d4a',
    },
  ],
  history: [],
  apiDesigns: [
    {
      id: 'orders-api-design',
      name: 'Orders API',
      ruleset: '',
      contents: `openapi: 3.1.0
info:
  title: Orders API
  version: 1.0.0
  description: Local-first order operations
servers:
  - url: https://api.acme.dev
paths:
  /v1/orders:
    get:
      operationId: listOrders
      summary: List orders
      responses:
        '200':
          description: Orders returned
    post:
      operationId: createOrder
      summary: Create an order
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
      responses:
        '201':
          description: Order created
  /v1/orders/{orderId}:
    get:
      operationId: getOrder
      summary: Get an order
      parameters:
        - in: path
          name: orderId
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Order returned
`,
    },
  ],
  mockServers: [
    {
      id: 'orders-mock',
      name: 'Orders local mock',
      host: '127.0.0.1',
      port: 4010,
      routes: [
        {
          id: 'mock-list-orders',
          name: 'List orders',
          enabled: true,
          method: 'GET',
          path: '/v1/orders',
          status: 200,
          headers: [{ id: 'mock-content-type', name: 'Content-Type', value: 'application/json', enabled: true }],
          body: JSON.stringify({ data: [{ id: 'ord_mock_1', status: 'PROCESSING' }], generatedAt: '{{$timestamp}}' }, null, 2),
          delayMs: 0,
        },
      ],
    },
  ],
  testSuites: [],
  unitTestResults: [],
  runnerReports: [],
  imports: [],
  cookies: [],
  responses: [],
  streamSessions: [],
  responseFilters: {},
  certificates: { ca: { enabled: false, pem: '' }, clients: [] },
  project: { mode: 'local', path: '', remoteUrl: '', remoteName: 'origin', authorName: '', authorEmail: '', autoSave: true },
  plugins: [],
  pluginData: {},
  activePluginTheme: '',
  collaboration: { mode: 'off', path: '', actor: 'Local owner', revision: 0 },
  governance: {
    currentMemberId: 'local-owner',
    members: [{ id: 'local-owner', name: 'Local owner', email: '', role: 'owner', active: true }],
    policy: { allowedStorage: ['local', 'folder', 'git', 'encrypted-file'], requireEncryptedSync: true, requireVaultForSecrets: true, externalVaultAllowlist: [], auditRetention: 500 },
    audit: [],
  },
  mcpClients: [],
  ai: { enabled: false, provider: 'openai-compatible', baseUrl: 'http://127.0.0.1:11434/v1', model: '', apiKey: '', mockGeneration: false, commitSuggestions: false },
  konnect: { enabled: false, baseUrl: 'https://us.api.konghq.com', token: '', controlPlaneId: '', controlPlanes: [] },
  preferences: structuredClone(defaultPreferences),
};

export const cloneSeedWorkspace = (): Workspace => structuredClone(seedWorkspace);

export const createBlankRequest = (id: string): ApiRequest =>
  createRequest(id, 'Untitled Request', 'GET', 'https://');
