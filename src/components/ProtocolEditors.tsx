import { lazy, Suspense, useMemo, useRef, useState } from 'react';
import type {
  ApiRequest,
  BodyMode,
} from '../types';
import { graphqlTypeLabel, insertGraphqlRootField, validateGraphqlDocument } from '../lib/graphql';
import { prettyRequestBody } from '../lib/request';
import { applyEditorTab } from '../lib/editorText';
import { Icon } from './Icon';

type ChangeRequest = (patch: Partial<ApiRequest>) => void;

type CodeEditorProps = {
  ariaLabel: string;
  value: string;
  onChange: (value: string) => void;
};

export function CodeEditor({ ariaLabel, value, onChange }: CodeEditorProps) {
  const gutter = useRef<HTMLDivElement>(null);
  const lines = value.split('\n');
  return (
    <div className="editable-code-surface">
      <div aria-hidden="true" className="code-gutter" ref={gutter}>
        {lines.map((_, index) => <span key={index}>{index + 1}</span>)}
      </div>
      <textarea
        aria-label={ariaLabel}
        className="code-editor"
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== 'Tab' || event.metaKey || event.ctrlKey || event.altKey) return;
          event.preventDefault();
          const shell = event.currentTarget.closest<HTMLElement>('.app-shell');
          const result = applyEditorTab(
            value,
            event.currentTarget.selectionStart,
            event.currentTarget.selectionEnd,
            shell?.dataset.editorIndentWithTabs !== 'false',
            Number(shell?.dataset.editorIndentSize ?? 2),
            event.shiftKey,
          );
          const target = event.currentTarget;
          onChange(result.value);
          requestAnimationFrame(() => target.setSelectionRange(result.selectionStart, result.selectionEnd));
        }}
        onScroll={(event) => {
          if (gutter.current) gutter.current.scrollTop = event.currentTarget.scrollTop;
        }}
        spellCheck={false}
        value={value}
      />
    </div>
  );
}

const modes: { value: BodyMode; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'json', label: 'JSON' },
  { value: 'text', label: 'Text' },
  { value: 'form-urlencoded', label: 'Form URL encoded' },
  { value: 'multipart', label: 'Multipart' },
  { value: 'binary', label: 'Binary' },
];

const MultipartEditor = lazy(() => import('./MultipartEditor'));
const FormBodyEditor = lazy(() => import('./MultipartEditor').then((module) => ({ default: module.FormBodyEditor })));

export function HttpBodyEditor({ request, onChange }: { request: ApiRequest; onChange: ChangeRequest }) {
  return (
    <div className="editor-stack body-editor">
      <div className="editor-toolbar body-mode-toolbar">
        <div role="tablist" aria-label="HTTP body type">
          {modes.map((mode) => (
            <button
              aria-selected={request.bodyMode === mode.value}
              className={request.bodyMode === mode.value ? 'active' : ''}
              key={mode.value}
              onClick={() => onChange({ bodyMode: mode.value })}
              role="tab"
              type="button"
            >
              {mode.label}
            </button>
          ))}
        </div>
        <div className="body-toolbar-actions">
          <label className="inline-toggle"><input checked={request.renderBodyTemplates !== false} onChange={(event) => onChange({ renderBodyTemplates: event.target.checked })} type="checkbox" /> Render body templates</label>
          {request.bodyMode === 'json' || request.bodyMode === 'text' ? <button onClick={() => onChange({ body: prettyRequestBody(request) })} type="button">Beautify</button> : null}
          <small>{request.bodyMode === 'none' ? 'No payload' : 'Native request body'}</small>
        </div>
      </div>
      {request.bodyMode === 'none' ? (
        <div className="empty-state compact"><Icon name="archive" size={26} /><strong>This request has no body</strong></div>
      ) : null}
      {request.bodyMode === 'json' || request.bodyMode === 'text' ? (
        <CodeEditor ariaLabel="Request body" onChange={(body) => onChange({ body })} value={request.body} />
      ) : null}
      {request.bodyMode === 'form-urlencoded' ? (
        <Suspense fallback={<div className="dialog-loading">Loading form editor…</div>}><FormBodyEditor onChange={(formBody) => onChange({ formBody })} rows={request.formBody} /></Suspense>
      ) : null}
      {request.bodyMode === 'multipart' ? (
        <Suspense fallback={<div className="dialog-loading">Loading multipart editor…</div>}><MultipartEditor onChange={(multipartBody) => onChange({ multipartBody })} parts={request.multipartBody} /></Suspense>
      ) : null}
      {request.bodyMode === 'binary' ? (
        <div className="binary-dropzone">
          <Icon name="import" size={25} />
          <strong>{request.binaryBody?.fileName ?? 'Choose a binary payload'}</strong>
          <span>{request.binaryBody ? `${request.binaryBody.mimeType} · ${Math.round(request.binaryBody.dataBase64.length * .75)} bytes` : 'The selected file remains in this local workspace.'}</span>
          <label>Choose file<input type="file" onChange={(event) => { const file = event.target.files?.[0]; if (file) void import('./MultipartEditor').then(({ filePayload }) => filePayload(file)).then((binaryBody) => onChange({ binaryBody })); }} /></label>
        </div>
      ) : null}
    </div>
  );
}

export function GraphqlEditor({ request, onChange, schemaLoading, onLoadSchema }: { request: ApiRequest; onChange: ChangeRequest; schemaLoading: boolean; onLoadSchema: () => void }) {
  const graphql = request.graphql;
  const [showSchema, setShowSchema] = useState(true);
  const [filter, setFilter] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const schema = graphql.schema;
  const issues = useMemo(() => validateGraphqlDocument(graphql.query, graphql.variables, schema), [graphql.query, graphql.variables, schema]);
  const operation = /^\s*(mutation|subscription)\b/.exec(graphql.query)?.[1] as 'mutation' | 'subscription' | undefined ?? 'query';
  const rootName = operation === 'mutation' ? schema?.mutationType : operation === 'subscription' ? schema?.subscriptionType : schema?.queryType;
  const root = schema?.types.find((type) => type.name === rootName);
  const fields = root?.fields.filter((field) => `${field.name} ${field.description}`.toLowerCase().includes(filter.toLowerCase())).slice(0, 500) ?? [];
  const documented = schema?.types.find((type) => type.name === selectedType) ?? root;
  const stale = Boolean(schema && graphql.schemaEndpoint !== request.url);
  return (
    <div className="graphql-editor">
      <div className="graphql-schema-bar"><div><strong>Schema</strong><span>{schema ? `${schema.types.length} types${stale ? ' · endpoint changed' : ''}` : 'Not loaded'}</span></div><button disabled={schemaLoading} onClick={onLoadSchema} type="button">{schemaLoading ? 'Introspecting…' : schema ? 'Refresh schema' : 'Fetch schema'}</button><button disabled={!schema} onClick={() => setShowSchema((value) => !value)} type="button">{showSchema ? 'Hide docs' : 'Show docs'}</button></div>
      <div className={`graphql-workspace${showSchema && schema ? ' with-schema' : ''}`}>
        <div className="graphql-compose">
          <section>
            <header><strong>Operation</strong><input aria-label="GraphQL operation name" value={graphql.operationName} onChange={(event) => onChange({ graphql: { ...graphql, operationName: event.target.value } })} placeholder="Operation name" /></header>
            <CodeEditor ariaLabel="GraphQL query" value={graphql.query} onChange={(query) => onChange({ graphql: { ...graphql, query } })} />
          </section>
          <section>
            <header><strong>Variables</strong><small>JSON</small></header>
            <CodeEditor ariaLabel="GraphQL variables" value={graphql.variables} onChange={(variables) => onChange({ graphql: { ...graphql, variables } })} />
          </section>
          <div className="graphql-issues" aria-live="polite">{issues.map((issue, index) => <span className={issue.severity} key={`${issue.message}-${index}`}><Icon name={issue.severity === 'error' ? 'x' : 'spark'} size={12} />{issue.message}</span>)}{!issues.length ? <span className="valid"><Icon name="check" size={12} />Document is structurally valid against cached root fields.</span> : null}</div>
        </div>
        {showSchema && schema ? <aside className="graphql-explorer"><header><div><small>{operation} root</small><strong>{rootName || 'Unavailable'}</strong></div><input aria-label="Filter GraphQL fields" placeholder="Filter fields…" value={filter} onChange={(event) => setFilter(event.target.value)} /></header><div className="graphql-field-list">{fields.map((field) => <article className={field.isDeprecated ? 'deprecated' : ''} key={field.name}><button aria-label={`Insert ${field.name}`} onClick={() => onChange({ graphql: { ...graphql, query: insertGraphqlRootField(graphql.query, operation, field, schema) } })} type="button"><Icon name="plus" size={12} /></button><button onClick={() => { let type = field.type; while (type.ofType) type = type.ofType; setSelectedType(type.name); }} type="button"><strong>{field.name}</strong><code>{graphqlTypeLabel(field.type)}</code><small>{field.description || field.deprecationReason || 'No description'}</small></button></article>)}{!fields.length ? <p>No matching root fields.</p> : null}</div>{documented ? <div className="graphql-type-doc"><header><small>{documented.kind}</small><strong>{documented.name}</strong></header><p>{documented.description || 'No type description.'}</p>{documented.fields.slice(0, 200).map((field) => <button key={field.name} onClick={() => { let type = field.type; while (type.ofType) type = type.ofType; setSelectedType(type.name); }} type="button"><span>{field.name}</span><code>{graphqlTypeLabel(field.type)}</code>{field.args.length ? <small>({field.args.map((argument) => `${argument.name}: ${graphqlTypeLabel(argument.type)}`).join(', ')})</small> : null}</button>)}</div> : null}</aside> : null}
      </div>
    </div>
  );
}

export function StreamSetup({ request, onChange }: { request: ApiRequest; onChange: ChangeRequest }) {
  const protocol = request.protocol;
  const sse = request.sse ?? { autoReconnect: true, reconnectDelayMs: 1000, maxReconnects: 0, respectServerRetry: true, sendLastEventId: true };
  const updateSse = (patch: Partial<ApiRequest['sse']>) => onChange({ sse: { ...sse, ...patch } });
  return (
    <div className="stream-setup">
      <div className="empty-state compact"><span className={`protocol-glyph ${protocol}`}>{protocol === 'websocket' ? 'WS' : protocol === 'socketio' ? 'IO' : 'SSE'}</span><strong>{protocol === 'websocket' ? 'Bidirectional WebSocket session' : protocol === 'socketio' ? 'Socket.IO event session' : 'Server-sent event stream'}</strong><span>{protocol === 'websocket' ? 'Connect, then send text or binary frames from the response console.' : protocol === 'socketio' ? 'Connect, emit ordered arguments, request acknowledgements, and listen to named events.' : 'Connect to watch named events arrive in order.'}</span></div>
      {protocol === 'websocket' ? <div className="editor-stack"><div className="editor-toolbar"><span>Runner startup text frame</span><small>Optional</small></div><CodeEditor ariaLabel="WebSocket runner startup frame" value={request.body} onChange={(body) => onChange({ body })} /></div> : null}
      {protocol === 'sse' ? <div className="sse-reconnect-settings">
        <header><strong>Long-running connection</strong><small>Reconnect after remote close or transport failure</small></header>
        <label className="sse-switch"><input checked={sse.autoReconnect} onChange={(event) => updateSse({ autoReconnect: event.target.checked })} type="checkbox" /><span>Reconnect automatically</span></label>
        <div>
          <label>Reconnect delay (ms)<input disabled={!sse.autoReconnect} max="60000" min="100" onChange={(event) => updateSse({ reconnectDelayMs: Number(event.target.value) })} type="number" value={sse.reconnectDelayMs} /></label>
          <label>Reconnect limit<input disabled={!sse.autoReconnect} max="1000" min="0" onChange={(event) => updateSse({ maxReconnects: Number(event.target.value) })} type="number" value={sse.maxReconnects} /><small>0 keeps retrying until Disconnect</small></label>
        </div>
        <label className="sse-switch"><input checked={sse.respectServerRetry} disabled={!sse.autoReconnect} onChange={(event) => updateSse({ respectServerRetry: event.target.checked })} type="checkbox" /><span>Respect server <code>retry:</code> delay</span></label>
        <label className="sse-switch"><input checked={sse.sendLastEventId} disabled={!sse.autoReconnect} onChange={(event) => updateSse({ sendLastEventId: event.target.checked })} type="checkbox" /><span>Resume with <code>Last-Event-ID</code></span></label>
      </div> : null}
    </div>
  );
}
