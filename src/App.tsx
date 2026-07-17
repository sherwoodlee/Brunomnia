import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, RefObject } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { createBlankRequest } from './data/seed';
import { sendRequest, type SendRequestContext } from './lib/http';
import { storeResponseCookies } from './lib/cookies';
import { connectStream, disconnectStream, invokeGrpc, loadGrpcSchema, sendWebSocketMessage } from './lib/protocol';
import { formatBytes, mockResponse, prettyBody } from './lib/request';
import { loadWorkspace, saveWorkspace } from './lib/storage';
import { environmentMap } from './lib/request';
import { runBrowserScript } from './lib/scriptSandbox';
import type { RunningMock } from './lib/mock';
import { Icon } from './components/Icon';
import { AuthEditor } from './components/AuthEditor';
import { applyArtifactImport } from './lib/interchange/apply';
import type { ArtifactImport } from './lib/interchange/types';
import { writeProject } from './lib/project';
import { applyPluginTheme, createPluginRuntime, describePlugin, type PluginHostCallbacks, type PluginRunState } from './lib/plugins';
import { plaintextSecretCandidates, resolveAuthorizedExternalSecret, vaultVariables, type ExternalSecretInput, type VaultSession } from './lib/security';
import { fetchGraphqlSchema } from './lib/graphql';
import { shortcutMatches } from './lib/preferences';
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
  CookieRecord,
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
  StoredResponse,
  Workspace,
  WorkbenchSection,
} from './types';

const ImportDialog = lazy(() => import('./components/InterchangeDialogs').then((module) => ({ default: module.ImportDialog })));
const ExportDialog = lazy(() => import('./components/InterchangeDialogs').then((module) => ({ default: module.ExportDialog })));
const AutomationWorkbench = lazy(() => import('./components/AutomationWorkbench').then((module) => ({ default: module.AutomationWorkbench })));
const ProjectWorkbench = lazy(() => import('./components/ProjectWorkbench').then((module) => ({ default: module.ProjectWorkbench })));
const PluginWorkbench = lazy(() => import('./components/PluginWorkbench').then((module) => ({ default: module.PluginWorkbench })));
const SecurityWorkbench = lazy(() => import('./components/SecurityWorkbench').then((module) => ({ default: module.SecurityWorkbench })));
const IntegrationWorkbench = lazy(() => import('./components/IntegrationWorkbench').then((module) => ({ default: module.IntegrationWorkbench })));
const PreferencesWorkbench = lazy(() => import('./components/PreferencesWorkbench').then((module) => ({ default: module.PreferencesWorkbench })));

const requestTabs: RequestTab[] = ['params', 'headers', 'auth', 'body', 'transport', 'scripts', 'tests'];
const responseTabs: ResponseTab[] = ['preview', 'headers', 'cookies', 'timeline', 'tests'];
const methods: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS', 'TRACE'];
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

const duplicateRequest = (request: ApiRequest): ApiRequest => {
  const copy = structuredClone(request);
  copy.id = uid('request');
  copy.name = `${request.name} copy`;
  copy.params = copy.params.map((row) => ({ ...row, id: uid('parameter') }));
  copy.headers = copy.headers.map((row) => ({ ...row, id: uid('header') }));
  copy.formBody = copy.formBody.map((row) => ({ ...row, id: uid('form') }));
  copy.multipartBody = copy.multipartBody.map((row) => ({ ...row, id: uid('multipart') }));
  copy.grpc.metadata = copy.grpc.metadata.map((row) => ({ ...row, id: uid('metadata') }));
  return copy;
};

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
  environment: Environment;
  workspaceCookies: CookieRecord[];
  storedResponses: StoredResponse[];
  requestContext: SendRequestContext;
  activeTab: RequestTab;
  isSending: boolean;
  streamStatus: 'disconnected' | 'connecting' | 'connected';
  grpcSchema?: GrpcSchema;
  grpcSchemaLoading: boolean;
  graphqlSchemaLoading: boolean;
  onTabChange: (tab: RequestTab) => void;
  onChange: (patch: Partial<ApiRequest>) => void;
  onSend: () => void;
  onCancelScheduled: () => void;
  onOpenSendOptions: () => void;
  onLoadGrpcSchema: () => void;
  onLoadGraphqlSchema: () => void;
  scheduledSendLabel: string;
  urlInputRef: RefObject<HTMLInputElement | null>;
};

function RequestPanel({
  request,
  activeTab,
  isSending,
  streamStatus,
  grpcSchema,
  grpcSchemaLoading,
  graphqlSchemaLoading,
  onTabChange,
  onChange,
  onSend,
  onCancelScheduled,
  onOpenSendOptions,
  onLoadGrpcSchema,
  onLoadGraphqlSchema,
  scheduledSendLabel,
  urlInputRef,
  environment,
  workspaceCookies,
  storedResponses,
  requestContext,
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
          ref={urlInputRef}
          value={request.url}
        />
        <div className="send-actions"><button className="send-button" disabled={isSending && !scheduledSendLabel} onClick={scheduledSendLabel ? onCancelScheduled : onSend} type="button">{isSending ? <span className="sending-spinner" /> : null}{scheduledSendLabel ? `Stop · ${scheduledSendLabel}` : isSending && !streamProtocol ? 'Working' : actionLabel}</button><button aria-label="Send options" disabled={streamProtocol || request.protocol === 'grpc'} onClick={onOpenSendOptions} type="button"><Icon name="chevron-down" size={13} /></button></div>
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
        {activeTab === 'auth' ? <AuthEditor cookies={workspaceCookies} environment={environment} request={request} requestContext={requestContext} responses={storedResponses} onChange={onChange} /> : null}
        {activeTab === 'body' && request.protocol === 'http' ? <HttpBodyEditor onChange={onChange} request={request} /> : null}
        {activeTab === 'body' && request.protocol === 'graphql' ? <GraphqlEditor onChange={onChange} onLoadSchema={onLoadGraphqlSchema} request={request} schemaLoading={graphqlSchemaLoading} /> : null}
        {activeTab === 'body' && (request.protocol === 'websocket' || request.protocol === 'sse') ? <StreamSetup onChange={onChange} request={request} /> : null}
        {activeTab === 'body' && request.protocol === 'grpc' ? <GrpcEditor onChange={onChange} onLoadSchema={onLoadGrpcSchema} request={request} schema={grpcSchema} schemaLoading={grpcSchemaLoading} /> : null}
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

type ResponsePanelProps = {
  response: HttpResponse;
  protocol: Protocol;
  activeTab: ResponseTab;
  isSending: boolean;
  streamMessages: StreamMessage[];
  streamStatus: 'disconnected' | 'connecting' | 'connected';
  streamDraft: string;
  streamFrameKind: 'text' | 'binary';
  scriptTests: Array<{ name: string; passed: boolean; error?: string }>;
  scriptLogs: string[];
  cookies: CookieRecord[];
  requestUrl: string;
  onChangeCookies: (cookies: CookieRecord[]) => void;
  onTabChange: (tab: ResponseTab) => void;
  onStreamDraftChange: (value: string) => void;
  onStreamFrameKindChange: (value: 'text' | 'binary') => void;
  onSendStreamMessage: () => void;
};

function CookieEditor({ cookies, requestUrl, onChange }: { cookies: CookieRecord[]; requestUrl: string; onChange: (cookies: CookieRecord[]) => void }) {
  const update = (id: string, patch: Partial<CookieRecord>) => onChange(cookies.map((cookie) => cookie.id === id ? { ...cookie, ...patch } : cookie));
  const add = () => {
    let domain = 'localhost';
    try { domain = new URL(requestUrl).hostname || domain; } catch { /* keep local default */ }
    onChange([...cookies, { id: uid('cookie'), name: 'cookie', value: '', domain, path: '/', secure: requestUrl.startsWith('https:'), httpOnly: false, sameSite: '', hostOnly: true, createdAt: new Date().toISOString() }]);
  };
  if (!cookies.length) return <div className="empty-state"><Icon name="archive" size={28} /><strong>No workspace cookies</strong><span>Cookies returned by native requests appear here automatically.</span><button className="secondary-button compact-button" onClick={add} type="button">Add cookie</button></div>;
  return (
    <div className="cookie-manager">
      <header><div><strong>Workspace cookie jar</strong><span>{cookies.length} stored</span></div><button onClick={add} type="button"><Icon name="plus" size={14} /> Add cookie</button></header>
      <div className="cookie-list">{cookies.map((cookie) => <article key={cookie.id}>
        <label>Name<input value={cookie.name} onChange={(event) => update(cookie.id, { name: event.target.value })} /></label>
        <label>Value<input value={cookie.value} onChange={(event) => update(cookie.id, { value: event.target.value })} /></label>
        <label>Domain<input value={cookie.domain} onChange={(event) => update(cookie.id, { domain: event.target.value.toLowerCase() })} /></label>
        <label>Path<input value={cookie.path} onChange={(event) => update(cookie.id, { path: event.target.value || '/' })} /></label>
        <label className="cookie-flag"><input checked={cookie.secure} onChange={(event) => update(cookie.id, { secure: event.target.checked })} type="checkbox" /> Secure</label>
        <label className="cookie-flag"><input checked={cookie.httpOnly} onChange={(event) => update(cookie.id, { httpOnly: event.target.checked })} type="checkbox" /> HTTP only</label>
        <label>SameSite<select value={cookie.sameSite} onChange={(event) => update(cookie.id, { sameSite: event.target.value as CookieRecord['sameSite'] })}><option value="">Unspecified</option><option value="lax">Lax</option><option value="strict">Strict</option><option value="none">None</option></select></label>
        <label>Expires<input type="datetime-local" value={cookie.expires ? cookie.expires.slice(0, 16) : ''} onChange={(event) => update(cookie.id, { expires: event.target.value ? new Date(event.target.value).toISOString() : undefined })} /></label>
        <label className="cookie-flag"><input checked={cookie.hostOnly} onChange={(event) => update(cookie.id, { hostOnly: event.target.checked })} type="checkbox" /> Host only</label>
        <button aria-label={`Delete ${cookie.name}`} className="icon-button subtle" onClick={() => onChange(cookies.filter((candidate) => candidate.id !== cookie.id))} type="button"><Icon name="trash" size={14} /></button>
      </article>)}</div>
    </div>
  );
}

function ResponsePanel({
  response,
  protocol,
  activeTab,
  isSending,
  streamMessages,
  streamStatus,
  streamDraft,
  streamFrameKind,
  scriptTests,
  scriptLogs,
  cookies,
  requestUrl,
  onChangeCookies,
  onTabChange,
  onStreamDraftChange,
  onStreamFrameKindChange,
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
        {responseTabs.map((tab) => <button className={activeTab === tab ? 'active' : ''} key={tab} onClick={() => onTabChange(tab)} type="button">{titleCase(tab)}{tab === 'tests' && scriptTests.length ? <small>{scriptTests.filter((test) => test.passed).length}/{scriptTests.length}</small> : tab === 'cookies' && cookies.length ? <small>{cookies.length}</small> : null}</button>)}
      </nav>
      <div className="response-content">
        {activeTab === 'preview' && streaming ? (
          <StreamConsole connected={streamStatus === 'connected'} draft={streamDraft} frameKind={streamFrameKind} messages={streamMessages} onDraftChange={onStreamDraftChange} onFrameKindChange={onStreamFrameKindChange} onSend={onSendStreamMessage} protocol={protocol} />
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
        {activeTab === 'cookies' ? <CookieEditor cookies={cookies} requestUrl={requestUrl} onChange={onChangeCookies} /> : null}
        {activeTab === 'timeline' ? (
          <div className="timeline">
            <div><span className="timeline-dot" /><strong>Request started</strong><time>0 ms</time></div>
            <div><span className="timeline-dot" /><strong>Response received</strong><time>{response.durationMs} ms</time></div>
            <div><span className="timeline-dot ok" /><strong>Body decoded</strong><time>{response.durationMs} ms</time></div>
          </div>
        ) : null}
        {activeTab === 'tests' ? (
          <div className="test-results">
            <header><strong>{scriptTests.filter((test) => test.passed).length}/{scriptTests.length || 0} passing</strong><span>{scriptLogs.length} console messages</span></header>
            {scriptTests.map((test, index) => <article className={test.passed ? 'passing' : 'failing'} key={`${test.name}-${index}`}><i>{test.passed ? '✓' : '×'}</i><span><strong>{test.name}</strong>{test.error ? <small>{test.error}</small> : null}</span></article>)}
            {scriptLogs.map((log, index) => <pre key={`${log}-${index}`}>{log}</pre>)}
            {!scriptTests.length && !scriptLogs.length ? <div className="empty-state compact"><Icon name="code" size={26} /><strong>No script results</strong><span>Send a request with an after-response script to see assertions here.</span></div> : null}
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
  onDesign: () => void;
  onRunner: () => void;
  onMocks: () => void;
  onPreferences: () => void;
};

function CommandPalette({ onClose, onAddRequest, onAddCollection, onEnvironment, onImport, onExport, onDesign, onRunner, onMocks, onPreferences }: CommandPaletteProps) {
  const actions = [
    { icon: 'plus' as const, label: 'Create request', shortcut: 'N', action: onAddRequest },
    { icon: 'folder' as const, label: 'Create collection', shortcut: '⇧ N', action: onAddCollection },
    { icon: 'braces' as const, label: 'Edit active environment', shortcut: 'E', action: onEnvironment },
    { icon: 'import' as const, label: 'Import artifact', shortcut: 'I', action: onImport },
    { icon: 'download' as const, label: 'Export artifact', shortcut: 'X', action: onExport },
    { icon: 'grid' as const, label: 'Open API design', shortcut: 'D', action: onDesign },
    { icon: 'database' as const, label: 'Open collection runner', shortcut: 'R', action: onRunner },
    { icon: 'spark' as const, label: 'Open local mocks', shortcut: 'M', action: onMocks },
    { icon: 'settings' as const, label: 'Open preferences', shortcut: ',', action: onPreferences },
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
    format: 'brunomnia', version: 9, name: 'Loading…', activeRequestId: '', activeEnvironmentId: '', collections: [], environments: [], history: [], apiDesigns: [], mockServers: [], runnerReports: [], imports: [], cookies: [], responses: [], project: { mode: 'local', path: '', remoteUrl: '', remoteName: 'origin', authorName: '', authorEmail: '', autoSave: true }, plugins: [], pluginData: {}, activePluginTheme: '', collaboration: { mode: 'off', path: '', actor: '', revision: 0 }, governance: { currentMemberId: 'local-owner', members: [{ id: 'local-owner', name: 'Local owner', email: '', role: 'owner', active: true }], policy: { allowedStorage: ['local', 'folder', 'git', 'encrypted-file'], requireEncryptedSync: true, requireVaultForSecrets: true, externalVaultAllowlist: [], auditRetention: 500 }, audit: [] }, mcpClients: [], ai: { enabled: false, provider: 'openai-compatible', baseUrl: 'http://127.0.0.1:11434/v1', model: '', apiKey: '', mockGeneration: false, commitSuggestions: false }, konnect: { enabled: false, baseUrl: 'https://us.api.konghq.com', token: '', controlPlaneId: '', controlPlanes: [] }, preferences: { theme: 'system', density: 'comfortable', fontSize: 13, requestTimeoutMs: 30000, autoFetchGraphqlSchema: true, confirmDestructive: true, shortcuts: { palette: 'Mod+K', preferences: 'Mod+,', send: 'Mod+Enter', environment: 'Mod+E', history: 'Mod+Shift+H', 'toggle-sidebar': 'Mod+\\', 'new-request': 'Mod+N', 'duplicate-request': 'Mod+D', 'delete-request': 'Mod+Shift+Backspace', 'focus-url': 'Mod+L' } },
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
  const [showImport, setShowImport] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showSendOptions, setShowSendOptions] = useState(false);
  const [sendDelayMs, setSendDelayMs] = useState(0);
  const [repeatIntervalMs, setRepeatIntervalMs] = useState(1_000);
  const [scheduledSendLabel, setScheduledSendLabel] = useState('');
  const [sidebarHidden, setSidebarHidden] = useState(false);
  const [streamStatus, setStreamStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [streamMessages, setStreamMessages] = useState<StreamMessage[]>([]);
  const [streamDraft, setStreamDraft] = useState('');
  const [streamFrameKind, setStreamFrameKind] = useState<'text' | 'binary'>('text');
  const [grpcSchemas, setGrpcSchemas] = useState<Record<string, GrpcSchema>>({});
  const [grpcSchemaLoading, setGrpcSchemaLoading] = useState(false);
  const [graphqlSchemaLoading, setGraphqlSchemaLoading] = useState(false);
  const [workbenchSection, setWorkbenchSection] = useState<WorkbenchSection>('requests');
  const [scriptTests, setScriptTests] = useState<Array<{ name: string; passed: boolean; error?: string }>>([]);
  const [scriptLogs, setScriptLogs] = useState<string[]>([]);
  const [runningMocks, setRunningMocks] = useState<Record<string, RunningMock>>({});
  const [projectSyncError, setProjectSyncError] = useState('');
  const [vaultSession, setVaultSession] = useState<VaultSession>({ unlocked: false, passphrase: '', entries: [] });
  const streamSession = useRef<string | undefined>(undefined);
  const streamProtocol = useRef<Protocol | undefined>(undefined);
  const activeRequestIdRef = useRef('');
  const urlInputRef = useRef<HTMLInputElement>(null);
  const scheduledCancelled = useRef(false);
  const scheduledTimer = useRef<number | undefined>(undefined);
  const scheduledResolve = useRef<(() => void) | undefined>(undefined);

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
    if (!workspace.activePluginTheme) { applyPluginTheme(); return; }
    const [pluginId, themeId] = workspace.activePluginTheme.split('::');
    const plugin = workspace.plugins.find((candidate) => candidate.id === pluginId && candidate.enabled && candidate.grantedPermissions.includes('theme'));
    if (!plugin) { applyPluginTheme(); return; }
    let cancelled = false;
    void describePlugin(plugin).then((descriptor) => {
      if (!cancelled) applyPluginTheme(descriptor.themes.find((theme) => theme.id === themeId));
    }).catch(() => { if (!cancelled) applyPluginTheme(); });
    return () => { cancelled = true; };
  }, [workspace.activePluginTheme, workspace.plugins]);

  useEffect(() => {
    if (!hydrated || !isTauri() || workspace.project.mode === 'local' || !workspace.project.path || !workspace.project.autoSave) return;
    const plaintext = workspace.governance.policy.requireVaultForSecrets ? plaintextSecretCandidates(workspace) : [];
    if (plaintext.length) { setProjectSyncError(`Vault policy blocked ${plaintext.length} plaintext secret candidate${plaintext.length === 1 ? '' : 's'}.`); return; }
    const timeout = window.setTimeout(() => {
      void writeProject(workspace.project.path, workspace).then(() => setProjectSyncError('')).catch((caught) => setProjectSyncError(caught instanceof Error ? caught.message : String(caught)));
    }, 700);
    return () => window.clearTimeout(timeout);
  }, [hydrated, workspace]);

  const active = useMemo(() => findRequest(workspace), [workspace]);
  activeRequestIdRef.current = workspace.activeRequestId;
  const activeEnvironment = workspace.environments.find((environment) => environment.id === workspace.activeEnvironmentId);
  const unlockedVault = useMemo(() => vaultVariables(vaultSession), [vaultSession]);
  const externalSecretResolver = useCallback((input: ExternalSecretInput) => resolveAuthorizedExternalSecret(workspace, input), [workspace]);

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
    setScriptTests([]);
    setScriptLogs([]);
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
      request.transport.timeoutMs = current.preferences.requestTimeoutMs;
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
    setWorkbenchSection('requests');
    setRequestTab('params');
  }, []);

  const addCollection = useCallback(() => {
    setWorkspace((current) => ({
      ...current,
      collections: [...current.collections, { id: uid('collection'), name: `Collection ${current.collections.length + 1}`, expanded: true, requests: [] }],
    }));
  }, []);

  const duplicateActiveRequest = () => {
    if (!active) return;
    const copy = duplicateRequest(active.request);
    setWorkspace((current) => ({
      ...current,
      activeRequestId: copy.id,
      collections: current.collections.map((collection) => {
        if (collection.id !== active.collectionId) return collection;
        const index = collection.requests.findIndex((request) => request.id === active.request.id);
        const requests = [...collection.requests];
        requests.splice(index + 1, 0, copy);
        return { ...collection, requests };
      }),
    }));
  };

  const deleteActiveRequest = () => {
    if (!active) return;
    if (workspace.preferences.confirmDestructive && !window.confirm(`Delete request “${active.request.name}”?`)) return;
    setWorkspace((current) => {
      let nextActive = '';
      let collections = current.collections.map((collection) => {
        if (collection.id !== active.collectionId) return collection;
        const index = collection.requests.findIndex((request) => request.id === active.request.id);
        const requests = collection.requests.filter((request) => request.id !== active.request.id);
        nextActive = requests[Math.min(index, requests.length - 1)]?.id ?? '';
        return { ...collection, requests };
      });
      if (!nextActive) nextActive = collections.flatMap((collection) => collection.requests)[0]?.id ?? '';
      if (!nextActive) {
        const request = createBlankRequest(uid('request'));
        request.transport.timeoutMs = current.preferences.requestTimeoutMs;
        if (!collections.length) collections = [{ id: uid('collection'), name: 'Requests', expanded: true, requests: [request] }];
        else collections = collections.map((collection, index) => index === 0 ? { ...collection, requests: [request] } : collection);
        nextActive = request.id;
      }
      return { ...current, activeRequestId: nextActive, collections };
    });
  };

  const loadActiveGrpcSchema = async (): Promise<GrpcSchema | undefined> => {
    if (!active || active.request.protocol !== 'grpc' || grpcSchemaLoading) return grpcSchemas[active?.request.id ?? ''];
    const targetRequest = active.request;
    setGrpcSchemaLoading(true);
    try {
      const schema = await loadGrpcSchema(targetRequest, activeEnvironment);
      const service = schema.services.find((candidate) => candidate.fullName === targetRequest.grpc.service) ?? schema.services[0];
      const method = service?.methods.find((candidate) => candidate.name === targetRequest.grpc.method) ?? service?.methods[0];
      setGrpcSchemas((current) => ({ ...current, [targetRequest.id]: schema }));
      setWorkspace((current) => ({ ...current, collections: current.collections.map((collection) => ({ ...collection, requests: collection.requests.map((request) => request.id === targetRequest.id ? { ...request, grpc: { ...request.grpc, descriptorSetBase64: schema.descriptorSetBase64, service: service?.fullName ?? '', method: method?.name ?? '' } } : request) })) }));
      return schema;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (activeRequestIdRef.current === targetRequest.id) {
        setResponse({ status: 0, statusText: 'Schema failed', headers: {}, body: message, durationMs: 0, sizeBytes: message.length });
        setResponseTab('preview');
      }
      return undefined;
    } finally {
      setGrpcSchemaLoading(false);
    }
  };

  const loadActiveGraphqlSchema = async () => {
    if (!active || !activeEnvironment || active.request.protocol !== 'graphql' || graphqlSchemaLoading) return;
    const targetRequest = active.request;
    setGraphqlSchemaLoading(true);
    try {
      const schema = await fetchGraphqlSchema(targetRequest, activeEnvironment, { cookies: workspace.cookies, responses: workspace.responses, vault: unlockedVault, externalSecret: externalSecretResolver });
      setWorkspace((current) => ({ ...current, collections: current.collections.map((collection) => ({ ...collection, requests: collection.requests.map((request) => request.id === targetRequest.id ? { ...request, graphql: { ...request.graphql, schema, schemaEndpoint: targetRequest.url, schemaFetchedAt: new Date().toISOString() } } : request) })) }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (activeRequestIdRef.current === targetRequest.id) {
        setResponse({ status: 0, statusText: 'Schema failed', headers: {}, body: message, durationMs: 0, sizeBytes: message.length });
        setResponseTab('preview');
      }
    } finally {
      setGraphqlSchemaLoading(false);
    }
  };

  useEffect(() => {
    if (!hydrated || !workspace.preferences.autoFetchGraphqlSchema || active?.request.protocol !== 'graphql' || !activeEnvironment || graphqlSchemaLoading) return;
    if (!active.request.url.trim() || active.request.graphql.schemaEndpoint === active.request.url) return;
    const timeout = window.setTimeout(() => void loadActiveGraphqlSchema(), 800);
    return () => window.clearTimeout(timeout);
  }, [active?.request.id, active?.request.protocol, active?.request.url, active?.request.graphql.schemaEndpoint, activeEnvironment?.id, graphqlSchemaLoading, hydrated, workspace.preferences.autoFetchGraphqlSchema]);

  const onStreamEvent = (message: StreamMessage) => {
    setStreamMessages((current) => [...current, { ...message, id: message.id || uid('event') }].slice(-500));
    if (message.kind === 'open') setStreamStatus('connected');
    if (message.kind === 'closed' || message.kind === 'close' || message.kind === 'error') setStreamStatus('disconnected');
  };

  const persistScriptEnvironment = (variables: Record<string, string>) => {
    if (!activeEnvironment) return;
    setWorkspace((current) => ({
      ...current,
      environments: current.environments.map((environment) => environment.id === activeEnvironment.id ? {
        ...environment,
        variables: Object.entries(variables).map(([name, value]) => ({
          id: environment.variables.find((candidate) => candidate.name === name)?.id ?? uid('variable'),
          name, value, enabled: true,
        })),
      } : environment),
    }));
  };

  const executeRequest = async () => {
    if (!active || !activeEnvironment || isSending) return;
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
        await connectStream(active.request, { ...activeEnvironment, variables: [...activeEnvironment.variables, ...Object.entries(unlockedVault).map(([name, value]) => ({ id: `vault-${name}`, name, value, enabled: true }))] }, sessionId, onStreamEvent);
        setStreamStatus('connected');
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        onStreamEvent({ id: uid('event'), direction: 'system', kind: 'error', text: message, timestamp: new Date().toISOString() });
      }
      return;
    }

    setIsSending(true);
    setResponseTab('preview');
    setScriptTests([]);
    setScriptLogs([]);
    const pluginState: PluginRunState = { data: structuredClone(workspace.pluginData), notifications: [] };
    const pluginCallbacks: PluginHostCallbacks = {
      network: (pluginRequest) => sendRequest(pluginRequest, activeEnvironment, { cookies: workspace.cookies, responses: workspace.responses }),
      prompt: async (title, defaultValue) => window.prompt(title, defaultValue) ?? '',
      readClipboard: () => navigator.clipboard.readText(),
      writeClipboard: (value) => navigator.clipboard.writeText(value),
    };
    const pluginRuntime = createPluginRuntime(workspace.plugins, pluginState, pluginCallbacks);
    try {
      let variables = environmentMap(activeEnvironment);
      const preRequest = await runBrowserScript(active.request.preRequestScript, active.request, variables);
      let executableRequest = preRequest.request;
      variables = preRequest.environment;
      const requestVariables = { ...variables, ...(preRequest.localVariables ?? {}) };
      setScriptLogs(preRequest.logs);
      let result: HttpResponse;
      if (executableRequest.protocol === 'grpc') {
        executableRequest = await pluginRuntime.beforeRequest(executableRequest);
        const existingSchema = executableRequest.grpc.descriptorSetBase64 ? grpcSchemas[active.request.id] : undefined;
        const schema = existingSchema ?? await loadActiveGrpcSchema();
        if (!schema) return;
        const service = schema.services.find((candidate) => candidate.fullName === executableRequest.grpc.service) ?? schema.services[0];
        const method = service?.methods.find((candidate) => candidate.name === executableRequest.grpc.method) ?? service?.methods[0];
        if (!service || !method) throw new Error('Load a gRPC service and method before invoking.');
        const callRequest: ApiRequest = {
          ...executableRequest,
          grpc: {
            ...executableRequest.grpc,
            descriptorSetBase64: schema.descriptorSetBase64,
            service: service.fullName,
            method: method.name,
          },
        };
        const output = await invokeGrpc(callRequest, {
          ...activeEnvironment,
          variables: Object.entries({ ...requestVariables, ...unlockedVault }).map(([name, value]) => ({ id: `script-${name}`, name, value, enabled: true })),
        });
        const body = JSON.stringify({ status: output.status, callType: output.callType, messages: output.messages }, null, 2);
        result = await pluginRuntime.afterResponse(executableRequest, { status: 200, statusText: `gRPC ${output.status}`, headers: { 'grpc-call-type': output.callType }, body, durationMs: output.durationMs, sizeBytes: new Blob([body]).size });
      } else {
        result = await sendRequest(executableRequest, {
          ...activeEnvironment,
          variables: Object.entries(requestVariables).map(([name, value]) => ({ id: `script-${name}`, name, value, enabled: true })),
        }, { cookies: workspace.cookies, responses: workspace.responses, pluginRuntime, vault: unlockedVault, externalSecret: externalSecretResolver });
      }
      const afterResponse = await runBrowserScript(executableRequest.tests, executableRequest, variables, result, 2000, preRequest.localVariables);
      setScriptTests(afterResponse.tests);
      setScriptLogs((current) => [...current, ...afterResponse.logs, ...pluginState.notifications.map((notification) => `[plugin] ${notification.title}: ${notification.message}`)]);
      persistScriptEnvironment(afterResponse.environment);
      setResponse(result);
      const historyEntry: HistoryEntry = {
        id: uid('history'), requestId: active.request.id, name: active.request.name, method: active.request.method,
        url: active.request.url, status: result.status, durationMs: result.durationMs, createdAt: new Date().toISOString(),
      };
      const storedResponse: StoredResponse = {
        ...result,
        requestId: active.request.id,
        requestName: active.request.name,
        requestUrl: result.requestUrl ?? executableRequest.url,
        receivedAt: new Date().toISOString(),
      };
      setWorkspace((current) => ({
        ...current,
        history: [historyEntry, ...current.history].slice(0, 100),
        responses: [storedResponse, ...current.responses.filter((candidate) => candidate.requestId !== active.request.id)].slice(0, 100),
        cookies: executableRequest.transport.storeCookies
          ? storeResponseCookies(current.cookies, storedResponse.requestUrl, result.setCookies ?? [])
          : current.cookies,
        pluginData: pluginState.data,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setResponse({ status: 0, statusText: 'Request failed', headers: {}, body: message, durationMs: 0, sizeBytes: message.length });
      setScriptLogs((current) => [...current, ...pluginState.notifications.map((notification) => `[plugin] ${notification.title}: ${notification.message}`)]);
      setWorkspace((current) => ({ ...current, pluginData: pluginState.data }));
    } finally {
      setIsSending(false);
    }
  };

  const cancelScheduledSends = () => {
    scheduledCancelled.current = true;
    if (scheduledTimer.current !== undefined) window.clearTimeout(scheduledTimer.current);
    scheduledTimer.current = undefined;
    scheduledResolve.current?.();
    scheduledResolve.current = undefined;
    setScheduledSendLabel('');
  };

  const waitForScheduledSend = (milliseconds: number) => new Promise<void>((resolve) => {
    scheduledResolve.current = resolve;
    scheduledTimer.current = window.setTimeout(() => {
      scheduledTimer.current = undefined;
      scheduledResolve.current = undefined;
      resolve();
    }, milliseconds);
  });

  const startScheduledSends = (repeat: boolean) => {
    cancelScheduledSends();
    scheduledCancelled.current = false;
    setShowSendOptions(false);
    void (async () => {
      try {
        if (sendDelayMs > 0) {
          setScheduledSendLabel(`Waiting ${Math.round(sendDelayMs / 1000)}s`);
          await waitForScheduledSend(sendDelayMs);
        }
        let run = 0;
        while (!scheduledCancelled.current && run < (repeat ? 1_000 : 1)) {
          run += 1;
          setScheduledSendLabel(repeat ? `Repeat ${run}` : 'Sending');
          await executeRequest();
          if (!repeat || scheduledCancelled.current) break;
          setScheduledSendLabel(`Next in ${Math.round(repeatIntervalMs / 1000)}s`);
          await waitForScheduledSend(repeatIntervalMs);
        }
      } finally {
        scheduledTimer.current = undefined;
        scheduledResolve.current = undefined;
        setScheduledSendLabel('');
      }
    })();
  };

  useEffect(() => () => {
    scheduledCancelled.current = true;
    if (scheduledTimer.current !== undefined) window.clearTimeout(scheduledTimer.current);
    scheduledResolve.current?.();
  }, []);

  const sendStreamMessage = async () => {
    if (!streamSession.current || !streamDraft.trim() || active?.request.protocol !== 'websocket') return;
    const message = streamDraft;
    setStreamDraft('');
    try {
      await sendWebSocketMessage(streamSession.current, message, streamFrameKind, onStreamEvent);
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      onStreamEvent({ id: uid('event'), direction: 'system', kind: 'error', text, timestamp: new Date().toISOString() });
    }
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowPalette(false);
        setShowEnvironment(false);
        setShowSendOptions(false);
        return;
      }
      if (event.repeat) return;
      const target = event.target as HTMLElement | null;
      const editing = target?.matches('input, textarea, select, [contenteditable="true"]') === true;
      if (editing && !(event.metaKey || event.ctrlKey || event.altKey)) return;
      const shortcuts = workspace.preferences.shortcuts;
      const action = (callback: () => void) => { event.preventDefault(); callback(); };
      if (shortcutMatches(event, shortcuts.palette)) action(() => setShowPalette((visible) => !visible));
      else if (shortcutMatches(event, shortcuts.preferences)) action(() => setWorkbenchSection('preferences'));
      else if (shortcutMatches(event, shortcuts.send)) action(() => { if (scheduledSendLabel) cancelScheduledSends(); else if (!isSending) void executeRequest(); });
      else if (shortcutMatches(event, shortcuts.environment)) action(() => setShowEnvironment(true));
      else if (shortcutMatches(event, shortcuts.history)) action(() => { setWorkbenchSection('requests'); setSidebarMode('history'); setSidebarHidden(false); });
      else if (shortcutMatches(event, shortcuts['toggle-sidebar'])) action(() => setSidebarHidden((hidden) => !hidden));
      else if (shortcutMatches(event, shortcuts['new-request'])) action(addRequest);
      else if (shortcutMatches(event, shortcuts['duplicate-request'])) action(duplicateActiveRequest);
      else if (shortcutMatches(event, shortcuts['delete-request'])) action(deleteActiveRequest);
      else if (shortcutMatches(event, shortcuts['focus-url'])) action(() => { setWorkbenchSection('requests'); urlInputRef.current?.focus(); urlInputRef.current?.select(); });
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [active, isSending, scheduledSendLabel, workspace]);

  const applyImport = (result: ArtifactImport) => {
    setWorkspace((current) => applyArtifactImport(current, result));
    setWorkbenchSection('requests');
    setSidebarMode('collections');
  };

  const fetchImportUrl = async (url: string) => {
    if (!url.trim()) throw new Error('Enter an artifact URL.');
    let parsedUrl: URL;
    try { parsedUrl = new URL(url.trim()); } catch { throw new Error('Enter a valid artifact URL.'); }
    if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') throw new Error('Artifact URLs must use HTTP or HTTPS.');
    const request = createBlankRequest(uid('import-url'));
    request.name = 'Import artifact';
    request.url = url.trim();
    request.method = 'GET';
    request.bodyMode = 'none';
    request.preRequestScript = '';
    request.tests = '';
    const result = await sendRequest(request, activeEnvironment, { cookies: workspace.cookies, responses: workspace.responses });
    if (result.status < 200 || result.status >= 300) throw new Error(`Import URL returned ${result.status} ${result.statusText}.`);
    if (result.sizeBytes > 20_000_000) throw new Error('The import exceeds the 20 MB local conversion limit.');
    return result.body;
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
    <main className="app-shell" data-density={workspace.preferences.density} data-theme={workspace.activePluginTheme ? 'plugin' : workspace.preferences.theme} style={{ '--editor-font-size': `${workspace.preferences.fontSize}px` } as CSSProperties}>
      <header className="topbar">
        <div className="brand"><div className="brand-mark"><span /></div><strong>Brunomnia</strong></div>
        <button className="workspace-switcher" type="button"><Icon name="archive" size={17} /><span>{workspace.name}</span><Icon name="chevron-down" size={15} /></button>
        <button className="command-trigger" onClick={() => setShowPalette(true)} type="button"><Icon name="search" size={17} /><span>Search or run command…</span><kbd>{workspace.preferences.shortcuts.palette.replace('Mod', '⌘/Ctrl')}</kbd></button>
        <select aria-label="Environment" className="environment-switcher" onChange={(event) => setWorkspace((current) => ({ ...current, activeEnvironmentId: event.target.value }))} value={workspace.activeEnvironmentId}>
          {workspace.environments.map((environment) => <option key={environment.id} value={environment.id}>{environment.name}</option>)}
        </select>
        <div className="topbar-actions">
          <button aria-label="Edit environment" className="icon-button subtle" onClick={() => setShowEnvironment(true)} type="button"><Icon name="braces" size={18} /></button>
          <button aria-label="Import artifacts" className="icon-button subtle" onClick={() => setShowImport(true)} type="button"><Icon name="import" size={18} /></button>
          <button aria-label="Export artifacts" className="icon-button subtle" onClick={() => setShowExport(true)} type="button"><Icon name="download" size={18} /></button>
        </div>
      </header>

      <div className={`app-body${sidebarHidden ? ' sidebar-hidden' : ''}`}>
        <nav className="activity-rail" aria-label="Workspace sections">
          <div>
            <button aria-label="Collections" className={workbenchSection === 'requests' && sidebarMode === 'collections' ? 'active' : ''} onClick={() => { setWorkbenchSection('requests'); setSidebarMode('collections'); }} type="button"><Icon name="archive" /></button>
            <button aria-label="API Design" className={workbenchSection === 'design' ? 'active' : ''} onClick={() => setWorkbenchSection('design')} type="button"><Icon name="grid" /></button>
            <button aria-label="History" className={workbenchSection === 'requests' && sidebarMode === 'history' ? 'active' : ''} onClick={() => { setWorkbenchSection('requests'); setSidebarMode('history'); }} type="button"><Icon name="history" /></button>
            <button aria-label="Scripts" onClick={() => { setWorkbenchSection('requests'); setRequestTab('scripts'); }} type="button"><Icon name="code" /></button>
            <button aria-label="Collection Runner" className={workbenchSection === 'runner' ? 'active' : ''} onClick={() => setWorkbenchSection('runner')} type="button"><Icon name="database" /></button>
            <button aria-label="Mock servers" className={workbenchSection === 'mocks' ? 'active' : ''} onClick={() => setWorkbenchSection('mocks')} type="button"><Icon name="spark" /></button>
            <button aria-label="Git Sync" className={workbenchSection === 'git' ? 'active' : ''} onClick={() => setWorkbenchSection('git')} type="button"><Icon name="code" /></button>
            <button aria-label="Plugins" className={workbenchSection === 'plugins' ? 'active' : ''} onClick={() => setWorkbenchSection('plugins')} type="button"><Icon name="braces" /></button>
            <button aria-label="Security & Sync" className={workbenchSection === 'security' ? 'active' : ''} onClick={() => setWorkbenchSection('security')} type="button"><Icon name="lock" /></button>
            <button aria-label="MCP, AI, and Konnect" className={workbenchSection === 'integrations' ? 'active' : ''} onClick={() => setWorkbenchSection('integrations')} type="button"><Icon name="globe" /></button>
          </div>
          <button aria-label="Preferences" className={workbenchSection === 'preferences' ? 'active' : ''} onClick={() => setWorkbenchSection('preferences')} type="button"><Icon name="settings" /></button>
        </nav>

        {workbenchSection === 'requests' && !sidebarHidden ? <CollectionSidebar
          mode={sidebarMode}
          onAddCollection={addCollection}
          onAddRequest={addRequest}
          onSearch={setSearch}
          onSelectRequest={(id) => setWorkspace((current) => ({ ...current, activeRequestId: id }))}
          onToggleCollection={(id) => setWorkspace((current) => ({ ...current, collections: current.collections.map((collection) => collection.id === id ? { ...collection, expanded: !collection.expanded } : collection) }))}
          search={search}
          workspace={workspace}
        /> : null}

        {workbenchSection === 'requests' ? <div className="workbench">
          <RequestPanel
            activeTab={requestTab}
            environment={activeEnvironment}
            grpcSchema={grpcSchemas[active.request.id]}
            graphqlSchemaLoading={graphqlSchemaLoading}
            grpcSchemaLoading={grpcSchemaLoading}
            isSending={isSending}
            onChange={updateActiveRequest}
            onCancelScheduled={cancelScheduledSends}
            onLoadGraphqlSchema={() => void loadActiveGraphqlSchema()}
            onLoadGrpcSchema={() => void loadActiveGrpcSchema()}
            onOpenSendOptions={() => setShowSendOptions(true)}
            onSend={() => void executeRequest()}
            onTabChange={setRequestTab}
            request={active.request}
            requestContext={{ vault: unlockedVault, externalSecret: externalSecretResolver }}
            scheduledSendLabel={scheduledSendLabel}
            storedResponses={workspace.responses}
            streamStatus={streamStatus}
            urlInputRef={urlInputRef}
            workspaceCookies={workspace.cookies}
          />
          <ResponsePanel
            activeTab={responseTab}
            cookies={workspace.cookies}
            isSending={isSending}
            onSendStreamMessage={() => void sendStreamMessage()}
            onChangeCookies={(cookies) => setWorkspace((current) => ({ ...current, cookies }))}
            onStreamDraftChange={setStreamDraft}
            onStreamFrameKindChange={setStreamFrameKind}
            onTabChange={setResponseTab}
            protocol={active.request.protocol}
            response={response}
            requestUrl={response.requestUrl ?? active.request.url}
            scriptLogs={scriptLogs}
            scriptTests={scriptTests}
            streamDraft={streamDraft}
            streamFrameKind={streamFrameKind}
            streamMessages={streamMessages}
            streamStatus={streamStatus}
          />
        </div> : workbenchSection === 'git' ? <Suspense fallback={<div className="dialog-loading">Loading Git project…</div>}><ProjectWorkbench environment={activeEnvironment} onChangeWorkspace={(updater) => setWorkspace(updater)} requestContext={{ vault: unlockedVault, externalSecret: externalSecretResolver }} workspace={workspace} /></Suspense> : workbenchSection === 'plugins' ? <Suspense fallback={<div className="dialog-loading">Loading plugins…</div>}><PluginWorkbench onChangeWorkspace={(updater) => setWorkspace(updater)} workspace={workspace} /></Suspense> : workbenchSection === 'security' ? <Suspense fallback={<div className="dialog-loading">Loading security…</div>}><SecurityWorkbench onChangeWorkspace={(updater) => setWorkspace(updater)} onVaultSession={setVaultSession} vaultSession={vaultSession} workspace={workspace} /></Suspense> : workbenchSection === 'integrations' ? <Suspense fallback={<div className="dialog-loading">Loading integrations…</div>}><IntegrationWorkbench environment={activeEnvironment} onChangeWorkspace={(updater) => setWorkspace(updater)} requestContext={{ vault: unlockedVault, externalSecret: externalSecretResolver }} workspace={workspace} /></Suspense> : workbenchSection === 'preferences' ? <Suspense fallback={<div className="dialog-loading">Loading preferences…</div>}><PreferencesWorkbench onChangeWorkspace={(updater) => setWorkspace(updater)} workspace={workspace} /></Suspense> : (
          <Suspense fallback={<div className="dialog-loading">Loading automation…</div>}><AutomationWorkbench
            activeEnvironment={activeEnvironment}
            onChangeWorkspace={(updater) => setWorkspace(updater)}
            onOpenCollection={(collection) => {
              setWorkbenchSection('requests');
              setSidebarMode('collections');
              if (collection.requests[0]) setWorkspace((current) => ({ ...current, activeRequestId: collection.requests[0].id }));
            }}
            onStartMock={(serverId, runningMock) => setRunningMocks((current) => ({ ...current, [serverId]: runningMock }))}
            onStopMock={(serverId) => setRunningMocks((current) => {
              const next = { ...current };
              delete next[serverId];
              return next;
            })}
            runningMocks={runningMocks}
            section={workbenchSection}
            vault={unlockedVault}
            workspace={workspace}
          /></Suspense>
        )}
      </div>

      <footer className="statusbar">
        <span><i /> Ready</span>
        <span className="status-spacer" />
        <span><i /> Environment: {activeEnvironment.name}</span>
        {projectSyncError ? <span className="bad">Project save failed: {projectSyncError}</span> : null}
        <span>{vaultSession.unlocked ? `Vault: ${vaultSession.entries.length} unlocked` : 'Vault: locked'}</span>
        <span>Local-only</span>
        <span>UTF-8</span>
        <span>{workbenchSection === 'requests' ? protocolLabel(active.request) : titleCase(workbenchSection)}</span>
      </footer>

      {showEnvironment ? <EnvironmentDialog environment={activeEnvironment} onChange={updateEnvironment} onClose={() => setShowEnvironment(false)} /> : null}
      {showSendOptions ? <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowSendOptions(false)}>
        <section aria-labelledby="send-options-title" aria-modal="true" className="modal send-options-modal" onMouseDown={(event) => event.stopPropagation()} role="dialog">
          <header><div><small>Request scheduling</small><h2 id="send-options-title">Send options</h2></div><button aria-label="Close" className="icon-button subtle" onClick={() => setShowSendOptions(false)} type="button"><Icon name="x" /></button></header>
          <div className="send-options-fields">
            <label>Initial delay (ms)<input max="600000" min="0" onChange={(event) => setSendDelayMs(Math.min(600_000, Math.max(0, Number(event.target.value) || 0)))} type="number" value={sendDelayMs} /><small>Wait once before the first request.</small></label>
            <label>Repeat interval (ms)<input max="600000" min="100" onChange={(event) => setRepeatIntervalMs(Math.min(600_000, Math.max(100, Number(event.target.value) || 100)))} type="number" value={repeatIntervalMs} /><small>Wait between completed requests.</small></label>
          </div>
          <p>Repeats run sequentially and stop after 1,000 sends as a local safety bound. Stopping cancels future sends; a request already in flight completes normally.</p>
          <footer><button className="modal-cancel" onClick={() => setShowSendOptions(false)} type="button">Cancel</button><button className="secondary-button" disabled={isSending} onClick={() => startScheduledSends(false)} type="button">Send once</button><button className="primary-button" disabled={isSending} onClick={() => startScheduledSends(true)} type="button">Repeat until stopped</button></footer>
        </section>
      </div> : null}
      {showImport ? <Suspense fallback={<div className="modal-backdrop"><div className="dialog-loading">Loading import tools…</div></div>}><ImportDialog onApply={applyImport} onClose={() => setShowImport(false)} onFetchUrl={fetchImportUrl} /></Suspense> : null}
      {showExport ? <Suspense fallback={<div className="modal-backdrop"><div className="dialog-loading">Loading export tools…</div></div>}><ExportDialog onClose={() => setShowExport(false)} workspace={workspace} /></Suspense> : null}
      {showPalette ? <CommandPalette onAddCollection={addCollection} onAddRequest={addRequest} onClose={() => setShowPalette(false)} onDesign={() => setWorkbenchSection('design')} onEnvironment={() => setShowEnvironment(true)} onExport={() => setShowExport(true)} onImport={() => setShowImport(true)} onMocks={() => setWorkbenchSection('mocks')} onPreferences={() => setWorkbenchSection('preferences')} onRunner={() => setWorkbenchSection('runner')} /> : null}
    </main>
  );
}
