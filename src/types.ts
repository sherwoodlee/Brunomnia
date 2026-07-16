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
  type: 'none' | 'bearer' | 'basic' | 'api-key' | 'digest' | 'oauth1' | 'oauth2' | 'ntlm' | 'iam' | 'hawk' | 'asap' | 'netrc';
  disabled: boolean;
  token: string;
  prefix: string;
  username: string;
  password: string;
  apiKeyName: string;
  apiKeyValue: string;
  apiKeyLocation: 'header' | 'query';
  oauth1SignatureMethod: 'HMAC-SHA1' | 'HMAC-SHA256' | 'RSA-SHA1' | 'PLAINTEXT';
  consumerKey: string;
  consumerSecret: string;
  tokenKey: string;
  tokenSecret: string;
  privateKey: string;
  version: string;
  nonce: string;
  timestamp: string;
  callback: string;
  realm: string;
  verifier: string;
  includeBodyHash: boolean;
  oauth2GrantType: 'authorization_code' | 'client_credentials' | 'implicit' | 'password' | 'refresh_token';
  accessTokenUrl: string;
  authorizationUrl: string;
  clientId: string;
  clientSecret: string;
  audience: string;
  scope: string;
  resource: string;
  redirectUrl: string;
  credentialsInBody: boolean;
  state: string;
  code: string;
  accessToken: string;
  refreshToken: string;
  tokenPrefix: string;
  usePkce: boolean;
  pkceMethod: 'S256' | 'plain';
  codeVerifier: string;
  responseType: 'code' | 'token' | 'id_token';
  ntlmDomain: string;
  ntlmWorkstation: string;
  awsAccessKeyId: string;
  awsSecretAccessKey: string;
  awsSessionToken: string;
  awsRegion: string;
  awsService: string;
  hawkId: string;
  hawkKey: string;
  hawkExt: string;
  hawkAlgorithm: 'sha1' | 'sha256';
  hawkValidatePayload: boolean;
  asapIssuer: string;
  asapSubject: string;
  asapAudience: string;
  asapAdditionalClaims: string;
  asapPrivateKey: string;
  asapKeyId: string;
  netrc: string;
};

export type FilePayload = {
  fileName: string;
  mimeType: string;
  dataBase64: string;
};

export type MultipartPart = KeyValue & {
  kind: 'text' | 'file';
  file?: FilePayload;
  contentType?: string;
  fileName?: string;
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
  proxyExclusions: string;
  clientCertificatePem: string;
  clientKeyPem: string;
  clientCertificateDomains: string;
  sendCookies: boolean;
  storeCookies: boolean;
};

export type CookieRecord = {
  id: string;
  name: string;
  value: string;
  domain: string;
  path: string;
  expires?: string;
  secure: boolean;
  httpOnly: boolean;
  sameSite: 'strict' | 'lax' | 'none' | '';
  hostOnly: boolean;
  createdAt: string;
};

export type StoredResponse = HttpResponse & {
  requestId: string;
  requestName: string;
  requestUrl: string;
  receivedAt: string;
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
  version: 7;
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
  cookies: CookieRecord[];
  responses: StoredResponse[];
  project: ProjectConfig;
  plugins: PluginRecord[];
  pluginData: Record<string, Record<string, string>>;
  activePluginTheme: string;
  collaboration: CollaborationConfig;
  governance: GovernanceConfig;
};

export type CollaborationConfig = {
  mode: 'off' | 'encrypted-file';
  path: string;
  actor: string;
  revision: number;
  lastPulledAt?: string;
  lastPushedAt?: string;
};

export type GovernanceRole = 'owner' | 'admin' | 'editor' | 'viewer';

export type GovernanceMember = {
  id: string;
  name: string;
  email: string;
  role: GovernanceRole;
  active: boolean;
};

export type GovernancePolicy = {
  allowedStorage: Array<'local' | 'folder' | 'git' | 'encrypted-file'>;
  requireEncryptedSync: boolean;
  requireVaultForSecrets: boolean;
  externalVaultAllowlist: string[];
  auditRetention: number;
};

export type AuditEvent = {
  id: string;
  timestamp: string;
  actorId: string;
  action: string;
  detail: string;
};

export type GovernanceConfig = {
  currentMemberId: string;
  members: GovernanceMember[];
  policy: GovernancePolicy;
  audit: AuditEvent[];
};

export type ProjectConfig = {
  mode: 'local' | 'folder' | 'git';
  path: string;
  remoteUrl: string;
  remoteName: string;
  authorName: string;
  authorEmail: string;
  autoSave: boolean;
  lastSavedAt?: string;
};

export type PluginPermission =
  | 'request:read'
  | 'request:write'
  | 'response:read'
  | 'response:write'
  | 'store'
  | 'network'
  | 'app:prompt'
  | 'app:clipboard'
  | 'template'
  | 'action'
  | 'theme';

export type PluginRecord = {
  id: string;
  name: string;
  version: string;
  description: string;
  source: string;
  sourcePath?: string;
  sourceFormat: 'brunomnia' | 'insomnia-commonjs';
  enabled: boolean;
  requestedPermissions: PluginPermission[];
  grantedPermissions: PluginPermission[];
  installedAt: string;
  error?: string;
};

export type HttpResponse = {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  durationMs: number;
  sizeBytes: number;
  setCookies?: string[];
  requestUrl?: string;
};

export type RequestTab = 'params' | 'headers' | 'auth' | 'body' | 'transport' | 'scripts' | 'tests';
export type ResponseTab = 'preview' | 'headers' | 'cookies' | 'timeline' | 'tests';
export type SidebarMode = 'collections' | 'history';
export type WorkbenchSection = 'requests' | 'design' | 'runner' | 'mocks' | 'git' | 'plugins' | 'security';

export type ApiDesign = {
  id: string;
  name: string;
  contents: string;
  ruleset?: string;
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
  localVariables?: Record<string, string>;
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
