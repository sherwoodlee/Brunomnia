import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, DragEvent as ReactDragEvent, ReactNode, RefObject } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { createBlankRequest } from './data/seed';
import { sendRequest, type SendRequestContext } from './lib/http';
import { storeResponseCookies } from './lib/cookies';
import { connectStream, disconnectStream, invokeGrpc, loadGrpcSchema, sendWebSocketMessage } from './lib/protocol';
import { environmentMap, formatBytes, mockResponse, normalizeHttpMethod, prettyBody } from './lib/request';
import { loadWorkspace, saveWorkspace } from './lib/storage';
import { applyScriptSubresponse, runBrowserScript, type ScriptRunOptions } from './lib/scriptSandbox';
import { readDesktopScriptFile } from './lib/scriptFiles';
import type { RunningMock } from './lib/mock';
import { Icon } from './components/Icon';
import { AuthEditor } from './components/AuthEditor';
import { CodeGenerationDialog } from './components/CodeGenerationDialog';
import { applyArtifactImport } from './lib/interchange/apply';
import type { ArtifactImport } from './lib/interchange/types';
import { writeProject } from './lib/project';
import { applyPluginTheme, createPluginRuntime, describePlugin, type PluginHostCallbacks, type PluginRunState } from './lib/plugins';
import { plaintextSecretCandidates, resolveAuthorizedExternalSecret, vaultVariables, type ExternalSecretInput, type VaultSession } from './lib/security';
import { fetchGraphqlSchema } from './lib/graphql';
import { shortcutMatches } from './lib/preferences';
import { applyCollectionConfiguration, collectionEnvironmentScopes, environmentAncestors, folderAncestors, folderPath, moveWorkspaceResource, orderedCollectionChildren, publicEnvironments, resolveEnvironment, scriptEnvironmentScopes, variableScope } from './lib/resources';
import type { WorkspaceResourceMove } from './lib/resources';
import { retainResponseHistory, visibleResponseHistory } from './lib/responseHistory';
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
  RequestFolder,
  RequestTab,
  ResponseTab,
  ScriptRunResult,
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

const requestTabs: RequestTab[] = ['params', 'headers', 'auth', 'body', 'transport', 'scripts', 'tests', 'docs'];
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
const methodClass = (method: string) => methods.includes(method as HttpMethod) ? method.toLowerCase() : 'custom';

const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

const scriptVariableRows = (values: Record<string, string>, existing: KeyValue[], prefix: string, disabled = existing.filter((row) => !row.enabled && row.name).map((row) => row.name)): KeyValue[] => {
  const names = new Set(Object.keys(values));
  const disabledNames = new Set(disabled.filter((name) => !names.has(name)));
  return [
    ...Object.entries(values).map(([name, value]) => {
      const row = existing.find((candidate) => candidate.name === name);
      return row ? { ...row, value, enabled: true } : { id: uid(prefix), name, value, enabled: true };
    }),
    ...[...disabledNames].map((name) => {
      const row = existing.find((candidate) => candidate.name === name);
      return row ? { ...row, enabled: false } : { id: uid(prefix), name, value: '', enabled: false };
    }),
  ];
};

const scriptFolderVariables = (folders: RequestFolder[]) => folders.map((folder) => ({
  id: folder.id,
  name: folder.name,
  environment: Object.fromEntries(folder.environment.filter((row) => row.enabled && row.name).map((row) => [row.name, row.value])),
  disabled: folder.environment.filter((row) => !row.enabled && row.name).map((row) => row.name),
}));

const mergedScriptVariables = (result: ScriptRunResult, scopes: ScriptRunOptions): Record<string, string> => {
  const values: Record<string, string> = {};
  const apply = (scope: Record<string, string>, disabled: string[] = []) => {
    disabled.forEach((name) => delete values[name]);
    Object.assign(values, scope);
  };
  apply(result.baseGlobals ?? result.environment, result.baseGlobalDisabled ?? scopes.baseGlobalDisabled);
  if (!scopes.globalsAreBase) apply(result.environment, result.globalDisabled ?? scopes.globalDisabled);
  apply(result.baseEnvironment ?? result.collectionVariables ?? {}, result.baseEnvironmentDisabled ?? scopes.baseEnvironmentDisabled);
  if (!scopes.collectionVariablesAreBase) apply(result.collectionVariables ?? {}, result.collectionDisabled ?? scopes.collectionDisabled);
  (result.folders ?? []).forEach((folder) => {
    (folder.disabled ?? []).forEach((name) => delete values[name]);
    Object.assign(values, folder.environment);
  });
  return { ...values, ...(result.localVariables ?? {}) };
};

const duplicateRequest = (request: ApiRequest): ApiRequest => {
  const copy = structuredClone(request);
  copy.id = uid('request');
  copy.name = `${request.name} copy`;
  copy.pathParams = copy.pathParams.map((row) => ({ ...row, id: uid('path') }));
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
  detailed?: boolean;
};

function KeyValueEditor({
  rows,
  onChange,
  namePlaceholder = 'Name',
  valuePlaceholder = 'Value',
  detailed = false,
}: KeyValueEditorProps) {
  const update = (id: string, patch: Partial<KeyValue>) =>
    onChange(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));

  return (
    <div className={`kv-editor${detailed ? ' detailed' : ''}`}>
      <div className="kv-header">
        <span />
        <span>{namePlaceholder}</span>
        <span>{valuePlaceholder}</span>
        {detailed ? <span>Description</span> : null}
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
          {detailed ? <textarea
            aria-label={valuePlaceholder}
            onChange={(event) => update(row.id, { value: event.target.value })}
            placeholder={valuePlaceholder}
            rows={row.value.includes('\n') ? Math.min(6, row.value.split('\n').length) : 1}
            spellCheck={false}
            value={row.value}
          /> : <input
            aria-label={valuePlaceholder}
            onChange={(event) => update(row.id, { value: event.target.value })}
            placeholder={valuePlaceholder}
            spellCheck={false}
            value={row.value}
          />}
          {detailed ? <input aria-label="Description" onChange={(event) => update(row.id, { description: event.target.value })} placeholder="Description" value={row.description ?? ''} /> : null}
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
        onClick={() => onChange([...rows, { id: uid('field'), name: '', value: '', enabled: true, description: detailed ? '' : undefined }])}
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
  onAddFolder: (collectionId: string, parentId: string) => void;
  onEditCollection: (collectionId: string) => void;
  onEditFolder: (collectionId: string, folderId: string) => void;
  onToggleFolder: (collectionId: string, folderId: string) => void;
  onMoveResource: (move: WorkspaceResourceMove) => void;
};

type SidebarDragSource =
  | { kind: 'collection'; collectionId: string }
  | { kind: 'folder' | 'request'; collectionId: string; resourceId: string };

function CollectionSidebar({
  workspace,
  search,
  mode,
  onSearch,
  onSelectRequest,
  onToggleCollection,
  onAddRequest,
  onAddCollection,
  onAddFolder,
  onEditCollection,
  onEditFolder,
  onToggleFolder,
  onMoveResource,
}: CollectionSidebarProps) {
  const dragSourceRef = useRef<SidebarDragSource | undefined>(undefined);
  const [dragSource, setDragSource] = useState<SidebarDragSource>();
  const [dropIndicator, setDropIndicator] = useState('');
  const normalizedSearch = search.trim().toLowerCase();
  const history = workspace.history.filter((entry) =>
    `${entry.name} ${entry.url} ${entry.method}`.toLowerCase().includes(normalizedSearch),
  );

  const clearDrag = () => {
    dragSourceRef.current = undefined;
    setDragSource(undefined);
    setDropIndicator('');
  };
  const beginDrag = (event: ReactDragEvent<HTMLElement>, source: SidebarDragSource) => {
    if (normalizedSearch) {
      event.preventDefault();
      return;
    }
    dragSourceRef.current = source;
    setDragSource(source);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', 'brunomnia-resource');
  };
  const commitDrop = (event: ReactDragEvent<HTMLElement>, move: WorkspaceResourceMove, indicator: string, commit: boolean) => {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'move';
    setDropIndicator(indicator);
    if (commit) {
      onMoveResource(move);
      clearDrag();
    }
  };
  const dropOnCollection = (event: ReactDragEvent<HTMLElement>, targetCollectionId: string, commit: boolean) => {
    const source = dragSourceRef.current;
    if (!source || normalizedSearch) return;
    if (source.kind === 'collection') {
      const bounds = event.currentTarget.getBoundingClientRect();
      const placement = event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after';
      commitDrop(event, { kind: 'collection', collectionId: source.collectionId, targetCollectionId, placement }, `collection:${targetCollectionId}:${placement}`, commit);
      return;
    }
    commitDrop(event, {
      kind: source.kind,
      collectionId: source.collectionId,
      resourceId: source.resourceId,
      targetCollectionId,
      targetParentId: '',
    }, `collection:${targetCollectionId}:inside`, commit);
  };
  const dropOnRequest = (event: ReactDragEvent<HTMLElement>, targetCollectionId: string, request: ApiRequest, commit: boolean) => {
    const source = dragSourceRef.current;
    if (!source || source.kind === 'collection' || normalizedSearch) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const placement = event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after';
    commitDrop(event, {
      kind: source.kind,
      collectionId: source.collectionId,
      resourceId: source.resourceId,
      targetCollectionId,
      targetParentId: request.folderId ?? '',
      targetResourceId: request.id,
      placement,
    }, `resource:${request.id}:${placement}`, commit);
  };
  const dropOnFolder = (event: ReactDragEvent<HTMLElement>, targetCollectionId: string, folder: RequestFolder, commit: boolean) => {
    const source = dragSourceRef.current;
    if (!source || source.kind === 'collection' || normalizedSearch) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const position = (event.clientY - bounds.top) / Math.max(bounds.height, 1);
    if (position > 0.28 && position < 0.72) {
      commitDrop(event, {
        kind: source.kind,
        collectionId: source.collectionId,
        resourceId: source.resourceId,
        targetCollectionId,
        targetParentId: folder.id,
      }, `resource:${folder.id}:inside`, commit);
      return;
    }
    const placement = position <= 0.28 ? 'before' : 'after';
    commitDrop(event, {
      kind: source.kind,
      collectionId: source.collectionId,
      resourceId: source.resourceId,
      targetCollectionId,
      targetParentId: folder.parentId,
      targetResourceId: folder.id,
      placement,
    }, `resource:${folder.id}:${placement}`, commit);
  };
  const indicatorClass = (scope: 'collection' | 'resource', id: string) => {
    const prefix = `${scope}:${id}:`;
    if (!dropIndicator.startsWith(prefix)) return '';
    return ` drop-${dropIndicator.slice(prefix.length)}`;
  };
  const sourceClass = (source: SidebarDragSource) => dragSource && JSON.stringify(dragSource) === JSON.stringify(source) ? ' is-dragging' : '';

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
          <button onClick={onAddCollection} type="button">New collection</button>
        ) : null}
      </div>

      <div className="collection-scroll">
        {mode === 'collections' ? workspace.collections.map((collection) => {
          const visibleRequests = collection.requests.filter((request) =>
            `${request.name} ${request.method} ${request.protocol} ${request.url}`.toLowerCase().includes(normalizedSearch),
          );
          const visibleRequestIds = new Set(visibleRequests.map((request) => request.id));
          const folders = collection.folders ?? [];
          const folderById = new Map(folders.map((folder) => [folder.id, folder]));
          const requestById = new Map(collection.requests.map((request) => [request.id, request]));
          const folderMatches = (folder: RequestFolder): boolean => folder.name.toLowerCase().includes(normalizedSearch)
            || visibleRequests.some((request) => request.folderId === folder.id)
            || folders.some((candidate) => candidate.parentId === folder.id && folderMatches(candidate));
          if (normalizedSearch && visibleRequests.length === 0 && !collection.name.toLowerCase().includes(normalizedSearch) && !folders.some(folderMatches)) {
            return null;
          }
          function renderRequest(request: ApiRequest, depth: number): ReactNode {
            const source: SidebarDragSource = { kind: 'request', collectionId: collection.id, resourceId: request.id };
            return <button
            aria-grabbed={dragSource?.kind === 'request' && dragSource.resourceId === request.id}
            className={`request-row${workspace.activeRequestId === request.id ? ' selected' : ''}${sourceClass(source)}${indicatorClass('resource', request.id)}`}
            draggable={!normalizedSearch}
            key={request.id}
            onDragEnd={clearDrag}
            onDragOver={(event) => dropOnRequest(event, collection.id, request, false)}
            onDragStart={(event) => beginDrag(event, source)}
            onDrop={(event) => dropOnRequest(event, collection.id, request, true)}
            onClick={() => onSelectRequest(request.id)}
            style={{ '--resource-depth': depth } as CSSProperties}
            title={normalizedSearch ? 'Clear search to reorder' : 'Drag to reorder or move'}
            type="button"
          ><span className={`method method-${methodClass(request.method)} protocol-${request.protocol}`}>{protocolLabel(request)}</span><span>{request.name}</span></button>;
          }
          function renderResources(parentId: string, depth: number): ReactNode[] {
            return orderedCollectionChildren(collection, parentId).flatMap((resource): ReactNode[] => {
              if (resource.kind === 'folder') {
                const folder = folderById.get(resource.id);
                return folder ? [renderFolder(folder, depth)] : [];
              }
              const request = requestById.get(resource.id);
              return request && visibleRequestIds.has(request.id) ? [renderRequest(request, depth)] : [];
            });
          }
          function renderFolder(folder: RequestFolder, depth: number): ReactNode {
            if (normalizedSearch && !folderMatches(folder)) return null;
            const source: SidebarDragSource = { kind: 'folder', collectionId: collection.id, resourceId: folder.id };
            return <div className="request-folder" key={folder.id}>
              <div
                aria-grabbed={dragSource?.kind === 'folder' && dragSource.resourceId === folder.id}
                className={`request-folder-title${sourceClass(source)}${indicatorClass('resource', folder.id)}`}
                draggable={!normalizedSearch}
                onDragEnd={clearDrag}
                onDragOver={(event) => dropOnFolder(event, collection.id, folder, false)}
                onDragStart={(event) => beginDrag(event, source)}
                onDrop={(event) => dropOnFolder(event, collection.id, folder, true)}
                style={{ '--resource-depth': depth } as CSSProperties}
                title={normalizedSearch ? 'Clear search to reorder' : 'Drag edges to reorder; drop in the center to move inside'}
              >
                <button aria-label={`${folder.expanded ? 'Collapse' : 'Expand'} ${folder.name}`} onClick={() => onToggleFolder(collection.id, folder.id)} type="button"><Icon name={folder.expanded ? 'chevron-down' : 'chevron-right'} size={12} /></button>
                <button onClick={() => onEditFolder(collection.id, folder.id)} type="button"><Icon name="folder" size={14} /><span>{folder.name}</span></button>
                <small>{collection.requests.filter((request) => folderAncestors(collection, request.folderId).some((ancestor) => ancestor.id === folder.id)).length}</small>
                <button aria-label={`Add subfolder to ${folder.name}`} onClick={() => onAddFolder(collection.id, folder.id)} type="button"><Icon name="plus" size={12} /></button>
                <button aria-label={`Configure ${folder.name}`} onClick={() => onEditFolder(collection.id, folder.id)} type="button"><Icon name="settings" size={12} /></button>
              </div>
              {folder.expanded || normalizedSearch ? <div>{renderResources(folder.id, depth + 1)}</div> : null}
            </div>;
          }
          const collectionSource: SidebarDragSource = { kind: 'collection', collectionId: collection.id };
          return (
            <div className="collection-group" key={collection.id}>
              <div
                aria-grabbed={dragSource?.kind === 'collection' && dragSource.collectionId === collection.id}
                className={`collection-title${sourceClass(collectionSource)}${indicatorClass('collection', collection.id)}`}
                draggable={!normalizedSearch}
                onDragEnd={clearDrag}
                onDragOver={(event) => dropOnCollection(event, collection.id, false)}
                onDragStart={(event) => beginDrag(event, collectionSource)}
                onDrop={(event) => dropOnCollection(event, collection.id, true)}
                title={normalizedSearch ? 'Clear search to reorder' : 'Drag to reorder collections; drop a resource here to move it to the root'}
              ><button onClick={() => onToggleCollection(collection.id)} type="button"><Icon name={collection.expanded ? 'chevron-down' : 'chevron-right'} size={14} /><Icon name="archive" size={16} /><span>{collection.name}</span><small>{collection.requests.length}</small></button><button aria-label={`Add folder to ${collection.name}`} onClick={() => onAddFolder(collection.id, '')} type="button"><Icon name="plus" size={13} /></button><button aria-label={`Configure ${collection.name}`} onClick={() => onEditCollection(collection.id)} type="button"><Icon name="settings" size={13} /></button></div>
              {collection.expanded ? <div>{renderResources('', 0)}</div> : null}
            </div>
          );
        }) : (
          history.length ? history.map((entry) => (
            <button className="history-row" key={entry.id} onClick={() => onSelectRequest(entry.requestId)} type="button">
              <span className={`method method-${methodClass(entry.method)}`}>{entry.method}</span>
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
  collection: Workspace['collections'][number];
  environment: Environment;
  workspaceCookies: CookieRecord[];
  storedResponses: StoredResponse[];
  requestContext: SendRequestContext;
  activeTab: RequestTab;
  isSending: boolean;
  streamStatus: 'disconnected' | 'connecting' | 'connected' | 'reconnecting';
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
  onAddRequest: () => void;
  onGenerateCode: () => void;
  scheduledSendLabel: string;
  urlInputRef: RefObject<HTMLInputElement | null>;
};

function RequestPanel({
  request,
  collection,
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
  onAddRequest,
  onGenerateCode,
  scheduledSendLabel,
  urlInputRef,
  environment,
  workspaceCookies,
  storedResponses,
  requestContext,
}: RequestPanelProps) {
  const streamProtocol = request.protocol === 'websocket' || request.protocol === 'sse';
  const actionLabel = streamProtocol
    ? streamStatus === 'connected' ? 'Disconnect' : streamStatus === 'reconnecting' ? 'Stop reconnecting' : streamStatus === 'connecting' ? 'Connecting' : 'Connect'
    : request.protocol === 'grpc' ? 'Invoke' : 'Send';
  return (
    <section className="request-panel">
      <div className="document-tabs">
        <div className="document-tab active">
          <span className={`method method-${methodClass(request.method)} protocol-${request.protocol}`}>{protocolLabel(request)}</span>
          <input
            aria-label="Request name"
            onChange={(event) => onChange({ name: event.target.value })}
            spellCheck={false}
            value={request.name}
          />
          <span className="dirty-dot" />
        </div>
        <select aria-label="Request folder" className="request-folder-select" onChange={(event) => onChange({ folderId: event.target.value })} value={request.folderId ?? ''}><option value="">Collection root</option>{(collection.folders ?? []).map((folder) => <option key={folder.id} value={folder.id}>{folderPath(collection, folder.id)}</option>)}</select>
        <button aria-label="New request" className="tab-plus" onClick={onAddRequest} type="button"><Icon name="plus" size={16} /></button>
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
        <input
          aria-label="HTTP method"
          className={`method-select method-${methodClass(request.method)}`}
          disabled={request.protocol !== 'http'}
          list="http-methods"
          maxLength={32}
          onBlur={(event) => onChange({ method: normalizeHttpMethod(event.target.value, 'GET') as HttpMethod })}
          onChange={(event) => {
            const value = event.target.value.toUpperCase();
            if (/^[!#$%&'*+.^_`|~0-9A-Z-]*$/.test(value)) onChange({ method: value as HttpMethod });
          }}
          spellCheck={false}
          value={request.method}
        />
        <datalist id="http-methods">{methods.map((method) => <option key={method} value={method} />)}</datalist>
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
        <button aria-label="Generate client code" className="codegen-trigger" disabled={request.protocol !== 'http' && request.protocol !== 'graphql'} onClick={onGenerateCode} type="button"><Icon name="code" size={15} /><span>Code</span></button>
        <div className="send-actions"><button className="send-button" disabled={isSending && !scheduledSendLabel} onClick={scheduledSendLabel ? onCancelScheduled : onSend} type="button">{isSending ? <span className="sending-spinner" /> : null}{scheduledSendLabel ? `Stop · ${scheduledSendLabel}` : isSending && !streamProtocol ? 'Working' : actionLabel}</button><button aria-label="Send options" disabled={streamProtocol || request.protocol === 'grpc'} onClick={onOpenSendOptions} type="button"><Icon name="chevron-down" size={13} /></button></div>
      </div>

      <nav className="tab-strip request-tabs" aria-label="Request configuration">
        {requestTabs.map((tab) => {
          const count = tab === 'params' ? [...request.pathParams, ...request.params].filter((row) => row.enabled && row.name).length
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
          <div className="parameter-editors">
            <section><header><strong>Path parameters</strong><small>Replace matching {'{name}'} segments in the URL.</small></header><KeyValueEditor detailed rows={request.pathParams} onChange={(pathParams) => onChange({ pathParams })} namePlaceholder="Path parameter" /></section>
            <section><header><strong>Query parameters</strong><small>Enabled rows are appended in order; duplicate names are preserved.</small></header><KeyValueEditor detailed rows={request.params} onChange={(params) => onChange({ params })} namePlaceholder="Query parameter" /></section>
          </div>
        ) : null}
        {activeTab === 'headers' && request.protocol !== 'grpc' ? (
          <KeyValueEditor detailed rows={request.headers} onChange={(headers) => onChange({ headers })} namePlaceholder="Header" />
        ) : null}
        {activeTab === 'headers' && request.protocol === 'grpc' ? (
          <KeyValueEditor rows={request.grpc.metadata} onChange={(metadata) => onChange({ grpc: { ...request.grpc, metadata } })} namePlaceholder="Metadata" />
        ) : null}
        {activeTab === 'auth' ? <div className="folder-auth-editor"><label><input checked={request.inheritFolderAuth === true} disabled={!request.folderId || !folderAncestors(collection, request.folderId).some((folder) => folder.auth)} onChange={(event) => onChange({ inheritFolderAuth: event.target.checked })} type="checkbox" /> Inherit authentication from closest configured folder</label><AuthEditor cookies={workspaceCookies} environment={environment} request={request} requestContext={requestContext} responses={storedResponses} onChange={onChange} /></div> : null}
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
        {activeTab === 'docs' ? <div className="request-docs-editor"><header><strong>Request documentation</strong><small>Markdown source</small></header><textarea aria-label="Request documentation" onChange={(event) => onChange({ documentation: event.target.value })} placeholder="Describe this request, its inputs, and expected behavior…" value={request.documentation ?? ''} /><section><small>Preview</small><pre>{request.documentation || 'No documentation yet.'}</pre></section></div> : null}
      </div>
      <div className="panel-footer"><span>{activeTab === 'body' ? 'Body' : titleCase(activeTab)}</span><span>UTF-8 · LF</span></div>
    </section>
  );
}

type ResponsePanelProps = {
  response: HttpResponse;
  responseHistory: StoredResponse[];
  selectedResponseId: string;
  protocol: Protocol;
  activeTab: ResponseTab;
  isSending: boolean;
  streamMessages: StreamMessage[];
  streamStatus: 'disconnected' | 'connecting' | 'connected' | 'reconnecting';
  streamDraft: string;
  streamFrameKind: 'text' | 'binary';
  scriptTests: Array<{ name: string; passed: boolean; error?: string }>;
  scriptLogs: string[];
  cookies: CookieRecord[];
  requestUrl: string;
  onChangeCookies: (cookies: CookieRecord[]) => void;
  onSelectResponse: (id: string) => void;
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
  responseHistory,
  selectedResponseId,
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
  onSelectResponse,
  onTabChange,
  onStreamDraftChange,
  onStreamFrameKindChange,
  onSendStreamMessage,
}: ResponsePanelProps) {
  const streaming = protocol === 'websocket' || protocol === 'sse';
  const displayBody = prettyBody(response.body);
  const lines = displayBody.split('\n');
  const timelineEntries = response.timeline?.length ? response.timeline : [
    { name: 'Text' as const, value: 'Request started', elapsedMs: 0 },
    { name: 'Text' as const, value: `Response ${response.status} ${response.statusText}`, elapsedMs: response.durationMs },
    ...(response.httpVersion ? [{ name: 'Text' as const, value: `Negotiated ${response.httpVersion}`, elapsedMs: response.durationMs }] : []),
    { name: 'Text' as const, value: 'Response body decoded', elapsedMs: response.durationMs },
  ];
  const copyResponse = () => void navigator.clipboard.writeText(displayBody);
  return (
    <section className="response-panel">
      <div className="response-document-spacer" />
      <div className="response-summary">
        <div className="response-metrics">
          <strong className={streaming ? streamStatus === 'connected' ? 'ok' : '' : response.status > 0 && response.status < 400 ? 'ok' : 'bad'}>
            {streaming ? streamStatus === 'connected' ? 'LIVE' : streamStatus === 'connecting' || streamStatus === 'reconnecting' ? '···' : 'OFF' : isSending ? '···' : response.status || 'Error'}
          </strong>
          <span className={!streaming && response.status > 0 && response.status < 400 ? 'ok' : !streaming ? 'bad' : ''}>{streaming ? protocol === 'websocket' ? 'WebSocket' : 'Event stream' : response.statusText}</span>
          <span>{streaming ? `${streamMessages.length} events` : `${response.durationMs} ms`}</span>
          {!streaming ? <span>{formatBytes(response.sizeBytes)}</span> : null}
          {!streaming && response.httpVersion ? <span>{response.httpVersion}</span> : null}
        </div>
        {!streaming && responseHistory.length ? <label className="response-history-picker"><Icon name="history" size={15} /><select aria-label="Saved response" onChange={(event) => onSelectResponse(event.target.value)} value={selectedResponseId}>{selectedResponseId ? null : <option value="">Live response</option>}{responseHistory.map((saved) => <option key={saved.id} value={saved.id}>{new Date(saved.receivedAt).toLocaleString()} · {saved.status || 'ERR'} · {saved.durationMs} ms</option>)}</select></label> : <button aria-label="Response source" className="icon-button subtle" disabled type="button"><Icon name="globe" size={18} /></button>}
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
            {timelineEntries.map((entry, index) => <div className={`timeline-entry${entry.hidden ? ' hidden' : ''}`} key={`${entry.name}-${entry.elapsedMs}-${index}`}><span className={`timeline-dot${index === timelineEntries.length - 1 ? ' ok' : ''}`} /><div><strong>{entry.name}</strong><pre>{entry.value || ' '}</pre></div><time>{entry.elapsedMs} ms</time></div>)}
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
  environments: Environment[];
  activeId: string;
  onClose: () => void;
  onChange: (environment: Environment) => void;
  onSelect: (id: string) => void;
  onAdd: (parentId: string) => void;
  onDelete: (id: string) => void;
};

function EnvironmentDialog({ environments, activeId, onClose, onChange, onSelect, onAdd, onDelete }: EnvironmentDialogProps) {
  const environment = environments.find((candidate) => candidate.id === activeId) ?? environments[0];
  if (!environment) return null;
  const resolved = resolveEnvironment(environments, environment.id) ?? environment;
  const ownNames = new Set(environment.variables.map((variable) => variable.name));
  const inherited = resolved.variables.filter((variable) => !ownNames.has(variable.name));
  const publicIds = new Set(publicEnvironments(environments).map((candidate) => candidate.id));
  const roots = environments.filter((candidate) => !candidate.parentId);
  const renderEnvironment = (candidate: Environment, depth: number): ReactNode => <div key={candidate.id}><button className={candidate.id === environment.id ? 'active' : ''} onClick={() => onSelect(candidate.id)} style={{ '--environment-depth': depth } as CSSProperties} type="button"><i style={{ background: candidate.color || 'var(--muted)' }} /><span>{candidate.name}</span>{candidate.private ? <small>PRIVATE</small> : null}</button>{environments.filter((child) => child.parentId === candidate.id).map((child) => renderEnvironment(child, depth + 1))}</div>;
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section aria-labelledby="environment-title" aria-modal="true" className="modal environment-modal" onMouseDown={(event) => event.stopPropagation()} role="dialog">
        <header><div><small>Active environment</small><h2 id="environment-title">{environment.name}</h2></div><button aria-label="Close" className="icon-button subtle" onClick={onClose} type="button"><Icon name="x" /></button></header>
        <div className="environment-layout"><aside><div>{roots.map((candidate) => renderEnvironment(candidate, 0))}</div><button onClick={() => onAdd('')} type="button"><Icon name="plus" size={13} /> Base environment</button><button onClick={() => onAdd(environment.id)} type="button"><Icon name="plus" size={13} /> Sub-environment</button></aside><main>
          <div className="environment-identity"><label>Name<input onChange={(event) => onChange({ ...environment, name: event.target.value })} value={environment.name} /></label><label>Parent<select onChange={(event) => { const parentId = event.target.value; onChange({ ...environment, parentId, private: parentId ? environment.private || !publicIds.has(parentId) : false }); }} value={environment.parentId ?? ''}><option value="">None (base)</option>{environments.filter((candidate) => candidate.id !== environment.id && !environmentAncestors(environments, candidate.id).some((ancestor) => ancestor.id === environment.id)).map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}</select></label><label>Color<input onChange={(event) => onChange({ ...environment, color: event.target.value })} type="color" value={environment.color || '#7e8a91'} /></label><label className="private-environment"><input checked={environment.private === true} disabled={!environment.parentId || !publicIds.has(environment.parentId)} onChange={(event) => onChange({ ...environment, private: event.target.checked })} type="checkbox" /> Private on this device</label></div>
          <p>Own values override inherited values immediately. Private sub-environments are omitted from project sync and exports; use vault references for encrypted secrets.</p>
          {inherited.length ? <div className="inherited-variables"><strong>Inherited from parent</strong>{inherited.map((variable) => <span key={variable.name}><code>{variable.name}</code><em>{variable.value}</em></span>)}</div> : null}
          <KeyValueEditor rows={environment.variables} onChange={(variables) => onChange({ ...environment, variables })} namePlaceholder="Variable" />
        </main></div>
        <footer><button className="danger-action" disabled={environments.length <= 1} onClick={() => onDelete(environment.id)} type="button">Delete</button><span className="footer-spacer" /><button className="secondary-button" onClick={onClose} type="button">Done</button></footer>
      </section>
    </div>
  );
}

type CollectionDialogProps = {
  collection: Workspace['collections'][number];
  onChange: (collection: Workspace['collections'][number]) => void;
  onClose: () => void;
};

function CollectionDialog({ collection, onChange, onClose }: CollectionDialogProps) {
  const [tab, setTab] = useState<'variables' | 'docs'>('variables');
  const selectedEnvironment = (collection.subEnvironments ?? []).find((environment) => environment.id === collection.activeSubEnvironmentId);
  const selectEnvironment = (activeSubEnvironmentId: string) => onChange({ ...collection, activeSubEnvironmentId });
  const addEnvironment = () => {
    const id = uid('collection-environment');
    onChange({
      ...collection,
      activeSubEnvironmentId: id,
      subEnvironments: [...(collection.subEnvironments ?? []), { id, name: `Environment ${(collection.subEnvironments?.length ?? 0) + 1}`, variables: [] }],
    });
  };
  const updateSelectedEnvironment = (patch: Partial<NonNullable<typeof selectedEnvironment>>) => {
    if (!selectedEnvironment) return;
    onChange({ ...collection, subEnvironments: (collection.subEnvironments ?? []).map((environment) => environment.id === selectedEnvironment.id ? { ...environment, ...patch } : environment) });
  };
  const deleteSelectedEnvironment = () => {
    if (!selectedEnvironment || !window.confirm(`Delete collection environment “${selectedEnvironment.name}”?`)) return;
    onChange({ ...collection, activeSubEnvironmentId: '', subEnvironments: (collection.subEnvironments ?? []).filter((environment) => environment.id !== selectedEnvironment.id) });
  };
  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}><section aria-labelledby="collection-settings-title" aria-modal="true" className="modal folder-modal collection-modal" onMouseDown={(event) => event.stopPropagation()} role="dialog">
    <header><div><small>Collection configuration</small><h2 id="collection-settings-title">{collection.name}</h2></div><button aria-label="Close" className="icon-button subtle" onClick={onClose} type="button"><Icon name="x" /></button></header>
    <div className="folder-identity"><label>Name<input autoFocus onChange={(event) => onChange({ ...collection, name: event.target.value })} value={collection.name} /></label></div>
    <nav aria-label="Collection settings" className="interchange-tabs"><button className={tab === 'variables' ? 'active' : ''} onClick={() => setTab('variables')} type="button">Variables</button><button className={tab === 'docs' ? 'active' : ''} onClick={() => setTab('docs')} type="button">Docs</button></nav>
    <div className="folder-modal-content">
      {tab === 'variables' ? <div className="environment-layout collection-environment-layout"><aside><div><button className={!selectedEnvironment ? 'active' : ''} onClick={() => selectEnvironment('')} type="button"><i /><span>Base environment</span><small>BASE</small></button>{(collection.subEnvironments ?? []).map((environment) => <button className={selectedEnvironment?.id === environment.id ? 'active' : ''} key={environment.id} onClick={() => selectEnvironment(environment.id)} type="button"><i /><span>{environment.name}</span></button>)}</div><button onClick={addEnvironment} type="button"><Icon name="plus" size={13} /> Sub-environment</button></aside><main>
        {selectedEnvironment ? <div className="environment-identity collection-environment-identity"><label>Name<input onChange={(event) => updateSelectedEnvironment({ name: event.target.value })} value={selectedEnvironment.name} /></label></div> : <strong>Collection base environment</strong>}
        <p>{selectedEnvironment ? 'The selected collection environment overrides the collection base and selected global values.' : 'Base collection values override selected and base global values for every request in this collection.'}</p>
        <KeyValueEditor namePlaceholder="Variable" onChange={(variables) => selectedEnvironment ? updateSelectedEnvironment({ variables }) : onChange({ ...collection, environment: variables })} rows={selectedEnvironment?.variables ?? collection.environment ?? []} />
        {selectedEnvironment ? <button className="danger-action collection-environment-delete" onClick={deleteSelectedEnvironment} type="button">Delete sub-environment</button> : null}
      </main></div> : null}
      {tab === 'docs' ? <div className="request-docs-editor"><header><strong>Collection documentation</strong><small>Markdown source</small></header><textarea aria-label="Collection documentation" onChange={(event) => onChange({ ...collection, documentation: event.target.value })} value={collection.documentation ?? ''} /><section><small>Preview</small><pre>{collection.documentation || 'No documentation yet.'}</pre></section></div> : null}
    </div>
    <footer><span className="footer-spacer" /><button className="secondary-button" onClick={onClose} type="button">Done</button></footer>
  </section></div>;
}

type FolderDialogProps = {
  collection: Workspace['collections'][number];
  folder: RequestFolder;
  environment: Environment;
  cookies: CookieRecord[];
  responses: StoredResponse[];
  requestContext: SendRequestContext;
  onChange: (folder: RequestFolder) => void;
  onClose: () => void;
  onDelete: () => void;
};

function FolderDialog({ collection, folder, environment, cookies, responses, requestContext, onChange, onClose, onDelete }: FolderDialogProps) {
  const [tab, setTab] = useState<'variables' | 'headers' | 'auth' | 'scripts' | 'docs'>('variables');
  const authRequest = createBlankRequest(`folder-auth-${folder.id}`);
  authRequest.auth = folder.auth ?? authRequest.auth;
  const invalidParents = new Set([folder.id, ...(collection.folders ?? []).filter((candidate) => folderAncestors(collection, candidate.id).some((ancestor) => ancestor.id === folder.id)).map((candidate) => candidate.id)]);
  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}><section aria-labelledby="folder-title" aria-modal="true" className="modal folder-modal" onMouseDown={(event) => event.stopPropagation()} role="dialog">
    <header><div><small>Inherited request configuration</small><h2 id="folder-title">{folder.name}</h2></div><button aria-label="Close" className="icon-button subtle" onClick={onClose} type="button"><Icon name="x" /></button></header>
    <div className="folder-identity"><label>Name<input autoFocus onChange={(event) => onChange({ ...folder, name: event.target.value })} value={folder.name} /></label><label>Parent folder<select onChange={(event) => onChange({ ...folder, parentId: event.target.value })} value={folder.parentId}><option value="">Collection root</option>{(collection.folders ?? []).filter((candidate) => !invalidParents.has(candidate.id)).map((candidate) => <option key={candidate.id} value={candidate.id}>{folderPath(collection, candidate.id)}</option>)}</select></label></div>
    <nav className="interchange-tabs" aria-label="Folder settings">{(['variables', 'headers', 'auth', 'scripts', 'docs'] as const).map((item) => <button className={tab === item ? 'active' : ''} key={item} onClick={() => setTab(item)} type="button">{titleCase(item)}</button>)}</nav>
    <div className="folder-modal-content">
      {tab === 'variables' ? <><p>Folder values override collection and selected environment values for every descendant request.</p><KeyValueEditor namePlaceholder="Variable" onChange={(variables) => onChange({ ...folder, environment: variables })} rows={folder.environment} /></> : null}
      {tab === 'headers' ? <><p>Closer folders and request headers override inherited headers with the same name.</p><KeyValueEditor namePlaceholder="Header" onChange={(headers) => onChange({ ...folder, headers })} rows={folder.headers} /></> : null}
      {tab === 'auth' ? <><label className="folder-auth-toggle"><input checked={Boolean(folder.auth)} onChange={(event) => onChange({ ...folder, auth: event.target.checked ? authRequest.auth : undefined })} type="checkbox" /> Configure inheritable authentication</label>{folder.auth ? <AuthEditor cookies={cookies} environment={environment} onChange={(patch) => { if (patch.auth) onChange({ ...folder, auth: patch.auth }); }} request={authRequest} requestContext={requestContext} responses={responses} /> : <div className="empty-state compact"><Icon name="lock" size={24} /><strong>No folder authentication</strong><span>Enable it here, then choose “Inherit” on descendant requests.</span></div>}</> : null}
      {tab === 'scripts' ? <div className="folder-script-grid"><section><header>Pre-request · root to request</header><CodeEditor ariaLabel="Folder pre-request script" onChange={(preRequestScript) => onChange({ ...folder, preRequestScript })} value={folder.preRequestScript} /></section><section><header>After-response · request to root</header><CodeEditor ariaLabel="Folder after-response script" onChange={(tests) => onChange({ ...folder, tests })} value={folder.tests} /></section></div> : null}
      {tab === 'docs' ? <div className="request-docs-editor"><header><strong>Folder documentation</strong><small>Markdown source</small></header><textarea aria-label="Folder documentation" onChange={(event) => onChange({ ...folder, documentation: event.target.value })} value={folder.documentation} /><section><small>Preview</small><pre>{folder.documentation || 'No documentation yet.'}</pre></section></div> : null}
    </div>
    <footer><button className="danger-action" onClick={onDelete} type="button">Delete folder</button><span className="footer-spacer" /><button className="secondary-button" onClick={onClose} type="button">Done</button></footer>
  </section></div>;
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
    format: 'brunomnia', version: 14, name: 'Loading…', activeRequestId: '', activeEnvironmentId: '', collections: [], environments: [], history: [], apiDesigns: [], mockServers: [], runnerReports: [], imports: [], cookies: [], responses: [], project: { mode: 'local', path: '', remoteUrl: '', remoteName: 'origin', authorName: '', authorEmail: '', autoSave: true }, plugins: [], pluginData: {}, activePluginTheme: '', collaboration: { mode: 'off', path: '', actor: '', revision: 0 }, governance: { currentMemberId: 'local-owner', members: [{ id: 'local-owner', name: 'Local owner', email: '', role: 'owner', active: true }], policy: { allowedStorage: ['local', 'folder', 'git', 'encrypted-file'], requireEncryptedSync: true, requireVaultForSecrets: true, externalVaultAllowlist: [], auditRetention: 500 }, audit: [] }, mcpClients: [], ai: { enabled: false, provider: 'openai-compatible', baseUrl: 'http://127.0.0.1:11434/v1', model: '', apiKey: '', mockGeneration: false, commitSuggestions: false }, konnect: { enabled: false, baseUrl: 'https://us.api.konghq.com', token: '', controlPlaneId: '', controlPlanes: [] }, preferences: { theme: 'system', density: 'comfortable', fontSize: 13, preferredHttpVersion: 'default', maxRedirects: 10, followRedirects: true, maxTimelineDataSizeKB: 10, maxHistoryResponses: 20, filterResponsesByEnv: false, requestTimeoutMs: 30000, scriptTimeoutMs: 10000, allowScriptRequests: false, allowScriptFileAccess: false, enableVaultInScripts: false, autoFetchGraphqlSchema: true, confirmDestructive: true, shortcuts: { palette: 'Mod+K', preferences: 'Mod+,', send: 'Mod+Enter', environment: 'Mod+E', history: 'Mod+Shift+H', 'toggle-sidebar': 'Mod+\\', 'new-request': 'Mod+N', 'duplicate-request': 'Mod+D', 'delete-request': 'Mod+Shift+Backspace', 'focus-url': 'Mod+L', 'generate-code': 'Mod+Shift+G' } },
  }));
  const [hydrated, setHydrated] = useState(false);
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>('collections');
  const [search, setSearch] = useState('');
  const [requestTab, setRequestTab] = useState<RequestTab>('body');
  const [responseTab, setResponseTab] = useState<ResponseTab>('preview');
  const [response, setResponse] = useState<HttpResponse>(() => mockResponse());
  const [selectedResponseId, setSelectedResponseId] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showEnvironment, setShowEnvironment] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showSendOptions, setShowSendOptions] = useState(false);
  const [showCodeGeneration, setShowCodeGeneration] = useState(false);
  const [folderEditor, setFolderEditor] = useState<{ collectionId: string; folderId: string }>();
  const [collectionEditor, setCollectionEditor] = useState<string>();
  const [sendDelayMs, setSendDelayMs] = useState(0);
  const [repeatIntervalMs, setRepeatIntervalMs] = useState(1_000);
  const [scheduledSendLabel, setScheduledSendLabel] = useState('');
  const [sidebarHidden, setSidebarHidden] = useState(false);
  const [streamStatus, setStreamStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'reconnecting'>('disconnected');
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
  const activeCollection = workspace.collections.find((collection) => collection.id === active?.collectionId);
  activeRequestIdRef.current = workspace.activeRequestId;
  const selectedEnvironment = workspace.environments.find((environment) => environment.id === workspace.activeEnvironmentId);
  const activeEnvironment = useMemo(() => resolveEnvironment(workspace.environments, workspace.activeEnvironmentId), [workspace.activeEnvironmentId, workspace.environments]);
  const activeResponseHistory = useMemo(() => visibleResponseHistory(
    workspace.responses,
    active?.request.id ?? '',
    activeEnvironment?.id ?? '',
    workspace.preferences.filterResponsesByEnv,
  ), [active?.request.id, activeEnvironment?.id, workspace.preferences.filterResponsesByEnv, workspace.responses]);
  const unlockedVault = useMemo(() => vaultVariables(vaultSession), [vaultSession]);
  const externalSecretResolver = useCallback((input: ExternalSecretInput) => resolveAuthorizedExternalSecret(workspace, input), [workspace]);

  useEffect(() => {
    if (!hydrated || !active || active.request.protocol === 'websocket' || active.request.protocol === 'sse') return;
    const latest = activeResponseHistory[0];
    setSelectedResponseId(latest?.id ?? '');
    setResponse(latest ?? mockResponse());
  }, [hydrated, workspace.activeRequestId, workspace.activeEnvironmentId, workspace.preferences.filterResponsesByEnv]);

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
        return { ...current, activeRequestId: id, collections: [{ id: uid('collection'), name: 'Requests', expanded: true, requests: [request], resourceOrder: [id] }] };
      }
      return {
        ...current,
        activeRequestId: id,
        collections: current.collections.map((collection, index) => index === 0
          ? { ...collection, expanded: true, requests: [...collection.requests, request], resourceOrder: [...(collection.resourceOrder ?? [...(collection.folders ?? []).map((folder) => folder.id), ...collection.requests.map((candidate) => candidate.id)]), id] }
          : collection),
      };
    });
    setWorkbenchSection('requests');
    setRequestTab('params');
  }, []);

  const addCollection = useCallback(() => {
    setWorkspace((current) => ({
      ...current,
      collections: [...current.collections, { id: uid('collection'), name: `Collection ${current.collections.length + 1}`, expanded: true, requests: [], folders: [], resourceOrder: [], environment: [], subEnvironments: [], activeSubEnvironmentId: '', documentation: '' }],
    }));
  }, []);

  const addFolder = (collectionId: string, parentId: string) => {
    const folderId = uid('folder');
    setWorkspace((current) => ({ ...current, collections: current.collections.map((collection) => collection.id === collectionId ? { ...collection, expanded: true, folders: [...(collection.folders ?? []), { id: folderId, name: 'Untitled Folder', parentId, expanded: true, headers: [], environment: [], preRequestScript: '', tests: '', documentation: '' }], resourceOrder: [...(collection.resourceOrder ?? [...(collection.folders ?? []).map((folder) => folder.id), ...collection.requests.map((request) => request.id)]), folderId] } : collection) }));
    setFolderEditor({ collectionId, folderId });
  };

  const updateFolder = (collectionId: string, folder: RequestFolder) => setWorkspace((current) => ({ ...current, collections: current.collections.map((collection) => collection.id === collectionId ? { ...collection, folders: (collection.folders ?? []).map((candidate) => candidate.id === folder.id ? folder : candidate) } : collection) }));

  const updateCollection = (updated: Workspace['collections'][number]) => setWorkspace((current) => ({ ...current, collections: current.collections.map((collection) => collection.id === updated.id ? updated : collection) }));

  const moveResource = useCallback((move: WorkspaceResourceMove) => setWorkspace((current) => moveWorkspaceResource(current, move)), []);

  const deleteFolder = (collectionId: string, folderId: string) => {
    if (workspace.preferences.confirmDestructive && !window.confirm('Delete this folder? Descendant requests and folders will move to its parent.')) return;
    setWorkspace((current) => ({ ...current, collections: current.collections.map((collection) => {
      if (collection.id !== collectionId) return collection;
      const folder = (collection.folders ?? []).find((candidate) => candidate.id === folderId);
      if (!folder) return collection;
      return { ...collection, folders: (collection.folders ?? []).filter((candidate) => candidate.id !== folderId).map((candidate) => candidate.parentId === folderId ? { ...candidate, parentId: folder.parentId } : candidate), requests: collection.requests.map((request) => request.folderId === folderId ? { ...request, folderId: folder.parentId } : request), resourceOrder: (collection.resourceOrder ?? []).filter((id) => id !== folderId) };
    }) }));
    setFolderEditor(undefined);
  };

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
        const resourceOrder = [...(collection.resourceOrder ?? [...(collection.folders ?? []).map((folder) => folder.id), ...collection.requests.map((request) => request.id)])];
        const orderIndex = resourceOrder.indexOf(active.request.id);
        resourceOrder.splice(orderIndex < 0 ? resourceOrder.length : orderIndex + 1, 0, copy.id);
        return { ...collection, requests, resourceOrder };
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
        return { ...collection, requests, resourceOrder: (collection.resourceOrder ?? []).filter((id) => id !== active.request.id) };
      });
      if (!nextActive) nextActive = collections.flatMap((collection) => collection.requests)[0]?.id ?? '';
      if (!nextActive) {
        const request = createBlankRequest(uid('request'));
        request.transport.timeoutMs = current.preferences.requestTimeoutMs;
        if (!collections.length) collections = [{ id: uid('collection'), name: 'Requests', expanded: true, requests: [request], resourceOrder: [request.id] }];
        else collections = collections.map((collection, index) => index === 0 ? { ...collection, requests: [request], resourceOrder: [...(collection.resourceOrder ?? (collection.folders ?? []).map((folder) => folder.id)), request.id] } : collection);
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
    const collection = workspace.collections.find((candidate) => candidate.id === active.collectionId);
    if (!collection) return;
    const targetRequest = applyCollectionConfiguration(collection, active.request, activeEnvironment).request;
    setGraphqlSchemaLoading(true);
    try {
      const schema = await fetchGraphqlSchema(targetRequest, activeEnvironment, { cookies: workspace.cookies, responses: workspace.responses, preferredHttpVersion: workspace.preferences.preferredHttpVersion, maxRedirects: workspace.preferences.maxRedirects, followRedirects: workspace.preferences.followRedirects, maxTimelineDataSizeKB: workspace.preferences.maxTimelineDataSizeKB, filterResponsesByEnv: workspace.preferences.filterResponsesByEnv, vault: unlockedVault, externalSecret: externalSecretResolver });
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
    if (message.kind === 'reconnecting') setStreamStatus('reconnecting');
    if (message.kind === 'closed' || message.kind === 'close' || message.kind === 'error') setStreamStatus('disconnected');
  };

  const persistScriptState = (collectionId: string, result: ScriptRunResult) => {
    if (!selectedEnvironment) return;
    setWorkspace((current) => {
      const scopes = scriptEnvironmentScopes(current.environments, selectedEnvironment.id);
      if (!scopes) return current;
      const selected = current.environments.find((environment) => environment.id === scopes.selectedId);
      const base = current.environments.find((environment) => environment.id === scopes.baseId);
      if (!selected || !base) return current;
      const selectedAncestors = environmentAncestors(current.environments, selected.id);
      const inheritedGlobals = scopes.globalsAreBase ? {} : variableScope(selectedAncestors.slice(1).map((environment) => environment.variables)).values;
      const persistSelectedRows = (values: Record<string, string>, target: Environment, inheritedValues: Record<string, string>) => {
        const ownNames = new Set(target.variables.map((variable) => variable.name));
        const resultNames = new Set(Object.keys(values));
        return [
          ...Object.entries(values).filter(([name, value]) => ownNames.has(name) || inheritedValues[name] !== value).map(([name, value]) => ({
            ...(target.variables.find((candidate) => candidate.name === name) ?? { id: uid('variable'), name }), name, value, enabled: true,
          })),
          ...target.variables.filter((row) => !row.enabled && !resultNames.has(row.name)),
        ];
      };
      return {
        ...current,
        environments: current.environments.map((environment) => {
          if (environment.id === base.id) return { ...environment, variables: scriptVariableRows(result.baseGlobals ?? result.environment, base.variables, 'base-global-variable', result.baseGlobalDisabled) };
          if (!scopes.globalsAreBase && environment.id === selected.id) return { ...environment, variables: scriptVariableRows(persistSelectedRows(result.environment, selected, inheritedGlobals).filter((row) => row.enabled).reduce<Record<string, string>>((values, row) => ({ ...values, [row.name]: row.value }), {}), selected.variables, 'global-variable', result.globalDisabled) };
          return environment;
        }),
        collections: current.collections.map((candidate) => candidate.id !== collectionId ? candidate : {
          ...candidate,
          environment: result.baseEnvironment ? scriptVariableRows(result.baseEnvironment, candidate.environment ?? [], 'collection-base-variable', result.baseEnvironmentDisabled) : candidate.environment,
          subEnvironments: (candidate.subEnvironments ?? []).map((environment) => environment.id === candidate.activeSubEnvironmentId && result.collectionVariables
            ? { ...environment, variables: scriptVariableRows(result.collectionVariables, environment.variables, 'collection-environment-variable', result.collectionDisabled) }
            : environment),
          folders: (candidate.folders ?? []).map((folder) => {
            const output = result.folders?.find((item) => item.id === folder.id);
            return output ? { ...folder, environment: scriptVariableRows(output.environment, folder.environment, 'folder-variable', output.disabled) } : folder;
          }),
        }),
      };
    });
  };

  const executeRequest = async () => {
    if (!active || !activeEnvironment || !selectedEnvironment || isSending) return;
    const collection = workspace.collections.find((candidate) => candidate.id === active.collectionId);
    if (!collection) return;
    const configured = applyCollectionConfiguration(collection, active.request, activeEnvironment);
    const request = configured.request;
    const executionEnvironment = configured.environment;
    if (request.protocol === 'websocket' || request.protocol === 'sse') {
      if (streamStatus === 'connected' || streamStatus === 'reconnecting') {
        const sessionId = streamSession.current;
        if (!sessionId) return;
        setIsSending(true);
        try {
          await disconnectStream(request.protocol, sessionId);
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
      setIsSending(true);
      const sessionId = uid('stream');
      streamSession.current = sessionId;
      streamProtocol.current = request.protocol;
      try {
        await connectStream(request, { ...executionEnvironment, variables: [...executionEnvironment.variables, ...Object.entries(unlockedVault).map(([name, value]) => ({ id: `vault-${name}`, name, value, enabled: true }))] }, sessionId, onStreamEvent, workspace.preferences.preferredHttpVersion, workspace.preferences.maxRedirects, workspace.preferences.followRedirects);
        setStreamStatus('connected');
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        onStreamEvent({ id: uid('event'), direction: 'system', kind: 'error', text: message, timestamp: new Date().toISOString() });
      } finally {
        setIsSending(false);
      }
      return;
    }

    setIsSending(true);
    setResponseTab('preview');
    setScriptTests([]);
    setScriptLogs([]);
    let scriptCookies = [...workspace.cookies];
    let scriptResponses = [...workspace.responses];
    const pluginState: PluginRunState = { data: structuredClone(workspace.pluginData), notifications: [] };
    const pluginCallbacks: PluginHostCallbacks = {
      network: (pluginRequest) => sendRequest(pluginRequest, executionEnvironment, { cookies: workspace.cookies, responses: workspace.responses, preferredHttpVersion: workspace.preferences.preferredHttpVersion, maxRedirects: workspace.preferences.maxRedirects, followRedirects: workspace.preferences.followRedirects, maxTimelineDataSizeKB: workspace.preferences.maxTimelineDataSizeKB, filterResponsesByEnv: workspace.preferences.filterResponsesByEnv }),
      prompt: async (title, defaultValue) => window.prompt(title, defaultValue) ?? '',
      readClipboard: () => navigator.clipboard.readText(),
      writeClipboard: (value) => navigator.clipboard.writeText(value),
    };
    const pluginRuntime = createPluginRuntime(workspace.plugins, pluginState, pluginCallbacks);
    try {
      const globalScopes = scriptEnvironmentScopes(workspace.environments, selectedEnvironment.id);
      if (!globalScopes) throw new Error('The selected global environment could not be resolved.');
      const collectionScopes = collectionEnvironmentScopes(collection);
      const initialScriptScopes: ScriptRunOptions = {
        baseGlobals: globalScopes.baseGlobals.values,
        baseGlobalDisabled: globalScopes.baseGlobals.disabled,
        globalDisabled: globalScopes.globals.disabled,
        globalsAreBase: globalScopes.globalsAreBase,
        baseEnvironment: collectionScopes.baseEnvironment.values,
        baseEnvironmentDisabled: collectionScopes.baseEnvironment.disabled,
        collectionVariables: collectionScopes.environment.values,
        collectionDisabled: collectionScopes.environment.disabled,
        collectionVariablesAreBase: collectionScopes.environmentIsBase,
      };
      const runScript = (
        source: string,
        scriptRequest: ApiRequest,
        scriptResponse?: HttpResponse,
        localVariables: Record<string, string> = {},
        previous?: ScriptRunResult,
      ) => runBrowserScript(source, scriptRequest, previous?.environment ?? globalScopes.globals.values, scriptResponse, workspace.preferences.scriptTimeoutMs, localVariables, {}, {
        ...initialScriptScopes,
        baseGlobals: previous?.baseGlobals ?? initialScriptScopes.baseGlobals,
        baseGlobalDisabled: previous?.baseGlobalDisabled ?? initialScriptScopes.baseGlobalDisabled,
        globalDisabled: previous?.globalDisabled ?? initialScriptScopes.globalDisabled,
        baseEnvironment: previous?.baseEnvironment ?? initialScriptScopes.baseEnvironment,
        baseEnvironmentDisabled: previous?.baseEnvironmentDisabled ?? initialScriptScopes.baseEnvironmentDisabled,
        collectionVariables: previous?.collectionVariables ?? initialScriptScopes.collectionVariables,
        collectionDisabled: previous?.collectionDisabled ?? initialScriptScopes.collectionDisabled,
        folders: previous?.folders ?? scriptFolderVariables(configured.folders),
        readFile: workspace.preferences.allowScriptFileAccess && isTauri() ? readDesktopScriptFile : undefined,
        vault: workspace.preferences.enableVaultInScripts ? unlockedVault : undefined,
        sendRequest: workspace.preferences.allowScriptRequests ? async (subrequest, subrequestVariables) => {
          const subresponse = await sendRequest(subrequest, {
            ...executionEnvironment,
            variables: Object.entries(subrequestVariables).map(([name, value]) => ({ id: `script-request-${name}`, name, value, enabled: true })),
          }, {
            cookies: scriptCookies,
            responses: scriptResponses,
            preferredHttpVersion: workspace.preferences.preferredHttpVersion,
            maxRedirects: workspace.preferences.maxRedirects,
            followRedirects: workspace.preferences.followRedirects,
            maxTimelineDataSizeKB: workspace.preferences.maxTimelineDataSizeKB,
            filterResponsesByEnv: workspace.preferences.filterResponsesByEnv,
            vault: workspace.preferences.enableVaultInScripts ? unlockedVault : {},
          });
          const state = applyScriptSubresponse(scriptCookies, scriptResponses, subrequest, subresponse, undefined, executionEnvironment.id, workspace.preferences.maxHistoryResponses, workspace.preferences.filterResponsesByEnv);
          scriptCookies = state.cookies;
          scriptResponses = state.responses;
          return subresponse;
        } : undefined,
      });
      const preRequest = await runScript(request.preRequestScript, request);
      let executableRequest = preRequest.request;
      const requestVariables = mergedScriptVariables(preRequest, initialScriptScopes);
      setScriptLogs(preRequest.logs);
      persistScriptState(collection.id, preRequest);
      let result: HttpResponse;
      if (executableRequest.protocol === 'grpc') {
        executableRequest = await pluginRuntime.beforeRequest(executableRequest);
        const existingSchema = executableRequest.grpc.descriptorSetBase64 ? grpcSchemas[request.id] : undefined;
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
          ...executionEnvironment,
          variables: Object.entries({ ...requestVariables, ...unlockedVault }).map(([name, value]) => ({ id: `script-${name}`, name, value, enabled: true })),
        });
        const body = JSON.stringify({ status: output.status, callType: output.callType, messages: output.messages }, null, 2);
        result = await pluginRuntime.afterResponse(executableRequest, { status: 200, statusText: `gRPC ${output.status}`, headers: { 'grpc-call-type': output.callType }, body, durationMs: output.durationMs, sizeBytes: new Blob([body]).size });
      } else {
        result = await sendRequest(executableRequest, {
          ...executionEnvironment,
          variables: Object.entries(requestVariables).map(([name, value]) => ({ id: `script-${name}`, name, value, enabled: true })),
        }, { cookies: workspace.cookies, responses: workspace.responses, preferredHttpVersion: workspace.preferences.preferredHttpVersion, maxRedirects: workspace.preferences.maxRedirects, followRedirects: workspace.preferences.followRedirects, maxTimelineDataSizeKB: workspace.preferences.maxTimelineDataSizeKB, filterResponsesByEnv: workspace.preferences.filterResponsesByEnv, pluginRuntime, vault: unlockedVault, externalSecret: externalSecretResolver });
      }
      const afterResponse = await runScript(executableRequest.tests, executableRequest, result, preRequest.localVariables, preRequest);
      setScriptTests(afterResponse.tests);
      setScriptLogs((current) => [...current, ...afterResponse.logs, ...pluginState.notifications.map((notification) => `[plugin] ${notification.title}: ${notification.message}`)]);
      persistScriptState(collection.id, afterResponse);
      setResponse(result);
      const receivedAt = new Date().toISOString();
      const historyEntry: HistoryEntry = {
        id: uid('history'), requestId: active.request.id, name: active.request.name, method: active.request.method,
        url: active.request.url, status: result.status, durationMs: result.durationMs, createdAt: receivedAt,
      };
      const storedResponse: StoredResponse = {
        ...result,
        id: uid('response'),
        requestId: active.request.id,
        requestName: active.request.name,
        requestUrl: result.requestUrl ?? executableRequest.url,
        environmentId: executionEnvironment.id,
        receivedAt,
      };
      setSelectedResponseId(workspace.preferences.maxHistoryResponses === 0 ? '' : storedResponse.id);
      setWorkspace((current) => ({
        ...current,
        history: [historyEntry, ...current.history].slice(0, 100),
        responses: retainResponseHistory(scriptResponses, storedResponse, current.preferences.maxHistoryResponses, current.preferences.filterResponsesByEnv),
        cookies: executableRequest.transport.storeCookies
          ? storeResponseCookies(scriptCookies, storedResponse.requestUrl, result.setCookies ?? [])
          : scriptCookies,
        pluginData: pluginState.data,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setResponse({ status: 0, statusText: 'Request failed', headers: {}, body: message, durationMs: 0, sizeBytes: message.length });
      setScriptLogs((current) => [...current, ...pluginState.notifications.map((notification) => `[plugin] ${notification.title}: ${notification.message}`)]);
      setWorkspace((current) => ({ ...current, cookies: scriptCookies, responses: scriptResponses, pluginData: pluginState.data }));
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
        setShowCodeGeneration(false);
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
      else if (shortcutMatches(event, shortcuts['generate-code'])) action(() => {
        if (active && (active.request.protocol === 'http' || active.request.protocol === 'graphql')) setShowCodeGeneration(true);
      });
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
    const result = await sendRequest(request, activeEnvironment, { cookies: workspace.cookies, responses: workspace.responses, preferredHttpVersion: workspace.preferences.preferredHttpVersion, maxRedirects: workspace.preferences.maxRedirects, followRedirects: workspace.preferences.followRedirects, maxTimelineDataSizeKB: workspace.preferences.maxTimelineDataSizeKB, filterResponsesByEnv: workspace.preferences.filterResponsesByEnv });
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

  const addEnvironment = (parentId: string) => {
    const id = uid('environment');
    setWorkspace((current) => {
      const publicIds = new Set(publicEnvironments(current.environments).map((environment) => environment.id));
      return { ...current, activeEnvironmentId: id, environments: [...current.environments, { id, name: parentId ? 'New Sub-environment' : 'New Base Environment', variables: [], parentId, private: Boolean(parentId) && !publicIds.has(parentId), color: '#69bddd' }] };
    });
  };

  const deleteEnvironment = (id: string) => {
    if (workspace.environments.length <= 1) return;
    if (workspace.preferences.confirmDestructive && !window.confirm('Delete this environment? Child environments will move to its parent.')) return;
    setWorkspace((current) => {
      const deleted = current.environments.find((environment) => environment.id === id);
      if (!deleted) return current;
      const environments = current.environments.filter((environment) => environment.id !== id).map((environment) => environment.parentId === id ? { ...environment, parentId: deleted.parentId ?? '', private: environment.private || deleted.private === true } : environment);
      return { ...current, environments, activeEnvironmentId: current.activeEnvironmentId === id ? environments.find((environment) => environment.id === deleted.parentId)?.id ?? environments[0].id : current.activeEnvironmentId };
    });
  };

  const editingCollection = workspace.collections.find((collection) => collection.id === folderEditor?.collectionId);
  const editingFolder = editingCollection?.folders?.find((folder) => folder.id === folderEditor?.folderId);
  const configuredCollection = workspace.collections.find((collection) => collection.id === collectionEditor);

  if (!hydrated || !active || !activeCollection || !activeEnvironment || !selectedEnvironment) {
    return <main className="loading-screen"><div className="brand-mark"><span /></div><strong>Brunomnia</strong><span>Opening local workspace…</span></main>;
  }
  const codegenConfiguration = applyCollectionConfiguration(activeCollection, active.request, activeEnvironment);

  return (
    <main className="app-shell" data-density={workspace.preferences.density} data-theme={workspace.activePluginTheme ? 'plugin' : workspace.preferences.theme} style={{ '--editor-font-size': `${workspace.preferences.fontSize}px` } as CSSProperties}>
      <header className="topbar">
        <div className="brand"><div className="brand-mark"><span /></div><strong>Brunomnia</strong></div>
        <button className="workspace-switcher" type="button"><Icon name="archive" size={17} /><span>{workspace.name}</span><Icon name="chevron-down" size={15} /></button>
        <button className="command-trigger" onClick={() => setShowPalette(true)} type="button"><Icon name="search" size={17} /><span>Search or run command…</span><kbd>{workspace.preferences.shortcuts.palette.replace('Mod', '⌘/Ctrl')}</kbd></button>
        <select aria-label="Environment" className="environment-switcher" onChange={(event) => setWorkspace((current) => ({ ...current, activeEnvironmentId: event.target.value }))} value={workspace.activeEnvironmentId}>
          {workspace.environments.map((environment) => <option key={environment.id} value={environment.id}>{`${'— '.repeat(environmentAncestors(workspace.environments, environment.id).length)}${environment.name}${environment.private ? ' · private' : ''}`}</option>)}
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
          onAddFolder={addFolder}
          onEditCollection={setCollectionEditor}
          onEditFolder={(collectionId, folderId) => setFolderEditor({ collectionId, folderId })}
          onMoveResource={moveResource}
          onAddRequest={addRequest}
          onSearch={setSearch}
          onSelectRequest={(id) => setWorkspace((current) => ({ ...current, activeRequestId: id }))}
          onToggleCollection={(id) => setWorkspace((current) => ({ ...current, collections: current.collections.map((collection) => collection.id === id ? { ...collection, expanded: !collection.expanded } : collection) }))}
          onToggleFolder={(collectionId, folderId) => setWorkspace((current) => ({ ...current, collections: current.collections.map((collection) => collection.id === collectionId ? { ...collection, folders: (collection.folders ?? []).map((folder) => folder.id === folderId ? { ...folder, expanded: !folder.expanded } : folder) } : collection) }))}
          search={search}
          workspace={workspace}
        /> : null}

        {workbenchSection === 'requests' ? <div className="workbench">
          <RequestPanel
            activeTab={requestTab}
            collection={activeCollection}
            environment={activeEnvironment}
            grpcSchema={grpcSchemas[active.request.id]}
            graphqlSchemaLoading={graphqlSchemaLoading}
            grpcSchemaLoading={grpcSchemaLoading}
            isSending={isSending}
            onChange={updateActiveRequest}
            onAddRequest={addRequest}
            onCancelScheduled={cancelScheduledSends}
            onGenerateCode={() => setShowCodeGeneration(true)}
            onLoadGraphqlSchema={() => void loadActiveGraphqlSchema()}
            onLoadGrpcSchema={() => void loadActiveGrpcSchema()}
            onOpenSendOptions={() => setShowSendOptions(true)}
            onSend={() => void executeRequest()}
            onTabChange={setRequestTab}
            request={active.request}
            requestContext={{ preferredHttpVersion: workspace.preferences.preferredHttpVersion, maxRedirects: workspace.preferences.maxRedirects, followRedirects: workspace.preferences.followRedirects, maxTimelineDataSizeKB: workspace.preferences.maxTimelineDataSizeKB, filterResponsesByEnv: workspace.preferences.filterResponsesByEnv, vault: unlockedVault, externalSecret: externalSecretResolver }}
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
            onSelectResponse={(id) => { const saved = activeResponseHistory.find((candidate) => candidate.id === id); if (saved) { setSelectedResponseId(id); setResponse(saved); } }}
            onStreamDraftChange={setStreamDraft}
            onStreamFrameKindChange={setStreamFrameKind}
            onTabChange={setResponseTab}
            protocol={active.request.protocol}
            response={response}
            responseHistory={activeResponseHistory}
            requestUrl={response.requestUrl ?? active.request.url}
            selectedResponseId={selectedResponseId}
            scriptLogs={scriptLogs}
            scriptTests={scriptTests}
            streamDraft={streamDraft}
            streamFrameKind={streamFrameKind}
            streamMessages={streamMessages}
            streamStatus={streamStatus}
          />
        </div> : workbenchSection === 'git' ? <Suspense fallback={<div className="dialog-loading">Loading Git project…</div>}><ProjectWorkbench environment={activeEnvironment} onChangeWorkspace={(updater) => setWorkspace(updater)} requestContext={{ preferredHttpVersion: workspace.preferences.preferredHttpVersion, maxRedirects: workspace.preferences.maxRedirects, followRedirects: workspace.preferences.followRedirects, maxTimelineDataSizeKB: workspace.preferences.maxTimelineDataSizeKB, filterResponsesByEnv: workspace.preferences.filterResponsesByEnv, vault: unlockedVault, externalSecret: externalSecretResolver }} workspace={workspace} /></Suspense> : workbenchSection === 'plugins' ? <Suspense fallback={<div className="dialog-loading">Loading plugins…</div>}><PluginWorkbench onChangeWorkspace={(updater) => setWorkspace(updater)} workspace={workspace} /></Suspense> : workbenchSection === 'security' ? <Suspense fallback={<div className="dialog-loading">Loading security…</div>}><SecurityWorkbench onChangeWorkspace={(updater) => setWorkspace(updater)} onVaultSession={setVaultSession} vaultSession={vaultSession} workspace={workspace} /></Suspense> : workbenchSection === 'integrations' ? <Suspense fallback={<div className="dialog-loading">Loading integrations…</div>}><IntegrationWorkbench environment={activeEnvironment} onChangeWorkspace={(updater) => setWorkspace(updater)} requestContext={{ preferredHttpVersion: workspace.preferences.preferredHttpVersion, maxRedirects: workspace.preferences.maxRedirects, followRedirects: workspace.preferences.followRedirects, maxTimelineDataSizeKB: workspace.preferences.maxTimelineDataSizeKB, filterResponsesByEnv: workspace.preferences.filterResponsesByEnv, vault: unlockedVault, externalSecret: externalSecretResolver }} workspace={workspace} /></Suspense> : workbenchSection === 'preferences' ? <Suspense fallback={<div className="dialog-loading">Loading preferences…</div>}><PreferencesWorkbench onChangeWorkspace={(updater) => setWorkspace(updater)} workspace={workspace} /></Suspense> : (
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

      {showEnvironment ? <EnvironmentDialog activeId={workspace.activeEnvironmentId} environments={workspace.environments} onAdd={addEnvironment} onChange={updateEnvironment} onClose={() => setShowEnvironment(false)} onDelete={deleteEnvironment} onSelect={(activeEnvironmentId) => setWorkspace((current) => ({ ...current, activeEnvironmentId }))} /> : null}
      {configuredCollection ? <CollectionDialog collection={configuredCollection} onChange={updateCollection} onClose={() => setCollectionEditor(undefined)} /> : null}
      {editingCollection && editingFolder ? <FolderDialog collection={editingCollection} cookies={workspace.cookies} environment={activeEnvironment} folder={editingFolder} onChange={(folder) => updateFolder(editingCollection.id, folder)} onClose={() => setFolderEditor(undefined)} onDelete={() => deleteFolder(editingCollection.id, editingFolder.id)} requestContext={{ preferredHttpVersion: workspace.preferences.preferredHttpVersion, maxRedirects: workspace.preferences.maxRedirects, followRedirects: workspace.preferences.followRedirects, maxTimelineDataSizeKB: workspace.preferences.maxTimelineDataSizeKB, filterResponsesByEnv: workspace.preferences.filterResponsesByEnv, vault: unlockedVault, externalSecret: externalSecretResolver }} responses={workspace.responses} /> : null}
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
      {showCodeGeneration ? <CodeGenerationDialog onClose={() => setShowCodeGeneration(false)} request={codegenConfiguration.request} variables={environmentMap(codegenConfiguration.environment)} /> : null}
      {showPalette ? <CommandPalette onAddCollection={addCollection} onAddRequest={addRequest} onClose={() => setShowPalette(false)} onDesign={() => setWorkbenchSection('design')} onEnvironment={() => setShowEnvironment(true)} onExport={() => setShowExport(true)} onImport={() => setShowImport(true)} onMocks={() => setWorkbenchSection('mocks')} onPreferences={() => setWorkbenchSection('preferences')} onRunner={() => setWorkbenchSection('runner')} /> : null}
    </main>
  );
}
