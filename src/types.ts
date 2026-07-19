export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS' | 'TRACE' | (string & Record<never, never>);
export type Protocol = 'http' | 'graphql' | 'websocket' | 'socketio' | 'sse' | 'grpc';
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
  description?: string;
  multiline?: boolean;
  valueType?: 'string' | 'json';
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
  origin: string;
  redirectUrl: string;
  credentialsInBody: boolean;
  state: string;
  code: string;
  accessToken: string;
  identityToken: string;
  refreshToken: string;
  expiresAt: number;
  tokenPrefix: string;
  usePkce: boolean;
  pkceMethod: 'S256' | 'plain';
  codeVerifier: string;
  responseType: 'code' | 'token' | 'id_token' | 'id_token token';
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
  multiline?: boolean;
  file?: FilePayload;
  contentType?: string;
  fileName?: string;
};

export type GraphqlConfig = {
  query: string;
  variables: string;
  operationName: string;
  schema?: GraphqlSchema;
  schemaEndpoint: string;
  schemaFetchedAt: string;
  schemaSource: 'remote' | 'local';
  schemaFileName: string;
  includeInputValueDeprecation: boolean;
  schemaIncludesInputValueDeprecation: boolean;
};

export type GraphqlTypeRef = {
  kind: string;
  name: string;
  ofType?: GraphqlTypeRef;
};

export type GraphqlInputValue = {
  name: string;
  description: string;
  defaultValue: string;
  isDeprecated: boolean;
  deprecationReason: string;
  type: GraphqlTypeRef;
};

export type GraphqlField = {
  name: string;
  description: string;
  isDeprecated: boolean;
  deprecationReason: string;
  args: GraphqlInputValue[];
  type: GraphqlTypeRef;
};

export type GraphqlSchemaType = {
  kind: string;
  name: string;
  description: string;
  specifiedByUrl: string;
  isOneOf: boolean;
  fields: GraphqlField[];
  inputFields: GraphqlInputValue[];
  interfaces: GraphqlTypeRef[];
  enumValues: Array<{ name: string; description: string; isDeprecated: boolean; deprecationReason: string }>;
  possibleTypes: GraphqlTypeRef[];
};

export type GraphqlDirective = {
  name: string;
  description: string;
  isRepeatable: boolean;
  locations: string[];
  args: GraphqlInputValue[];
};

export type GraphqlSchema = {
  queryType: string;
  mutationType: string;
  subscriptionType: string;
  types: GraphqlSchemaType[];
  directives: GraphqlDirective[];
};

export type GrpcProtoFile = {
  id: string;
  path: string;
  text: string;
};

export type GrpcConfig = {
  service: string;
  method: string;
  descriptorSource: 'reflection' | 'proto' | 'buf';
  reflectionApiUrl: string;
  reflectionApiKey: string;
  reflectionApiModule: string;
  protoText: string;
  protoFiles: GrpcProtoFile[];
  protoEntryPath: string;
  protoActivePath: string;
  descriptorSetBase64: string;
  input: string;
  metadata: KeyValue[];
};

export type TransportConfig = {
  followRedirects: boolean;
  followRedirectsMode: 'global' | 'on' | 'off';
  timeoutMode: 'global' | 'custom';
  timeoutMs: number;
  validateCertificatesMode: 'global' | 'on' | 'off';
  validateCertificates: boolean;
  proxyMode: 'global' | 'custom' | 'disabled';
  proxyUrl: string;
  proxyExclusions: string;
  clientCertificatePem: string;
  clientKeyPem: string;
  clientCertificatePfxBase64: string;
  clientCertificatePassphrase: string;
  clientCertificateDomains: string;
  caCertificatePem: string;
  sendCookies: boolean;
  storeCookies: boolean;
};

export type WorkspaceClientCertificate = {
  id: string;
  host: string;
  enabled: boolean;
  certificatePem: string;
  keyPem: string;
  pfxBase64: string;
  passphrase: string;
};

export type WorkspaceCertificates = {
  ca: { enabled: boolean; pem: string };
  clients: WorkspaceClientCertificate[];
};

export type SseConfig = {
  autoReconnect: boolean;
  reconnectDelayMs: number;
  maxReconnects: number;
  respectServerRetry: boolean;
  sendLastEventId: boolean;
};

export type SocketIoArg = {
  id: string;
  value: string;
  mode: 'json' | 'text';
};

export type SocketIoEventListener = {
  id: string;
  eventName: string;
  description: string;
  enabled: boolean;
};

export type SocketIoConfig = {
  path: string;
  eventName: string;
  args: SocketIoArg[];
  ack: boolean;
  eventListeners: SocketIoEventListener[];
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
  id: string;
  requestId: string;
  requestName: string;
  requestUrl: string;
  environmentId: string;
  receivedAt: string;
  requestSnapshot?: ApiRequest;
  requestTestResults?: ScriptTestResult[];
  settingSendCookies?: boolean;
  settingStoreCookies?: boolean;
  globalEnvironmentId?: string;
  collectionEnvironmentId?: string;
};

export type StoredStreamSession = {
  id: string;
  requestId: string;
  requestName: string;
  requestUrl: string;
  environmentId: string;
  protocol: 'graphql' | 'websocket' | 'socketio' | 'sse';
  startedAt: string;
  endedAt?: string;
  messages: StreamMessage[];
  requestSnapshot?: ApiRequest;
  status?: number;
  statusText?: string;
  headers?: Record<string, string>;
  httpVersion?: string;
  durationMs?: number;
  transport?: string;
  timeline?: ResponseTimelineEntry[];
};

export type StreamConnectionMetadata = {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  httpVersion: string;
  durationMs: number;
  transport: string;
};

export type ResponseTimelineEntry = {
  name: 'Text' | 'DataOut';
  value: string;
  elapsedMs: number;
  hidden?: boolean;
};

export type ApiRequest = {
  id: string;
  name: string;
  protocol: Protocol;
  method: HttpMethod;
  url: string;
  pathParams: KeyValue[];
  params: KeyValue[];
  headers: KeyValue[];
  disableUserAgentHeader: boolean;
  bodyMode: BodyMode;
  renderBodyTemplates: boolean;
  body: string;
  formBody: KeyValue[];
  multipartBody: MultipartPart[];
  binaryBody?: FilePayload;
  auth: AuthConfig;
  graphql: GraphqlConfig;
  grpc: GrpcConfig;
  transport: TransportConfig;
  sse: SseConfig;
  socketIo: SocketIoConfig;
  preRequestScript: string;
  tests: string;
  folderId?: string;
  inheritFolderAuth?: boolean;
  documentation?: string;
  source?: SourceMetadata;
};

export type RequestFolder = {
  id: string;
  name: string;
  parentId: string;
  expanded: boolean;
  headers: KeyValue[];
  environment: KeyValue[];
  environmentEditorMode?: 'table' | 'raw';
  auth?: AuthConfig;
  preRequestScript: string;
  tests: string;
  documentation: string;
  source?: SourceMetadata;
};

export type CollectionEnvironment = {
  id: string;
  name: string;
  variables: KeyValue[];
  environmentEditorMode?: 'table' | 'raw';
};

export type Collection = {
  id: string;
  name: string;
  expanded: boolean;
  requests: ApiRequest[];
  folders?: RequestFolder[];
  resourceOrder?: string[];
  environment?: KeyValue[];
  environmentEditorMode?: 'table' | 'raw';
  subEnvironments?: CollectionEnvironment[];
  activeSubEnvironmentId?: string;
  documentation?: string;
  source?: SourceMetadata;
};

export type Environment = {
  id: string;
  name: string;
  variables: KeyValue[];
  environmentEditorMode?: 'table' | 'raw';
  parentId?: string;
  private?: boolean;
  color?: string;
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
  version: 37;
  name: string;
  activeRequestId: string;
  activeEnvironmentId: string;
  collections: Collection[];
  environments: Environment[];
  history: HistoryEntry[];
  apiDesigns: ApiDesign[];
  mockServers: MockServer[];
  testSuites: UnitTestSuite[];
  unitTestResults: UnitTestRunResult[];
  runnerReports: RunnerReport[];
  imports: ImportRecord[];
  cookies: CookieRecord[];
  responses: StoredResponse[];
  streamSessions: StoredStreamSession[];
  responseFilters?: Record<string, { filter: string; history: string[]; previewMode: ResponsePreviewMode }>;
  certificates: WorkspaceCertificates;
  project: ProjectConfig;
  plugins: PluginRecord[];
  pluginData: Record<string, Record<string, string>>;
  activePluginTheme: string;
  collaboration: CollaborationConfig;
  governance: GovernanceConfig;
  mcpClients: McpClient[];
  ai: AiSettings;
  konnect: KonnectConfig;
  preferences: AppPreferences;
};

export type ShortcutAction = 'palette' | 'preferences' | 'send' | 'environment' | 'history' | 'toggle-sidebar' | 'new-request' | 'duplicate-request' | 'delete-request' | 'focus-url' | 'generate-code';

export type PreferredHttpVersion = 'default' | 'http1.0' | 'http1.1' | 'http2' | 'http2-prior-knowledge';

export type AppPreferences = {
  theme: 'system' | 'dark' | 'light';
  density: 'comfortable' | 'compact';
  fontSize: number;
  interfaceFontSize: number;
  fontInterface: string;
  fontMonospace: string;
  showPasswords: boolean;
  allowHtmlPreviewRemoteResources: boolean;
  allowHtmlPreviewScripts: boolean;
  disableResponsePreviewLinks: boolean;
  preferredHttpVersion: PreferredHttpVersion;
  maxRedirects: number;
  followRedirects: boolean;
  maxTimelineDataSizeKB: number;
  maxHistoryResponses: number;
  filterResponsesByEnv: boolean;
  requestTimeoutMs: number;
  validateCertificates: boolean;
  validateAuthCertificates: boolean;
  proxyEnabled: boolean;
  httpProxy: string;
  httpsProxy: string;
  noProxy: string;
  useBulkHeaderEditor: boolean;
  useBulkParametersEditor: boolean;
  forceVerticalLayout: boolean;
  editorIndentWithTabs: boolean;
  editorIndentSize: number;
  editorLineWrapping: boolean;
  fontVariantLigatures: boolean;
  scriptTimeoutMs: number;
  allowScriptRequests: boolean;
  allowScriptFileAccess: boolean;
  dataFolders: string[];
  enableVaultInScripts: boolean;
  autoFetchGraphqlSchema: boolean;
  confirmDestructive: boolean;
  shortcuts: Record<ShortcutAction, string>;
};

export type McpTool = {
  name: string;
  description: string;
  inputSchema: JsonValue;
};

export type McpPrompt = {
  name: string;
  description: string;
  arguments: Array<{ name: string; description: string; required: boolean }>;
};

export type McpResource = {
  uri: string;
  uriTemplate: string;
  variables: string[];
  name: string;
  description: string;
  mimeType: string;
};

export type McpClient = {
  id: string;
  name: string;
  enabled: boolean;
  transport: 'http' | 'stdio';
  url: string;
  command: string;
  args: string[];
  headers: KeyValue[];
  authType: 'none' | 'bearer' | 'basic' | 'oauth2';
  token: string;
  username: string;
  password: string;
  oauthAuthorizationUrl: string;
  oauthAccessTokenUrl: string;
  oauthClientId: string;
  oauthClientSecret: string;
  oauthScope: string;
  oauthState: string;
  oauthRefreshToken: string;
  oauthIdentityToken: string;
  oauthExpiresAt: number;
  oauthTokenPrefix: string;
  oauthRegisteredClientId: string;
  oauthRegisteredClientSecret: string;
  oauthRegisteredClientIdIssuedAt: number;
  oauthRegisteredClientSecretExpiresAt: number;
  oauthRegisteredTokenEndpointAuthMethod: 'none' | 'client_secret_basic' | 'client_secret_post';
  roots: string[];
  tools: McpTool[];
  prompts: McpPrompt[];
  resources: McpResource[];
  resourceTemplates: McpResource[];
  lastSyncedAt?: string;
};

export type AiSettings = {
  enabled: boolean;
  provider: 'openai' | 'anthropic' | 'gemini' | 'openai-compatible';
  baseUrl: string;
  model: string;
  apiKey: string;
  mockGeneration: boolean;
  commitSuggestions: boolean;
};

export type KonnectControlPlane = {
  id: string;
  name: string;
  description: string;
  proxyUrls: Array<{
    host: string;
    port: number;
    protocol: 'http' | 'https' | 'ws' | 'wss' | 'grpc' | 'grpcs';
  }>;
};

export type KonnectConfig = {
  enabled: boolean;
  baseUrl: string;
  token: string;
  controlPlaneId: string;
  controlPlanes: KonnectControlPlane[];
  lastSyncedAt?: string;
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
  bodyBase64?: string;
  durationMs: number;
  sizeBytes: number;
  setCookies?: string[];
  requestUrl?: string;
  httpVersion?: string;
  timeline?: ResponseTimelineEntry[];
};

export type RequestTab = 'params' | 'headers' | 'auth' | 'body' | 'transport' | 'scripts' | 'tests' | 'docs';
export type ResponseTab = 'preview' | 'headers' | 'cookies' | 'timeline' | 'tests' | 'mock';
export type ResponsePreviewMode = 'friendly' | 'source' | 'raw';
export type SidebarMode = 'collections' | 'history';
export type WorkbenchSection = 'requests' | 'design' | 'runner' | 'mocks' | 'git' | 'plugins' | 'security' | 'integrations' | 'preferences';

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

export type UnitTest = {
  id: string;
  name: string;
  code: string;
  requestId: string | null;
  sortKey: number;
};

export type UnitTestSuite = {
  id: string;
  name: string;
  collectionId: string;
  sortKey: number;
  tests: UnitTest[];
};

export type UnitTestCaseResult = {
  testId: string;
  name: string;
  requestId: string | null;
  passed: boolean;
  durationMs: number;
  error?: string;
  logs: string[];
};

export type UnitTestRunResult = {
  id: string;
  suiteId: string;
  startedAt: string;
  finishedAt: string;
  tests: UnitTestCaseResult[];
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
  baseGlobals?: Record<string, string>;
  baseGlobalDisabled?: string[];
  globalDisabled?: string[];
  collectionVariables?: Record<string, string>;
  baseEnvironment?: Record<string, string>;
  baseEnvironmentDisabled?: string[];
  collectionDisabled?: string[];
  folders?: Array<{ id: string; name: string; environment: Record<string, string>; disabled?: string[] }>;
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
  request?: RunnerRequestSnapshot;
  response?: RunnerResponseSnapshot;
};

export type RunnerRequestSnapshot = {
  protocol: Protocol;
  method: string;
  url: string;
  urlTruncated: boolean;
  headers: Array<{ name: string; value: string; redacted: boolean }>;
  headersTruncated: boolean;
  bodyMode: string;
  bodySummary: string;
  bodySizeBytes: number;
  bodySizeEstimated: boolean;
  storedBytes: number;
};

export type RunnerResponseSnapshot = {
  statusText: string;
  statusTextTruncated: boolean;
  headers: Record<string, string>;
  headersTruncated: boolean;
  bodyPreview: string;
  bodyTruncated: boolean;
  sizeBytes: number;
  storedBytes: number;
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
  testNamePattern?: string;
  matchedTests?: number;
  total: number;
  passed: number;
  failed: number;
  cancelled: boolean;
  bailed?: boolean;
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
  statusCode?: number;
  statusName?: string;
  statusDetails?: string;
  metadata?: Record<string, string[]>;
};

export type GrpcMethodInfo = {
  name: string;
  fullName: string;
  clientStreaming: boolean;
  serverStreaming: boolean;
  inputType: string;
  outputType: string;
  example?: Record<string, unknown>;
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
