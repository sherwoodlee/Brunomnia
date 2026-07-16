import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createBlankRequest } from './data/seed';
import { sendRequest } from './lib/http';
import { connectStream, disconnectStream, invokeGrpc, loadGrpcSchema, sendWebSocketMessage } from './lib/protocol';
import { formatBytes, mockResponse, prettyBody } from './lib/request';
import { loadWorkspace, parseWorkspaceImport, saveWorkspace } from './lib/storage';
import { Icon } from './components/Icon';
import {
  CodeEditor,
  GraphqlEditor,
  GrpcEditor,
  HttpBodyEditor,
  StreamConsole,
  StreamSetup,
  TransportEditor,
} from './components/ProtocolEditors';
import type {
  ApiRequest,
  Environment,
  GrpcSchema,
  HistoryEntry,
  HttpMethod,
  HttpResponse,
  KeyValue,
  Protocol,
  RequestTab,
  ResponseTab,
  SidebarMode,
  StreamMessage,
  Workspace,
} from './types';

const requestTabs: RequestTab[] = ['params', 'headers', 'auth', 'body', 'transport', 'scripts', 'tests'];
const responseTabs: ResponseTab[] = ['preview', 'headers', 'cookies', 'timeline'];
const methods: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
const protocols: { value: Protocol; label: string }[] = [
  { value: 'http', label: 'HTTP' },
  { value: 'graphql', label: 'GraphQL' },
  { value: 'websocket', label: 'WebSocket' },
  { value: 'sse', label: 'SSE' },
  { value: 'grpc', label: 'gRPC' },
];

const protocolLabel = (request: ApiRequest) => request.protocol === 'http' ? request.method
  : request.protocol === 'websocket' ? 'WS' : request.protocol.toUpperCase();

const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

const titleCase = (value: string) => `${value.charAt(0).toUpperCase()}${value.slice(1)}`;

const findRequest = (workspace: Workspace): { request: ApiRequest; collectionId: string } | undefined => {
  for (const collection of workspace.collections) {
    const request = collection.requests.find((candidate) => candidate.id === workspace.activeRequestId);
    if (request) return { request, collectionId: collection.id };
  }
};

type KeyValueEditorProps = {
  rows: KeyValue[];
  onChange: (rows: KeyValue[]) => void;
  namePlaceholder?: string;
  valuePlaceholder?: string;
};

function KeyValueEditor({
  rows,
  onChange,
  namePlaceholder = 'Name',
  valuePlaceholder = 'Value',
}: KeyValueEditorProps) {
  const update = (id: string, patch: Partial<KeyValue>) =>
    onChange(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));

  return (
    <div className="kv-editor">
      <div className="kv-header">
        <span />
        <span>{namePlaceholder}</span>
        <span>{valuePlaceholder}</span>
        <span />
      </div>
      {rows.map((row) => (
        <div className="kv-row" key={row.id}>
          <input
            aria-label={`Enable ${row.name || 'row'}`}
            checked={row.enabled}
            className="kv-check"
            onChange={(event) => update(row.id, { enabled: event.target.checked })}
            type="checkbox"
          />
          <input
            aria-label={namePlaceholder}
            onChange={(event) => update(row.id, { name: event.target.value })}
            placeholder={namePlaceholder}
            spellCheck={false}
            value={row.name}
          />
          <input
            aria-label={valuePlaceholder}
            onChange={(event) => update(row.id, { value: event.target.value })}
            placeholder={valuePlaceholder}
            spellCheck={false}
            value={row.value}
          />
          <button
            aria-label="Remove row"
            className="icon-button subtle"
            onClick={() => onChange(rows.filter((candidate) => candidate.id !== row.id))}
            type="button"
          >
            <Icon name="trash" size={15} />
          </button>
        </div>
      ))}
      <button
        className="add-row"
        onClick={() => onChange([...rows, { id: uid('field'), name: '', value: '', enabled: true }])}
        type="button"
      >
        <Icon name="plus" size={14} /> Add row
      </button>
    </div>
  );
}

type CollectionSidebarProps = {
  workspace: Workspace;
  search: string;
  mode: SidebarMode;
  onSearch: (value: string) => void;
  onSelectRequest: (id: string) => void;
  onToggleCollection: (id: string) => void;
  onAddRequest: () => void;
  onAddCollection: () => void;
};

function CollectionSidebar({
  workspace,
  search,
  mode,
  onSearch,
  onSelectRequest,
  onToggleCollection,
  onAddRequest,
  onAddCollection,
}: CollectionSidebarProps) {
  const normalizedSearch = search.trim().toLowerCase();
  const history = workspace.history.filter((entry) =>
    `${entry.name} ${entry.url} ${entry.method}`.toLowerCase().includes(normalizedSearch),
  );

  return (
    <aside className="collection-sidebar">
      <div className="sidebar-search-row">
        <label className="search-field">
          <Icon name="search" size={16} />
          <input
            aria-label={mode === 'collections' ? 'Search collections' : 'Search history'}
            onChange={(event) => onSearch(event.target.value)}
            placeholder={mode === 'collections' ? 'Search collections' : 'Search history'}
            value={search}
          />
        </label>
        <button aria-label="Add request" className="icon-button bordered" onClick={onAddRequest} type="button">
          <Icon name="plus" size={17} />
        </button>
      </div>

      <div className="sidebar-heading">
        <span>{mode === 'collections' ? 'Collections' : 'Recent activity'}</span>
        {mode === 'collections' ? (
          <button onClick={onAddCollection} type="button">New folder</button>
        ) : null}
      </div>

      <div className="collection-scroll">
        {mode === 'collections' ? workspace.collections.map((collection) => {
          const visibleRequests = collection.requests.filter((request) =>
            `${request.name} ${request.method} ${request.protocol} ${request.url}`.toLowerCase().includes(normalizedSearch),
          );
          if (normalizedSearch && visibleRequests.length === 0 && !collection.name.toLowerCase().includes(normalizedSearch)) {
            return null;
          }
          return (
            <div className="collection-group" key={collection.id}>
              <button className="collection-title" onClick={() => onToggleCollection(collection.id)} type="button">
                <Icon name={collection.expanded ? 'chevron-down' : 'chevron-right'} size={14} />
                <Icon name="folder" size={16} />
                <span>{collection.name}</span>
                <small>{collection.requests.length}</small>
              </button>
              {collection.expanded ? visibleRequests.map((request) => (
                <button
                  className={`request-row${workspace.activeRequestId === request.id ? ' selected' : ''}`}
                  key={request.id}
                  onClick={() => onSelectRequest(request.id)}
                  type="button"
                >
                  <span className={`method method-${request.method.toLowerCase()} protocol-${request.protocol}`}>{protocolLabel(request)}</span>
                  <span>{request.name}</span>
                </button>
              )) : null}
            </div>
          );
        }) : (
          history.length ? history.map((entry) => (
            <button className="history-row" key={entry.id} onClick={() => onSelectRequest(entry.requestId)} type="button">
              <span className={`method method-${entry.method.toLowerCase()}`}>{entry.method}</span>
              <span>
                <strong>{entry.name}</strong>
                <small>{new Date(entry.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {entry.durationMs} ms</small>
              </span>
              <em className={entry.status < 400 ? 'ok' : 'bad'}>{entry.status}</em>
            </button>
          )) : <div className="empty-sidebar">Sent requests will appear here.</div>
        )}
      </div>
    </aside>
  );
}

type RequestPanelProps = {
  request: ApiRequest;
  activeTab: RequestTab;
  isSending: boolean;
  streamStatus: 'disconnected' | 'connecting' | 'connected';
  grpcSchema?: GrpcSchema;
  schemaLoading: boolean;
  onTabChange: (tab: RequestTab) => void;
  onChange: (patch: Partial<ApiRequest>) => void;
  onSend: () => void;
  onLoadGrpcSchema: () => void;
};

function RequestPanel({
  request,
  activeTab,
  isSending,
  streamStatus,
  grpcSchema,
  schemaLoading,
  onTabChange,
  onChange,
  onSend,
  onLoadGrpcSchema,
}: RequestPanelProps) {
  const streamProtocol = request.protocol === 'websocket' || request.protocol === 'sse';
  const actionLabel = streamProtocol
    ? streamStatus === 'connected' ? 'Disconnect' : streamStatus === 'connecting' ? 'Connecting' : 'Connect'
    : request.protocol === 'grpc' ? 'Invoke' : 'Send';
  return (
    <section className="request-panel">
      <div className="document-tabs">
        <div className="document-tab active">
          <span className={`method method-${request.method.toLowerCase()} protocol-${request.protocol}`}>{protocolLabel(request)}</span>
          <input
            aria-label="Request name"
            onChange={(event) => onChange({ name: event.target.value })}
            spellCheck={false}
            value={request.name}
          />
          <span className="dirty-dot" />
        </div>
        <button aria-label="New request" className="tab-plus" type="button"><Icon name="plus" size={16} /></button>
      </div>

      <div className="request-command-row">
        <select
          aria-label="Request protocol"
          className={`protocol-select protocol-${request.protocol}`}
          onChange={(event) => {
            const protocol = event.target.value as Protocol;
            onChange({
              protocol,
              method: protocol === 'graphql' || protocol === 'grpc' ? 'POST' : request.method,
              bodyMode: protocol === 'graphql' ? 'json' : request.bodyMode,
            });
          }}
          value={request.protocol}
        >
          {protocols.map((protocol) => <option key={protocol.value} value={protocol.value}>{protocol.label}</option>)}
        </select>
        <select
          aria-label="HTTP method"
          className={`method-select method-${request.method.toLowerCase()}`}
          disabled={request.protocol !== 'http'}
          onChange={(event) => onChange({ method: event.target.value as HttpMethod })}
          value={request.method}
        >
          {methods.map((method) => <option key={method}>{method}</option>)}
        </select>
        <input
          aria-label="Request URL"
          className="url-input"
          onChange={(event) => onChange({ url: event.target.value })}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) onSend();
          }}
          spellCheck={false}
          value={request.url}
        />
        <button className="send-button" disabled={isSending} onClick={onSend} type="button">
          {isSending ? <span className="sending-spinner" /> : null}
          {isSending && !streamProtocol ? 'Working' : actionLabel}
        </button>
      </div>

      <nav className="tab-strip request-tabs" aria-label="Request configuration">
        {requestTabs.map((tab) => {
          const count = tab === 'params' ? request.params.filter((row) => row.enabled && row.name).length
            : tab === 'headers' ? (request.protocol === 'grpc' ? request.grpc.metadata : request.headers).filter((row) => row.enabled && row.name).length : 0;
          return (
            <button className={activeTab === tab ? 'active' : ''} key={tab} onClick={() => onTabChange(tab)} type="button">
              {titleCase(tab)}{count ? <small>{count}</small> : null}
            </button>
          );
        })}
      </nav>

      <div className="request-editor">
        {activeTab === 'params' ? (
          <KeyValueEditor rows={request.params} onChange={(params) => onChange({ params })} namePlaceholder="Parameter" />
        ) : null}
        {activeTab === 'headers' && request.protocol !== 'grpc' ? (
          <KeyValueEditor rows={request.headers} onChange={(headers) => onChange({ headers })} namePlaceholder="Header" />
        ) : null}
        {activeTab === 'headers' && request.protocol === 'grpc' ? (
          <KeyValueEditor rows={request.grpc.metadata} onChange={(metadata) => onChange({ grpc: { ...request.grpc, metadata } })} namePlaceholder="Metadata" />
        ) : null}
        {activeTab === 'auth' ? <AuthEditor request={request} onChange={onChange} /> : null}
        {activeTab === 'body' && request.protocol === 'http' ? <HttpBodyEditor onChange={onChange} request={request} /> : null}
        {activeTab === 'body' && request.protocol === 'graphql' ? <GraphqlEditor onChange={onChange} request={request} /> : null}
        {activeTab === 'body' && (request.protocol === 'websocket' || request.protocol === 'sse') ? <StreamSetup protocol={request.protocol} /> : null}
        {activeTab === 'body' && request.protocol === 'grpc' ? <GrpcEditor onChange={onChange} onLoadSchema={onLoadGrpcSchema} request={request} schema={grpcSchema} schemaLoading={schemaLoading} /> : null}
        {activeTab === 'transport' ? <TransportEditor onChange={onChange} request={request} /> : null}
        {activeTab === 'scripts' ? (
          <div className="editor-stack">
            <div className="editor-toolbar"><span>Pre-request script</span><small>JavaScript</small></div>
            <CodeEditor ariaLabel="Pre-request script" onChange={(preRequestScript) => onChange({ preRequestScript })} value={request.preRequestScript} />
          </div>
        ) : null}
        {activeTab === 'tests' ? (
          <div className="editor-stack">
            <div className="editor-toolbar"><span>After-response tests</span><small>JavaScript</small></div>
            <CodeEditor ariaLabel="Response tests" onChange={(tests) => onChange({ tests })} value={request.tests} />
          </div>
        ) : null}
      </div>
      <div className="panel-footer"><span>{activeTab === 'body' ? 'Body' : titleCase(activeTab)}</span><span>UTF-8 · LF</span></div>
    </section>
  );
}

function AuthEditor({ request, onChange }: Pick<RequestPanelProps, 'request' | 'onChange'>) {
  const auth = request.auth;
  const update = (patch: Partial<ApiRequest['auth']>) => onChange({ auth: { ...auth, ...patch } });
  return (
    <div className="auth-editor">
      <label>Auth type
        <select value={auth.type} onChange={(event) => update({ type: event.target.value as ApiRequest['auth']['type'] })}>
          <option value="none">No auth</option><option value="bearer">Bearer token</option><option value="basic">Basic auth</option><option value="api-key">API key</option>
        </select>
      </label>
      {auth.type === 'none' ? <p>This request does not add an authorization header.</p> : null}
      {auth.type === 'bearer' ? <label>Token<input onChange={(event) => update({ token: event.target.value })} placeholder="{{ token }}" spellCheck={false} value={auth.token} /></label> : null}
      {auth.type === 'basic' ? <><label>Username<input onChange={(event) => update({ username: event.target.value })} value={auth.username} /></label><label>Password<input onChange={(event) => update({ password: event.target.value })} type="password" value={auth.password} /></label></> : null}
      {auth.type === 'api-key' ? <>
        <label>Key<input onChange={(event) => update({ apiKeyName: event.target.value })} value={auth.apiKeyName} /></label>
        <label>Value<input onChange={(event) => update({ apiKeyValue: event.target.value })} value={auth.apiKeyValue} /></label>
        <label>Add to<select onChange={(event) => update({ apiKeyLocation: event.target.value as 'header' | 'query' })} value={auth.apiKeyLocation}><option value="header">Header</option><option value="query">Query string</option></select></label>
      </> : null}
    </div>
  );
}

type ResponsePanelProps = {
  response: HttpResponse;
  protocol: Protocol;
  activeTab: ResponseTab;
  isSending: boolean;
  streamMessages: StreamMessage[];
  streamStatus: 'disconnected' | 'connecting' | 'connected';
  streamDraft: string;
  onTabChange: (tab: ResponseTab) => void;
  onStreamDraftChange: (value: string) => void;
  onSendStreamMessage: () => void;
};

function ResponsePanel({
  response,
  protocol,
  activeTab,
  isSending,
  streamMessages,
  streamStatus,
  streamDraft,
  onTabChange,
  onStreamDraftChange,
  onSendStreamMessage,
}: ResponsePanelProps) {
  const streaming = protocol === 'websocket' || protocol === 'sse';
  const displayBody = prettyBody(response.body);
  const lines = displayBody.split('\n');
  const copyResponse = () => void navigator.clipboard.writeText(displayBody);
  return (
    <section className="response-panel">
      <div className="response-document-spacer" />
      <div className="response-summary">
        <div className="response-metrics">
          <strong className={streaming ? streamStatus === 'connected' ? 'ok' : '' : response.status > 0 && response.status < 400 ? 'ok' : 'bad'}>
            {streaming ? streamStatus === 'connected' ? 'LIVE' : streamStatus === 'connecting' ? '···' : 'OFF' : isSending ? '···' : response.status || 'Error'}
          </strong>
          <span className={!streaming && response.status > 0 && response.status < 400 ? 'ok' : !streaming ? 'bad' : ''}>{streaming ? protocol === 'websocket' ? 'WebSocket' : 'Event stream' : response.statusText}</span>
          <span>{streaming ? `${streamMessages.length} events` : `${response.durationMs} ms`}</span>
          {!streaming ? <span>{formatBytes(response.sizeBytes)}</span> : null}
        </div>
        <button aria-label="Response source" className="icon-button subtle" type="button"><Icon name="globe" size={18} /></button>
      </div>
      <nav className="tab-strip response-tabs" aria-label="Response details">
        {responseTabs.map((tab) => <button className={activeTab === tab ? 'active' : ''} key={tab} onClick={() => onTabChange(tab)} type="button">{titleCase(tab)}</button>)}
      </nav>
      <div className="response-content">
        {activeTab === 'preview' && streaming ? (
          <StreamConsole connected={streamStatus === 'connected'} draft={streamDraft} messages={streamMessages} onDraftChange={onStreamDraftChange} onSend={onSendStreamMessage} protocol={protocol} />
        ) : null}
        {activeTab === 'preview' && !streaming ? (
          <div className="code-viewer">
            {lines.map((line, index) => (
              <div className="code-line" key={`${index}-${line}`}><span>{index + 1}</span><code>{line || ' '}</code></div>
            ))}
          </div>
        ) : null}
        {activeTab === 'headers' ? (
          <div className="response-table">{Object.entries(response.headers).map(([name, value]) => <div key={name}><strong>{name}</strong><span>{value}</span></div>)}</div>
        ) : null}
        {activeTab === 'cookies' ? <div className="empty-state"><Icon name="archive" size={28} /><strong>No cookies returned</strong><span>Response cookies will be listed here.</span></div> : null}
        {activeTab === 'timeline' ? (
          <div className="timeline">
            <div><span className="timeline-dot" /><strong>Request started</strong><time>0 ms</time></div>
            <div><span className="timeline-dot" /><strong>Response received</strong><time>{response.durationMs} ms</time></div>
            <div><span className="timeline-dot ok" /><strong>Body decoded</strong><time>{response.durationMs} ms</time></div>
          </div>
        ) : null}
      </div>
      <div className="panel-footer response-footer">
        <span>{streaming ? 'EVENT LOG' : protocol === 'grpc' ? 'PROTO JSON' : 'JSON'}</span>
        {!streaming ? <button onClick={copyResponse} type="button"><Icon name="copy" size={14} /> Copy</button> : null}
        <span className="footer-spacer" />
        <span>{streaming ? `${streamMessages.length} messages` : `${lines.length} lines`}</span>
      </div>
    </section>
  );
}

type EnvironmentDialogProps = {
  environment: Environment;
  onClose: () => void;
  onChange: (environment: Environment) => void;
};

function EnvironmentDialog({ environment, onClose, onChange }: EnvironmentDialogProps) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section aria-labelledby="environment-title" aria-modal="true" className="modal environment-modal" onMouseDown={(event) => event.stopPropagation()} role="dialog">
        <header><div><small>Active environment</small><h2 id="environment-title">{environment.name}</h2></div><button aria-label="Close" className="icon-button subtle" onClick={onClose} type="button"><Icon name="x" /></button></header>
        <p>Variables resolve locally inside URLs, headers, authentication, and request bodies.</p>
        <KeyValueEditor rows={environment.variables} onChange={(variables) => onChange({ ...environment, variables })} namePlaceholder="Variable" />
        <footer><button className="secondary-button" onClick={onClose} type="button">Done</button></footer>
      </section>
    </div>
  );
}

type CommandPaletteProps = {
  onClose: () => void;
  onAddRequest: () => void;
  onAddCollection: () => void;
  onEnvironment: () => void;
  onImport: () => void;
  onExport: () => void;
};

function CommandPalette({ onClose, onAddRequest, onAddCollection, onEnvironment, onImport, onExport }: CommandPaletteProps) {
  const actions = [
    { icon: 'plus' as const, label: 'Create request', shortcut: 'N', action: onAddRequest },
    { icon: 'folder' as const, label: 'Create collection', shortcut: '⇧ N', action: onAddCollection },
    { icon: 'braces' as const, label: 'Edit active environment', shortcut: 'E', action: onEnvironment },
    { icon: 'import' as const, label: 'Import workspace', shortcut: 'I', action: onImport },
    { icon: 'download' as const, label: 'Export workspace', shortcut: 'X', action: onExport },
  ];
  return (
    <div className="modal-backdrop palette-backdrop" role="presentation" onMouseDown={onClose}>
      <section aria-label="Command palette" aria-modal="true" className="command-palette" onMouseDown={(event) => event.stopPropagation()} role="dialog">
        <label><Icon name="search" /><input autoFocus placeholder="Search or run a command…" /></label>
        <div>{actions.map((item) => <button key={item.label} onClick={() => { item.action(); onClose(); }} type="button"><Icon name={item.icon} /><span>{item.label}</span><kbd>{item.shortcut}</kbd></button>)}</div>
      </section>
    </div>
  );
}

export default function App() {
  const [workspace, setWorkspace] = useState<Workspace>(() => ({
    format: 'brunomnia', version: 2, name: 'Loading…', activeRequestId: '', activeEnvironmentId: '', collections: [], environments: [], history: [],
  }));
  const [hydrated, setHydrated] = useState(false);
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>('collections');
  const [search, setSearch] = useState('');
  const [requestTab, setRequestTab] = useState<RequestTab>('body');
  const [responseTab, setResponseTab] = useState<ResponseTab>('preview');
  const [response, setResponse] = useState<HttpResponse>(() => mockResponse());
  const [isSending, setIsSending] = useState(false);
  const [showEnvironment, setShowEnvironment] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const [importError, setImportError] = useState('');
  const [streamStatus, setStreamStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [streamMessages, setStreamMessages] = useState<StreamMessage[]>([]);
  const [streamDraft, setStreamDraft] = useState('');
  const [grpcSchemas, setGrpcSchemas] = useState<Record<string, GrpcSchema>>({});
  const [schemaLoading, setSchemaLoading] = useState(false);
  const streamSession = useRef<string | undefined>(undefined);
  const streamProtocol = useRef<Protocol | undefined>(undefined);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    void loadWorkspace().then((loadedWorkspace) => {
      if (!cancelled) {
        setWorkspace(loadedWorkspace);
        setHydrated(true);
      }
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const timeout = window.setTimeout(() => void saveWorkspace(workspace), 350);
    return () => window.clearTimeout(timeout);
  }, [hydrated, workspace]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setShowPalette((visible) => !visible);
      }
      if (event.key === 'Escape') {
        setShowPalette(false);
        setShowEnvironment(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const active = useMemo(() => findRequest(workspace), [workspace]);
  const activeEnvironment = workspace.environments.find((environment) => environment.id === workspace.activeEnvironmentId);

  useEffect(() => {
    const sessionId = streamSession.current;
    const protocol = streamProtocol.current;
    if (sessionId && (protocol === 'websocket' || protocol === 'sse')) {
      void disconnectStream(protocol, sessionId).catch(() => undefined);
    }
    streamSession.current = undefined;
    streamProtocol.current = undefined;
    setStreamStatus('disconnected');
    setStreamMessages([]);
    setStreamDraft('');
  }, [workspace.activeRequestId, active?.request.protocol]);

  const updateActiveRequest = useCallback((patch: Partial<ApiRequest>) => {
    setWorkspace((current) => ({
      ...current,
      collections: current.collections.map((collection) => ({
        ...collection,
        requests: collection.requests.map((request) => request.id === current.activeRequestId ? { ...request, ...patch } : request),
      })),
    }));
  }, []);

  const addRequest = useCallback(() => {
    setWorkspace((current) => {
      const id = uid('request');
      const request = createBlankRequest(id);
      if (current.collections.length === 0) {
        return { ...current, activeRequestId: id, collections: [{ id: uid('collection'), name: 'Requests', expanded: true, requests: [request] }] };
      }
      return {
        ...current,
        activeRequestId: id,
        collections: current.collections.map((collection, index) => index === 0
          ? { ...collection, expanded: true, requests: [...collection.requests, request] }
          : collection),
      };
    });
    setRequestTab('params');
  }, []);

  const addCollection = useCallback(() => {
    setWorkspace((current) => ({
      ...current,
      collections: [...current.collections, { id: uid('collection'), name: `Collection ${current.collections.length + 1}`, expanded: true, requests: [] }],
    }));
  }, []);

  const loadActiveGrpcSchema = async (): Promise<GrpcSchema | undefined> => {
    if (!active || active.request.protocol !== 'grpc' || schemaLoading) return grpcSchemas[active?.request.id ?? ''];
    setSchemaLoading(true);
    try {
      const schema = await loadGrpcSchema(active.request, activeEnvironment);
      const service = schema.services.find((candidate) => candidate.fullName === active.request.grpc.service) ?? schema.services[0];
      const method = service?.methods.find((candidate) => candidate.name === active.request.grpc.method) ?? service?.methods[0];
      setGrpcSchemas((current) => ({ ...current, [active.request.id]: schema }));
      updateActiveRequest({
        grpc: {
          ...active.request.grpc,
          descriptorSetBase64: schema.descriptorSetBase64,
          service: service?.fullName ?? '',
          method: method?.name ?? '',
        },
      });
      return schema;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setResponse({ status: 0, statusText: 'Schema failed', headers: {}, body: message, durationMs: 0, sizeBytes: message.length });
      setResponseTab('preview');
      return undefined;
    } finally {
      setSchemaLoading(false);
    }
  };

  const onStreamEvent = (message: StreamMessage) => {
    setStreamMessages((current) => [...current, { ...message, id: message.id || uid('event') }].slice(-500));
    if (message.kind === 'open') setStreamStatus('connected');
    if (message.kind === 'closed' || message.kind === 'close' || message.kind === 'error') setStreamStatus('disconnected');
  };

  const executeRequest = async () => {
    if (!active || isSending) return;
    if (active.request.protocol === 'websocket' || active.request.protocol === 'sse') {
      if (streamStatus === 'connected') {
        const sessionId = streamSession.current;
        if (!sessionId) return;
        setIsSending(true);
        try {
          await disconnectStream(active.request.protocol, sessionId);
          setStreamMessages((current) => [...current, {
            id: uid('event'), direction: 'system', kind: 'closed', text: 'Disconnected by client', timestamp: new Date().toISOString(),
          }]);
          setStreamStatus('disconnected');
          streamSession.current = undefined;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          onStreamEvent({ id: uid('event'), direction: 'system', kind: 'error', text: message, timestamp: new Date().toISOString() });
        } finally {
          setIsSending(false);
        }
        return;
      }
      setStreamStatus('connecting');
      setStreamMessages([]);
      const sessionId = uid('stream');
      streamSession.current = sessionId;
      streamProtocol.current = active.request.protocol;
      try {
        await connectStream(active.request, activeEnvironment, sessionId, onStreamEvent);
        setStreamStatus('connected');
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        onStreamEvent({ id: uid('event'), direction: 'system', kind: 'error', text: message, timestamp: new Date().toISOString() });
      }
      return;
    }

    setIsSending(true);
    setResponseTab('preview');
    try {
      let result: HttpResponse;
      if (active.request.protocol === 'grpc') {
        const existingSchema = active.request.grpc.descriptorSetBase64 ? grpcSchemas[active.request.id] : undefined;
        const schema = existingSchema ?? await loadActiveGrpcSchema();
        if (!schema) return;
        const service = schema.services.find((candidate) => candidate.fullName === active.request.grpc.service) ?? schema.services[0];
        const method = service?.methods.find((candidate) => candidate.name === active.request.grpc.method) ?? service?.methods[0];
        if (!service || !method) throw new Error('Load a gRPC service and method before invoking.');
        const callRequest: ApiRequest = {
          ...active.request,
          grpc: {
            ...active.request.grpc,
            descriptorSetBase64: schema.descriptorSetBase64,
            service: service.fullName,
            method: method.name,
          },
        };
        const output = await invokeGrpc(callRequest, activeEnvironment);
        const body = JSON.stringify({ status: output.status, callType: output.callType, messages: output.messages }, null, 2);
        result = { status: 200, statusText: `gRPC ${output.status}`, headers: { 'grpc-call-type': output.callType }, body, durationMs: output.durationMs, sizeBytes: new Blob([body]).size };
      } else {
        result = await sendRequest(active.request, activeEnvironment);
      }
      setResponse(result);
      const historyEntry: HistoryEntry = {
        id: uid('history'), requestId: active.request.id, name: active.request.name, method: active.request.method,
        url: active.request.url, status: result.status, durationMs: result.durationMs, createdAt: new Date().toISOString(),
      };
      setWorkspace((current) => ({ ...current, history: [historyEntry, ...current.history].slice(0, 100) }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setResponse({ status: 0, statusText: 'Request failed', headers: {}, body: message, durationMs: 0, sizeBytes: message.length });
    } finally {
      setIsSending(false);
    }
  };

  const sendStreamMessage = async () => {
    if (!streamSession.current || !streamDraft.trim() || active?.request.protocol !== 'websocket') return;
    const message = streamDraft;
    setStreamDraft('');
    try {
      await sendWebSocketMessage(streamSession.current, message, onStreamEvent);
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      onStreamEvent({ id: uid('event'), direction: 'system', kind: 'error', text, timestamp: new Date().toISOString() });
    }
  };

  const exportWorkspace = useCallback(() => {
    const blob = new Blob([JSON.stringify(workspace, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${workspace.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'brunomnia'}-workspace.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [workspace]);

  const importWorkspace = async (file: File | undefined) => {
    if (!file) return;
    try {
      const imported = parseWorkspaceImport(await file.text());
      setWorkspace(imported);
      setImportError('');
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Unable to import workspace.');
    }
  };

  const updateEnvironment = (environment: Environment) => {
    setWorkspace((current) => ({
      ...current,
      environments: current.environments.map((candidate) => candidate.id === environment.id ? environment : candidate),
    }));
  };

  if (!hydrated || !active || !activeEnvironment) {
    return <main className="loading-screen"><div className="brand-mark"><span /></div><strong>Brunomnia</strong><span>Opening local workspace…</span></main>;
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><div className="brand-mark"><span /></div><strong>Brunomnia</strong></div>
        <button className="workspace-switcher" type="button"><Icon name="archive" size={17} /><span>{workspace.name}</span><Icon name="chevron-down" size={15} /></button>
        <button className="command-trigger" onClick={() => setShowPalette(true)} type="button"><Icon name="search" size={17} /><span>Search or run command…</span><kbd>⌘ K</kbd></button>
        <select aria-label="Environment" className="environment-switcher" onChange={(event) => setWorkspace((current) => ({ ...current, activeEnvironmentId: event.target.value }))} value={workspace.activeEnvironmentId}>
          {workspace.environments.map((environment) => <option key={environment.id} value={environment.id}>{environment.name}</option>)}
        </select>
        <div className="topbar-actions">
          <button aria-label="Edit environment" className="icon-button subtle" onClick={() => setShowEnvironment(true)} type="button"><Icon name="braces" size={18} /></button>
          <button aria-label="Import workspace" className="icon-button subtle" onClick={() => fileInput.current?.click()} type="button"><Icon name="import" size={18} /></button>
          <button aria-label="Export workspace" className="icon-button subtle" onClick={exportWorkspace} type="button"><Icon name="download" size={18} /></button>
        </div>
        <input accept="application/json,.json" className="visually-hidden" onChange={(event) => void importWorkspace(event.target.files?.[0])} ref={fileInput} type="file" />
      </header>

      <div className="app-body">
        <nav className="activity-rail" aria-label="Workspace sections">
          <div>
            <button aria-label="Collections" className={sidebarMode === 'collections' ? 'active' : ''} onClick={() => setSidebarMode('collections')} type="button"><Icon name="archive" /></button>
            <button aria-label="Overview" type="button"><Icon name="grid" /></button>
            <button aria-label="History" className={sidebarMode === 'history' ? 'active' : ''} onClick={() => setSidebarMode('history')} type="button"><Icon name="history" /></button>
            <button aria-label="Scripts" onClick={() => setRequestTab('scripts')} type="button"><Icon name="code" /></button>
            <button aria-label="Data" type="button"><Icon name="database" /></button>
          </div>
          <button aria-label="Environment settings" onClick={() => setShowEnvironment(true)} type="button"><Icon name="settings" /></button>
        </nav>

        <CollectionSidebar
          mode={sidebarMode}
          onAddCollection={addCollection}
          onAddRequest={addRequest}
          onSearch={setSearch}
          onSelectRequest={(id) => setWorkspace((current) => ({ ...current, activeRequestId: id }))}
          onToggleCollection={(id) => setWorkspace((current) => ({ ...current, collections: current.collections.map((collection) => collection.id === id ? { ...collection, expanded: !collection.expanded } : collection) }))}
          search={search}
          workspace={workspace}
        />

        <div className="workbench">
          <RequestPanel
            activeTab={requestTab}
            grpcSchema={grpcSchemas[active.request.id]}
            isSending={isSending}
            onChange={updateActiveRequest}
            onLoadGrpcSchema={() => void loadActiveGrpcSchema()}
            onSend={() => void executeRequest()}
            onTabChange={setRequestTab}
            request={active.request}
            schemaLoading={schemaLoading}
            streamStatus={streamStatus}
          />
          <ResponsePanel
            activeTab={responseTab}
            isSending={isSending}
            onSendStreamMessage={() => void sendStreamMessage()}
            onStreamDraftChange={setStreamDraft}
            onTabChange={setResponseTab}
            protocol={active.request.protocol}
            response={response}
            streamDraft={streamDraft}
            streamMessages={streamMessages}
            streamStatus={streamStatus}
          />
        </div>
      </div>

      <footer className="statusbar">
        <span><i /> Ready</span>
        <span className="status-spacer" />
        <span><i /> Environment: {activeEnvironment.name}</span>
        <span>Local-only</span>
        <span>UTF-8</span>
        <span>{protocolLabel(active.request)}</span>
      </footer>

      {showEnvironment ? <EnvironmentDialog environment={activeEnvironment} onChange={updateEnvironment} onClose={() => setShowEnvironment(false)} /> : null}
      {showPalette ? <CommandPalette onAddCollection={addCollection} onAddRequest={addRequest} onClose={() => setShowPalette(false)} onEnvironment={() => setShowEnvironment(true)} onExport={exportWorkspace} onImport={() => fileInput.current?.click()} /> : null}
      {importError ? <div className="toast" role="alert"><span>{importError}</span><button aria-label="Dismiss" onClick={() => setImportError('')} type="button"><Icon name="x" size={15} /></button></div> : null}
    </main>
  );
}
