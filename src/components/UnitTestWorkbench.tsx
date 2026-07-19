import { useEffect, useMemo, useRef, useState } from 'react';
import type { DragEvent as ReactDragEvent, ReactNode } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { createBlankRequest } from '../data/seed';
import type { ApiRequest, Environment, HttpResponse, StoredResponse, UnitTest, UnitTestCaseResult, UnitTestRunResult, UnitTestSuite, Workspace } from '../types';
import { sendRequest as sendHttpRequest, type SendRequestContext } from '../lib/http';
import { storeResponseCookies } from '../lib/cookies';
import { createRequestSnapshot, retainResponseHistory } from '../lib/responseHistory';
import { applyCollectionConfiguration, collectionEnvironmentScopes, persistEffectiveAuthentication, requestAncestorNames, scriptEnvironmentScopes, variableScope } from '../lib/resources';
import { applyScriptSubresponse, runBrowserScript, type ScriptRunOptions } from '../lib/scriptSandbox';
import { createPluginRuntime, type PluginHostCallbacks, type PluginRunState } from '../lib/plugins';
import { readDesktopScriptFile, readDesktopTemplateFile } from '../lib/scriptFiles';
import { resolveAuthorizedExternalSecret } from '../lib/security';
import { createUnitTest, createUnitTestSuite, moveUnitTest, moveUnitTestSuite, moveUnitTestSuiteToCollection, orderedTestSuites, orderedUnitTests, unitTestScript, type UnitTestPlacement } from '../lib/unitTests';
import { CodeEditor } from './ProtocolEditors';
import { Icon } from './Icon';
import { OAuthAuthorizationDialog, type OAuthAuthorizationStatus } from './OAuthAuthorizationDialog';

const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

type UnitTestWorkbenchProps = {
  workspace: Workspace;
  suite: UnitTestSuite;
  activeEnvironment: Environment;
  vault: Record<string, string>;
  documentTabStrip: ReactNode;
  templatePrompt: SendRequestContext['prompt'];
  onChangeWorkspace: (updater: (workspace: Workspace) => Workspace) => void;
  onDeleteSuite: (suiteId: string) => void;
  onOpenSuite: (suiteId: string, permanent?: boolean) => void;
  onPromote: () => void;
};

const proxyPreferences = (workspace: Workspace) => ({
  enabled: workspace.preferences.proxyEnabled,
  httpProxy: workspace.preferences.httpProxy,
  httpsProxy: workspace.preferences.httpsProxy,
  noProxy: workspace.preferences.noProxy,
});

const folderScriptScopes = (folders: Workspace['collections'][number]['folders']) => (folders ?? []).map((folder) => {
  const scope = variableScope([folder.environment]);
  return { id: folder.id, name: folder.name, environment: scope.values, disabled: scope.disabled };
});

export function UnitTestWorkbench({ workspace, suite, activeEnvironment, vault, documentTabStrip, templatePrompt, onChangeWorkspace, onDeleteSuite, onOpenSuite, onPromote }: UnitTestWorkbenchProps) {
  const [expandedTests, setExpandedTests] = useState<Set<string>>(() => new Set(suite.tests.slice(0, 1).map((test) => test.id)));
  const [running, setRunning] = useState(false);
  const [liveResults, setLiveResults] = useState<UnitTestCaseResult[]>([]);
  const [selectedRunId, setSelectedRunId] = useState('');
  const [message, setMessage] = useState('');
  const [oauthAuthorization, setOAuthAuthorization] = useState<OAuthAuthorizationStatus>();
  const draggedSuiteId = useRef('');
  const draggedTestId = useRef('');
  const oauthFlowId = useRef('');
  const suites = useMemo(() => orderedTestSuites(workspace.testSuites), [workspace.testSuites]);
  const tests = useMemo(() => orderedUnitTests(suite.tests), [suite.tests]);
  const suiteCollection = workspace.collections.find((collection) => collection.id === suite.collectionId) ?? workspace.collections[0];
  const requests = useMemo(() => workspace.collections.filter((collection) => collection.id === suite.collectionId).flatMap((collection) => collection.requests
    .filter((request) => request.protocol === 'http' || request.protocol === 'graphql')
    .map((request) => ({ collection, request }))), [suite.collectionId, workspace.collections]);
  const runs = useMemo(() => workspace.unitTestResults.filter((result) => result.suiteId === suite.id), [suite.id, workspace.unitTestResults]);
  const selectedRun = runs.find((result) => result.id === selectedRunId) ?? runs[0];
  const visibleResults = running ? liveResults : selectedRun?.tests ?? [];

  useEffect(() => {
    setExpandedTests(new Set(suite.tests.slice(0, 1).map((test) => test.id)));
    setLiveResults([]);
    setSelectedRunId(workspace.unitTestResults.find((result) => result.suiteId === suite.id)?.id ?? '');
    setMessage('');
  }, [suite.id]);

  const cancelOAuthAuthorization = async () => {
    const flowId = oauthFlowId.current;
    if (!flowId) return;
    oauthFlowId.current = '';
    setOAuthAuthorization(undefined);
    try {
      const { cancelOAuth2Authorization } = await import('../lib/oauth2');
      await cancelOAuth2Authorization(flowId);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  };

  useEffect(() => () => {
    const flowId = oauthFlowId.current;
    oauthFlowId.current = '';
    if (flowId) void import('../lib/oauth2').then(({ cancelOAuth2Authorization }) => cancelOAuth2Authorization(flowId)).catch(() => undefined);
  }, []);

  const updateSuite = (updater: (current: UnitTestSuite) => UnitTestSuite) => {
    onPromote();
    onChangeWorkspace((current) => ({
      ...current,
      testSuites: current.testSuites.map((candidate) => candidate.id === suite.id ? updater(candidate) : candidate),
    }));
  };

  const updateTest = (testId: string, patch: Partial<UnitTest>) => updateSuite((current) => ({
    ...current,
    tests: current.tests.map((test) => test.id === testId ? { ...test, ...patch } : test),
  }));

  const addSuite = () => {
    const created = createUnitTestSuite(uid('test-suite'), workspace.testSuites, suite.collectionId || workspace.collections[0]?.id || '');
    onChangeWorkspace((current) => ({ ...current, testSuites: [...current.testSuites, created] }));
    onOpenSuite(created.id);
  };

  const addTest = () => {
    const requestId = requests[0]?.request.id ?? null;
    const created = createUnitTest(uid('unit-test'), suite.tests, requestId);
    updateSuite((current) => ({ ...current, tests: [...current.tests, created] }));
    setExpandedTests((current) => new Set(current).add(created.id));
  };

  const deleteTest = (test: UnitTest) => {
    if (workspace.preferences.confirmDestructive && !window.confirm(`Delete test “${test.name}”?`)) return;
    updateSuite((current) => ({ ...current, tests: current.tests.filter((candidate) => candidate.id !== test.id) }));
    setExpandedTests((current) => { const next = new Set(current); next.delete(test.id); return next; });
  };

  const deleteSuite = (candidate: UnitTestSuite) => {
    if (workspace.preferences.confirmDestructive && !window.confirm(`Delete test suite “${candidate.name}”?`)) return;
    onDeleteSuite(candidate.id);
  };

  const dropSuite = (event: ReactDragEvent<HTMLElement>, targetId: string) => {
    const sourceId = draggedSuiteId.current;
    draggedSuiteId.current = '';
    if (!sourceId || sourceId === targetId) return;
    onPromote();
    const bounds = event.currentTarget.getBoundingClientRect();
    const placement: UnitTestPlacement = event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after';
    onChangeWorkspace((current) => ({ ...current, testSuites: moveUnitTestSuite(current.testSuites, sourceId, targetId, placement) }));
  };

  const dropTest = (event: ReactDragEvent<HTMLElement>, targetId: string) => {
    const sourceId = draggedTestId.current;
    draggedTestId.current = '';
    if (!sourceId || sourceId === targetId) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const placement: UnitTestPlacement = event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after';
    updateSuite((current) => ({ ...current, tests: moveUnitTest(current.tests, sourceId, targetId, placement) }));
  };

  const run = async (selectedTests: UnitTest[]) => {
    if (running || !selectedTests.length) return;
    onPromote();
    setRunning(true);
    setLiveResults([]);
    setMessage('');
    const startedAt = new Date().toISOString();
    let runCookies = [...workspace.cookies];
    let runResponses = [...workspace.responses];
    const pluginState: PluginRunState = { data: structuredClone(workspace.pluginData), notifications: [] };
    const selectedGlobalEnvironment = workspace.environments.find((environment) => environment.id === workspace.activeEnvironmentId) ?? activeEnvironment;
    const globalScopes = scriptEnvironmentScopes(workspace.environments, selectedGlobalEnvironment.id);
    if (!globalScopes) {
      setRunning(false);
      setMessage('The active environment could not be resolved.');
      return;
    }
    const readTemplateFile = workspace.preferences.allowScriptFileAccess && isTauri()
      ? (path: string) => readDesktopTemplateFile(path, workspace.preferences.dataFolders)
      : undefined;
    const sendHttp = (request: ApiRequest, environment: Environment, context: SendRequestContext = {}) => sendHttpRequest(request, environment, {
      certificates: workspace.certificates,
      prompt: templatePrompt,
      readFile: readTemplateFile,
      requestAncestors: requestAncestorNames(workspace.collections, request),
      ...context,
    });
    const authorizeOAuth2 = async (request: ApiRequest, environment: Environment | undefined): Promise<ApiRequest['auth']> => {
      if (!environment) throw new Error('OAuth 2 browser authorization requires an active environment.');
      if (!isTauri()) throw new Error('Interactive OAuth 2 test authorization requires the Tauri app.');
      const oauth2 = await import('../lib/oauth2');
      const flowId = oauth2.createOAuth2FlowId();
      oauthFlowId.current = flowId;
      const variables = Object.fromEntries(environment.variables.filter((variable) => variable.enabled).map((variable) => [variable.name, variable.value]));
      const prepared = await oauth2.prepareOAuth2Authorization(request, variables, flowId);
      setOAuthAuthorization({ flowId, requestName: request.name, authorizationUrl: prepared.authorizationUrl, redirectUrl: prepared.redirectUrl });
      try {
        const completed = await oauth2.completeOAuth2Authorization(prepared, environment, {
          cookies: runCookies,
          responses: runResponses,
          preferredHttpVersion: workspace.preferences.preferredHttpVersion,
          maxRedirects: workspace.preferences.maxRedirects,
          followRedirects: workspace.preferences.followRedirects,
          requestTimeoutMs: workspace.preferences.requestTimeoutMs,
          validateCertificates: workspace.preferences.validateCertificates,
          validateAuthCertificates: workspace.preferences.validateAuthCertificates,
          proxy: proxyPreferences(workspace),
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
    const baseContext = (): SendRequestContext => ({
      cookies: runCookies,
      responses: runResponses,
      preferredHttpVersion: workspace.preferences.preferredHttpVersion,
      maxRedirects: workspace.preferences.maxRedirects,
      followRedirects: workspace.preferences.followRedirects,
      requestTimeoutMs: workspace.preferences.requestTimeoutMs,
      validateCertificates: workspace.preferences.validateCertificates,
      validateAuthCertificates: workspace.preferences.validateAuthCertificates,
      proxy: proxyPreferences(workspace),
      maxTimelineDataSizeKB: workspace.preferences.maxTimelineDataSizeKB,
      filterResponsesByEnv: workspace.preferences.filterResponsesByEnv,
      vault,
      externalSecret: (input) => resolveAuthorizedExternalSecret(workspace, input),
      authorizeOAuth2,
    });
    const pluginCallbacks: PluginHostCallbacks = {
      network: (request) => sendHttp(request, activeEnvironment, baseContext()),
      prompt: async (title, defaultValue) => window.prompt(title, defaultValue) ?? '',
      readClipboard: () => navigator.clipboard.readText(),
      writeClipboard: (value) => navigator.clipboard.writeText(value),
    };
    const pluginRuntime = createPluginRuntime(workspace.plugins, pluginState, pluginCallbacks);
    let resolveResponse: NonNullable<SendRequestContext['resolveResponse']>;
    const executeSavedRequest = async (requestId: string | undefined, requestChain: string[] = [], cookies = runCookies, responses = runResponses): Promise<{ response: HttpResponse; stored: StoredResponse }> => {
      if (!requestId) throw new Error('Select a request before calling insomnia.send().');
      const collection = workspace.collections.find((candidate) => candidate.id === suite.collectionId);
      const sourceRequest = collection?.requests.find((request) => request.id === requestId || request.name === requestId);
      if (!collection || !sourceRequest) throw new Error(`Could not find request ${requestId}`);
      if (sourceRequest.protocol !== 'http' && sourceRequest.protocol !== 'graphql') throw new Error('Standalone unit tests can send HTTP and GraphQL requests.');
      const configured = applyCollectionConfiguration(collection, sourceRequest, activeEnvironment);
      const response = await sendHttp(configured.request, configured.environment, {
        ...baseContext(),
        cookies,
        responses,
        requestChain,
        resolveResponse,
        pluginRuntime,
        onOAuth2Token: (updated) => onChangeWorkspace((current) => ({
          ...current,
          collections: current.collections.map((candidate) => candidate.id === collection.id ? persistEffectiveAuthentication(candidate, sourceRequest.id, updated.auth) : candidate),
        })),
      });
      const requestUrl = response.requestUrl ?? configured.request.url;
      const nextCookies = configured.request.transport.storeCookies ? storeResponseCookies(cookies, requestUrl, response.setCookies ?? []) : cookies;
      const stored: StoredResponse = {
        ...response,
        id: uid('response'),
        requestId: sourceRequest.id,
        requestName: sourceRequest.name,
        requestUrl,
        environmentId: configured.environment.id,
        globalEnvironmentId: selectedGlobalEnvironment.id,
        collectionEnvironmentId: collection.activeSubEnvironmentId ?? '',
        receivedAt: new Date().toISOString(),
        requestSnapshot: createRequestSnapshot(configured.request),
        requestTestResults: [],
        settingSendCookies: configured.request.transport.sendCookies,
        settingStoreCookies: configured.request.transport.storeCookies,
      };
      const nextResponses = retainResponseHistory(responses, stored, workspace.preferences.maxHistoryResponses, workspace.preferences.filterResponsesByEnv);
      cookies.splice(0, cookies.length, ...nextCookies);
      responses.splice(0, responses.length, ...nextResponses);
      runCookies = cookies;
      runResponses = responses;
      return { response, stored };
    };
    resolveResponse = async ({ requestId, requestChain, cookies, responses }) => (await executeSavedRequest(requestId, requestChain, cookies, responses)).stored;

    const completed: UnitTestCaseResult[] = [];
    for (const test of selectedTests) {
      const started = performance.now();
      const notificationIndex = pluginState.notifications.length;
      try {
        const target = requests.find((candidate) => candidate.request.id === test.requestId);
        const configured = target ? applyCollectionConfiguration(target.collection, target.request, activeEnvironment) : undefined;
        const request = configured?.request ?? createBlankRequest(`unit-test-${test.id}`);
        const collectionScopes = target ? collectionEnvironmentScopes(target.collection) : undefined;
        const scriptOptions: ScriptRunOptions = {
          baseGlobals: globalScopes.baseGlobals.values,
          baseGlobalDisabled: globalScopes.baseGlobals.disabled,
          globalDisabled: globalScopes.globals.disabled,
          globalsAreBase: globalScopes.globalsAreBase,
          baseEnvironment: collectionScopes?.baseEnvironment.values ?? {},
          baseEnvironmentDisabled: collectionScopes?.baseEnvironment.disabled ?? [],
          collectionVariables: collectionScopes?.environment.values ?? {},
          collectionDisabled: collectionScopes?.environment.disabled ?? [],
          collectionVariablesAreBase: collectionScopes?.environmentIsBase ?? true,
          folders: folderScriptScopes(configured?.folders),
          readFile: workspace.preferences.allowScriptFileAccess && isTauri() ? (path) => readDesktopScriptFile(path, workspace.preferences.dataFolders) : undefined,
          vault: workspace.preferences.enableVaultInScripts ? vault : undefined,
          sendRequestById: (requestId) => executeSavedRequest(requestId ?? test.requestId ?? undefined).then((result) => result.response),
          sendRequest: workspace.preferences.allowScriptRequests ? async (subrequest, variables) => {
            const environment = {
              ...activeEnvironment,
              variables: Object.entries(variables).map(([name, value]) => ({ id: `unit-test-${name}`, name, value, enabled: true })),
            };
            const response = await sendHttp(subrequest, environment, { ...baseContext(), resolveResponse });
            const state = applyScriptSubresponse(runCookies, runResponses, subrequest, response, undefined, activeEnvironment.id, workspace.preferences.maxHistoryResponses, workspace.preferences.filterResponsesByEnv, selectedGlobalEnvironment.id, target?.collection.activeSubEnvironmentId ?? '');
            runCookies = state.cookies;
            runResponses = state.responses;
            return response;
          } : undefined,
          maxSubrequests: 20,
        };
        const output = await runBrowserScript(unitTestScript(test), request, globalScopes.globals.values, undefined, workspace.preferences.scriptTimeoutMs, {}, {}, scriptOptions);
        const failed = output.tests.find((result) => !result.passed);
        const result: UnitTestCaseResult = {
          testId: test.id,
          name: test.name,
          requestId: test.requestId,
          passed: output.tests.length > 0 && !failed,
          durationMs: Math.max(0, Math.round(performance.now() - started)),
          ...(failed?.error ? { error: failed.error } : output.tests.length ? {} : { error: 'The test did not report a result.' }),
          logs: [...output.logs, ...pluginState.notifications.slice(notificationIndex).map((notification) => `[plugin] ${notification.title}: ${notification.message}`)],
        };
        completed.push(result);
        setLiveResults([...completed]);
      } catch (error) {
        const result: UnitTestCaseResult = {
          testId: test.id,
          name: test.name,
          requestId: test.requestId,
          passed: false,
          durationMs: Math.max(0, Math.round(performance.now() - started)),
          error: error instanceof Error ? error.message : String(error),
          logs: pluginState.notifications.slice(notificationIndex).map((notification) => `[plugin] ${notification.title}: ${notification.message}`),
        };
        completed.push(result);
        setLiveResults([...completed]);
      }
    }
    const runResult: UnitTestRunResult = {
      id: uid('unit-test-result'),
      suiteId: suite.id,
      startedAt,
      finishedAt: new Date().toISOString(),
      tests: completed,
    };
    onChangeWorkspace((current) => ({
      ...current,
      cookies: runCookies,
      responses: runResponses,
      pluginData: pluginState.data,
      unitTestResults: current.testSuites.some((candidate) => candidate.id === suite.id)
        ? [runResult, ...current.unitTestResults].slice(0, 100)
        : current.unitTestResults,
    }));
    setSelectedRunId(runResult.id);
    setRunning(false);
  };

  const moveSuiteOne = (candidate: UnitTestSuite, offset: number) => {
    const index = suites.findIndex((item) => item.id === candidate.id);
    const target = suites[index + offset];
    if (!target) return;
    onPromote();
    onChangeWorkspace((current) => ({ ...current, testSuites: moveUnitTestSuite(current.testSuites, candidate.id, target.id, offset < 0 ? 'before' : 'after') }));
  };

  const moveTestOne = (test: UnitTest, offset: number) => {
    const index = tests.findIndex((item) => item.id === test.id);
    const target = tests[index + offset];
    if (!target) return;
    updateSuite((current) => ({ ...current, tests: moveUnitTest(current.tests, test.id, target.id, offset < 0 ? 'before' : 'after') }));
  };

  const passed = visibleResults.filter((result) => result.passed).length;
  return <section className="test-suite-document">
    {documentTabStrip}
    <div className="test-suite-grid">
      <aside className="test-suite-sidebar">
        <header><div><small>Standalone tests</small><strong>Test suites</strong></div><button aria-label="New test suite" onClick={addSuite} type="button"><Icon name="plus" size={14} /></button></header>
        <div>{suites.map((candidate, index) => <article className={candidate.id === suite.id ? 'active' : ''} draggable key={candidate.id} onDragEnd={() => { draggedSuiteId.current = ''; }} onDragOver={(event) => event.preventDefault()} onDragStart={() => { draggedSuiteId.current = candidate.id; }} onDrop={(event) => dropSuite(event, candidate.id)}>
          <button onClick={(event) => onOpenSuite(candidate.id, event.metaKey || event.ctrlKey)} onDoubleClick={() => onOpenSuite(candidate.id, true)} type="button"><Icon name="check" size={13} /><span><strong>{candidate.name}</strong><small>{workspace.collections.find((collection) => collection.id === candidate.collectionId)?.name ?? 'Missing collection'} · {candidate.tests.length} test{candidate.tests.length === 1 ? '' : 's'}</small></span></button>
          <div><button aria-label={`Move ${candidate.name} up`} disabled={running || index === 0} onClick={() => moveSuiteOne(candidate, -1)} type="button">↑</button><button aria-label={`Move ${candidate.name} down`} disabled={running || index === suites.length - 1} onClick={() => moveSuiteOne(candidate, 1)} type="button">↓</button><button aria-label={`Delete ${candidate.name}`} disabled={running} onClick={() => deleteSuite(candidate)} type="button"><Icon name="trash" size={12} /></button></div>
        </article>)}</div>
      </aside>
      <main className="unit-test-editor">
        <header><input aria-label="Test suite name" onChange={(event) => updateSuite((current) => ({ ...current, name: event.target.value }))} value={suite.name} /><select aria-label="Test suite collection" onChange={(event) => { const collection = workspace.collections.find((candidate) => candidate.id === event.target.value); if (collection) updateSuite((current) => moveUnitTestSuiteToCollection(current, collection.id, new Set(collection.requests.map((request) => request.id)))); }} value={suiteCollection?.id ?? ''}>{workspace.collections.map((collection) => <option key={collection.id} value={collection.id}>{collection.name}</option>)}</select><div><button className="secondary-button" onClick={addTest} type="button"><Icon name="plus" size={13} /> New test</button><button className="primary-button" disabled={running || !tests.length} onClick={() => void run(tests)} type="button"><Icon name="play" size={13} /> {running ? 'Running…' : 'Run tests'}</button></div></header>
        <p className="unit-test-warning">Pinned Insomnia plans to deprecate standalone unit tests in favor of request scripts during 2026. They remain fully local and account-free here for compatibility.</p>
        <div className="unit-test-list">{tests.map((test, index) => {
          const expanded = expandedTests.has(test.id);
          const latest = visibleResults.find((result) => result.testId === test.id);
          return <article className="unit-test-card" draggable key={test.id} onDragEnd={() => { draggedTestId.current = ''; }} onDragOver={(event) => event.preventDefault()} onDragStart={() => { draggedTestId.current = test.id; }} onDrop={(event) => dropTest(event, test.id)}>
            <div className="unit-test-row"><button aria-label={`${expanded ? 'Collapse' : 'Expand'} ${test.name}`} onClick={() => setExpandedTests((current) => { const next = new Set(current); if (next.has(test.id)) next.delete(test.id); else next.add(test.id); return next; })} type="button"><Icon name={expanded ? 'chevron-down' : 'chevron-right'} size={13} /></button><input aria-label="Test name" onChange={(event) => updateTest(test.id, { name: event.target.value })} value={test.name} /><select aria-label={`Request for ${test.name}`} onChange={(event) => updateTest(test.id, { requestId: event.target.value || null })} value={test.requestId ?? ''}><option value="">Select a request</option>{suiteCollection ? <optgroup label={suiteCollection.name}>{suiteCollection.requests.filter((request) => request.protocol === 'http' || request.protocol === 'graphql').map((request) => <option key={request.id} value={request.id}>{request.protocol === 'graphql' ? 'GQL' : request.method} · {request.name}</option>)}</optgroup> : null}</select>{latest ? <span className={latest.passed ? 'ok' : 'bad'}>{latest.passed ? 'PASS' : 'FAIL'}</span> : null}<div><button aria-label={`Move ${test.name} up`} disabled={index === 0} onClick={() => moveTestOne(test, -1)} type="button">↑</button><button aria-label={`Move ${test.name} down`} disabled={index === tests.length - 1} onClick={() => moveTestOne(test, 1)} type="button">↓</button><button aria-label={`Delete ${test.name}`} onClick={() => deleteTest(test)} type="button"><Icon name="trash" size={13} /></button><button aria-label={`Run ${test.name}`} disabled={running} onClick={() => void run([test])} type="button"><Icon name="play" size={13} /></button></div></div>
            {expanded ? <div className="unit-test-code"><CodeEditor ariaLabel={`${test.name} JavaScript`} onChange={(code) => updateTest(test.id, { code })} value={test.code} /></div> : null}
          </article>;
        })}{!tests.length ? <div className="empty-state compact"><Icon name="code" size={28} /><strong>Add unit tests to verify your API</strong><span>Each test can send its selected request with insomnia.send().</span><button className="secondary-button" onClick={addTest} type="button">New test</button></div> : null}</div>
      </main>
      <aside className="unit-test-results">
        <header><div><small>{running ? 'Run in progress' : selectedRun ? new Date(selectedRun.finishedAt).toLocaleString() : 'No saved run'}</small><strong>Test results</strong></div>{runs.length ? <select aria-label="Saved unit test run" onChange={(event) => setSelectedRunId(event.target.value)} value={selectedRun?.id ?? ''}>{runs.map((result) => <option key={result.id} value={result.id}>{new Date(result.finishedAt).toLocaleString()} · {result.tests.filter((test) => test.passed).length}/{result.tests.length}</option>)}</select> : null}</header>
        <div className="unit-test-result-summary"><strong>{visibleResults.length}</strong><span>Total</span><strong className="ok">{passed}</strong><span>Passed</span><strong className={visibleResults.length - passed ? 'bad' : ''}>{visibleResults.length - passed}</strong><span>Failed</span></div>
        <div className="unit-test-result-list">{visibleResults.map((result) => <article className={result.passed ? 'passing' : 'failing'} key={`${result.testId}-${result.name}`}><i>{result.passed ? '✓' : '×'}</i><div><strong>{result.name}</strong><small>{result.durationMs} ms{result.requestId ? ` · ${requests.find((candidate) => candidate.request.id === result.requestId)?.request.name ?? result.requestId}` : ''}</small>{result.error ? <pre>{result.error}</pre> : null}{result.logs.map((log, index) => <code key={`${log}-${index}`}>{log}</code>)}</div></article>)}{!visibleResults.length ? <div className="empty-state compact"><Icon name="history" size={26} /><strong>No test results</strong><span>Run one test or the full suite to create local evidence.</span></div> : null}</div>
      </aside>
    </div>
    {message ? <div className="automation-message error" role="alert">{message}</div> : null}
    {oauthAuthorization ? <OAuthAuthorizationDialog onCancel={() => void cancelOAuthAuthorization()} status={oauthAuthorization} /> : null}
  </section>;
}
