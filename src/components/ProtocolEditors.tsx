import { lazy, Suspense, useMemo, useRef, useState } from 'react';
import type {
  ApiRequest,
  BodyMode,
} from '../types';
import {
  graphqlCompletions,
  formatGraphqlDocument,
  graphqlHover,
  graphqlOperationAtOffset,
  graphqlOperationNames,
  graphqlOperationType,
  graphqlTypeLabel,
  importGraphqlSchema,
  insertGraphqlRootField,
  searchGraphqlSchema,
  validateGraphqlDocument,
  type GraphqlCompletion,
} from '../lib/graphql';
import { changeRequestBodyContentType, changeRequestBodyMode, prettyRequestBody, requestBodyContentType } from '../lib/request';
import { applyEditorCompletion, applyEditorTab } from '../lib/editorText';
import { Icon } from './Icon';

type ChangeRequest = (patch: Partial<ApiRequest>) => void;

type CodeEditorProps = {
  ariaLabel: string;
  value: string;
  onChange: (value: string) => void;
  completions?: (value: string, offset: number) => GraphqlCompletion[];
  onCursorChange?: (offset: number) => void;
};

export function CodeEditor({ ariaLabel, value, onChange, completions, onCursorChange }: CodeEditorProps) {
  const gutter = useRef<HTMLDivElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const [suggestions, setSuggestions] = useState<GraphqlCompletion[]>([]);
  const [activeSuggestion, setActiveSuggestion] = useState(0);
  const lines = value.split('\n');
  const updateSuggestions = (source: string, offset: number) => {
    const next = completions?.(source, offset) ?? [];
    setSuggestions(next);
    setActiveSuggestion(0);
  };
  const closeSuggestions = () => setSuggestions([]);
  const applySuggestion = (target: HTMLTextAreaElement, suggestion: GraphqlCompletion) => {
    const result = applyEditorCompletion(target.value, target.selectionStart, target.selectionEnd, suggestion.insertText);
    onChange(result.value);
    closeSuggestions();
    requestAnimationFrame(() => {
      target.focus();
      target.setSelectionRange(result.selectionStart, result.selectionEnd);
      onCursorChange?.(result.selectionStart);
    });
  };
  return (
    <div className="editable-code-surface">
      <div aria-hidden="true" className="code-gutter" ref={gutter}>
        {lines.map((_, index) => <span key={index}>{index + 1}</span>)}
      </div>
      <textarea
        aria-label={ariaLabel}
        aria-controls={suggestions.length ? `${ariaLabel.replace(/\W+/g, '-').toLowerCase()}-completions` : undefined}
        aria-expanded={suggestions.length > 0}
        aria-haspopup={completions ? 'listbox' : undefined}
        className="code-editor"
        onChange={(event) => {
          const source = event.target.value;
          const offset = event.target.selectionStart;
          onChange(source);
          onCursorChange?.(offset);
          updateSuggestions(source, offset);
        }}
        onClick={(event) => { onCursorChange?.(event.currentTarget.selectionStart); closeSuggestions(); }}
        onKeyDown={(event) => {
          if (completions && event.key === ' ' && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            updateSuggestions(event.currentTarget.value, event.currentTarget.selectionStart);
            return;
          }
          if (suggestions.length && event.key === 'ArrowDown') {
            event.preventDefault();
            setActiveSuggestion((current) => (current + 1) % suggestions.length);
            return;
          }
          if (suggestions.length && event.key === 'ArrowUp') {
            event.preventDefault();
            setActiveSuggestion((current) => (current - 1 + suggestions.length) % suggestions.length);
            return;
          }
          if (suggestions.length && (event.key === 'Enter' || event.key === 'Tab')) {
            event.preventDefault();
            applySuggestion(event.currentTarget, suggestions[activeSuggestion]);
            return;
          }
          if (suggestions.length && event.key === 'Escape') {
            event.preventDefault();
            closeSuggestions();
            return;
          }
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
        onSelect={(event) => onCursorChange?.(event.currentTarget.selectionStart)}
        ref={textarea}
        spellCheck={false}
        value={value}
      />
      {suggestions.length ? (
        <div className="code-completion-menu" id={`${ariaLabel.replace(/\W+/g, '-').toLowerCase()}-completions`} role="listbox">
          {suggestions.map((suggestion, index) => (
            <button
              aria-selected={index === activeSuggestion}
              className={`${index === activeSuggestion ? 'active' : ''}${suggestion.deprecated ? ' deprecated' : ''}`}
              key={`${suggestion.label}-${index}`}
              onMouseDown={(event) => { event.preventDefault(); if (textarea.current) applySuggestion(textarea.current, suggestion); }}
              role="option"
              type="button"
            >
              <span><strong>{suggestion.label}</strong><code>{suggestion.detail}</code></span>
              {suggestion.documentation ? <small>{suggestion.documentation}</small> : null}
            </button>
          ))}
        </div>
      ) : null}
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
  const rawBody = request.bodyMode === 'json' || request.bodyMode === 'text';
  const rawContentType = rawBody ? requestBodyContentType(request) : '';
  return (
    <div className="editor-stack body-editor">
      <div className="editor-toolbar body-mode-toolbar">
        <div role="tablist" aria-label="HTTP body type">
          {modes.map((mode) => (
            <button
              aria-selected={request.bodyMode === mode.value}
              className={request.bodyMode === mode.value ? 'active' : ''}
              key={mode.value}
              onClick={() => onChange(changeRequestBodyMode(request, mode.value))}
              role="tab"
              type="button"
            >
              {mode.label}
            </button>
          ))}
        </div>
        <div className="body-toolbar-actions">
          {rawBody ? <label>Content type<input aria-label="Request body content type" list="request-body-content-types" onChange={(event) => onChange(changeRequestBodyContentType(request, event.target.value))} spellCheck={false} value={rawContentType} /></label> : null}
          <datalist id="request-body-content-types"><option value="application/json" /><option value="application/xml" /><option value="application/yaml" /><option value="application/edn" /><option value="text/plain" /></datalist>
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

export function GraphqlEditor({ request, onChange, schemaLoading, schemaError, onLoadSchema }: { request: ApiRequest; onChange: ChangeRequest; schemaLoading: boolean; schemaError: string; onLoadSchema: (includeInputValueDeprecation: boolean) => void }) {
  const graphql = request.graphql;
  const [showSchema, setShowSchema] = useState(true);
  const [filter, setFilter] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [queryCursor, setQueryCursor] = useState(0);
  const [schemaImportError, setSchemaImportError] = useState('');
  const schema = graphql.schema;
  const operationNames = useMemo(() => graphqlOperationNames(graphql.query), [graphql.query]);
  const issues = useMemo(() => validateGraphqlDocument(graphql.query, graphql.variables, schema, graphql.operationName), [graphql.operationName, graphql.query, graphql.variables, schema]);
  const hover = useMemo(() => graphqlHover(graphql.query, queryCursor, schema), [graphql.query, queryCursor, schema]);
  const operation = graphqlOperationType(graphql.query, graphql.operationName) ?? 'query';
  const rootName = operation === 'mutation' ? schema?.mutationType : operation === 'subscription' ? schema?.subscriptionType : schema?.queryType;
  const root = schema?.types.find((type) => type.name === rootName);
  const fields = root?.fields.slice(0, 500) ?? [];
  const searchResults = useMemo(() => searchGraphqlSchema(schema, filter), [filter, schema]);
  const documented = schema?.types.find((type) => type.name === selectedType) ?? root;
  const stale = Boolean(schema && graphql.schemaSource !== 'local' && graphql.schemaEndpoint !== request.url);
  const navigateType = (source: { name: string; ofType?: typeof source } | undefined) => {
    let type = source;
    while (type?.ofType) type = type.ofType;
    if (type?.name) setSelectedType(type.name);
  };
  const cursorToken = (() => {
    const before = graphql.query.slice(0, queryCursor).match(/[_A-Za-z][_0-9A-Za-z]*$/)?.[0] ?? '';
    const after = graphql.query.slice(queryCursor).match(/^[_0-9A-Za-z]*/)?.[0] ?? '';
    return `${before}${after}`;
  })();
  const cursorType = schema?.types.find((type) => type.name === cursorToken);
  const changeQuery = (query: string) => {
    const names = graphqlOperationNames(query);
    const operationName = names.includes(graphql.operationName) ? graphql.operationName : names[0] ?? '';
    onChange({ graphql: { ...graphql, query, operationName } });
  };
  const importSchema = async (file: File) => {
    try {
      if (file.size > 20_000_000) throw new Error('GraphQL schema import exceeds the 20 MB limit.');
      const imported = importGraphqlSchema(await file.text());
      setSchemaImportError('');
      setSelectedType(imported.queryType);
      onChange({ graphql: { ...graphql, schema: imported, schemaEndpoint: '', schemaFetchedAt: new Date().toISOString(), schemaSource: 'local', schemaFileName: file.name, schemaIncludesInputValueDeprecation: graphql.includeInputValueDeprecation } });
    } catch (error) {
      setSchemaImportError(error instanceof Error ? error.message : String(error));
    }
  };
  return (
    <div className="graphql-editor">
      <div className="graphql-schema-bar">
        <div>
          <strong>Schema</strong>
          <span>{schema ? `${schema.types.length} types · ${graphql.schemaSource === 'local' ? graphql.schemaFileName || 'local JSON' : 'remote'}${stale ? ' · endpoint changed' : ''}` : 'Not loaded'}</span>
        </div>
        <label className="graphql-schema-toggle"><input checked={graphql.includeInputValueDeprecation} onChange={(event) => onChange({ graphql: { ...graphql, includeInputValueDeprecation: event.target.checked } })} type="checkbox" /> Deprecated inputs</label>
        <button disabled={schemaLoading} onClick={() => onLoadSchema(graphql.includeInputValueDeprecation)} type="button">{schemaLoading ? 'Introspecting…' : schema && graphql.schemaSource !== 'local' ? 'Refresh schema' : 'Fetch remote'}</button>
        <label className="graphql-schema-import">Import JSON<input accept="application/json,.json" type="file" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importSchema(file); event.target.value = ''; }} /></label>
        <button disabled={!schema} onClick={() => setShowSchema((value) => !value)} type="button">{showSchema ? 'Hide docs' : 'Show docs'}</button>
      </div>
      {schemaImportError || schemaError ? <div className="graphql-schema-error" role="alert">{schemaImportError || schemaError}</div> : null}
      <div className={`graphql-workspace${showSchema && schema ? ' with-schema' : ''}`}>
        <div className="graphql-compose">
          <section>
            <header>
              <strong>Operation</strong>
              <div>
                <select aria-label="GraphQL operation name" value={graphql.operationName} onChange={(event) => onChange({ graphql: { ...graphql, operationName: event.target.value } })}>
                  <option value="">{operationNames.length ? 'Select operation' : 'Operations'}</option>
                  {operationNames.map((name) => <option key={name} value={name}>{name}</option>)}
                </select>
                <button onClick={() => { try { changeQuery(formatGraphqlDocument(graphql.query)); setSchemaImportError(''); } catch (error) { setSchemaImportError(error instanceof Error ? error.message : String(error)); } }} type="button">Beautify</button>
              </div>
            </header>
            <CodeEditor
              ariaLabel="GraphQL query"
              completions={(query, offset) => graphqlCompletions(query, offset, schema)}
              onChange={changeQuery}
              onCursorChange={(offset) => {
                setQueryCursor(offset);
                const selected = graphqlOperationAtOffset(graphql.query, offset);
                if (selected && selected !== graphql.operationName) onChange({ graphql: { ...graphql, operationName: selected } });
              }}
              value={graphql.query}
            />
            {hover || cursorType ? <div className="graphql-language-info">{hover ? <pre>{hover}</pre> : null}{cursorType ? <button onClick={() => setSelectedType(cursorType.name)} type="button">Open {cursorType.name} documentation</button> : null}</div> : null}
          </section>
          <section>
            <header><strong>Variables</strong><small>JSON · schema-coerced</small></header>
            <CodeEditor ariaLabel="GraphQL variables" value={graphql.variables} onChange={(variables) => onChange({ graphql: { ...graphql, variables } })} />
          </section>
          <div className="graphql-issues" aria-live="polite">
            {issues.map((issue, index) => <span className={issue.severity} key={`${issue.message}-${index}`}><Icon name={issue.severity === 'error' ? 'x' : 'spark'} size={12} />{issue.line ? `${issue.line}:${issue.column} · ` : ''}{issue.message}</span>)}
            {!issues.length ? <span className="valid"><Icon name="check" size={12} />Document and variables pass GraphQL 16.10 language-service validation.</span> : null}
          </div>
        </div>
        {showSchema && schema ? (
          <aside className="graphql-explorer">
            <header>
              <div><small>{operation} root</small><strong>{rootName || 'Unavailable'}</strong></div>
              <input aria-label="Search GraphQL schema" placeholder="Search schema…" value={filter} onChange={(event) => setFilter(event.target.value)} />
            </header>
            {filter ? (
              <div className="graphql-schema-search">
                {searchResults.map((result, index) => <button key={`${result.kind}-${result.owner}-${result.label}-${index}`} onClick={() => setSelectedType(result.kind === 'type' ? result.typeName : result.owner)} type="button"><span><small>{result.owner}</small><strong>{result.label}</strong></span><code>{result.detail}</code><em>{result.description || 'No description'}</em></button>)}
                {!searchResults.length ? <p>No matching schema definitions.</p> : null}
              </div>
            ) : (
              <div className="graphql-field-list">
                {fields.map((field) => <article className={field.isDeprecated ? 'deprecated' : ''} key={field.name}><button aria-label={`Insert ${field.name}`} onClick={() => onChange({ graphql: { ...graphql, query: insertGraphqlRootField(graphql.query, operation, field, schema) } })} type="button"><Icon name="plus" size={12} /></button><button onClick={() => navigateType(field.type)} type="button"><strong>{field.name}</strong><code>{graphqlTypeLabel(field.type)}</code><small>{field.description || field.deprecationReason || 'No description'}</small></button></article>)}
                {!fields.length ? <p>This schema has no {operation} root fields.</p> : null}
              </div>
            )}
            {documented ? (
              <div className="graphql-type-doc">
                <header><small>{documented.kind}</small><strong>{documented.name}</strong>{selectedType ? <button onClick={() => setSelectedType('')} type="button">Root</button> : null}</header>
                <p>{documented.description || 'No type description.'}</p>
                {documented.interfaces.length ? <section><small>Implements</small>{documented.interfaces.map((type) => <button key={type.name} onClick={() => navigateType(type)} type="button"><span>{type.name}</span></button>)}</section> : null}
                {documented.possibleTypes.length ? <section><small>Possible types</small>{documented.possibleTypes.map((type) => <button key={type.name} onClick={() => navigateType(type)} type="button"><span>{type.name}</span></button>)}</section> : null}
                {documented.fields.length ? <section><small>Fields</small>{documented.fields.slice(0, 500).map((field) => <button className={field.isDeprecated ? 'deprecated' : ''} key={field.name} onClick={() => navigateType(field.type)} type="button"><span>{field.name}</span><code>{graphqlTypeLabel(field.type)}</code>{field.args.length ? <em>({field.args.map((argument) => `${argument.name}: ${graphqlTypeLabel(argument.type)}`).join(', ')})</em> : null}<small>{field.description || field.deprecationReason}</small></button>)}</section> : null}
                {documented.inputFields.length ? <section><small>Input fields</small>{documented.inputFields.slice(0, 500).map((field) => <button className={field.isDeprecated ? 'deprecated' : ''} key={field.name} onClick={() => navigateType(field.type)} type="button"><span>{field.name}</span><code>{graphqlTypeLabel(field.type)}</code><small>{field.description || field.deprecationReason}</small></button>)}</section> : null}
                {documented.enumValues.length ? <section><small>Enum values</small>{documented.enumValues.slice(0, 500).map((value) => <div className={value.isDeprecated ? 'deprecated' : ''} key={value.name}><span>{value.name}</span><small>{value.description || value.deprecationReason}</small></div>)}</section> : null}
                {documented.specifiedByUrl ? <button className="graphql-specification-link" onClick={() => { void import('../lib/responseLinks').then(({ openResponseLink }) => openResponseLink(documented.specifiedByUrl)).catch((error) => setSchemaImportError(error instanceof Error ? error.message : String(error))); }} type="button">Open scalar specification</button> : null}
              </div>
            ) : null}
            {schema.directives.length ? <details className="graphql-directives"><summary>{schema.directives.length} directives</summary>{schema.directives.map((directive) => <div key={directive.name}><strong>@{directive.name}</strong><code>{directive.locations.join(' · ')}</code><small>{directive.description}</small></div>)}</details> : null}
          </aside>
        ) : null}
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
