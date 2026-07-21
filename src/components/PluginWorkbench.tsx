import { invoke, isTauri } from '@tauri-apps/api/core';
import { useEffect, useMemo, useState } from 'react';
import { sendRequest as sendHttpRequest, type SendRequestContext } from '../lib/http';
import { createBlankRequest } from '../data/seed';
import {
  applyPluginTheme,
  describePlugin,
  inferPluginPermissions,
  pluginPermissionLabels,
  pluginPermissions,
  pluginSourceText,
  pluginStarterSource,
  runPluginAction,
  validatePluginSource,
  validateRegistryPluginName,
  type PluginDescriptor,
  type PluginHostCallbacks,
  type PluginNotification,
} from '../lib/plugins';
import { discoverLocalPluginSources, readLocalPluginSource, readRegistryPluginSource, type LocalPluginSource } from '../lib/project';
import { installReviewedPlugin, pluginBaselineModules, pluginCuratedModules, pluginDependencyPackageName, pluginModuleVersions, pluginPackageChanged, requestedPluginModules, retainedPluginModuleGrants } from '../lib/pluginModules';
import { readDesktopTemplateFile } from '../lib/scriptFiles';
import { applyCollectionConfiguration, requestAncestorNames, resolveEnvironment } from '../lib/resources';
import { environmentMap } from '../lib/request';
import { storeResponseCookies } from '../lib/cookies';
import { createRequestSnapshot, retainResponseHistory } from '../lib/responseHistory';
import { getWorkspaceFileState, setWorkspaceFileCookies, workspaceFileIdForCollection, workspaceFileIdForRequest } from '../lib/workspaceFileState';
import type { DocumentTabType } from '../lib/requestTabs';
import type { PluginDependencyPackage, PluginPermission, PluginRecord, Workspace } from '../types';
import { Icon } from './Icon';

type PluginWorkbenchProps = {
  workspace: Workspace;
  onChangeWorkspace: (updater: (workspace: Workspace) => Workspace) => void;
  selectedDocumentId?: string;
  selectedDocumentType?: DocumentTabType;
  templatePrompt: SendRequestContext['prompt'];
};

const blankDescriptor: PluginDescriptor = { templates: [], actions: [], themes: [] };
const uid = () => `plugin-${crypto.randomUUID()}`;
const moduleGrantError = /^Module '.*' not permitted by manifest$/;

const describePluginForReview = async (plugin: PluginRecord) => {
  try { return await describePlugin(plugin); }
  catch (caught) {
    if (moduleGrantError.test(caught instanceof Error ? caught.message : String(caught))) return blankDescriptor;
    throw caught;
  }
};

const activeRequest = (workspace: Workspace) => workspace.collections
  .flatMap((collection) => collection.requests)
  .find((request) => request.id === workspace.activeRequestId);

export function PluginWorkbench({ workspace, onChangeWorkspace, selectedDocumentId, selectedDocumentType, templatePrompt }: PluginWorkbenchProps) {
  const activeFileId = workspaceFileIdForRequest(workspace, workspace.activeRequestId);
  const activeFileState = getWorkspaceFileState(workspace, activeFileId);
  const sendRequest = (...[request, environment, context]: Parameters<typeof sendHttpRequest>) => sendHttpRequest(request, environment, {
    prompt: templatePrompt,
    readFile: workspace.preferences.allowScriptFileAccess && isTauri()
      ? (path) => readDesktopTemplateFile(path, workspace.preferences.dataFolders)
      : undefined,
    requestAncestors: requestAncestorNames(workspace.collections, request),
    ...context,
    certificates: getWorkspaceFileState(workspace, workspaceFileIdForRequest(workspace, request.id) || activeFileId).certificates,
  });
  const [selectedId, setSelectedId] = useState(workspace.plugins[0]?.id ?? '');
  const [installName, setInstallName] = useState('Local plugin');
  const [installVersion, setInstallVersion] = useState('0.0.0-local');
  const [installDescription, setInstallDescription] = useState('Local CommonJS plugin');
  const [installSource, setInstallSource] = useState('');
  const [installSourcePath, setInstallSourcePath] = useState('');
  const [installModuleFiles, setInstallModuleFiles] = useState<Record<string, string> | undefined>();
  const [installEntryModuleKey, setInstallEntryModuleKey] = useState<string | undefined>();
  const [installDependencyModuleFiles, setInstallDependencyModuleFiles] = useState<Record<string, string> | undefined>();
  const [installDependencyPackages, setInstallDependencyPackages] = useState<Record<string, PluginDependencyPackage> | undefined>();
  const [installRequestedModules, setInstallRequestedModules] = useState<string[]>([]);
  const [installModuleWarnings, setInstallModuleWarnings] = useState<string[]>([]);
  const [installRegistryPackageName, setInstallRegistryPackageName] = useState('');
  const [localPath, setLocalPath] = useState('');
  const [registryPackageName, setRegistryPackageName] = useState('');
  const [draftSource, setDraftSource] = useState('');
  const [reviewModuleKey, setReviewModuleKey] = useState('');
  const [descriptor, setDescriptor] = useState<PluginDescriptor>(blankDescriptor);
  const [notifications, setNotifications] = useState<PluginNotification[]>([]);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const selected = workspace.plugins.find((plugin) => plugin.id === selectedId);
  const request = activeRequest(workspace);
  const selectedEnvironment = workspace.environments.find((environment) => environment.id === workspace.activeEnvironmentId);
  const effectiveEnvironment = selectedEnvironment ? resolveEnvironment(workspace.environments, selectedEnvironment.id) ?? selectedEnvironment : undefined;
  const actionCollection = workspace.collections.find((collection) => collection.requests.some((candidate) => candidate.id === request?.id));
  const proxyPreferences = {
    enabled: workspace.preferences.proxyEnabled,
    httpProxy: workspace.preferences.httpProxy,
    httpsProxy: workspace.preferences.httpsProxy,
    noProxy: workspace.preferences.noProxy,
  };
  const requested = useMemo(() => new Set(selected?.requestedPermissions ?? []), [selected?.requestedPermissions]);
  const requestedModules = useMemo(() => new Set(selected?.requestedModules ?? []), [selected?.requestedModules]);
  const reviewModuleKeys = useMemo(() => Object.keys({ ...(selected?.moduleFiles ?? {}), ...(selected?.dependencyModuleFiles ?? {}) }).sort(), [selected?.dependencyModuleFiles, selected?.moduleFiles]);
  const reviewedModuleSource = selected && reviewModuleKey
    ? reviewModuleKey === selected.entryModuleKey ? selected.source : selected.moduleFiles?.[reviewModuleKey] ?? selected.dependencyModuleFiles?.[reviewModuleKey] ?? ''
    : '';
  const updatingRegistryPlugin = installRegistryPackageName
    ? workspace.plugins.find((plugin) => plugin.registryPackageName === installRegistryPackageName)
    : undefined;

  const changeWorkspace = (updater: (current: Workspace) => Workspace) => onChangeWorkspace(updater);
  const updatePlugin = (id: string, patch: Partial<PluginRecord>) => changeWorkspace((current) => ({
    ...current,
    plugins: current.plugins.map((plugin) => plugin.id === id ? { ...plugin, ...patch } : plugin),
  }));
  const replacePluginAfterAuthorityChange = (plugin: PluginRecord) => changeWorkspace((current) => ({
    ...current,
    plugins: current.plugins.map((candidate) => candidate.id === plugin.id ? plugin : candidate),
    pluginData: Object.fromEntries(Object.entries(current.pluginData).filter(([id]) => id !== plugin.id)),
    activePluginTheme: current.activePluginTheme.startsWith(`${plugin.id}::`) ? '' : current.activePluginTheme,
  }));
  const run = async (label: string, operation: () => Promise<void>) => {
    if (busy) return;
    setBusy(label); setError(''); setMessage('');
    try { await operation(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
    finally { setBusy(''); }
  };

  useEffect(() => {
    if (!selected && workspace.plugins[0]) setSelectedId(workspace.plugins[0].id);
  }, [selected, workspace.plugins]);

  useEffect(() => {
    setDraftSource(selected?.source ?? '');
    setReviewModuleKey(selected?.entryModuleKey ?? Object.keys({ ...(selected?.moduleFiles ?? {}), ...(selected?.dependencyModuleFiles ?? {}) })[0] ?? '');
    setDescriptor(blankDescriptor);
    if (!selected) return;
    let cancelled = false;
    void describePluginForReview(selected).then((value) => { if (!cancelled) setDescriptor(value); }).catch((caught) => {
      if (!cancelled) setError(caught instanceof Error ? caught.message : String(caught));
    });
    return () => { cancelled = true; };
  }, [selected]);

  let resolveResponse: NonNullable<SendRequestContext['resolveResponse']>;
  resolveResponse = async ({ requestId, requestChain, cookies, responses }) => {
    const dependencyCollection = workspace.collections.find((candidate) => candidate.requests.some((item) => item.id === requestId || item.name === requestId));
    const dependency = dependencyCollection?.requests.find((item) => item.id === requestId || item.name === requestId);
    const selectedEnvironment = workspace.environments.find((environment) => environment.id === workspace.activeEnvironmentId);
    const environment = selectedEnvironment ? resolveEnvironment(workspace.environments, selectedEnvironment.id) ?? selectedEnvironment : undefined;
    if (!dependencyCollection || !dependency) throw new Error(`Could not find request ${requestId}`);
    if (!environment) throw new Error('Select an environment before resending a dependent request.');
    const configured = applyCollectionConfiguration(dependencyCollection, dependency, environment);
    const dependencyFileId = workspaceFileIdForCollection(workspace, dependencyCollection.id);
    const callerRequestId = requestChain.at(-2);
    const callerFileId = callerRequestId ? workspaceFileIdForRequest(workspace, callerRequestId) : activeFileId;
    const dependencyCookies = dependencyFileId === callerFileId ? cookies : [...getWorkspaceFileState(workspace, dependencyFileId).cookies];
    const result = await sendRequest(configured.request, configured.environment, {
      cookies: dependencyCookies,
      responses,
      preferredHttpVersion: workspace.preferences.preferredHttpVersion,
      maxRedirects: workspace.preferences.maxRedirects,
      followRedirects: workspace.preferences.followRedirects,
      requestTimeoutMs: workspace.preferences.requestTimeoutMs,
      validateCertificates: workspace.preferences.validateCertificates,
      validateAuthCertificates: workspace.preferences.validateAuthCertificates,
      proxy: proxyPreferences,
      maxTimelineDataSizeKB: workspace.preferences.maxTimelineDataSizeKB,
      filterResponsesByEnv: workspace.preferences.filterResponsesByEnv,
      requestChain: [...new Set([...requestChain, dependency.id])],
      resolveResponse,
    });
    const requestUrl = result.requestUrl ?? configured.request.url;
    const stored = {
      ...result,
      id: `response-${crypto.randomUUID()}`,
      requestId: dependency.id,
      requestName: dependency.name,
      requestUrl,
      environmentId: configured.environment.id,
      globalEnvironmentId: environment.id,
      collectionEnvironmentId: dependencyCollection.activeSubEnvironmentId ?? '',
      receivedAt: new Date().toISOString(),
      requestSnapshot: createRequestSnapshot(dependency),
      requestTestResults: [],
      settingSendCookies: configured.request.transport.sendCookies,
      settingStoreCookies: configured.request.transport.storeCookies,
    };
    if (configured.request.transport.storeCookies) {
      dependencyCookies.splice(0, dependencyCookies.length, ...storeResponseCookies(dependencyCookies, requestUrl, result.setCookies ?? []));
    }
    const updatedResponses = retainResponseHistory(responses, stored, workspace.preferences.maxHistoryResponses, workspace.preferences.filterResponsesByEnv);
    responses.splice(0, responses.length, ...updatedResponses);
    onChangeWorkspace((current) => {
      const updated = { ...current, responses: [...responses] };
      return configured.request.transport.storeCookies ? setWorkspaceFileCookies(updated, dependencyFileId, [...dependencyCookies]) : updated;
    });
    return stored;
  };

  const install = () => run('Reviewing plugin', async () => {
    validatePluginSource(installSource);
    const id = uid();
    const sourceText = pluginSourceText({ source: installSource, moduleFiles: installModuleFiles, entryModuleKey: installEntryModuleKey, dependencyModuleFiles: installDependencyModuleFiles });
    const plugin: PluginRecord = {
      id,
      name: installName.trim() || 'Local plugin',
      version: installVersion.trim() || '0.0.0-local',
      description: installDescription.trim(),
      source: installSource,
      sourcePath: installSourcePath || undefined,
      registryPackageName: installRegistryPackageName || undefined,
      moduleFiles: installModuleFiles,
      entryModuleKey: installEntryModuleKey,
      dependencyModuleFiles: installDependencyModuleFiles,
      dependencyPackages: installDependencyPackages,
      sourceFormat: 'insomnia-commonjs',
      enabled: false,
      requestedModules: requestedPluginModules(sourceText, installRequestedModules),
      grantedModules: [],
      moduleWarnings: installModuleWarnings,
      requestedPermissions: inferPluginPermissions(sourceText),
      grantedPermissions: [],
      installedAt: new Date().toISOString(),
    };
    const found = await describePluginForReview(plugin);
    const result = installReviewedPlugin(workspace, plugin);
    changeWorkspace(() => result.workspace);
    setSelectedId(result.plugin.id); setDescriptor(found); setInstallSource(''); setInstallSourcePath(''); setInstallRegistryPackageName(''); setInstallModuleFiles(undefined); setInstallEntryModuleKey(undefined); setInstallDependencyModuleFiles(undefined); setInstallDependencyPackages(undefined); setInstallRequestedModules([]); setInstallModuleWarnings([]);
    setMessage(!result.replaced
      ? 'Plugin installed disabled. Review and grant only the capabilities it needs.'
      : result.changed
        ? 'Plugin package updated with changed code. It is disabled and its data and grants were cleared for review.'
        : 'Plugin package metadata refreshed. Existing authority was preserved because its code and module requests are unchanged.');
  });

  const loadLocal = () => run('Reading local plugin', async () => {
    const output = await readLocalPluginSource(localPath);
    setInstallName(output.name); setInstallVersion(output.version); setInstallDescription(output.description); setInstallSource(output.source);
    setInstallSourcePath(output.path); setInstallRegistryPackageName(''); setInstallModuleFiles(output.moduleFiles); setInstallEntryModuleKey(output.entryModuleKey); setInstallDependencyModuleFiles(output.dependencyModuleFiles); setInstallDependencyPackages(output.dependencyPackages);
    setInstallRequestedModules(output.requestedModules); setInstallModuleWarnings(output.moduleWarnings);
    setMessage(`Loaded ${output.path}. Review the source before installing.`);
  });

  const fetchRegistrySource = async (requestedPackageName: string) => {
    const packageName = requestedPackageName.trim();
    validateRegistryPluginName(packageName);
    const output = await readRegistryPluginSource({
      packageName,
      registryUrl: workspace.preferences.pluginRegistryUrl,
      validateCertificates: workspace.preferences.validateCertificates,
      caCertificatePem: activeFileState.certificates.ca.enabled ? activeFileState.certificates.ca.pem : '',
      proxyEnabled: workspace.preferences.proxyEnabled,
      httpProxy: workspace.preferences.httpProxy,
      httpsProxy: workspace.preferences.httpsProxy,
      noProxy: workspace.preferences.noProxy,
    });
    validatePluginSource(output.source);
    setInstallName(output.name); setInstallVersion(output.version); setInstallDescription(output.description); setInstallSource(output.source);
    setInstallSourcePath(''); setInstallRegistryPackageName(packageName); setInstallModuleFiles(output.moduleFiles); setInstallEntryModuleKey(output.entryModuleKey); setInstallDependencyModuleFiles(output.dependencyModuleFiles); setInstallDependencyPackages(output.dependencyPackages);
    setInstallRequestedModules(output.requestedModules); setInstallModuleWarnings(output.moduleWarnings);
    setRegistryPackageName(packageName); setSelectedId('');
    const existing = workspace.plugins.find((plugin) => plugin.registryPackageName === packageName);
    setMessage(`Fetched ${output.path}. Review every module before ${existing ? `updating v${existing.version}` : 'installing it disabled'}.`);
  };

  const loadRegistry = () => run('Fetching registry plugin', () => fetchRegistrySource(registryPackageName));
  const reloadRegistrySelected = () => run('Checking registry plugin', async () => {
    if (!selected?.registryPackageName) throw new Error('This plugin has no linked registry package.');
    await fetchRegistrySource(selected.registryPackageName);
  });

  const discoverLocal = () => run('Discovering plugin packages', async () => {
    const output = await discoverLocalPluginSources(localPath);
    const warnings = [...output.warnings];
    const candidates: Array<{ output: LocalPluginSource; plugin: PluginRecord }> = [];
    for (const discovered of output.plugins) {
      try {
        validatePluginSource(discovered.source);
        const existing = workspace.plugins.find((plugin) => plugin.sourcePath === discovered.path);
        const sourceText = pluginSourceText({ source: discovered.source, moduleFiles: discovered.moduleFiles, entryModuleKey: discovered.entryModuleKey, dependencyModuleFiles: discovered.dependencyModuleFiles });
        const plugin: PluginRecord = {
          id: existing?.id ?? uid(),
          name: discovered.name,
          version: discovered.version,
          description: discovered.description,
          source: discovered.source,
          sourcePath: discovered.path,
          moduleFiles: discovered.moduleFiles,
          entryModuleKey: discovered.entryModuleKey,
          dependencyModuleFiles: discovered.dependencyModuleFiles,
          dependencyPackages: discovered.dependencyPackages,
          sourceFormat: 'insomnia-commonjs',
          enabled: false,
          requestedModules: requestedPluginModules(sourceText, discovered.requestedModules),
          grantedModules: [],
          moduleWarnings: discovered.moduleWarnings,
          requestedPermissions: inferPluginPermissions(sourceText),
          grantedPermissions: [],
          installedAt: existing?.installedAt ?? new Date().toISOString(),
        };
        await describePluginForReview(plugin);
        candidates.push({ output: discovered, plugin });
      } catch (caught) {
        warnings.push(`${discovered.path}: ${caught instanceof Error ? caught.message : String(caught)}`);
      }
    }
    if (!candidates.length) throw new Error(warnings.join(' ') || 'No compatible plugin packages were discovered.');
    const firstId = candidates[0].plugin.id;
    changeWorkspace((current) => {
      const plugins = [...current.plugins];
      const pluginData = { ...current.pluginData };
      let activePluginTheme = current.activePluginTheme;
      for (const candidate of candidates) {
        const index = plugins.findIndex((plugin) => plugin.sourcePath === candidate.output.path);
        if (index < 0) {
          plugins.push(candidate.plugin);
          continue;
        }
        const previous = plugins[index];
        const changed = pluginPackageChanged(previous, candidate.plugin);
        plugins[index] = changed ? candidate.plugin : {
          ...previous,
          name: candidate.plugin.name,
          version: candidate.plugin.version,
          description: candidate.plugin.description,
          sourcePath: candidate.plugin.sourcePath,
          moduleFiles: candidate.plugin.moduleFiles,
          entryModuleKey: candidate.plugin.entryModuleKey,
          dependencyModuleFiles: candidate.plugin.dependencyModuleFiles,
          dependencyPackages: candidate.plugin.dependencyPackages,
          requestedModules: candidate.plugin.requestedModules,
          grantedModules: retainedPluginModuleGrants(previous.grantedModules, candidate.plugin.requestedModules),
          moduleWarnings: candidate.plugin.moduleWarnings,
          requestedPermissions: candidate.plugin.requestedPermissions,
          error: undefined,
        };
        if (changed) {
          delete pluginData[previous.id];
          if (activePluginTheme.startsWith(`${previous.id}::`)) activePluginTheme = '';
        }
      }
      return { ...current, plugins, pluginData, activePluginTheme };
    });
    setSelectedId(firstId);
    setMessage(`Discovered ${candidates.length} plugin package${candidates.length === 1 ? '' : 's'} disabled for review.${warnings.length ? ` ${warnings.slice(0, 3).join(' ')}` : ''}`);
  });

  const reloadSelected = () => run('Reloading local plugin', async () => {
    if (!selected?.sourcePath) throw new Error('This plugin has no linked local source path.');
    const output = await readLocalPluginSource(selected.sourcePath);
    validatePluginSource(output.source);
    const sourceText = pluginSourceText(output);
    const next: PluginRecord = { ...selected, name: output.name, version: output.version, description: output.description, source: output.source, sourcePath: output.path, registryPackageName: undefined, moduleFiles: output.moduleFiles, entryModuleKey: output.entryModuleKey, dependencyModuleFiles: output.dependencyModuleFiles, dependencyPackages: output.dependencyPackages, enabled: false, requestedModules: requestedPluginModules(sourceText, output.requestedModules), grantedModules: [], moduleWarnings: output.moduleWarnings, requestedPermissions: inferPluginPermissions(sourceText), grantedPermissions: [], error: undefined };
    const found = await describePluginForReview(next);
    replacePluginAfterAuthorityChange(next);
    setDescriptor(found); setDraftSource(output.source);
    setMessage('Local package reloaded. Review permissions before enabling it again.');
  });

  const sendPluginNetwork = async (pluginRequest: Parameters<NonNullable<PluginHostCallbacks['network']>>[0]) => sendRequest(pluginRequest, effectiveEnvironment, {
    cookies: [...activeFileState.cookies],
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
    resolveResponse,
  });
  const callbacks: PluginHostCallbacks = {
    network: sendPluginNetwork,
    prompt: async (title, defaultValue) => window.prompt(title, defaultValue) ?? '',
    dialog: async (title, message) => { window.alert(`${title}${message ? `\n\n${message}` : ''}`); },
    readClipboard: async () => navigator.clipboard.readText(),
    writeClipboard: async (value) => navigator.clipboard.writeText(value),
    clearClipboard: async () => navigator.clipboard.writeText(''),
    getPath: async (name) => {
      if (name.toLowerCase() !== 'desktop') throw new Error(`Unknown plugin path '${name}'.`);
      if (!isTauri()) throw new Error('Plugin desktop paths are available only in the Tauri app.');
      return invoke<string>('plugin_desktop_path');
    },
    showSaveDialog: async (defaultPath) => isTauri() ? window.prompt('Choose a save path', defaultPath) : null,
    importData: async (source, value) => {
      let contents = value;
      if (source === 'uri') {
        const importRequest = createBlankRequest(`plugin-import-${crypto.randomUUID()}`);
        importRequest.name = 'Plugin import'; importRequest.url = value; importRequest.method = 'GET'; importRequest.bodyMode = 'none';
        const response = await sendPluginNetwork(importRequest);
        if (response.status < 200 || response.status >= 300) throw new Error(`Plugin import URL returned ${response.status} ${response.statusText}.`);
        contents = response.body;
      }
      const [{ importArtifact }, { applyArtifactImport }] = await Promise.all([import('../lib/interchange'), import('../lib/interchange/apply')]);
      const result = importArtifact(contents, source === 'uri' ? value : `${selected?.name ?? 'Plugin'} import`);
      changeWorkspace((current) => applyArtifactImport(current, result));
    },
    exportData: async (format, options) => {
      const { exportArtifact } = await import('../lib/interchange/exporters');
      const target = options.workspace as { id?: string } | undefined;
      const collection = target?.id ? workspace.collections.find((candidate) => candidate.id === target.id) : undefined;
      const design = target?.id ? workspace.apiDesigns.find((candidate) => candidate.id === target.id) : undefined;
      const scope = collection ? 'collection' : design ? 'design' : 'all';
      return exportArtifact(workspace, { format: format === 'har' ? 'har' : options.format === 'json' ? 'insomnia-v4' : 'insomnia-v5', scope, collectionId: collection?.id, designId: design?.id, includePrivateEnvironments: options.includePrivate === true }).contents;
    },
    environment: environmentMap(effectiveEnvironment),
  };

  const runAction = (actionId: string) => run('Running plugin action', async () => {
    if (!selected || !request) throw new Error('Choose a plugin and active request first.');
    const action = descriptor.actions.find((candidate) => candidate.id === actionId);
    if (!action) throw new Error('The plugin action was not found.');
    const output = await runPluginAction(selected, action, request, workspace, workspace.pluginData[selected.id] ?? {}, callbacks, {
      requestId: request.id,
      collectionId: actionCollection?.id,
      folderId: request.folderId || undefined,
      designId: selectedDocumentType === 'document' ? selectedDocumentId : undefined,
    });
    changeWorkspace((current) => ({
      ...current,
      collections: output.request ? current.collections.map((collection) => ({
        ...collection,
        requests: collection.requests.map((candidate) => candidate.id === output.request?.id ? output.request : candidate),
      })) : current.collections,
      pluginData: { ...current.pluginData, [selected.id]: output.store },
    }));
    setNotifications((current) => [...current, ...output.notifications]);
    setMessage(`${action.label} completed.`);
  });

  const selectTheme = (value: string) => {
    const theme = descriptor.themes.find((candidate) => `${selected?.id}::${candidate.id}` === value);
    applyPluginTheme(theme);
    changeWorkspace((current) => ({ ...current, activePluginTheme: value }));
  };

  return (
    <section className="plugin-workbench">
      <header className="plugin-header">
        <div><small>Extensibility</small><h1>Local plugins</h1><p>Run pasted or bounded multi-file Insomnia-style CommonJS packages inside a time-limited Worker with explicit permissions.</p></div>
        <span className="local-only-badge">Local · no paid gate</span>
      </header>

      <div className="plugin-layout">
        <aside className="plugin-sidebar">
          <header><strong>Installed</strong><span>{workspace.plugins.length}</span></header>
          <div className="plugin-list">
            {workspace.plugins.map((plugin) => <button className={plugin.id === selectedId ? 'active' : ''} key={plugin.id} onClick={() => setSelectedId(plugin.id)} type="button"><span className={plugin.enabled ? 'plugin-state enabled' : 'plugin-state'} /><span><strong>{plugin.name}</strong><small>v{plugin.version} · {plugin.enabled ? 'enabled' : 'disabled'}</small></span></button>)}
            {!workspace.plugins.length ? <p>No plugins installed.</p> : null}
          </div>
          <button className="secondary-button" onClick={() => { setSelectedId(''); setInstallSource(''); setInstallSourcePath(''); setInstallRegistryPackageName(''); setInstallModuleFiles(undefined); setInstallEntryModuleKey(undefined); setInstallDependencyModuleFiles(undefined); setInstallDependencyPackages(undefined); setInstallRequestedModules([]); setInstallModuleWarnings([]); }} type="button"><Icon name="plus" size={15} /> Install plugin</button>
          <button className="secondary-button quiet" onClick={() => { setSelectedId(''); setInstallSource(pluginStarterSource); setInstallSourcePath(''); setInstallRegistryPackageName(''); setInstallModuleFiles(undefined); setInstallEntryModuleKey(undefined); setInstallDependencyModuleFiles(undefined); setInstallDependencyPackages(undefined); setInstallRequestedModules([]); setInstallModuleWarnings([]); setInstallName('Brunomnia starter'); setInstallVersion('0.1.0'); setInstallDescription('Starter request hook, template tag, and action'); }} type="button"><Icon name="code" size={15} /> Use starter source</button>
        </aside>

        <div className="plugin-main">
          {selected ? <>
            <section className="plugin-card plugin-summary">
              <header><div><small>Installed plugin</small><h2>{selected.name}</h2><p>{selected.description || 'No description provided.'}{selected.registryPackageName ? ` · ${selected.registryPackageName}` : ''}</p></div><div className="plugin-summary-actions"><label className="switch-label"><input checked={selected.enabled} onChange={(event) => updatePlugin(selected.id, { enabled: event.target.checked, error: undefined })} type="checkbox" /> Enabled</label>{selected.sourcePath ? <button disabled={Boolean(busy)} onClick={reloadSelected} type="button"><Icon name="refresh" size={15} /> Reload source</button> : null}{selected.registryPackageName ? <button disabled={Boolean(busy)} onClick={reloadRegistrySelected} type="button"><Icon name="refresh" size={15} /> Check registry</button> : null}<button onClick={() => changeWorkspace((current) => ({ ...current, plugins: current.plugins.filter((plugin) => plugin.id !== selected.id), pluginData: Object.fromEntries(Object.entries(current.pluginData).filter(([id]) => id !== selected.id)), activePluginTheme: current.activePluginTheme.startsWith(`${selected.id}::`) ? '' : current.activePluginTheme }))} type="button"><Icon name="trash" size={15} /> Remove</button></div></header>
              <div className="plugin-capability-summary"><span>{descriptor.templates.length} tags</span><span>{descriptor.actions.length} actions</span><span>{descriptor.themes.length} themes</span><span>{Object.keys(selected.dependencyPackages ?? {}).length} dependencies</span><span>{selected.sourceFormat}</span></div>
            </section>

            <section className="plugin-card"><header><div><small>Capability boundary</small><h2>Permissions</h2><p>Detected permissions are marked “requested.” Nothing is available until you grant it.</p></div></header><div className="permission-grid">{pluginPermissions.map((permission) => <label key={permission}><input checked={selected.grantedPermissions.includes(permission)} onChange={(event) => updatePlugin(selected.id, { grantedPermissions: event.target.checked ? [...selected.grantedPermissions, permission] : selected.grantedPermissions.filter((candidate) => candidate !== permission) })} type="checkbox" /><span><strong>{pluginPermissionLabels[permission]}</strong><small>{requested.has(permission) ? 'Requested by source' : 'Not detected'}</small></span></label>)}</div></section>

            <section className="plugin-card"><header><div><small>Curated CommonJS</small><h2>Module grants</h2><p>`{pluginBaselineModules.join('`, `')}` are always available. Every other bare module must be requested and explicitly granted.</p></div></header><div className="permission-grid">{[...requestedModules].map((module) => {
              const curated = (pluginCuratedModules as readonly string[]).includes(module);
              const dependencyName = pluginDependencyPackageName(module);
              const dependency = dependencyName ? selected.dependencyPackages?.[dependencyName] : undefined;
              const available = curated || Boolean(dependency);
              const version = curated && module in pluginModuleVersions ? pluginModuleVersions[module as keyof typeof pluginModuleVersions] : dependency?.version ?? '';
              return <label key={module}><input checked={(selected.grantedModules ?? []).includes(module)} disabled={!available} onChange={(event) => updatePlugin(selected.id, { grantedModules: event.target.checked ? [...(selected.grantedModules ?? []), module] : (selected.grantedModules ?? []).filter((candidate) => candidate !== module) })} type="checkbox" /><span><strong>{module}</strong><small>{available ? `Requested · ${curated ? 'curated' : `reviewed dependency ${dependencyName}`}${version ? ` v${version}` : ''}` : 'Requested · unavailable in sandbox'}</small></span></label>;
            })}{!requestedModules.size ? <p>No grantable bare modules detected.</p> : null}</div>{selected.moduleWarnings?.map((warning) => <p key={warning}>{warning}</p>)}</section>

            <section className="plugin-card"><header><div><small>Exports</small><h2>Actions, tags, and theme</h2></div></header><div className="plugin-tools"><div><strong>Actions</strong>{descriptor.actions.map((action) => <button disabled={!selected.enabled || !selected.grantedPermissions.includes('action') || Boolean(busy) || (action.kind === 'request-group' && !request?.folderId) || (action.kind === 'document' && selectedDocumentType !== 'document' && !workspace.apiDesigns.length)} key={action.id} onClick={() => runAction(action.id)} type="button">{action.label}<small>{action.kind}</small></button>)}{!descriptor.actions.length ? <p>No actions exported.</p> : null}</div><div><strong>Template tags</strong>{descriptor.templates.map((tag) => <code key={tag.name}>{`{% ${tag.name} %}`}</code>)}{!descriptor.templates.length ? <p>No tags exported.</p> : null}</div><label><strong>Theme</strong><select disabled={!selected.enabled || !selected.grantedPermissions.includes('theme')} value={workspace.activePluginTheme.startsWith(`${selected.id}::`) ? workspace.activePluginTheme : ''} onChange={(event) => selectTheme(event.target.value)}><option value="">System theme</option>{descriptor.themes.map((theme) => <option key={theme.id} value={`${selected.id}::${theme.id}`}>{theme.displayName}</option>)}</select></label></div></section>

            <section className="plugin-card plugin-source-card"><header><div><small>Source</small><h2>Review and update</h2><p>Updating only the entry source detaches the linked local or registry package, disables the plugin, and clears dependencies, data, theme, and grants so changed code cannot inherit old authority.</p></div><button disabled={draftSource === selected.source || Boolean(busy)} onClick={() => run('Updating source', async () => { validatePluginSource(draftSource); const next = { ...selected, source: draftSource, sourcePath: undefined, registryPackageName: undefined, moduleFiles: undefined, entryModuleKey: undefined, dependencyModuleFiles: undefined, dependencyPackages: undefined, enabled: false, requestedModules: requestedPluginModules(draftSource), grantedModules: [] as string[], moduleWarnings: [], requestedPermissions: inferPluginPermissions(draftSource), grantedPermissions: [] as PluginPermission[], error: undefined }; const found = await describePluginForReview(next); replacePluginAfterAuthorityChange(next); setDescriptor(found); setMessage('Source updated. Review permissions and modules before enabling it again.'); })} type="button">Apply source</button></header><textarea aria-label="Plugin source" spellCheck={false} value={draftSource} onChange={(event) => setDraftSource(event.target.value)} /></section>
            {reviewModuleKeys.length > 1 ? <section className="plugin-card plugin-module-review"><header><div><small>Package map</small><h2>Review every module</h2><p>Bounded package-local and pure-CommonJS dependency JavaScript/JSON source is retained for review. Hidden folders, scripts, binaries, and native addons are excluded.</p></div></header><label><strong>Module</strong><select value={reviewModuleKey} onChange={(event) => setReviewModuleKey(event.target.value)}>{reviewModuleKeys.map((key) => <option key={key} value={key}>{key}{key === selected.entryModuleKey ? ' (entry)' : key.startsWith('node_modules/') ? ' (dependency)' : ''}</option>)}</select></label><textarea aria-label="Plugin package module source" readOnly spellCheck={false} value={reviewedModuleSource} /></section> : null}
          </> : <section className="plugin-card plugin-installer">
            <header><div><small>Install</small><h2>Fetch and review CommonJS source</h2><p>Fetch an unscoped `insomnia-plugin-*` package, read a local package, or paste source. Registry downloads verify each advertised SHA-1 and resolve a bounded pure-CommonJS production graph without running package scripts. Native addons, ESM-only packages, peers, aliases, Git, and local specs remain excluded.</p></div></header>
            {isTauri() ? <>
              <div className="registry-plugin-row">
                <input aria-label="Registry plugin package" autoCapitalize="none" autoComplete="off" spellCheck={false} value={registryPackageName} onChange={(event) => setRegistryPackageName(event.target.value)} placeholder="insomnia-plugin-example" />
                <input aria-label="Plugin registry URL" autoCapitalize="none" autoComplete="off" spellCheck={false} value={workspace.preferences.pluginRegistryUrl} onChange={(event) => changeWorkspace((current) => ({ ...current, preferences: { ...current.preferences, pluginRegistryUrl: event.target.value.slice(0, 4_096) } }))} placeholder="https://registry.npmjs.org/" />
                <button disabled={!registryPackageName.trim() || !workspace.preferences.pluginRegistryUrl.trim() || Boolean(busy)} onClick={loadRegistry} type="button"><Icon name="search" size={15} /> Fetch for review</button>
              </div>
              <div className="local-plugin-row"><input value={localPath} onChange={(event) => setLocalPath(event.target.value)} placeholder="/path/to/plugin, plugins folder, or node_modules" /><button disabled={!localPath || Boolean(busy)} onClick={loadLocal} type="button"><Icon name="folder" size={15} /> Read one</button><button disabled={!localPath || Boolean(busy)} onClick={discoverLocal} type="button"><Icon name="search" size={15} /> Discover</button></div>
            </> : null}
            <div className="plugin-metadata"><input value={installName} onChange={(event) => setInstallName(event.target.value)} placeholder="Plugin name" /><input value={installVersion} onChange={(event) => setInstallVersion(event.target.value)} placeholder="Version" /><input value={installDescription} onChange={(event) => setInstallDescription(event.target.value)} placeholder="Description" /></div>
            <textarea aria-label="Plugin source to install" spellCheck={false} value={installSource} onChange={(event) => { setInstallSource(event.target.value); setInstallSourcePath(''); setInstallRegistryPackageName(''); setInstallModuleFiles(undefined); setInstallEntryModuleKey(undefined); setInstallDependencyModuleFiles(undefined); setInstallDependencyPackages(undefined); setInstallRequestedModules([]); setInstallModuleWarnings([]); }} placeholder="module.exports.requestHooks = […]" />
            <button disabled={!installSource.trim() || Boolean(busy)} onClick={install} type="button">{updatingRegistryPlugin ? `Apply update to ${updatingRegistryPlugin.name}` : 'Install disabled for review'}</button>
          </section>}
        </div>
      </div>
      {notifications.length ? <div className="plugin-notifications">{notifications.slice(-5).map((notification, index) => <div key={`${notification.title}-${index}`}><strong>{notification.title}</strong><span>{notification.message}</span></div>)}</div> : null}
      {busy ? <div className="automation-message">{busy}…</div> : null}{error ? <div className="automation-message error">{error}</div> : null}{message ? <div className="automation-message">{message}</div> : null}
    </section>
  );
}
