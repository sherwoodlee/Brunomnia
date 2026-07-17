import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import type {
  ApiDesign,
  Collection,
  Environment,
  MockRoute,
  MockServer,
  RunnerItemResult,
  Workspace,
  WorkbenchSection,
} from '../types';
import { analyzeOpenApi, formatOpenApi, generateCollectionFromOpenApi } from '../lib/openapi';
import { parseRunnerData, runCollection } from '../lib/runner';
import { createRunnerReportArtifact, type RunnerReporter } from '../lib/runnerReport';
import { resolveEnvironment, scriptEnvironmentScopes } from '../lib/resources';
import { applyScriptSubresponse, runBrowserScript } from '../lib/scriptSandbox';
import { readDesktopScriptFile } from '../lib/scriptFiles';
import { storeResponseCookies } from '../lib/cookies';
import { sendRequest } from '../lib/http';
import { createPluginRuntime, type PluginHostCallbacks, type PluginRunState } from '../lib/plugins';
import { startMockServer, stopMockServer, type RunningMock } from '../lib/mock';
import { runStreamSample } from '../lib/protocol';
import { resolveAuthorizedExternalSecret } from '../lib/security';
import { generateMockWithAi } from '../lib/ai';
import { Icon } from './Icon';
import { CodeEditor } from './ProtocolEditors';

const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

type AutomationWorkbenchProps = {
  section: Exclude<WorkbenchSection, 'requests' | 'git' | 'plugins' | 'security' | 'integrations'>;
  workspace: Workspace;
  activeEnvironment: Environment;
  vault: Record<string, string>;
  onChangeWorkspace: (updater: (workspace: Workspace) => Workspace) => void;
  onOpenCollection: (collection: Collection) => void;
  runningMocks: Record<string, RunningMock>;
  onStartMock: (serverId: string, runningMock: RunningMock) => void;
  onStopMock: (serverId: string) => void;
};

export function AutomationWorkbench(props: AutomationWorkbenchProps) {
  if (props.section === 'design') return <DesignWorkbench {...props} />;
  if (props.section === 'runner') return <RunnerWorkbench {...props} />;
  return <MockWorkbench {...props} />;
}

function DesignWorkbench({ workspace, onChangeWorkspace, onOpenCollection }: AutomationWorkbenchProps) {
  const [activeId, setActiveId] = useState(workspace.apiDesigns[0]?.id ?? '');
  const [message, setMessage] = useState('');
  const [editorMode, setEditorMode] = useState<'document' | 'ruleset'>('document');
  const design = workspace.apiDesigns.find((candidate) => candidate.id === activeId) ?? workspace.apiDesigns[0];
  const deferredContents = useDeferredValue(design?.contents ?? '');
  const analysis = useMemo(() => analyzeOpenApi(deferredContents, design?.ruleset), [deferredContents, design?.ruleset]);

  const updateDesign = (patch: Partial<ApiDesign>) => {
    if (!design) return;
    onChangeWorkspace((current) => ({ ...current, apiDesigns: current.apiDesigns.map((candidate) => candidate.id === design.id ? { ...candidate, ...patch } : candidate) }));
  };

  const generate = () => {
    if (!design) return;
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
    setActiveId(created.id);
  }} />;

  const errors = analysis.issues.filter((issue) => issue.severity === 'error').length;
  const warnings = analysis.issues.length - errors;
  return (
    <section className="automation-workbench design-workbench">
      <AutomationHeader eyebrow="Design" title="API design document" subtitle="Edit, lint, preview, and turn OpenAPI operations into runnable requests.">
        <select aria-label="API design" value={design.id} onChange={(event) => setActiveId(event.target.value)}>{workspace.apiDesigns.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
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

function RunnerWorkbench({ workspace, activeEnvironment, vault, onChangeWorkspace }: AutomationWorkbenchProps) {
  const [collectionId, setCollectionId] = useState(workspace.collections[0]?.id ?? '');
  const [environmentId, setEnvironmentId] = useState(activeEnvironment.id);
  const [iterations, setIterations] = useState(1);
  const [retries, setRetries] = useState(0);
  const [bail, setBail] = useState(false);
  const [delayMs, setDelayMs] = useState(0);
  const [streamWindowMs, setStreamWindowMs] = useState(1000);
  const [data, setData] = useState('');
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<RunnerItemResult[]>([]);
  const [selectedResultId, setSelectedResultId] = useState('');
  const [error, setError] = useState('');
  const [requestPlan, setRequestPlan] = useState<Array<{ id: string; enabled: boolean }>>(() => (workspace.collections[0]?.requests ?? []).map((request) => ({ id: request.id, enabled: true })));
  const cancelled = useRef(false);
  const draggedRequestId = useRef('');
  const collection = workspace.collections.find((candidate) => candidate.id === collectionId) ?? workspace.collections[0];
  const selectedEnvironment = workspace.environments.find((candidate) => candidate.id === environmentId) ?? activeEnvironment;
  const environment = resolveEnvironment(workspace.environments, selectedEnvironment.id) ?? selectedEnvironment;
  const latestReport = workspace.runnerReports.find((report) => report.collectionId === collection?.id);

  useEffect(() => {
    const ids = new Set((collection?.requests ?? []).map((request) => request.id));
    setRequestPlan((current) => {
      const retained = current.filter((item) => ids.has(item.id));
      const retainedIds = new Set(retained.map((item) => item.id));
      const added = (collection?.requests ?? []).filter((request) => !retainedIds.has(request.id)).map((request) => ({ id: request.id, enabled: true }));
      return [...retained, ...added];
    });
  }, [collection]);

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
    if (!latestReport) return;
    const artifact = createRunnerReportArtifact(latestReport, reporter);
    const url = URL.createObjectURL(new Blob([artifact.contents], { type: artifact.mimeType }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = artifact.fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const start = async () => {
    if (!collection || running) return;
    const requestIds = requestPlan.filter((item) => item.enabled).map((item) => item.id);
    if (!requestIds.length) { setError('Select at least one request for this run.'); return; }
    setRunning(true); setResults([]); setSelectedResultId(''); setError(''); cancelled.current = false;
    try {
      let runnerCookies = [...workspace.cookies];
      let runnerResponses = [...workspace.responses];
      const pluginState: PluginRunState = { data: structuredClone(workspace.pluginData), notifications: [] };
      const pluginCallbacks: PluginHostCallbacks = {
        network: (pluginRequest) => sendRequest(pluginRequest, environment, { cookies: runnerCookies, responses: runnerResponses, preferredHttpVersion: workspace.preferences.preferredHttpVersion }),
        prompt: async (title, defaultValue) => window.prompt(title, defaultValue) ?? '',
        readClipboard: () => navigator.clipboard.readText(),
        writeClipboard: (value) => navigator.clipboard.writeText(value),
      };
      const pluginRuntime = createPluginRuntime(workspace.plugins, pluginState, pluginCallbacks);
      const report = await runCollection(collection, environment, {
        iterations, retries, bail, requestIds, delayMs, scriptTimeoutMs: workspace.preferences.scriptTimeoutMs, environmentScopes: scriptEnvironmentScopes(workspace.environments, selectedEnvironment.id), dataRows: parseRunnerData(data), shouldCancel: () => cancelled.current,
        onResult: (result) => { setResults((current) => [...current, result]); setSelectedResultId((current) => current || result.id); },
      }, async (request, variables) => {
        const requestEnvironment = {
          id: environment.id, name: environment.name,
          variables: Object.entries(variables).map(([name, value]) => ({ id: `runner-${name}`, name, value, enabled: true })),
        };
        const result = request.protocol === 'websocket' || request.protocol === 'sse'
          ? await runStreamSample(request, requestEnvironment, streamWindowMs, workspace.preferences.preferredHttpVersion)
          : await sendRequest(request, requestEnvironment, { cookies: runnerCookies, responses: runnerResponses, preferredHttpVersion: workspace.preferences.preferredHttpVersion, pluginRuntime, vault, externalSecret: (input) => resolveAuthorizedExternalSecret(workspace, input) });
        const requestUrl = result.requestUrl ?? request.url;
        if (request.transport.storeCookies) runnerCookies = storeResponseCookies(runnerCookies, requestUrl, result.setCookies ?? []);
        const stored = { ...result, requestId: request.id, requestName: request.name, requestUrl, receivedAt: new Date().toISOString() };
        runnerResponses = [stored, ...runnerResponses.filter((candidate) => candidate.requestId !== request.id)].slice(0, 100);
        return result;
      }, (source, request, variables, response, timeoutMs, localVariables, iterationData, scriptOptions) => runBrowserScript(source, request, variables, response, timeoutMs, localVariables, iterationData, {
        ...scriptOptions,
        readFile: workspace.preferences.allowScriptFileAccess ? readDesktopScriptFile : undefined,
        vault: workspace.preferences.enableVaultInScripts ? vault : undefined,
        sendRequest: workspace.preferences.allowScriptRequests ? async (subrequest, subrequestVariables) => {
          const subresponse = await sendRequest(subrequest, {
            ...environment,
            variables: Object.entries(subrequestVariables).map(([name, value]) => ({ id: `runner-script-${name}`, name, value, enabled: true })),
          }, {
            cookies: runnerCookies,
            responses: runnerResponses,
            preferredHttpVersion: workspace.preferences.preferredHttpVersion,
            vault: workspace.preferences.enableVaultInScripts ? vault : {},
          });
          const state = applyScriptSubresponse(runnerCookies, runnerResponses, subrequest, subresponse);
          runnerCookies = state.cookies;
          runnerResponses = state.responses;
          return subresponse;
        } : undefined,
      }));
      onChangeWorkspace((current) => ({ ...current, cookies: runnerCookies, responses: runnerResponses, pluginData: pluginState.data, runnerReports: [report, ...current.runnerReports].slice(0, 30) }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setRunning(false);
    }
  };

  const visibleResults = results.length ? results : latestReport?.results ?? [];
  const passed = visibleResults.filter((result) => result.passed).length;
  const selectedResult = visibleResults.find((result) => result.id === selectedResultId);
  return (
    <section className="automation-workbench runner-workbench">
      <AutomationHeader eyebrow="Test" title="Collection runner" subtitle="Run requests in order with iteration data, scripts, assertions, delays, and retries.">
        {latestReport && !running ? <button className="secondary-action" onClick={() => downloadReport('json')} type="button">Export JSON</button> : null}
        {latestReport && !running ? <button className="secondary-action" onClick={() => downloadReport('junit')} type="button">Export JUnit</button> : null}
        {running ? <button className="danger-action" onClick={() => { cancelled.current = true; }} type="button">Cancel run</button>
          : <button className="primary-action" disabled={!collection} onClick={() => void start()} type="button">Run collection</button>}
      </AutomationHeader>
      <div className="runner-grid">
        <aside className="runner-config">
          <label>Collection<select aria-label="Runner collection" value={collection?.id ?? ''} onChange={(event) => setCollectionId(event.target.value)}>{workspace.collections.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.requests.length}</option>)}</select></label>
          <label>Environment<select aria-label="Runner environment" value={environment.id} onChange={(event) => setEnvironmentId(event.target.value)}>{workspace.environments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <fieldset className="runner-plan"><legend>Request order</legend>{requestPlan.map((item, index) => {
            const request = collection?.requests.find((candidate) => candidate.id === item.id);
            if (!request) return null;
            return <div draggable key={item.id} onDragEnd={() => { draggedRequestId.current = ''; }} onDragOver={(event) => event.preventDefault()} onDragStart={() => { draggedRequestId.current = item.id; }} onDrop={() => dropRequest(item.id)}><input aria-label={`Include ${request.name}`} checked={item.enabled} onChange={(event) => setRequestPlan((current) => current.map((candidate) => candidate.id === item.id ? { ...candidate, enabled: event.target.checked } : candidate))} type="checkbox" /><span title={request.name}>{request.name}</span><div><button aria-label={`Move ${request.name} up`} disabled={index === 0} onClick={() => moveRequest(item.id, -1)} type="button">↑</button><button aria-label={`Move ${request.name} down`} disabled={index === requestPlan.length - 1} onClick={() => moveRequest(item.id, 1)} type="button">↓</button></div></div>;
          })}</fieldset>
          <div className="runner-number-grid"><label>Iterations<input min="1" max="1000" type="number" value={iterations} onChange={(event) => setIterations(Number(event.target.value))} /></label><label>Retries<input min="0" max="10" type="number" value={retries} onChange={(event) => setRetries(Number(event.target.value))} /></label></div>
          <label className="runner-toggle"><input checked={bail} onChange={(event) => setBail(event.target.checked)} type="checkbox" /><span>Stop after first exhausted failure</span></label>
          <label>Delay between requests (ms)<input min="0" max="30000" type="number" value={delayMs} onChange={(event) => setDelayMs(Number(event.target.value))} /></label>
          <label>Stream sample window (ms)<input min="100" max="30000" type="number" value={streamWindowMs} onChange={(event) => setStreamWindowMs(Number(event.target.value))} /></label>
          <label>Iteration data<textarea aria-label="Runner iteration data" placeholder={'JSON array or CSV\norderId,status\nord_1,open'} value={data} onChange={(event) => setData(event.target.value)} /></label>
          <p>Dataset values override environment variables for each iteration.</p>
        </aside>
        <div className="runner-results">
          <header><div><small>{running ? 'Run in progress' : latestReport ? `Last run · ${new Date(latestReport.finishedAt).toLocaleString()}` : 'Ready to run'}</small><h2>{collection?.name ?? 'No collection'}</h2></div><div className="runner-stats"><strong>{visibleResults.length}</strong><span>Total attempts</span><strong className="ok">{passed}</strong><span>Passed</span><strong className={visibleResults.length - passed ? 'bad' : ''}>{visibleResults.length - passed}</strong><span>Failed</span></div></header>
          <div className="runner-table"><div className="runner-table-head"><span>Request</span><span>Iteration</span><span>Attempt</span><span>Status</span><span>Duration</span><span>Result</span></div>{visibleResults.map((result) => <article aria-pressed={selectedResult?.id === result.id} className={selectedResult?.id === result.id ? 'selected' : ''} key={result.id} onClick={() => setSelectedResultId(result.id)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedResultId(result.id); } }} role="button" tabIndex={0}><span><strong>{result.requestName}</strong><small>{result.tests.map((test) => test.name).join(', ') || result.error || 'HTTP response'}</small></span><span>{result.iteration}</span><span>{result.attempt}</span><span>{result.status || 'ERR'}</span><span>{result.durationMs} ms</span><span className={result.passed ? 'ok' : 'bad'}>{result.passed ? 'PASS' : 'FAIL'}</span></article>)}{!visibleResults.length ? <div className="empty-state compact"><Icon name="history" size={28} /><strong>No runner results</strong><span>Start the selected collection to build a local report.</span></div> : null}</div>
          {selectedResult ? <section className="runner-response-detail"><header><div><small>Attempt evidence</small><strong>{selectedResult.requestName} · iteration {selectedResult.iteration}, attempt {selectedResult.attempt}</strong></div><button aria-label="Close attempt evidence" onClick={() => setSelectedResultId('')} type="button">Close</button></header>{selectedResult.request ? <div className="runner-request-content"><div><small>Request</small><strong>{selectedResult.request.method} · {selectedResult.request.protocol}</strong><code title={selectedResult.request.url}>{selectedResult.request.url}{selectedResult.request.urlTruncated ? '…' : ''}</code></div><details><summary>{selectedResult.request.headers.length} configured headers{selectedResult.request.headersTruncated ? ' · truncated' : ''}</summary><pre>{selectedResult.request.headers.map((header) => `${header.name}: ${header.value}`).join('\n') || '(no configured headers)'}</pre></details><div><small>{selectedResult.request.bodyMode} body</small><strong>{selectedResult.request.bodySummary}</strong><span>{selectedResult.request.bodySizeEstimated ? 'Approximately ' : ''}{selectedResult.request.bodySizeBytes.toLocaleString()} payload bytes · {selectedResult.request.storedBytes.toLocaleString()} snapshot bytes</span></div></div> : null}{selectedResult.response ? <div className="runner-response-content"><div className="runner-response-meta"><span><strong>{selectedResult.status}</strong> {selectedResult.response.statusText}{selectedResult.response.statusTextTruncated ? '…' : ''}</span><span>{selectedResult.response.sizeBytes.toLocaleString()} response bytes</span><span>{selectedResult.durationMs} ms</span></div><details><summary>{Object.keys(selectedResult.response.headers).length} response headers{selectedResult.response.headersTruncated ? ' · truncated' : ''}</summary><pre>{Object.entries(selectedResult.response.headers).map(([name, value]) => `${name}: ${value}`).join('\n') || '(no response headers)'}</pre></details><div className="runner-body-preview"><small>Response body preview · {selectedResult.response.storedBytes.toLocaleString()} snapshot bytes{selectedResult.response.bodyTruncated ? ' · truncated' : ''}</small><pre>{selectedResult.response.bodyPreview || '(empty response body)'}</pre></div></div> : <p>{selectedResult.error || 'No response was returned for this attempt.'}</p>}</section> : null}
        </div>
      </div>
      {error ? <div className="automation-message error" role="alert">{error}</div> : null}
    </section>
  );
}

function MockWorkbench({ workspace, activeEnvironment, vault, onChangeWorkspace, runningMocks, onStartMock, onStopMock }: AutomationWorkbenchProps) {
  const [activeId, setActiveId] = useState(workspace.mockServers[0]?.id ?? '');
  const [activeRouteId, setActiveRouteId] = useState(workspace.mockServers[0]?.routes[0]?.id ?? '');
  const [error, setError] = useState('');
  const [showAi, setShowAi] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiPort, setAiPort] = useState(4020);
  const [generating, setGenerating] = useState(false);
  const server = workspace.mockServers.find((candidate) => candidate.id === activeId) ?? workspace.mockServers[0];
  const route = server?.routes.find((candidate) => candidate.id === activeRouteId) ?? server?.routes[0];

  const updateServer = (patch: Partial<MockServer>) => {
    if (!server) return;
    onChangeWorkspace((current) => ({ ...current, mockServers: current.mockServers.map((candidate) => candidate.id === server.id ? { ...candidate, ...patch } : candidate) }));
  };
  const updateRoute = (patch: Partial<MockRoute>) => {
    if (!server || !route) return;
    updateServer({ routes: server.routes.map((candidate) => candidate.id === route.id ? { ...candidate, ...patch } : candidate) });
  };
  const toggleServer = async () => {
    if (!server) return;
    setError('');
    try {
      if (runningMocks[server.id]) {
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
      const generated = await generateMockWithAi(workspace.ai, aiPrompt, aiPort, activeEnvironment, { preferredHttpVersion: workspace.preferences.preferredHttpVersion, vault, externalSecret: (input) => resolveAuthorizedExternalSecret(workspace, input) });
      onChangeWorkspace((current) => ({ ...current, mockServers: [...current.mockServers, generated] }));
      setActiveId(generated.id); setActiveRouteId(generated.routes[0]?.id ?? ''); setShowAi(false); setAiPrompt('');
    } catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
    finally { setGenerating(false); }
  };

  if (!server) return <AutomationEmpty title="No mock servers" action="Create local mock" onAction={() => {
    const created: MockServer = { id: uid('mock'), name: 'Local mock', host: '127.0.0.1', port: 4010, routes: [] };
    onChangeWorkspace((current) => ({ ...current, mockServers: [...current.mockServers, created] })); setActiveId(created.id);
  }} />;

  const activeRun = runningMocks[server.id];
  return (
    <section className="automation-workbench mock-workbench">
      <AutomationHeader eyebrow="Mock" title="Local mock servers" subtitle="Serve deterministic scenarios from this device with no account or hosted dependency.">
        <select aria-label="Mock server" value={server.id} onChange={(event) => { setActiveId(event.target.value); const next = workspace.mockServers.find((candidate) => candidate.id === event.target.value); setActiveRouteId(next?.routes[0]?.id ?? ''); }}>{workspace.mockServers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
        <button className="secondary-action" disabled={!workspace.ai.enabled || !workspace.ai.mockGeneration} onClick={() => setShowAi((current) => !current)} type="button">AI generate</button>
        <button className={activeRun ? 'danger-action' : 'primary-action'} onClick={() => void toggleServer()} type="button">{activeRun ? 'Stop server' : 'Start server'}</button>
      </AutomationHeader>
      <div className="mock-content">
        {showAi ? <div className="ai-mock-generator"><label>Prompt, OpenAPI, or example response<textarea value={aiPrompt} onChange={(event) => setAiPrompt(event.target.value)} placeholder="Create an orders API with list, create, and status endpoints…" /></label><label>Local port<input min="1024" max="65535" type="number" value={aiPort} onChange={(event) => setAiPort(Number(event.target.value))} /></label><button disabled={!aiPrompt.trim() || generating} onClick={() => void generateAiMock()} type="button">{generating ? 'Generating…' : 'Create editable local mock'}</button><p>Only this input is sent to your configured model. Generated routes are validated locally and remain editable.</p></div> : null}
        <div className="mock-grid">
        <aside className="mock-routes">
          <header><strong>Routes</strong><button onClick={() => { const created: MockRoute = { id: uid('route'), name: 'New scenario', enabled: true, method: 'GET', path: '/resource', status: 200, headers: [], body: '{}', delayMs: 0 }; updateServer({ routes: [...server.routes, created] }); setActiveRouteId(created.id); }} type="button"><Icon name="plus" size={14} /> New route</button></header>
          <div>{server.routes.map((item) => <button className={route?.id === item.id ? 'active' : ''} key={item.id} onClick={() => setActiveRouteId(item.id)} type="button"><span className={`method method-${item.method.toLowerCase()}`}>{item.method}</span><span><strong>{item.path}</strong><small>{item.status} · {item.name}</small></span><i className={item.enabled ? 'enabled' : ''} /></button>)}</div>
        </aside>
        {route ? <div className="mock-route-editor">
          <div className="mock-route-bar"><select aria-label="Mock method" value={route.method} onChange={(event) => updateRoute({ method: event.target.value as MockRoute['method'] })}>{['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS', 'TRACE'].map((method) => <option key={method}>{method}</option>)}</select><input aria-label="Mock route path" value={route.path} onChange={(event) => updateRoute({ path: event.target.value })} /><label>Status<input aria-label="Mock status" min="100" max="599" type="number" value={route.status} onChange={(event) => updateRoute({ status: Number(event.target.value) })} /></label><label>Delay<input aria-label="Mock delay" min="0" max="30000" type="number" value={route.delayMs} onChange={(event) => updateRoute({ delayMs: Number(event.target.value) })} /></label></div>
          <div className="mock-route-meta"><input aria-label="Mock route name" value={route.name} onChange={(event) => updateRoute({ name: event.target.value })} /><label><input checked={route.enabled} type="checkbox" onChange={(event) => updateRoute({ enabled: event.target.checked })} /> Route enabled</label><button onClick={() => updateServer({ routes: server.routes.filter((candidate) => candidate.id !== route.id) })} type="button"><Icon name="trash" size={14} /> Delete</button></div>
          <div className="mock-header-editor">
            <header><strong>Response headers</strong><button onClick={() => updateRoute({ headers: [...route.headers, { id: uid('mock-header'), name: '', value: '', enabled: true }] })} type="button"><Icon name="plus" size={13} /> Add header</button></header>
            {route.headers.map((header) => <div className="mock-header-row" key={header.id}><input aria-label="Enable mock response header" checked={header.enabled} type="checkbox" onChange={(event) => updateRoute({ headers: route.headers.map((candidate) => candidate.id === header.id ? { ...candidate, enabled: event.target.checked } : candidate) })} /><input aria-label="Mock response header name" placeholder="Header" value={header.name} onChange={(event) => updateRoute({ headers: route.headers.map((candidate) => candidate.id === header.id ? { ...candidate, name: event.target.value } : candidate) })} /><input aria-label="Mock response header value" placeholder="Value" value={header.value} onChange={(event) => updateRoute({ headers: route.headers.map((candidate) => candidate.id === header.id ? { ...candidate, value: event.target.value } : candidate) })} /><button aria-label="Remove mock response header" onClick={() => updateRoute({ headers: route.headers.filter((candidate) => candidate.id !== header.id) })} type="button"><Icon name="trash" size={13} /></button></div>)}
            {!route.headers.length ? <span>No response headers configured.</span> : null}
          </div>
          <CodeEditor ariaLabel="Mock response body" value={route.body} onChange={(body) => updateRoute({ body })} />
        </div> : <AutomationEmpty title="No routes" action="Add route" onAction={() => { const created: MockRoute = { id: uid('route'), name: 'New scenario', enabled: true, method: 'GET', path: '/resource', status: 200, headers: [], body: '{}', delayMs: 0 }; updateServer({ routes: [created] }); setActiveRouteId(created.id); }} />}
        <aside className="mock-inspector"><div className={`mock-status-card${activeRun ? ' running' : ''}`}><i /><small>{activeRun ? 'Running locally' : 'Server stopped'}</small><strong>{activeRun?.baseUrl ?? `http://${server.host}:${server.port}`}</strong><span>{server.routes.filter((item) => item.enabled).length} enabled routes</span></div><h3>Dynamic tokens</h3><code>{'{{$timestamp}}'}</code><code>{'{{$randomUUID}}'}</code><code>{'{{request.path.id}}'}</code><p>Path tokens resolve from routes such as <code>/orders/{'{id}'}</code>.</p></aside>
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
