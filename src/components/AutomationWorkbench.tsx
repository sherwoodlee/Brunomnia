import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { createBlankRequest } from '../data/seed';
import type {
  ApiDesign,
  ApiRequest,
  Collection,
  Environment,
  MockRoute,
  MockServer,
  RunnerItemResult,
  RunnerLiveItem,
  Workspace,
  WorkbenchSection,
} from '../types';
import { analyzeOpenApi, formatOpenApi, generateCollectionFromOpenApi } from '../lib/openapi';
import { aggregateRunnerTimeline, discardRunnerReport, parseRunnerData, resolveRunnerTarget, runnerResultForLiveItem, runCollection, runnerReportsForTarget, type RunnerWorkbenchDraft } from '../lib/runner';
import { createRunnerReportArtifact, type RunnerReporter } from '../lib/runnerReport';
import { summarizeRunnerAssertions, summarizeRunnerHistory } from '../lib/runnerHistory';
import { isRunnerItemFinished, summarizeRunnerLiveProgress } from '../lib/runnerFeedback';
import type { ScriptTestFilter } from '../lib/scriptTests';
import { formatResponseTimeline } from '../lib/timeline';
import { applyCollectionConfiguration, persistEffectiveAuthentication, requestAncestorNames, resolveEnvironment, scriptEnvironmentScopes } from '../lib/resources';
import { applyScriptSubresponse, runBrowserScript } from '../lib/scriptSandbox';
import { readDesktopScriptFile, readDesktopTemplateFile } from '../lib/scriptFiles';
import { storeResponseCookies } from '../lib/cookies';
import { sendRequest as sendHttpRequest, type SendRequestContext } from '../lib/http';
import { createPluginRuntime, type PluginHostCallbacks, type PluginRunState } from '../lib/plugins';
import { startMockServer, stopMockServer, updateMockServer, type RunningMock } from '../lib/mock';
import { isStreamingRequest, runStreamSample } from '../lib/protocol';
import { resolveAuthorizedExternalSecret } from '../lib/security';
import { generateMockWithAi } from '../lib/ai';
import { buildMockAiContext, buildMockSpecUrlContext, composeMockAiInput, findActiveRequest, findLatestResponseForActiveRequest, validateMockSpecUrl, type MockAiContext, type MockAiContextSource } from '../lib/mockAiContext';
import { createMockRouteFromResponse, overwriteMockRouteFromResponse } from '../lib/mockRouteFromResponse';
import { createRequestSnapshot, retainResponseHistory } from '../lib/responseHistory';
import { Icon } from './Icon';
import { OAuthAuthorizationDialog, type OAuthAuthorizationStatus } from './OAuthAuthorizationDialog';
import { CodeEditor } from './ProtocolEditors';
import { RunnerDataDialog } from './RunnerDataDialog';
import { RunnerCliDialog } from './RunnerCliDialog';
import { RunnerAttemptCard } from './RunnerAttemptCard';

const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

type AutomationWorkbenchProps = {
  section: Exclude<WorkbenchSection, 'requests' | 'git' | 'plugins' | 'security' | 'integrations'>;
  workspace: Workspace;
  workspaceId: string;
  activeEnvironment: Environment;
  vault: Record<string, string>;
  onChangeWorkspace: (updater: (workspace: Workspace) => Workspace) => void;
  onOpenCollection: (collection: Collection) => void;
  runningMocks: Record<string, RunningMock>;
  mockTarget?: { serverId: string; routeId?: string };
  onMockChange?: () => void;
  onOpenMock?: (serverId: string, routeId?: string) => void;
  onStartMock: (serverId: string, runningMock: RunningMock) => void;
  onStopMock: (serverId: string) => void;
  templatePrompt: SendRequestContext['prompt'];
  designTargetId?: string;
  onDesignChange?: () => void;
  onOpenDesign?: (designId: string) => void;
  runnerTarget?: { collectionId: string; folderId?: string };
  onRunnerStart?: () => void;
  runnerDraft?: RunnerWorkbenchDraft;
  runnerDraftKey?: string;
  onRunnerDraftChange?: (key: string, draft: RunnerWorkbenchDraft) => void;
};

const workspaceProxyPreferences = (workspace: Workspace) => ({
  enabled: workspace.preferences.proxyEnabled,
  httpProxy: workspace.preferences.httpProxy,
  httpsProxy: workspace.preferences.httpsProxy,
  noProxy: workspace.preferences.noProxy,
});

export function AutomationWorkbench(props: AutomationWorkbenchProps) {
  if (props.section === 'design') return <DesignWorkbench key={props.designTargetId} {...props} />;
  if (props.section === 'runner') return <RunnerWorkbench key={props.runnerDraftKey} {...props} />;
  return <MockWorkbench {...props} />;
}

function DesignWorkbench({ workspace, onChangeWorkspace, onOpenCollection, designTargetId, onDesignChange, onOpenDesign }: AutomationWorkbenchProps) {
  const [message, setMessage] = useState('');
  const [editorMode, setEditorMode] = useState<'document' | 'ruleset'>('document');
  const design = workspace.apiDesigns.find((candidate) => candidate.id === designTargetId) ?? workspace.apiDesigns[0];
  const deferredContents = useDeferredValue(design?.contents ?? '');
  const analysis = useMemo(() => analyzeOpenApi(deferredContents, design?.ruleset), [deferredContents, design?.ruleset]);

  const updateDesign = (patch: Partial<ApiDesign>) => {
    if (!design) return;
    onDesignChange?.();
    onChangeWorkspace((current) => ({ ...current, apiDesigns: current.apiDesigns.map((candidate) => candidate.id === design.id ? { ...candidate, ...patch } : candidate) }));
  };

  const generate = () => {
    if (!design) return;
    onDesignChange?.();
    try {
      const collection = generateCollectionFromOpenApi(design);
      const id = design.generatedCollectionId ?? collection.id;
      const generated = { ...collection, id };
      onChangeWorkspace((current) => ({
        ...current,
        activeRequestId: generated.requests[0]?.id ?? current.activeRequestId,
        collections: current.collections.some((candidate) => candidate.id === id)
          ? current.collections.map((candidate) => candidate.id === id ? generated : candidate)
          : [...current.collections, generated],
        apiDesigns: current.apiDesigns.map((candidate) => candidate.id === design.id ? { ...candidate, generatedCollectionId: id } : candidate),
      }));
      setMessage(`${generated.requests.length} requests generated from ${analysis.title}.`);
      onOpenCollection(generated);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  };

  if (!design) return <AutomationEmpty title="No API designs" action="Create design" onAction={() => {
    const created = { id: uid('design'), name: 'Untitled API', contents: 'openapi: 3.1.0\ninfo:\n  title: Untitled API\n  version: 1.0.0\npaths: {}\n', ruleset: '' };
    onChangeWorkspace((current) => ({ ...current, apiDesigns: [...current.apiDesigns, created] }));
    onOpenDesign?.(created.id);
  }} />;

  const errors = analysis.issues.filter((issue) => issue.severity === 'error').length;
  const warnings = analysis.issues.length - errors;
  return (
    <section className="automation-workbench design-workbench">
      <AutomationHeader eyebrow="Design" title="API design document" subtitle="Edit, lint, preview, and turn OpenAPI operations into runnable requests.">
        <select aria-label="API design" value={design.id} onChange={(event) => onOpenDesign?.(event.target.value)}>{workspace.apiDesigns.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
        <button className="secondary-action" onClick={() => { try { updateDesign({ contents: formatOpenApi(design.contents) }); setMessage('Document formatted.'); } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); } }} type="button">Format</button>
        <button className="secondary-action" onClick={() => setEditorMode((current) => current === 'document' ? 'ruleset' : 'document')} type="button">{editorMode === 'document' ? 'Custom rules' : 'API document'}</button>
        <button className="primary-action" disabled={errors > 0} onClick={generate} type="button">Generate requests</button>
      </AutomationHeader>
      <div className="design-grid">
        <div className="design-editor-pane">
          <div className="pane-title"><input aria-label="Design name" value={design.name} onChange={(event) => updateDesign({ name: event.target.value })} /><span>{editorMode === 'document' ? 'OpenAPI YAML / JSON' : 'Spectral-style YAML / JSON'}</span></div>
          {editorMode === 'document' ? <CodeEditor ariaLabel="OpenAPI document" value={design.contents} onChange={(contents) => updateDesign({ contents })} /> : <CodeEditor ariaLabel="Custom lint ruleset" value={design.ruleset ?? ''} onChange={(ruleset) => updateDesign({ ruleset })} />}
        </div>
        <div className="design-preview-pane">
          <div className="api-hero"><small>OpenAPI {String(analysis.document?.openapi ?? '')}</small><h2>{analysis.title}</h2><p>{String((analysis.document?.info as Record<string, unknown> | undefined)?.description ?? 'No description provided.')}</p><span>Version {analysis.version || '—'}</span></div>
          <div className="operation-list">
            {analysis.operations.map((operation) => <article key={`${operation.method}-${operation.path}`}><span className={`method method-${operation.method.toLowerCase()}`}>{operation.method}</span><div><strong>{operation.path}</strong><small>{operation.summary}</small></div></article>)}
            {!analysis.operations.length ? <div className="empty-state compact"><Icon name="braces" size={26} /><strong>No operations yet</strong></div> : null}
          </div>
        </div>
        <aside className="lint-pane">
          <header><strong>Lint results</strong><span className={errors ? 'bad' : 'ok'}>{errors} errors · {warnings} warnings</span></header>
          <div>{analysis.issues.map((issue, index) => <article className={issue.severity} key={`${issue.path}-${index}`}><span>{issue.severity}</span><strong>{issue.path}</strong><p>{issue.message}</p></article>)}{!analysis.issues.length ? <div className="lint-clean"><Icon name="spark" size={23} /><strong>Document is clean</strong><span>{analysis.operations.length} operations are ready.</span></div> : null}</div>
        </aside>
      </div>
      {message ? <div className="automation-message" role="status">{message}</div> : null}
    </section>
  );
}

function RunnerWorkbench({ workspace, workspaceId, activeEnvironment, vault, onChangeWorkspace, templatePrompt, runnerTarget, onRunnerStart, runnerDraft, runnerDraftKey, onRunnerDraftChange }: AutomationWorkbenchProps) {
  const sendRequest = (...[request, environment, context]: Parameters<typeof sendHttpRequest>) => sendHttpRequest(request, environment, {
    certificates: workspace.certificates,
    prompt: templatePrompt,
    readFile: workspace.preferences.allowScriptFileAccess && isTauri()
      ? (path) => readDesktopTemplateFile(path, workspace.preferences.dataFolders)
      : undefined,
    requestAncestors: requestAncestorNames(workspace.collections, request),
    ...context,
  });
  const initialTarget = resolveRunnerTarget(workspace, { collectionId: runnerTarget?.collectionId ?? runnerDraft?.collectionId, folderId: runnerTarget?.folderId });
  const initialCollection = initialTarget.collection;
  const targetFolderId = runnerTarget?.folderId ?? '';
  const [collectionId, setCollectionId] = useState(initialCollection?.id ?? '');
  const [environmentId, setEnvironmentId] = useState(workspace.environments.some((environment) => environment.id === runnerDraft?.environmentId) ? runnerDraft!.environmentId : activeEnvironment.id);
  const [iterations, setIterations] = useState(runnerDraft?.iterations ?? 1);
  const [retries, setRetries] = useState(runnerDraft?.retries ?? 0);
  const [bail, setBail] = useState(runnerDraft?.bail ?? true);
  const [keepLog, setKeepLog] = useState(runnerDraft?.keepLog ?? true);
  const [delayMs, setDelayMs] = useState(runnerDraft?.delayMs ?? 0);
  const [streamWindowMs, setStreamWindowMs] = useState(runnerDraft?.streamWindowMs ?? 1000);
  const [data, setData] = useState(runnerDraft?.data ?? '');
  const [dataFileName, setDataFileName] = useState(runnerDraft?.dataFileName ?? '');
  const [dataFileEncoding, setDataFileEncoding] = useState(runnerDraft?.dataFileEncoding ?? 'utf-8');
  const [dataFileBytesBase64, setDataFileBytesBase64] = useState(runnerDraft?.dataFileBytesBase64 ?? '');
  const [showDataDialog, setShowDataDialog] = useState(false);
  const [showCliDialog, setShowCliDialog] = useState(false);
  const [running, setRunning] = useState(false);
  const [canceledRun, setCanceledRun] = useState(false);
  const [results, setResults] = useState<RunnerItemResult[]>([]);
  const [liveItems, setLiveItems] = useState<RunnerLiveItem[]>([]);
  const [selectedReportId, setSelectedReportId] = useState('');
  const [resultPane, setResultPane] = useState<'results' | 'history' | 'console'>('results');
  const [resultStatusFilter, setResultStatusFilter] = useState<ScriptTestFilter>('all');
  const [resultNameFilter, setResultNameFilter] = useState('');
  const [error, setError] = useState('');
  const [oauthAuthorization, setOAuthAuthorization] = useState<OAuthAuthorizationStatus>();
  const [requestPlan, setRequestPlan] = useState<Array<{ id: string; enabled: boolean }>>(() => runnerDraft?.requestPlan ?? initialTarget.requests.map((request) => ({ id: request.id, enabled: true })));
  const cancelled = useRef(false);
  const skippedKeys = useRef(new Set<string>());
  const activeItem = useRef<{ key: string; cancel: () => void; signal: AbortSignal } | undefined>(undefined);
  const oauthFlowId = useRef('');
  const draggedRequestId = useRef('');
  const resolvedTarget = useMemo(() => resolveRunnerTarget(workspace, { collectionId, folderId: targetFolderId }), [collectionId, targetFolderId, workspace]);
  const { collection, folder: targetFolder, requests: runnerRequests } = resolvedTarget;
  const selectedEnvironment = workspace.environments.find((candidate) => candidate.id === environmentId) ?? activeEnvironment;
  const environment = resolveEnvironment(workspace.environments, selectedEnvironment.id) ?? selectedEnvironment;
  const selectedRequestIds = requestPlan.filter((item) => item.enabled).map((item) => item.id);

  useEffect(() => {
    if (!runnerDraftKey || !onRunnerDraftChange) return;
    onRunnerDraftChange(runnerDraftKey, { collectionId, environmentId, iterations, retries, bail, keepLog, delayMs, streamWindowMs, data, dataFileName, dataFileEncoding, dataFileBytesBase64, requestPlan });
  }, [bail, collectionId, data, dataFileBytesBase64, dataFileEncoding, dataFileName, delayMs, environmentId, iterations, keepLog, onRunnerDraftChange, requestPlan, retries, runnerDraftKey, streamWindowMs]);

  const cancelRunnerOAuthAuthorization = async () => {
    const flowId = oauthFlowId.current;
    if (!flowId) return;
    oauthFlowId.current = '';
    setOAuthAuthorization(undefined);
    try {
      const { cancelOAuth2Authorization } = await import('../lib/oauth2');
      await cancelOAuth2Authorization(flowId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  };

  const skipItem = (key: string) => {
    skippedKeys.current.add(key);
    if (activeItem.current?.key === key) activeItem.current.cancel();
    setLiveItems((current) => current.map((item) => item.key === key && !isRunnerItemFinished(item.status) ? { ...item, status: 'skipped', errorMessage: 'Skipped by user.' } : item));
  };
  const cancelRun = () => {
    cancelled.current = true;
    setCanceledRun(true);
    activeItem.current?.cancel();
    setLiveItems((current) => current.map((item) => isRunnerItemFinished(item.status) ? item : { ...item, status: 'canceled', errorMessage: 'Canceled by user.' }));
    void cancelRunnerOAuthAuthorization();
  };

  useEffect(() => () => {
    const flowId = oauthFlowId.current;
    oauthFlowId.current = '';
    if (flowId) void import('../lib/oauth2').then(({ cancelOAuth2Authorization }) => cancelOAuth2Authorization(flowId)).catch(() => undefined);
  }, []);
  const scopedReports = useMemo(() => runnerReportsForTarget(workspace.runnerReports, collection?.id ?? '', targetFolderId), [collection?.id, targetFolderId, workspace.runnerReports]);
  const selectedReport = scopedReports.find((report) => report.id === selectedReportId);
  const displayedReport = selectedReport ?? scopedReports[0];

  useEffect(() => {
    const ids = new Set(runnerRequests.map((request) => request.id));
    setRequestPlan((current) => {
      const retained = current.filter((item) => ids.has(item.id));
      const retainedIds = new Set(retained.map((item) => item.id));
      const added = runnerRequests.filter((request) => !retainedIds.has(request.id)).map((request) => ({ id: request.id, enabled: true }));
      return [...retained, ...added];
    });
  }, [runnerRequests]);

  const moveRequest = (id: string, offset: number) => setRequestPlan((current) => {
    const from = current.findIndex((item) => item.id === id);
    const to = Math.max(0, Math.min(current.length - 1, from + offset));
    if (from < 0 || from === to) return current;
    const next = [...current];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    return next;
  });

  const dropRequest = (targetId: string) => setRequestPlan((current) => {
    const from = current.findIndex((item) => item.id === draggedRequestId.current);
    const to = current.findIndex((item) => item.id === targetId);
    draggedRequestId.current = '';
    if (from < 0 || to < 0 || from === to) return current;
    const next = [...current];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    return next;
  });

  const downloadReport = (reporter: Extract<RunnerReporter, 'json' | 'junit'>) => {
    if (!displayedReport) return;
    const artifact = createRunnerReportArtifact(displayedReport, reporter);
    const url = URL.createObjectURL(new Blob([artifact.contents], { type: artifact.mimeType }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = artifact.fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const openReport = (reportId: string) => {
    setCanceledRun(false);
    setSelectedReportId(reportId);
    setResultPane('results');
  };

  const deleteReport = (reportId: string) => {
    setSelectedReportId((current) => current === reportId ? '' : current);
    onChangeWorkspace((current) => ({ ...current, runnerReports: discardRunnerReport(current.runnerReports, reportId) }));
  };

  const start = async () => {
    if (!collection || running) return;
    onRunnerStart?.();
    const requestIds = selectedRequestIds;
    if (!requestIds.length) { setError('Select at least one request for this run.'); return; }
    setRunning(true); setCanceledRun(false); setResults([]); setLiveItems([]); setSelectedReportId(''); setError(''); cancelled.current = false; skippedKeys.current.clear(); activeItem.current = undefined;
    try {
      let runnerCookies = [...workspace.cookies];
      let runnerResponses = [...workspace.responses];
      let activeRunnerSignal: AbortSignal | undefined;
      const authorizeOAuth2 = async (request: ApiRequest, requestEnvironment: Environment | undefined): Promise<ApiRequest['auth']> => {
        if (!requestEnvironment) throw new Error('OAuth 2 browser authorization requires an active runner environment.');
        if (!isTauri()) throw new Error('Interactive OAuth 2 runner authorization requires the Tauri app.');
        const oauth2 = await import('../lib/oauth2');
        const flowId = oauth2.createOAuth2FlowId();
        oauthFlowId.current = flowId;
        const prepared = await oauth2.prepareOAuth2Authorization(request, Object.fromEntries(requestEnvironment.variables.filter((variable) => variable.enabled).map((variable) => [variable.name, variable.value])), flowId);
        setOAuthAuthorization({ flowId, requestName: request.name, authorizationUrl: prepared.authorizationUrl, redirectUrl: prepared.redirectUrl });
        try {
          const completed = await oauth2.completeOAuth2Authorization(prepared, requestEnvironment, {
            cookies: runnerCookies,
            responses: runnerResponses,
            preferredHttpVersion: workspace.preferences.preferredHttpVersion,
            maxRedirects: workspace.preferences.maxRedirects,
            followRedirects: workspace.preferences.followRedirects,
            requestTimeoutMs: workspace.preferences.requestTimeoutMs,
            validateCertificates: workspace.preferences.validateCertificates,
            validateAuthCertificates: workspace.preferences.validateAuthCertificates,
            proxy: workspaceProxyPreferences(workspace),
            certificates: workspace.certificates,
            maxTimelineDataSizeKB: workspace.preferences.maxTimelineDataSizeKB,
            filterResponsesByEnv: workspace.preferences.filterResponsesByEnv,
            vault,
            externalSecret: (input) => resolveAuthorizedExternalSecret(workspace, input),
          }, (event) => {
            if (oauthFlowId.current === flowId) setOAuthAuthorization({ flowId, requestName: request.name, authorizationUrl: event.authorizationUrl, redirectUrl: event.redirectUrl });
          });
          return completed.auth;
        } finally {
          if (oauthFlowId.current === flowId) {
            oauthFlowId.current = '';
            setOAuthAuthorization(undefined);
          }
        }
      };
      let resolveResponse: NonNullable<SendRequestContext['resolveResponse']>;
      resolveResponse = async ({ requestId, requestChain, cookies, responses }) => {
        const dependencyCollection = workspace.collections.find((candidate) => candidate.requests.some((request) => request.id === requestId || request.name === requestId));
        const dependency = dependencyCollection?.requests.find((request) => request.id === requestId || request.name === requestId);
        if (!dependencyCollection || !dependency) throw new Error(`Could not find request ${requestId}`);
        const configured = applyCollectionConfiguration(dependencyCollection, dependency, environment);
        const result = await sendRequest(configured.request, configured.environment, {
          cookies,
          responses,
          preferredHttpVersion: workspace.preferences.preferredHttpVersion,
          maxRedirects: workspace.preferences.maxRedirects,
          followRedirects: workspace.preferences.followRedirects,
          requestTimeoutMs: workspace.preferences.requestTimeoutMs,
          validateCertificates: workspace.preferences.validateCertificates,
          validateAuthCertificates: workspace.preferences.validateAuthCertificates,
          proxy: workspaceProxyPreferences(workspace),
          maxTimelineDataSizeKB: workspace.preferences.maxTimelineDataSizeKB,
          filterResponsesByEnv: workspace.preferences.filterResponsesByEnv,
          vault,
          externalSecret: (input) => resolveAuthorizedExternalSecret(workspace, input),
          authorizeOAuth2,
          requestChain: [...new Set([...requestChain, dependency.id])],
          resolveResponse,
          signal: activeRunnerSignal,
        });
        const requestUrl = result.requestUrl ?? configured.request.url;
        if (configured.request.transport.storeCookies) {
          const updatedCookies = storeResponseCookies(cookies, requestUrl, result.setCookies ?? []);
          cookies.splice(0, cookies.length, ...updatedCookies);
        }
        const stored = {
          ...result,
          id: uid('response'),
          requestId: dependency.id,
          requestName: dependency.name,
          requestUrl,
          environmentId: configured.environment.id,
          globalEnvironmentId: selectedEnvironment.id,
          collectionEnvironmentId: dependencyCollection.activeSubEnvironmentId ?? '',
          receivedAt: new Date().toISOString(),
          requestSnapshot: createRequestSnapshot(dependency),
          requestTestResults: [],
          settingSendCookies: configured.request.transport.sendCookies,
          settingStoreCookies: configured.request.transport.storeCookies,
        };
        const updatedResponses = retainResponseHistory(responses, stored, workspace.preferences.maxHistoryResponses, workspace.preferences.filterResponsesByEnv);
        responses.splice(0, responses.length, ...updatedResponses);
        runnerCookies = cookies;
        runnerResponses = responses;
        return stored;
      };
      const pluginState: PluginRunState = { data: structuredClone(workspace.pluginData), notifications: [] };
      const pluginCallbacks: PluginHostCallbacks = {
        network: (pluginRequest) => sendRequest(pluginRequest, environment, { cookies: runnerCookies, responses: runnerResponses, preferredHttpVersion: workspace.preferences.preferredHttpVersion, maxRedirects: workspace.preferences.maxRedirects, followRedirects: workspace.preferences.followRedirects, requestTimeoutMs: workspace.preferences.requestTimeoutMs, validateCertificates: workspace.preferences.validateCertificates, validateAuthCertificates: workspace.preferences.validateAuthCertificates, proxy: workspaceProxyPreferences(workspace), maxTimelineDataSizeKB: workspace.preferences.maxTimelineDataSizeKB, filterResponsesByEnv: workspace.preferences.filterResponsesByEnv, authorizeOAuth2, resolveResponse, signal: activeRunnerSignal }),
        prompt: async (title, defaultValue) => window.prompt(title, defaultValue) ?? '',
        readClipboard: () => navigator.clipboard.readText(),
        writeClipboard: (value) => navigator.clipboard.writeText(value),
      };
      const pluginRuntime = createPluginRuntime(workspace.plugins, pluginState, pluginCallbacks);
      let latestRunnerResponseId = '';
      const report = await runCollection(collection, environment, {
        iterations, retries, bail, keepLog, requestIds, sourceName: targetFolder ? `${collection.name} / ${targetFolder.name}` : collection.name, folderId: targetFolderId || undefined, delayMs, scriptTimeoutMs: workspace.preferences.scriptTimeoutMs, environmentScopes: scriptEnvironmentScopes(workspace.environments, selectedEnvironment.id), dataRows: parseRunnerData(data), shouldCancel: () => cancelled.current, shouldSkip: (key) => skippedKeys.current.has(key),
        onLiveItems: setLiveItems,
        onActiveItem: (key, cancel, signal) => {
          activeRunnerSignal = signal;
          activeItem.current = key && cancel && signal ? { key, cancel, signal } : undefined;
          if (!key) latestRunnerResponseId = '';
        },
        onResult: (result) => {
          if (latestRunnerResponseId) {
            const requestTestResults = result.tests.slice(0, 1_000).map((test) => ({ ...test, name: test.name.slice(0, 2_000), ...(test.error ? { error: test.error.slice(0, 20_000) } : {}) }));
            runnerResponses = runnerResponses.map((response) => response.id === latestRunnerResponseId ? { ...response, requestTestResults } : response);
            latestRunnerResponseId = '';
          }
          setResults((current) => [...current, result]);
        },
      }, async (request, variables, execution) => {
        latestRunnerResponseId = '';
        const requestEnvironment = {
          id: environment.id, name: environment.name,
          variables: Object.entries(variables).map(([name, value]) => ({ id: `runner-${name}`, name, value, enabled: true })),
        };
        const result = isStreamingRequest(request)
          ? await runStreamSample(request, requestEnvironment, streamWindowMs, workspace.preferences.preferredHttpVersion, workspace.preferences.maxRedirects, workspace.preferences.followRedirects, workspace.preferences.requestTimeoutMs, workspace.preferences.validateCertificates, workspaceProxyPreferences(workspace), runnerCookies, workspace.certificates, {
            cookies: runnerCookies,
            responses: runnerResponses,
            filterResponsesByEnv: workspace.preferences.filterResponsesByEnv,
            vault,
            externalSecret: (input) => resolveAuthorizedExternalSecret(workspace, input),
            readFile: workspace.preferences.allowScriptFileAccess && isTauri()
              ? (path) => readDesktopTemplateFile(path, workspace.preferences.dataFolders)
              : undefined,
            requestAncestors: requestAncestorNames(workspace.collections, request),
            prompt: templatePrompt,
            resolveResponse,
            pluginRuntime,
          }, execution.signal)
          : await sendRequest(request, requestEnvironment, { cookies: runnerCookies, responses: runnerResponses, preferredHttpVersion: workspace.preferences.preferredHttpVersion, maxRedirects: workspace.preferences.maxRedirects, followRedirects: workspace.preferences.followRedirects, requestTimeoutMs: workspace.preferences.requestTimeoutMs, validateCertificates: workspace.preferences.validateCertificates, validateAuthCertificates: workspace.preferences.validateAuthCertificates, proxy: workspaceProxyPreferences(workspace), maxTimelineDataSizeKB: workspace.preferences.maxTimelineDataSizeKB, filterResponsesByEnv: workspace.preferences.filterResponsesByEnv, pluginRuntime, vault, externalSecret: (input) => resolveAuthorizedExternalSecret(workspace, input), authorizeOAuth2, resolveResponse, signal: execution.signal, cancellationId: `${execution.key}-${execution.attempt}`, onOAuth2Token: (updated) => onChangeWorkspace((current) => ({ ...current, collections: current.collections.map((candidate) => candidate.id === collection.id ? persistEffectiveAuthentication(candidate, request.id, updated.auth) : candidate) })) });
        const requestUrl = result.requestUrl ?? request.url;
        if (request.transport.storeCookies) runnerCookies = storeResponseCookies(runnerCookies, requestUrl, result.setCookies ?? []);
        const stored = {
          ...result,
          id: uid('response'),
          requestId: request.id,
          requestName: request.name,
          requestUrl,
          environmentId: environment.id,
          globalEnvironmentId: selectedEnvironment.id,
          collectionEnvironmentId: collection.activeSubEnvironmentId ?? '',
          receivedAt: new Date().toISOString(),
          requestSnapshot: createRequestSnapshot(request),
          requestTestResults: [],
          settingSendCookies: request.transport.sendCookies,
          settingStoreCookies: request.transport.storeCookies,
        };
        runnerResponses = retainResponseHistory(runnerResponses, stored, workspace.preferences.maxHistoryResponses, workspace.preferences.filterResponsesByEnv);
        latestRunnerResponseId = stored.id;
        return result;
      }, (source, request, variables, response, timeoutMs, localVariables, iterationData, scriptOptions) => runBrowserScript(source, request, variables, response, timeoutMs, localVariables, iterationData, {
        ...scriptOptions,
        readFile: workspace.preferences.allowScriptFileAccess
          ? (path) => readDesktopScriptFile(path, workspace.preferences.dataFolders)
          : undefined,
        vault: workspace.preferences.enableVaultInScripts ? vault : undefined,
        sendRequest: workspace.preferences.allowScriptRequests ? async (subrequest, subrequestVariables) => {
          const subresponse = await sendRequest(subrequest, {
            ...environment,
            variables: Object.entries(subrequestVariables).map(([name, value]) => ({ id: `runner-script-${name}`, name, value, enabled: true })),
          }, {
            cookies: runnerCookies,
            responses: runnerResponses,
            preferredHttpVersion: workspace.preferences.preferredHttpVersion,
            maxRedirects: workspace.preferences.maxRedirects,
            followRedirects: workspace.preferences.followRedirects,
            requestTimeoutMs: workspace.preferences.requestTimeoutMs,
            validateCertificates: workspace.preferences.validateCertificates,
            validateAuthCertificates: workspace.preferences.validateAuthCertificates,
            proxy: workspaceProxyPreferences(workspace),
            maxTimelineDataSizeKB: workspace.preferences.maxTimelineDataSizeKB,
            filterResponsesByEnv: workspace.preferences.filterResponsesByEnv,
            vault: workspace.preferences.enableVaultInScripts ? vault : {},
            authorizeOAuth2,
            resolveResponse,
            signal: activeRunnerSignal,
          });
          const state = applyScriptSubresponse(runnerCookies, runnerResponses, subrequest, subresponse, undefined, environment.id, workspace.preferences.maxHistoryResponses, workspace.preferences.filterResponsesByEnv, selectedEnvironment.id, collection.activeSubEnvironmentId ?? '');
          runnerCookies = state.cookies;
          runnerResponses = state.responses;
          return subresponse;
        } : undefined,
      }));
      setLiveItems(report.liveItems ?? []);
      if (report.flowError) setError(report.flowError);
      onChangeWorkspace((current) => ({ ...current, cookies: runnerCookies, responses: runnerResponses, pluginData: pluginState.data, runnerReports: [report, ...current.runnerReports].slice(0, 30) }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      activeItem.current = undefined;
      setRunning(false);
    }
  };

  const usesCurrentRun = running || canceledRun;
  const visibleResults = selectedReport ? selectedReport.results : usesCurrentRun ? results : results.length ? results : displayedReport?.results ?? [];
  const visibleLiveItems = selectedReport?.liveItems?.length ? selectedReport.liveItems : usesCurrentRun ? liveItems : !selectedReport && liveItems.length ? liveItems : displayedReport?.liveItems?.length ? displayedReport.liveItems : visibleResults.map((result): RunnerLiveItem => ({
    key: result.key ?? result.id,
    iteration: result.iteration,
    requestId: result.requestId,
    requestName: result.requestName,
    requestUrl: result.request?.url ?? '',
    status: result.passed ? 'completed' : 'failed',
    attempt: result.attempt,
    statusCode: result.status,
    statusMessage: result.response?.statusText,
    responseTime: result.durationMs,
    responseSize: result.response?.sizeBytes,
    errorMessage: result.error,
    tests: result.tests,
  }));
  const liveCount = (status: RunnerLiveItem['status']) => visibleLiveItems.filter((item) => item.status === status).length;
  const finishedCount = liveCount('completed') + liveCount('failed');
  const showLiveProgress = usesCurrentRun;
  const liveProgress = summarizeRunnerLiveProgress(visibleLiveItems, running);
  const resultAssertions = running ? { total: 0, passed: 0, failed: 0, skipped: 0, tone: 'neutral' as const } : summarizeRunnerAssertions(visibleResults);
  const visibleReportSummary = !usesCurrentRun && displayedReport ? summarizeRunnerHistory(displayedReport) : undefined;
  const resultForItem = (item: RunnerLiveItem) => runnerResultForLiveItem(item, visibleResults);
  const visibleLiveItemGroups = [...visibleLiveItems.reduce<Map<number, RunnerLiveItem[]>>((groups, item) => {
    const iterationItems = groups.get(item.iteration);
    if (iterationItems) iterationItems.push(item);
    else groups.set(item.iteration, [item]);
    return groups;
  }, new Map())].map(([iteration, items]) => ({ iteration, items }));
  const consoleTimeline = aggregateRunnerTimeline(visibleResults, usesCurrentRun || results.length && !selectedReport ? undefined : displayedReport?.flowError);
  const consoleText = formatResponseTimeline(consoleTimeline);
  const consoleTruncated = visibleResults.some((result) => result.timeline?.truncated);
  const visibleKeepLog = usesCurrentRun ? keepLog : displayedReport?.keepLog ?? keepLog;
  return (
    <section className="automation-workbench runner-workbench">
      <AutomationHeader eyebrow="Test" title={targetFolder ? `Runner · ${targetFolder.name}` : 'Collection runner'} subtitle="Run requests in order with iteration data, scripts, assertions, delays, and retries.">
        {!running ? <button className="secondary-action" disabled={!collection || !selectedRequestIds.length} onClick={() => setShowCliDialog(true)} type="button">Run via CLI</button> : null}
        {displayedReport && !running ? <button className="secondary-action" onClick={() => downloadReport('json')} type="button">Export JSON</button> : null}
        {displayedReport && !running ? <button className="secondary-action" onClick={() => downloadReport('junit')} type="button">Export JUnit</button> : null}
        {!running ? <button className="primary-action" disabled={!collection} onClick={() => void start()} type="button">{targetFolder ? 'Run folder' : 'Run collection'}</button> : null}
      </AutomationHeader>
      <div className="runner-grid">
        <aside className="runner-config">
          <label>Collection<select aria-label="Runner collection" disabled={Boolean(runnerTarget?.collectionId)} value={collection?.id ?? ''} onChange={(event) => { setCollectionId(event.target.value); setCanceledRun(false); setResults([]); setLiveItems([]); setSelectedReportId(''); }}>{workspace.collections.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.requests.length}</option>)}</select></label>
          {targetFolder ? <label>Folder<input aria-label="Runner folder" disabled value={targetFolder.name} /></label> : null}
          <label>Environment<select aria-label="Runner environment" value={environment.id} onChange={(event) => setEnvironmentId(event.target.value)}>{workspace.environments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <fieldset className="runner-plan"><legend>Request order</legend>{requestPlan.map((item, index) => {
            const request = collection?.requests.find((candidate) => candidate.id === item.id);
            if (!request) return null;
            return <div draggable key={item.id} onDragEnd={() => { draggedRequestId.current = ''; }} onDragOver={(event) => event.preventDefault()} onDragStart={() => { draggedRequestId.current = item.id; }} onDrop={() => dropRequest(item.id)}><input aria-label={`Include ${request.name}`} checked={item.enabled} onChange={(event) => setRequestPlan((current) => current.map((candidate) => candidate.id === item.id ? { ...candidate, enabled: event.target.checked } : candidate))} type="checkbox" /><span title={request.name}>{request.name}</span><div><button aria-label={`Move ${request.name} up`} disabled={index === 0} onClick={() => moveRequest(item.id, -1)} type="button">↑</button><button aria-label={`Move ${request.name} down`} disabled={index === requestPlan.length - 1} onClick={() => moveRequest(item.id, 1)} type="button">↓</button></div></div>;
          })}</fieldset>
          <div className="runner-number-grid"><label>Iterations<input min="1" max="1000" type="number" value={iterations} onChange={(event) => setIterations(Number(event.target.value))} /></label><label>Retries<input min="0" max="10" type="number" value={retries} onChange={(event) => setRetries(Number(event.target.value))} /></label></div>
          <label className="runner-toggle"><input checked={bail} onChange={(event) => setBail(event.target.checked)} type="checkbox" /><span>Stop after first exhausted failure</span></label>
          <label className="runner-toggle"><input checked={keepLog} disabled={running} onChange={(event) => setKeepLog(event.target.checked)} type="checkbox" /><span>Keep logs after run</span></label>
          <label>Delay before each request (ms)<input min="0" max="30000" type="number" value={delayMs} onChange={(event) => setDelayMs(Number(event.target.value))} /></label>
          <label>Stream sample window (ms)<input min="100" max="30000" type="number" value={streamWindowMs} onChange={(event) => setStreamWindowMs(Number(event.target.value))} /></label>
          <div className="runner-data-control"><label>Iteration data<textarea aria-label="Runner iteration data" placeholder={'JSON array or CSV\norderId,status\nord_1,open'} value={data} onChange={(event) => { setData(event.target.value); setDataFileName(''); setDataFileEncoding('utf-8'); setDataFileBytesBase64(''); }} /></label><button disabled={running} onClick={() => setShowDataDialog(true)} type="button"><Icon name={dataFileName ? 'history' : 'import'} size={13} /> {dataFileName ? `View data · ${dataFileName}` : 'Upload data'}</button></div>
          <p>Dataset values override environment variables for each iteration.</p>
        </aside>
        <div className="runner-results">
          <header><div className="runner-heading"><small>{running ? 'Run in progress' : displayedReport ? `${selectedReport ? 'Selected run' : 'Last run'} · ${new Date(displayedReport.finishedAt).toLocaleString()}` : 'Ready to run'}</small><h2>{collection?.name ?? 'No collection'}</h2>{visibleReportSummary?.durationMs ? <span className="runner-duration-tag" title={`${visibleReportSummary.durationMs} ms`}>{visibleReportSummary.duration}</span> : null}<nav aria-label="Runner result views" className="runner-view-tabs"><button aria-pressed={resultPane === 'results'} onClick={() => setResultPane('results')} type="button">Results <span className={`runner-result-count ${resultAssertions.tone}`} title={`${resultAssertions.passed} of ${resultAssertions.total} assertions passed`}>{resultAssertions.passed} / {resultAssertions.total}</span></button><button aria-pressed={resultPane === 'history'} onClick={() => setResultPane('history')} type="button">History{scopedReports.length ? ` · ${scopedReports.length}` : ''}</button><button aria-pressed={resultPane === 'console'} onClick={() => setResultPane('console')} type="button">Console</button></nav></div><div className="runner-stats"><strong>{visibleLiveItems.length}</strong><span>Planned</span><strong className="active">{liveCount('running')}</strong><span>Running</span><strong className="ok">{finishedCount}</strong><span>Finished</span><strong>{liveCount('skipped')}</strong><span>Skipped</span><strong>{liveCount('canceled')}</strong><span>Canceled</span></div></header>
          {resultPane === 'results' ? <div className="runner-attempt-list">{showLiveProgress ? <div className="runner-live-progress"><span>{liveProgress.label}</span>{running ? <button onClick={cancelRun} type="button">Cancel all</button> : null}</div> : <div className="runner-result-filters"><nav aria-label="Filter Runner assertion results">{(['all', 'passed', 'failed', 'skipped'] as ScriptTestFilter[]).map((filter) => <button aria-pressed={resultStatusFilter === filter} key={filter} onClick={() => setResultStatusFilter(filter)} type="button">{filter[0].toUpperCase() + filter.slice(1)}</button>)}</nav><input aria-label="Filter test results" onChange={(event) => setResultNameFilter(event.target.value)} placeholder="Filter test results with name" title="Filter test results" type="text" value={resultNameFilter} /></div>}{visibleLiveItemGroups.map((group) => <section className="runner-iteration-group" key={group.iteration}><header><strong>Iteration {group.iteration}</strong><span>{group.items.length} {group.items.length === 1 ? 'attempt' : 'attempts'}</span></header><div>{group.items.map((item) => <RunnerAttemptCard defaultExpanded={!running} item={item} key={`${item.key}-${running}`} nameFilter={resultNameFilter} onSkip={running && !isRunnerItemFinished(item.status) ? () => skipItem(item.key) : undefined} result={resultForItem(item)} statusFilter={resultStatusFilter} />)}</div></section>)}{!visibleLiveItems.length ? <div className="empty-state compact"><Icon name="history" size={28} /><strong>{!usesCurrentRun && displayedReport ? 'No results from this run' : 'Run results will appear here'}</strong><span>{!usesCurrentRun && displayedReport ? 'Add test cases in scripts and run them to see results.' : 'Select requests and run them to see results.'}</span></div> : null}</div> : resultPane === 'history' ? <section className="runner-history" aria-label="Runner history"><div className="runner-history-head"><span>Source</span><span>Iterations</span><span>Duration</span><span>Total</span><span>Passed</span><span>Failed</span><span>Skipped</span><span>Delete</span></div>{scopedReports.map((report) => { const summary = summarizeRunnerHistory(report); return <article className={selectedReportId === report.id ? 'selected' : ''} key={report.id}><span><button onClick={() => openReport(report.id)} type="button"><i className={summary.failed ? 'failed' : 'passed'} /><strong>{report.sourceName ?? report.collectionName}</strong><small title={new Date(report.startedAt).toLocaleString()}>{new Date(report.startedAt).toLocaleString()}</small></button></span><span>{report.iterations}</span><span title={`${summary.durationMs} ms`}>{summary.duration}</span><span>{summary.total}</span><span>{summary.passed}</span><span>{summary.failed}</span><span>{summary.skipped}</span><span><button aria-label={`Delete run from ${new Date(report.startedAt).toLocaleString()}`} className="runner-history-delete" onClick={() => deleteReport(report.id)} type="button"><Icon name="trash" size={13} /></button></span></article>; })}{!scopedReports.length ? <div className="empty-state compact"><Icon name="history" size={28} /><strong>No saved runs</strong><span>Completed runs for this Runner appear here.</span></div> : null}</section> : <section className="runner-console" aria-label="Runner console">{consoleText ? <pre>{consoleText}</pre> : <div className="empty-state compact"><Icon name="history" size={28} /><strong>No runner logs</strong><span>{visibleKeepLog ? 'Run the selected requests to capture local timeline evidence.' : 'Log retention was disabled for this run.'}</span></div>}{consoleTruncated ? <p>Console evidence reached the bounded local retention limit and was truncated.</p> : null}</section>}
        </div>
      </div>
      {error ? <div className="automation-message error" role="alert">{error}</div> : null}
      {showDataDialog ? <RunnerDataDialog data={data} fileBytesBase64={dataFileBytesBase64} fileEncoding={dataFileEncoding} fileName={dataFileName} onApply={(nextData, nextFileName, nextFileEncoding, nextFileBytesBase64, rowCount) => { setData(nextData); setDataFileName(nextFileName); setDataFileEncoding(nextFileEncoding); setDataFileBytesBase64(nextFileBytesBase64); setIterations(rowCount); }} onClear={() => { setData(''); setDataFileName(''); setDataFileEncoding('utf-8'); setDataFileBytesBase64(''); }} onClose={() => setShowDataDialog(false)} /> : null}
      {showCliDialog && collection ? <RunnerCliDialog bail={bail} collectionId={collection.id} dataFileName={dataFileName} delayMs={delayMs} environmentId={selectedEnvironment.id} hasData={Boolean(data.trim())} iterations={iterations} onClose={() => setShowCliDialog(false)} requestIds={selectedRequestIds} retries={retries} workspace={workspace} workspaceId={workspaceId} /> : null}
      {oauthAuthorization ? <OAuthAuthorizationDialog onCancel={cancelRun} status={oauthAuthorization} /> : null}
    </section>
  );
}

function MockWorkbench({ workspace, activeEnvironment, vault, onChangeWorkspace, runningMocks, mockTarget, onMockChange, onOpenMock, onStartMock, onStopMock, templatePrompt }: AutomationWorkbenchProps) {
  const sendRequest = (...[request, environment, context]: Parameters<typeof sendHttpRequest>) => sendHttpRequest(request, environment, {
    certificates: workspace.certificates,
    prompt: templatePrompt,
    readFile: workspace.preferences.allowScriptFileAccess && isTauri()
      ? (path) => readDesktopTemplateFile(path, workspace.preferences.dataFolders)
      : undefined,
    requestAncestors: requestAncestorNames(workspace.collections, request),
    ...context,
  });
  const [error, setError] = useState('');
  const [showAi, setShowAi] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiContextSource, setAiContextSource] = useState<MockAiContextSource>('manual');
  const [aiSpecUrl, setAiSpecUrl] = useState('');
  const [aiSpecContext, setAiSpecContext] = useState<MockAiContext>();
  const [fetchingAiSpec, setFetchingAiSpec] = useState(false);
  const [aiPort, setAiPort] = useState(4020);
  const [generating, setGenerating] = useState(false);
  const mockSyncTimeouts = useRef<Record<string, number>>({});
  const latestMockServers = useRef<Record<string, MockServer>>({});
  const server = mockTarget ? workspace.mockServers.find((candidate) => candidate.id === mockTarget.serverId) : workspace.mockServers[0];
  const route = mockTarget?.routeId ? server?.routes.find((candidate) => candidate.id === mockTarget.routeId) : mockTarget ? undefined : server?.routes[0];
  const activeRun = server ? runningMocks[server.id] : undefined;
  const activeRequest = useMemo(() => findActiveRequest(workspace), [workspace]);
  const latestResponse = useMemo(() => findLatestResponseForActiveRequest(workspace), [workspace]);
  const selectedAiContext = useMemo(() => {
    if (aiContextSource === 'manual') return undefined;
    if (aiContextSource === 'spec-url') return aiSpecContext;
    try { return buildMockAiContext(workspace, aiContextSource); } catch { return undefined; }
  }, [aiContextSource, aiSpecContext, workspace]);

  const updateServer = (patch: Partial<MockServer>, promote = true) => {
    if (!server) return;
    if (promote) onMockChange?.();
    onChangeWorkspace((current) => ({ ...current, mockServers: current.mockServers.map((candidate) => candidate.id === server.id ? { ...candidate, ...patch } : candidate) }));
  };
  const updateRoute = (patch: Partial<MockRoute>) => {
    if (!server || !route) return;
    updateServer({ routes: server.routes.map((candidate) => candidate.id === route.id ? { ...candidate, ...patch } : candidate) });
  };
  useEffect(() => {
    if (!server || !activeRun) return;
    latestMockServers.current[server.id] = server;
    const pending = mockSyncTimeouts.current[server.id];
    if (pending !== undefined) window.clearTimeout(pending);
    mockSyncTimeouts.current[server.id] = window.setTimeout(() => {
      delete mockSyncTimeouts.current[server.id];
      const latest = latestMockServers.current[server.id];
      if (!latest) return;
      void updateMockServer(latest).catch((caught) => {
        setError(caught instanceof Error ? caught.message : String(caught));
      });
    }, 180);
  }, [server, activeRun?.baseUrl]);
  useEffect(() => () => {
    Object.values(mockSyncTimeouts.current).forEach((timeout) => window.clearTimeout(timeout));
  }, []);
  const toggleServer = async () => {
    if (!server) return;
    setError('');
    try {
      if (runningMocks[server.id]) {
        const pending = mockSyncTimeouts.current[server.id];
        if (pending !== undefined) window.clearTimeout(pending);
        delete mockSyncTimeouts.current[server.id];
        delete latestMockServers.current[server.id];
        await stopMockServer(server.id);
        onStopMock(server.id);
      } else {
        const result = await startMockServer(server);
        onStartMock(server.id, result);
      }
    } catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
  };
  const generateAiMock = async () => {
    if (generating) return;
    setGenerating(true); setError('');
    try {
      const input = composeMockAiInput(aiPrompt, selectedAiContext);
      const generated = await generateMockWithAi(workspace.ai, input, aiPort, activeEnvironment, { preferredHttpVersion: workspace.preferences.preferredHttpVersion, maxRedirects: workspace.preferences.maxRedirects, followRedirects: workspace.preferences.followRedirects, requestTimeoutMs: workspace.preferences.requestTimeoutMs, validateCertificates: workspace.preferences.validateCertificates, validateAuthCertificates: workspace.preferences.validateAuthCertificates, proxy: workspaceProxyPreferences(workspace), certificates: workspace.certificates, maxTimelineDataSizeKB: workspace.preferences.maxTimelineDataSizeKB, filterResponsesByEnv: workspace.preferences.filterResponsesByEnv, vault, externalSecret: (input) => resolveAuthorizedExternalSecret(workspace, input) });
      onChangeWorkspace((current) => ({ ...current, mockServers: [...current.mockServers, generated] }));
      onOpenMock?.(generated.id, generated.routes[0]?.id); setShowAi(false); setAiPrompt('');
    } catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
    finally { setGenerating(false); }
  };
  const fetchAiSpecification = async () => {
    if (fetchingAiSpec) return;
    setFetchingAiSpec(true); setError(''); setAiSpecContext(undefined);
    try {
      const url = validateMockSpecUrl(aiSpecUrl);
      const request = createBlankRequest('ai-mock-spec-url');
      request.name = 'AI mock specification'; request.url = url; request.method = 'GET'; request.bodyMode = 'none'; request.preRequestScript = ''; request.tests = '';
      const response = await sendRequest(request, undefined, { preferredHttpVersion: workspace.preferences.preferredHttpVersion, maxRedirects: workspace.preferences.maxRedirects, followRedirects: workspace.preferences.followRedirects, requestTimeoutMs: workspace.preferences.requestTimeoutMs, validateCertificates: workspace.preferences.validateCertificates, validateAuthCertificates: workspace.preferences.validateAuthCertificates, proxy: workspaceProxyPreferences(workspace), maxTimelineDataSizeKB: workspace.preferences.maxTimelineDataSizeKB, filterResponsesByEnv: false });
      if (response.status < 200 || response.status >= 300) throw new Error(`Specification URL returned ${response.status} ${response.statusText}.`);
      setAiSpecContext(buildMockSpecUrlContext(url, response));
    } catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
    finally { setFetchingAiSpec(false); }
  };
  const createRouteFromLatestResponse = () => {
    if (!server || !latestResponse) return;
    setError('');
    try {
      const created = createMockRouteFromResponse(latestResponse);
      updateServer({ routes: [...server.routes, created] }, false);
      onOpenMock?.(server.id, created.id);
    } catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
  };
  const overwriteRouteFromLatestResponse = () => {
    if (!server || !route || !latestResponse) return;
    setError('');
    try {
      const updated = overwriteMockRouteFromResponse(route, latestResponse);
      updateServer({ routes: server.routes.map((candidate) => candidate.id === route.id ? updated : candidate) });
    } catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
  };

  if (!server) return <AutomationEmpty title="No mock servers" action="Create local mock" onAction={() => {
    const created: MockServer = { id: uid('mock'), name: 'Local mock', host: '127.0.0.1', port: 4010, routes: [] };
    onChangeWorkspace((current) => ({ ...current, mockServers: [...current.mockServers, created] })); onOpenMock?.(created.id);
  }} />;

  return (
    <section className="automation-workbench mock-workbench">
      <AutomationHeader eyebrow="Mock" title="Local mock servers" subtitle="Serve deterministic scenarios from this device with no account or hosted dependency.">
        <select aria-label="Mock server" value={server.id} onChange={(event) => onOpenMock?.(event.target.value)}>{workspace.mockServers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
        <button className="secondary-action" disabled={!workspace.ai.enabled || !workspace.ai.mockGeneration} onClick={() => setShowAi((current) => !current)} type="button">AI generate</button>
        <button className="secondary-action" disabled={!latestResponse} onClick={createRouteFromLatestResponse} title={latestResponse ? `Create a route from ${latestResponse.status} ${latestResponse.statusText}` : 'Send the active request first'} type="button">Response → route</button>
        <button className={activeRun ? 'danger-action' : 'primary-action'} onClick={() => void toggleServer()} type="button">{activeRun ? 'Stop server' : 'Start server'}</button>
      </AutomationHeader>
      <div className="mock-content">
        {showAi ? <div className="ai-mock-generator">
          <label>Context source<select aria-label="AI mock context source" value={aiContextSource} onChange={(event) => setAiContextSource(event.target.value as MockAiContextSource)}><option value="manual">Manual input</option><option disabled={!activeRequest} value="active-request">Active request</option><option disabled={!latestResponse} value="latest-response">Latest response</option><option value="spec-url">Specification URL</option></select></label>
          <label>{aiContextSource === 'manual' ? 'Prompt, OpenAPI, or example response' : 'Additional instructions (optional)'}<textarea value={aiPrompt} onChange={(event) => setAiPrompt(event.target.value)} placeholder={aiContextSource === 'manual' ? 'Create an orders API with list, create, and status endpoints…' : 'Add edge cases or describe the routes you want…'} /></label>
          <label>Local port<input min="1024" max="65535" type="number" value={aiPort} onChange={(event) => setAiPort(Number(event.target.value))} /></label>
          <button disabled={generating || (aiContextSource === 'manual' ? !aiPrompt.trim() : !selectedAiContext)} onClick={() => void generateAiMock()} type="button">{generating ? 'Generating…' : 'Create editable local mock'}</button>
          <p>Only the prompt and explicitly selected, reviewable context are sent to your configured model. Credential fields are redacted; vault values and resolved environment values are never added.</p>
          {aiContextSource === 'spec-url' ? <div className="ai-mock-url"><label>Specification URL<input aria-label="AI mock specification URL" placeholder="https://example.com/openapi.yaml" type="url" value={aiSpecUrl} onChange={(event) => { setAiSpecUrl(event.target.value); setAiSpecContext(undefined); }} /></label><button disabled={fetchingAiSpec || !aiSpecUrl.trim()} onClick={() => void fetchAiSpecification()} type="button">{fetchingAiSpec ? 'Fetching…' : 'Fetch for review'}</button><p>Fetch uses the entered URL but adds no stored auth, cookies, scripts, environment, or vault values. Nothing is sent to the model until you review the context and create the mock.</p></div> : null}
          {selectedAiContext ? <details className="ai-mock-context"><summary>Review model context · {selectedAiContext.label}</summary><pre>{selectedAiContext.text}</pre></details> : aiContextSource !== 'manual' ? <p className="ai-mock-context-error">{aiContextSource === 'active-request' ? 'Select an active request first.' : aiContextSource === 'latest-response' ? 'Send the active request first.' : 'Fetch the specification URL for review first.'}</p> : null}
        </div> : null}
        <div className="mock-grid">
        <aside className="mock-routes">
          <header><strong>Routes</strong><button onClick={() => { const created: MockRoute = { id: uid('route'), name: 'New scenario', enabled: true, method: 'GET', path: '/resource', status: 200, headers: [], body: '{}', delayMs: 0 }; updateServer({ routes: [...server.routes, created] }, false); onOpenMock?.(server.id, created.id); }} type="button"><Icon name="plus" size={14} /> New route</button></header>
          <div>{server.routes.map((item) => <button className={route?.id === item.id ? 'active' : ''} key={item.id} onClick={() => onOpenMock?.(server.id, item.id)} type="button"><span className={`method method-${item.method.toLowerCase()}`}>{item.method}</span><span><strong>{item.path}</strong><small>{item.status} · {item.name}</small></span><i className={item.enabled ? 'enabled' : ''} /></button>)}</div>
        </aside>
        {route ? <div className="mock-route-editor">
          <div className="mock-route-bar"><select aria-label="Mock method" value={route.method} onChange={(event) => updateRoute({ method: event.target.value as MockRoute['method'] })}>{['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS', 'TRACE'].map((method) => <option key={method}>{method}</option>)}</select><input aria-label="Mock route path" value={route.path} onChange={(event) => updateRoute({ path: event.target.value })} /><label>Status<input aria-label="Mock status" min="100" max="599" type="number" value={route.status} onChange={(event) => updateRoute({ status: Number(event.target.value) })} /></label><label>Delay<input aria-label="Mock delay" min="0" max="30000" type="number" value={route.delayMs} onChange={(event) => updateRoute({ delayMs: Number(event.target.value) })} /></label></div>
          <div className="mock-route-meta"><input aria-label="Mock route name" value={route.name} onChange={(event) => updateRoute({ name: event.target.value })} /><label><input checked={route.enabled} type="checkbox" onChange={(event) => updateRoute({ enabled: event.target.checked })} /> Route enabled</label><button className="mock-response-action" disabled={!latestResponse} onClick={overwriteRouteFromLatestResponse} title={latestResponse ? 'Replace status, headers, and body from the latest response' : 'Send the active request first'} type="button"><Icon name="history" size={14} /> Use latest response</button><button onClick={() => { updateServer({ routes: server.routes.filter((candidate) => candidate.id !== route.id) }, false); onOpenMock?.(server.id); }} type="button"><Icon name="trash" size={14} /> Delete</button></div>
          <div className="mock-header-editor">
            <header><strong>Response headers</strong><button onClick={() => updateRoute({ headers: [...route.headers, { id: uid('mock-header'), name: '', value: '', enabled: true }] })} type="button"><Icon name="plus" size={13} /> Add header</button></header>
            {route.headers.map((header) => <div className="mock-header-row" key={header.id}><input aria-label="Enable mock response header" checked={header.enabled} type="checkbox" onChange={(event) => updateRoute({ headers: route.headers.map((candidate) => candidate.id === header.id ? { ...candidate, enabled: event.target.checked } : candidate) })} /><input aria-label="Mock response header name" placeholder="Header" value={header.name} onChange={(event) => updateRoute({ headers: route.headers.map((candidate) => candidate.id === header.id ? { ...candidate, name: event.target.value } : candidate) })} /><input aria-label="Mock response header value" placeholder="Value" value={header.value} onChange={(event) => updateRoute({ headers: route.headers.map((candidate) => candidate.id === header.id ? { ...candidate, value: event.target.value } : candidate) })} /><button aria-label="Remove mock response header" onClick={() => updateRoute({ headers: route.headers.filter((candidate) => candidate.id !== header.id) })} type="button"><Icon name="trash" size={13} /></button></div>)}
            {!route.headers.length ? <span>No response headers configured.</span> : null}
          </div>
          <CodeEditor ariaLabel="Mock response body" value={route.body} onChange={(body) => updateRoute({ body })} />
        </div> : <AutomationEmpty title={server.routes.length ? 'Select a route' : 'No routes'} action={server.routes.length ? 'Open first route' : 'Add route'} onAction={() => { if (server.routes[0]) { onOpenMock?.(server.id, server.routes[0].id); return; } const created: MockRoute = { id: uid('route'), name: 'New scenario', enabled: true, method: 'GET', path: '/resource', status: 200, headers: [], body: '{}', delayMs: 0 }; updateServer({ routes: [created] }, false); onOpenMock?.(server.id, created.id); }} />}
        <aside className="mock-inspector"><div className={`mock-status-card${activeRun ? ' running' : ''}`}><i /><small>{activeRun ? 'Running locally · edits apply live' : 'Server stopped'}</small><strong>{activeRun?.baseUrl ?? `http://${server.host}:${server.port}`}</strong><span>{server.routes.filter((item) => item.enabled).length} enabled routes</span></div><h3>Dynamic tokens</h3><code>{'{{$timestamp}}'}</code><code>{'{{$randomUUID}}'}</code><code>{'{{request.path.id}}'}</code><h3>Request-aware output</h3><code>{"{{ req.headers['X-Client'] }}"}</code><code>{'{{ req.queryParams.id }}'}</code><code>{'{{ req.queryParams.tag[0] }}'}</code><code>{'{{ req.pathSegments[0] }}'}</code><code>{'{{ req.body.name | default: "Guest" }}'}</code><code>{'{{ req.body.tags.0 }}'}</code><h3>Control tags</h3><code>{'{% assign greeting = "Hello" %}'}</code><code>{'{% if req.queryParams.role == "admin" %}allowed{% elsif req.queryParams.role contains "edit" %}limited{% else %}denied{% endif %}'}</code><code>{'{% unless req.body.disabled %}enabled{% endunless %}'}</code><code>{'{% raw %}{{ unchanged }}{% endraw %}'}</code><h3>Faker values</h3><code>{'{{ faker.randomUUID }}'}</code><code>{'{{ faker.randomFullName }}'}</code><code>{'{{ faker.randomExampleEmail }}'}</code><code>{'{{ faker.isoTimestamp }}'}</code><p>All 118 documented Faker names render locally. Conditions support LiquidJS comparisons, <code>contains</code>, <code>not</code>, right-associative <code>and</code>/<code>or</code>, and <code>elsif</code>. JSON, form, and multipart bodies are parsed inside a 1 MB request inspection limit. Repeated pairs preserve order and use zero-based bracket or dotted indices; path values percent-decode without changing +. Undefined variables render empty. Unsupported tags, filters, malformed controls, and exceeded render limits return a structured 500 response.</p></aside>
        </div>
      </div>
      {error ? <div className="automation-message error" role="alert">{error}</div> : null}
    </section>
  );
}

function AutomationHeader({ eyebrow, title, subtitle, children }: { eyebrow: string; title: string; subtitle: string; children: React.ReactNode }) {
  return <header className="automation-header"><div><small>{eyebrow}</small><h1>{title}</h1><p>{subtitle}</p></div><div>{children}</div></header>;
}

function AutomationEmpty({ title, action, onAction }: { title: string; action: string; onAction: () => void }) {
  return <section className="automation-workbench automation-empty"><Icon name="spark" size={30} /><h2>{title}</h2><button className="primary-action" onClick={onAction} type="button">{action}</button></section>;
}
