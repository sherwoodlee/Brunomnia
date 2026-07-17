import { isTauri } from '@tauri-apps/api/core';
import { useEffect, useMemo, useState } from 'react';
import { sendRequest } from '../lib/http';
import {
  applyPluginTheme,
  describePlugin,
  inferPluginPermissions,
  pluginPermissionLabels,
  pluginPermissions,
  pluginStarterSource,
  runPluginAction,
  validatePluginSource,
  type PluginDescriptor,
  type PluginHostCallbacks,
  type PluginNotification,
} from '../lib/plugins';
import { readLocalPluginSource } from '../lib/project';
import type { PluginPermission, PluginRecord, Workspace } from '../types';
import { Icon } from './Icon';

type PluginWorkbenchProps = {
  workspace: Workspace;
  onChangeWorkspace: (updater: (workspace: Workspace) => Workspace) => void;
};

const blankDescriptor: PluginDescriptor = { templates: [], actions: [], themes: [] };
const uid = () => `plugin-${crypto.randomUUID()}`;

const activeRequest = (workspace: Workspace) => workspace.collections
  .flatMap((collection) => collection.requests)
  .find((request) => request.id === workspace.activeRequestId);

export function PluginWorkbench({ workspace, onChangeWorkspace }: PluginWorkbenchProps) {
  const [selectedId, setSelectedId] = useState(workspace.plugins[0]?.id ?? '');
  const [installName, setInstallName] = useState('Local plugin');
  const [installVersion, setInstallVersion] = useState('0.0.0-local');
  const [installDescription, setInstallDescription] = useState('Local CommonJS plugin');
  const [installSource, setInstallSource] = useState('');
  const [localPath, setLocalPath] = useState('');
  const [draftSource, setDraftSource] = useState('');
  const [descriptor, setDescriptor] = useState<PluginDescriptor>(blankDescriptor);
  const [notifications, setNotifications] = useState<PluginNotification[]>([]);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const selected = workspace.plugins.find((plugin) => plugin.id === selectedId);
  const request = activeRequest(workspace);
  const requested = useMemo(() => new Set(selected?.requestedPermissions ?? []), [selected?.requestedPermissions]);

  const changeWorkspace = (updater: (current: Workspace) => Workspace) => onChangeWorkspace(updater);
  const updatePlugin = (id: string, patch: Partial<PluginRecord>) => changeWorkspace((current) => ({
    ...current,
    plugins: current.plugins.map((plugin) => plugin.id === id ? { ...plugin, ...patch } : plugin),
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
    setDescriptor(blankDescriptor);
    if (!selected) return;
    let cancelled = false;
    void describePlugin(selected).then((value) => { if (!cancelled) setDescriptor(value); }).catch((caught) => {
      if (!cancelled) setError(caught instanceof Error ? caught.message : String(caught));
    });
    return () => { cancelled = true; };
  }, [selected]);

  const install = () => run('Reviewing plugin', async () => {
    validatePluginSource(installSource);
    const id = uid();
    const plugin: PluginRecord = {
      id,
      name: installName.trim() || 'Local plugin',
      version: installVersion.trim() || '0.0.0-local',
      description: installDescription.trim(),
      source: installSource,
      sourceFormat: 'insomnia-commonjs',
      enabled: false,
      requestedPermissions: inferPluginPermissions(installSource),
      grantedPermissions: [],
      installedAt: new Date().toISOString(),
    };
    const found = await describePlugin(plugin);
    changeWorkspace((current) => ({ ...current, plugins: [...current.plugins, plugin] }));
    setSelectedId(id); setDescriptor(found); setInstallSource('');
    setMessage('Plugin installed disabled. Review and grant only the capabilities it needs.');
  });

  const loadLocal = () => run('Reading local plugin', async () => {
    const output = await readLocalPluginSource(localPath);
    setInstallName(output.name); setInstallVersion(output.version); setInstallDescription(output.description); setInstallSource(output.source);
    setMessage(`Loaded ${output.path}. Review the source before installing.`);
  });

  const callbacks: PluginHostCallbacks = {
    network: async (pluginRequest) => sendRequest(pluginRequest, workspace.environments.find((environment) => environment.id === workspace.activeEnvironmentId), {
      cookies: workspace.cookies,
      responses: workspace.responses,
      preferredHttpVersion: workspace.preferences.preferredHttpVersion,
    }),
    prompt: async (title, defaultValue) => window.prompt(title, defaultValue) ?? '',
    readClipboard: async () => navigator.clipboard.readText(),
    writeClipboard: async (value) => navigator.clipboard.writeText(value),
  };

  const runAction = (actionId: string) => run('Running plugin action', async () => {
    if (!selected || !request) throw new Error('Choose a plugin and active request first.');
    const action = descriptor.actions.find((candidate) => candidate.id === actionId);
    if (!action) throw new Error('The plugin action was not found.');
    const output = await runPluginAction(selected, action, request, workspace, workspace.pluginData[selected.id] ?? {}, callbacks);
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
        <div><small>Extensibility</small><h1>Local plugins</h1><p>Run dependency-free Insomnia-style CommonJS hooks, tags, actions, and themes inside a time-limited Worker with explicit permissions.</p></div>
        <span className="local-only-badge">Local · no paid gate</span>
      </header>

      <div className="plugin-layout">
        <aside className="plugin-sidebar">
          <header><strong>Installed</strong><span>{workspace.plugins.length}</span></header>
          <div className="plugin-list">
            {workspace.plugins.map((plugin) => <button className={plugin.id === selectedId ? 'active' : ''} key={plugin.id} onClick={() => setSelectedId(plugin.id)} type="button"><span className={plugin.enabled ? 'plugin-state enabled' : 'plugin-state'} /><span><strong>{plugin.name}</strong><small>v{plugin.version} · {plugin.enabled ? 'enabled' : 'disabled'}</small></span></button>)}
            {!workspace.plugins.length ? <p>No plugins installed.</p> : null}
          </div>
          <button className="secondary-button" onClick={() => { setSelectedId(''); setInstallSource(''); }} type="button"><Icon name="plus" size={15} /> Install plugin</button>
          <button className="secondary-button quiet" onClick={() => { setSelectedId(''); setInstallSource(pluginStarterSource); setInstallName('Brunomnia starter'); setInstallVersion('0.1.0'); setInstallDescription('Starter request hook, template tag, and action'); }} type="button"><Icon name="code" size={15} /> Use starter source</button>
        </aside>

        <div className="plugin-main">
          {selected ? <>
            <section className="plugin-card plugin-summary">
              <header><div><small>Installed plugin</small><h2>{selected.name}</h2><p>{selected.description || 'No description provided.'}</p></div><div className="plugin-summary-actions"><label className="switch-label"><input checked={selected.enabled} onChange={(event) => updatePlugin(selected.id, { enabled: event.target.checked, error: undefined })} type="checkbox" /> Enabled</label><button onClick={() => changeWorkspace((current) => ({ ...current, plugins: current.plugins.filter((plugin) => plugin.id !== selected.id), pluginData: Object.fromEntries(Object.entries(current.pluginData).filter(([id]) => id !== selected.id)), activePluginTheme: current.activePluginTheme.startsWith(`${selected.id}::`) ? '' : current.activePluginTheme }))} type="button"><Icon name="trash" size={15} /> Remove</button></div></header>
              <div className="plugin-capability-summary"><span>{descriptor.templates.length} tags</span><span>{descriptor.actions.length} actions</span><span>{descriptor.themes.length} themes</span><span>{selected.sourceFormat}</span></div>
            </section>

            <section className="plugin-card"><header><div><small>Capability boundary</small><h2>Permissions</h2><p>Detected permissions are marked “requested.” Nothing is available until you grant it.</p></div></header><div className="permission-grid">{pluginPermissions.map((permission) => <label key={permission}><input checked={selected.grantedPermissions.includes(permission)} onChange={(event) => updatePlugin(selected.id, { grantedPermissions: event.target.checked ? [...selected.grantedPermissions, permission] : selected.grantedPermissions.filter((candidate) => candidate !== permission) })} type="checkbox" /><span><strong>{pluginPermissionLabels[permission]}</strong><small>{requested.has(permission) ? 'Requested by source' : 'Not detected'}</small></span></label>)}</div></section>

            <section className="plugin-card"><header><div><small>Exports</small><h2>Actions, tags, and theme</h2></div></header><div className="plugin-tools"><div><strong>Actions</strong>{descriptor.actions.map((action) => <button disabled={!selected.enabled || !selected.grantedPermissions.includes('action') || Boolean(busy)} key={action.id} onClick={() => runAction(action.id)} type="button">{action.label}<small>{action.kind}</small></button>)}{!descriptor.actions.length ? <p>No actions exported.</p> : null}</div><div><strong>Template tags</strong>{descriptor.templates.map((tag) => <code key={tag.name}>{`{% ${tag.name} %}`}</code>)}{!descriptor.templates.length ? <p>No tags exported.</p> : null}</div><label><strong>Theme</strong><select disabled={!selected.enabled || !selected.grantedPermissions.includes('theme')} value={workspace.activePluginTheme.startsWith(`${selected.id}::`) ? workspace.activePluginTheme : ''} onChange={(event) => selectTheme(event.target.value)}><option value="">System theme</option>{descriptor.themes.map((theme) => <option key={theme.id} value={`${selected.id}::${theme.id}`}>{theme.displayName}</option>)}</select></label></div></section>

            <section className="plugin-card plugin-source-card"><header><div><small>Source</small><h2>Review and update</h2><p>Updating source disables the plugin and clears grants so changed code cannot inherit old authority.</p></div><button disabled={draftSource === selected.source || Boolean(busy)} onClick={() => run('Updating source', async () => { validatePluginSource(draftSource); const next = { ...selected, source: draftSource, enabled: false, requestedPermissions: inferPluginPermissions(draftSource), grantedPermissions: [] as PluginPermission[], error: undefined }; const found = await describePlugin(next); updatePlugin(selected.id, next); setDescriptor(found); setMessage('Source updated. Review permissions before enabling it again.'); })} type="button">Apply source</button></header><textarea aria-label="Plugin source" spellCheck={false} value={draftSource} onChange={(event) => setDraftSource(event.target.value)} /></section>
          </> : <section className="plugin-card plugin-installer"><header><div><small>Install</small><h2>Review local CommonJS source</h2><p>Package dependencies and remote installs are intentionally not loaded. Bundle a plugin to one file or paste dependency-free source.</p></div></header>{isTauri() ? <div className="local-plugin-row"><input value={localPath} onChange={(event) => setLocalPath(event.target.value)} placeholder="/path/to/plugin folder or main.js" /><button disabled={!localPath || Boolean(busy)} onClick={loadLocal} type="button"><Icon name="folder" size={15} /> Read local</button></div> : null}<div className="plugin-metadata"><input value={installName} onChange={(event) => setInstallName(event.target.value)} placeholder="Plugin name" /><input value={installVersion} onChange={(event) => setInstallVersion(event.target.value)} placeholder="Version" /><input value={installDescription} onChange={(event) => setInstallDescription(event.target.value)} placeholder="Description" /></div><textarea aria-label="Plugin source to install" spellCheck={false} value={installSource} onChange={(event) => setInstallSource(event.target.value)} placeholder="module.exports.requestHooks = […]" /><button disabled={!installSource.trim() || Boolean(busy)} onClick={install} type="button">Install disabled for review</button></section>}
        </div>
      </div>
      {notifications.length ? <div className="plugin-notifications">{notifications.slice(-5).map((notification, index) => <div key={`${notification.title}-${index}`}><strong>{notification.title}</strong><span>{notification.message}</span></div>)}</div> : null}
      {busy ? <div className="automation-message">{busy}…</div> : null}{error ? <div className="automation-message error">{error}</div> : null}{message ? <div className="automation-message">{message}</div> : null}
    </section>
  );
}
