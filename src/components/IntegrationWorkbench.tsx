import { isTauri } from '@tauri-apps/api/core';
import { useMemo, useState } from 'react';
import type { Environment, KeyValue, McpClient, Workspace } from '../types';
import { generateAiText } from '../lib/ai';
import type { SendRequestContext } from '../lib/http';
import { loadKonnectControlPlanes, syncKonnectRoutes } from '../lib/konnect';
import { discoverMcpClient, invokeMcpOperation, type McpEvent } from '../lib/mcp';
import { plaintextSecretCandidates } from '../lib/security';
import { Icon } from './Icon';

type IntegrationWorkbenchProps = {
  workspace: Workspace;
  environment: Environment | undefined;
  requestContext: SendRequestContext;
  onChangeWorkspace: (updater: (workspace: Workspace) => Workspace) => void;
};

const newMcpClient = (): McpClient => ({
  id: `mcp-${crypto.randomUUID()}`,
  name: 'New MCP client',
  enabled: false,
  transport: 'http',
  url: 'https://',
  command: '',
  args: [],
  headers: [],
  authType: 'none',
  token: '',
  username: '',
  password: '',
  roots: [],
  tools: [],
  prompts: [],
  resources: [],
  resourceTemplates: [],
});

const row = (): KeyValue => ({ id: `integration-row-${crypto.randomUUID()}`, name: '', value: '', enabled: true });
const providerBaseUrl = (provider: Workspace['ai']['provider']) => provider === 'openai'
  ? 'https://api.openai.com/v1'
  : provider === 'anthropic'
    ? 'https://api.anthropic.com'
    : provider === 'gemini'
      ? 'https://generativelanguage.googleapis.com/v1beta'
      : 'http://127.0.0.1:11434/v1';

export function IntegrationWorkbench({ workspace, environment, requestContext, onChangeWorkspace }: IntegrationWorkbenchProps) {
  const [tab, setTab] = useState<'mcp' | 'ai' | 'konnect'>('mcp');
  const [activeId, setActiveId] = useState(workspace.mcpClients[0]?.id ?? '');
  const [operationKind, setOperationKind] = useState<'tool' | 'prompt' | 'resource'>('tool');
  const [operationName, setOperationName] = useState('');
  const [parameters, setParameters] = useState('{}');
  const [events, setEvents] = useState<McpEvent[]>([]);
  const [result, setResult] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const native = isTauri();
  const active = workspace.mcpClients.find((client) => client.id === activeId) ?? workspace.mcpClients[0];
  const currentMember = workspace.governance.members.find((member) => member.id === workspace.governance.currentMemberId);
  const canEdit = Boolean(currentMember?.active && currentMember.role !== 'viewer');
  const secretCandidates = plaintextSecretCandidates(workspace).filter((candidate) => /^(MCP|AI provider|Konnect)/.test(candidate));

  const run = async (label: string, operation: () => Promise<void>) => {
    if (busy) return;
    setBusy(label); setError(''); setMessage('');
    try { await operation(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
    finally { setBusy(''); }
  };

  const updateClient = (patch: Partial<McpClient>, revoke = false) => {
    if (!active || !canEdit) return;
    onChangeWorkspace((current) => ({
      ...current,
      mcpClients: current.mcpClients.map((client) => client.id !== active.id ? client : {
        ...client,
        ...patch,
        ...(revoke ? { enabled: false, tools: [], prompts: [], resources: [], resourceTemplates: [], lastSyncedAt: undefined } : {}),
      }),
    }));
  };

  const discover = () => active && canEdit && run('Discovering MCP capabilities', async () => {
    const discovered = await discoverMcpClient(active, environment, requestContext);
    onChangeWorkspace((current) => ({ ...current, mcpClients: current.mcpClients.map((client) => client.id === active.id ? discovered.client : client) }));
    setEvents(discovered.events);
    setMessage(`Discovered ${discovered.client.tools.length} tools, ${discovered.client.prompts.length} prompts, ${discovered.client.resources.length} resources, and ${discovered.client.resourceTemplates.length} templates${discovered.warnings.length ? ` · ${discovered.warnings.length} optional list calls unavailable` : ''}.`);
  });

  const operations = useMemo(() => {
    if (!active) return [];
    if (operationKind === 'tool') return active.tools.map((item) => ({ name: item.name, description: item.description }));
    if (operationKind === 'prompt') return active.prompts.map((item) => ({ name: item.name, description: item.description }));
    return [...active.resources, ...active.resourceTemplates].map((item) => ({ name: item.uri, description: item.description || item.name }));
  }, [active, operationKind]);

  const invokeOperation = () => active && operationName && canEdit && run('Invoking MCP operation', async () => {
    let parsed: Record<string, unknown>;
    try { parsed = JSON.parse(parameters) as Record<string, unknown>; }
    catch { throw new Error('MCP parameters must be a JSON object.'); }
    const output = await invokeMcpOperation(active, operationKind, operationName, parsed, environment, requestContext);
    setEvents(output.events);
    setResult(JSON.stringify(output.result, null, 2));
    setMessage(`${operationKind} operation completed.`);
  });

  const addClient = () => {
    if (!canEdit) return;
    const client = newMcpClient();
    onChangeWorkspace((current) => ({ ...current, mcpClients: [...current.mcpClients, client] }));
    setActiveId(client.id);
  };

  const deleteClient = () => {
    if (!active || !canEdit || !window.confirm(`Delete MCP client “${active.name}”?`)) return;
    onChangeWorkspace((current) => ({ ...current, mcpClients: current.mcpClients.filter((client) => client.id !== active.id) }));
    setActiveId(workspace.mcpClients.find((client) => client.id !== active.id)?.id ?? '');
  };

  const testAi = () => canEdit && run('Testing AI provider', async () => {
    const output = await generateAiText(workspace.ai, 'Return only JSON: {"ok":true,"message":"Brunomnia AI provider connected"}', environment, requestContext);
    setResult(output);
    setMessage('AI provider returned a response. No workspace data was sent in this connection test.');
  });

  const connectKonnect = () => canEdit && run('Loading Konnect control planes', async () => {
    const controlPlanes = await loadKonnectControlPlanes(workspace.konnect, environment, requestContext);
    onChangeWorkspace((current) => ({ ...current, konnect: { ...current.konnect, controlPlanes, controlPlaneId: controlPlanes.some((plane) => plane.id === current.konnect.controlPlaneId) ? current.konnect.controlPlaneId : controlPlanes[0]?.id ?? '' } }));
    setMessage(`Loaded ${controlPlanes.length} Konnect control plane${controlPlanes.length === 1 ? '' : 's'}.`);
  });

  const syncKonnect = () => canEdit && run('Pulling Konnect routes', async () => {
    const output = await syncKonnectRoutes(workspace, environment, requestContext);
    onChangeWorkspace(() => output.workspace);
    setMessage(`Pulled ${output.services} services and ${output.routes} routes · ${output.skipped} unsupported routes placed in Skipped Routes.`);
  });

  return (
    <section className="integration-workbench">
      <header className="integration-header">
        <div><small>Free, local configuration</small><h1>MCP, AI, and Konnect</h1><p>Connect external systems with vault-backed credentials and no Brunomnia account.</p></div>
        <div className="security-tabs"><button className={tab === 'mcp' ? 'active' : ''} onClick={() => setTab('mcp')} type="button">MCP clients</button><button className={tab === 'ai' ? 'active' : ''} onClick={() => setTab('ai')} type="button">AI settings</button><button className={tab === 'konnect' ? 'active' : ''} onClick={() => setTab('konnect')} type="button">Konnect</button></div>
      </header>

      {secretCandidates.length ? <div className="policy-warning"><strong>{secretCandidates.length} integration credential{secretCandidates.length === 1 ? '' : 's'} are plaintext</strong><span>Replace them with <code>{'{{ vault.name }}'}</code> or an approved external-vault tag before connecting or publishing.</span></div> : null}

      {tab === 'mcp' ? <div className="integration-mcp-layout">
        <aside className="integration-list"><header><strong>MCP clients</strong><button disabled={!canEdit} onClick={addClient} type="button"><Icon name="plus" size={15} /> Add</button></header>{workspace.mcpClients.map((client) => <button className={active?.id === client.id ? 'active' : ''} key={client.id} onClick={() => { setActiveId(client.id); setOperationName(''); setResult(''); }} type="button"><span><strong>{client.name}</strong><small>{client.transport.toUpperCase()} · {client.enabled ? 'enabled' : 'disabled'}</small></span><em>{client.tools.length + client.prompts.length + client.resources.length}</em></button>)}{!workspace.mcpClients.length ? <p>Create an HTTP or STDIO client to discover tools, prompts, and resources.</p> : null}</aside>
        {active ? <div className="integration-mcp-main">
          <section className="integration-card mcp-config"><header><div><small>Project-scoped configuration</small><h2>{active.name}</h2></div><div><label className="inline-toggle"><input checked={active.enabled} disabled={!canEdit} onChange={(event) => updateClient({ enabled: event.target.checked })} type="checkbox" /> Enabled</label><button disabled={!canEdit} onClick={deleteClient} type="button"><Icon name="trash" size={14} /></button></div></header><div className="integration-fields"><label>Name<input disabled={!canEdit} value={active.name} onChange={(event) => updateClient({ name: event.target.value })} /></label><label>Transport<select disabled={!canEdit} value={active.transport} onChange={(event) => updateClient({ transport: event.target.value as McpClient['transport'] }, true)}><option value="http">HTTP JSON-RPC</option><option value="stdio">STDIO</option></select></label>{active.transport === 'http' ? <label className="wide">Server URL<input disabled={!canEdit} value={active.url} onChange={(event) => updateClient({ url: event.target.value }, true)} placeholder="https://server.example/mcp" /></label> : <><label className="wide">Executable<input disabled={!canEdit} value={active.command} onChange={(event) => updateClient({ command: event.target.value }, true)} placeholder="/absolute/path/to/mcp-server" /></label><label className="wide">Arguments (one per line)<textarea disabled={!canEdit} value={active.args.join('\n')} onChange={(event) => updateClient({ args: event.target.value.split('\n').filter(Boolean) }, true)} /></label></>}<label>Auth<select disabled={!canEdit || active.transport === 'stdio'} value={active.authType} onChange={(event) => updateClient({ authType: event.target.value as McpClient['authType'] })}><option value="none">None</option><option value="bearer">Bearer / PAT</option><option value="basic">Basic</option></select></label>{active.authType === 'bearer' ? <label>Token<input disabled={!canEdit} type="password" value={active.token} onChange={(event) => updateClient({ token: event.target.value })} placeholder="{{ vault.mcp_token }}" /></label> : active.authType === 'basic' ? <><label>Username<input disabled={!canEdit} value={active.username} onChange={(event) => updateClient({ username: event.target.value })} /></label><label>Password<input disabled={!canEdit} type="password" value={active.password} onChange={(event) => updateClient({ password: event.target.value })} placeholder="{{ vault.mcp_password }}" /></label></> : null}<label className="wide">Roots (URI per line)<textarea disabled={!canEdit} value={active.roots.join('\n')} onChange={(event) => updateClient({ roots: event.target.value.split('\n').map((value) => value.trim()).filter(Boolean) })} placeholder="file:///Users/me/project" /></label></div><div className="mcp-header-editor"><header><strong>HTTP headers</strong><button disabled={!canEdit || active.transport === 'stdio'} onClick={() => updateClient({ headers: [...active.headers, row()] })} type="button">Add header</button></header>{active.headers.map((header) => <div key={header.id}><input checked={header.enabled} disabled={!canEdit} onChange={(event) => updateClient({ headers: active.headers.map((item) => item.id === header.id ? { ...item, enabled: event.target.checked } : item) })} type="checkbox" /><input disabled={!canEdit} value={header.name} onChange={(event) => updateClient({ headers: active.headers.map((item) => item.id === header.id ? { ...item, name: event.target.value } : item) })} placeholder="Header" /><input disabled={!canEdit} value={header.value} onChange={(event) => updateClient({ headers: active.headers.map((item) => item.id === header.id ? { ...item, value: event.target.value } : item) })} placeholder="Value or vault reference" /><button disabled={!canEdit} onClick={() => updateClient({ headers: active.headers.filter((item) => item.id !== header.id) })} type="button"><Icon name="x" size={13} /></button></div>)}</div><div className="integration-actions"><button disabled={!canEdit || !active.enabled || Boolean(busy) || (active.transport === 'stdio' && !native)} onClick={discover} type="button">Connect / resync</button><small>{active.lastSyncedAt ? `Cached ${new Date(active.lastSyncedAt).toLocaleString()}` : 'Imported clients remain disabled until reviewed.'}</small></div>{active.transport === 'stdio' ? <p>STDIO starts the configured executable directly for each operation—never through a shell. Interactive elicitation/sampling and persistent process sessions remain a later closure step.</p> : null}</section>
          <section className="integration-card mcp-operations"><header><div><small>Discovered and cached</small><h2>Operations</h2></div><div className="segmented-control"><button className={operationKind === 'tool' ? 'active' : ''} onClick={() => { setOperationKind('tool'); setOperationName(''); }} type="button">Tools {active.tools.length}</button><button className={operationKind === 'prompt' ? 'active' : ''} onClick={() => { setOperationKind('prompt'); setOperationName(''); }} type="button">Prompts {active.prompts.length}</button><button className={operationKind === 'resource' ? 'active' : ''} onClick={() => { setOperationKind('resource'); setOperationName(''); }} type="button">Resources {active.resources.length + active.resourceTemplates.length}</button></div></header><div className="mcp-operation-grid"><div className="mcp-operation-list">{operations.map((operation) => <button className={operationName === operation.name ? 'active' : ''} key={operation.name} onClick={() => setOperationName(operation.name)} type="button"><strong>{operation.name}</strong><small>{operation.description || 'No description'}</small></button>)}</div><div className="mcp-operation-run"><label>JSON parameters<textarea value={parameters} onChange={(event) => setParameters(event.target.value)} /></label><button disabled={!canEdit || !operationName || Boolean(busy)} onClick={invokeOperation} type="button">Invoke {operationKind}</button><pre>{result || 'Operation output appears here.'}</pre></div></div></section>
          <section className="integration-card mcp-console"><header><div><small>Runtime detail</small><h2>Events and console</h2></div><span>{events.length}</span></header><div>{events.map((event, index) => <article key={`${event.timestamp}-${index}`}><time>{new Date(event.timestamp).toLocaleTimeString()}</time><strong>{event.direction} · {event.method}</strong><pre>{event.detail}</pre></article>)}{!events.length ? <p>No runtime events yet.</p> : null}</div></section>
        </div> : <div className="empty-state"><Icon name="globe" size={30} /><strong>No MCP client selected</strong><span>Create one to begin.</span></div>}
      </div> : null}

      {tab === 'ai' ? <div className="integration-grid"><section className="integration-card"><header><div><small>User-selected provider</small><h2>Large language model</h2></div><label className="inline-toggle"><input checked={workspace.ai.enabled} disabled={!canEdit} onChange={(event) => onChangeWorkspace((current) => ({ ...current, ai: { ...current.ai, enabled: event.target.checked } }))} type="checkbox" /> Active</label></header><div className="integration-fields"><label>Provider<select disabled={!canEdit} value={workspace.ai.provider} onChange={(event) => { const provider = event.target.value as Workspace['ai']['provider']; onChangeWorkspace((current) => ({ ...current, ai: { ...current.ai, provider, baseUrl: providerBaseUrl(provider), enabled: false } })); }}><option value="openai">OpenAI</option><option value="anthropic">Claude / Anthropic</option><option value="gemini">Gemini</option><option value="openai-compatible">Custom or local OpenAI-compatible</option></select></label><label>Model<input disabled={!canEdit} value={workspace.ai.model} onChange={(event) => onChangeWorkspace((current) => ({ ...current, ai: { ...current.ai, model: event.target.value } }))} placeholder="model identifier" /></label><label className="wide">Base URL<input disabled={!canEdit} value={workspace.ai.baseUrl} onChange={(event) => onChangeWorkspace((current) => ({ ...current, ai: { ...current.ai, baseUrl: event.target.value, enabled: false } }))} placeholder="https://api.openai.com/v1" /></label><label className="wide">API key or secret reference<input disabled={!canEdit} type="password" value={workspace.ai.apiKey} onChange={(event) => onChangeWorkspace((current) => ({ ...current, ai: { ...current.ai, apiKey: event.target.value } }))} placeholder="{{ vault.ai_api_key }}" /></label></div><div className="policy-list"><label><input checked={workspace.ai.mockGeneration} disabled={!canEdit || !workspace.ai.enabled} onChange={(event) => onChangeWorkspace((current) => ({ ...current, ai: { ...current.ai, mockGeneration: event.target.checked } }))} type="checkbox" /> AI-assisted mock generation</label><label><input checked={workspace.ai.commitSuggestions} disabled={!canEdit || !workspace.ai.enabled} onChange={(event) => onChangeWorkspace((current) => ({ ...current, ai: { ...current.ai, commitSuggestions: event.target.checked } }))} type="checkbox" /> Git commit grouping and message suggestions</label></div><div className="integration-actions"><button disabled={!canEdit || !workspace.ai.enabled || !workspace.ai.model || Boolean(busy)} onClick={testAi} type="button">Test provider</button></div><p>Hosted credentials must be complete vault references. Local and custom providers may use loopback HTTP; remote providers require HTTPS. AI features send only the input shown at the point of use.</p></section><section className="integration-card"><header><div><small>Explicit use only</small><h2>Data boundary</h2></div><Icon name="spark" size={24} /></header><ul><li>Mock generation sends only the prompt/spec/example you paste.</li><li>Git suggestions send the staged/working diff and listed paths, capped before transmission.</li><li>MCP sampling is not forwarded automatically; interactive review is still required work.</li><li>No AI provider is bundled, required, or tied to a Brunomnia subscription.</li></ul><pre>{result || 'Provider test output appears here.'}</pre></section></div> : null}

      {tab === 'konnect' ? <div className="integration-grid"><section className="integration-card"><header><div><small>Pull-only Gateway integration</small><h2>Konnect</h2></div><label className="inline-toggle"><input checked={workspace.konnect.enabled} disabled={!canEdit} onChange={(event) => onChangeWorkspace((current) => ({ ...current, konnect: { ...current.konnect, enabled: event.target.checked } }))} type="checkbox" /> Enabled</label></header><div className="integration-fields"><label className="wide">Regional API URL<input disabled={!canEdit} value={workspace.konnect.baseUrl} onChange={(event) => onChangeWorkspace((current) => ({ ...current, konnect: { ...current.konnect, baseUrl: event.target.value, enabled: false, controlPlanes: [], controlPlaneId: '' } }))} placeholder="https://us.api.konghq.com" /></label><label className="wide">PAT or system-token reference<input disabled={!canEdit} type="password" value={workspace.konnect.token} onChange={(event) => onChangeWorkspace((current) => ({ ...current, konnect: { ...current.konnect, token: event.target.value } }))} placeholder="{{ vault.konnect_pat }}" /></label><label className="wide">Control plane<select disabled={!canEdit || !workspace.konnect.controlPlanes.length} value={workspace.konnect.controlPlaneId} onChange={(event) => onChangeWorkspace((current) => ({ ...current, konnect: { ...current.konnect, controlPlaneId: event.target.value } }))}><option value="">Choose a control plane…</option>{workspace.konnect.controlPlanes.map((plane) => <option key={plane.id} value={plane.id}>{plane.name}</option>)}</select></label></div><div className="integration-actions"><button disabled={!canEdit || !workspace.konnect.enabled || !workspace.konnect.token || Boolean(busy)} onClick={connectKonnect} type="button">Validate and list</button><button disabled={!canEdit || !workspace.konnect.enabled || !workspace.konnect.controlPlaneId || Boolean(busy)} onClick={syncKonnect} type="button">Pull routes</button></div><p>Sync is read-only. Remote Gateway Services become collections and HTTP/HTTPS Routes become requests; parameters, auth, bodies, custom headers, scripts, and proxy-host environment values are preserved on later pulls. Unsupported protocols are isolated in a Skipped Routes collection.</p>{workspace.konnect.lastSyncedAt ? <small>Last pulled {new Date(workspace.konnect.lastSyncedAt).toLocaleString()}</small> : null}</section><section className="integration-card"><header><div><small>Credential confinement</small><h2>Konnect boundary</h2></div><Icon name="lock" size={24} /></header><ul><li>Only HTTPS hosts under `*.api.konghq.com` are accepted.</li><li>Pagination cannot leave the configured origin.</li><li>Redirects and cookies are disabled for control-plane calls.</li><li>The PAT is resolved at send time from your local vault or approved external provider.</li><li>Brunomnia never pushes Gateway configuration.</li></ul></section></div> : null}

      {busy ? <div className="automation-message">{busy}…</div> : null}{error ? <div className="automation-message error">{error}</div> : null}{message ? <div className="automation-message">{message}</div> : null}
    </section>
  );
}
