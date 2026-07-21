import { lazy, Suspense, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { CSSProperties, DragEvent as ReactDragEvent, KeyboardEvent as ReactKeyboardEvent, ReactNode, RefObject } from 'react';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { createBlankRequest } from './data/seed';
import { HttpTransportError, sendRequest as sendHttpRequest, type SendRequestContext } from './lib/http';
import { storeResponseCookies } from './lib/cookies';
import { connectStream, disconnectStream, isStreamingRequest, sendWebSocketMessage } from './lib/protocol';
import { fetchGraphqlSchema, formatGraphqlDocument } from './lib/graphql';
import { environmentMap, formatBytes, mockResponse, normalizeHttpMethod, prettyRequestBody } from './lib/request';
import { renderRequestValue } from './lib/requestRender';
import type { WorkspaceCatalogEntry, WorkspaceCatalogSnapshot, WorkspaceRecovery } from './lib/workspaceCatalog';
import { applyScriptSubresponse, runBrowserScript, type ScriptRunOptions } from './lib/scriptSandbox';
import type { RunningMock } from './lib/mock';
import { Icon } from './components/Icon';
import type { ArtifactImport } from './lib/interchange/types';
import { applyContextualPluginActionResult, applyPluginTheme, contextualPluginActionsFor, createPluginRuntime, describePlugin, discoverContextualPluginActions, pluginActionAuthorityKey, resolveContextualPluginActionInvocation, runPluginAction, type ContextualPluginAction, type PluginActionTarget, type PluginHostCallbacks, type PluginRunState } from './lib/plugins';
import { autoUnlockSavedVault, plaintextSecretCandidates, resolveAuthorizedExternalSecret, saveVault, saveVaultWithSavedKey, vaultVariables, type ExternalSecretInput, type VaultEntry, type VaultSession } from './lib/security';
import { duplicateEnvironmentSecrets, environmentHasSecrets, environmentSecretValue, environmentSecretVariables, removeEnvironmentSecrets, upsertEnvironmentSecret } from './lib/environmentSecrets';
import { defaultPreferences, shortcutDisplayLabel, shortcutEventOwner, shortcutMatches } from './lib/preferences';
import { applyCollectionConfiguration, collectionEnvironmentScopes, duplicateWorkspaceEnvironment, duplicateWorkspaceFolder, environmentAncestors, folderAncestors, folderPath, keyboardWorkspaceEnvironmentMove, keyboardWorkspaceResourceMove, moveWorkspaceEnvironment, moveWorkspaceResource, orderedCollectionChildren, persistEffectiveAuthentication, publicEnvironments, requestAncestorNames, resolveEnvironment, scriptEnvironmentScopes, variableScope } from './lib/resources';
import type { WorkspaceEnvironmentMove, WorkspaceResourceKeyboardAction, WorkspaceResourceMove } from './lib/resources';
import { clearSavedResponseHistory, createRequestSnapshot, deleteSavedResponse, responseHistorySections, retainResponseHistory, visibleResponseHistory } from './lib/responseHistory';
import { formatBulkKeyValues, parseBulkKeyValues } from './lib/bulkKeyValues';
import { formatEnvironmentJson, parseEnvironmentJson, validateEnvironmentJsonRow } from './lib/environmentJson';
import { parsePinnedRequestIds, pinnedWorkspaceRequests, reconcilePinnedRequestIds, togglePinnedRequestId } from './lib/requestPins';
import { closeAllRequestTabs, closeOtherRequestTabs, closeRequestTab, cycleRequestTab, emptyRequestTabState, moveRequestTab, openDocumentTab, openRequestTab, parseRequestTabState, promoteRequestTab, reconcileRequestTabState, reopenClosedDocumentTab } from './lib/requestTabs';
import type { DocumentTabReference, DocumentTabType, RequestTabPlacement, RequestTabState } from './lib/requestTabs';
import type { AppliedResponseMockTarget } from './lib/mockRouteFromResponse';
import type { OAuthAuthorizationStatus } from './components/OAuthAuthorizationDialog';
import { discardRunnerDraftEntries, runnerDraftKey, type RunnerWorkbenchDraft } from './lib/runner';
import { clearDeletedUnitTestRequest, createUnitTestSuite } from './lib/unitTests';
import { withoutOAuth2RuntimeCredentials } from './lib/oauth2Tokens';
import { userAgentDisabledAfterHeaderChange } from './lib/userAgent';
import { calculatedRequestHeaders, type CalculatedHeader } from './lib/calculatedHeaders';
import { filterScriptTests, scriptTestCategoryLabel, scriptTestDurationLabel, scriptTestPassed, scriptTestStatus, type ScriptTestFilter } from './lib/scriptTests';
import { isProjectWorkspaceEmpty, listProjectWorkspaces } from './lib/projectWorkspaces';
import { emptyWorkspaceFileState, getWorkspaceFileState, setWorkspaceFileCookies, workspaceFileIdForCollection, workspaceFileIdForEnvironment, workspaceFileIdForRequest } from './lib/workspaceFileState';
import type { ClientCodeSnippet, ClientCodeTarget } from './lib/codegen';
import type { TemplatePromptInput } from './lib/templates';
import {
  CodeEditor,
  GraphqlEditor,
  HttpBodyEditor,
  StreamSetup,
} from './components/ProtocolEditors';
import type {
  ApiRequest,
  Collection,
  CookieRecord,
  Environment,
  GrpcSchema,
  HistoryEntry,
  HttpMethod,
  HttpResponse,
  KeyValue,
  MockServer,
  Protocol,
  RequestFolder,
  RequestTab,
  ResponsePreviewMode,
  ResponseTab,
  ScriptRunResult,
  ScriptTestCategory,
  ScriptTestResult,
  SidebarMode,
  StreamMessage,
  StoredResponse,
  StoredStreamSession,
  Workspace,
  WorkbenchSection,
} from './types';

const ImportDialog = lazy(() => import('./components/InterchangeDialogs').then((module) => ({ default: module.ImportDialog })));
const ExportDialog = lazy(() => import('./components/InterchangeDialogs').then((module) => ({ default: module.ExportDialog })));
const WorkspaceSwitcher = lazy(() => import('./components/WorkspaceSwitcher').then((module) => ({ default: module.WorkspaceSwitcher })));
const CommandPalette = lazy(() => import('./components/CommandPalette').then((module) => ({ default: module.CommandPalette })));
const CreateMenu = lazy(() => import('./components/CommandPalette').then((module) => ({ default: module.CreateMenu })));
const CookieEditor = lazy(() => import('./components/CookieEditor').then((module) => ({ default: module.CookieEditor })));
const AuthEditor = lazy(() => import('./components/AuthEditor').then((module) => ({ default: module.AuthEditor })));
const SocketIoEditor = lazy(() => import('./components/SocketIoEditor').then((module) => ({ default: module.SocketIoEditor })));
const GrpcEditor = lazy(() => import('./components/GrpcEditor').then((module) => ({ default: module.GrpcEditor })));
const TransportEditor = lazy(() => import('./components/TransportEditor').then((module) => ({ default: module.TransportEditor })));
const StreamConsole = lazy(() => import('./components/StreamConsole').then((module) => ({ default: module.StreamConsole })));
const StreamHistoryControls = lazy(() => import('./components/StreamHistoryControls').then((module) => ({ default: module.StreamHistoryControls })));
const OAuthAuthorizationDialog = lazy(() => import('./components/OAuthAuthorizationDialog').then((module) => ({ default: module.OAuthAuthorizationDialog })));
const AutomationWorkbench = lazy(() => import('./components/AutomationWorkbench').then((module) => ({ default: module.AutomationWorkbench })));
const UnitTestWorkbench = lazy(() => import('./components/UnitTestWorkbench').then((module) => ({ default: module.UnitTestWorkbench })));
const ProjectWorkbench = lazy(() => import('./components/ProjectWorkbench').then((module) => ({ default: module.ProjectWorkbench })));
const PluginWorkbench = lazy(() => import('./components/PluginWorkbench').then((module) => ({ default: module.PluginWorkbench })));
const SecurityWorkbench = lazy(() => import('./components/SecurityWorkbench').then((module) => ({ default: module.SecurityWorkbench })));
const IntegrationWorkbench = lazy(() => import('./components/IntegrationWorkbench').then((module) => ({ default: module.IntegrationWorkbench })));
const PreferencesWorkbench = lazy(() => import('./components/PreferencesWorkbench').then((module) => ({ default: module.PreferencesWorkbench })));
const CodeGenerationDialog = lazy(() => import('./components/CodeGenerationDialog').then((module) => ({ default: module.CodeGenerationDialog })));
const TemplateTagDialog = lazy(() => import('./components/TemplateTagDialog').then((module) => ({ default: module.TemplateTagDialog })));
const TemplatePromptDialog = lazy(() => import('./components/TemplatePromptDialog').then((module) => ({ default: module.TemplatePromptDialog })));
const ResponseBodyPreview = lazy(() => import('./components/ResponseBodyPreview'));
const MockResponseExtractor = lazy(() => import('./components/MockResponseExtractor').then((module) => ({ default: module.MockResponseExtractor })));

const requestTabs: RequestTab[] = ['params', 'headers', 'auth', 'body', 'transport', 'scripts', 'tests', 'docs'];
const responseTabs: ResponseTab[] = ['preview', 'headers', 'cookies', 'timeline', 'tests', 'mock'];
const methods: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS', 'TRACE'];
const protocols: { value: Protocol; label: string }[] = [
  { value: 'http', label: 'HTTP' },
  { value: 'graphql', label: 'GraphQL' },
  { value: 'websocket', label: 'WebSocket' },
  { value: 'socketio', label: 'Socket.IO' },
  { value: 'sse', label: 'SSE' },
  { value: 'grpc', label: 'gRPC' },
];

const protocolLabel = (request: ApiRequest) => request.protocol === 'http' ? request.method
  : request.protocol === 'websocket' ? 'WS' : request.protocol === 'socketio' ? 'IO' : request.protocol.toUpperCase();
const methodClass = (method: string) => methods.includes(method as HttpMethod) ? method.toLowerCase() : 'custom';
type PendingTemplatePrompt = { id: string; input: TemplatePromptInput; resolve: (value: string | null) => void };

const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const requestPinsStorageKey = (workspaceId: string) => `brunomnia-request-pins:${workspaceId}`;
const requestTabsStorageKey = (workspaceId: string) => `brunomnia-request-tabs:${workspaceId}`;
const runnerDocumentId = (workspaceId: string, folderId = '') => `runner_${folderId || workspaceId}`;
const environmentDocumentId = (workspaceId: string) => `environment_${workspaceId}`;
const workspaceDocumentReferences = (workspace: Workspace, workspaceId: string): DocumentTabReference[] => [
  ...workspace.collections.flatMap((collection) => [
    { id: collection.id, type: 'collection' } as DocumentTabReference,
    ...collection.requests.map((request): DocumentTabReference => ({ id: request.id, type: 'request' })),
    ...(collection.folders ?? []).map((folder): DocumentTabReference => ({ id: folder.id, type: 'folder' })),
    ...(collection.folders ?? []).map((folder): DocumentTabReference => ({ id: runnerDocumentId(workspaceId, folder.id), type: 'runner' })),
  ]),
  ...workspace.apiDesigns.map((design): DocumentTabReference => ({ id: design.id, type: 'document' })),
  ...workspace.mockServers.flatMap((server): DocumentTabReference[] => [
    { id: server.id, type: 'mockServer' },
    ...server.routes.map((route): DocumentTabReference => ({ id: route.id, type: 'mockRoute' })),
  ]),
  ...workspace.testSuites.map((suite): DocumentTabReference => ({ id: suite.id, type: 'testSuite' })),
  { id: runnerDocumentId(workspaceId), type: 'runner' },
  { id: environmentDocumentId(workspaceId), type: 'environment' },
];
const workspaceCatalogApi = () => import('./lib/workspaceCatalog');

const visibleStreamSessions = (sessions: StoredStreamSession[], requestId: string, environmentId: string, filterResponsesByEnv: boolean) => sessions
  .filter((session) => session.requestId === requestId && (!filterResponsesByEnv || session.environmentId === environmentId))
  .sort((left, right) => right.startedAt.localeCompare(left.startedAt));

const rememberResponseFilter = (history: string[], filter: string) => {
  const value = filter.trim().slice(0, 2_000);
  return value ? [value, ...history.filter((candidate) => candidate !== value)].slice(0, 10) : history.slice(0, 10);
};

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

const scriptFolderVariables = (folders: RequestFolder[]) => folders.map((folder) => {
  const scope = variableScope([folder.environment]);
  return { id: folder.id, name: folder.name, environment: scope.values, disabled: scope.disabled };
});

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
  readOnlyRows?: CalculatedHeader[];
  onReadOnlyEnabledChange?: (row: CalculatedHeader, enabled: boolean) => void;
  namePlaceholder?: string;
  valuePlaceholder?: string;
  detailed?: boolean;
  environmentValues?: boolean;
  allowSecrets?: boolean;
  secretAvailable?: boolean;
  secretEntries?: VaultEntry[];
  onSecretEntriesChange?: (entries: VaultEntry[]) => void;
};

export function KeyValueEditor({
  rows,
  onChange,
  readOnlyRows = [],
  onReadOnlyEnabledChange,
  namePlaceholder = 'Name',
  valuePlaceholder = 'Value',
  detailed = false,
  environmentValues = false,
  allowSecrets = false,
  secretAvailable = false,
  secretEntries = [],
  onSecretEntriesChange,
}: KeyValueEditorProps) {
  const [editingJsonRowId, setEditingJsonRowId] = useState('');
  const [jsonDraft, setJsonDraft] = useState('');
  const [jsonError, setJsonError] = useState('');
  const [revealedSecretIds, setRevealedSecretIds] = useState<Set<string>>(() => new Set());
  const update = (id: string, patch: Partial<KeyValue>) =>
    onChange(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  const validateJsonValue = (row: KeyValue, value: string) => validateEnvironmentJsonRow(rows, row.id, value);
  const changeValueType = (row: KeyValue, valueType: NonNullable<KeyValue['valueType']>) => {
    if (row.valueType === 'secret') {
      if (!secretAvailable || !onSecretEntriesChange) {
        window.alert('Unlock the local vault before changing this Secret variable.');
        return;
      }
      if (!window.confirm(`Change ${row.name || 'this variable'} from Secret to ${valueType === 'json' ? 'JSON' : 'String'}? Its decrypted value will be stored in ordinary workspace data.`)) return;
      const value = environmentSecretValue(secretEntries, row.id);
      if (valueType === 'json') {
        const error = validateJsonValue(row, value);
        if (error) {
          window.alert(error);
          return;
        }
      }
      onSecretEntriesChange(removeEnvironmentSecrets(secretEntries, [row.id]));
      update(row.id, { value, valueType });
      return;
    }
    if (valueType === 'secret') {
      if (!allowSecrets || !secretAvailable || !onSecretEntriesChange) {
        window.alert('Secret variables require a private environment and an unlocked local vault.');
        return;
      }
      onSecretEntriesChange(upsertEnvironmentSecret(secretEntries, row.id, row.value));
      update(row.id, { value: '', valueType });
      return;
    }
    if (valueType === 'string') {
      update(row.id, { valueType });
      return;
    }
    const value = row.value.trim() ? row.value : '{}';
    const error = validateJsonValue(row, value);
    if (error) {
      window.alert(error);
      return;
    }
    update(row.id, { value, valueType });
  };
  const removeRow = (row: KeyValue) => {
    if (row.valueType === 'secret') {
      if (!secretAvailable || !onSecretEntriesChange) {
        window.alert('Unlock the local vault before removing this Secret variable.');
        return;
      }
      onSecretEntriesChange(removeEnvironmentSecrets(secretEntries, [row.id]));
    }
    onChange(rows.filter((candidate) => candidate.id !== row.id));
  };
  const editingJsonRow = rows.find((row) => row.id === editingJsonRowId);

  return (
    <div className={`kv-editor${detailed ? ' detailed' : ''}${environmentValues ? ' typed' : ''}`}>
      <div className="kv-header">
        <span />
        <span>{namePlaceholder}</span>
        <span>{valuePlaceholder}</span>
        {environmentValues ? <span>Type</span> : null}
        {detailed ? <span>Description</span> : null}
        <span />
      </div>
      {readOnlyRows.map((row) => (
        <div className="kv-row read-only" key={row.id}>
          {row.canDisable ? <input aria-label={`Enable default ${row.name}`} checked={row.enabled} className="kv-check" onChange={(event) => onReadOnlyEnabledChange?.(row, event.target.checked)} type="checkbox" /> : <span />}
          <input aria-label={namePlaceholder} readOnly spellCheck={false} value={row.name} />
          {detailed ? <textarea aria-label={valuePlaceholder} readOnly rows={1} spellCheck={false} value={row.value} /> : <input aria-label={valuePlaceholder} readOnly spellCheck={false} value={row.value} />}
          {detailed ? <input aria-label="Description" readOnly value={row.description ?? ''} /> : null}
          <span aria-label="Default read-only header" className="kv-read-only"><Icon name="lock" size={13} /></span>
        </div>
      ))}
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
          {environmentValues && row.valueType === 'json' ? <button
            aria-label={`Edit JSON value for ${row.name || 'row'}`}
            className="kv-json-value"
            onClick={() => {
              setEditingJsonRowId(row.id);
              setJsonDraft(row.value);
              setJsonError(validateJsonValue(row, row.value));
            }}
            type="button"
          ><Icon name="code" size={13} /> Edit JSON</button> : environmentValues && row.valueType === 'secret' ? <div className="kv-secret-value"><input
            aria-label={`Secret value for ${row.name || 'row'}`}
            disabled={!secretAvailable}
            onChange={(event) => onSecretEntriesChange?.(upsertEnvironmentSecret(secretEntries, row.id, event.target.value))}
            placeholder={secretAvailable ? 'Input Secret' : 'Unlock vault to edit'}
            spellCheck={false}
            type={revealedSecretIds.has(row.id) ? 'text' : 'password'}
            value={environmentSecretValue(secretEntries, row.id)}
          /><button aria-label={`${revealedSecretIds.has(row.id) ? 'Hide' : 'Reveal'} secret value for ${row.name || 'row'}`} disabled={!secretAvailable} onClick={() => setRevealedSecretIds((current) => {
            const next = new Set(current);
            if (next.has(row.id)) next.delete(row.id); else next.add(row.id);
            return next;
          })} type="button"><Icon name={revealedSecretIds.has(row.id) ? 'eye-off' : 'eye'} size={13} /></button></div> : detailed ? <textarea
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
          {environmentValues ? <select aria-label={`Type for ${row.name || 'row'}`} disabled={row.valueType === 'secret' && !secretAvailable} onChange={(event) => changeValueType(row, event.target.value as NonNullable<KeyValue['valueType']>)} value={row.valueType ?? 'string'}><option value="string">String</option><option value="json">JSON</option>{allowSecrets && (secretAvailable || row.valueType === 'secret') ? <option value="secret">Secret</option> : null}</select> : null}
          {detailed ? <input aria-label="Description" onChange={(event) => update(row.id, { description: event.target.value })} placeholder="Description" value={row.description ?? ''} /> : null}
          <button
            aria-label="Remove row"
            className="icon-button subtle"
            disabled={row.valueType === 'secret' && !secretAvailable}
            onClick={() => removeRow(row)}
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
      {editingJsonRow ? <div className="modal-backdrop environment-json-value-backdrop" role="presentation" onMouseDown={() => setEditingJsonRowId('')}><section aria-labelledby="environment-json-value-title" aria-modal="true" className="modal environment-json-value-modal" onMouseDown={(event) => event.stopPropagation()} role="dialog"><header><div><small>Environment variable</small><h2 id="environment-json-value-title">{editingJsonRow.name || 'JSON value'}</h2></div><button aria-label="Close" className="icon-button subtle" onClick={() => setEditingJsonRowId('')} type="button"><Icon name="x" /></button></header><div className="environment-json-value-editor"><CodeEditor ariaLabel={`JSON value for ${editingJsonRow.name || 'row'}`} onChange={(value) => { setJsonDraft(value); setJsonError(validateJsonValue(editingJsonRow, value)); }} value={jsonDraft} /></div>{jsonError ? <p className="environment-editor-error" role="alert">{jsonError}</p> : null}<footer><button className="secondary-button" onClick={() => setEditingJsonRowId('')} type="button">Cancel</button><button className="primary-button" disabled={Boolean(jsonError)} onClick={() => { const error = validateJsonValue(editingJsonRow, jsonDraft); if (error) { setJsonError(error); return; } update(editingJsonRow.id, { value: jsonDraft, valueType: 'json' }); setEditingJsonRowId(''); }} type="button">Done</button></footer></section></div> : null}
    </div>
  );
}

type EnvironmentVariablesEditorProps = {
  rows: KeyValue[];
  mode?: 'table' | 'raw';
  onChange: (rows: KeyValue[], mode: 'table' | 'raw') => void;
  allowSecrets?: boolean;
  secretAvailable?: boolean;
  secretEntries?: VaultEntry[];
  onSecretEntriesChange?: (entries: VaultEntry[]) => void;
};

function EnvironmentVariablesEditor({ rows, mode = 'table', onChange, allowSecrets = false, secretAvailable = false, secretEntries = [], onSecretEntriesChange }: EnvironmentVariablesEditorProps) {
  const hasSecrets = rows.some((row) => row.valueType === 'secret');
  const formatted = useMemo(() => formatEnvironmentJson(rows.filter((row) => row.valueType !== 'secret')), [rows]);
  const [draft, setDraft] = useState(() => formatted.source ?? '{}');
  const [error, setError] = useState(() => formatted.error ?? '');
  const previousMode = useRef(mode);
  useEffect(() => {
    if (mode === 'table' || previousMode.current !== mode) {
      setDraft(formatted.source ?? '{}');
      setError(formatted.error ?? '');
    }
    previousMode.current = mode;
  }, [formatted.error, formatted.source, mode]);
  const switchMode = (nextMode: 'table' | 'raw') => {
    if (nextMode === mode) return;
    if (nextMode === 'raw') {
      if (hasSecrets) {
        window.alert('Secret variables remain in Table view so encrypted values never enter raw workspace JSON.');
        return;
      }
      if (!formatted.source || formatted.error) {
        window.alert(formatted.error || 'The environment cannot be converted to raw JSON.');
        return;
      }
      const warnings = [
        formatted.disabledNames.length ? 'All disabled items will be lost.' : '',
        formatted.duplicateNames.length ? 'Items with the same name will be lost except the last one.' : '',
      ].filter(Boolean);
      if (warnings.length && !window.confirm(`${warnings.join('\n')}\n\nContinue?`)) return;
      const parsed = parseEnvironmentJson(formatted.source, rows, () => uid('variable'));
      if (!parsed.rows) {
        window.alert(parsed.error || 'The environment cannot be converted to raw JSON.');
        return;
      }
      setDraft(formatted.source);
      setError('');
      onChange(parsed.rows, 'raw');
      return;
    }
    const parsed = parseEnvironmentJson(draft, rows, () => uid('variable'));
    if (!parsed.rows) {
      setError(parsed.error || 'Please fix the raw JSON before switching to Table view.');
      window.alert('Please modify and fix the JSON error before switching to Table view.');
      return;
    }
    setError('');
    onChange(parsed.rows, 'table');
  };
  return <section className="environment-variable-editor"><div className="environment-editor-toolbar" role="tablist" aria-label="Environment editor mode"><button aria-selected={mode === 'table'} className={mode === 'table' ? 'active' : ''} onClick={() => switchMode('table')} role="tab" type="button">Table</button><button aria-selected={mode === 'raw'} className={mode === 'raw' ? 'active' : ''} onClick={() => switchMode('raw')} role="tab" type="button">Raw JSON</button></div>{mode === 'table' ? <><KeyValueEditor allowSecrets={allowSecrets} environmentValues namePlaceholder="Variable" onChange={(nextRows) => onChange(nextRows, 'table')} onSecretEntriesChange={onSecretEntriesChange} rows={rows} secretAvailable={secretAvailable} secretEntries={secretEntries} />{formatted.error ? <p className="environment-editor-error" role="alert">{formatted.error}</p> : null}</> : <div className="environment-raw-editor"><CodeEditor ariaLabel="Raw environment JSON" onChange={(value) => { setDraft(value); const parsed = parseEnvironmentJson(value, rows, () => uid('variable')); if (!parsed.rows) { setError(parsed.error || 'Invalid environment JSON.'); return; } setError(''); onChange(parsed.rows, 'raw'); }} value={draft} />{error ? <p className="environment-editor-error" role="alert">{error}</p> : null}</div>}</section>;
}

function BulkKeyValueEditor({ rows, onChange, ariaLabel }: { rows: KeyValue[]; onChange: (rows: KeyValue[]) => void; ariaLabel: string }) {
  const formatted = formatBulkKeyValues(rows);
  const [draft, setDraft] = useState(formatted);
  const lastEmitted = useRef(formatted);
  useEffect(() => {
    if (formatted === lastEmitted.current) return;
    lastEmitted.current = formatted;
    setDraft(formatted);
  }, [formatted]);
  return <CodeEditor ariaLabel={ariaLabel} value={draft} onChange={(value) => {
    setDraft(value);
    const parsed = parseBulkKeyValues(value, (index) => rows[index]?.id ?? uid('field'));
    lastEmitted.current = formatBulkKeyValues(parsed);
    onChange(parsed);
  }} />;
}

type ContextualPluginActionMenuProps = {
  actions: ContextualPluginAction[];
  ariaLabel: string;
  busyKey?: string;
  target: PluginActionTarget;
  onRun: (action: ContextualPluginAction, target: PluginActionTarget) => void;
};

function ContextualPluginActionMenu({ actions, ariaLabel, busyKey, target, onRun }: ContextualPluginActionMenuProps) {
  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number }>();
  useEffect(() => {
    if (!position) return;
    menuRef.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
    const close = (event: PointerEvent) => {
      if (!(event.target instanceof Node) || (!menuRef.current?.contains(event.target) && !triggerRef.current?.contains(event.target))) setPosition(undefined);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setPosition(undefined);
      triggerRef.current?.focus();
    };
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [position]);
  if (!actions.length) return null;
  const toggle = () => {
    if (position) { setPosition(undefined); return; }
    const bounds = triggerRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const width = 238;
    const height = Math.min(292, 36 + actions.length * 42);
    const below = bounds.bottom + 4;
    setPosition({
      left: Math.max(4, Math.min(bounds.right - width, window.innerWidth - width - 4)),
      top: below + height <= window.innerHeight - 4 ? below : Math.max(4, bounds.top - height - 4),
    });
  };
  return <div className="contextual-plugin-actions" onClick={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()}>
    <button aria-controls={position ? menuId : undefined} aria-expanded={Boolean(position)} aria-haspopup="menu" aria-label={ariaLabel} className="contextual-plugin-trigger" disabled={Boolean(busyKey)} draggable={false} onClick={toggle} onDragStart={(event) => event.preventDefault()} ref={triggerRef} title="Plugin actions" type="button"><Icon name="ellipsis" size={14} /></button>
    {position ? <div className="contextual-plugin-menu" id={menuId} ref={menuRef} role="menu" style={position}><header><Icon name="braces" size={12} /><span>Plugins</span></header>{actions.map((action) => <button disabled={Boolean(busyKey)} key={action.key} onClick={() => { setPosition(undefined); onRun(action, target); }} role="menuitem" type="button"><span>{busyKey === action.key ? 'Running…' : action.descriptor.label}</span><small>{action.pluginName}</small></button>)}</div> : null}
  </div>;
}

type CollectionSidebarProps = {
  workspace: Workspace;
  selectedDocumentId: string;
  selectedDocumentType?: DocumentTabType;
  pinnedRequestIds: string[];
  search: string;
  searchInputRef?: RefObject<HTMLInputElement | null>;
  mode: SidebarMode;
  onSearch: (value: string) => void;
  onSelectRequest: (id: string, permanent?: boolean) => void;
  onSelectFolder: (id: string, permanent?: boolean) => void;
  onToggleRequestPin: (id: string) => void;
  onToggleCollection: (id: string) => void;
  onAddRequest: () => void;
  onAddCollection: () => void;
  onAddFolder: (collectionId: string, parentId: string) => void;
  onEditCollection: (collectionId: string) => void;
  onEditFolder: (collectionId: string, folderId: string) => void;
  onToggleFolder: (collectionId: string, folderId: string) => void;
  onMoveResource: (move: WorkspaceResourceMove) => void;
  pluginActions: ContextualPluginAction[];
  pluginActionBusyKey?: string;
  onRunPluginAction: (action: ContextualPluginAction, target: PluginActionTarget) => void;
};

type SidebarDragSource =
  | { kind: 'collection'; collectionId: string }
  | { kind: 'folder' | 'request'; collectionId: string; resourceId: string };

export function CollectionSidebar({
  workspace,
  selectedDocumentId,
  selectedDocumentType,
  pinnedRequestIds,
  search,
  searchInputRef,
  mode,
  onSearch,
  onSelectRequest,
  onSelectFolder,
  onToggleRequestPin,
  onToggleCollection,
  onAddRequest,
  onAddCollection,
  onAddFolder,
  onEditCollection,
  onEditFolder,
  onToggleFolder,
  onMoveResource,
  pluginActions,
  pluginActionBusyKey,
  onRunPluginAction,
}: CollectionSidebarProps) {
  const dragSourceRef = useRef<SidebarDragSource | undefined>(undefined);
  const [dragSource, setDragSource] = useState<SidebarDragSource>();
  const [dropIndicator, setDropIndicator] = useState('');
  const normalizedSearch = search.trim().toLowerCase();
  const pinnedIds = new Set(pinnedRequestIds);
  const pinnedRequests = pinnedWorkspaceRequests(workspace, pinnedRequestIds, search);
  const requestPluginActions = contextualPluginActionsFor(pluginActions, 'request');
  const folderPluginActions = contextualPluginActionsFor(pluginActions, 'request-group');
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
  const keyboardMove = (event: ReactKeyboardEvent<HTMLElement>, source: SidebarDragSource) => {
    if (normalizedSearch || !event.altKey || event.metaKey || event.ctrlKey) return;
    const actions: Partial<Record<string, WorkspaceResourceKeyboardAction>> = {
      ArrowUp: 'up',
      ArrowDown: 'down',
      ArrowLeft: 'outdent',
      ArrowRight: 'indent',
      Home: 'first',
      End: 'last',
    };
    const action = actions[event.key];
    if (!action) return;
    const move = keyboardWorkspaceResourceMove(workspace, source, action);
    if (!move) return;
    event.preventDefault();
    event.stopPropagation();
    onMoveResource(move);
  };

  return (
    <aside className="collection-sidebar">
      <div className="sidebar-search-row">
        <label className="search-field">
          <Icon name="search" size={16} />
          <input
            aria-label={mode === 'collections' ? 'Search collections' : 'Search history'}
            onChange={(event) => onSearch(event.target.value)}
            placeholder={mode === 'collections' ? 'Search collections' : 'Search history'}
            ref={searchInputRef}
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
        {mode === 'collections' ? <>
          {pinnedRequests.length ? <section className="pinned-requests"><header><Icon name="pin" size={12} /><span>Pinned requests</span><small>{pinnedRequests.length}</small></header>{pinnedRequests.map(({ collectionId, request }) => <div className={`pinned-request-row${requestPluginActions.length ? ' has-plugin-actions' : ''}`} key={request.id}><button onAuxClick={(event) => { if (event.button === 1) { event.preventDefault(); onSelectRequest(request.id, true); } }} onClick={(event) => onSelectRequest(request.id, event.metaKey || event.ctrlKey)} onDoubleClick={() => onSelectRequest(request.id, true)} type="button"><span className={`method method-${methodClass(request.method)} protocol-${request.protocol}`}>{protocolLabel(request)}</span><span><strong>{request.name}</strong><small>{workspace.collections.find((collection) => collection.id === collectionId)?.name}</small></span></button><button aria-label={`Unpin ${request.name}`} onClick={() => onToggleRequestPin(request.id)} title="Unpin request" type="button"><Icon name="pin" size={12} /></button><ContextualPluginActionMenu actions={requestPluginActions} ariaLabel={`Plugin actions for ${request.name}`} busyKey={pluginActionBusyKey} onRun={onRunPluginAction} target={{ requestId: request.id, collectionId }} /></div>)}</section> : null}
          {workspace.collections.map((collection) => {
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
            return <div
            aria-grabbed={dragSource?.kind === 'request' && dragSource.resourceId === request.id}
            className={`request-row${requestPluginActions.length ? ' has-plugin-actions' : ''}${selectedDocumentType === 'request' && selectedDocumentId === request.id ? ' selected' : ''}${sourceClass(source)}${indicatorClass('resource', request.id)}`}
            draggable={!normalizedSearch}
            key={request.id}
            onDragEnd={clearDrag}
            onDragOver={(event) => dropOnRequest(event, collection.id, request, false)}
            onDragStart={(event) => beginDrag(event, source)}
            onDrop={(event) => dropOnRequest(event, collection.id, request, true)}
            style={{ '--resource-depth': depth } as CSSProperties}
            title={normalizedSearch ? 'Clear search to reorder' : 'Drag to move · Option/Alt+Arrows reorder, indent, or outdent · Option/Alt+Home/End moves first or last · Command/Ctrl-click or middle-click opens a permanent tab'}
          ><button aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown Alt+ArrowLeft Alt+ArrowRight Alt+Home Alt+End" className="request-row-main" onAuxClick={(event) => { if (event.button === 1) { event.preventDefault(); onSelectRequest(request.id, true); } }} onClick={(event) => onSelectRequest(request.id, event.metaKey || event.ctrlKey)} onDoubleClick={() => onSelectRequest(request.id, true)} onKeyDown={(event) => keyboardMove(event, source)} type="button"><span className={`method method-${methodClass(request.method)} protocol-${request.protocol}`}>{protocolLabel(request)}</span><span>{request.name}</span>{pinnedIds.has(request.id) ? <Icon name="pin" size={12} /> : null}</button><ContextualPluginActionMenu actions={requestPluginActions} ariaLabel={`Plugin actions for ${request.name}`} busyKey={pluginActionBusyKey} onRun={onRunPluginAction} target={{ requestId: request.id, collectionId: collection.id, folderId: request.folderId || undefined }} /></div>;
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
                className={`request-folder-title${folderPluginActions.length ? ' has-plugin-actions' : ''}${selectedDocumentType === 'folder' && selectedDocumentId === folder.id ? ' selected' : ''}${sourceClass(source)}${indicatorClass('resource', folder.id)}`}
                draggable={!normalizedSearch}
                onDragEnd={clearDrag}
                onDragOver={(event) => dropOnFolder(event, collection.id, folder, false)}
                onDragStart={(event) => beginDrag(event, source)}
                onDrop={(event) => dropOnFolder(event, collection.id, folder, true)}
                style={{ '--resource-depth': depth } as CSSProperties}
                title={normalizedSearch ? 'Clear search to reorder' : 'Drag edges to reorder; drop in the center to move inside · Option/Alt+Arrows reorder, indent, or outdent'}
              >
                <button aria-label={`${folder.expanded ? 'Collapse' : 'Expand'} ${folder.name}`} onClick={() => onToggleFolder(collection.id, folder.id)} type="button"><Icon name={folder.expanded ? 'chevron-down' : 'chevron-right'} size={12} /></button>
                <button aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown Alt+ArrowLeft Alt+ArrowRight Alt+Home Alt+End" onAuxClick={(event) => { if (event.button === 1) { event.preventDefault(); onSelectFolder(folder.id, true); } }} onClick={(event) => onSelectFolder(folder.id, event.metaKey || event.ctrlKey)} onDoubleClick={() => onSelectFolder(folder.id, true)} onKeyDown={(event) => keyboardMove(event, source)} type="button"><Icon name="folder" size={14} /><span>{folder.name}</span></button>
                <small>{collection.requests.filter((request) => folderAncestors(collection, request.folderId).some((ancestor) => ancestor.id === folder.id)).length}</small>
                <button aria-label={`Add subfolder to ${folder.name}`} onClick={() => onAddFolder(collection.id, folder.id)} type="button"><Icon name="plus" size={12} /></button>
                <button aria-label={`Configure ${folder.name}`} onClick={() => onEditFolder(collection.id, folder.id)} type="button"><Icon name="settings" size={12} /></button>
                <ContextualPluginActionMenu actions={folderPluginActions} ariaLabel={`Plugin actions for ${folder.name}`} busyKey={pluginActionBusyKey} onRun={onRunPluginAction} target={{ collectionId: collection.id, folderId: folder.id }} />
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
                title={normalizedSearch ? 'Clear search to reorder' : 'Drag to reorder collections; drop a resource here to move it to the root · Option/Alt+Up/Down/Home/End reorders'}
              ><button aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown Alt+Home Alt+End" onClick={() => onToggleCollection(collection.id)} onKeyDown={(event) => keyboardMove(event, collectionSource)} type="button"><Icon name={collection.expanded ? 'chevron-down' : 'chevron-right'} size={14} /><Icon name="archive" size={16} /><span>{collection.name}</span><small>{collection.requests.length}</small></button><button aria-label={`Add folder to ${collection.name}`} onClick={() => onAddFolder(collection.id, '')} type="button"><Icon name="plus" size={13} /></button><button aria-label={`Configure ${collection.name}`} onClick={() => onEditCollection(collection.id)} type="button"><Icon name="settings" size={13} /></button></div>
              {collection.expanded ? <div>{renderResources('', 0)}</div> : null}
            </div>
          );
          })}
        </> : (
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

type ProjectDashboardProps = {
  workspace: Workspace;
  canReopenRequest: boolean;
  pluginActions?: ContextualPluginAction[];
  pluginActionBusyKey?: string;
  onAddRequest: () => void;
  onOpenDesign: (designId?: string) => void;
  onOpenEnvironment: () => void;
  onOpenMcp: () => void;
  onOpenCollection: (collectionId: string) => void;
  onOpenMockServer: (serverId: string) => void;
  onOpenTestSuite: (suiteId?: string) => void;
  onImport: () => void;
  onReopenRequest: () => void;
  onRunPluginAction?: (action: ContextualPluginAction, target: PluginActionTarget) => void;
};

export function ProjectDashboard({ workspace, canReopenRequest, pluginActions = [], pluginActionBusyKey, onAddRequest, onImport, onOpenCollection, onOpenDesign, onOpenEnvironment, onOpenMcp, onOpenMockServer, onOpenTestSuite, onReopenRequest, onRunPluginAction }: ProjectDashboardProps) {
  const projectFiles = listProjectWorkspaces(workspace);
  const documentPluginActions = contextualPluginActionsFor(pluginActions, 'document');
  const runPluginActionFromDashboard = onRunPluginAction ?? (() => undefined);
  if (isProjectWorkspaceEmpty(workspace)) {
    return <section aria-labelledby="project-dashboard-title" className="project-dashboard project-dashboard-empty">
      <div>
        <small>Project dashboard</small>
        <h1 id="project-dashboard-title">Welcome to your project!</h1>
        <p>Start fresh or bring in existing work.</p>
      </div>
      <div aria-label="Create first project file" className="project-empty-actions">
        <button onClick={onAddRequest} type="button"><Icon name="plus" size={22} /><strong>Send a request</strong><span>Create a collection with your first request</span></button>
        <button onClick={() => onOpenDesign()} type="button"><Icon name="grid" size={22} /><strong>Create document</strong><span>Start an API design document</span></button>
        <button onClick={onImport} type="button"><Icon name="import" size={22} /><strong>Import</strong><span>Bring in an existing API project file</span></button>
      </div>
    </section>;
  }
  const requestCount = workspace.collections.reduce((total, collection) => total + collection.requests.length, 0);
  return <section aria-labelledby="project-dashboard-title" className="project-dashboard">
    <header>
      <div><small>Project dashboard</small><h1 id="project-dashboard-title">{workspace.name}</h1><p>Open a project resource or select any request from the sidebar.</p></div>
      <div className="project-dashboard-actions">
        <button className="secondary-button" disabled={!canReopenRequest} onClick={onReopenRequest} type="button"><Icon name="history" size={14} /> Reopen closed tab</button>
        <button className="primary-button" onClick={onAddRequest} type="button"><Icon name="plus" size={14} /> New request</button>
      </div>
    </header>
    <div aria-label="Project resource totals" className="project-dashboard-metrics">
      <div><strong>{workspace.collections.length}</strong><span>Collections</span></div>
      <div><strong>{requestCount}</strong><span>Requests</span></div>
      <div><strong>{workspace.apiDesigns.length}</strong><span>API designs</span></div>
      <div><strong>{workspace.mockServers.length}</strong><span>Mock servers</span></div>
      <div><strong>{workspace.testSuites.length}</strong><span>Test suites</span></div>
    </div>
    <section className="project-dashboard-resources">
      <header><div><small>Local resources</small><h2>Project files</h2></div><span>{projectFiles.length + workspace.testSuites.length} total</span></header>
      <div className="project-dashboard-grid">
        {projectFiles.some((file) => file.scope === 'environment') ? <button onClick={onOpenEnvironment} type="button"><Icon name="braces" size={19} /><span><strong>Environments</strong><small>{workspace.environments.length} environment{workspace.environments.length === 1 ? '' : 's'} · active {workspace.environments.find((environment) => environment.id === workspace.activeEnvironmentId)?.name ?? 'base'}</small></span><Icon name="chevron-right" size={14} /></button> : null}
        {workspace.collections.map((collection) => (
          <button key={collection.id} onClick={() => onOpenCollection(collection.id)} type="button">
            <Icon name="archive" size={19} />
            <span><strong>{collection.name}</strong><small>{collection.requests.length} request{collection.requests.length === 1 ? '' : 's'} · {(collection.folders ?? []).length} folder{(collection.folders ?? []).length === 1 ? '' : 's'}</small></span>
            <Icon name="chevron-right" size={14} />
          </button>
        ))}
        {workspace.apiDesigns.map((design) => <div className={`project-dashboard-resource-card${documentPluginActions.length ? ' has-plugin-actions' : ''}`} key={design.id}><button className="project-dashboard-resource-open" onClick={() => onOpenDesign(design.id)} type="button"><Icon name="grid" size={19} /><span><strong>{design.name}</strong><small>API design</small></span><Icon name="chevron-right" size={14} /></button><ContextualPluginActionMenu actions={documentPluginActions} ariaLabel={`Plugin actions for ${design.name}`} busyKey={pluginActionBusyKey} onRun={runPluginActionFromDashboard} target={{ designId: design.id }} /></div>)}
        {workspace.mockServers.map((server) => <button key={server.id} onClick={() => onOpenMockServer(server.id)} type="button"><Icon name="spark" size={19} /><span><strong>{server.name}</strong><small>{server.routes.length} route{server.routes.length === 1 ? '' : 's'} · 127.0.0.1:{server.port}</small></span><Icon name="chevron-right" size={14} /></button>)}
        {workspace.mcpClients.map((client) => <button key={client.id} onClick={onOpenMcp} type="button"><Icon name="globe" size={19} /><span><strong>{client.name}</strong><small>MCP Client · {client.transport === 'stdio' ? 'STDIO' : 'Streamable HTTP'}</small></span><Icon name="chevron-right" size={14} /></button>)}
        {workspace.testSuites.map((suite) => <button key={suite.id} onClick={() => onOpenTestSuite(suite.id)} type="button"><Icon name="check" size={19} /><span><strong>{suite.name}</strong><small>{suite.tests.length} standalone test{suite.tests.length === 1 ? '' : 's'}</small></span><Icon name="chevron-right" size={14} /></button>)}
        {!workspace.testSuites.length ? <button onClick={() => onOpenTestSuite()} type="button"><Icon name="plus" size={19} /><span><strong>New test suite</strong><small>Create standalone API tests</small></span><Icon name="chevron-right" size={14} /></button> : null}
      </div>
    </section>
  </section>;
}

type DocumentTabView = {
  id: string;
  type: DocumentTabType;
  name: string;
  temporary: boolean;
  request?: ApiRequest;
  method?: string;
};

type DocumentTabStripProps = {
  documents: DocumentTabView[];
  activeDocumentId: string;
  canReopenDocument: boolean;
  pinnedRequestIds: string[];
  trailing?: ReactNode;
  onAddRequest: () => void;
  onCloseAllDocuments: () => void;
  onCloseDocument: (documentId: string) => void;
  onCloseOtherDocuments: (documentId: string) => void;
  onMoveDocument: (documentId: string, targetDocumentId: string, placement: RequestTabPlacement) => void;
  onPromoteDocument: (documentId: string) => void;
  onRenameDocument: (documentId: string, type: DocumentTabType, name: string) => void;
  onReopenDocument: () => void;
  onSelectDocument: (documentId: string, type: DocumentTabType) => void;
  onToggleRequestPin: (requestId: string) => void;
};

function DocumentTabStrip({ documents, activeDocumentId, canReopenDocument, pinnedRequestIds, trailing, onAddRequest, onCloseAllDocuments, onCloseDocument, onCloseOtherDocuments, onMoveDocument, onPromoteDocument, onRenameDocument, onReopenDocument, onSelectDocument, onToggleRequestPin }: DocumentTabStripProps) {
  const documentDragRef = useRef<string | undefined>(undefined);
  const [draggedDocumentId, setDraggedDocumentId] = useState('');
  const [documentDrop, setDocumentDrop] = useState<{ id: string; placement: RequestTabPlacement }>();
  const [documentMenu, setDocumentMenu] = useState<{ documentId: string; left: number; top: number }>();
  const pinnedIds = new Set(pinnedRequestIds);
  const clearDocumentDrag = () => {
    documentDragRef.current = undefined;
    setDraggedDocumentId('');
    setDocumentDrop(undefined);
  };
  const beginDocumentDrag = (event: ReactDragEvent<HTMLDivElement>, documentId: string) => {
    documentDragRef.current = documentId;
    setDraggedDocumentId(documentId);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', 'brunomnia-document-tab');
  };
  const dropOnDocument = (event: ReactDragEvent<HTMLDivElement>, targetDocumentId: string, commit: boolean) => {
    const documentId = documentDragRef.current;
    if (!documentId || documentId === targetDocumentId) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const placement = event.clientX < bounds.left + bounds.width / 2 ? 'before' : 'after';
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'move';
    setDocumentDrop({ id: targetDocumentId, placement });
    if (commit) {
      onMoveDocument(documentId, targetDocumentId, placement);
      clearDocumentDrag();
    }
  };
  const openDocumentMenu = (documentId: string, left: number, top: number) => setDocumentMenu({
    documentId,
    left: Math.max(4, Math.min(left, window.innerWidth - 190)),
    top: Math.max(4, Math.min(top, window.innerHeight - 84)),
  });
  useEffect(() => {
    if (!documentMenu) return;
    const closeMenu = (event: PointerEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest('.document-tab-menu')) setDocumentMenu(undefined);
    };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setDocumentMenu(undefined); };
    window.addEventListener('pointerdown', closeMenu);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('pointerdown', closeMenu);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [documentMenu]);
  return <div className="document-tabs">
    <div aria-label="Open document tabs" className="document-tab-list" role="tablist">{documents.map((document) => {
      const activeDocument = document.id === activeDocumentId;
      const dropClass = documentDrop?.id === document.id ? ` drop-${documentDrop.placement}` : '';
      const pinned = document.type === 'request' && pinnedIds.has(document.id);
      const editableName = document.type === 'request' || document.type === 'folder' || document.type === 'testSuite';
      return <div aria-haspopup="menu" aria-selected={activeDocument} className={`document-tab${activeDocument ? ' active' : ''}${document.temporary ? ' temporary' : ''}${draggedDocumentId === document.id ? ' is-dragging' : ''}${dropClass}`} draggable key={document.id} onAuxClick={(event) => { if (event.button === 1) { event.preventDefault(); onCloseDocument(document.id); } }} onClick={() => onSelectDocument(document.id, document.type)} onContextMenu={(event) => { event.preventDefault(); openDocumentMenu(document.id, event.clientX, event.clientY); }} onDoubleClick={(event) => { if (!(event.target as HTMLElement).closest('button,input')) onPromoteDocument(document.id); }} onDragEnd={clearDocumentDrag} onDragOver={(event) => dropOnDocument(event, document.id, false)} onDragStart={(event) => beginDocumentDrag(event, document.id)} onDrop={(event) => dropOnDocument(event, document.id, true)} onKeyDown={(event) => { if (event.target !== event.currentTarget) return; if (event.key === 'Enter' || event.key === ' ') onSelectDocument(document.id, document.type); else if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) { event.preventDefault(); const bounds = event.currentTarget.getBoundingClientRect(); openDocumentMenu(document.id, bounds.left, bounds.bottom); } }} role="tab" tabIndex={0} title={document.temporary ? 'Temporary tab · Double-click to keep open' : document.name}>
        {document.request ? <span className={`method method-${methodClass(document.request.method)} protocol-${document.request.protocol}`}>{protocolLabel(document.request)}</span> : document.method ? <span className={`method method-${methodClass(document.method)}`}>{document.method}</span> : <Icon name={document.type === 'runner' ? 'play' : document.type === 'environment' ? 'braces' : document.type === 'document' ? 'grid' : document.type === 'mockServer' ? 'spark' : document.type === 'collection' ? 'archive' : document.type === 'testSuite' ? 'check' : 'folder'} size={14} />}
        {activeDocument && editableName ? <input aria-label={`${document.type === 'folder' ? 'Folder' : document.type === 'testSuite' ? 'Test suite' : 'Request'} name`} onChange={(event) => onRenameDocument(document.id, document.type, event.target.value)} onClick={(event) => event.stopPropagation()} spellCheck={false} value={document.name} /> : <span className="document-tab-name">{document.name}</span>}
        {document.temporary ? <button aria-label={`Keep ${document.name} tab open`} onClick={(event) => { event.stopPropagation(); onPromoteDocument(document.id); }} title="Keep tab open" type="button"><Icon name="check" size={11} /></button> : null}
        {activeDocument && document.type === 'request' ? <button aria-label={pinned ? 'Unpin request' : 'Pin request'} className={pinned ? 'active' : ''} onClick={(event) => { event.stopPropagation(); onToggleRequestPin(document.id); }} title={pinned ? 'Unpin request' : 'Pin request'} type="button"><Icon name="pin" size={13} /></button> : null}
        <button aria-label={`Close ${document.name}`} onClick={(event) => { event.stopPropagation(); onCloseDocument(document.id); }} title="Close tab" type="button"><Icon name="x" size={12} /></button>
      </div>;
    })}</div>
    {documentMenu ? <div className="document-tab-menu" role="menu" style={{ left: documentMenu.left, top: documentMenu.top }}><button onClick={() => { onCloseAllDocuments(); setDocumentMenu(undefined); }} role="menuitem" type="button">Close All</button><button disabled={documents.length <= 1} onClick={() => { onCloseOtherDocuments(documentMenu.documentId); setDocumentMenu(undefined); }} role="menuitem" type="button">Close Other Tabs</button></div> : null}
    {trailing}
    <button aria-label="Reopen closed document tab" className="tab-plus" disabled={!canReopenDocument} onClick={onReopenDocument} title="Reopen closed tab · Command/Ctrl+Shift+T" type="button"><Icon name="history" size={15} /></button>
    <button aria-label="New request" className="tab-plus" onClick={onAddRequest} type="button"><Icon name="plus" size={16} /></button>
  </div>;
}

type RequestPanelProps = {
  request: ApiRequest;
  documentTabStrip: ReactNode;
  collection: Workspace['collections'][number];
  environment: Environment;
  workspaceCookies: CookieRecord[];
  storedResponses: StoredResponse[];
  templateVariableNames: string[];
  templateVariableValues: Record<string, string>;
  showVariableSourceAndValue: boolean;
  requestContext: SendRequestContext;
  showPasswords: boolean;
  useBulkHeaderEditor: boolean;
  useBulkParametersEditor: boolean;
  activeTab: RequestTab;
  isSending: boolean;
  streamStatus: 'disconnected' | 'connecting' | 'connected' | 'reconnecting';
  grpcSchema?: GrpcSchema;
  grpcSchemaLoading: boolean;
  graphqlSchemaLoading: boolean;
  graphqlSchemaError: string;
  onTabChange: (tab: RequestTab) => void;
  onChange: (patch: Partial<ApiRequest>) => void;
  onSend: () => void;
  onCancelScheduled: () => void;
  onOpenSendOptions: () => void;
  onLoadGrpcSchema: () => void;
  onLoadGraphqlSchema: (includeInputValueDeprecation: boolean) => void;
  onSocketIoListenerToggle: (eventName: string, enabled: boolean) => void;
  onGenerateCode: () => void;
  onToggleBulkHeaderEditor: () => void;
  onToggleBulkParametersEditor: () => void;
  scheduledSendLabel: string;
  urlInputRef: RefObject<HTMLInputElement | null>;
  methodInputRef: RefObject<HTMLInputElement | null>;
  graphqlFilterInputRef: RefObject<HTMLInputElement | null>;
};

function RequestPanel({
  request,
  documentTabStrip,
  collection,
  activeTab,
  isSending,
  streamStatus,
  grpcSchema,
  grpcSchemaLoading,
  graphqlSchemaLoading,
  graphqlSchemaError,
  onTabChange,
  onChange,
  onSend,
  onCancelScheduled,
  onOpenSendOptions,
  onLoadGrpcSchema,
  onLoadGraphqlSchema,
  onSocketIoListenerToggle,
  onGenerateCode,
  scheduledSendLabel,
  urlInputRef,
  methodInputRef,
  graphqlFilterInputRef,
  environment,
  workspaceCookies,
  storedResponses,
  templateVariableNames,
  templateVariableValues,
  showVariableSourceAndValue,
  requestContext,
  showPasswords,
  useBulkHeaderEditor,
  useBulkParametersEditor,
  onToggleBulkHeaderEditor,
  onToggleBulkParametersEditor,
}: RequestPanelProps) {
  const [showTemplateTags, setShowTemplateTags] = useState(false);
  const streamProtocol = isStreamingRequest(request);
  const changeHeaders = (headers: KeyValue[]) => onChange({
    headers,
    disableUserAgentHeader: userAgentDisabledAfterHeaderChange(request.headers, headers, request.disableUserAgentHeader),
  });
  const calculatedHeaders = calculatedRequestHeaders(request);
  const actionLabel = streamProtocol
    ? streamStatus === 'connected' ? 'Disconnect' : streamStatus === 'reconnecting' ? 'Stop reconnecting' : streamStatus === 'connecting' ? 'Connecting' : 'Connect'
    : request.protocol === 'grpc' ? 'Invoke' : 'Send';
  return (
    <section className="request-panel">
      {documentTabStrip}

      <div className="request-command-row">
        <select
          aria-label="Request protocol"
          className={`protocol-select protocol-${request.protocol}`}
          onChange={(event) => {
            const protocol = event.target.value as Protocol;
            onChange({
              protocol,
              method: protocol === 'graphql' || protocol === 'grpc' ? 'POST' : protocol === 'websocket' || protocol === 'socketio' || protocol === 'sse' ? 'GET' : request.method,
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
          ref={methodInputRef}
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
        <button aria-label="Insert template tag" className="codegen-trigger" onClick={() => setShowTemplateTags(true)} type="button"><Icon name="plus" size={15} /><span>Tags</span></button>
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
            <section><header><strong>Query parameters</strong><small>Enabled rows are appended in order; duplicate names are preserved.</small><button onClick={onToggleBulkParametersEditor} type="button">{useBulkParametersEditor ? 'Regular Edit' : 'Bulk Edit'}</button></header>{useBulkParametersEditor ? <div className="bulk-parameter-editor"><BulkKeyValueEditor ariaLabel="Bulk query parameters" rows={request.params} onChange={(params) => onChange({ params })} /></div> : <KeyValueEditor detailed rows={request.params} onChange={(params) => onChange({ params })} namePlaceholder="Query parameter" />}</section>
          </div>
        ) : null}
        {activeTab === 'headers' && request.protocol !== 'grpc' ? (
          <div className="editor-stack bulk-key-value-stack"><div className="editor-toolbar"><span>Request headers</span><button onClick={onToggleBulkHeaderEditor} type="button">{useBulkHeaderEditor ? 'Regular Edit' : 'Bulk Edit'}</button></div>{useBulkHeaderEditor ? <BulkKeyValueEditor ariaLabel="Bulk request headers" rows={request.headers} onChange={changeHeaders} /> : <div className="bulk-regular-editor"><KeyValueEditor detailed readOnlyRows={calculatedHeaders} rows={request.headers} onChange={changeHeaders} onReadOnlyEnabledChange={(row, enabled) => { if (row.name.toLowerCase() === 'user-agent') onChange({ disableUserAgentHeader: !enabled }); }} namePlaceholder="Header" /></div>}</div>
        ) : null}
        {activeTab === 'headers' && request.protocol === 'grpc' ? (
          <KeyValueEditor rows={request.grpc.metadata} onChange={(metadata) => onChange({ grpc: { ...request.grpc, metadata } })} namePlaceholder="Metadata" />
        ) : null}
        {activeTab === 'auth' ? <div className="folder-auth-editor"><label><input checked={request.inheritFolderAuth === true} disabled={!request.folderId || !folderAncestors(collection, request.folderId).some((folder) => folder.auth)} onChange={(event) => onChange({ inheritFolderAuth: event.target.checked })} type="checkbox" /> Inherit authentication from closest configured folder</label><Suspense fallback={<div className="dialog-loading">Loading authentication…</div>}><AuthEditor cookies={workspaceCookies} environment={environment} request={request} requestContext={requestContext} responses={storedResponses} showPasswords={showPasswords} onChange={onChange} /></Suspense></div> : null}
        {activeTab === 'body' && request.protocol === 'http' ? <HttpBodyEditor onChange={onChange} request={request} /> : null}
        {activeTab === 'body' && request.protocol === 'graphql' ? <GraphqlEditor filterInputRef={graphqlFilterInputRef} onChange={onChange} onLoadSchema={onLoadGraphqlSchema} request={request} schemaError={graphqlSchemaError} schemaLoading={graphqlSchemaLoading} /> : null}
        {activeTab === 'body' && (request.protocol === 'websocket' || request.protocol === 'sse') ? <StreamSetup onChange={onChange} request={request} /> : null}
        {activeTab === 'body' && request.protocol === 'socketio' ? <Suspense fallback={<div className="dialog-loading">Loading Socket.IO editor…</div>}><SocketIoEditor onChange={onChange} onListenerToggle={onSocketIoListenerToggle} request={request} /></Suspense> : null}
        {activeTab === 'body' && request.protocol === 'grpc' ? <Suspense fallback={<div className="dialog-loading">Loading gRPC editor…</div>}><GrpcEditor environment={environment} onChange={onChange} onLoadSchema={onLoadGrpcSchema} request={request} requestContext={requestContext} schema={grpcSchema} schemaLoading={grpcSchemaLoading} /></Suspense> : null}
        {activeTab === 'transport' ? <Suspense fallback={<div className="dialog-loading">Loading transport settings…</div>}><TransportEditor globalTimeoutMs={requestContext.requestTimeoutMs ?? 30_000} onChange={onChange} request={request} /></Suspense> : null}
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
      {showTemplateTags ? <Suspense fallback={<div className="modal-backdrop"><div className="dialog-loading">Loading template tags…</div></div>}><TemplateTagDialog cookies={workspaceCookies} onApply={(updated) => onChange(updated)} onClose={() => setShowTemplateTags(false)} request={request} responses={requestContext.filterResponsesByEnv ? storedResponses.filter((response) => response.environmentId === environment.id) : storedResponses} showVariableSourceAndValue={showVariableSourceAndValue} variableNames={templateVariableNames} variableValues={templateVariableValues} /></Suspense> : null}
    </section>
  );
}

type ResponsePanelProps = {
  allowHtmlPreviewRemoteResources: boolean;
  allowHtmlPreviewScripts: boolean;
  disableResponsePreviewLinks: boolean;
  response: HttpResponse;
  responseHistory: StoredResponse[];
  streamHistory: StoredStreamSession[];
  streamSession?: StoredStreamSession;
  responseFilter: string;
  responseFilterHistory: string[];
  responsePreviewMode: ResponsePreviewMode;
  selectedResponseId: string;
  selectedStreamSessionId: string;
  activeEnvironmentHistoryCount: number;
  activeEnvironmentStreamHistoryCount: number;
  protocol: Protocol;
  activeTab: ResponseTab;
  isSending: boolean;
  streamMessages: StreamMessage[];
  streamStatus: 'disconnected' | 'connecting' | 'connected' | 'reconnecting';
  streamDraft: string;
  streamFrameKind: 'text' | 'binary';
  scriptTests: ScriptTestResult[];
  scriptLogs: string[];
  cookies: CookieRecord[];
  requestUrl: string;
  mockServers: MockServer[];
  mockSourceResponse?: StoredResponse;
  mockRequest: ApiRequest;
  mockEnvironmentId: string;
  onChangeCookies: (cookies: CookieRecord[]) => void;
  onClearHistory: () => void;
  onDeleteResponse: () => void;
  onDeleteStreamSession: () => void;
  onDownloadResponse: (prettify: boolean) => void;
  onExportResponseDiagnostic: (kind: 'debug' | 'har') => void;
  onApplyResponseToMock: (result: AppliedResponseMockTarget) => void;
  onOpenMock: (serverId: string, routeId: string) => void;
  isMockServerRunning: (serverId: string) => boolean;
  onApplyResponseFilter: (filter: string, remember: boolean) => void;
  onChangeResponsePreviewMode: (mode: ResponsePreviewMode) => void;
  onSelectResponse: (id: string) => void;
  onSelectStreamSession: (id: string) => void;
  onClearStreamHistory: () => void;
  onTabChange: (tab: ResponseTab) => void;
  onStreamDraftChange: (value: string) => void;
  onStreamFrameKindChange: (value: 'text' | 'binary') => void;
  onSendStreamMessage: () => void;
  panelRef: RefObject<HTMLElement | null>;
};

function ResponsePanel({
  allowHtmlPreviewRemoteResources,
  allowHtmlPreviewScripts,
  disableResponsePreviewLinks,
  response,
  responseHistory,
  streamHistory,
  streamSession,
  responseFilter,
  responseFilterHistory,
  responsePreviewMode,
  selectedResponseId,
  selectedStreamSessionId,
  activeEnvironmentHistoryCount,
  activeEnvironmentStreamHistoryCount,
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
  mockServers,
  mockSourceResponse,
  mockRequest,
  mockEnvironmentId,
  onChangeCookies,
  onClearHistory,
  onDeleteResponse,
  onDeleteStreamSession,
  onDownloadResponse,
  onExportResponseDiagnostic,
  onApplyResponseToMock,
  onOpenMock,
  isMockServerRunning,
  onApplyResponseFilter,
  onChangeResponsePreviewMode,
  onSelectResponse,
  onSelectStreamSession,
  onClearStreamHistory,
  onTabChange,
  onStreamDraftChange,
  onStreamFrameKindChange,
  onSendStreamMessage,
  panelRef,
}: ResponsePanelProps) {
  const [scriptTestStatusFilter, setScriptTestStatusFilter] = useState<ScriptTestFilter>('all');
  const [scriptTestNameFilter, setScriptTestNameFilter] = useState('');
  const visibleScriptTests = filterScriptTests(scriptTests, scriptTestStatusFilter, scriptTestNameFilter);
  const streaming = isStreamingRequest(mockRequest);
  const canPrettify = Object.entries(response.headers).some(([name, value]) => name.toLowerCase() === 'content-type' && /json/i.test(value));
  const canExportHttpDiagnostics = !streaming && (protocol === 'http' || protocol === 'graphql');
  const historySections = responseHistorySections(responseHistory);
  const selectedHistoryResponse = responseHistory.find((saved) => saved.id === selectedResponseId);
  const responseHeaders = streaming ? streamSession?.headers ?? {} : response.headers;
  const timelineEntries = streaming ? streamSession?.timeline ?? [{ name: 'Text' as const, value: 'No connection timeline is available for this legacy session.', elapsedMs: 0 }] : response.timeline?.length ? response.timeline : [
    { name: 'Text' as const, value: 'Request started', elapsedMs: 0 },
    { name: 'Text' as const, value: `Response ${response.status} ${response.statusText}`, elapsedMs: response.durationMs },
    ...(response.httpVersion ? [{ name: 'Text' as const, value: `Negotiated ${response.httpVersion}`, elapsedMs: response.durationMs }] : []),
    { name: 'Text' as const, value: 'Response body decoded', elapsedMs: response.durationMs },
  ];
  const copyResponse = () => void navigator.clipboard.writeText(response.body);
  return (
    <section className="response-panel" ref={panelRef} tabIndex={-1}>
      <div className="response-document-spacer" />
      <div className="response-summary">
        <div className="response-metrics">
          <strong className={streaming ? streamStatus === 'connected' ? 'ok' : '' : response.status > 0 && response.status < 400 ? 'ok' : 'bad'}>
            {streaming ? streamStatus === 'connected' ? 'LIVE' : streamStatus === 'connecting' || streamStatus === 'reconnecting' ? '···' : 'OFF' : isSending ? '···' : response.status || 'Error'}
          </strong>
          <span className={!streaming && response.status > 0 && response.status < 400 ? 'ok' : !streaming ? 'bad' : ''}>{streaming ? protocol === 'websocket' ? 'WebSocket' : protocol === 'socketio' ? 'Socket.IO' : protocol === 'graphql' ? 'GraphQL subscription' : 'Event stream' : response.statusText}</span>
          <span>{streaming ? `${streamMessages.length} events` : `${response.durationMs} ms`}</span>
          {streaming && streamSession?.durationMs !== undefined ? <span>{streamSession.durationMs} ms</span> : null}
          {!streaming ? <span title={response.wireSizeBytes !== undefined && response.wireSizeBytes !== response.sizeBytes ? `Read ${formatBytes(response.wireSizeBytes)} · Content ${formatBytes(response.sizeBytes)}` : undefined}>{formatBytes(response.wireSizeBytes ?? response.sizeBytes)}</span> : null}
          {(streaming ? streamSession?.httpVersion : response.httpVersion) ? <span>{streaming ? streamSession?.httpVersion : response.httpVersion}</span> : null}
        </div>
          {streaming && streamHistory.length ? <Suspense fallback={<div className="dialog-loading">Loading stream history…</div>}><StreamHistoryControls activeEnvironmentCount={activeEnvironmentStreamHistoryCount} onClear={onClearStreamHistory} onDelete={onDeleteStreamSession} onSelect={onSelectStreamSession} selectedSessionId={selectedStreamSessionId} sessions={streamHistory} /></Suspense> : !streaming && responseHistory.length ? <div className="response-history-controls"><label className="response-history-picker"><Icon name="history" size={15} /><select aria-label="Saved response" onChange={(event) => onSelectResponse(event.target.value)} value={selectedResponseId}>{selectedResponseId ? null : <option value="">Live response</option>}{historySections.map((section) => <optgroup key={section.label} label={section.label}>{section.responses.map((saved) => <option key={saved.id} value={saved.id}>{new Date(saved.receivedAt).toLocaleTimeString()} · {saved.status || 'ERR'} · {saved.requestSnapshot?.method ?? ''} {saved.requestUrl} · {saved.durationMs} ms · {formatBytes(saved.wireSizeBytes ?? saved.sizeBytes)}{saved.requestTestResults?.length ? ` · ${saved.requestTestResults.filter(scriptTestPassed).length}/${saved.requestTestResults.length} tests` : ''}{saved.requestSnapshot ? '' : ' · legacy request not restorable'}</option>)}</optgroup>)}</select></label><button aria-label="Delete saved response" disabled={!selectedResponseId} onClick={onDeleteResponse} type="button"><Icon name="trash" size={14} /></button><button aria-label="Clear environment history" disabled={!activeEnvironmentHistoryCount} onClick={onClearHistory} type="button">Clear {activeEnvironmentHistoryCount}</button></div> : <button aria-label="Response source" className="icon-button subtle" disabled type="button"><Icon name="globe" size={18} /></button>}
      </div>
      <nav className="tab-strip response-tabs" aria-label="Response details">
        {responseTabs.map((tab) => <button className={activeTab === tab ? 'active' : ''} key={tab} onClick={() => onTabChange(tab)} type="button">{titleCase(tab)}{tab === 'tests' && scriptTests.length ? <small>{scriptTests.filter(scriptTestPassed).length}/{scriptTests.length}</small> : tab === 'cookies' && cookies.length ? <small>{cookies.length}</small> : null}</button>)}
      </nav>
      <div className="response-content">
        {activeTab === 'preview' && streaming ? (
          <Suspense fallback={<div className="dialog-loading">Loading stream console…</div>}><StreamConsole connected={streamStatus === 'connected'} draft={streamDraft} frameKind={streamFrameKind} messages={streamMessages} onDraftChange={onStreamDraftChange} onFrameKindChange={onStreamFrameKindChange} onPreviewModeChange={onChangeResponsePreviewMode} onSend={onSendStreamMessage} previewMode={responsePreviewMode} protocol={protocol} request={mockRequest} sessionId={selectedStreamSessionId} /></Suspense>
        ) : null}
        {activeTab === 'preview' && !streaming ? (
          <Suspense fallback={<div className="dialog-loading">Loading response preview…</div>}><ResponseBodyPreview allowHtmlPreviewRemoteResources={allowHtmlPreviewRemoteResources} allowHtmlPreviewScripts={allowHtmlPreviewScripts} disableResponsePreviewLinks={disableResponsePreviewLinks} filter={responseFilter} filterHistory={responseFilterHistory} onApplyFilter={onApplyResponseFilter} onDownload={() => onDownloadResponse(false)} onModeChange={onChangeResponsePreviewMode} previewMode={responsePreviewMode} response={response} responseKey={selectedResponseId || `${response.status}:${response.durationMs}:${response.sizeBytes}:${response.requestUrl ?? requestUrl}`} responseUrl={response.requestUrl ?? requestUrl} /></Suspense>
        ) : null}
        {activeTab === 'headers' ? (
          <div className="response-table">{Object.entries(responseHeaders).map(([name, value]) => <div key={name}><strong>{name}</strong><span>{value}</span></div>)}{!Object.keys(responseHeaders).length ? <div><strong>Headers</strong><span>No handshake headers are available.</span></div> : null}</div>
        ) : null}
        {activeTab === 'cookies' ? <><div className="response-table"><div><strong>Request cookie policy</strong><span>{selectedHistoryResponse && selectedHistoryResponse.settingSendCookies !== undefined ? `${selectedHistoryResponse.settingSendCookies ? 'Sent matching cookies' : 'Did not send cookies'} · ${selectedHistoryResponse.settingStoreCookies ? 'Stored response cookies' : 'Did not store response cookies'}` : 'No saved request cookie policy is available for this response.'}</span></div></div><Suspense fallback={<div className="dialog-loading">Loading cookies…</div>}><CookieEditor cookies={cookies} requestUrl={requestUrl} onChange={onChangeCookies} /></Suspense></> : null}
        {activeTab === 'timeline' ? (
          <div className="timeline">
            {timelineEntries.map((entry, index) => <div className={`timeline-entry${entry.hidden ? ' hidden' : ''}`} key={`${entry.name}-${entry.elapsedMs}-${index}`}><span className={`timeline-dot${index === timelineEntries.length - 1 ? ' ok' : ''}`} /><div><strong>{entry.name}</strong><pre>{entry.value || ' '}</pre></div><time>{entry.elapsedMs} ms</time></div>)}
          </div>
        ) : null}
        {activeTab === 'tests' ? (
          <div className="test-results">
            {scriptTests.length ? <nav aria-label="Filter response test results" className="script-test-status-filters">{(['all', 'passed', 'failed', 'skipped'] as ScriptTestFilter[]).map((filter) => <button aria-pressed={scriptTestStatusFilter === filter} key={filter} onClick={() => setScriptTestStatusFilter(filter)} type="button">{filter[0].toUpperCase() + filter.slice(1)}</button>)}</nav> : null}
            <header><strong>{visibleScriptTests.length}/{scriptTests.length} tests shown</strong><span>{scriptLogs.length} console messages</span></header>
            {visibleScriptTests.map((test, index) => {
              const status = scriptTestStatus(test);
              return <article className={status === 'passed' ? 'passing' : status === 'skipped' ? 'skipped' : 'failing'} key={`${test.name}-${index}`}><i>{status === 'passed' ? '✓' : status === 'skipped' ? '−' : '×'}</i><span><strong>{test.name}</strong><small className="test-result-meta">{scriptTestCategoryLabel(test.category)} ({scriptTestDurationLabel(test.durationMs)})</small>{test.error ? <small className="test-result-error">{test.error}</small> : null}</span></article>;
            })}
            {scriptTests.length && !visibleScriptTests.length ? <div className="script-test-no-match">No matching test results</div> : null}
            {scriptLogs.map((log, index) => <pre key={`${log}-${index}`}>{log}</pre>)}
            {!scriptTests.length && !scriptLogs.length ? <div className="empty-state compact"><Icon name="code" size={26} /><strong>No script results</strong><span>Send a request with an after-response script to see assertions here.</span></div> : null}
            {scriptTests.length ? <div className="script-test-name-filter"><input aria-label="Filter test results" onChange={(event) => setScriptTestNameFilter(event.target.value)} placeholder="Filter test results with name" title="Filter test results" type="text" value={scriptTestNameFilter} /></div> : null}
          </div>
        ) : null}
        {activeTab === 'mock' ? <Suspense fallback={<div className="dialog-loading">Loading mock tools…</div>}><MockResponseExtractor environmentId={mockEnvironmentId} isServerRunning={isMockServerRunning} liveResponse={response} mockServers={mockServers} onApply={onApplyResponseToMock} onOpenMock={onOpenMock} request={mockRequest} response={mockSourceResponse} /></Suspense> : null}
      </div>
      <div className="panel-footer response-footer">
        <span>{streaming ? 'EVENT LOG' : protocol === 'grpc' ? 'PROTO JSON' : 'JSON'}</span>
        {!streaming ? <button onClick={copyResponse} type="button"><Icon name="copy" size={14} /> Copy</button> : null}
        {!streaming ? <button onClick={() => onDownloadResponse(false)} type="button"><Icon name="download" size={14} /> Export raw</button> : null}
        {!streaming && canPrettify ? <button onClick={() => onDownloadResponse(true)} type="button"><Icon name="download" size={14} /> Export pretty</button> : null}
        {canExportHttpDiagnostics ? <button onClick={() => onExportResponseDiagnostic('debug')} type="button"><Icon name="download" size={14} /> Export debug</button> : null}
        {canExportHttpDiagnostics ? <button onClick={() => onExportResponseDiagnostic('har')} type="button"><Icon name="download" size={14} /> Export HAR</button> : null}
        <span className="footer-spacer" />
        <span>{streaming ? `${streamMessages.length} messages` : `${formatBytes(response.sizeBytes)} stored`}</span>
      </div>
    </section>
  );
}

type EnvironmentDocumentPanelProps = {
  environments: Environment[];
  activeId: string;
  documentTabStrip: ReactNode;
  onChange: (environment: Environment) => void;
  onSelect: (id: string) => void;
  onAdd: (parentId: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onMove: (move: WorkspaceEnvironmentMove) => void;
  vaultSession: VaultSession;
  onVaultEntriesChange: (entries: VaultEntry[]) => void;
  vaultSaveError: string;
};

function EnvironmentDocumentPanel({ environments, activeId, documentTabStrip, onChange, onSelect, onAdd, onDelete, onDuplicate, onMove, vaultSession, onVaultEntriesChange, vaultSaveError }: EnvironmentDocumentPanelProps) {
  const dragEnvironmentRef = useRef<string | undefined>(undefined);
  const [draggedEnvironmentId, setDraggedEnvironmentId] = useState('');
  const [environmentDrop, setEnvironmentDrop] = useState<{ id: string; placement: 'before' | 'after' }>();
  const environment = environments.find((candidate) => candidate.id === activeId) ?? environments[0];
  if (!environment) return null;
  const resolved = resolveEnvironment(environments, environment.id) ?? environment;
  const ownNames = new Set(environment.variables.map((variable) => variable.name));
  const inherited = resolved.variables.filter((variable) => !ownNames.has(variable.name));
  const publicIds = new Set(publicEnvironments(environments).map((candidate) => candidate.id));
  const roots = environments.filter((candidate) => !candidate.parentId);
  const hasSecrets = environmentHasSecrets(environment);
  const updateIdentity = (next: Environment) => {
    if (hasSecrets && !next.private) {
      window.alert('Convert or remove this environment’s Secret variables before making it shared.');
      return;
    }
    onChange(next);
  };
  const clearEnvironmentDrag = () => {
    dragEnvironmentRef.current = undefined;
    setDraggedEnvironmentId('');
    setEnvironmentDrop(undefined);
  };
  const beginEnvironmentDrag = (event: ReactDragEvent<HTMLButtonElement>, candidate: Environment) => {
    if (!candidate.parentId) {
      event.preventDefault();
      return;
    }
    dragEnvironmentRef.current = candidate.id;
    setDraggedEnvironmentId(candidate.id);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', 'brunomnia-environment');
  };
  const dropOnEnvironment = (event: ReactDragEvent<HTMLButtonElement>, target: Environment, commit: boolean) => {
    const sourceId = dragEnvironmentRef.current;
    const source = environments.find((candidate) => candidate.id === sourceId);
    if (!source?.parentId || source.id === target.id || source.parentId !== target.parentId) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const placement = event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after';
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'move';
    setEnvironmentDrop({ id: target.id, placement });
    if (commit) {
      onMove({ environmentId: source.id, targetEnvironmentId: target.id, placement });
      clearEnvironmentDrag();
    }
  };
  const keyboardEnvironmentMove = (event: ReactKeyboardEvent<HTMLButtonElement>, candidate: Environment) => {
    if (!event.altKey || event.metaKey || event.ctrlKey) return;
    const action = event.key === 'ArrowUp' ? 'up' : event.key === 'ArrowDown' ? 'down' : event.key === 'Home' ? 'first' : event.key === 'End' ? 'last' : undefined;
    if (!action) return;
    const move = keyboardWorkspaceEnvironmentMove(environments, candidate.id, action);
    if (!move) return;
    event.preventDefault();
    event.stopPropagation();
    onMove(move);
  };
  const renderEnvironment = (candidate: Environment, depth: number): ReactNode => {
    const dropClass = environmentDrop?.id === candidate.id ? ` drop-${environmentDrop.placement}` : '';
    return <div key={candidate.id}><button aria-grabbed={draggedEnvironmentId === candidate.id} aria-keyshortcuts={candidate.parentId ? 'Alt+ArrowUp Alt+ArrowDown Alt+Home Alt+End' : undefined} className={`${candidate.id === environment.id ? 'active' : ''}${draggedEnvironmentId === candidate.id ? ' is-dragging' : ''}${dropClass}`} draggable={Boolean(candidate.parentId)} onClick={() => onSelect(candidate.id)} onDragEnd={clearEnvironmentDrag} onDragOver={(event) => dropOnEnvironment(event, candidate, false)} onDragStart={(event) => beginEnvironmentDrag(event, candidate)} onDrop={(event) => dropOnEnvironment(event, candidate, true)} onKeyDown={(event) => keyboardEnvironmentMove(event, candidate)} style={{ '--environment-depth': depth } as CSSProperties} title={candidate.parentId ? 'Drag to reorder siblings · Option/Alt+Up/Down/Home/End reorders' : undefined} type="button"><i style={{ background: candidate.color || 'var(--muted)' }} /><span>{candidate.name}</span>{candidate.private ? <small>PRIVATE</small> : null}</button>{environments.filter((child) => child.parentId === candidate.id).map((child) => renderEnvironment(child, depth + 1))}</div>;
  };
  return (
    <section aria-labelledby="environment-title" className="environment-document-panel">
      {documentTabStrip}
      <header><div><small>Project environments</small><h2 id="environment-title">{environment.name}</h2></div><span>{environment.private ? 'Private on this device' : 'Shared project data'}</span></header>
      <div className="environment-layout"><aside><div>{roots.map((candidate) => renderEnvironment(candidate, 0))}</div><button onClick={() => onAdd('')} type="button"><Icon name="plus" size={13} /> Base environment</button><button onClick={() => onAdd(environment.id)} type="button"><Icon name="plus" size={13} /> Sub-environment</button></aside><main>
        <div className="environment-identity"><label>Name<input onChange={(event) => updateIdentity({ ...environment, name: event.target.value })} value={environment.name} /></label><label>Parent<select onChange={(event) => { const parentId = event.target.value; updateIdentity({ ...environment, parentId, private: parentId ? environment.private || !publicIds.has(parentId) : false }); }} value={environment.parentId ?? ''}><option value="">None (base)</option>{environments.filter((candidate) => candidate.id !== environment.id && !environmentAncestors(environments, candidate.id).some((ancestor) => ancestor.id === environment.id)).map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}</select></label><label>Color<input onChange={(event) => updateIdentity({ ...environment, color: event.target.value })} type="color" value={environment.color || '#7e8a91'} /></label><label className="private-environment"><input checked={environment.private === true} disabled={!environment.parentId || !publicIds.has(environment.parentId)} onChange={(event) => updateIdentity({ ...environment, private: event.target.checked })} type="checkbox" /> Private on this device</label></div>
        <p>Own values override inherited values immediately. Private environments can store encrypted Secret rows under <code>vault.*</code> while the local vault is unlocked; their plaintext never enters workspace JSON, sync, Git, or exports.</p>
        {inherited.length ? <div className="inherited-variables"><strong>Inherited from parent</strong>{inherited.map((variable) => <span key={variable.name}><code>{variable.valueType === 'secret' ? `vault.${variable.name}` : variable.name}</code><em>{variable.valueType === 'secret' ? '••••••' : variable.value}</em></span>)}</div> : null}
        <EnvironmentVariablesEditor allowSecrets={environment.private === true} key={environment.id} mode={environment.environmentEditorMode} onChange={(variables, environmentEditorMode) => onChange({ ...environment, variables, environmentEditorMode })} onSecretEntriesChange={onVaultEntriesChange} rows={environment.variables} secretAvailable={environment.private === true && vaultSession.unlocked} secretEntries={vaultSession.entries} />
        {environment.private && !vaultSession.unlocked ? <p className="environment-editor-error">Unlock the local vault in Security &amp; Sync to create or edit Secret variables.</p> : null}
        {vaultSaveError ? <p className="environment-editor-error" role="alert">{vaultSaveError}</p> : null}
      </main></div>
      <footer><button className="danger-action" disabled={environments.length <= 1 || hasSecrets && !vaultSession.unlocked} onClick={() => onDelete(environment.id)} type="button">Delete</button><button className="secondary-button" disabled={!environment.parentId || hasSecrets && !vaultSession.unlocked} onClick={() => onDuplicate(environment.id)} type="button"><Icon name="copy" size={13} /> Duplicate</button><span className="footer-spacer" /><span>{environments.length} environment{environments.length === 1 ? '' : 's'}</span></footer>
    </section>
  );
}

type CollectionDocumentPanelProps = {
  collection: Workspace['collections'][number];
  documentTabStrip: ReactNode;
  onChange: (collection: Workspace['collections'][number]) => void;
};

function CollectionDocumentPanel({ collection, documentTabStrip, onChange }: CollectionDocumentPanelProps) {
  const [tab, setTab] = useState<'variables' | 'docs'>('variables');
  const selectedEnvironment = (collection.subEnvironments ?? []).find((environment) => environment.id === collection.activeSubEnvironmentId);
  const selectEnvironment = (activeSubEnvironmentId: string) => onChange({ ...collection, activeSubEnvironmentId });
  const addEnvironment = () => {
    const id = uid('collection-environment');
    onChange({
      ...collection,
      activeSubEnvironmentId: id,
      subEnvironments: [...(collection.subEnvironments ?? []), { id, name: `Environment ${(collection.subEnvironments?.length ?? 0) + 1}`, variables: [], environmentEditorMode: 'table' }],
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
  return <section aria-labelledby="collection-settings-title" className="folder-document-panel collection-document-panel">
    {documentTabStrip}
    <header><div><small>Collection workspace</small><h2 id="collection-settings-title">{collection.name}</h2></div><span className="collection-document-summary">{collection.requests.length} requests · {(collection.folders ?? []).length} folders</span></header>
    <div className="folder-identity"><label>Name<input onChange={(event) => onChange({ ...collection, name: event.target.value })} value={collection.name} /></label></div>
    <nav aria-label="Collection settings" className="interchange-tabs"><button className={tab === 'variables' ? 'active' : ''} onClick={() => setTab('variables')} type="button">Variables</button><button className={tab === 'docs' ? 'active' : ''} onClick={() => setTab('docs')} type="button">Docs</button></nav>
    <div className="folder-modal-content">
      {tab === 'variables' ? <div className="environment-layout collection-environment-layout"><aside><div><button className={!selectedEnvironment ? 'active' : ''} onClick={() => selectEnvironment('')} type="button"><i /><span>Base environment</span><small>BASE</small></button>{(collection.subEnvironments ?? []).map((environment) => <button className={selectedEnvironment?.id === environment.id ? 'active' : ''} key={environment.id} onClick={() => selectEnvironment(environment.id)} type="button"><i /><span>{environment.name}</span></button>)}</div><button onClick={addEnvironment} type="button"><Icon name="plus" size={13} /> Sub-environment</button></aside><main>
        {selectedEnvironment ? <div className="environment-identity collection-environment-identity"><label>Name<input onChange={(event) => updateSelectedEnvironment({ name: event.target.value })} value={selectedEnvironment.name} /></label></div> : <strong>Collection base environment</strong>}
        <p>{selectedEnvironment ? 'The selected collection environment overrides the collection base and selected global values.' : 'Base collection values override selected and base global values for every request in this collection.'}</p>
        <EnvironmentVariablesEditor key={selectedEnvironment?.id ?? `${collection.id}-base-environment`} mode={selectedEnvironment?.environmentEditorMode ?? collection.environmentEditorMode} onChange={(variables, environmentEditorMode) => selectedEnvironment ? updateSelectedEnvironment({ variables, environmentEditorMode }) : onChange({ ...collection, environment: variables, environmentEditorMode })} rows={selectedEnvironment?.variables ?? collection.environment ?? []} />
        {selectedEnvironment ? <button className="danger-action collection-environment-delete" onClick={deleteSelectedEnvironment} type="button">Delete sub-environment</button> : null}
      </main></div> : null}
      {tab === 'docs' ? <div className="request-docs-editor"><header><strong>Collection documentation</strong><small>Markdown source</small></header><textarea aria-label="Collection documentation" onChange={(event) => onChange({ ...collection, documentation: event.target.value })} value={collection.documentation ?? ''} /><section><small>Preview</small><pre>{collection.documentation || 'No documentation yet.'}</pre></section></div> : null}
    </div>
  </section>;
}

type FolderDialogProps = {
  collection: Workspace['collections'][number];
  folder: RequestFolder;
  environment: Environment;
  cookies: CookieRecord[];
  responses: StoredResponse[];
  requestContext: SendRequestContext;
  showPasswords: boolean;
  onChange: (folder: RequestFolder) => void;
  onClose: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
};

type FolderEditorContentProps = Omit<FolderDialogProps, 'onClose' | 'onDelete' | 'onDuplicate'> & { autoFocusName?: boolean };

function FolderEditorContent({ collection, folder, environment, cookies, responses, requestContext, showPasswords, onChange, autoFocusName = false }: FolderEditorContentProps) {
  const [tab, setTab] = useState<'variables' | 'headers' | 'auth' | 'scripts' | 'docs'>('variables');
  const authRequest = createBlankRequest(`folder-auth-${folder.id}`);
  authRequest.auth = folder.auth ?? authRequest.auth;
  const invalidParents = new Set([folder.id, ...(collection.folders ?? []).filter((candidate) => folderAncestors(collection, candidate.id).some((ancestor) => ancestor.id === folder.id)).map((candidate) => candidate.id)]);
  return <>
    <div className="folder-identity"><label>Name<input autoFocus={autoFocusName} onChange={(event) => onChange({ ...folder, name: event.target.value })} value={folder.name} /></label><label>Parent folder<select onChange={(event) => onChange({ ...folder, parentId: event.target.value })} value={folder.parentId}><option value="">Collection root</option>{(collection.folders ?? []).filter((candidate) => !invalidParents.has(candidate.id)).map((candidate) => <option key={candidate.id} value={candidate.id}>{folderPath(collection, candidate.id)}</option>)}</select></label></div>
    <nav className="interchange-tabs" aria-label="Folder settings">{(['variables', 'headers', 'auth', 'scripts', 'docs'] as const).map((item) => <button className={tab === item ? 'active' : ''} key={item} onClick={() => setTab(item)} type="button">{titleCase(item)}</button>)}</nav>
    <div className="folder-modal-content">
      {tab === 'variables' ? <><p>Folder values override collection and selected environment values for every descendant request.</p><EnvironmentVariablesEditor key={folder.id} mode={folder.environmentEditorMode} onChange={(environment, environmentEditorMode) => onChange({ ...folder, environment, environmentEditorMode })} rows={folder.environment} /></> : null}
      {tab === 'headers' ? <><p>Closer folders and request headers override inherited headers with the same name.</p><KeyValueEditor namePlaceholder="Header" onChange={(headers) => onChange({ ...folder, headers })} rows={folder.headers} /></> : null}
      {tab === 'auth' ? <><label className="folder-auth-toggle"><input checked={Boolean(folder.auth)} onChange={(event) => onChange({ ...folder, auth: event.target.checked ? authRequest.auth : undefined })} type="checkbox" /> Configure inheritable authentication</label>{folder.auth ? <Suspense fallback={<div className="dialog-loading">Loading authentication…</div>}><AuthEditor cookies={cookies} environment={environment} onChange={(patch) => { if (patch.auth) onChange({ ...folder, auth: patch.auth }); }} request={authRequest} requestContext={requestContext} responses={responses} showPasswords={showPasswords} /></Suspense> : <div className="empty-state compact"><Icon name="lock" size={24} /><strong>No folder authentication</strong><span>Enable it here, then choose “Inherit” on descendant requests.</span></div>}</> : null}
      {tab === 'scripts' ? <div className="folder-script-grid"><section><header>Pre-request · root to request</header><CodeEditor ariaLabel="Folder pre-request script" onChange={(preRequestScript) => onChange({ ...folder, preRequestScript })} value={folder.preRequestScript} /></section><section><header>After-response · request to root</header><CodeEditor ariaLabel="Folder after-response script" onChange={(tests) => onChange({ ...folder, tests })} value={folder.tests} /></section></div> : null}
      {tab === 'docs' ? <div className="request-docs-editor"><header><strong>Folder documentation</strong><small>Markdown source</small></header><textarea aria-label="Folder documentation" onChange={(event) => onChange({ ...folder, documentation: event.target.value })} value={folder.documentation} /><section><small>Preview</small><pre>{folder.documentation || 'No documentation yet.'}</pre></section></div> : null}
    </div>
  </>;
}

function FolderDialog({ collection, folder, environment, cookies, responses, requestContext, showPasswords, onChange, onClose, onDelete, onDuplicate }: FolderDialogProps) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}><section aria-labelledby="folder-title" aria-modal="true" className="modal folder-modal" onMouseDown={(event) => event.stopPropagation()} role="dialog">
    <header><div><small>Inherited request configuration</small><h2 id="folder-title">{folder.name}</h2></div><button aria-label="Close" className="icon-button subtle" onClick={onClose} type="button"><Icon name="x" /></button></header>
    <FolderEditorContent autoFocusName collection={collection} cookies={cookies} environment={environment} folder={folder} onChange={onChange} requestContext={requestContext} responses={responses} showPasswords={showPasswords} />
    <footer><button className="danger-action" onClick={onDelete} type="button">Delete folder</button><button className="secondary-button" onClick={onDuplicate} type="button"><Icon name="copy" size={13} /> Duplicate folder</button><span className="footer-spacer" /><button className="secondary-button" onClick={onClose} type="button">Done</button></footer>
  </section></div>;
}

type FolderDocumentPanelProps = FolderEditorContentProps & {
  documentTabStrip: ReactNode;
  onConfigure: () => void;
  onRun: () => void;
};

function FolderDocumentPanel({ documentTabStrip, onConfigure, onRun, ...editorProps }: FolderDocumentPanelProps) {
  return <section className="folder-document-panel">
    {documentTabStrip}
    <header><div><small>Inherited request configuration</small><h2>{editorProps.folder.name}</h2></div><div><button className="secondary-button" onClick={onRun} type="button"><Icon name="play" size={13} /> Run folder</button><button className="secondary-button" onClick={onConfigure} type="button"><Icon name="settings" size={13} /> Folder settings</button></div></header>
    <FolderEditorContent {...editorProps} />
  </section>;
}

export default function App() {
  const [workspace, setWorkspace] = useState<Workspace>(() => ({
    format: 'brunomnia', version: 48, name: 'Loading…', activeRequestId: '', activeEnvironmentId: '', collections: [], environments: [], history: [], apiDesigns: [], mockServers: [], testSuites: [], unitTestResults: [], runnerReports: [], imports: [], cookies: [], fileState: {}, responses: [], streamSessions: [], mcpSessions: [], responseFilters: {}, certificates: { ca: { enabled: false, pem: '' }, clients: [] }, project: { mode: 'local', path: '', remoteUrl: '', remoteName: 'origin', authorName: '', authorEmail: '', autoSave: true, gitCredentialId: '' }, plugins: [], pluginData: {}, activePluginTheme: '', collaboration: { mode: 'off', path: '', actor: '', revision: 0 }, governance: { currentMemberId: 'local-owner', members: [{ id: 'local-owner', name: 'Local owner', email: '', role: 'owner', active: true }], policy: { allowedStorage: ['local', 'folder', 'git', 'encrypted-file'], requireEncryptedSync: true, requireVaultForSecrets: true, externalVaultAllowlist: [], auditRetention: 500 }, audit: [] }, mcpClients: [], ai: { enabled: false, provider: 'openai-compatible', baseUrl: 'http://127.0.0.1:11434/v1', model: '', apiKey: '', temperature: 0.6, topP: 0.9, topK: 40, seed: true, repeatPenalty: 1.1, mockGeneration: false, commitSuggestions: false }, konnect: { enabled: false, baseUrl: 'https://us.api.konghq.com', token: '', controlPlaneId: '', controlPlanes: [] }, preferences: structuredClone(defaultPreferences),
  }));
  const [hydrated, setHydrated] = useState(false);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState('');
  const [workspaceEntries, setWorkspaceEntries] = useState<WorkspaceCatalogEntry[]>([]);
  const [workspaceRecovery, setWorkspaceRecovery] = useState<WorkspaceRecovery>();
  const [workspaceStoreError, setWorkspaceStoreError] = useState('');
  const [workspaceStoreBusy, setWorkspaceStoreBusy] = useState(false);
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>('collections');
  const [search, setSearch] = useState('');
  const [requestTab, setRequestTab] = useState<RequestTab>('body');
  const [requestPinState, setRequestPinState] = useState<{ workspaceId: string; ids: string[] }>({ workspaceId: '', ids: [] });
  const [requestDocumentState, setRequestDocumentState] = useState<{ workspaceId: string; state: RequestTabState }>({ workspaceId: '', state: emptyRequestTabState() });
  const [runnerDrafts, setRunnerDrafts] = useState<Record<string, RunnerWorkbenchDraft>>({});
  const [responseTab, setResponseTab] = useState<ResponseTab>('preview');
  const [response, setResponse] = useState<HttpResponse>(() => mockResponse());
  const [selectedResponseId, setSelectedResponseId] = useState('');
  const [selectedStreamSessionId, setSelectedStreamSessionId] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [oauthAuthorization, setOAuthAuthorization] = useState<OAuthAuthorizationStatus>();
  const [showPalette, setShowPalette] = useState(false);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showSendOptions, setShowSendOptions] = useState(false);
  const [showCodeGeneration, setShowCodeGeneration] = useState(false);
  const [folderEditor, setFolderEditor] = useState<{ collectionId: string; folderId: string }>();
  const [sendDelayMs, setSendDelayMs] = useState(0);
  const [repeatIntervalMs, setRepeatIntervalMs] = useState(1_000);
  const [scheduledSendLabel, setScheduledSendLabel] = useState('');
  const [sidebarHidden, setSidebarHidden] = useState(false);
  const [streamStatus, setStreamStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'reconnecting'>('disconnected');
  const [streamMessages, setStreamMessages] = useState<StreamMessage[]>([]);
  const [streamSessionView, setStreamSessionView] = useState<StoredStreamSession>();
  const [streamDraft, setStreamDraft] = useState('');
  const [streamFrameKind, setStreamFrameKind] = useState<'text' | 'binary'>('text');
  const [grpcSchemas, setGrpcSchemas] = useState<Record<string, GrpcSchema>>({});
  const [grpcSchemaLoading, setGrpcSchemaLoading] = useState(false);
  const [graphqlSchemaLoading, setGraphqlSchemaLoading] = useState(false);
  const [graphqlSchemaError, setGraphqlSchemaError] = useState<{ requestId: string; message: string }>();
  const [workbenchSection, setWorkbenchSection] = useState<WorkbenchSection>('requests');
  const [preferencesInitialTab, setPreferencesInitialTab] = useState<'general' | 'keyboard' | 'data'>('general');
  const [pluginReloadGeneration, setPluginReloadGeneration] = useState(0);
  const [scriptTests, setScriptTests] = useState<ScriptTestResult[]>([]);
  const [scriptLogs, setScriptLogs] = useState<string[]>([]);
  const [runningMocks, setRunningMocks] = useState<Record<string, RunningMock>>({});
  const [projectSyncError, setProjectSyncError] = useState('');
  const [contextualPluginActions, setContextualPluginActions] = useState<ContextualPluginAction[]>([]);
  const [contextualPluginActionErrors, setContextualPluginActionErrors] = useState<string[]>([]);
  const [contextualPluginActionBusyKey, setContextualPluginActionBusyKey] = useState('');
  const [contextualPluginActionFeedback, setContextualPluginActionFeedback] = useState<{ error: boolean; message: string }>();
  const [templatePrompt, setTemplatePrompt] = useState<PendingTemplatePrompt>();
  const [vaultSession, setVaultSession] = useState<VaultSession>({ unlocked: false, passphrase: '', entries: [] });
  const [environmentVaultSaveError, setEnvironmentVaultSaveError] = useState('');
  const streamSession = useRef<string | undefined>(undefined);
  const streamProtocol = useRef<Protocol | undefined>(undefined);
  const selectedStreamSessionIdRef = useRef('');
  const streamViewScopeRef = useRef('');
  const activeRequestIdRef = useRef('');
  const activeWorkspaceIdRef = useRef('');
  const workspaceRef = useRef(workspace);
  const urlInputRef = useRef<HTMLInputElement>(null);
  const methodInputRef = useRef<HTMLInputElement>(null);
  const sidebarSearchInputRef = useRef<HTMLInputElement>(null);
  const environmentSelectRef = useRef<HTMLSelectElement>(null);
  const responsePanelRef = useRef<HTMLElement>(null);
  const graphqlFilterInputRef = useRef<HTMLInputElement>(null);
  const scheduledCancelled = useRef(false);
  const scheduledTimer = useRef<number | undefined>(undefined);
  const scheduledResolve = useRef<(() => void) | undefined>(undefined);
  const workspaceSaveGeneration = useRef(0);
  const vaultSessionRef = useRef(vaultSession);
  const environmentVaultSaveTimer = useRef<number | undefined>(undefined);
  const environmentVaultSaveGeneration = useRef(0);
  const environmentVaultSavePending = useRef(false);
  const oauthFlowId = useRef('');
  const contextualPluginActionBusyRef = useRef('');
  const templateResponseResolver = useRef<SendRequestContext['resolveResponse']>(undefined);
  const templatePromptQueue = useRef<PendingTemplatePrompt[]>([]);
  const activeTemplatePrompt = useRef<PendingTemplatePrompt | undefined>(undefined);

  const requestTemplatePrompt = useCallback((input: TemplatePromptInput) => new Promise<string | null>((resolve) => {
    const pending = { id: uid('template-prompt'), input, resolve };
    if (activeTemplatePrompt.current) {
      templatePromptQueue.current.push(pending);
      return;
    }
    activeTemplatePrompt.current = pending;
    setTemplatePrompt(pending);
  }), []);

  const resolveTemplatePrompt = useCallback((value: string | null) => {
    const current = activeTemplatePrompt.current;
    if (!current) return;
    current.resolve(value);
    const next = templatePromptQueue.current.shift();
    activeTemplatePrompt.current = next;
    setTemplatePrompt(next);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void workspaceCatalogApi().then(({ loadWorkspaceCatalog }) => loadWorkspaceCatalog()).then((snapshot) => {
      if (!cancelled) {
        setWorkspace(snapshot.workspace);
        setActiveWorkspaceId(snapshot.activeWorkspaceId);
        setWorkspaceEntries(snapshot.entries);
        setWorkspaceRecovery(snapshot.recovery);
        setHydrated(true);
      }
    }).catch(async (error) => {
      if (cancelled) return;
      const { createBlankWorkspace } = await workspaceCatalogApi();
      setWorkspace(createBlankWorkspace('Recovery Project', defaultPreferences));
      setWorkspaceStoreError(error instanceof Error ? error.message : String(error));
      setHydrated(true);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!hydrated || !activeWorkspaceId) return;
    let stored: string | null = null;
    try { stored = window.localStorage.getItem(requestPinsStorageKey(activeWorkspaceId)); } catch { stored = null; }
    const ids = reconcilePinnedRequestIds(workspace, parsePinnedRequestIds(stored));
    setRequestPinState({ workspaceId: activeWorkspaceId, ids });
  }, [activeWorkspaceId, hydrated]);

  useEffect(() => {
    if (!hydrated || !isTauri()) return;
    void invoke('oauth2_configure_session', { clearOnRestart: workspace.preferences.clearOAuth2SessionOnRestart }).catch(() => undefined);
  }, [hydrated, workspace.preferences.clearOAuth2SessionOnRestart]);

  useEffect(() => {
    if (!hydrated || !activeWorkspaceId || !isTauri()) return;
    let cancelled = false;
    void autoUnlockSavedVault(activeWorkspaceId).then((entries) => {
      if (cancelled || !entries) return;
      setVaultSession((current) => current.unlocked ? current : { unlocked: true, passphrase: '', entries });
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [activeWorkspaceId, hydrated]);

  useEffect(() => {
    vaultSessionRef.current = vaultSession;
  }, [vaultSession]);

  useEffect(() => () => {
    if (environmentVaultSaveTimer.current !== undefined) window.clearTimeout(environmentVaultSaveTimer.current);
    environmentVaultSaveTimer.current = undefined;
  }, [activeWorkspaceId]);

  useEffect(() => {
    if (!hydrated || !activeWorkspaceId || requestPinState.workspaceId !== activeWorkspaceId) return;
    const ids = reconcilePinnedRequestIds(workspace, requestPinState.ids);
    if (ids.length !== requestPinState.ids.length || ids.some((id, index) => id !== requestPinState.ids[index])) {
      setRequestPinState({ workspaceId: activeWorkspaceId, ids });
      return;
    }
    try { window.localStorage.setItem(requestPinsStorageKey(activeWorkspaceId), JSON.stringify(ids)); } catch {}
  }, [activeWorkspaceId, hydrated, requestPinState, workspace.collections]);

  useEffect(() => {
    if (!hydrated || !activeWorkspaceId) return;
    let stored: string | null = null;
    try { stored = window.localStorage.getItem(requestTabsStorageKey(activeWorkspaceId)); } catch { stored = null; }
    const validDocuments = workspaceDocumentReferences(workspace, activeWorkspaceId);
    const state = reconcileRequestTabState(parseRequestTabState(stored), validDocuments, { id: workspace.activeRequestId, type: 'request' });
    setRequestDocumentState({ workspaceId: activeWorkspaceId, state });
    if (state.tabs.find((tab) => tab.requestId === state.activeRequestId)?.type === 'request' && state.activeRequestId !== workspace.activeRequestId) {
      setWorkspace((current) => ({ ...current, activeRequestId: state.activeRequestId }));
    }
  }, [activeWorkspaceId, hydrated]);

  useEffect(() => {
    if (!hydrated || !activeWorkspaceId || requestDocumentState.workspaceId !== activeWorkspaceId) return;
    const validDocuments = workspaceDocumentReferences(workspace, activeWorkspaceId);
    let state = reconcileRequestTabState(requestDocumentState.state, validDocuments, { id: workspace.activeRequestId, type: 'request' });
    const activeDocument = state.tabs.find((tab) => tab.requestId === state.activeRequestId);
    if (!state.dashboard && (!activeDocument || activeDocument.type === 'request') && workspace.activeRequestId && validDocuments.some((document) => document.type === 'request' && document.id === workspace.activeRequestId) && state.activeRequestId !== workspace.activeRequestId) {
      state = openRequestTab(state, workspace.activeRequestId);
    }
    if (JSON.stringify(state) !== JSON.stringify(requestDocumentState.state)) {
      setRequestDocumentState({ workspaceId: activeWorkspaceId, state });
      return;
    }
    try { window.localStorage.setItem(requestTabsStorageKey(activeWorkspaceId), JSON.stringify(state)); } catch {}
  }, [activeWorkspaceId, hydrated, requestDocumentState, workspace.activeRequestId, workspace.apiDesigns, workspace.collections, workspace.mockServers, workspace.testSuites]);

  useEffect(() => {
    if (!hydrated || !activeWorkspaceId || (workspaceRecovery?.kind === 'workspace-backup' && workspaceRecovery.workspaceId === activeWorkspaceId)) return;
    const generation = workspaceSaveGeneration.current;
    const timeout = window.setTimeout(() => {
      if (generation !== workspaceSaveGeneration.current) return;
      void workspaceCatalogApi().then(({ saveCatalogWorkspace }) => saveCatalogWorkspace(activeWorkspaceId, workspace)).then(() => {
        setWorkspaceEntries((current) => current.map((entry) => entry.id === activeWorkspaceId ? { ...entry, name: workspace.name, updatedAt: new Date().toISOString(), status: 'ready' } : entry));
      }).catch((error) => setWorkspaceStoreError(error instanceof Error ? error.message : String(error)));
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [activeWorkspaceId, hydrated, workspace, workspaceRecovery]);

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
    let cancelled = false;
    setContextualPluginActions([]);
    setContextualPluginActionErrors([]);
    if (!hydrated) return;
    void discoverContextualPluginActions(workspace.plugins).then((result) => {
      if (cancelled) return;
      setContextualPluginActions(result.actions);
      setContextualPluginActionErrors(result.errors.map((error) => `${error.pluginName}: ${error.message}`));
    });
    return () => { cancelled = true; };
  }, [hydrated, workspace.plugins]);

  useEffect(() => {
    if (!hydrated || !isTauri() || workspace.project.mode === 'local' || !workspace.project.path || !workspace.project.autoSave) return;
    const plaintext = workspace.governance.policy.requireVaultForSecrets ? plaintextSecretCandidates(withoutOAuth2RuntimeCredentials(workspace)) : [];
    if (plaintext.length) { setProjectSyncError(`Vault policy blocked ${plaintext.length} plaintext secret candidate${plaintext.length === 1 ? '' : 's'}.`); return; }
    const timeout = window.setTimeout(() => {
      void import('./lib/project')
        .then(({ writeProject }) => writeProject(workspace.project.path, workspace))
        .then(() => setProjectSyncError(''))
        .catch((caught) => setProjectSyncError(caught instanceof Error ? caught.message : String(caught)));
    }, 700);
    return () => window.clearTimeout(timeout);
  }, [hydrated, workspace]);

  const active = useMemo(() => findRequest(workspace), [workspace]);
  const activePinnedRequestIds = requestPinState.workspaceId === activeWorkspaceId ? requestPinState.ids : [];
  const requestsById = useMemo(() => new Map(workspace.collections.flatMap((collection) => collection.requests.map((request) => [request.id, request] as const))), [workspace.collections]);
  const foldersById = useMemo(() => new Map(workspace.collections.flatMap((collection) => (collection.folders ?? []).map((folder) => [folder.id, { folder, collection }] as const))), [workspace.collections]);
  const runnerTargetsById = useMemo(() => new Map([
    [runnerDocumentId(activeWorkspaceId), undefined] as const,
    ...workspace.collections.flatMap((collection) => (collection.folders ?? []).map((folder) => [runnerDocumentId(activeWorkspaceId, folder.id), { collectionId: collection.id, folderId: folder.id }] as const)),
  ]), [activeWorkspaceId, workspace.collections]);
  const mockTargetsById = useMemo(() => {
    const targets = new Map<string, { server: MockServer; route?: MockServer['routes'][number] }>();
    workspace.mockServers.forEach((server) => {
      targets.set(server.id, { server });
      server.routes.forEach((route) => targets.set(route.id, { server, route }));
    });
    return targets;
  }, [workspace.mockServers]);
  const validDocumentReferences = useMemo(() => workspaceDocumentReferences(workspace, activeWorkspaceId), [activeWorkspaceId, workspace]);
  const activeRequestDocumentState = requestDocumentState.workspaceId === activeWorkspaceId
    ? requestDocumentState.state
    : reconcileRequestTabState(emptyRequestTabState(), validDocumentReferences, { id: workspace.activeRequestId, type: 'request' });
  const openDocumentTabs = activeRequestDocumentState.tabs.flatMap((tab): DocumentTabView[] => {
    if (tab.type === 'request') {
      const request = requestsById.get(tab.requestId);
      return request ? [{ id: request.id, type: 'request', name: request.name, request, temporary: tab.temporary }] : [];
    }
    if (tab.type === 'runner') {
      const target = runnerTargetsById.get(tab.requestId);
      const folderName = target?.folderId ? foldersById.get(target.folderId)?.folder.name : '';
      return runnerTargetsById.has(tab.requestId) ? [{ id: tab.requestId, type: 'runner', name: folderName ? `Runner · ${folderName}` : 'Runner', temporary: tab.temporary }] : [];
    }
    if (tab.type === 'environment') {
      return tab.requestId === environmentDocumentId(activeWorkspaceId) ? [{ id: tab.requestId, type: 'environment', name: 'Environments', temporary: tab.temporary }] : [];
    }
    if (tab.type === 'document') {
      const design = workspace.apiDesigns.find((candidate) => candidate.id === tab.requestId);
      return design ? [{ id: design.id, type: 'document', name: design.name, temporary: tab.temporary }] : [];
    }
    if (tab.type === 'mockServer' || tab.type === 'mockRoute') {
      const target = mockTargetsById.get(tab.requestId);
      if (!target || (tab.type === 'mockServer' && target.route) || (tab.type === 'mockRoute' && !target.route)) return [];
      return [{ id: tab.requestId, type: tab.type, name: target.route?.name ?? target.server.name, temporary: tab.temporary, ...(target.route ? { method: target.route.method } : {}) }];
    }
    if (tab.type === 'collection') {
      const collection = workspace.collections.find((candidate) => candidate.id === tab.requestId);
      return collection ? [{ id: collection.id, type: 'collection', name: collection.name, temporary: tab.temporary }] : [];
    }
    if (tab.type === 'testSuite') {
      const suite = workspace.testSuites.find((candidate) => candidate.id === tab.requestId);
      return suite ? [{ id: suite.id, type: 'testSuite', name: suite.name, temporary: tab.temporary }] : [];
    }
    const folder = foldersById.get(tab.requestId)?.folder;
    return folder ? [{ id: folder.id, type: 'folder', name: folder.name, temporary: tab.temporary }] : [];
  });
  const activeDocumentTab = activeRequestDocumentState.tabs.find((tab) => tab.requestId === activeRequestDocumentState.activeRequestId);
  const activeFolderDocument = activeDocumentTab?.type === 'folder' ? foldersById.get(activeDocumentTab.requestId) : undefined;
  const activeRunnerTarget = activeDocumentTab?.type === 'runner' ? runnerTargetsById.get(activeDocumentTab.requestId) : undefined;
  const isRunnerDocument = activeDocumentTab?.type === 'runner' && runnerTargetsById.has(activeDocumentTab.requestId);
  const isEnvironmentDocument = activeDocumentTab?.type === 'environment' && activeDocumentTab.requestId === environmentDocumentId(activeWorkspaceId);
  const activeDesignDocument = activeDocumentTab?.type === 'document' ? workspace.apiDesigns.find((design) => design.id === activeDocumentTab.requestId) : undefined;
  const activeMockDocument = activeDocumentTab?.type === 'mockServer' || activeDocumentTab?.type === 'mockRoute' ? mockTargetsById.get(activeDocumentTab.requestId) : undefined;
  const activeCollectionDocument = activeDocumentTab?.type === 'collection' ? workspace.collections.find((collection) => collection.id === activeDocumentTab.requestId) : undefined;
  const activeTestSuiteDocument = activeDocumentTab?.type === 'testSuite' ? workspace.testSuites.find((suite) => suite.id === activeDocumentTab.requestId) : undefined;
  const isRequestDocument = activeDocumentTab?.type === 'request';
  const isRequestDashboard = openDocumentTabs.length === 0;
  useEffect(() => {
    if (!activeWorkspaceId) return;
    const validRunnerIds = new Set(validDocumentReferences.filter((document) => document.type === 'runner').map((document) => document.id));
    const prefix = `${activeWorkspaceId}\n`;
    const staleDocumentIds = Object.keys(runnerDrafts).filter((key) => key.startsWith(prefix) && !validRunnerIds.has(key.slice(prefix.length))).map((key) => key.slice(prefix.length));
    if (staleDocumentIds.length) setRunnerDrafts((current) => discardRunnerDraftEntries(current, activeWorkspaceId, staleDocumentIds));
  }, [activeWorkspaceId, runnerDrafts, validDocumentReferences]);
  const activeStreaming = active ? isStreamingRequest(active.request) : false;
  const activeCollection = workspace.collections.find((collection) => collection.id === active?.collectionId);
  activeRequestIdRef.current = workspace.activeRequestId;
  activeWorkspaceIdRef.current = activeWorkspaceId;
  workspaceRef.current = workspace;
  const selectedEnvironment = workspace.environments.find((environment) => environment.id === workspace.activeEnvironmentId);
  const activeEnvironment = useMemo(() => resolveEnvironment(workspace.environments, workspace.activeEnvironmentId), [workspace.activeEnvironmentId, workspace.environments]);
  const activeRequestFileId = active ? workspaceFileIdForCollection(workspace, active.collectionId) : '';
  const activeRequestFileState = getWorkspaceFileState(workspace, activeRequestFileId);
  const activeWorkspaceFileId = (isRequestDocument ? activeRequestFileId : '')
    || (activeCollectionDocument ? workspaceFileIdForCollection(workspace, activeCollectionDocument.id) : '')
    || activeDesignDocument?.id
    || activeMockDocument?.server.id
    || (activeFolderDocument ? workspaceFileIdForCollection(workspace, activeFolderDocument.collection.id) : '')
    || (activeRunnerTarget?.collectionId ? workspaceFileIdForCollection(workspace, activeRunnerTarget.collectionId) : '')
    || (activeTestSuiteDocument?.collectionId ? workspaceFileIdForCollection(workspace, activeTestSuiteDocument.collectionId) : '')
    || (isEnvironmentDocument ? workspaceFileIdForEnvironment(workspace, workspace.activeEnvironmentId) : '')
    || listProjectWorkspaces(workspace)[0]?.id
    || '';
  const activeWorkspaceFileState = getWorkspaceFileState(workspace, activeWorkspaceFileId);
  const streamViewScope = `${activeWorkspaceId}\n${active?.request.id ?? ''}\n${activeEnvironment?.id ?? ''}\n${workspace.preferences.filterResponsesByEnv ? 'environment' : 'request'}`;
  if (streamViewScopeRef.current !== streamViewScope) {
    streamViewScopeRef.current = streamViewScope;
    selectedStreamSessionIdRef.current = '';
  }
  useEffect(() => () => {
    const flowId = oauthFlowId.current;
    oauthFlowId.current = '';
    if (flowId) {
      setOAuthAuthorization(undefined);
      void import('./lib/oauth2').then(({ cancelOAuth2Authorization }) => cancelOAuth2Authorization(flowId)).catch(() => undefined);
    }
  }, [active?.request.id, activeWorkspaceId]);
  const proxyPreferences = useMemo(() => ({
    enabled: workspace.preferences.proxyEnabled,
    httpProxy: workspace.preferences.httpProxy,
    httpsProxy: workspace.preferences.httpsProxy,
    noProxy: workspace.preferences.noProxy,
  }), [workspace.preferences.httpProxy, workspace.preferences.httpsProxy, workspace.preferences.noProxy, workspace.preferences.proxyEnabled]);
  const readTemplateFile = useCallback((path: string) => import('./lib/scriptFiles').then(({ readDesktopTemplateFile }) => readDesktopTemplateFile(path, workspace.preferences.dataFolders)), [workspace.preferences.dataFolders]);
  const templateFileReader = workspace.preferences.allowScriptFileAccess && isTauri() ? readTemplateFile : undefined;
  const sendRequest = useCallback((request: ApiRequest, environment: Environment | undefined, context: SendRequestContext = {}) => sendHttpRequest(request, environment, {
    prompt: requestTemplatePrompt,
    readFile: templateFileReader,
    requestAncestors: requestAncestorNames(workspace.collections, request),
    resolveResponse: templateResponseResolver.current,
    ...context,
    certificates: getWorkspaceFileState(workspace, workspaceFileIdForRequest(workspace, request.id) || activeWorkspaceFileId).certificates,
  }), [activeWorkspaceFileId, requestTemplatePrompt, templateFileReader, workspace]);
  const activeResponseHistory = useMemo(() => visibleResponseHistory(
    workspace.responses,
    active?.request.id ?? '',
    activeEnvironment?.id ?? '',
    workspace.preferences.filterResponsesByEnv,
  ), [active?.request.id, activeEnvironment?.id, workspace.preferences.filterResponsesByEnv, workspace.responses]);
  const activeEnvironmentHistoryCount = activeResponseHistory.filter((saved) => saved.environmentId === activeEnvironment?.id).length;
  const activeStreamHistory = useMemo(() => visibleStreamSessions(
    workspace.streamSessions,
    active?.request.id ?? '',
    activeEnvironment?.id ?? '',
    workspace.preferences.filterResponsesByEnv,
  ), [active?.request.id, activeEnvironment?.id, workspace.preferences.filterResponsesByEnv, workspace.streamSessions]);
  const activeEnvironmentStreamHistoryCount = activeStreamHistory.filter((session) => session.environmentId === activeEnvironment?.id).length;
  const restoreSavedRequestVersion = (saved: StoredResponse | StoredStreamSession) => {
    void import('./lib/historicalRequest').then(({ restoreWorkspaceRequestSnapshot }) => {
      setWorkspace((current) => restoreWorkspaceRequestSnapshot(saved, current));
    }, () => undefined);
  };
  const showLatestSavedResponse = (responses: StoredResponse[], restoreRequest = false) => {
    const latest = visibleResponseHistory(
      responses,
      active?.request.id ?? '',
      activeEnvironment?.id ?? '',
      workspace.preferences.filterResponsesByEnv,
    )[0];
    setSelectedResponseId(latest?.id ?? '');
    setResponse(latest ?? mockResponse());
    setScriptTests(latest?.requestTestResults ?? []);
    setScriptLogs([]);
    if (latest && restoreRequest) restoreSavedRequestVersion(latest);
  };
  const deleteSelectedSavedResponse = () => {
    if (!selectedResponseId) return;
    const responses = deleteSavedResponse(workspace.responses, selectedResponseId);
    setWorkspace((current) => ({ ...current, responses: deleteSavedResponse(current.responses, selectedResponseId) }));
    showLatestSavedResponse(responses, true);
  };
  const clearActiveEnvironmentHistory = () => {
    if (!active || !activeEnvironment) return;
    const responses = clearSavedResponseHistory(workspace.responses, active.request.id, activeEnvironment.id);
    setWorkspace((current) => ({ ...current, responses: clearSavedResponseHistory(current.responses, active.request.id, activeEnvironment.id) }));
    showLatestSavedResponse(responses);
  };
  const selectSavedResponse = (saved: StoredResponse) => {
    setSelectedResponseId(saved.id);
    setResponse(saved);
    setScriptTests(saved.requestTestResults ?? []);
    setScriptLogs([]);
    restoreSavedRequestVersion(saved);
  };
  const showLatestStreamSession = (sessions: StoredStreamSession[], restoreRequest = false) => {
    const latest = visibleStreamSessions(
      sessions,
      active?.request.id ?? '',
      activeEnvironment?.id ?? '',
      workspace.preferences.filterResponsesByEnv,
    )[0];
    selectedStreamSessionIdRef.current = latest?.id ?? '';
    setSelectedStreamSessionId(selectedStreamSessionIdRef.current);
    setStreamMessages(latest?.messages ?? []);
    setStreamSessionView(latest);
    if (latest && restoreRequest) restoreSavedRequestVersion(latest);
  };
  const selectStreamSession = async (sessionId: string) => {
    const saved = activeStreamHistory.find((session) => session.id === sessionId);
    if (!saved) return;
    const operationScope = streamViewScopeRef.current;
    const liveSessionId = streamSession.current;
    const liveProtocol = streamProtocol.current;
    if (liveSessionId && liveSessionId !== sessionId && liveProtocol && (streamStatus === 'connected' || streamStatus === 'reconnecting')) {
      await disconnectStream(liveProtocol, liveSessionId).catch(() => undefined);
      if (streamSession.current === liveSessionId) {
        streamSession.current = undefined;
        streamProtocol.current = undefined;
        setStreamStatus('disconnected');
      }
    }
    if (streamViewScopeRef.current !== operationScope) return;
    selectedStreamSessionIdRef.current = saved.id;
    setSelectedStreamSessionId(saved.id);
    setStreamMessages(saved.messages);
    setStreamSessionView(saved);
    restoreSavedRequestVersion(saved);
  };
  const deleteSelectedStreamSession = async () => {
    if (!selectedStreamSessionId) return;
    const operationScope = streamViewScopeRef.current;
    const targetSessionId = selectedStreamSessionId;
    if (streamSession.current === targetSessionId && streamProtocol.current) {
      await disconnectStream(streamProtocol.current, targetSessionId).catch(() => undefined);
      if (streamSession.current === targetSessionId) {
        streamSession.current = undefined;
        streamProtocol.current = undefined;
        setStreamStatus('disconnected');
      }
    }
    if (streamViewScopeRef.current !== operationScope || selectedStreamSessionIdRef.current !== targetSessionId) return;
    const sessions = workspace.streamSessions.filter((session) => session.id !== targetSessionId);
    setWorkspace((current) => ({ ...current, streamSessions: current.streamSessions.filter((session) => session.id !== targetSessionId) }));
    showLatestStreamSession(sessions, true);
  };
  const clearActiveStreamHistory = async () => {
    if (!active || !activeEnvironment) return;
    const operationScope = streamViewScopeRef.current;
    const liveSessionId = streamSession.current;
    if (liveSessionId && streamProtocol.current) {
      await disconnectStream(streamProtocol.current, liveSessionId).catch(() => undefined);
      if (streamSession.current === liveSessionId) {
        streamSession.current = undefined;
        streamProtocol.current = undefined;
        setStreamStatus('disconnected');
      }
    }
    if (streamViewScopeRef.current !== operationScope) return;
    const sessions = workspace.streamSessions.filter((session) => session.requestId !== active.request.id || session.environmentId !== activeEnvironment.id);
    setWorkspace((current) => ({ ...current, streamSessions: current.streamSessions.filter((session) => session.requestId !== active.request.id || session.environmentId !== activeEnvironment.id) }));
    showLatestStreamSession(sessions);
  };
  const downloadResponseBody = (prettify: boolean) => {
    void import('./lib/responseDownload').then(({ downloadResponseBody }) => downloadResponseBody(active?.request.name ?? 'response', response, prettify), () => undefined);
  };
  const exportResponseDiagnostic = (kind: 'debug' | 'har') => {
    if (!active) return;
    const saved = selectedResponseId ? activeResponseHistory.find((candidate) => candidate.id === selectedResponseId) : undefined;
    const request = saved?.requestSnapshot?.id === active.request.id ? saved.requestSnapshot : active.request;
    void import('./lib/responseDownload').then(({ downloadResponseDiagnostic }) => {
      downloadResponseDiagnostic(request, response, kind, saved?.receivedAt);
    }, () => undefined);
  };
  const applyResponseFilter = (filter: string, remember: boolean) => {
    if (!active) return;
    const requestId = active.request.id;
    const value = filter.trim().slice(0, 2_000);
    setWorkspace((current) => {
      const previous = current.responseFilters?.[requestId] ?? { filter: '', history: [], previewMode: 'source' as const };
      return {
        ...current,
        responseFilters: {
          ...current.responseFilters,
          [requestId]: { ...previous, filter: value, history: remember ? rememberResponseFilter(previous.history, value) : previous.history },
        },
      };
    });
  };
  const changeResponsePreviewMode = (previewMode: ResponsePreviewMode) => {
    if (!active) return;
    const requestId = active.request.id;
    setWorkspace((current) => {
      const previous = current.responseFilters?.[requestId] ?? { filter: '', history: [], previewMode: 'source' as const };
      return { ...current, responseFilters: { ...current.responseFilters, [requestId]: { ...previous, previewMode } } };
    });
  };
  const unlockedVault = useMemo(() => ({
    ...environmentSecretVariables(activeEnvironment?.variables ?? [], vaultSession),
    ...vaultVariables(vaultSession),
  }), [activeEnvironment?.variables, vaultSession]);
  const persistEnvironmentVaultSession = useCallback(async (workspaceId: string, session: VaultSession, generation: number) => {
    try {
      if (session.passphrase) await saveVault(workspaceId, session.passphrase, session.entries);
      else await saveVaultWithSavedKey(workspaceId, session.entries);
      if (environmentVaultSaveGeneration.current === generation) {
        environmentVaultSavePending.current = false;
        setEnvironmentVaultSaveError('');
      }
      return true;
    } catch (caught) {
      if (environmentVaultSaveGeneration.current === generation) {
        environmentVaultSavePending.current = true;
        setEnvironmentVaultSaveError(caught instanceof Error ? caught.message : String(caught));
      }
      return false;
    }
  }, []);
  const updateEnvironmentVaultEntries = useCallback((entries: VaultEntry[]) => {
    const current = vaultSessionRef.current;
    if (!current.unlocked) {
      setEnvironmentVaultSaveError('Unlock the local vault before editing Secret variables.');
      return;
    }
    const next = { ...current, entries };
    vaultSessionRef.current = next;
    setVaultSession(next);
    setEnvironmentVaultSaveError('');
    environmentVaultSavePending.current = true;
    const generation = ++environmentVaultSaveGeneration.current;
    if (environmentVaultSaveTimer.current !== undefined) window.clearTimeout(environmentVaultSaveTimer.current);
    const workspaceId = activeWorkspaceId;
    environmentVaultSaveTimer.current = window.setTimeout(() => {
      environmentVaultSaveTimer.current = undefined;
      if (activeWorkspaceIdRef.current !== workspaceId) return;
      const session = vaultSessionRef.current;
      if (!session.unlocked) return;
      void persistEnvironmentVaultSession(workspaceId, session, generation);
    }, 300);
  }, [activeWorkspaceId, persistEnvironmentVaultSession]);
  const updateVaultSession = useCallback((session: VaultSession) => {
    const current = vaultSessionRef.current;
    if (current.unlocked && !session.unlocked && environmentVaultSavePending.current && activeWorkspaceId) {
      if (environmentVaultSaveTimer.current !== undefined) window.clearTimeout(environmentVaultSaveTimer.current);
      environmentVaultSaveTimer.current = undefined;
      void persistEnvironmentVaultSession(activeWorkspaceId, current, environmentVaultSaveGeneration.current).then((persisted) => {
        if (!persisted) return;
        vaultSessionRef.current = session;
        setVaultSession(session);
      });
      return;
    }
    vaultSessionRef.current = session;
    setVaultSession(session);
  }, [activeWorkspaceId, persistEnvironmentVaultSession]);
  const externalSecretResolver = useCallback((input: ExternalSecretInput) => resolveAuthorizedExternalSecret(workspace, input), [workspace]);
  templateResponseResolver.current = async ({ requestId, requestChain, cookies, responses }) => {
    if (!activeEnvironment) throw new Error('Select an environment before resending a dependent request.');
    const collection = workspace.collections.find((candidate) => candidate.requests.some((request) => request.id === requestId || request.name === requestId));
    const sourceRequest = collection?.requests.find((request) => request.id === requestId || request.name === requestId);
    if (!collection || !sourceRequest) throw new Error(`Could not find request ${requestId}`);
    const configured = applyCollectionConfiguration(collection, sourceRequest, activeEnvironment);
    const dependencyFileId = workspaceFileIdForCollection(workspace, collection.id);
    const callerRequestId = requestChain.at(-2);
    const callerFileId = callerRequestId ? workspaceFileIdForRequest(workspace, callerRequestId) : activeRequestFileId;
    const dependencyCookies = dependencyFileId === callerFileId ? cookies : [...getWorkspaceFileState(workspace, dependencyFileId).cookies];
    const result = await sendHttpRequest(configured.request, configured.environment, {
      certificates: getWorkspaceFileState(workspace, dependencyFileId).certificates,
      cookies: dependencyCookies,
      externalSecret: externalSecretResolver,
      filterResponsesByEnv: workspace.preferences.filterResponsesByEnv,
      followRedirects: workspace.preferences.followRedirects,
      maxRedirects: workspace.preferences.maxRedirects,
      maxTimelineDataSizeKB: workspace.preferences.maxTimelineDataSizeKB,
      preferredHttpVersion: workspace.preferences.preferredHttpVersion,
      prompt: requestTemplatePrompt,
      proxy: proxyPreferences,
      readFile: templateFileReader,
      requestAncestors: requestAncestorNames(workspace.collections, sourceRequest),
      requestChain: [...new Set([...requestChain, sourceRequest.id])],
      requestTimeoutMs: workspace.preferences.requestTimeoutMs,
      resolveResponse: templateResponseResolver.current,
      responses,
      validateAuthCertificates: workspace.preferences.validateAuthCertificates,
      validateCertificates: workspace.preferences.validateCertificates,
      vault: unlockedVault,
    });
    const receivedAt = new Date().toISOString();
    const storedResponse: StoredResponse = {
      ...result,
      id: uid('response'),
      requestId: sourceRequest.id,
      requestName: sourceRequest.name,
      requestUrl: result.requestUrl ?? configured.request.url,
      environmentId: configured.environment.id,
      globalEnvironmentId: activeEnvironment.id,
      collectionEnvironmentId: collection.activeSubEnvironmentId ?? '',
      receivedAt,
      requestSnapshot: createRequestSnapshot(sourceRequest),
      requestTestResults: [],
      settingSendCookies: configured.request.transport.sendCookies,
      settingStoreCookies: configured.request.transport.storeCookies,
    };
    if (configured.request.transport.storeCookies) {
      dependencyCookies.splice(0, dependencyCookies.length, ...storeResponseCookies(dependencyCookies, storedResponse.requestUrl, result.setCookies ?? []));
    }
    const updatedResponses = retainResponseHistory(responses, storedResponse, workspace.preferences.maxHistoryResponses, workspace.preferences.filterResponsesByEnv);
    responses.splice(0, responses.length, ...updatedResponses);
    setWorkspace((current) => {
      const updated = { ...current, responses: [...responses] };
      return configured.request.transport.storeCookies ? setWorkspaceFileCookies(updated, dependencyFileId, [...dependencyCookies]) : updated;
    });
    return storedResponse;
  };

  useEffect(() => {
    if (!hydrated || !active || activeStreaming) return;
    const latest = activeResponseHistory[0];
    setSelectedResponseId(latest?.id ?? '');
    setResponse(latest ?? mockResponse());
    setScriptTests(latest?.requestTestResults ?? []);
    setScriptLogs([]);
  }, [activeStreaming, hydrated, workspace.activeRequestId, workspace.activeEnvironmentId, workspace.preferences.filterResponsesByEnv]);

  useEffect(() => {
    const sessionId = streamSession.current;
    const protocol = streamProtocol.current;
    if (sessionId && protocol) {
      void disconnectStream(protocol, sessionId).catch(() => undefined);
    }
    streamSession.current = undefined;
    streamProtocol.current = undefined;
    setStreamStatus('disconnected');
    const latest = visibleStreamSessions(
      workspace.streamSessions,
      active?.request.id ?? '',
      activeEnvironment?.id ?? '',
      workspace.preferences.filterResponsesByEnv,
    )[0];
    selectedStreamSessionIdRef.current = latest?.id ?? '';
    setSelectedStreamSessionId(selectedStreamSessionIdRef.current);
    setStreamMessages(latest?.messages ?? []);
    setStreamSessionView(latest);
    setStreamDraft('');
    setScriptTests([]);
    setScriptLogs([]);
  }, [activeStreaming, activeWorkspaceId, workspace.activeRequestId, workspace.activeEnvironmentId, workspace.preferences.filterResponsesByEnv, active?.request.protocol]);

  const applyRequestDocumentState = (state: RequestTabState) => {
    if (!activeWorkspaceId) return;
    setRequestDocumentState({ workspaceId: activeWorkspaceId, state });
    if (state.tabs.find((tab) => tab.requestId === state.activeRequestId)?.type === 'request' && state.activeRequestId !== workspace.activeRequestId) {
      setWorkspace((current) => ({ ...current, activeRequestId: state.activeRequestId }));
    }
  };

  const updateRunnerDraft = useCallback((key: string, draft: RunnerWorkbenchDraft) => {
    setRunnerDrafts((current) => ({ ...current, [key]: draft }));
  }, []);

  const discardRunnerDrafts = (documentIds: string[]) => {
    if (!activeWorkspaceId || !documentIds.length) return;
    setRunnerDrafts((current) => discardRunnerDraftEntries(current, activeWorkspaceId, documentIds));
  };

  const openWorkspaceDocument = (documentId: string, type: DocumentTabType, permanent = false) => {
    applyRequestDocumentState(openDocumentTab(activeRequestDocumentState, documentId, type, permanent));
    setWorkbenchSection('requests');
  };

  const openRequestDocument = (requestId: string, permanent = false) => {
    openWorkspaceDocument(requestId, 'request', permanent);
  };

  const openFolderDocument = (folderId: string, permanent = false) => {
    openWorkspaceDocument(folderId, 'folder', permanent);
  };

  const openRunnerDocument = (folderId = '') => {
    openWorkspaceDocument(runnerDocumentId(activeWorkspaceId, folderId), 'runner');
  };

  const openEnvironmentDocument = () => {
    openWorkspaceDocument(environmentDocumentId(activeWorkspaceId), 'environment');
  };

  const openDesignDocument = (designId = workspace.apiDesigns[0]?.id) => {
    if (designId) {
      openWorkspaceDocument(designId, 'document');
      return;
    }
    const id = uid('design');
    setWorkspace((current) => ({ ...current, apiDesigns: [...current.apiDesigns, { id, name: 'Untitled API', contents: 'openapi: 3.1.0\ninfo:\n  title: Untitled API\n  version: 1.0.0\npaths: {}\n', ruleset: '' }], fileState: { ...current.fileState, [id]: emptyWorkspaceFileState() } }));
    openWorkspaceDocument(id, 'document');
  };

  const openMockDocument = (serverId = workspace.mockServers[0]?.id, routeId?: string) => {
    if (serverId) {
      openWorkspaceDocument(routeId ?? serverId, routeId ? 'mockRoute' : 'mockServer');
      return;
    }
    const id = uid('mock');
    setWorkspace((current) => ({ ...current, mockServers: [...current.mockServers, { id, name: 'Local mock', host: '127.0.0.1', port: 4010, routes: [] }], fileState: { ...current.fileState, [id]: emptyWorkspaceFileState() } }));
    openWorkspaceDocument(id, 'mockServer');
  };

  const openCollectionDocument = (collectionId: string) => {
    openWorkspaceDocument(collectionId, 'collection');
  };

  const openTestSuiteDocument = (suiteId = [...workspace.testSuites].sort((left, right) => left.sortKey - right.sortKey)[0]?.id, permanent = false) => {
    if (suiteId) {
      openWorkspaceDocument(suiteId, 'testSuite', permanent);
      return;
    }
    const ownerCollectionId = active?.collectionId ?? workspace.collections[0]?.id ?? '';
    const created = createUnitTestSuite(uid('test-suite'), workspace.testSuites, ownerCollectionId);
    setWorkspace((current) => ({ ...current, testSuites: [...current.testSuites, created] }));
    openWorkspaceDocument(created.id, 'testSuite', permanent);
  };

  const promoteRequestDocument = (requestId: string) => {
    applyRequestDocumentState(promoteRequestTab(activeRequestDocumentState, requestId));
  };

  const closeRequestDocument = (requestId: string) => {
    discardRunnerDrafts([requestId]);
    applyRequestDocumentState(closeRequestTab(activeRequestDocumentState, requestId));
  };

  const closeAllRequestDocuments = () => {
    discardRunnerDrafts(activeRequestDocumentState.tabs.filter((tab) => tab.type === 'runner').map((tab) => tab.requestId));
    applyRequestDocumentState(closeAllRequestTabs(activeRequestDocumentState));
  };

  const closeOtherRequestDocuments = (requestId: string) => {
    discardRunnerDrafts(activeRequestDocumentState.tabs.filter((tab) => tab.type === 'runner' && tab.requestId !== requestId).map((tab) => tab.requestId));
    applyRequestDocumentState(closeOtherRequestTabs(activeRequestDocumentState, requestId));
  };

  const deleteTestSuite = (suiteId: string) => {
    closeRequestDocument(suiteId);
    setWorkspace((current) => ({
      ...current,
      testSuites: current.testSuites.filter((suite) => suite.id !== suiteId),
      unitTestResults: current.unitTestResults.filter((result) => result.suiteId !== suiteId),
    }));
  };

  const reopenRequestDocument = () => {
    applyRequestDocumentState(reopenClosedDocumentTab(activeRequestDocumentState, validDocumentReferences));
  };

  const cycleRequestDocument = (direction: 'next' | 'previous') => {
    applyRequestDocumentState(cycleRequestTab(activeRequestDocumentState, direction));
  };

  const reorderRequestDocument = (requestId: string, targetRequestId: string, placement: RequestTabPlacement) => {
    applyRequestDocumentState(moveRequestTab(activeRequestDocumentState, requestId, targetRequestId, placement));
  };

  const renameWorkspaceDocument = (documentId: string, type: DocumentTabType, name: string) => {
    if (type !== 'request' && type !== 'folder' && type !== 'testSuite') return;
    promoteRequestDocument(documentId);
    if (type === 'testSuite') {
      setWorkspace((current) => ({ ...current, testSuites: current.testSuites.map((suite) => suite.id === documentId ? { ...suite, name } : suite) }));
      return;
    }
    setWorkspace((current) => ({
      ...current,
      collections: current.collections.map((collection) => type === 'request'
        ? { ...collection, requests: collection.requests.map((request) => request.id === documentId ? { ...request, name } : request) }
        : { ...collection, folders: (collection.folders ?? []).map((folder) => folder.id === documentId ? { ...folder, name } : folder) }),
    }));
  };

  const updateActiveRequest = (patch: Partial<ApiRequest>) => {
    promoteRequestDocument(workspace.activeRequestId);
    setWorkspace((current) => ({
      ...current,
      collections: current.collections.map((collection) => ({
        ...collection,
        requests: collection.requests.map((request) => request.id === current.activeRequestId ? { ...request, ...patch } : request),
      })),
    }));
  };

  const toggleRequestPin = (requestId: string) => {
    if (!activeWorkspaceId) return;
    setRequestPinState((current) => ({
      workspaceId: activeWorkspaceId,
      ids: togglePinnedRequestId(workspace, current.workspaceId === activeWorkspaceId ? current.ids : [], requestId),
    }));
  };

  const addRequest = useCallback(() => {
    const id = uid('request');
    const request = createBlankRequest(id);
    setWorkspace((current) => {
      if (current.collections.length === 0) {
        const collectionId = uid('collection');
        return { ...current, activeRequestId: id, collections: [{ id: collectionId, name: 'Requests', expanded: true, requests: [request], folders: [], resourceOrder: [id], environment: [], environmentEditorMode: 'table', subEnvironments: [], activeSubEnvironmentId: '', documentation: '' }], fileState: { ...current.fileState, [collectionId]: emptyWorkspaceFileState() } };
      }
      const targetIndex = Math.max(0, current.collections.findIndex((collection) => collection.requests.some((candidate) => candidate.id === current.activeRequestId)));
      return {
        ...current,
        activeRequestId: id,
        collections: current.collections.map((collection, index) => {
          if (index !== targetIndex) return collection;
          const sibling = collection.requests.find((candidate) => candidate.id === current.activeRequestId);
          const nextRequest = sibling?.folderId ? { ...request, folderId: sibling.folderId } : request;
          const order = [...(collection.resourceOrder ?? [...(collection.folders ?? []).map((folder) => folder.id), ...collection.requests.map((candidate) => candidate.id)])];
          const siblingIndex = sibling ? order.indexOf(sibling.id) : -1;
          order.splice(siblingIndex < 0 ? order.length : siblingIndex + 1, 0, id);
          return { ...collection, expanded: true, requests: [...collection.requests, nextRequest], resourceOrder: order };
        }),
      };
    });
    applyRequestDocumentState(openRequestTab(activeRequestDocumentState, id));
    setWorkbenchSection('requests');
    setRequestTab('params');
  }, [activeRequestDocumentState, activeWorkspaceId]);

  const addCollection = () => {
    const id = uid('collection');
    setWorkspace((current) => ({
      ...current,
      collections: [...current.collections, { id, name: `Collection ${current.collections.length + 1}`, expanded: true, requests: [], folders: [], resourceOrder: [], environment: [], environmentEditorMode: 'table', subEnvironments: [], activeSubEnvironmentId: '', documentation: '' }],
      fileState: { ...current.fileState, [id]: emptyWorkspaceFileState() },
    }));
    openCollectionDocument(id);
  };

  const addFolder = (collectionId: string, parentId: string) => {
    const folderId = uid('folder');
    setWorkspace((current) => ({ ...current, collections: current.collections.map((collection) => collection.id === collectionId ? { ...collection, expanded: true, folders: [...(collection.folders ?? []), { id: folderId, name: 'Untitled Folder', parentId, expanded: true, headers: [], environment: [], environmentEditorMode: 'table', preRequestScript: '', tests: '', documentation: '' }], resourceOrder: [...(collection.resourceOrder ?? [...(collection.folders ?? []).map((folder) => folder.id), ...collection.requests.map((request) => request.id)]), folderId] } : collection) }));
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

  const duplicateFolder = (collectionId: string, folderId: string) => {
    const folder = workspace.collections.find((collection) => collection.id === collectionId)?.folders?.find((candidate) => candidate.id === folderId);
    if (!folder) return;
    const name = window.prompt('Duplicate folder as', `${folder.name} copy`)?.trim();
    if (!name) return;
    setWorkspace((current) => duplicateWorkspaceFolder(current, collectionId, folderId, name, uid));
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
        if (!collections.length) collections = [{ id: uid('collection'), name: 'Requests', expanded: true, requests: [request], resourceOrder: [request.id] }];
        else collections = collections.map((collection, index) => index === 0 ? { ...collection, requests: [request], resourceOrder: [...(collection.resourceOrder ?? (collection.folders ?? []).map((folder) => folder.id)), request.id] } : collection);
        nextActive = request.id;
      }
      return { ...current, activeRequestId: nextActive, collections, testSuites: clearDeletedUnitTestRequest(current, active.request.id) };
    });
  };

  const loadActiveGrpcSchema = async (): Promise<GrpcSchema | undefined> => {
    if (!active || !activeEnvironment || active.request.protocol !== 'grpc' || grpcSchemaLoading) return grpcSchemas[active?.request.id ?? ''];
    const collection = workspace.collections.find((candidate) => candidate.id === active.collectionId);
    if (!collection) return undefined;
    const configured = applyCollectionConfiguration(collection, active.request, activeEnvironment);
    const targetRequest = configured.request;
    setGrpcSchemaLoading(true);
    try {
      const { loadGrpcSchema } = await import('./lib/grpc');
      const schema = await loadGrpcSchema(targetRequest, configured.environment, workspace.preferences.requestTimeoutMs, workspace.preferences.validateCertificates, activeRequestFileState.certificates, {
        cookies: [...activeRequestFileState.cookies],
        responses: [...workspace.responses],
        filterResponsesByEnv: workspace.preferences.filterResponsesByEnv,
        vault: unlockedVault,
        externalSecret: externalSecretResolver,
        readFile: templateFileReader,
        prompt: requestTemplatePrompt,
        requestAncestors: requestAncestorNames(workspace.collections, targetRequest),
        resolveResponse: templateResponseResolver.current,
        pluginRuntime: createPersistentTemplatePluginRuntime(configured.environment),
      });
      const service = schema.services.find((candidate) => candidate.fullName === targetRequest.grpc.service) ?? schema.services[0];
      const method = service?.methods.find((candidate) => candidate.name === targetRequest.grpc.method) ?? service?.methods[0];
      setGrpcSchemas((current) => ({ ...current, [targetRequest.id]: schema }));
      setWorkspace((current) => ({ ...current, collections: current.collections.map((collection) => ({ ...collection, requests: collection.requests.map((request) => request.id === targetRequest.id ? { ...request, grpc: { ...request.grpc, descriptorSetBase64: schema.descriptorSetBase64, service: service?.fullName ?? '', method: method?.name ?? '' } } : request) })) }));
      return schema;
    } catch (error) {
      const { formatGrpcError, grpcConnectionErrorDetails } = await import('./lib/grpc');
      const guidance = grpcConnectionErrorDetails(error, 'reflection');
      const message = formatGrpcError(error, 'reflection');
      if (activeRequestIdRef.current === targetRequest.id) {
        setResponse({ status: 0, statusText: guidance?.title ?? 'Schema failed', headers: {}, body: message, durationMs: 0, sizeBytes: message.length });
        setResponseTab('preview');
      }
      return undefined;
    } finally {
      setGrpcSchemaLoading(false);
    }
  };

  const loadActiveGraphqlSchema = async (includeInputValueDeprecation = active?.request.graphql.includeInputValueDeprecation ?? false) => {
    if (!active || !activeEnvironment || active.request.protocol !== 'graphql' || graphqlSchemaLoading) return;
    const collection = workspace.collections.find((candidate) => candidate.id === active.collectionId);
    if (!collection) return;
    const targetRequest = applyCollectionConfiguration(collection, active.request, activeEnvironment).request;
    setGraphqlSchemaError(undefined);
    setGraphqlSchemaLoading(true);
    try {
      const schema = await fetchGraphqlSchema(targetRequest, activeEnvironment, { cookies: [...activeRequestFileState.cookies], responses: [...workspace.responses], preferredHttpVersion: workspace.preferences.preferredHttpVersion, maxRedirects: workspace.preferences.maxRedirects, followRedirects: workspace.preferences.followRedirects, requestTimeoutMs: workspace.preferences.requestTimeoutMs, validateCertificates: workspace.preferences.validateCertificates, validateAuthCertificates: workspace.preferences.validateAuthCertificates, proxy: proxyPreferences, certificates: activeRequestFileState.certificates, maxTimelineDataSizeKB: workspace.preferences.maxTimelineDataSizeKB, filterResponsesByEnv: workspace.preferences.filterResponsesByEnv, vault: unlockedVault, externalSecret: externalSecretResolver, readFile: templateFileReader, prompt: requestTemplatePrompt, requestAncestors: requestAncestorNames(workspace.collections, targetRequest), resolveResponse: templateResponseResolver.current, pluginRuntime: createPersistentTemplatePluginRuntime(activeEnvironment) }, includeInputValueDeprecation);
      setWorkspace((current) => ({ ...current, collections: current.collections.map((collection) => ({ ...collection, requests: collection.requests.map((request) => request.id === targetRequest.id ? { ...request, graphql: { ...request.graphql, schema, schemaEndpoint: targetRequest.url, schemaFetchedAt: new Date().toISOString(), schemaSource: 'remote', schemaFileName: '', includeInputValueDeprecation, schemaIncludesInputValueDeprecation: includeInputValueDeprecation } } : request) })) }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setGraphqlSchemaError({ requestId: targetRequest.id, message });
    } finally {
      setGraphqlSchemaLoading(false);
    }
  };

  useEffect(() => {
    if (!hydrated || !workspace.preferences.autoFetchGraphqlSchema || active?.request.protocol !== 'graphql' || !activeEnvironment || graphqlSchemaLoading) return;
    if (!active.request.url.trim() || active.request.graphql.schemaSource === 'local') return;
    if (active.request.graphql.schemaEndpoint === active.request.url && active.request.graphql.schemaIncludesInputValueDeprecation === active.request.graphql.includeInputValueDeprecation) return;
    const timeout = window.setTimeout(() => void loadActiveGraphqlSchema(), 800);
    return () => window.clearTimeout(timeout);
  }, [active?.request.id, active?.request.protocol, active?.request.url, active?.request.graphql.schemaEndpoint, active?.request.graphql.schemaSource, active?.request.graphql.includeInputValueDeprecation, active?.request.graphql.schemaIncludesInputValueDeprecation, activeEnvironment?.id, graphqlSchemaLoading, hydrated, workspace.preferences.autoFetchGraphqlSchema]);

  const onStreamEvent = (message: StreamMessage) => {
    const sessionId = message.sessionId ?? streamSession.current;
    const normalized = { ...message, id: message.id || uid('event'), ...(sessionId ? { sessionId } : {}) };
    void import('./lib/streamHistory').then(({ appendStreamSessionMessage, appendVisibleStreamMessage }) => {
      if (!sessionId || selectedStreamSessionIdRef.current === sessionId) {
        setStreamMessages((current) => appendVisibleStreamMessage(current, normalized));
      }
      if (sessionId) {
        setStreamSessionView((current) => current?.id === sessionId ? appendStreamSessionMessage([current], sessionId, normalized)[0] : current);
        setWorkspace((current) => {
          const streamSessions = appendStreamSessionMessage(current.streamSessions, sessionId, normalized);
          return streamSessions === current.streamSessions ? current : { ...current, streamSessions };
        });
      }
    });
    if (sessionId && streamSession.current === sessionId) {
      if (normalized.kind === 'open') setStreamStatus('connected');
      if (normalized.kind === 'reconnecting') setStreamStatus('reconnecting');
      if (normalized.kind === 'closed' || normalized.kind === 'close' || normalized.kind === 'error') setStreamStatus('disconnected');
    }
  };

  const oauthRequestContext = (request?: ApiRequest): SendRequestContext => {
    const fileState = getWorkspaceFileState(workspace, request ? workspaceFileIdForRequest(workspace, request.id) || activeWorkspaceFileId : activeWorkspaceFileId);
    return {
      cookies: [...fileState.cookies],
      responses: [...workspace.responses],
      preferredHttpVersion: workspace.preferences.preferredHttpVersion,
      maxRedirects: workspace.preferences.maxRedirects,
      followRedirects: workspace.preferences.followRedirects,
      requestTimeoutMs: workspace.preferences.requestTimeoutMs,
      validateCertificates: workspace.preferences.validateCertificates,
      validateAuthCertificates: workspace.preferences.validateAuthCertificates,
      proxy: proxyPreferences,
      certificates: fileState.certificates,
      maxTimelineDataSizeKB: workspace.preferences.maxTimelineDataSizeKB,
      filterResponsesByEnv: workspace.preferences.filterResponsesByEnv,
      vault: unlockedVault,
      externalSecret: externalSecretResolver,
      readFile: templateFileReader,
      prompt: requestTemplatePrompt,
      resolveResponse: templateResponseResolver.current,
    };
  };

  const realtimeRequestContext = (request: ApiRequest, pluginRuntime?: SendRequestContext['pluginRuntime']): SendRequestContext => ({
    ...oauthRequestContext(request),
    pluginRuntime,
    requestAncestors: requestAncestorNames(workspace.collections, request),
  });

  const persistOAuth2Auth = (
    collectionId: string,
    requestId: string,
    auth: ApiRequest['auth'],
  ) => {
    setWorkspace((current) => ({
      ...current,
      collections: current.collections.map((collection) => collection.id === collectionId
        ? persistEffectiveAuthentication(collection, requestId, auth)
        : collection),
    }));
  };

  const authorizeOAuth2WithStatus = async (request: ApiRequest, environment: Environment | undefined): Promise<ApiRequest['auth']> => {
    if (!environment) throw new Error('OAuth 2 browser authorization requires an active environment.');
    if (!isTauri()) throw new Error('OAuth 2 browser authorization requires the Tauri app. Use the Auth tab to copy the authorization URL in browser development.');
    const oauth2 = await import('./lib/oauth2');
    const flowId = oauth2.createOAuth2FlowId();
    oauthFlowId.current = flowId;
    const prepared = await oauth2.prepareOAuth2Authorization(request, environmentMap(environment), flowId);
    setOAuthAuthorization({ browserMode: prepared.browserMode, flowId, requestName: request.name, authorizationUrl: prepared.authorizationUrl, redirectUrl: prepared.redirectUrl });
    try {
      const completed = await oauth2.completeOAuth2Authorization(prepared, environment, oauthRequestContext(request), (event) => {
        if (oauthFlowId.current === flowId) setOAuthAuthorization({ browserMode: event.browserMode, flowId, requestName: request.name, authorizationUrl: event.authorizationUrl, redirectUrl: event.redirectUrl });
      });
      return completed.auth;
    } finally {
      if (oauthFlowId.current === flowId) {
        oauthFlowId.current = '';
        setOAuthAuthorization(undefined);
      }
    }
  };

  const ensureOAuth2Authorization = async (
    request: ApiRequest,
    environment: Environment,
    collectionId: string,
  ): Promise<ApiRequest> => {
    if (request.auth.type !== 'oauth2' || request.auth.disabled) return request;
    const oauth2 = await import('./lib/oauth2');
    let auth = await oauth2.acquireOAuth2TokenWithoutBrowser(request, environment, oauthRequestContext(request));
    auth ??= await authorizeOAuth2WithStatus(request, environment);
    if (auth !== request.auth) persistOAuth2Auth(collectionId, request.id, auth);
    return { ...request, auth };
  };

  const pluginHostCapabilities = (environment: Environment): Partial<PluginHostCallbacks> => ({
    dialog: async (title, message) => { window.alert(`${title}${message ? `\n\n${message}` : ''}`); },
    clearClipboard: async () => navigator.clipboard.writeText(''),
    getPath: async (name) => {
      if (name.toLowerCase() !== 'desktop') throw new Error(`Unknown plugin path '${name}'.`);
      if (!isTauri()) throw new Error('Plugin desktop paths are available only in the Tauri app.');
      return invoke<string>('plugin_desktop_path');
    },
    showSaveDialog: async (defaultPath) => isTauri() ? window.prompt('Choose a save path', defaultPath) : null,
    importData: async (source, value) => {
      const contents = source === 'uri' ? await fetchImportUrl(value) : value;
      const [{ importArtifact }, { applyArtifactImport }] = await Promise.all([import('./lib/interchange'), import('./lib/interchange/apply')]);
      const result = importArtifact(contents, source === 'uri' ? value : 'Plugin import');
      setWorkspace((current) => applyArtifactImport(current, result));
    },
    exportData: async (format, options) => {
      const { exportArtifact } = await import('./lib/interchange/exporters');
      const target = options.workspace as { id?: string } | undefined;
      const collection = target?.id ? workspace.collections.find((candidate) => candidate.id === target.id) : undefined;
      const design = target?.id ? workspace.apiDesigns.find((candidate) => candidate.id === target.id) : undefined;
      const scope = collection ? 'collection' : design ? 'design' : 'all';
      return exportArtifact(workspace, { format: format === 'har' ? 'har' : options.format === 'json' ? 'insomnia-v4' : 'insomnia-v5', scope, collectionId: collection?.id, designId: design?.id, includePrivateEnvironments: options.includePrivate === true }).contents;
    },
    environment: environmentMap(environment),
  });

  const createRealtimePluginContext = (environment: Environment) => {
    const state: PluginRunState = { data: structuredClone(workspace.pluginData), notifications: [] };
    const callbacks: PluginHostCallbacks = {
      network: (pluginRequest) => sendRequest(pluginRequest, environment, { ...oauthRequestContext(), authorizeOAuth2: authorizeOAuth2WithStatus }),
      prompt: async (title, defaultValue) => window.prompt(title, defaultValue) ?? '',
      readClipboard: () => navigator.clipboard.readText(),
      writeClipboard: (value) => navigator.clipboard.writeText(value),
      ...pluginHostCapabilities(environment),
    };
    const runtime = createPluginRuntime(workspace.plugins, state, callbacks);
    const flush = () => {
      state.notifications.forEach((notification) => onStreamEvent({ id: uid('event'), direction: 'system', kind: 'plugin', text: `${notification.title}: ${notification.message}`, timestamp: new Date().toISOString() }));
      setWorkspace((current) => ({ ...current, pluginData: state.data }));
    };
    return { runtime, flush };
  };

  const createPersistentTemplatePluginRuntime = (environment: Environment): NonNullable<SendRequestContext['pluginRuntime']> => {
    const state: PluginRunState = { data: structuredClone(workspace.pluginData), notifications: [] };
    const callbacks: PluginHostCallbacks = {
      network: (pluginRequest) => sendRequest(pluginRequest, environment, { ...oauthRequestContext(), authorizeOAuth2: authorizeOAuth2WithStatus }),
      prompt: async (title, defaultValue) => window.prompt(title, defaultValue) ?? '',
      readClipboard: () => navigator.clipboard.readText(),
      writeClipboard: (value) => navigator.clipboard.writeText(value),
      ...pluginHostCapabilities(environment),
    };
    const runtime = createPluginRuntime(workspace.plugins, state, callbacks);
    let notificationIndex = 0;
    return {
      beforeRequest: async (request) => request,
      afterResponse: async (_request, response) => response,
      templateTag: async (name, args, request) => {
        try {
          return await runtime.templateTag(name, args, request);
        } finally {
          const nextNotifications = state.notifications.slice(notificationIndex);
          notificationIndex = state.notifications.length;
          if (nextNotifications.length) setScriptLogs((current) => [...current, ...nextNotifications.map((notification) => `[plugin] ${notification.title}: ${notification.message}`)]);
          setWorkspace((current) => ({ ...current, pluginData: state.data }));
        }
      },
    };
  };

  const cancelActiveOAuthAuthorization = async () => {
    const flowId = oauthFlowId.current;
    if (!flowId) return;
    oauthFlowId.current = '';
    setOAuthAuthorization(undefined);
    try {
      const { cancelOAuth2Authorization } = await import('./lib/oauth2');
      await cancelOAuth2Authorization(flowId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setResponse({ status: 0, statusText: 'OAuth cancel failed', headers: {}, body: message, durationMs: 0, sizeBytes: message.length });
    }
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
    promoteRequestDocument(active.request.id);
    const collection = workspace.collections.find((candidate) => candidate.id === active.collectionId);
    if (!collection) return;
    const configured = applyCollectionConfiguration(collection, active.request, activeEnvironment);
    let request = configured.request;
    const executionEnvironment = configured.environment;
    if (isStreamingRequest(request)) {
      if (streamStatus === 'connected' || streamStatus === 'reconnecting') {
        const sessionId = streamSession.current;
        if (!sessionId) return;
        setIsSending(true);
        try {
          await disconnectStream(request.protocol, sessionId);
          onStreamEvent({ id: uid('event'), sessionId, direction: 'system', kind: 'closed', text: 'Disconnected by client', timestamp: new Date().toISOString() });
          setStreamStatus('disconnected');
          streamSession.current = undefined;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          onStreamEvent({ id: uid('event'), sessionId, direction: 'system', kind: 'error', text: message, timestamp: new Date().toISOString() });
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
      selectedStreamSessionIdRef.current = sessionId;
      setSelectedStreamSessionId(sessionId);
      const { applyStreamConnectionMetadata, createStreamSession, retainStreamSessionHistory } = await import('./lib/streamHistory');
      const createdSession = createStreamSession(active.request, activeEnvironment.id, sessionId);
      setStreamSessionView(createdSession);
      setWorkspace((current) => ({
        ...current,
        streamSessions: retainStreamSessionHistory(
          current.streamSessions,
          createdSession,
          current.preferences.maxHistoryResponses,
          current.preferences.filterResponsesByEnv,
        ),
      }));
      const realtimePlugins = createRealtimePluginContext(executionEnvironment);
      try {
        const metadata = await connectStream(request, executionEnvironment, sessionId, onStreamEvent, workspace.preferences.preferredHttpVersion, workspace.preferences.maxRedirects, workspace.preferences.followRedirects, workspace.preferences.requestTimeoutMs, workspace.preferences.validateCertificates, proxyPreferences, activeRequestFileState.cookies, activeRequestFileState.certificates, realtimeRequestContext(request, realtimePlugins.runtime));
        setStreamSessionView((current) => current?.id === sessionId ? applyStreamConnectionMetadata([current], sessionId, metadata)[0] : current);
        setWorkspace((current) => ({ ...current, streamSessions: applyStreamConnectionMetadata(current.streamSessions, sessionId, metadata) }));
        if (streamSession.current !== sessionId) {
          await disconnectStream(request.protocol, sessionId).catch(() => undefined);
          return;
        }
        setStreamStatus('connected');
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        onStreamEvent({ id: uid('event'), sessionId, direction: 'system', kind: 'error', text: message, timestamp: new Date().toISOString() });
      } finally {
        realtimePlugins.flush();
        setIsSending(false);
      }
      return;
    }

    setIsSending(true);
    setResponseTab('preview');
    setScriptTests([]);
    setScriptLogs([]);
    let scriptCookies = [...activeRequestFileState.cookies];
    let scriptResponses = [...workspace.responses];
    const pluginState: PluginRunState = { data: structuredClone(workspace.pluginData), notifications: [] };
    const pluginCallbacks: PluginHostCallbacks = {
      network: (pluginRequest) => sendRequest(pluginRequest, executionEnvironment, { cookies: scriptCookies, responses: scriptResponses, preferredHttpVersion: workspace.preferences.preferredHttpVersion, maxRedirects: workspace.preferences.maxRedirects, followRedirects: workspace.preferences.followRedirects, requestTimeoutMs: workspace.preferences.requestTimeoutMs, validateCertificates: workspace.preferences.validateCertificates, validateAuthCertificates: workspace.preferences.validateAuthCertificates, proxy: proxyPreferences, maxTimelineDataSizeKB: workspace.preferences.maxTimelineDataSizeKB, filterResponsesByEnv: workspace.preferences.filterResponsesByEnv, authorizeOAuth2: authorizeOAuth2WithStatus }),
      prompt: async (title, defaultValue) => window.prompt(title, defaultValue) ?? '',
      readClipboard: () => navigator.clipboard.readText(),
      writeClipboard: (value) => navigator.clipboard.writeText(value),
      ...pluginHostCapabilities(executionEnvironment),
    };
    const pluginRuntime = createPluginRuntime(workspace.plugins, pluginState, pluginCallbacks);
    try {
      request = await ensureOAuth2Authorization(request, executionEnvironment, collection.id);
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
        executionLocation: [workspace.name, collection.name, ...configured.folders.map((folder) => folder.name), request.name],
      };
      const runScript = (
        source: string,
        scriptRequest: ApiRequest,
        scriptResponse?: HttpResponse,
        localVariables: Record<string, string> = {},
        previous?: ScriptRunResult,
        testCategory: ScriptTestCategory = 'unknown',
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
        execution: previous?.execution,
        testCategory,
        readFile: workspace.preferences.allowScriptFileAccess && isTauri()
          ? async (path) => {
            const { readDesktopScriptFile } = await import('./lib/scriptFiles');
            return readDesktopScriptFile(path, workspace.preferences.dataFolders);
          }
          : undefined,
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
            requestTimeoutMs: workspace.preferences.requestTimeoutMs,
            validateCertificates: workspace.preferences.validateCertificates,
            validateAuthCertificates: workspace.preferences.validateAuthCertificates,
            proxy: proxyPreferences,
            maxTimelineDataSizeKB: workspace.preferences.maxTimelineDataSizeKB,
            filterResponsesByEnv: workspace.preferences.filterResponsesByEnv,
            vault: workspace.preferences.enableVaultInScripts ? unlockedVault : {},
            authorizeOAuth2: authorizeOAuth2WithStatus,
          });
          const state = applyScriptSubresponse(scriptCookies, scriptResponses, subrequest, subresponse, undefined, executionEnvironment.id, workspace.preferences.maxHistoryResponses, workspace.preferences.filterResponsesByEnv, activeEnvironment.id, collection.activeSubEnvironmentId ?? '');
          scriptCookies = state.cookies;
          scriptResponses = state.responses;
          return subresponse;
        } : undefined,
      });
      const preRequest = await runScript(request.preRequestScript, request, undefined, {}, undefined, 'pre-request');
      let executableRequest = preRequest.request;
      const requestVariables = mergedScriptVariables(preRequest, initialScriptScopes);
      setScriptLogs(preRequest.logs);
      persistScriptState(collection.id, preRequest);
      if (preRequest.execution?.skipRequest) {
        const message = 'Request skipped by pre-request script.';
        setScriptTests(preRequest.tests);
        setResponse({ status: 0, statusText: 'Request skipped', headers: {}, body: message, durationMs: 0, sizeBytes: message.length });
        setWorkspace((current) => setWorkspaceFileCookies({ ...current, responses: scriptResponses, pluginData: pluginState.data }, activeRequestFileId, scriptCookies));
        return;
      }
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
        const { invokeGrpc } = await import('./lib/grpc');
        const output = await invokeGrpc(callRequest, {
          ...executionEnvironment,
          variables: Object.entries({ ...requestVariables, ...unlockedVault }).map(([name, value]) => ({ id: `script-${name}`, name, value, enabled: true })),
        }, workspace.preferences.requestTimeoutMs, workspace.preferences.validateCertificates, activeRequestFileState.certificates, {
          cookies: scriptCookies,
          responses: scriptResponses,
          filterResponsesByEnv: workspace.preferences.filterResponsesByEnv,
          vault: unlockedVault,
          externalSecret: externalSecretResolver,
          readFile: templateFileReader,
          prompt: requestTemplatePrompt,
          requestAncestors: requestAncestorNames(workspace.collections, executableRequest),
          resolveResponse: templateResponseResolver.current,
          pluginRuntime,
        });
        const body = JSON.stringify({ status: output.status, callType: output.callType, messages: output.messages }, null, 2);
        result = await pluginRuntime.afterResponse(executableRequest, { status: 200, statusText: `gRPC ${output.status}`, headers: { 'grpc-call-type': output.callType }, body, durationMs: output.durationMs, sizeBytes: new Blob([body]).size });
      } else {
        result = await sendRequest(executableRequest, {
          ...executionEnvironment,
          variables: Object.entries(requestVariables).map(([name, value]) => ({ id: `script-${name}`, name, value, enabled: true })),
        }, { cookies: scriptCookies, responses: scriptResponses, preferredHttpVersion: workspace.preferences.preferredHttpVersion, maxRedirects: workspace.preferences.maxRedirects, followRedirects: workspace.preferences.followRedirects, requestTimeoutMs: workspace.preferences.requestTimeoutMs, validateCertificates: workspace.preferences.validateCertificates, validateAuthCertificates: workspace.preferences.validateAuthCertificates, proxy: proxyPreferences, maxTimelineDataSizeKB: workspace.preferences.maxTimelineDataSizeKB, filterResponsesByEnv: workspace.preferences.filterResponsesByEnv, pluginRuntime, vault: unlockedVault, externalSecret: externalSecretResolver, readFile: templateFileReader, onOAuth2Token: (updated) => persistOAuth2Auth(collection.id, request.id, updated.auth), authorizeOAuth2: authorizeOAuth2WithStatus });
      }
      const afterResponse = await runScript(executableRequest.tests, executableRequest, result, preRequest.localVariables, preRequest, 'after-response');
      const requestTestResults = [...preRequest.tests, ...afterResponse.tests];
      setScriptTests(requestTestResults);
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
        globalEnvironmentId: activeEnvironment.id,
        collectionEnvironmentId: collection.activeSubEnvironmentId ?? '',
        receivedAt,
        requestSnapshot: createRequestSnapshot(active.request),
        requestTestResults: requestTestResults.slice(0, 1_000).map((test) => ({ ...test, name: test.name.slice(0, 2_000), ...(test.error ? { error: test.error.slice(0, 20_000) } : {}) })),
        settingSendCookies: executableRequest.transport.sendCookies,
        settingStoreCookies: executableRequest.transport.storeCookies,
      };
      setSelectedResponseId(workspace.preferences.maxHistoryResponses === 0 ? '' : storedResponse.id);
      setWorkspace((current) => setWorkspaceFileCookies({
        ...current,
        history: [historyEntry, ...current.history].slice(0, 100),
        responses: retainResponseHistory(scriptResponses, storedResponse, current.preferences.maxHistoryResponses, current.preferences.filterResponsesByEnv),
        pluginData: pluginState.data,
      }, activeRequestFileId, executableRequest.transport.storeCookies
        ? storeResponseCookies(scriptCookies, storedResponse.requestUrl, result.setCookies ?? [])
        : scriptCookies));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const failedResponse: HttpResponse = error instanceof HttpTransportError
        ? { status: 0, statusText: 'Request failed', headers: {}, body: message, durationMs: error.durationMs, sizeBytes: new TextEncoder().encode(message).byteLength, requestUrl: error.requestUrl, timeline: error.timeline }
        : { status: 0, statusText: 'Request failed', headers: {}, body: message, durationMs: 0, sizeBytes: new TextEncoder().encode(message).byteLength };
      setResponse(failedResponse);
      setScriptLogs((current) => [...current, ...pluginState.notifications.map((notification) => `[plugin] ${notification.title}: ${notification.message}`)]);
      if (error instanceof HttpTransportError) {
        const receivedAt = new Date().toISOString();
        const storedResponse: StoredResponse = {
          ...failedResponse,
          id: uid('response'),
          requestId: active.request.id,
          requestName: active.request.name,
          requestUrl: error.requestUrl,
          environmentId: executionEnvironment.id,
          globalEnvironmentId: activeEnvironment.id,
          collectionEnvironmentId: collection.activeSubEnvironmentId ?? '',
          receivedAt,
          requestSnapshot: createRequestSnapshot(active.request),
          requestTestResults: [],
          settingSendCookies: request.transport.sendCookies,
          settingStoreCookies: request.transport.storeCookies,
        };
        setSelectedResponseId(workspace.preferences.maxHistoryResponses === 0 ? '' : storedResponse.id);
        setWorkspace((current) => setWorkspaceFileCookies({
          ...current,
          history: [{ id: uid('history'), requestId: active.request.id, name: active.request.name, method: active.request.method, url: error.requestUrl, status: 0, durationMs: error.durationMs, createdAt: receivedAt }, ...current.history].slice(0, 100),
          responses: retainResponseHistory(scriptResponses, storedResponse, current.preferences.maxHistoryResponses, current.preferences.filterResponsesByEnv),
          pluginData: pluginState.data,
        }, activeRequestFileId, scriptCookies));
      } else {
        setWorkspace((current) => setWorkspaceFileCookies({ ...current, responses: scriptResponses, pluginData: pluginState.data }, activeRequestFileId, scriptCookies));
      }
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

  const stopWorkspaceRuntime = async () => {
    cancelScheduledSends();
    activeTemplatePrompt.current?.resolve(null);
    templatePromptQueue.current.forEach((pending) => pending.resolve(null));
    activeTemplatePrompt.current = undefined;
    templatePromptQueue.current = [];
    setTemplatePrompt(undefined);
    if (environmentVaultSaveTimer.current !== undefined) window.clearTimeout(environmentVaultSaveTimer.current);
    environmentVaultSaveTimer.current = undefined;
    if (environmentVaultSavePending.current && vaultSessionRef.current.unlocked && activeWorkspaceIdRef.current) {
      const persisted = await persistEnvironmentVaultSession(activeWorkspaceIdRef.current, vaultSessionRef.current, environmentVaultSaveGeneration.current);
      if (!persisted) throw new Error('Save private-environment Secret values before changing projects.');
    }
    const sessionId = streamSession.current;
    const protocol = streamProtocol.current;
    const activeOAuthFlowId = oauthFlowId.current;
    oauthFlowId.current = '';
    streamSession.current = undefined;
    streamProtocol.current = undefined;
    await Promise.allSettled([
      ...Object.keys(runningMocks).map((serverId) => import('./lib/mock').then(({ stopMockServer }) => stopMockServer(serverId))),
      ...(sessionId && protocol ? [disconnectStream(protocol, sessionId)] : []),
      ...(activeOAuthFlowId ? [import('./lib/oauth2').then(({ cancelOAuth2Authorization }) => cancelOAuth2Authorization(activeOAuthFlowId))] : []),
    ]);
    setRunningMocks({});
    setStreamStatus('disconnected');
    setStreamMessages([]);
    setStreamSessionView(undefined);
    setStreamDraft('');
    setGrpcSchemas({});
    setScriptTests([]);
    setScriptLogs([]);
    setOAuthAuthorization(undefined);
    environmentVaultSavePending.current = false;
    setEnvironmentVaultSaveError('');
    setVaultSession({ unlocked: false, passphrase: '', entries: [] });
  };

  const adoptWorkspaceSnapshot = (snapshot: WorkspaceCatalogSnapshot, preservePreferences = true) => {
    const nextWorkspace = preservePreferences
      ? { ...snapshot.workspace, preferences: structuredClone(workspace.preferences) }
      : snapshot.workspace;
    setWorkspace(nextWorkspace);
    setActiveWorkspaceId(snapshot.activeWorkspaceId);
    setWorkspaceEntries(snapshot.entries);
    setWorkspaceRecovery(snapshot.recovery);
    setWorkspaceStoreError('');
    setSelectedResponseId('');
    setResponse(mockResponse());
    setWorkbenchSection('requests');
    setSidebarMode('collections');
    setFolderEditor(undefined);
  };

  const persistActiveWorkspaceNow = async () => {
    if (!activeWorkspaceId || (workspaceRecovery?.kind === 'workspace-backup' && workspaceRecovery.workspaceId === activeWorkspaceId)) return;
    const { saveCatalogWorkspace } = await workspaceCatalogApi();
    await saveCatalogWorkspace(activeWorkspaceId, workspace);
  };

  const runWorkspaceOperation = async (operation: () => Promise<WorkspaceCatalogSnapshot>, resetRuntime = true) => {
    if (workspaceStoreBusy || isSending || scheduledSendLabel) {
      setWorkspaceStoreError('Wait for the active request or scheduled run to finish before changing projects.');
      return;
    }
    workspaceSaveGeneration.current += 1;
    setWorkspaceStoreBusy(true);
    setWorkspaceStoreError('');
    try {
      await persistActiveWorkspaceNow();
      if (resetRuntime) await stopWorkspaceRuntime();
      adoptWorkspaceSnapshot(await operation());
    } catch (error) {
      setWorkspaceStoreError(error instanceof Error ? error.message : String(error));
    } finally {
      setWorkspaceStoreBusy(false);
    }
  };

  const runWorkspaceMaintenance = async (operation: () => Promise<void>, persistActive = false) => {
    if (workspaceStoreBusy || isSending || scheduledSendLabel) {
      setWorkspaceStoreError('Wait for the active request or scheduled run to finish before changing projects.');
      return;
    }
    setWorkspaceStoreBusy(true);
    setWorkspaceStoreError('');
    try {
      if (persistActive) {
        workspaceSaveGeneration.current += 1;
        await persistActiveWorkspaceNow();
      }
      await operation();
    } catch (error) {
      setWorkspaceStoreError(error instanceof Error ? error.message : String(error));
    } finally {
      setWorkspaceStoreBusy(false);
    }
  };

  const openLocalWorkspace = (workspaceId: string) => runWorkspaceOperation(async () => (await workspaceCatalogApi()).openCatalogWorkspace(workspaceId));
  const createLocalWorkspace = (name: string) => runWorkspaceOperation(async () => {
    const api = await workspaceCatalogApi();
    return api.createCatalogWorkspace(api.createBlankWorkspace(name, workspace.preferences));
  });
  const duplicateLocalWorkspace = (workspaceId: string, name: string) => runWorkspaceOperation(async () => {
    const api = await workspaceCatalogApi();
    const source = workspaceId === activeWorkspaceId ? workspace : await api.readCatalogWorkspace(workspaceId);
    return api.createCatalogWorkspace(api.createWorkspaceDuplicate(source, name, workspace.preferences));
  });
  const listLocalProjectWorkspaces = async (workspaceId: string) => (await workspaceCatalogApi()).listCatalogProjectWorkspaces(workspaceId);
  const listLocalWorkspaceSnapshots = async (workspaceId: string) => (await workspaceCatalogApi()).listCatalogWorkspaceSnapshots(workspaceId);
  const createLocalWorkspaceSnapshot = (workspaceId: string, message: string) => runWorkspaceMaintenance(async () => {
    await (await workspaceCatalogApi()).createCatalogWorkspaceSnapshot(workspaceId, message);
  }, workspaceId === activeWorkspaceId);
  const restoreLocalWorkspaceSnapshot = (workspaceId: string, snapshotId: string) => runWorkspaceOperation(async () => (
    await workspaceCatalogApi()
  ).restoreCatalogWorkspaceSnapshot(workspaceId, snapshotId));
  const duplicateLocalProjectWorkspace = (sourceWorkspaceId: string, projectWorkspaceId: string, targetWorkspaceId: string, name: string) => runWorkspaceOperation(async () => (
    await workspaceCatalogApi()
  ).duplicateCatalogProjectWorkspace(sourceWorkspaceId, projectWorkspaceId, targetWorkspaceId, name));
  const moveLocalProjectWorkspace = (sourceWorkspaceId: string, projectWorkspaceId: string, targetWorkspaceId: string) => runWorkspaceOperation(async () => (
    await workspaceCatalogApi()
  ).moveCatalogProjectWorkspace(sourceWorkspaceId, projectWorkspaceId, targetWorkspaceId));
  const renameLocalWorkspace = async (workspaceId: string, name: string) => {
    if (workspaceStoreBusy) return;
    setWorkspaceStoreBusy(true);
    setWorkspaceStoreError('');
    try {
      await persistActiveWorkspaceNow();
      const snapshot = await (await workspaceCatalogApi()).renameCatalogWorkspace(workspaceId, name);
      setWorkspaceEntries(snapshot.entries);
      setWorkspaceRecovery(snapshot.recovery);
      if (workspaceId === activeWorkspaceId) setWorkspace((current) => ({ ...current, name: snapshot.workspace.name }));
    } catch (error) {
      setWorkspaceStoreError(error instanceof Error ? error.message : String(error));
    } finally {
      setWorkspaceStoreBusy(false);
    }
  };
  const deleteLocalWorkspace = (workspaceId: string) => runWorkspaceOperation(async () => (await workspaceCatalogApi()).deleteCatalogWorkspace(workspaceId), workspaceId === activeWorkspaceId);
  const listDeletedLocalWorkspaces = async () => (await workspaceCatalogApi()).listDeletedCatalogWorkspaces();
  const purgeDeletedLocalWorkspace = (workspaceId: string, deletedAt: number) => runWorkspaceMaintenance(async () => (await workspaceCatalogApi()).purgeDeletedCatalogWorkspace(workspaceId, deletedAt));
  const emptyDeletedLocalWorkspaces = () => runWorkspaceMaintenance(async () => (await workspaceCatalogApi()).emptyDeletedCatalogWorkspaces());
  const reorderLocalWorkspace = async (workspaceId: string, targetWorkspaceId: string, position: 'before' | 'after') => {
    if (workspaceStoreBusy) return;
    setWorkspaceStoreBusy(true);
    setWorkspaceStoreError('');
    try {
      await persistActiveWorkspaceNow();
      const snapshot = await (await workspaceCatalogApi()).reorderCatalogWorkspace(workspaceId, targetWorkspaceId, position);
      setWorkspaceEntries(snapshot.entries);
      setWorkspaceRecovery(snapshot.recovery);
    } catch (error) {
      setWorkspaceStoreError(error instanceof Error ? error.message : String(error));
    } finally {
      setWorkspaceStoreBusy(false);
    }
  };
  const restoreDeletedLocalWorkspace = (workspaceId: string, deletedAt: number) => runWorkspaceOperation(async () => (await workspaceCatalogApi()).restoreDeletedCatalogWorkspace(workspaceId, deletedAt));
  const restoreLocalWorkspace = (workspaceId: string) => runWorkspaceOperation(async () => (await workspaceCatalogApi()).restoreCatalogWorkspaceBackup(workspaceId));

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
    if (!streamSession.current || !active || !activeCollection || !activeEnvironment) return;
    try {
      if (active.request.protocol === 'socketio') {
        const configured = applyCollectionConfiguration(activeCollection, active.request, activeEnvironment);
        const realtimePlugins = createRealtimePluginContext(configured.environment);
        const { sendSocketIoMessage } = await import('./lib/socketIo');
        try {
          await sendSocketIoMessage(configured.request, configured.environment, streamSession.current, onStreamEvent, realtimeRequestContext(configured.request, realtimePlugins.runtime));
        } finally {
          realtimePlugins.flush();
        }
      } else if (active.request.protocol === 'websocket' && streamDraft.trim()) {
        const configured = applyCollectionConfiguration(activeCollection, active.request, activeEnvironment);
        const realtimePlugins = createRealtimePluginContext(configured.environment);
        try {
          const message = streamFrameKind === 'text'
            ? await renderRequestValue(streamDraft, configured.request, configured.environment, realtimeRequestContext(configured.request, realtimePlugins.runtime))
            : streamDraft;
          setStreamDraft('');
          await sendWebSocketMessage(streamSession.current, message, streamFrameKind, onStreamEvent);
        } finally {
          realtimePlugins.flush();
        }
      }
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      onStreamEvent({ id: uid('event'), direction: 'system', kind: 'error', text, timestamp: new Date().toISOString() });
    }
  };

  const toggleSocketIoListener = async (eventName: string, enabled: boolean) => {
    if (!streamSession.current || streamProtocol.current !== 'socketio' || streamStatus !== 'connected' || !active || !activeCollection || !activeEnvironment) return;
    try {
      const configured = applyCollectionConfiguration(activeCollection, active.request, activeEnvironment);
      const realtimePlugins = createRealtimePluginContext(configured.environment);
      const { setSocketIoListener } = await import('./lib/socketIo');
      try {
        await setSocketIoListener(streamSession.current, await renderRequestValue(eventName, configured.request, configured.environment, realtimeRequestContext(configured.request, realtimePlugins.runtime)), enabled);
      } finally {
        realtimePlugins.flush();
      }
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      onStreamEvent({ id: uid('event'), direction: 'system', kind: 'error', text, timestamp: new Date().toISOString() });
    }
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowPalette(false);
        setShowCreateMenu(false);
        setShowSendOptions(false);
        setShowCodeGeneration(false);
        return;
      }
      if (event.repeat) return;
      const shortcuts = workspace.preferences.shortcuts;
      const owner = shortcutEventOwner(shortcuts, event);
      const shortcutAction = owner === 'focus-sidebar-filter'
        && isRequestDocument
        && requestTab === 'body'
        && shortcutMatches(event, shortcuts['beautify-body'])
        ? 'beautify-body'
        : owner;
      if (!shortcutAction) return;
      const action = (callback: () => void) => { event.preventDefault(); event.stopPropagation(); callback(); };
      switch (shortcutAction) {
        case 'workspace-settings':
          if (active?.collectionId) action(() => openCollectionDocument(active.collectionId));
          else if (activeCollectionDocument) action(() => openCollectionDocument(activeCollectionDocument.id));
          break;
        case 'request-settings':
          if (isRequestDocument) action(() => { setWorkbenchSection('requests'); setRequestTab('transport'); });
          break;
        case 'keyboard-shortcuts':
          action(() => { setPreferencesInitialTab('keyboard'); setWorkbenchSection('preferences'); });
          break;
        case 'preferences':
          action(() => { setPreferencesInitialTab('general'); setWorkbenchSection('preferences'); });
          break;
        case 'palette':
          action(() => setShowPalette((visible) => !visible));
          break;
        case 'reload-plugins':
          action(() => { setPluginReloadGeneration((generation) => generation + 1); setWorkbenchSection('plugins'); });
          break;
        case 'autocomplete':
          action(() => window.dispatchEvent(new Event('brunomnia-show-autocomplete')));
          break;
        case 'send':
          if (isRequestDocument) action(() => { if (scheduledSendLabel) cancelScheduledSends(); else if (!isSending) void executeRequest(); });
          break;
        case 'send-options':
          if (isRequestDocument && active && !isStreamingRequest(active.request) && active.request.protocol !== 'grpc') action(() => setShowSendOptions(true));
          break;
        case 'environment':
          action(openEnvironmentDocument);
          break;
        case 'switch-environment':
          action(() => requestAnimationFrame(() => { environmentSelectRef.current?.focus(); try { environmentSelectRef.current?.showPicker(); } catch {} }));
          break;
        case 'focus-method':
          if (isRequestDocument && active?.request.protocol === 'http') action(() => requestAnimationFrame(() => { methodInputRef.current?.focus(); methodInputRef.current?.select(); try { methodInputRef.current?.showPicker(); } catch {} }));
          break;
        case 'history':
          action(() => { setWorkbenchSection('requests'); setSidebarMode('history'); setSidebarHidden(false); });
          break;
        case 'focus-url':
          if (isRequestDocument) action(() => { setWorkbenchSection('requests'); urlInputRef.current?.focus(); urlInputRef.current?.select(); });
          break;
        case 'generate-code':
          if (isRequestDocument && active && (active.request.protocol === 'http' || active.request.protocol === 'graphql')) action(() => setShowCodeGeneration(true));
          break;
        case 'focus-sidebar-filter':
          action(() => { setWorkbenchSection('requests'); setSidebarHidden(false); requestAnimationFrame(() => { sidebarSearchInputRef.current?.focus(); sidebarSearchInputRef.current?.select(); }); });
          break;
        case 'create-menu':
          action(() => setShowCreateMenu(true));
          break;
        case 'toggle-sidebar':
          action(() => setSidebarHidden((hidden) => !hidden));
          break;
        case 'focus-response':
          if (isRequestDocument) action(() => { setWorkbenchSection('requests'); requestAnimationFrame(() => responsePanelRef.current?.focus()); });
          break;
        case 'cookies':
          if (isRequestDocument) action(() => { setWorkbenchSection('requests'); setResponseTab('cookies'); requestAnimationFrame(() => responsePanelRef.current?.focus()); });
          break;
        case 'new-request':
          action(addRequest);
          break;
        case 'delete-request':
          if (isRequestDocument) action(deleteActiveRequest);
          break;
        case 'create-folder':
          if (active) action(() => addFolder(active.collectionId, active.request.folderId ?? ''));
          break;
        case 'duplicate-request':
          if (isRequestDocument) action(duplicateActiveRequest);
          break;
        case 'toggle-pin':
          if (isRequestDocument && active) action(() => toggleRequestPin(active.request.id));
          break;
        case 'variable-source':
          action(() => setWorkspace((current) => ({ ...current, preferences: { ...current.preferences, showVariableSourceAndValue: !current.preferences.showVariableSourceAndValue } })));
          break;
        case 'beautify-body':
          if (isRequestDocument && active && requestTab === 'body') action(() => {
            if (active.request.protocol === 'http') updateActiveRequest({ body: prettyRequestBody(active.request) });
            else if (active.request.protocol === 'graphql') {
              try { updateActiveRequest({ graphql: { ...active.request.graphql, query: formatGraphqlDocument(active.request.graphql.query) } }); } catch {}
            }
          });
          break;
        case 'focus-graphql-filter':
          if (isRequestDocument && active?.request.protocol === 'graphql') action(() => { setRequestTab('body'); requestAnimationFrame(() => { graphqlFilterInputRef.current?.focus(); graphqlFilterInputRef.current?.select(); }); });
          break;
        case 'close-tab':
          if (workbenchSection === 'requests' && activeRequestDocumentState.activeRequestId) action(() => closeRequestDocument(activeRequestDocumentState.activeRequestId));
          break;
        case 'next-tab':
          if (workbenchSection === 'requests') action(() => cycleRequestDocument('next'));
          break;
        case 'previous-tab':
          if (workbenchSection === 'requests') action(() => cycleRequestDocument('previous'));
          break;
        case 'reopen-closed-tab':
          if (workbenchSection === 'requests') action(reopenRequestDocument);
          break;
        case 'open-request-new-tab':
          if (isRequestDocument && workspace.activeRequestId) action(() => promoteRequestDocument(workspace.activeRequestId));
          break;
      }
    };
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [active, activeCollectionDocument, activeRequestDocumentState, activeWorkspaceId, isRequestDocument, isSending, requestTab, scheduledSendLabel, workbenchSection, workspace]);

  const applyImport = async (results: ArtifactImport[]) => {
    const { applyArtifactImport } = await import('./lib/interchange/apply');
    setWorkspace((current) => results.reduce((next, result) => applyArtifactImport(next, result), current));
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
    const result = await sendRequest(request, activeEnvironment, { cookies: [...activeWorkspaceFileState.cookies], responses: [...workspace.responses], preferredHttpVersion: workspace.preferences.preferredHttpVersion, maxRedirects: workspace.preferences.maxRedirects, followRedirects: workspace.preferences.followRedirects, requestTimeoutMs: workspace.preferences.requestTimeoutMs, validateCertificates: workspace.preferences.validateCertificates, validateAuthCertificates: workspace.preferences.validateAuthCertificates, proxy: proxyPreferences, maxTimelineDataSizeKB: workspace.preferences.maxTimelineDataSizeKB, filterResponsesByEnv: workspace.preferences.filterResponsesByEnv });
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

  const moveEnvironment = useCallback((move: WorkspaceEnvironmentMove) => {
    setWorkspace((current) => moveWorkspaceEnvironment(current, move));
  }, []);

  const duplicateEnvironment = (id: string) => {
    const source = workspace.environments.find((environment) => environment.id === id);
    if (!source?.parentId) return;
    if (environmentHasSecrets(source) && !vaultSession.unlocked) {
      window.alert('Unlock the local vault before duplicating an environment with Secret variables.');
      return;
    }
    const copyId = uid('environment');
    const variableIds = source.variables.map(() => uid('variable'));
    let variableIndex = 0;
    const next = duplicateWorkspaceEnvironment(workspace, id, (kind) => kind === 'environment' ? copyId : variableIds[variableIndex++]);
    const copy = next.environments.find((environment) => environment.id === copyId);
    if (!copy) return;
    setWorkspace(next);
    if (environmentHasSecrets(source)) {
      updateEnvironmentVaultEntries(duplicateEnvironmentSecrets(source.variables, copy.variables, vaultSession.entries));
    }
  };

  const addEnvironment = (parentId: string) => {
    const id = uid('environment');
    setWorkspace((current) => {
      const publicIds = new Set(publicEnvironments(current.environments).map((environment) => environment.id));
      return { ...current, activeEnvironmentId: id, environments: [...current.environments, { id, name: parentId ? 'New Sub-environment' : 'New Base Environment', variables: [], environmentEditorMode: 'table', parentId, private: Boolean(parentId) && !publicIds.has(parentId), color: '#69bddd' }], fileState: parentId ? current.fileState : { ...current.fileState, [id]: emptyWorkspaceFileState() } };
    });
  };

  const deleteEnvironment = (id: string) => {
    if (workspace.environments.length <= 1) return;
    const target = workspace.environments.find((environment) => environment.id === id);
    if (!target) return;
    if (environmentHasSecrets(target) && !vaultSession.unlocked) {
      window.alert('Unlock the local vault before deleting an environment with Secret variables.');
      return;
    }
    if (workspace.preferences.confirmDestructive && !window.confirm('Delete this environment? Child environments will move to its parent.')) return;
    if (environmentHasSecrets(target)) updateEnvironmentVaultEntries(removeEnvironmentSecrets(vaultSession.entries, target.variables.map((row) => row.id)));
    setWorkspace((current) => {
      const deleted = current.environments.find((environment) => environment.id === id);
      if (!deleted) return current;
      const environments = current.environments.filter((environment) => environment.id !== id).map((environment) => environment.parentId === id ? { ...environment, parentId: deleted.parentId ?? '', private: environment.private || deleted.private === true } : environment);
      const fileState = { ...current.fileState };
      if (!deleted.parentId) {
        const deletedState = getWorkspaceFileState(current, deleted.id);
        environments.filter((environment) => !environment.parentId && current.environments.find((candidate) => candidate.id === environment.id)?.parentId === deleted.id)
          .forEach((environment) => { fileState[environment.id] = structuredClone(deletedState); });
        delete fileState[deleted.id];
      }
      return { ...current, environments, fileState, activeEnvironmentId: current.activeEnvironmentId === id ? environments.find((environment) => environment.id === deleted.parentId)?.id ?? environments[0].id : current.activeEnvironmentId };
    });
  };

  const editingCollection = workspace.collections.find((collection) => collection.id === folderEditor?.collectionId);
  const editingFolder = editingCollection?.folders?.find((folder) => folder.id === folderEditor?.folderId);
  if (!hydrated) {
    return <main className="loading-screen"><div className="brand-mark"><span /></div><strong>Brunomnia</strong><span>Opening local workspace…</span></main>;
  }
  const runtimeRequest = active?.request ?? createBlankRequest('empty-runtime-request');
  const runtimeCollection: Collection = activeCollection ?? { id: 'empty-runtime-collection', name: 'Requests', expanded: true, requests: [runtimeRequest], folders: [], resourceOrder: [runtimeRequest.id], environment: [], environmentEditorMode: 'table', subEnvironments: [], activeSubEnvironmentId: '', documentation: '' };
  const runtimeActive = active ?? { collectionId: runtimeCollection.id, request: runtimeRequest };
  const runtimeEnvironment: Environment = activeEnvironment ?? { id: '', name: 'No Environment', variables: [], environmentEditorMode: 'table', parentId: '', private: false };
  const runContextualPluginAction = async (action: ContextualPluginAction, requestedTarget: PluginActionTarget) => {
    if (contextualPluginActionBusyRef.current) return;
    const plugin = workspace.plugins.find((candidate) => candidate.id === action.pluginId);
    if (!plugin || !plugin.enabled || plugin.error || !plugin.grantedPermissions.includes('action') || pluginActionAuthorityKey(plugin) !== action.authorityKey) {
      setContextualPluginActionFeedback({ error: true, message: `${action.pluginName}: action authority changed. Reopen the menu and try again.` });
      return;
    }
    const invocationWorkspaceId = activeWorkspaceId;
    contextualPluginActionBusyRef.current = action.key;
    setContextualPluginActionBusyKey(action.key);
    setContextualPluginActionFeedback(undefined);
    try {
      const invocation = resolveContextualPluginActionInvocation(workspace, action, requestedTarget);
      const actionFileId = workspaceFileIdForRequest(workspace, invocation.request.id) || activeWorkspaceFileId;
      const actionFileState = getWorkspaceFileState(workspace, actionFileId);
      const callbacks: PluginHostCallbacks = {
        network: (pluginRequest) => sendHttpRequest(pluginRequest, runtimeEnvironment, {
          ...oauthRequestContext(invocation.request),
          cookies: [...actionFileState.cookies],
          certificates: actionFileState.certificates,
          requestAncestors: requestAncestorNames(workspace.collections, invocation.request),
          authorizeOAuth2: authorizeOAuth2WithStatus,
        }),
        prompt: async (title, defaultValue) => window.prompt(title, defaultValue) ?? '',
        readClipboard: () => navigator.clipboard.readText(),
        writeClipboard: (value) => navigator.clipboard.writeText(value),
        ...pluginHostCapabilities(runtimeEnvironment),
      };
      const output = await runPluginAction(plugin, action.descriptor, invocation.request, workspace, workspace.pluginData[plugin.id] ?? {}, callbacks, invocation.target);
      if (activeWorkspaceIdRef.current !== invocationWorkspaceId) return;
      const currentPlugin = workspaceRef.current.plugins.find((candidate) => candidate.id === action.pluginId);
      if (!currentPlugin || pluginActionAuthorityKey(currentPlugin) !== action.authorityKey) {
        setContextualPluginActionFeedback({ error: true, message: `${action.pluginName}: authority changed while the action ran, so its result was discarded.` });
        return;
      }
      setWorkspace((current) => applyContextualPluginActionResult(current, action, output));
      const notificationText = output.notifications.slice(0, 3).map((notification) => `${notification.title}: ${notification.message}`).join(' · ');
      const remainingNotifications = Math.max(0, output.notifications.length - 3);
      setContextualPluginActionFeedback({ error: false, message: `${action.pluginName}: ${action.descriptor.label} completed.${notificationText ? ` ${notificationText}` : ''}${remainingNotifications ? ` · ${remainingNotifications} more` : ''}` });
    } catch (caught) {
      setContextualPluginActionFeedback({ error: true, message: `${action.pluginName}: ${caught instanceof Error ? caught.message : String(caught)}` });
    } finally {
      if (contextualPluginActionBusyRef.current === action.key) contextualPluginActionBusyRef.current = '';
      setContextualPluginActionBusyKey((current) => current === action.key ? '' : current);
    }
  };
  const codegenConfiguration = applyCollectionConfiguration(runtimeCollection, runtimeRequest, runtimeEnvironment);
  const renderDocumentTabStrip = (trailing?: ReactNode) => <DocumentTabStrip
    activeDocumentId={activeRequestDocumentState.activeRequestId}
    canReopenDocument={activeRequestDocumentState.closed.some((documentId) => validDocumentReferences.some((document) => document.id === documentId))}
    documents={openDocumentTabs}
    onAddRequest={addRequest}
    onCloseAllDocuments={closeAllRequestDocuments}
    onCloseDocument={closeRequestDocument}
    onCloseOtherDocuments={closeOtherRequestDocuments}
    onMoveDocument={reorderRequestDocument}
    onPromoteDocument={promoteRequestDocument}
    onRenameDocument={renameWorkspaceDocument}
    onReopenDocument={reopenRequestDocument}
    onSelectDocument={openWorkspaceDocument}
    onToggleRequestPin={toggleRequestPin}
    pinnedRequestIds={activePinnedRequestIds}
    trailing={trailing}
  />;
  const renderAutomationWorkbench = (section: 'design' | 'runner' | 'mocks', runnerTarget?: { collectionId: string; folderId?: string }) => {
    const draftKey = section === 'runner' && activeDocumentTab?.type === 'runner' ? runnerDraftKey(activeWorkspaceId, activeDocumentTab.requestId) : undefined;
    return <Suspense fallback={<div className="dialog-loading">Loading automation…</div>}><AutomationWorkbench
    activeEnvironment={runtimeEnvironment}
    designTargetId={section === 'design' ? activeDesignDocument?.id : undefined}
    mockTarget={section === 'mocks' && activeMockDocument ? { serverId: activeMockDocument.server.id, routeId: activeMockDocument.route?.id } : undefined}
    onChangeWorkspace={(updater) => setWorkspace(updater)}
    onDesignChange={section === 'design' && activeDesignDocument ? () => promoteRequestDocument(activeDesignDocument.id) : undefined}
    onOpenCollection={(collection) => {
      setWorkbenchSection('requests');
      setSidebarMode('collections');
      if (collection.requests[0]) {
        const state = section === 'design' && activeDesignDocument ? promoteRequestTab(activeRequestDocumentState, activeDesignDocument.id) : activeRequestDocumentState;
        applyRequestDocumentState(openRequestTab(state, collection.requests[0].id));
      }
    }}
    onOpenRequest={(requestId) => {
      if (section === 'runner' && activeDocumentTab?.type === 'runner') promoteRequestDocument(activeDocumentTab.requestId);
      openRequestDocument(requestId);
    }}
    onMockChange={section === 'mocks' && activeMockDocument ? () => promoteRequestDocument(activeRequestDocumentState.activeRequestId) : undefined}
    onOpenMock={openMockDocument}
    onOpenDesign={openDesignDocument}
    onRunnerStart={section === 'runner' ? () => promoteRequestDocument(activeRequestDocumentState.activeRequestId) : undefined}
    onStartMock={(serverId, runningMock) => setRunningMocks((current) => ({ ...current, [serverId]: runningMock }))}
    onStopMock={(serverId) => setRunningMocks((current) => {
      const next = { ...current };
      delete next[serverId];
      return next;
    })}
    onRunnerDraftChange={updateRunnerDraft}
    runnerDraft={draftKey ? runnerDrafts[draftKey] : undefined}
    runnerDraftKey={draftKey}
    runnerTarget={runnerTarget}
    runningMocks={runningMocks}
    section={section}
    templatePrompt={requestTemplatePrompt}
    vault={unlockedVault}
    workspace={workspace}
    workspaceId={activeWorkspaceId}
  /></Suspense>;
  };
  const generateCode = async (target: ClientCodeTarget, request: ApiRequest, variables: Record<string, string>): Promise<ClientCodeSnippet> => {
    const codegenFileState = getWorkspaceFileState(workspace, workspaceFileIdForRequest(workspace, request.id) || activeWorkspaceFileId);
    const pluginState: PluginRunState = { data: structuredClone(workspace.pluginData), notifications: [] };
    const initialPluginData = JSON.stringify(pluginState.data);
    const pluginCallbacks: PluginHostCallbacks = {
      network: (pluginRequest) => sendRequest(pluginRequest, codegenConfiguration.environment, {
        cookies: [...codegenFileState.cookies],
        responses: [...workspace.responses],
        preferredHttpVersion: workspace.preferences.preferredHttpVersion,
        maxRedirects: workspace.preferences.maxRedirects,
        followRedirects: workspace.preferences.followRedirects,
        requestTimeoutMs: workspace.preferences.requestTimeoutMs,
        validateCertificates: workspace.preferences.validateCertificates,
        validateAuthCertificates: workspace.preferences.validateAuthCertificates,
        proxy: proxyPreferences,
        maxTimelineDataSizeKB: workspace.preferences.maxTimelineDataSizeKB,
        filterResponsesByEnv: workspace.preferences.filterResponsesByEnv,
        vault: unlockedVault,
        externalSecret: externalSecretResolver,
        authorizeOAuth2: authorizeOAuth2WithStatus,
      }),
      prompt: async (title, defaultValue) => window.prompt(title, defaultValue) ?? '',
      readClipboard: () => navigator.clipboard.readText(),
      writeClipboard: (value) => navigator.clipboard.writeText(value),
      ...pluginHostCapabilities(codegenConfiguration.environment),
    };
    const pluginRuntime = createPluginRuntime(workspace.plugins, pluginState, pluginCallbacks);
    try {
      const { generateClientCodeWithAuth } = await import('./lib/codegen');
      const snippet = await generateClientCodeWithAuth(target, request, variables, {}, {
        cookies: getWorkspaceFileState(workspace, workspaceFileIdForRequest(workspace, request.id) || activeWorkspaceFileId).cookies,
        environmentId: codegenConfiguration.environment.id,
        responses: workspace.preferences.filterResponsesByEnv
          ? workspace.responses.filter((response) => response.environmentId === codegenConfiguration.environment.id)
          : workspace.responses,
        pluginRuntime,
        externalSecret: externalSecretResolver,
        readFile: templateFileReader,
        requestAncestors: requestAncestorNames(workspace.collections, request),
      });
      return {
        ...snippet,
        warnings: [
          ...snippet.warnings,
          ...pluginState.notifications.map((notification) => `${notification.title}: ${notification.message}`),
        ],
      };
    } finally {
      if (JSON.stringify(pluginState.data) !== initialPluginData) {
        setWorkspace((current) => ({ ...current, pluginData: { ...current.pluginData, ...pluginState.data } }));
      }
    }
  };

  return (
    <main className="app-shell" data-density={workspace.preferences.density} data-editor-indent-size={workspace.preferences.editorIndentSize} data-editor-indent-with-tabs={workspace.preferences.editorIndentWithTabs} data-editor-line-wrapping={workspace.preferences.editorLineWrapping} data-force-vertical-layout={workspace.preferences.forceVerticalLayout} data-theme={workspace.activePluginTheme ? 'plugin' : workspace.preferences.theme} style={{ '--editor-font-size': `${workspace.preferences.fontSize}px`, '--interface-font-size': `${workspace.preferences.interfaceFontSize}px`, '--font-sans': workspace.preferences.fontInterface.trim() || undefined, '--font-mono': workspace.preferences.fontMonospace.trim() || undefined, '--editor-indent-size': workspace.preferences.editorIndentSize, '--font-ligatures': workspace.preferences.fontVariantLigatures ? 'normal' : 'none' } as CSSProperties}>
      <header className="topbar">
        <div className="brand"><div className="brand-mark"><span /></div><strong>Brunomnia</strong></div>
        <Suspense fallback={<button className="workspace-switcher" disabled type="button"><Icon name="archive" size={17} /><span>{workspace.name}</span></button>}>
          <WorkspaceSwitcher
            activeWorkspaceId={activeWorkspaceId}
            busy={workspaceStoreBusy || isSending || Boolean(scheduledSendLabel)}
            entries={workspaceEntries}
            error={workspaceStoreError}
            recovery={workspaceRecovery}
            onCreate={createLocalWorkspace}
            onCreateSnapshot={createLocalWorkspaceSnapshot}
            onDelete={deleteLocalWorkspace}
            onDuplicate={duplicateLocalWorkspace}
            onDuplicateProjectWorkspace={duplicateLocalProjectWorkspace}
            onEmptyDeleted={emptyDeletedLocalWorkspaces}
            onListProjectWorkspaces={listLocalProjectWorkspaces}
            onListSnapshots={listLocalWorkspaceSnapshots}
            onListDeleted={listDeletedLocalWorkspaces}
            onOpen={openLocalWorkspace}
            onPurgeDeleted={purgeDeletedLocalWorkspace}
            onMoveProjectWorkspace={moveLocalProjectWorkspace}
            onRename={renameLocalWorkspace}
            onReorder={reorderLocalWorkspace}
            onRestore={restoreLocalWorkspace}
            onRestoreDeleted={restoreDeletedLocalWorkspace}
            onRestoreSnapshot={restoreLocalWorkspaceSnapshot}
          />
        </Suspense>
        <button className="command-trigger" onClick={() => setShowPalette(true)} type="button"><Icon name="search" size={17} /><span>Search or run command…</span><kbd>{shortcutDisplayLabel(workspace.preferences.shortcuts.palette)}</kbd></button>
        <select aria-label="Environment" className="environment-switcher" onChange={(event) => setWorkspace((current) => ({ ...current, activeEnvironmentId: event.target.value }))} ref={environmentSelectRef} value={workspace.activeEnvironmentId}>
          {!workspace.environments.length ? <option value="">No environment</option> : null}
          {workspace.environments.map((environment) => <option key={environment.id} value={environment.id}>{`${'— '.repeat(environmentAncestors(workspace.environments, environment.id).length)}${environment.name}${environment.private ? ' · private' : ''}`}</option>)}
        </select>
        <div className="topbar-actions">
          <button aria-label="Edit environment" className={`icon-button subtle${isEnvironmentDocument ? ' active' : ''}`} onClick={openEnvironmentDocument} type="button"><Icon name="braces" size={18} /></button>
          <button aria-label="Import artifacts" className="icon-button subtle" onClick={() => setShowImport(true)} type="button"><Icon name="import" size={18} /></button>
          <button aria-label="Export artifacts" className="icon-button subtle" onClick={() => setShowExport(true)} type="button"><Icon name="download" size={18} /></button>
        </div>
      </header>

      <div className={`app-body${sidebarHidden ? ' sidebar-hidden' : ''}`}>
        <nav className="activity-rail" aria-label="Workspace sections">
          <div>
            <button aria-label="Collections" className={workbenchSection === 'requests' && sidebarMode === 'collections' ? 'active' : ''} onClick={() => { setWorkbenchSection('requests'); setSidebarMode('collections'); }} type="button"><Icon name="archive" /></button>
            <button aria-label="API Design" className={activeDesignDocument ? 'active' : ''} onClick={() => openDesignDocument()} type="button"><Icon name="grid" /></button>
            <button aria-label="History" className={workbenchSection === 'requests' && sidebarMode === 'history' ? 'active' : ''} onClick={() => { setWorkbenchSection('requests'); setSidebarMode('history'); }} type="button"><Icon name="history" /></button>
            <button aria-label="Scripts" onClick={() => { setWorkbenchSection('requests'); setRequestTab('scripts'); }} type="button"><Icon name="code" /></button>
            <button aria-label="Unit tests" className={activeTestSuiteDocument ? 'active' : ''} onClick={() => openTestSuiteDocument()} type="button"><Icon name="check" /></button>
            <button aria-label="Collection Runner" className={isRunnerDocument ? 'active' : ''} onClick={() => openRunnerDocument()} type="button"><Icon name="database" /></button>
            <button aria-label="Mock servers" className={activeMockDocument ? 'active' : ''} onClick={() => openMockDocument()} type="button"><Icon name="spark" /></button>
            <button aria-label="Git Sync" className={workbenchSection === 'git' ? 'active' : ''} onClick={() => setWorkbenchSection('git')} type="button"><Icon name="code" /></button>
            <button aria-label="Plugins" className={workbenchSection === 'plugins' ? 'active' : ''} onClick={() => setWorkbenchSection('plugins')} type="button"><Icon name="braces" /></button>
            <button aria-label="Security & Sync" className={workbenchSection === 'security' ? 'active' : ''} onClick={() => setWorkbenchSection('security')} type="button"><Icon name="lock" /></button>
            <button aria-label="MCP, AI, and Konnect" className={workbenchSection === 'integrations' ? 'active' : ''} onClick={() => setWorkbenchSection('integrations')} type="button"><Icon name="globe" /></button>
          </div>
          <button aria-label="Preferences" className={workbenchSection === 'preferences' ? 'active' : ''} onClick={() => { setPreferencesInitialTab('general'); setWorkbenchSection('preferences'); }} type="button"><Icon name="settings" /></button>
        </nav>

        {workbenchSection === 'requests' && !sidebarHidden ? <CollectionSidebar
          mode={sidebarMode}
          onAddCollection={addCollection}
          onAddFolder={addFolder}
          onEditCollection={openCollectionDocument}
          onEditFolder={(collectionId, folderId) => setFolderEditor({ collectionId, folderId })}
          onMoveResource={moveResource}
          onRunPluginAction={(action, target) => void runContextualPluginAction(action, target)}
          onAddRequest={addRequest}
          onSearch={setSearch}
          onSelectFolder={openFolderDocument}
          onSelectRequest={openRequestDocument}
          onToggleRequestPin={toggleRequestPin}
          onToggleCollection={(id) => setWorkspace((current) => ({ ...current, collections: current.collections.map((collection) => collection.id === id ? { ...collection, expanded: !collection.expanded } : collection) }))}
          onToggleFolder={(collectionId, folderId) => setWorkspace((current) => ({ ...current, collections: current.collections.map((collection) => collection.id === collectionId ? { ...collection, folders: (collection.folders ?? []).map((folder) => folder.id === folderId ? { ...folder, expanded: !folder.expanded } : folder) } : collection) }))}
          search={search}
          searchInputRef={sidebarSearchInputRef}
          selectedDocumentId={isRequestDashboard ? '' : activeRequestDocumentState.activeRequestId}
          selectedDocumentType={activeDocumentTab?.type}
          pinnedRequestIds={activePinnedRequestIds}
          pluginActionBusyKey={contextualPluginActionBusyKey}
          pluginActions={contextualPluginActions}
          workspace={workspace}
        /> : null}

        {workbenchSection === 'requests' ? (isRequestDashboard ? <ProjectDashboard
          canReopenRequest={activeRequestDocumentState.closed.some((documentId) => validDocumentReferences.some((document) => document.id === documentId))}
          onAddRequest={addRequest}
          onOpenCollection={openCollectionDocument}
          onOpenDesign={openDesignDocument}
          onOpenEnvironment={openEnvironmentDocument}
          onImport={() => setShowImport(true)}
          onOpenMcp={() => setWorkbenchSection('integrations')}
          onOpenMockServer={(serverId) => openMockDocument(serverId)}
          onOpenTestSuite={(suiteId) => openTestSuiteDocument(suiteId)}
          onReopenRequest={reopenRequestDocument}
          onRunPluginAction={(action, target) => void runContextualPluginAction(action, target)}
          pluginActionBusyKey={contextualPluginActionBusyKey}
          pluginActions={contextualPluginActions}
          workspace={workspace}
        /> : isEnvironmentDocument ? <EnvironmentDocumentPanel
          activeId={workspace.activeEnvironmentId}
          documentTabStrip={renderDocumentTabStrip()}
          environments={workspace.environments}
          onAdd={(parentId) => { promoteRequestDocument(environmentDocumentId(activeWorkspaceId)); addEnvironment(parentId); }}
          onChange={(environment) => { promoteRequestDocument(environmentDocumentId(activeWorkspaceId)); updateEnvironment(environment); }}
          onDelete={(environmentId) => { deleteEnvironment(environmentId); promoteRequestDocument(environmentDocumentId(activeWorkspaceId)); }}
          onDuplicate={(environmentId) => { promoteRequestDocument(environmentDocumentId(activeWorkspaceId)); duplicateEnvironment(environmentId); }}
          onMove={(move) => { promoteRequestDocument(environmentDocumentId(activeWorkspaceId)); moveEnvironment(move); }}
          onSelect={(activeEnvironmentId) => setWorkspace((current) => ({ ...current, activeEnvironmentId }))}
          onVaultEntriesChange={updateEnvironmentVaultEntries}
          vaultSaveError={environmentVaultSaveError}
          vaultSession={vaultSession}
        /> : activeCollectionDocument ? <CollectionDocumentPanel collection={activeCollectionDocument} documentTabStrip={renderDocumentTabStrip()} onChange={(collection) => { promoteRequestDocument(collection.id); updateCollection(collection); }} /> : activeDesignDocument ? <section className="document-automation-panel">{renderDocumentTabStrip()}{renderAutomationWorkbench('design')}</section> : activeMockDocument ? <section className="document-automation-panel">{renderDocumentTabStrip()}{renderAutomationWorkbench('mocks')}</section> : activeTestSuiteDocument ? <Suspense fallback={<div className="dialog-loading">Loading unit tests…</div>}><UnitTestWorkbench activeEnvironment={runtimeEnvironment} documentTabStrip={renderDocumentTabStrip()} key={activeTestSuiteDocument.id} onChangeWorkspace={(updater) => setWorkspace(updater)} onDeleteSuite={deleteTestSuite} onOpenSuite={openTestSuiteDocument} onPromote={() => promoteRequestDocument(activeTestSuiteDocument.id)} suite={activeTestSuiteDocument} templatePrompt={requestTemplatePrompt} vault={unlockedVault} workspace={workspace} /></Suspense> : activeFolderDocument ? <FolderDocumentPanel
          collection={activeFolderDocument.collection}
          cookies={activeWorkspaceFileState.cookies}
          documentTabStrip={renderDocumentTabStrip()}
          environment={runtimeEnvironment}
          folder={activeFolderDocument.folder}
          onChange={(folder) => { promoteRequestDocument(folder.id); updateFolder(activeFolderDocument.collection.id, folder); }}
          onConfigure={() => setFolderEditor({ collectionId: activeFolderDocument.collection.id, folderId: activeFolderDocument.folder.id })}
          onRun={() => openRunnerDocument(activeFolderDocument.folder.id)}
          requestContext={{ preferredHttpVersion: workspace.preferences.preferredHttpVersion, maxRedirects: workspace.preferences.maxRedirects, followRedirects: workspace.preferences.followRedirects, requestTimeoutMs: workspace.preferences.requestTimeoutMs, validateCertificates: workspace.preferences.validateCertificates, validateAuthCertificates: workspace.preferences.validateAuthCertificates, proxy: proxyPreferences, maxTimelineDataSizeKB: workspace.preferences.maxTimelineDataSizeKB, filterResponsesByEnv: workspace.preferences.filterResponsesByEnv, vault: unlockedVault, externalSecret: externalSecretResolver, readFile: templateFileReader, prompt: requestTemplatePrompt, authorizeOAuth2: authorizeOAuth2WithStatus }}
          responses={workspace.responses}
          showPasswords={workspace.preferences.showPasswords}
        /> : isRunnerDocument ? <section className="document-automation-panel">{renderDocumentTabStrip()}{renderAutomationWorkbench('runner', activeRunnerTarget)}</section> : <div className="workbench">
          <RequestPanel
            activeTab={requestTab}
            collection={runtimeCollection}
            documentTabStrip={renderDocumentTabStrip(<select aria-label="Request folder" className="request-folder-select" onChange={(event) => updateActiveRequest({ folderId: event.target.value })} value={runtimeActive.request.folderId ?? ''}><option value="">Collection root</option>{(runtimeCollection.folders ?? []).map((folder) => <option key={folder.id} value={folder.id}>{folderPath(runtimeCollection, folder.id)}</option>)}</select>)}
            environment={runtimeEnvironment}
            grpcSchema={grpcSchemas[runtimeActive.request.id]}
            graphqlSchemaError={graphqlSchemaError?.requestId === runtimeActive.request.id ? graphqlSchemaError.message : ''}
            graphqlSchemaLoading={graphqlSchemaLoading}
            grpcSchemaLoading={grpcSchemaLoading}
            isSending={isSending}
            onChange={updateActiveRequest}
            onCancelScheduled={cancelScheduledSends}
            onGenerateCode={() => setShowCodeGeneration(true)}
            onToggleBulkHeaderEditor={() => setWorkspace((current) => ({ ...current, preferences: { ...current.preferences, useBulkHeaderEditor: !current.preferences.useBulkHeaderEditor } }))}
            onToggleBulkParametersEditor={() => setWorkspace((current) => ({ ...current, preferences: { ...current.preferences, useBulkParametersEditor: !current.preferences.useBulkParametersEditor } }))}
            onLoadGraphqlSchema={(includeInputValueDeprecation) => void loadActiveGraphqlSchema(includeInputValueDeprecation)}
            onLoadGrpcSchema={() => void loadActiveGrpcSchema()}
            onOpenSendOptions={() => setShowSendOptions(true)}
            onSend={() => void executeRequest()}
            onSocketIoListenerToggle={(eventName, enabled) => void toggleSocketIoListener(eventName, enabled)}
            onTabChange={setRequestTab}
            request={runtimeActive.request}
            requestContext={{ cookies: [...activeRequestFileState.cookies], responses: [...workspace.responses], preferredHttpVersion: workspace.preferences.preferredHttpVersion, maxRedirects: workspace.preferences.maxRedirects, followRedirects: workspace.preferences.followRedirects, requestTimeoutMs: workspace.preferences.requestTimeoutMs, validateCertificates: workspace.preferences.validateCertificates, validateAuthCertificates: workspace.preferences.validateAuthCertificates, proxy: proxyPreferences, certificates: activeRequestFileState.certificates, maxTimelineDataSizeKB: workspace.preferences.maxTimelineDataSizeKB, filterResponsesByEnv: workspace.preferences.filterResponsesByEnv, vault: unlockedVault, externalSecret: externalSecretResolver, readFile: templateFileReader, prompt: requestTemplatePrompt, requestAncestors: requestAncestorNames(workspace.collections, runtimeActive.request), resolveResponse: templateResponseResolver.current, authorizeOAuth2: authorizeOAuth2WithStatus, pluginRuntime: createPersistentTemplatePluginRuntime(runtimeEnvironment) }}
            scheduledSendLabel={scheduledSendLabel}
            showPasswords={workspace.preferences.showPasswords}
            showVariableSourceAndValue={workspace.preferences.showVariableSourceAndValue}
            storedResponses={workspace.responses}
            streamStatus={streamStatus}
            templateVariableNames={Object.keys(environmentMap(codegenConfiguration.environment)).sort()}
            templateVariableValues={environmentMap(codegenConfiguration.environment)}
            methodInputRef={methodInputRef}
            graphqlFilterInputRef={graphqlFilterInputRef}
            urlInputRef={urlInputRef}
            workspaceCookies={activeRequestFileState.cookies}
            useBulkHeaderEditor={workspace.preferences.useBulkHeaderEditor}
            useBulkParametersEditor={workspace.preferences.useBulkParametersEditor}
          />
          <ResponsePanel
            activeTab={responseTab}
            activeEnvironmentHistoryCount={activeEnvironmentHistoryCount}
            activeEnvironmentStreamHistoryCount={activeEnvironmentStreamHistoryCount}
            allowHtmlPreviewRemoteResources={workspace.preferences.allowHtmlPreviewRemoteResources}
            allowHtmlPreviewScripts={workspace.preferences.allowHtmlPreviewScripts}
            disableResponsePreviewLinks={workspace.preferences.disableResponsePreviewLinks}
            cookies={activeRequestFileState.cookies}
            isSending={isSending}
            mockEnvironmentId={runtimeEnvironment.id}
            mockRequest={runtimeActive.request}
            mockServers={workspace.mockServers}
            mockSourceResponse={selectedResponseId ? activeResponseHistory.find((candidate) => candidate.id === selectedResponseId) : undefined}
            isMockServerRunning={(serverId) => Boolean(runningMocks[serverId])}
            onApplyResponseToMock={(result) => setWorkspace((current) => ({ ...current, mockServers: result.mockServers }))}
            onChangeCookies={(cookies) => setWorkspace((current) => setWorkspaceFileCookies(current, activeRequestFileId, cookies))}
            onClearHistory={clearActiveEnvironmentHistory}
            onClearStreamHistory={() => void clearActiveStreamHistory()}
            onDeleteResponse={deleteSelectedSavedResponse}
            onDeleteStreamSession={() => void deleteSelectedStreamSession()}
            onDownloadResponse={downloadResponseBody}
            onExportResponseDiagnostic={exportResponseDiagnostic}
            onOpenMock={(serverId, routeId) => openMockDocument(serverId, routeId)}
            onApplyResponseFilter={applyResponseFilter}
            onChangeResponsePreviewMode={changeResponsePreviewMode}
            onSelectResponse={(id) => { const saved = activeResponseHistory.find((candidate) => candidate.id === id); if (saved) selectSavedResponse(saved); }}
            onSelectStreamSession={(id) => void selectStreamSession(id)}
            onSendStreamMessage={() => void sendStreamMessage()}
            onStreamDraftChange={setStreamDraft}
            onStreamFrameKindChange={setStreamFrameKind}
            onTabChange={setResponseTab}
            protocol={runtimeActive.request.protocol}
            response={response}
            responseFilter={workspace.responseFilters?.[runtimeActive.request.id]?.filter ?? ''}
            responseFilterHistory={workspace.responseFilters?.[runtimeActive.request.id]?.history ?? []}
            responsePreviewMode={workspace.responseFilters?.[runtimeActive.request.id]?.previewMode ?? 'source'}
            responseHistory={activeResponseHistory}
            requestUrl={response.requestUrl ?? runtimeActive.request.url}
            selectedResponseId={selectedResponseId}
            selectedStreamSessionId={selectedStreamSessionId}
            scriptLogs={scriptLogs}
            scriptTests={scriptTests}
            streamDraft={streamDraft}
            streamFrameKind={streamFrameKind}
            streamHistory={activeStreamHistory}
            streamMessages={streamMessages}
            streamSession={streamSessionView}
            streamStatus={streamStatus}
            panelRef={responsePanelRef}
          />
        </div>) : workbenchSection === 'git' ? <Suspense fallback={<div className="dialog-loading">Loading Git project…</div>}><ProjectWorkbench environment={runtimeEnvironment} onChangeWorkspace={(updater) => setWorkspace(updater)} requestContext={{ cookies: [...activeWorkspaceFileState.cookies], preferredHttpVersion: workspace.preferences.preferredHttpVersion, maxRedirects: workspace.preferences.maxRedirects, followRedirects: workspace.preferences.followRedirects, requestTimeoutMs: workspace.preferences.requestTimeoutMs, validateCertificates: workspace.preferences.validateCertificates, validateAuthCertificates: workspace.preferences.validateAuthCertificates, proxy: proxyPreferences, certificates: activeWorkspaceFileState.certificates, maxTimelineDataSizeKB: workspace.preferences.maxTimelineDataSizeKB, filterResponsesByEnv: workspace.preferences.filterResponsesByEnv, vault: unlockedVault, externalSecret: externalSecretResolver, readFile: templateFileReader, prompt: requestTemplatePrompt, authorizeOAuth2: authorizeOAuth2WithStatus }} workspace={workspace} /></Suspense> : workbenchSection === 'plugins' ? <Suspense fallback={<div className="dialog-loading">Loading plugins…</div>}><PluginWorkbench key={pluginReloadGeneration} onChangeWorkspace={(updater) => setWorkspace(updater)} selectedDocumentId={activeDocumentTab?.requestId} selectedDocumentType={activeDocumentTab?.type} templatePrompt={requestTemplatePrompt} workspace={workspace} /></Suspense> : workbenchSection === 'security' ? <Suspense fallback={<div className="dialog-loading">Loading security…</div>}><SecurityWorkbench onChangeWorkspace={(updater) => setWorkspace(updater)} onVaultSession={updateVaultSession} vaultSession={vaultSession} workspace={workspace} workspaceFileId={activeWorkspaceFileId} workspaceId={activeWorkspaceId} /></Suspense> : workbenchSection === 'integrations' ? <Suspense fallback={<div className="dialog-loading">Loading integrations…</div>}><IntegrationWorkbench environment={runtimeEnvironment} onChangeWorkspace={(updater) => setWorkspace(updater)} onRefreshWorkspaceCatalog={(snapshot) => { setWorkspaceEntries(snapshot.entries); setWorkspaceRecovery(snapshot.recovery); }} onWorkspaceCatalogMutationEnd={() => setWorkspaceStoreBusy(false)} onWorkspaceCatalogMutationStart={() => { workspaceSaveGeneration.current += 1; setWorkspaceStoreBusy(true); setWorkspaceStoreError(''); }} requestContext={{ cookies: [...activeWorkspaceFileState.cookies], preferredHttpVersion: workspace.preferences.preferredHttpVersion, maxRedirects: workspace.preferences.maxRedirects, followRedirects: workspace.preferences.followRedirects, requestTimeoutMs: workspace.preferences.requestTimeoutMs, validateCertificates: workspace.preferences.validateCertificates, validateAuthCertificates: workspace.preferences.validateAuthCertificates, proxy: proxyPreferences, certificates: activeWorkspaceFileState.certificates, maxTimelineDataSizeKB: workspace.preferences.maxTimelineDataSizeKB, filterResponsesByEnv: workspace.preferences.filterResponsesByEnv, vault: unlockedVault, externalSecret: externalSecretResolver, readFile: templateFileReader, prompt: requestTemplatePrompt, authorizeOAuth2: authorizeOAuth2WithStatus }} workspace={workspace} workspaceCatalogBusy={workspaceStoreBusy} workspaceFileId={activeWorkspaceFileId} workspaceId={activeWorkspaceId} /></Suspense> : workbenchSection === 'preferences' ? <Suspense fallback={<div className="dialog-loading">Loading preferences…</div>}><PreferencesWorkbench initialTab={preferencesInitialTab} onChangeWorkspace={(updater) => setWorkspace(updater)} workspace={workspace} /></Suspense> : renderAutomationWorkbench(workbenchSection)}
      </div>

      <footer className="statusbar">
        <span><i /> Ready</span>
        <span className="status-spacer" />
        <span><i /> Environment: {runtimeEnvironment.name}</span>
        {projectSyncError ? <span className="bad">Project save failed: {projectSyncError}</span> : null}
        {environmentVaultSaveError ? <span className="bad">Secret vault save failed: {environmentVaultSaveError}</span> : null}
        {contextualPluginActionBusyKey ? <span>Plugin action running…</span> : null}
        {contextualPluginActionErrors.length ? <span className="bad" title={contextualPluginActionErrors.join('\n')}>Plugin actions unavailable: {contextualPluginActionErrors.length}</span> : null}
        <span>{vaultSession.unlocked ? `Vault: ${vaultSession.entries.length} unlocked` : 'Vault: locked'}</span>
        <span>Local-only</span>
        <span>UTF-8</span>
        <span>{workbenchSection === 'requests' ? isRequestDashboard ? 'Project' : activeCollectionDocument ? 'Collection' : activeDesignDocument ? 'API Design' : activeMockDocument?.route ? 'Mock Route' : activeMockDocument ? 'Mock Server' : activeTestSuiteDocument ? 'Test Suite' : isEnvironmentDocument ? 'Environment' : activeFolderDocument ? 'Folder' : isRunnerDocument ? 'Runner' : protocolLabel(runtimeActive.request) : titleCase(workbenchSection)}</span>
      </footer>

      {contextualPluginActionFeedback ? <div className={`contextual-plugin-feedback${contextualPluginActionFeedback.error ? ' error' : ''}`} role={contextualPluginActionFeedback.error ? 'alert' : 'status'}><span>{contextualPluginActionFeedback.message}</span><button aria-label="Dismiss plugin action result" onClick={() => setContextualPluginActionFeedback(undefined)} type="button"><Icon name="x" size={12} /></button></div> : null}

      {editingCollection && editingFolder ? <FolderDialog collection={editingCollection} cookies={getWorkspaceFileState(workspace, workspaceFileIdForCollection(workspace, editingCollection.id)).cookies} environment={runtimeEnvironment} folder={editingFolder} onChange={(folder) => updateFolder(editingCollection.id, folder)} onClose={() => setFolderEditor(undefined)} onDelete={() => deleteFolder(editingCollection.id, editingFolder.id)} onDuplicate={() => duplicateFolder(editingCollection.id, editingFolder.id)} requestContext={{ preferredHttpVersion: workspace.preferences.preferredHttpVersion, maxRedirects: workspace.preferences.maxRedirects, followRedirects: workspace.preferences.followRedirects, requestTimeoutMs: workspace.preferences.requestTimeoutMs, validateCertificates: workspace.preferences.validateCertificates, validateAuthCertificates: workspace.preferences.validateAuthCertificates, proxy: proxyPreferences, maxTimelineDataSizeKB: workspace.preferences.maxTimelineDataSizeKB, filterResponsesByEnv: workspace.preferences.filterResponsesByEnv, vault: unlockedVault, externalSecret: externalSecretResolver, readFile: templateFileReader, prompt: requestTemplatePrompt, authorizeOAuth2: authorizeOAuth2WithStatus }} responses={workspace.responses} showPasswords={workspace.preferences.showPasswords} /> : null}
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
      {oauthAuthorization ? <Suspense fallback={null}><OAuthAuthorizationDialog onCancel={() => void cancelActiveOAuthAuthorization()} status={oauthAuthorization} /></Suspense> : null}
      {templatePrompt ? <Suspense fallback={null}><TemplatePromptDialog input={templatePrompt.input} key={templatePrompt.id} onResolve={resolveTemplatePrompt} /></Suspense> : null}
      {showImport ? <Suspense fallback={<div className="modal-backdrop"><div className="dialog-loading">Loading import tools…</div></div>}><ImportDialog onApply={applyImport} onClose={() => setShowImport(false)} onFetchUrl={fetchImportUrl} /></Suspense> : null}
      {showExport ? <Suspense fallback={<div className="modal-backdrop"><div className="dialog-loading">Loading export tools…</div></div>}><ExportDialog onClose={() => setShowExport(false)} workspace={workspace} /></Suspense> : null}
      {showCodeGeneration ? <Suspense fallback={<div className="modal-backdrop"><div className="dialog-loading">Loading code generator…</div></div>}><CodeGenerationDialog generate={generateCode} onClose={() => setShowCodeGeneration(false)} request={codegenConfiguration.request} variables={environmentMap(codegenConfiguration.environment)} /></Suspense> : null}
      {showPalette ? <Suspense fallback={<div className="dialog-loading">Loading commands…</div>}><CommandPalette onAddCollection={addCollection} onAddRequest={addRequest} onClose={() => setShowPalette(false)} onDesign={() => openDesignDocument()} onEnvironment={openEnvironmentDocument} onExport={() => setShowExport(true)} onImport={() => setShowImport(true)} onMocks={() => openMockDocument()} onPreferences={() => { setPreferencesInitialTab('general'); setWorkbenchSection('preferences'); }} onRunner={() => openRunnerDocument()} onUnitTests={() => openTestSuiteDocument()} /></Suspense> : null}
      {showCreateMenu ? <Suspense fallback={<div className="dialog-loading">Loading create menu…</div>}><CreateMenu onAddCollection={addCollection} onAddFolder={active ? () => addFolder(active.collectionId, active.request.folderId ?? '') : undefined} onAddRequest={addRequest} onClose={() => setShowCreateMenu(false)} /></Suspense> : null}
    </main>
  );
}
