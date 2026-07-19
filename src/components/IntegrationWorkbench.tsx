import { isTauri } from '@tauri-apps/api/core';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Environment, KeyValue, McpClient, Workspace } from '../types';
import { generateAiText } from '../lib/ai';
import type { SendRequestContext } from '../lib/http';
import { loadKonnectControlPlanes, syncKonnectRoutes } from '../lib/konnect';
import { discoverMcpClient, invokeMcpOperation, type McpEvent } from '../lib/mcp';
import { initialMcpToolParameters, mcpScalarInputValue, mcpScalarOptionKey, mcpToolParameterSchema } from '../lib/mcpParameterSchema';
import { expandMcpUriTemplate } from '../lib/mcpUriTemplate';
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
  oauthAuthorizationUrl: '',
  oauthAccessTokenUrl: '',
  oauthClientId: '',
  oauthClientSecret: '',
  oauthScope: '',
  oauthState: '',
  oauthRefreshToken: '',
  oauthIdentityToken: '',
  oauthExpiresAt: 0,
  oauthTokenPrefix: 'Bearer',
  oauthRegisteredClientId: '',
  oauthRegisteredClientSecret: '',
  oauthRegisteredClientIdIssuedAt: 0,
  oauthRegisteredClientSecretExpiresAt: 0,
  oauthRegisteredTokenEndpointAuthMethod: 'none',
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

export const integrationSecretInputType = (showPasswords: boolean, revealed: boolean): 'password' | 'text' => showPasswords || revealed ? 'text' : 'password';
export const mcpOperationDraftKey = (clientId: string, kind: 'tool' | 'prompt' | 'resource', name: string) => JSON.stringify([clientId, kind, name]);
export const withMcpParameterDraft = (drafts: Record<string, string>, key: string, value: string) => Object.fromEntries([...Object.entries(drafts).filter(([candidate]) => candidate !== key), [key, value]].slice(-1000));

type IntegrationSecretInputProps = {
  disabled: boolean;
  label: string;
  onChange: (value: string) => void;
  placeholder: string;
  showPasswords: boolean;
  value: string;
};

function IntegrationSecretInput({ disabled, label, onChange, placeholder, showPasswords, value }: IntegrationSecretInputProps) {
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    if (showPasswords) setRevealed(false);
  }, [showPasswords]);
  const inputType = integrationSecretInputType(showPasswords, revealed);
  const masked = inputType === 'password';
  return <span className={`integration-secret-field${showPasswords ? '' : ' masked'}`}><input disabled={disabled} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} type={inputType} value={value} />{!showPasswords ? <button aria-label={masked ? `Show ${label}` : `Hide ${label}`} disabled={disabled} onClick={() => setRevealed((current) => !current)} type="button">{masked ? 'Show' : 'Hide'}</button> : null}</span>;
}

export function IntegrationWorkbench({ workspace, environment, requestContext: baseRequestContext, onChangeWorkspace }: IntegrationWorkbenchProps) {
  const requestContext = { ...baseRequestContext, certificates: workspace.certificates };
  const [tab, setTab] = useState<'mcp' | 'ai' | 'konnect'>('mcp');
  const [activeId, setActiveId] = useState(workspace.mcpClients[0]?.id ?? '');
  const [operationKind, setOperationKind] = useState<'tool' | 'prompt' | 'resource'>('tool');
  const [operationName, setOperationName] = useState('');
  const [parameters, setParameters] = useState('{}');
  const [parameterDrafts, setParameterDrafts] = useState<Record<string, string>>({});
  const [events, setEvents] = useState<McpEvent[]>([]);
  const [result, setResult] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const activeMcpAbort = useRef<AbortController | undefined>(undefined);
  const native = isTauri();
  const active = workspace.mcpClients.find((client) => client.id === activeId) ?? workspace.mcpClients[0];
  const oauthClientStatus = active?.oauthClientId ? 'manual client' : active?.oauthRegisteredClientId ? 'dynamically registered client' : 'client discovery pending';
  const oauthTokenStatus = active?.authType !== 'oauth2' || !active.token
    ? 'Not authorized'
    : active.oauthExpiresAt > 0
      ? active.oauthExpiresAt <= Date.now() ? 'Token expired' : `Authorized until ${new Date(active.oauthExpiresAt).toLocaleString()}`
      : 'Authorized · provider supplied no expiry';
  const oauthStatus = `${oauthTokenStatus} · ${oauthClientStatus}`;
  const currentMember = workspace.governance.members.find((member) => member.id === workspace.governance.currentMemberId);
  const canEdit = Boolean(currentMember?.active && currentMember.role !== 'viewer');
  const secretCandidates = plaintextSecretCandidates(workspace).filter((candidate) => /^(MCP|AI provider|Konnect)/.test(candidate));

  useEffect(() => () => activeMcpAbort.current?.abort(new DOMException('MCP operation canceled.', 'AbortError')), []);

  const run = async (label: string, operation: (signal?: AbortSignal) => Promise<void>, cancelable = false) => {
    if (busy) return;
    const controller = cancelable ? new AbortController() : undefined;
    activeMcpAbort.current = controller;
    setBusy(label); setError(''); setMessage('');
    try { await operation(controller?.signal); }
    catch (caught) {
      if (controller?.signal.aborted) {
        const canceledEvent: McpEvent = { direction: 'client', method: 'notifications/cancelled', detail: label, timestamp: new Date().toISOString() };
        setEvents((current) => [...current, canceledEvent].slice(-1000));
        setMessage(`${label} canceled.`);
      }
      else setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      if (activeMcpAbort.current === controller) activeMcpAbort.current = undefined;
      setBusy('');
    }
  };
  const cancelMcpOperation = () => activeMcpAbort.current?.abort(new DOMException('MCP operation canceled.', 'AbortError'));

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

  const clearOAuthTokens = () => ({ token: '', oauthRefreshToken: '', oauthIdentityToken: '', oauthExpiresAt: 0 });
  const clearOAuthRegistration = () => ({ oauthRegisteredClientId: '', oauthRegisteredClientSecret: '', oauthRegisteredClientIdIssuedAt: 0, oauthRegisteredClientSecretExpiresAt: 0, oauthRegisteredTokenEndpointAuthMethod: 'none' as const });
  const clearOAuthRuntime = () => ({ ...clearOAuthTokens(), ...clearOAuthRegistration() });
  const updateOAuthConfiguration = (patch: Partial<McpClient>) => updateClient({ ...clearOAuthRuntime(), ...patch }, true);
  const changeAuthType = (authType: McpClient['authType']) => updateClient({ authType, username: '', password: '', ...clearOAuthRuntime() }, true);
  const clearOAuthCredentials = () => {
    updateClient(clearOAuthTokens());
    setMessage('Cleared this MCP client’s local OAuth tokens.');
  };
  const persistMcpClient = (updated: McpClient) => onChangeWorkspace((current) => ({ ...current, mcpClients: current.mcpClients.map((client) => client.id === updated.id ? updated : client) }));

  const discover = () => active && canEdit && run('Discovering MCP capabilities', async (signal) => {
    const discovered = await discoverMcpClient(active, environment, { ...requestContext, signal, cancellationId: `mcp-discover-${active.id}-${crypto.randomUUID()}`, onMcpClient: persistMcpClient });
    onChangeWorkspace((current) => ({ ...current, mcpClients: current.mcpClients.map((client) => client.id === active.id ? discovered.client : client) }));
    setEvents(discovered.events);
    setMessage(`Discovered ${discovered.client.tools.length} tools, ${discovered.client.prompts.length} prompts, ${discovered.client.resources.length} resources, and ${discovered.client.resourceTemplates.length} templates${discovered.warnings.length ? ` · ${discovered.warnings.length} optional list calls unavailable` : ''}.`);
  }, true);

  const operations = useMemo(() => {
    if (!active) return [];
    if (operationKind === 'tool') return active.tools.map((item) => ({ name: item.name, description: item.description }));
    if (operationKind === 'prompt') return active.prompts.map((item) => ({ name: item.name, description: item.description }));
    return [...active.resources, ...active.resourceTemplates].map((item) => ({ name: item.uri, description: item.description || item.name }));
  }, [active, operationKind]);

  const selectedResourceTemplate = operationKind === 'resource'
    ? active?.resourceTemplates.find((resource) => resource.uri === operationName || resource.uriTemplate === operationName)
    : undefined;
  const selectedTool = operationKind === 'tool' ? active?.tools.find((tool) => tool.name === operationName) : undefined;
  const selectedPrompt = operationKind === 'prompt' ? active?.prompts.find((prompt) => prompt.name === operationName) : undefined;
  const selectedToolSchema = useMemo(() => selectedTool ? mcpToolParameterSchema(selectedTool.inputSchema) : { fields: [], hasComplexFields: false }, [selectedTool]);
  const parameterValues = useMemo(() => {
    try {
      const value: unknown = JSON.parse(parameters);
      return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
    } catch { return {}; }
  }, [parameters]);
  const resourceTemplatePreview = useMemo(() => {
    if (!selectedResourceTemplate) return { uri: '', error: '' };
    try { return { uri: expandMcpUriTemplate(selectedResourceTemplate.uriTemplate || selectedResourceTemplate.uri, parameterValues), error: '' }; }
    catch (caught) { return { uri: '', error: caught instanceof Error ? caught.message : String(caught) }; }
  }, [parameterValues, selectedResourceTemplate]);

  const selectOperationKind = (kind: 'tool' | 'prompt' | 'resource') => {
    setOperationKind(kind);
    setOperationName('');
    setParameters('{}');
  };

  const setParameterText = (value: string) => {
    setParameters(value);
    if (active && operationName) {
      const key = mcpOperationDraftKey(active.id, operationKind, operationName);
      setParameterDrafts((current) => withMcpParameterDraft(current, key, value));
    }
  };

  const selectOperation = (name: string) => {
    setOperationName(name);
    const template = operationKind === 'resource' ? active?.resourceTemplates.find((resource) => resource.uri === name || resource.uriTemplate === name) : undefined;
    const prompt = operationKind === 'prompt' ? active?.prompts.find((item) => item.name === name) : undefined;
    const tool = operationKind === 'tool' ? active?.tools.find((item) => item.name === name) : undefined;
    const initial = template
      ? Object.fromEntries(template.variables.map((variable) => [variable, '']))
      : prompt
        ? Object.fromEntries(prompt.arguments.map((argument) => [argument.name, '']))
        : tool
          ? initialMcpToolParameters(mcpToolParameterSchema(tool.inputSchema))
          : {};
    const key = mcpOperationDraftKey(active?.id ?? '', operationKind, name);
    const value = parameterDrafts[key] ?? JSON.stringify(initial, null, 2);
    setParameters(value);
    setParameterDrafts((current) => current[key] === undefined ? withMcpParameterDraft(current, key, value) : current);
    setResult('');
  };

  const updateTemplateVariable = (name: string, value: string) => {
    setParameterText(JSON.stringify(Object.fromEntries([...Object.entries(parameterValues).filter(([key]) => key !== name), [name, value]]), null, 2));
  };

  const updateGuidedParameter = (name: string, value: unknown) => {
    setParameterText(JSON.stringify({ ...parameterValues, [name]: value }, null, 2));
  };

  const invokeOperation = () => active && operationName && canEdit && run('Invoking MCP operation', async (signal) => {
    let parsed: Record<string, unknown>;
    try { parsed = JSON.parse(parameters) as Record<string, unknown>; }
    catch { throw new Error('MCP parameters must be a JSON object.'); }
    const output = await invokeMcpOperation(active, operationKind, operationName, parsed, environment, { ...requestContext, signal, cancellationId: `mcp-invoke-${active.id}-${crypto.randomUUID()}`, onMcpClient: persistMcpClient });
    onChangeWorkspace((current) => ({ ...current, mcpClients: current.mcpClients.map((client) => client.id === active.id ? output.client : client) }));
    setEvents(output.events);
    setResult(JSON.stringify(output.result, null, 2));
    setMessage(`${operationKind} operation completed.`);
  }, true);

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
        <aside className="integration-list"><header><strong>MCP clients</strong><button disabled={!canEdit} onClick={addClient} type="button"><Icon name="plus" size={15} /> Add</button></header>{workspace.mcpClients.map((client) => <button className={active?.id === client.id ? 'active' : ''} key={client.id} onClick={() => { setActiveId(client.id); setOperationName(''); setResult(''); }} type="button"><span><strong>{client.name}</strong><small>{client.transport.toUpperCase()} · {client.enabled ? 'enabled' : 'disabled'}</small></span><em>{client.tools.length + client.prompts.length + client.resources.length + client.resourceTemplates.length}</em></button>)}{!workspace.mcpClients.length ? <p>Create an HTTP or STDIO client to discover tools, prompts, and resources.</p> : null}</aside>
        {active ? <div className="integration-mcp-main" key={active.id}>
          <section className="integration-card mcp-config"><header><div><small>Project-scoped configuration</small><h2>{active.name}</h2></div><div><label className="inline-toggle"><input checked={active.enabled} disabled={!canEdit} onChange={(event) => updateClient({ enabled: event.target.checked })} type="checkbox" /> Enabled</label><button disabled={!canEdit} onClick={deleteClient} type="button"><Icon name="trash" size={14} /></button></div></header><div className="integration-fields"><label>Name<input disabled={!canEdit} value={active.name} onChange={(event) => updateClient({ name: event.target.value })} /></label><label>Transport<select disabled={!canEdit} value={active.transport} onChange={(event) => updateClient({ transport: event.target.value as McpClient['transport'] }, true)}><option value="http">HTTP JSON-RPC</option><option value="stdio">STDIO</option></select></label>{active.transport === 'http' ? <label className="wide">Server URL<input disabled={!canEdit} value={active.url} onChange={(event) => updateClient({ url: event.target.value }, true)} placeholder="https://server.example/mcp" /></label> : <><label className="wide">Executable<input disabled={!canEdit} value={active.command} onChange={(event) => updateClient({ command: event.target.value }, true)} placeholder="/absolute/path/to/mcp-server" /></label><label className="wide">Arguments (one per line)<textarea disabled={!canEdit} value={active.args.join('\n')} onChange={(event) => updateClient({ args: event.target.value.split('\n').filter(Boolean) }, true)} /></label></>}<label>Auth<select disabled={!canEdit || active.transport === 'stdio'} value={active.authType} onChange={(event) => changeAuthType(event.target.value as McpClient['authType'])}><option value="none">None</option><option value="bearer">Bearer / PAT</option><option value="basic">Basic</option><option value="oauth2">OAuth 2 (MCP)</option></select></label>{active.authType === 'bearer' ? <label>Token<IntegrationSecretInput disabled={!canEdit} label="MCP bearer token" onChange={(token) => updateClient({ token })} placeholder="{{ vault.mcp_token }}" showPasswords={workspace.preferences.showPasswords} value={active.token} /></label> : active.authType === 'basic' ? <><label>Username<input disabled={!canEdit} value={active.username} onChange={(event) => updateClient({ username: event.target.value })} /></label><label>Password<IntegrationSecretInput disabled={!canEdit} label="MCP password" onChange={(password) => updateClient({ password })} placeholder="{{ vault.mcp_password }}" showPasswords={workspace.preferences.showPasswords} value={active.password} /></label></> : active.authType === 'oauth2' ? <><label className="wide">Authorization URL<input disabled={!canEdit} onChange={(event) => updateOAuthConfiguration({ oauthAuthorizationUrl: event.target.value })} placeholder="https://identity.example/authorize" value={active.oauthAuthorizationUrl} /></label><label className="wide">Access-token URL<input disabled={!canEdit} onChange={(event) => updateOAuthConfiguration({ oauthAccessTokenUrl: event.target.value })} placeholder="https://identity.example/token" value={active.oauthAccessTokenUrl} /></label><label>Client ID<input disabled={!canEdit} onChange={(event) => updateOAuthConfiguration({ oauthClientId: event.target.value })} value={active.oauthClientId} /></label><label>Client secret or reference<IntegrationSecretInput disabled={!canEdit} label="MCP OAuth client secret" onChange={(oauthClientSecret) => updateOAuthConfiguration({ oauthClientSecret })} placeholder="{{ vault.mcp_client_secret }}" showPasswords={workspace.preferences.showPasswords} value={active.oauthClientSecret} /></label><label>Scope<input disabled={!canEdit} onChange={(event) => updateOAuthConfiguration({ oauthScope: event.target.value })} placeholder="openid profile" value={active.oauthScope} /></label><label>State override<input disabled={!canEdit} onChange={(event) => updateOAuthConfiguration({ oauthState: event.target.value })} placeholder="Generated when blank" value={active.oauthState} /></label><div className="mcp-oauth-runtime wide"><span><strong>{oauthStatus}</strong><small>Authorization code + PKCE S256 · loopback callback · tokens stay device-local</small></span><button disabled={!canEdit || (!active.token && !active.oauthRefreshToken && !active.oauthIdentityToken)} onClick={clearOAuthCredentials} type="button">Clear tokens</button></div></> : null}<label className="wide">Roots (URI per line)<textarea disabled={!canEdit} value={active.roots.join('\n')} onChange={(event) => updateClient({ roots: event.target.value.split('\n').map((value) => value.trim()).filter(Boolean) })} placeholder="file:///Users/me/project" /></label></div><div className="mcp-header-editor"><header><strong>HTTP headers</strong><button disabled={!canEdit || active.transport === 'stdio'} onClick={() => updateClient({ headers: [...active.headers, row()] })} type="button">Add header</button></header>{active.headers.map((header) => <div key={header.id}><input checked={header.enabled} disabled={!canEdit} onChange={(event) => updateClient({ headers: active.headers.map((item) => item.id === header.id ? { ...item, enabled: event.target.checked } : item) })} type="checkbox" /><input disabled={!canEdit} value={header.name} onChange={(event) => updateClient({ headers: active.headers.map((item) => item.id === header.id ? { ...item, name: event.target.value } : item) })} placeholder="Header" /><input disabled={!canEdit} value={header.value} onChange={(event) => updateClient({ headers: active.headers.map((item) => item.id === header.id ? { ...item, value: event.target.value } : item) })} placeholder="Value or vault reference" /><button disabled={!canEdit} onClick={() => updateClient({ headers: active.headers.filter((item) => item.id !== header.id) })} type="button"><Icon name="x" size={13} /></button></div>)}</div><div className="integration-actions"><button disabled={!canEdit || !active.enabled || Boolean(busy) || (active.transport === 'stdio' && !native)} onClick={discover} type="button">Connect / resync</button><small>{active.lastSyncedAt ? `Cached ${new Date(active.lastSyncedAt).toLocaleString()}` : 'Imported clients remain disabled until reviewed.'}</small></div>{active.transport === 'stdio' ? <p>STDIO starts the configured executable directly for each operation—never through a shell. Interactive elicitation/sampling and persistent process sessions remain a later closure step.</p> : null}</section>
          <section className="integration-card mcp-operations">
            <header><div><small>Discovered and cached</small><h2>Operations</h2></div><div className="segmented-control"><button className={operationKind === 'tool' ? 'active' : ''} onClick={() => selectOperationKind('tool')} type="button">Tools {active.tools.length}</button><button className={operationKind === 'prompt' ? 'active' : ''} onClick={() => selectOperationKind('prompt')} type="button">Prompts {active.prompts.length}</button><button className={operationKind === 'resource' ? 'active' : ''} onClick={() => selectOperationKind('resource')} type="button">Resources {active.resources.length + active.resourceTemplates.length}</button></div></header>
            <div className="mcp-operation-grid">
              <div className="mcp-operation-list">{operations.map((operation, index) => <button className={operationName === operation.name ? 'active' : ''} key={`${operation.name}-${index}`} onClick={() => selectOperation(operation.name)} type="button"><strong>{operation.name}</strong><small>{operation.description || 'No description'}</small></button>)}</div>
              <div className="mcp-operation-run">
                {selectedResourceTemplate ? <div className="mcp-template-parameters"><header><strong>URI template parameters</strong><small>All discovered variables are strings.</small></header>{selectedResourceTemplate.variables.map((variable) => <label key={variable}>{variable}<input onChange={(event) => updateTemplateVariable(variable, event.target.value)} required value={String(parameterValues[variable] ?? '')} /></label>)}{!selectedResourceTemplate.variables.length ? <p>This template has no valid variables. Review its syntax before invoking it.</p> : null}<div className="mcp-template-preview"><small>Expanded URI</small><code>{resourceTemplatePreview.error || resourceTemplatePreview.uri || selectedResourceTemplate.uriTemplate}</code></div></div> : selectedPrompt ? <><div className="mcp-template-parameters mcp-guided-parameters"><header><strong>Prompt arguments</strong><small>String arguments from the server schema.</small></header>{selectedPrompt.arguments.map((argument) => <label key={argument.name}><span>{argument.name}{argument.required ? ' *' : ''}</span><input onChange={(event) => updateGuidedParameter(argument.name, event.target.value)} required={argument.required} value={String(parameterValues[argument.name] ?? '')} />{argument.description ? <small>{argument.description}</small> : null}</label>)}{!selectedPrompt.arguments.length ? <p>This prompt accepts no arguments.</p> : null}</div><label>Parameter overview<textarea value={parameters} onChange={(event) => setParameterText(event.target.value)} /></label></> : selectedTool ? <><div className="mcp-template-parameters mcp-guided-parameters"><header><strong>Tool parameters</strong><small>Top-level scalar JSON Schema fields.</small></header>{selectedToolSchema.fields.map((field) => field.options.length ? <label key={field.name}><span>{field.title}{field.required ? ' *' : ''}</span><select onChange={(event) => { const option = field.options.find((candidate) => mcpScalarOptionKey(candidate.value) === event.target.value); if (option) updateGuidedParameter(field.name, option.value); }} required={field.required} value={parameterValues[field.name] === undefined ? '' : mcpScalarOptionKey(parameterValues[field.name])}><option value="">Choose…</option>{field.options.map((option) => <option key={mcpScalarOptionKey(option.value)} value={mcpScalarOptionKey(option.value)}>{option.label}</option>)}</select>{field.description ? <small>{field.description}</small> : null}</label> : field.type === 'boolean' ? <label className="mcp-guided-toggle" key={field.name}><span>{field.title}{field.required ? ' *' : ''}</span><input checked={parameterValues[field.name] === true} onChange={(event) => updateGuidedParameter(field.name, event.target.checked)} type="checkbox" />{field.description ? <small>{field.description}</small> : null}</label> : <label key={field.name}><span>{field.title}{field.required ? ' *' : ''}</span><input onChange={(event) => updateGuidedParameter(field.name, mcpScalarInputValue(field, event.target.value))} required={field.required} type={field.type === 'string' ? 'text' : 'number'} value={String(parameterValues[field.name] ?? '')} />{field.description ? <small>{field.description}</small> : null}</label>)}{selectedToolSchema.hasComplexFields ? <p>Nested, array, union-only, or additional fields remain editable in the JSON overview.</p> : null}{!selectedToolSchema.fields.length && !selectedToolSchema.hasComplexFields ? <p>This tool declares no top-level parameters.</p> : null}</div><label>Parameter overview<textarea value={parameters} onChange={(event) => setParameterText(event.target.value)} /></label></> : operationKind === 'resource' ? <div className="mcp-template-preview"><small>Resource URI</small><code>{operationName || 'Select a resource.'}</code></div> : <label>JSON parameters<textarea value={parameters} onChange={(event) => setParameterText(event.target.value)} /></label>}
                <button disabled={!canEdit || !operationName || Boolean(busy) || Boolean(resourceTemplatePreview.error)} onClick={invokeOperation} type="button">Invoke {operationKind}</button>
                <pre>{result || 'Operation output appears here.'}</pre>
              </div>
            </div>
          </section>
          <section className="integration-card mcp-console"><header><div><small>Runtime detail</small><h2>Events and console</h2></div><span>{events.length}</span></header><div>{events.map((event, index) => <article key={`${event.timestamp}-${index}`}><time>{new Date(event.timestamp).toLocaleTimeString()}</time><strong>{event.direction} · {event.method}</strong><pre>{event.detail}</pre></article>)}{!events.length ? <p>No runtime events yet.</p> : null}</div></section>
        </div> : <div className="empty-state"><Icon name="globe" size={30} /><strong>No MCP client selected</strong><span>Create one to begin.</span></div>}
      </div> : null}

      {tab === 'ai' ? <div className="integration-grid"><section className="integration-card"><header><div><small>User-selected provider</small><h2>Large language model</h2></div><label className="inline-toggle"><input checked={workspace.ai.enabled} disabled={!canEdit} onChange={(event) => onChangeWorkspace((current) => ({ ...current, ai: { ...current.ai, enabled: event.target.checked } }))} type="checkbox" /> Active</label></header><div className="integration-fields"><label>Provider<select disabled={!canEdit} value={workspace.ai.provider} onChange={(event) => { const provider = event.target.value as Workspace['ai']['provider']; onChangeWorkspace((current) => ({ ...current, ai: { ...current.ai, provider, baseUrl: providerBaseUrl(provider), enabled: false } })); }}><option value="openai">OpenAI</option><option value="anthropic">Claude / Anthropic</option><option value="gemini">Gemini</option><option value="openai-compatible">Custom or local OpenAI-compatible</option></select></label><label>Model<input disabled={!canEdit} value={workspace.ai.model} onChange={(event) => onChangeWorkspace((current) => ({ ...current, ai: { ...current.ai, model: event.target.value } }))} placeholder="model identifier" /></label><label className="wide">Base URL<input disabled={!canEdit} value={workspace.ai.baseUrl} onChange={(event) => onChangeWorkspace((current) => ({ ...current, ai: { ...current.ai, baseUrl: event.target.value, enabled: false } }))} placeholder="https://api.openai.com/v1" /></label><label className="wide">API key or secret reference<IntegrationSecretInput disabled={!canEdit} label="AI provider credential" onChange={(apiKey) => onChangeWorkspace((current) => ({ ...current, ai: { ...current.ai, apiKey } }))} placeholder="{{ vault.ai_api_key }}" showPasswords={workspace.preferences.showPasswords} value={workspace.ai.apiKey} /></label></div><div className="policy-list"><label><input checked={workspace.ai.mockGeneration} disabled={!canEdit || !workspace.ai.enabled} onChange={(event) => onChangeWorkspace((current) => ({ ...current, ai: { ...current.ai, mockGeneration: event.target.checked } }))} type="checkbox" /> AI-assisted mock generation</label><label><input checked={workspace.ai.commitSuggestions} disabled={!canEdit || !workspace.ai.enabled} onChange={(event) => onChangeWorkspace((current) => ({ ...current, ai: { ...current.ai, commitSuggestions: event.target.checked } }))} type="checkbox" /> Git commit grouping and message suggestions</label></div><div className="integration-actions"><button disabled={!canEdit || !workspace.ai.enabled || !workspace.ai.model || Boolean(busy)} onClick={testAi} type="button">Test provider</button></div><p>Hosted credentials must be complete vault references. Local and custom providers may use loopback HTTP; remote providers require HTTPS. AI features send only the input shown at the point of use.</p></section><section className="integration-card"><header><div><small>Explicit use only</small><h2>Data boundary</h2></div><Icon name="spark" size={24} /></header><ul><li>Mock generation sends only the prompt/spec/example you paste.</li><li>Git suggestions send the staged/working diff and listed paths, capped before transmission.</li><li>MCP sampling is not forwarded automatically; interactive review is still required work.</li><li>No AI provider is bundled, required, or tied to a Brunomnia subscription.</li></ul><pre>{result || 'Provider test output appears here.'}</pre></section></div> : null}

      {tab === 'konnect' ? <div className="integration-grid"><section className="integration-card"><header><div><small>Pull-only Gateway integration</small><h2>Konnect</h2></div><label className="inline-toggle"><input checked={workspace.konnect.enabled} disabled={!canEdit} onChange={(event) => onChangeWorkspace((current) => ({ ...current, konnect: { ...current.konnect, enabled: event.target.checked } }))} type="checkbox" /> Enabled</label></header><div className="integration-fields"><label className="wide">Regional API URL<input disabled={!canEdit} value={workspace.konnect.baseUrl} onChange={(event) => onChangeWorkspace((current) => ({ ...current, konnect: { ...current.konnect, baseUrl: event.target.value, enabled: false, controlPlanes: [], controlPlaneId: '' } }))} placeholder="https://us.api.konghq.com" /></label><label className="wide">PAT or system-token reference<IntegrationSecretInput disabled={!canEdit} label="Konnect credential" onChange={(token) => onChangeWorkspace((current) => ({ ...current, konnect: { ...current.konnect, token } }))} placeholder="{{ vault.konnect_pat }}" showPasswords={workspace.preferences.showPasswords} value={workspace.konnect.token} /></label><label className="wide">Control plane<select disabled={!canEdit || !workspace.konnect.controlPlanes.length} value={workspace.konnect.controlPlaneId} onChange={(event) => onChangeWorkspace((current) => ({ ...current, konnect: { ...current.konnect, controlPlaneId: event.target.value } }))}><option value="">Choose a control plane…</option>{workspace.konnect.controlPlanes.map((plane) => <option key={plane.id} value={plane.id}>{plane.name}</option>)}</select></label></div><div className="integration-actions"><button disabled={!canEdit || !workspace.konnect.enabled || !workspace.konnect.token || Boolean(busy)} onClick={connectKonnect} type="button">Validate and list</button><button disabled={!canEdit || !workspace.konnect.enabled || !workspace.konnect.controlPlaneId || Boolean(busy)} onClick={syncKonnect} type="button">Pull routes</button></div><p>Sync is read-only. Gateway Services become collections with managed route and path/protocol folders; HTTP/HTTPS method/path combinations, WS/WSS paths, and gRPC/GRPCS methods become native requests. Simple expression-router method/path/host/header predicates are converted; unextractable or SNI expressions stay visible in Skipped Routes. Safe control-plane proxy URLs seed managed environment values, with loopback review defaults when unavailable. Later pulls replace remote-managed names, URLs, hierarchy, path parameters, and headers/metadata while preserving local query, auth, body, transport, script, test, custom-header, edited proxy, folder notes, and manually organized local-folder work. SNI and L4 routes remain explicit skips.</p>{workspace.konnect.lastSyncedAt ? <small>Last pulled {new Date(workspace.konnect.lastSyncedAt).toLocaleString()}</small> : null}</section><section className="integration-card"><header><div><small>Credential confinement</small><h2>Konnect boundary</h2></div><Icon name="lock" size={24} /></header><ul><li>Only HTTPS hosts under `*.api.konghq.com` are accepted.</li><li>Pagination cannot leave the configured origin.</li><li>Redirects and cookies are disabled for control-plane calls.</li><li>The PAT is resolved at send time from your local vault or approved external provider.</li><li>Brunomnia never pushes Gateway configuration.</li></ul></section></div> : null}

      {busy ? <div className="automation-message">{busy}…{activeMcpAbort.current ? <button onClick={cancelMcpOperation} type="button">Cancel MCP operation</button> : null}</div> : null}{error ? <div className="automation-message error">{error}</div> : null}{message ? <div className="automation-message">{message}</div> : null}
    </section>
  );
}
