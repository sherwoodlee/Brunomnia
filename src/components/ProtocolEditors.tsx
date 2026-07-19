import { useMemo, useRef, useState } from 'react';
import type {
  ApiRequest,
  BodyMode,
  FilePayload,
  GrpcSchema,
  MultipartPart,
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

const filePayload = async (file: File): Promise<FilePayload> => ({
  fileName: file.name,
  mimeType: file.type || 'application/octet-stream',
  dataBase64: await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.readAsDataURL(file);
  }),
});

const modes: { value: BodyMode; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'json', label: 'JSON' },
  { value: 'text', label: 'Text' },
  { value: 'form-urlencoded', label: 'Form URL encoded' },
  { value: 'multipart', label: 'Multipart' },
  { value: 'binary', label: 'Binary' },
];

const uid = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

export function HttpBodyEditor({ request, onChange }: { request: ApiRequest; onChange: ChangeRequest }) {
  const updateMultipart = (id: string, patch: Partial<MultipartPart>) => onChange({
    multipartBody: request.multipartBody.map((part) => part.id === id ? { ...part, ...patch } : part),
  });

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
        <SimpleRows
          name="Field"
          rows={request.formBody}
          onChange={(formBody) => onChange({ formBody })}
        />
      ) : null}
      {request.bodyMode === 'multipart' ? (
        <div className="multipart-editor">
          <div className="multipart-header"><span>Type</span><span>Name</span><span>Value / file</span><span>Part metadata</span><span /></div>
          {request.multipartBody.map((part) => (
            <div className="multipart-row" key={part.id}>
              <select value={part.kind} onChange={(event) => updateMultipart(part.id, { kind: event.target.value as MultipartPart['kind'], file: undefined })}>
                <option value="text">Text</option><option value="file">File</option>
              </select>
              <input aria-label="Multipart field name" value={part.name} onChange={(event) => updateMultipart(part.id, { name: event.target.value })} placeholder="field" />
              {part.kind === 'file' ? (
                <label className="file-picker"><Icon name="import" size={14} /><span>{part.file?.fileName ?? 'Choose file'}</span><input type="file" onChange={(event) => { const file = event.target.files?.[0]; if (file) void filePayload(file).then((payload) => updateMultipart(part.id, { file: payload, fileName: payload.fileName, contentType: payload.mimeType })); }} /></label>
              ) : <input aria-label="Multipart field value" value={part.value} onChange={(event) => updateMultipart(part.id, { value: event.target.value })} placeholder="value" />}
              <div className="multipart-metadata">
                {part.kind === 'file' ? <input aria-label="Multipart file name" value={part.fileName ?? part.file?.fileName ?? ''} onChange={(event) => updateMultipart(part.id, { fileName: event.target.value })} placeholder="filename" /> : null}
                <input aria-label="Multipart content type" value={part.contentType ?? part.file?.mimeType ?? ''} onChange={(event) => updateMultipart(part.id, { contentType: event.target.value })} placeholder={part.kind === 'file' ? 'application/octet-stream' : 'text/plain; charset=utf-8'} />
              </div>
              <button aria-label="Remove multipart field" className="icon-button subtle" onClick={() => onChange({ multipartBody: request.multipartBody.filter((candidate) => candidate.id !== part.id) })} type="button"><Icon name="trash" size={14} /></button>
            </div>
          ))}
          <button className="add-row" onClick={() => onChange({ multipartBody: [...request.multipartBody, { id: uid('part'), name: '', value: '', enabled: true, kind: 'text', contentType: '', fileName: '' }] })} type="button"><Icon name="plus" size={14} /> Add part</button>
        </div>
      ) : null}
      {request.bodyMode === 'binary' ? (
        <div className="binary-dropzone">
          <Icon name="import" size={25} />
          <strong>{request.binaryBody?.fileName ?? 'Choose a binary payload'}</strong>
          <span>{request.binaryBody ? `${request.binaryBody.mimeType} · ${Math.round(request.binaryBody.dataBase64.length * .75)} bytes` : 'The selected file remains in this local workspace.'}</span>
          <label>Choose file<input type="file" onChange={(event) => { const file = event.target.files?.[0]; if (file) void filePayload(file).then((binaryBody) => onChange({ binaryBody })); }} /></label>
        </div>
      ) : null}
    </div>
  );
}

type Row = ApiRequest['formBody'][number];

function SimpleRows({ rows, onChange, name }: { rows: Row[]; onChange: (rows: Row[]) => void; name: string }) {
  const update = (id: string, patch: Partial<Row>) => onChange(rows.map((row) => row.id === id ? { ...row, ...patch } : row));
  return (
    <div className="simple-rows">
      {rows.map((row) => (
        <div key={row.id}>
          <input aria-label={`Enable ${name}`} type="checkbox" checked={row.enabled} onChange={(event) => update(row.id, { enabled: event.target.checked })} />
          <input aria-label={`${name} name`} placeholder={name} value={row.name} onChange={(event) => update(row.id, { name: event.target.value })} />
          <input aria-label={`${name} value`} placeholder="Value" value={row.value} onChange={(event) => update(row.id, { value: event.target.value })} />
          <button aria-label={`Remove ${name}`} className="icon-button subtle" onClick={() => onChange(rows.filter((candidate) => candidate.id !== row.id))} type="button"><Icon name="trash" size={14} /></button>
        </div>
      ))}
      <button className="add-row" onClick={() => onChange([...rows, { id: uid('row'), name: '', value: '', enabled: true }])} type="button"><Icon name="plus" size={14} /> Add field</button>
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

export function GrpcEditor({
  request,
  schema,
  schemaLoading,
  onChange,
  onLoadSchema,
}: {
  request: ApiRequest;
  schema?: GrpcSchema;
  schemaLoading: boolean;
  onChange: ChangeRequest;
  onLoadSchema: () => void;
}) {
  const grpc = request.grpc;
  const service = schema?.services.find((candidate) => candidate.fullName === grpc.service) ?? schema?.services[0];
  const method = service?.methods.find((candidate) => candidate.name === grpc.method) ?? service?.methods[0];
  const update = (patch: Partial<ApiRequest['grpc']>) => onChange({ grpc: { ...grpc, ...patch } });
  return (
    <div className="grpc-editor">
      <div className="grpc-schema-bar">
        <div className="segmented-control">
          <button className={grpc.descriptorSource === 'reflection' ? 'active' : ''} onClick={() => update({ descriptorSource: 'reflection', descriptorSetBase64: '' })} type="button">Reflection</button>
          <button className={grpc.descriptorSource === 'proto' ? 'active' : ''} onClick={() => update({ descriptorSource: 'proto', descriptorSetBase64: '' })} type="button">Proto source</button>
        </div>
        <button className="secondary-button compact-button" disabled={schemaLoading} onClick={onLoadSchema} type="button">{schemaLoading ? 'Loading…' : 'Load schema'}</button>
      </div>
      <div className={`grpc-workspace${grpc.descriptorSource === 'proto' ? ' with-proto' : ''}`}>
        {grpc.descriptorSource === 'proto' ? (
          <div className="proto-source-pane">
            <div className="pane-label"><strong>schema.proto</strong><small>Editable source</small></div>
            <CodeEditor ariaLabel="Protocol Buffer definition" value={grpc.protoText} onChange={(protoText) => update({ protoText, descriptorSetBase64: '' })} />
          </div>
        ) : null}
        <div className="grpc-call-editor">
          <div className="grpc-method-picker">
            <label>Service<select aria-label="gRPC service" value={service?.fullName ?? ''} onChange={(event) => { const next = schema?.services.find((candidate) => candidate.fullName === event.target.value); update({ service: event.target.value, method: next?.methods[0]?.name ?? '' }); }}><option value="">Select service</option>{schema?.services.map((item) => <option key={item.fullName} value={item.fullName}>{item.fullName}</option>)}</select></label>
            <label>Method<select aria-label="gRPC method" value={method?.name ?? ''} onChange={(event) => update({ service: service?.fullName ?? '', method: event.target.value })}><option value="">Select method</option>{service?.methods.map((item) => <option key={item.fullName} value={item.name}>{item.name}</option>)}</select></label>
            {method ? <span className="rpc-kind">{method.clientStreaming ? 'client stream' : 'single request'} → {method.serverStreaming ? 'server stream' : 'single response'}</span> : null}
          </div>
          {schema ? <CodeEditor ariaLabel="gRPC JSON message" value={grpc.input} onChange={(input) => update({ input })} /> : <div className="empty-state compact"><Icon name="database" size={26} /><strong>Load reflection or this proto definition</strong><span>Brunomnia builds dynamic request and response messages locally.</span></div>}
        </div>
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

export function TransportEditor({ request, globalTimeoutMs, onChange }: { request: ApiRequest; globalTimeoutMs: number; onChange: ChangeRequest }) {
  const transport = request.transport;
  const update = (patch: Partial<ApiRequest['transport']>) => onChange({ transport: { ...transport, ...patch } });
  return (
    <div className="transport-editor">
      <div className="transport-grid">
        <label>Request timeout<select value={transport.timeoutMode} onChange={(event) => update({ timeoutMode: event.target.value as typeof transport.timeoutMode })}><option value="global">Use Preferences ({globalTimeoutMs.toLocaleString()} ms)</option><option value="custom">Custom</option></select></label>
        <label>Custom timeout (ms)<input disabled={transport.timeoutMode !== 'custom'} min="0" step="1" type="number" value={transport.timeoutMs} onChange={(event) => update({ timeoutMs: Math.min(2_147_483_647, Math.max(0, Number(event.target.value) || 0)) })} /><small>0 disables the deadline</small></label>
        <label>Proxy policy<select value={transport.proxyMode} onChange={(event) => update({ proxyMode: event.target.value as typeof transport.proxyMode })}><option value="global">Use Preferences</option><option value="custom">Custom</option><option value="disabled">Direct connection</option></select></label>
        <label>Custom proxy URL<input disabled={transport.proxyMode !== 'custom'} placeholder="http://127.0.0.1:8080" spellCheck={false} value={transport.proxyUrl} onChange={(event) => update({ proxyUrl: event.target.value })} /></label>
        <label>Custom proxy exclusions<input disabled={transport.proxyMode !== 'custom'} placeholder="localhost, .example.com, 10.0.0.0/8" spellCheck={false} value={transport.proxyExclusions} onChange={(event) => update({ proxyExclusions: event.target.value })} /></label>
        <label>Certificate domains<input placeholder="api.example.com, *.internal.example" spellCheck={false} value={transport.clientCertificateDomains} onChange={(event) => update({ clientCertificateDomains: event.target.value })} /></label>
      </div>
      <div className="transport-switches">
        <label><span>Follow HTTP redirects</span><select value={transport.followRedirectsMode} onChange={(event) => { const followRedirectsMode = event.target.value as typeof transport.followRedirectsMode; update({ followRedirectsMode, followRedirects: followRedirectsMode !== 'off' }); }}><option value="global">Use Preferences</option><option value="on">Always</option><option value="off">Never</option></select></label>
        <label><span>Validate server certificates</span><select value={transport.validateCertificatesMode} onChange={(event) => { const validateCertificatesMode = event.target.value as typeof transport.validateCertificatesMode; update({ validateCertificatesMode, validateCertificates: validateCertificatesMode !== 'off' }); }}><option value="global">Use Preferences</option><option value="on">Always</option><option value="off">Never</option></select></label>
        <label><input checked={transport.sendCookies} type="checkbox" onChange={(event) => update({ sendCookies: event.target.checked })} /><span>Send matching workspace cookies</span></label>
        <label><input checked={transport.storeCookies} type="checkbox" onChange={(event) => update({ storeCookies: event.target.checked })} /><span>Store response cookies</span></label>
      </div>
      <div className="certificate-grid">
        <label>Client certificate (PEM)<textarea aria-label="Client certificate PEM" placeholder="-----BEGIN CERTIFICATE-----" value={transport.clientCertificatePem} onChange={(event) => update({ clientCertificatePem: event.target.value })} /></label>
        <label>Client private key (PEM)<textarea aria-label="Client private key PEM" placeholder="-----BEGIN PRIVATE KEY-----" value={transport.clientKeyPem} onChange={(event) => update({ clientKeyPem: event.target.value })} /></label>
      </div>
      <p className="transport-note">Transport secrets remain on this device and export only when you explicitly export this workspace.</p>
    </div>
  );
}
