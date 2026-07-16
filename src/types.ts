export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS' | 'TRACE';
export type Protocol = 'http' | 'graphql' | 'websocket' | 'sse' | 'grpc';
export type BodyMode = 'none' | 'json' | 'text' | 'form-urlencoded' | 'multipart' | 'binary';
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export type SourceMetadata = {
  format: string;
  sourceId?: string;
  unsupported?: Record<string, JsonValue>;
};

export type KeyValue = {
  id: string;
  name: string;
  value: string;
  enabled: boolean;
};

export type AuthConfig = {
  type: 'none' | 'bearer' | 'basic' | 'api-key';
  token: string;
  username: string;
  password: string;
  apiKeyName: string;
  apiKeyValue: string;
  apiKeyLocation: 'header' | 'query';
};

export type FilePayload = {
  fileName: string;
  mimeType: string;
  dataBase64: string;
};

export type MultipartPart = KeyValue & {
  kind: 'text' | 'file';
  file?: FilePayload;
};

export type GraphqlConfig = {
  query: string;
  variables: string;
  operationName: string;
};

export type GrpcConfig = {
  service: string;
  method: string;
  descriptorSource: 'reflection' | 'proto';
  protoText: string;
  descriptorSetBase64: string;
  input: string;
  metadata: KeyValue[];
};

export type TransportConfig = {
  followRedirects: boolean;
  timeoutMs: number;
  validateCertificates: boolean;
  proxyUrl: string;
  clientCertificatePem: string;
  clientKeyPem: string;
};

export type ApiRequest = {
  id: string;
  name: string;
  protocol: Protocol;
  method: HttpMethod;
  url: string;
  params: KeyValue[];
  headers: KeyValue[];
  bodyMode: BodyMode;
  body: string;
  formBody: KeyValue[];
  multipartBody: MultipartPart[];
  binaryBody?: FilePayload;
  auth: AuthConfig;
  graphql: GraphqlConfig;
  grpc: GrpcConfig;
  transport: TransportConfig;
  preRequestScript: string;
  tests: string;
  source?: SourceMetadata;
};

export type Collection = {
  id: string;
  name: string;
  expanded: boolean;
  requests: ApiRequest[];
  source?: SourceMetadata;
};

export type Environment = {
  id: string;
  name: string;
  variables: KeyValue[];
  source?: SourceMetadata;
};

export type HistoryEntry = {
  id: string;
  requestId: string;
  name: string;
  method: HttpMethod;
  url: string;
  status: number;
  durationMs: number;
  createdAt: string;
};

export type Workspace = {
  format: 'brunomnia';
  version: 4;
  name: string;
  activeRequestId: string;
  activeEnvironmentId: string;
  collections: Collection[];
  environments: Environment[];
  history: HistoryEntry[];
  apiDesigns: ApiDesign[];
  mockServers: MockServer[];
  runnerReports: RunnerReport[];
  imports: ImportRecord[];
};

export type HttpResponse = {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  durationMs: number;
  sizeBytes: number;
};

export type RequestTab = 'params' | 'headers' | 'auth' | 'body' | 'transport' | 'scripts' | 'tests';
export type ResponseTab = 'preview' | 'headers' | 'cookies' | 'timeline' | 'tests';
export type SidebarMode = 'collections' | 'history';
export type WorkbenchSection = 'requests' | 'design' | 'runner' | 'mocks';

export type ApiDesign = {
  id: string;
  name: string;
  contents: string;
  generatedCollectionId?: string;
  source?: SourceMetadata;
};

export type OpenApiIssue = {
  severity: 'error' | 'warning';
  path: string;
  message: string;
};

export type MockRoute = {
  id: string;
  name: string;
  enabled: boolean;
  method: HttpMethod;
  path: string;
  status: number;
  headers: KeyValue[];
  body: string;
  delayMs: number;
};

export type MockServer = {
  id: string;
  name: string;
  host: '127.0.0.1';
  port: number;
  routes: MockRoute[];
  source?: SourceMetadata;
};

export type ImportFormat = 'brunomnia' | 'insomnia-v4' | 'insomnia-v5' | 'postman-2' | 'postman-environment' | 'har' | 'openapi-3' | 'swagger-2' | 'wsdl' | 'curl';

export type ImportWarning = {
  code: string;
  message: string;
  resource?: string;
};

export type ImportRecord = {
  id: string;
  format: ImportFormat;
  sourceName: string;
  importedAt: string;
  warnings: ImportWarning[];
  metadata: Record<string, string>;
};

export type ScriptTestResult = {
  name: string;
  passed: boolean;
  error?: string;
};

export type ScriptRunResult = {
  request: ApiRequest;
  environment: Record<string, string>;
  logs: string[];
  tests: ScriptTestResult[];
};

export type RunnerItemResult = {
  id: string;
  requestId: string;
  requestName: string;
  iteration: number;
  attempt: number;
  status: number;
  durationMs: number;
  passed: boolean;
  error?: string;
  tests: ScriptTestResult[];
};

export type RunnerReport = {
  id: string;
  collectionId: string;
  collectionName: string;
  environmentId: string;
  startedAt: string;
  finishedAt: string;
  iterations: number;
  retries: number;
  total: number;
  passed: number;
  failed: number;
  cancelled: boolean;
  results: RunnerItemResult[];
};

export type StreamDirection = 'incoming' | 'outgoing' | 'system';

export type StreamMessage = {
  id: string;
  sessionId?: string;
  direction: StreamDirection;
  kind: string;
  text: string;
  timestamp: string;
};

export type GrpcMethodInfo = {
  name: string;
  fullName: string;
  clientStreaming: boolean;
  serverStreaming: boolean;
  inputType: string;
  outputType: string;
};

export type GrpcServiceInfo = {
  name: string;
  fullName: string;
  methods: GrpcMethodInfo[];
};

export type GrpcSchema = {
  services: GrpcServiceInfo[];
  descriptorSetBase64: string;
};
