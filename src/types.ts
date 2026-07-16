export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
export type Protocol = 'http' | 'graphql' | 'websocket' | 'sse' | 'grpc';
export type BodyMode = 'none' | 'json' | 'text' | 'form-urlencoded' | 'multipart' | 'binary';

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
};

export type Collection = {
  id: string;
  name: string;
  expanded: boolean;
  requests: ApiRequest[];
};

export type Environment = {
  id: string;
  name: string;
  variables: KeyValue[];
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
  version: 2;
  name: string;
  activeRequestId: string;
  activeEnvironmentId: string;
  collections: Collection[];
  environments: Environment[];
  history: HistoryEntry[];
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
export type ResponseTab = 'preview' | 'headers' | 'cookies' | 'timeline';
export type SidebarMode = 'collections' | 'history';

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
