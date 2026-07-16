import type { ApiRequest, Collection, HttpMethod, Workspace } from '../types';

const createRequest = (id: string, name: string, method: HttpMethod, url: string): ApiRequest => ({
  id,
  name,
  protocol: 'http',
  method,
  url,
  params: [],
  headers: [{ id: `${id}-content-type`, name: 'Content-Type', value: 'application/json', enabled: method !== 'GET' }],
  bodyMode: method === 'GET' ? 'none' : 'json',
  body: '',
  formBody: [],
  multipartBody: [],
  auth: {
    type: 'none',
    token: '',
    username: '',
    password: '',
    apiKeyName: 'X-API-Key',
    apiKeyValue: '',
    apiKeyLocation: 'header',
  },
  graphql: {
    query: 'query GetViewer {\n  viewer {\n    id\n    name\n  }\n}',
    variables: '{}',
    operationName: 'GetViewer',
  },
  grpc: {
    service: '',
    method: '',
    descriptorSource: 'reflection',
    protoText: `syntax = "proto3";
package brunomnia.orders.v1;

service OrdersService {
  rpc GetOrder (GetOrderRequest) returns (Order);
  rpc WatchOrders (WatchOrdersRequest) returns (stream Order);
}

message GetOrderRequest { string id = 1; }
message WatchOrdersRequest { string status = 1; }
message Order { string id = 1; string status = 2; double total = 3; }`,
    descriptorSetBase64: '',
    input: '{}',
    metadata: [],
  },
  transport: {
    followRedirects: true,
    timeoutMs: 60000,
    validateCertificates: true,
    proxyUrl: '',
    clientCertificatePem: '',
    clientKeyPem: '',
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
});

export const seedWorkspace: Workspace = {
  format: 'brunomnia',
  version: 3,
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
      id: 'development',
      name: 'Development',
      variables: [
        { id: 'dev-base-url', name: 'baseUrl', value: 'https://api.acme.dev', enabled: true },
        { id: 'dev-order-id', name: 'orderId', value: 'ord_abc123', enabled: true },
        { id: 'dev-product-id', name: 'productId', value: 'prod_98765', enabled: true },
      ],
    },
    {
      id: 'production',
      name: 'Production',
      variables: [{ id: 'prod-base-url', name: 'baseUrl', value: 'https://api.acme.com', enabled: true }],
    },
  ],
  history: [],
  apiDesigns: [
    {
      id: 'orders-api-design',
      name: 'Orders API',
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
  runnerReports: [],
};

export const cloneSeedWorkspace = (): Workspace => structuredClone(seedWorkspace);

export const createBlankRequest = (id: string): ApiRequest =>
  createRequest(id, 'Untitled Request', 'GET', 'https://');
