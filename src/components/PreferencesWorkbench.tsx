import { isTauri } from '@tauri-apps/api/core';
import { useMemo, useState } from 'react';
import type { AppPreferences, ShortcutAction, Workspace } from '../types';
import { defaultPreferences, defaultShortcuts, duplicateShortcuts, normalizeShortcut, shortcutFromEvent, shortcutLabels } from '../lib/preferences';
import { Icon } from './Icon';

type PreferencesWorkbenchProps = {
  workspace: Workspace;
  onChangeWorkspace: (updater: (workspace: Workspace) => Workspace) => void;
};

const shortcutActions = Object.keys(shortcutLabels) as ShortcutAction[];

export function PreferencesWorkbench({ workspace, onChangeWorkspace }: PreferencesWorkbenchProps) {
  const [tab, setTab] = useState<'general' | 'keyboard' | 'data'>('general');
  const [message, setMessage] = useState('');
  const preferences = workspace.preferences;
  const duplicates = useMemo(() => duplicateShortcuts(preferences.shortcuts), [preferences.shortcuts]);
  const canEdit = true;
  const update = (patch: Partial<AppPreferences>) => {
    if (!canEdit) return;
    onChangeWorkspace((current) => ({ ...current, preferences: { ...current.preferences, ...patch } }));
  };
  const updateShortcut = (action: ShortcutAction, value: string) => update({ shortcuts: { ...preferences.shortcuts, [action]: normalizeShortcut(value) } });
  const applyTimeout = () => {
    if (!canEdit) return;
    onChangeWorkspace((current) => ({
      ...current,
      collections: current.collections.map((collection) => ({ ...collection, requests: collection.requests.map((request) => ({ ...request, transport: { ...request.transport, timeoutMs: current.preferences.requestTimeoutMs } })) })),
    }));
    setMessage(`Applied ${preferences.requestTimeoutMs.toLocaleString()} ms to every request.`);
  };

  return (
    <section className="preferences-workbench">
      <header className="preferences-header"><div><small>Device-local experience</small><h1>Preferences</h1><p>Appearance, request defaults, script permissions, and keyboard bindings stay on this device when projects or encrypted revisions are opened.</p></div><Icon name="settings" size={27} /></header>
      <div className="security-tabs"><button className={tab === 'general' ? 'active' : ''} onClick={() => setTab('general')} type="button">General</button><button className={tab === 'keyboard' ? 'active' : ''} onClick={() => setTab('keyboard')} type="button">Keyboard</button><button className={tab === 'data' ? 'active' : ''} onClick={() => setTab('data')} type="button">Data boundary</button></div>

      {tab === 'general' ? <div className="preferences-grid">
        <section className="preferences-card"><header><div><small>Interface</small><h2>Appearance</h2></div></header><div className="preference-fields"><label>Theme<select disabled={!canEdit} value={preferences.theme} onChange={(event) => update({ theme: event.target.value as AppPreferences['theme'] })}><option value="system">Follow system</option><option value="dark">Dark</option><option value="light">Light</option></select></label><label>Density<select disabled={!canEdit} value={preferences.density} onChange={(event) => update({ density: event.target.value as AppPreferences['density'] })}><option value="comfortable">Comfortable</option><option value="compact">Compact</option></select></label><label>Editor font size<input disabled={!canEdit} min="11" max="20" type="number" value={preferences.fontSize} onChange={(event) => update({ fontSize: Math.min(20, Math.max(11, Number(event.target.value) || 13)) })} /></label></div><p>Plugin themes still take precedence while enabled. Focus outlines and semantic status colors remain visible in every built-in theme.</p></section>
        <section className="preferences-card"><header><div><small>Request / response</small><h2>Execution defaults</h2></div></header><div className="preference-fields"><label>New-request timeout (ms)<input disabled={!canEdit} min="1000" max="600000" step="1000" type="number" value={preferences.requestTimeoutMs} onChange={(event) => update({ requestTimeoutMs: Math.min(600_000, Math.max(1_000, Number(event.target.value) || 30_000)) })} /></label><label className="preference-toggle"><input checked={preferences.autoFetchGraphqlSchema} disabled={!canEdit} onChange={(event) => update({ autoFetchGraphqlSchema: event.target.checked })} type="checkbox" /> Automatically introspect GraphQL schemas</label><label className="preference-toggle"><input checked={preferences.confirmDestructive} disabled={!canEdit} onChange={(event) => update({ confirmDestructive: event.target.checked })} type="checkbox" /> Confirm request deletion</label></div><button disabled={!canEdit} onClick={applyTimeout} type="button">Apply timeout to existing requests</button><p>Each request keeps an editable timeout in its Transport tab. The default affects only newly created requests unless explicitly applied.</p></section>
        <section className="preferences-card"><header><div><small>Permission boundary</small><h2>Request scripts</h2></div><Icon name="lock" size={22} /></header><div className="preference-fields"><label>Script deadline (ms)<input disabled={!canEdit} min="1000" max="60000" step="1000" type="number" value={preferences.scriptTimeoutMs} onChange={(event) => update({ scriptTimeoutMs: Math.min(60_000, Math.max(1_000, Number(event.target.value) || 10_000)) })} /></label><label className="preference-toggle"><input checked={preferences.allowScriptRequests} disabled={!canEdit} onChange={(event) => update({ allowScriptRequests: event.target.checked })} type="checkbox" /> Allow scripts to send secondary HTTP requests</label><label className="preference-toggle"><input checked={preferences.allowScriptFileAccess} disabled={!canEdit || !isTauri()} onChange={(event) => update({ allowScriptFileAccess: event.target.checked })} type="checkbox" /> Allow scripts to attach local body and certificate files</label><label className="preference-toggle"><input checked={preferences.enableVaultInScripts} disabled={!canEdit} onChange={(event) => update({ enableVaultInScripts: event.target.checked })} type="checkbox" /> Expose the unlocked local vault through <code>insomnia.vault</code></label></div><p>All three capabilities are off by default and remain device-local. File access can expose any path named by a script through a request, so enable it only for workspaces you trust. Direct <code>fetch</code>, arbitrary imports, and other host APIs stay unavailable.</p></section>
      </div> : null}

      {tab === 'keyboard' ? <section className="preferences-card keyboard-card"><header><div><small>Editable bindings</small><h2>Keyboard shortcuts</h2></div><button disabled={!canEdit} onClick={() => update({ shortcuts: { ...defaultShortcuts } })} type="button">Reset defaults</button></header>{duplicates.length ? <div className="policy-warning"><strong>Duplicate bindings</strong><span>{duplicates.join(', ')} each trigger only the first matching action. Choose a unique binding.</span></div> : null}<div className="shortcut-list">{shortcutActions.map((action) => <label key={action}><span><strong>{shortcutLabels[action]}</strong><small>{action}</small></span><input aria-label={`${shortcutLabels[action]} shortcut`} disabled={!canEdit} onChange={(event) => updateShortcut(action, event.target.value)} onKeyDown={(event) => { event.preventDefault(); if ((event.key === 'Backspace' || event.key === 'Delete') && !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey) { updateShortcut(action, ''); return; } const value = shortcutFromEvent(event.nativeEvent); if (value) updateShortcut(action, value); }} placeholder="Unassigned" value={preferences.shortcuts[action]} /></label>)}</div><p>Click a binding and press the desired key combination, or type a value such as <code>Mod+Shift+H</code>. Press Backspace to clear a binding. <code>Mod</code> maps to Command on macOS and Control elsewhere.</p></section> : null}

      {tab === 'data' ? <div className="preferences-grid"><section className="preferences-card"><header><div><small>Project isolation</small><h2>Not shared</h2></div><Icon name="lock" size={22} /></header><ul><li>Preferences and script grants are omitted from managed folder/Git project files.</li><li>Encrypted-sync pulls preserve this device's preferences.</li><li>Workspace imports reset preferences and script grants to safe defaults.</li><li>No preference requires a Brunomnia account.</li></ul></section><section className="preferences-card"><header><div><small>Reset</small><h2>Restore local defaults</h2></div></header><p>This changes appearance, request defaults, script permissions, and shortcuts. It does not delete requests, history, secrets, or integration settings.</p><button disabled={!canEdit} onClick={() => { update(structuredClone(defaultPreferences)); setMessage('Preferences restored to local defaults.'); }} type="button">Restore defaults</button></section></div> : null}
      {message ? <div className="automation-message">{message}</div> : null}
    </section>
  );
}
