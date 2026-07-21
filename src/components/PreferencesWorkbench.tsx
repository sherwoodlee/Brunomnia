import { isTauri } from '@tauri-apps/api/core';
import { useEffect, useMemo, useState } from 'react';
import type { AppPreferences, ShortcutAction, Workspace } from '../types';
import { cloneShortcuts, defaultPreferences, defaultShortcuts, duplicateShortcuts, normalizeShortcut, shortcutBindingOwner, shortcutFromEvent, shortcutLabels } from '../lib/preferences';
import { Icon } from './Icon';

type PreferencesWorkbenchProps = {
  workspace: Workspace;
  onChangeWorkspace: (updater: (workspace: Workspace) => Workspace) => void;
  initialTab?: 'general' | 'keyboard' | 'data';
};

const shortcutActions = Object.keys(shortcutLabels) as ShortcutAction[];

export function ShortcutBindingsEditor({ shortcuts, canEdit = true, onChange, onMessage }: { shortcuts: AppPreferences['shortcuts']; canEdit?: boolean; onChange: (shortcuts: AppPreferences['shortcuts']) => void; onMessage: (message: string) => void }) {
  const duplicates = useMemo(() => duplicateShortcuts(shortcuts), [shortcuts]);
  const updateShortcut = (action: ShortcutAction, bindings: string[]) => onChange({ ...shortcuts, [action]: bindings });
  const addShortcut = (action: ShortcutAction, value: string) => {
    const normalized = normalizeShortcut(value);
    if (!normalized) return;
    const owner = shortcutBindingOwner(shortcuts, normalized);
    if (owner) {
      onMessage(owner === action ? `${normalized} is already assigned to ${shortcutLabels[action]}.` : `${normalized} is already assigned to ${shortcutLabels[owner]}.`);
      return;
    }
    updateShortcut(action, [...shortcuts[action], normalized].slice(0, 8));
    onMessage(`${normalized} added to ${shortcutLabels[action]}.`);
  };
  return <>{duplicates.length ? <div className="policy-warning"><strong>Duplicate migrated bindings</strong><span>{duplicates.join(', ')} each trigger only the first matching action. Remove a duplicate before adding another binding.</span></div> : null}<div className="shortcut-list">{shortcutActions.map((action) => <div className="shortcut-row" key={action}><span><strong>{shortcutLabels[action]}</strong><small>{action}</small></span><div className="shortcut-bindings">{shortcuts[action].map((binding) => <code key={binding}>{binding.replace('Mod', '⌘/Ctrl')}<button aria-label={`Remove ${binding} from ${shortcutLabels[action]}`} disabled={!canEdit} onClick={() => { updateShortcut(action, shortcuts[action].filter((candidate) => candidate !== binding)); onMessage(`${binding} removed from ${shortcutLabels[action]}.`); }} type="button">×</button></code>)}<input aria-label={`Add ${shortcutLabels[action]} shortcut`} disabled={!canEdit || shortcuts[action].length >= 8} onChange={() => undefined} onKeyDown={(event) => { event.preventDefault(); event.stopPropagation(); const value = shortcutFromEvent(event.nativeEvent); if (value) addShortcut(action, value); }} placeholder={shortcuts[action].length >= 8 ? 'Binding limit reached' : 'Press shortcut'} value="" /></div><button aria-label={`Reset ${shortcutLabels[action]} shortcuts`} className="shortcut-reset" disabled={!canEdit} onClick={() => { updateShortcut(action, [...defaultShortcuts[action]]); onMessage(`${shortcutLabels[action]} restored to defaults.`); }} type="button">Reset</button></div>)}</div></>;
}

export function PreferencesWorkbench({ workspace, onChangeWorkspace, initialTab = 'general' }: PreferencesWorkbenchProps) {
  const [tab, setTab] = useState<'general' | 'keyboard' | 'data'>(initialTab);
  const [message, setMessage] = useState('');
  const preferences = workspace.preferences;
  const dataFoldersValue = preferences.dataFolders.join('\n');
  const [dataFoldersDraft, setDataFoldersDraft] = useState(dataFoldersValue);
  useEffect(() => setDataFoldersDraft(dataFoldersValue), [dataFoldersValue]);
  useEffect(() => setTab(initialTab), [initialTab]);
  const canEdit = true;
  const update = (patch: Partial<AppPreferences>) => {
    if (!canEdit) return;
    onChangeWorkspace((current) => ({ ...current, preferences: { ...current.preferences, ...patch } }));
  };
  const commitDataFolders = () => {
    const dataFolders = [...new Set(dataFoldersDraft
      .split(/\r?\n/)
      .map((folder) => folder.trim().slice(0, 4_096))
      .filter(Boolean))].slice(0, 100);
    setDataFoldersDraft(dataFolders.join('\n'));
    update({ dataFolders });
  };
  const applyTimeout = () => {
    if (!canEdit) return;
    onChangeWorkspace((current) => ({
      ...current,
      collections: current.collections.map((collection) => ({ ...collection, requests: collection.requests.map((request) => ({ ...request, transport: { ...request.transport, timeoutMode: 'global' } })) })),
    }));
    setMessage(`Every request now inherits the ${preferences.requestTimeoutMs.toLocaleString()} ms preference.`);
  };
  const applyCertificateValidation = () => {
    if (!canEdit) return;
    onChangeWorkspace((current) => ({
      ...current,
      collections: current.collections.map((collection) => ({ ...collection, requests: collection.requests.map((request) => ({ ...request, transport: { ...request.transport, validateCertificatesMode: 'global' } })) })),
    }));
    setMessage('Every request now inherits the certificate-validation preference.');
  };
  const applyProxy = () => {
    if (!canEdit) return;
    onChangeWorkspace((current) => ({
      ...current,
      collections: current.collections.map((collection) => ({ ...collection, requests: collection.requests.map((request) => ({ ...request, transport: { ...request.transport, proxyMode: 'global' } })) })),
    }));
    setMessage('Every request now inherits the proxy preference.');
  };

  return (
    <section className="preferences-workbench">
      <header className="preferences-header"><div><small>Device-local experience</small><h1>Preferences</h1><p>Appearance, request defaults, script permissions, and keyboard bindings stay on this device when projects or encrypted revisions are opened.</p></div><Icon name="settings" size={27} /></header>
      <div className="security-tabs"><button className={tab === 'general' ? 'active' : ''} onClick={() => setTab('general')} type="button">General</button><button className={tab === 'keyboard' ? 'active' : ''} onClick={() => setTab('keyboard')} type="button">Keyboard</button><button className={tab === 'data' ? 'active' : ''} onClick={() => setTab('data')} type="button">Data boundary</button></div>

      {tab === 'general' ? <div className="preferences-grid">
        <section className="preferences-card"><header><div><small>Sensitive values</small><h2>Password visibility</h2></div><Icon name="lock" size={22} /></header><div className="preference-fields"><label className="preference-toggle"><input checked={preferences.showPasswords} disabled={!canEdit} onChange={(event) => update({ showPasswords: event.target.checked })} type="checkbox" /> Reveal saved passwords and tokens</label><label className="preference-toggle"><input checked={preferences.showVariableSourceAndValue} disabled={!canEdit} onChange={(event) => update({ showVariableSourceAndValue: event.target.checked })} type="checkbox" /> Show environment variable source and value</label></div><p>Off by default. These controls reveal stored request and folder authentication fields, MCP/AI/Konnect credentials, or resolved environment values on this device. Vault and encrypted-sync passphrases keep their independent masking controls.</p></section>
        <section className="preferences-card"><header><div><small>Interface</small><h2>Appearance</h2></div></header><div className="preference-fields"><label>Theme<select disabled={!canEdit} value={preferences.theme} onChange={(event) => update({ theme: event.target.value as AppPreferences['theme'] })}><option value="system">Follow system</option><option value="dark">Dark</option><option value="light">Light</option></select></label><label>Density<select disabled={!canEdit} value={preferences.density} onChange={(event) => update({ density: event.target.value as AppPreferences['density'] })}><option value="comfortable">Comfortable</option><option value="compact">Compact</option></select></label><label>Interface font<input disabled={!canEdit} placeholder="System default" spellCheck={false} value={preferences.fontInterface} onChange={(event) => update({ fontInterface: event.target.value.slice(0, 512) })} /></label><label>Interface font size<input disabled={!canEdit} min="8" max="24" type="number" value={preferences.interfaceFontSize} onChange={(event) => update({ interfaceFontSize: Math.min(24, Math.max(8, Number(event.target.value) || 13)) })} /></label><label>Text editor font<input disabled={!canEdit} placeholder="System monospace" spellCheck={false} value={preferences.fontMonospace} onChange={(event) => update({ fontMonospace: event.target.value.slice(0, 512) })} /></label><label>Editor font size<input disabled={!canEdit} min="8" max="24" type="number" value={preferences.fontSize} onChange={(event) => update({ fontSize: Math.min(24, Math.max(8, Number(event.target.value) || 11)) })} /></label><label className="preference-toggle"><input checked={preferences.forceVerticalLayout} disabled={!canEdit} onChange={(event) => update({ forceVerticalLayout: event.target.checked })} type="checkbox" /> Stack request and response vertically</label><label className="preference-toggle"><input checked={preferences.editorLineWrapping} disabled={!canEdit} onChange={(event) => update({ editorLineWrapping: event.target.checked })} type="checkbox" /> Wrap text editor lines</label><label className="preference-toggle"><input checked={preferences.editorIndentWithTabs} disabled={!canEdit} onChange={(event) => update({ editorIndentWithTabs: event.target.checked })} type="checkbox" /> Indent with tabs</label><label>Editor indent size<input disabled={!canEdit} min="1" max="16" step="1" type="number" value={preferences.editorIndentSize} onChange={(event) => update({ editorIndentSize: Math.min(16, Math.max(1, Math.trunc(Number(event.target.value)) || 2)) })} /></label><label className="preference-toggle"><input checked={preferences.fontVariantLigatures} disabled={!canEdit} onChange={(event) => update({ fontVariantLigatures: event.target.checked })} type="checkbox" /> Font ligatures</label><label className="preference-toggle"><input checked={preferences.useBulkHeaderEditor} disabled={!canEdit} onChange={(event) => update({ useBulkHeaderEditor: event.target.checked })} type="checkbox" /> Use bulk request-header editor</label><label className="preference-toggle"><input checked={preferences.useBulkParametersEditor} disabled={!canEdit} onChange={(event) => update({ useBulkParametersEditor: event.target.checked })} type="checkbox" /> Use bulk query-parameter editor</label></div><p>Plugin themes still take precedence while enabled. Focus outlines and semantic status colors remain visible in every built-in theme.</p></section>
        <section className="preferences-card"><header><div><small>Request / response</small><h2>Execution defaults</h2></div></header><div className="preference-fields"><label>Preferred HTTP version<select disabled={!canEdit} onChange={(event) => update({ preferredHttpVersion: event.target.value as AppPreferences['preferredHttpVersion'] })} value={preferences.preferredHttpVersion}><option value="default">Default negotiation</option><option value="http1.0">HTTP 1.0</option><option value="http1.1">HTTP 1.1</option><option value="http2">HTTP/2</option><option value="http2-prior-knowledge">HTTP/2 Prior Knowledge</option></select></label><label>Maximum redirects<input disabled={!canEdit} min="-1" step="1" type="number" value={preferences.maxRedirects} onChange={(event) => { const value = Number(event.target.value); update({ maxRedirects: Number.isFinite(value) ? Math.max(-1, Math.trunc(value)) : 10 }); }} /></label><label>Max timeline chunk size (KiB)<input disabled={!canEdit} min="0" step="1" type="number" value={preferences.maxTimelineDataSizeKB} onChange={(event) => { const value = Number(event.target.value); update({ maxTimelineDataSizeKB: Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 10 }); }} /></label><label>Response history limit<input disabled={!canEdit} min="-1" step="1" type="number" value={preferences.maxHistoryResponses} onChange={(event) => { const value = Number(event.target.value); update({ maxHistoryResponses: Number.isFinite(value) ? Math.max(-1, Math.trunc(value)) : 20 }); }} /></label><label>Request timeout (ms)<input disabled={!canEdit} min="0" step="1" type="number" value={preferences.requestTimeoutMs} onChange={(event) => update({ requestTimeoutMs: Math.min(2_147_483_647, Math.max(0, Number(event.target.value) || 0)) })} /><small>0 disables request deadlines</small></label><label className="preference-toggle"><input checked={preferences.followRedirects} disabled={!canEdit} onChange={(event) => update({ followRedirects: event.target.checked })} type="checkbox" /> Follow redirects by default</label><label className="preference-toggle"><input checked={preferences.validateCertificates} disabled={!canEdit} onChange={(event) => update({ validateCertificates: event.target.checked })} type="checkbox" /> Validate certificates for API requests</label><label className="preference-toggle"><input checked={preferences.validateAuthCertificates} disabled={!canEdit} onChange={(event) => update({ validateAuthCertificates: event.target.checked })} type="checkbox" /> Validate certificates during authentication</label><label className="preference-toggle"><input checked={preferences.clearOAuth2SessionOnRestart} disabled={!canEdit} onChange={(event) => update({ clearOAuth2SessionOnRestart: event.target.checked })} type="checkbox" /> Clear OAuth 2 session on restart</label><label className="preference-toggle"><input checked={preferences.proxyEnabled} disabled={!canEdit} onChange={(event) => update({ proxyEnabled: event.target.checked })} type="checkbox" /> Use manual proxy configuration</label><label>HTTP proxy<input disabled={!canEdit || !preferences.proxyEnabled} placeholder="http://127.0.0.1:8080" spellCheck={false} value={preferences.httpProxy} onChange={(event) => update({ httpProxy: event.target.value })} /></label><label>HTTPS proxy<input disabled={!canEdit || !preferences.proxyEnabled} placeholder="http://127.0.0.1:8080" spellCheck={false} value={preferences.httpsProxy} onChange={(event) => update({ httpsProxy: event.target.value })} /></label><label>No proxy<input disabled={!canEdit || !preferences.proxyEnabled} placeholder="localhost, .example.com, 10.0.0.0/8" spellCheck={false} value={preferences.noProxy} onChange={(event) => update({ noProxy: event.target.value })} /></label><label className="preference-toggle"><input checked={preferences.filterResponsesByEnv} disabled={!canEdit} onChange={(event) => update({ filterResponsesByEnv: event.target.checked })} type="checkbox" /> Filter response history by active environment</label><label className="preference-toggle"><input checked={preferences.autoFetchGraphqlSchema} disabled={!canEdit} onChange={(event) => update({ autoFetchGraphqlSchema: event.target.checked })} type="checkbox" /> Automatically introspect GraphQL schemas</label><label className="preference-toggle"><input checked={preferences.confirmDestructive} disabled={!canEdit} onChange={(event) => update({ confirmDestructive: event.target.checked })} type="checkbox" /> Confirm request deletion</label></div><button disabled={!canEdit} onClick={applyTimeout} type="button">Make every request inherit timeout</button><button disabled={!canEdit} onClick={applyCertificateValidation} type="button">Make every request inherit certificate validation</button><button disabled={!canEdit} onClick={applyProxy} type="button">Make every request inherit proxy</button><p>The preferred HTTP version, redirect defaults, maximum redirects, request timeout, and API validation apply at execution time to native HTTP, GraphQL, Event Stream, gRPC, collection-run, script/plugin, and integration traffic. The proxy preference applies to native HTTP, GraphQL, Event Stream, collection-run, script/plugin, and HTTP-backed integration traffic. With manual proxy off, native requests use reqwest's system/environment proxy discovery; with it on, HTTP/HTTPS URLs use their matching proxy and no-proxy list. OAuth token requests use the same proxy plus the separate authentication validation preference; the built-in OAuth browser also uses the matching manual proxy unless the authorization host matches No proxy. Requests can retain explicit overrides. Browser development mode controls TLS, proxy routing, protocol, and redirect count.</p><p>Timeline evidence defaults to a 10 KiB outgoing-data threshold. Data at or above the threshold is replaced with a size-only hidden marker; zero follows the current upstream 1 KiB fallback. Response transfer evidence remains size-only. Response history defaults to 20 entries per request. Enter 0 to keep only the live response or -1 to retain all. Environment filtering scopes both the visible history and future pruning. Legacy workspaces keep saved timeout, validation, and proxy choices as explicit overrides until you opt them into inheritance.</p></section>
        <section className="preferences-card">
          <header><div><small>Response preview</small><h2>Links and HTML content</h2></div><Icon name="lock" size={22} /></header>
          <div className="preference-fields">
            <label className="preference-toggle"><input checked={preferences.disableResponsePreviewLinks} disabled={!canEdit} onChange={(event) => update({ disableResponsePreviewLinks: event.target.checked })} type="checkbox" /> Disable links in response viewer</label>
            <label className="preference-toggle"><input checked={preferences.allowHtmlPreviewRemoteResources} disabled={!canEdit} onChange={(event) => update({ allowHtmlPreviewRemoteResources: event.target.checked })} type="checkbox" /> Allow remote resources in HTML response previews</label>
            <label className="preference-toggle"><input checked={preferences.allowHtmlPreviewScripts} disabled={!canEdit} onChange={(event) => update({ allowHtmlPreviewScripts: event.target.checked })} type="checkbox" /> Allow inline JavaScript in HTML response previews</label>
          </div>
          <p>All choices are device-local. Text response links open only explicit HTTP(S) targets in the default browser and can be disabled. Remote HTML resources and JavaScript are off by default. Remote resources alone permit HTTP(S) styles, images, fonts, media, and nested frames. When both grants are active, external scripts, fetch-style connections, WebSockets, and workers are also permitted inside the opaque sandbox; forms, popups, same-origin access, parent/top navigation, <code>eval</code>, and objects remain blocked.</p>
        </section>
        <section className="preferences-card">
          <header><div><small>Permission boundary</small><h2>Request scripts</h2></div><Icon name="lock" size={22} /></header>
          <div className="preference-fields">
            <label>Script deadline (ms)<input disabled={!canEdit} min="1000" max="60000" step="1000" type="number" value={preferences.scriptTimeoutMs} onChange={(event) => update({ scriptTimeoutMs: Math.min(60_000, Math.max(1_000, Number(event.target.value) || 10_000)) })} /></label>
            <label className="preference-toggle"><input checked={preferences.allowScriptRequests} disabled={!canEdit} onChange={(event) => update({ allowScriptRequests: event.target.checked })} type="checkbox" /> Allow scripts to send secondary HTTP requests</label>
            <label className="preference-toggle"><input checked={preferences.allowScriptFileAccess} disabled={!canEdit || !isTauri()} onChange={(event) => update({ allowScriptFileAccess: event.target.checked })} type="checkbox" /> Allow scripts and File template tags to read approved local files</label>
            <label className="preference-data-folders">Allowed data folders<textarea disabled={!canEdit || !isTauri()} onBlur={commitDataFolders} onChange={(event) => setDataFoldersDraft(event.target.value)} placeholder="One absolute folder per line" spellCheck={false} value={dataFoldersDraft} /><small>One absolute folder per line. Changes apply when this field loses focus.</small></label>
            <label className="preference-toggle"><input checked={preferences.enableVaultInScripts} disabled={!canEdit} onChange={(event) => update({ enableVaultInScripts: event.target.checked })} type="checkbox" /> Expose the unlocked local vault through <code>insomnia.vault</code></label>
          </div>
          <p>All three capabilities are off by default and remain device-local. Desktop script attachments and File template tags require both the file grant and a matching allowed folder; canonical containment rejects traversal and symlink escapes. Direct <code>fetch</code>, arbitrary imports, file writes, and other host APIs stay unavailable.</p>
        </section>
      </div> : null}

      {tab === 'keyboard' ? <section className="preferences-card keyboard-card"><header><div><small>Editable multi-bindings</small><h2>Keyboard shortcuts</h2></div><button disabled={!canEdit} onClick={() => update({ shortcuts: cloneShortcuts(defaultShortcuts) })} type="button">Reset all</button></header><ShortcutBindingsEditor canEdit={canEdit} onChange={(shortcuts) => update({ shortcuts })} onMessage={setMessage} shortcuts={preferences.shortcuts} /><p>Each action accepts up to eight unique combinations. Focus <strong>Press shortcut</strong> and press a combination to add it; remove bindings individually or reset one action. <code>Mod</code> maps to Command on macOS and Control elsewhere.</p></section> : null}

      {tab === 'data' ? <div className="preferences-grid"><section className="preferences-card"><header><div><small>Project isolation</small><h2>Not shared</h2></div><Icon name="lock" size={22} /></header><ul><li>Preferences and script grants are omitted from managed folder/Git project files.</li><li>Encrypted-sync pulls preserve this device's preferences.</li><li>Workspace imports reset preferences and script grants to safe defaults.</li><li>No preference requires a Brunomnia account.</li></ul></section><section className="preferences-card"><header><div><small>Reset</small><h2>Restore local defaults</h2></div></header><p>This changes appearance, request defaults, script permissions, and shortcuts. It does not delete requests, history, secrets, or integration settings.</p><button disabled={!canEdit} onClick={() => { setDataFoldersDraft(''); update(structuredClone(defaultPreferences)); setMessage('Preferences restored to local defaults.'); }} type="button">Restore defaults</button></section></div> : null}
      {message ? <div className="automation-message">{message}</div> : null}
    </section>
  );
}
