import { useMemo, useState } from 'react';
import type { AiSettings, Environment, JsonValue } from '../types';
import { generateAiText, parseAiJson } from '../lib/ai';
import type { SendRequestContext } from '../lib/http';
import type { McpReviewedServerRequest, McpServerRequestResponse } from '../lib/mcp';
import {
  initialMcpToolParameters,
  mcpParameterIssues,
  renameMcpParameterValue,
  withMcpParameterValue,
  withoutMcpParameterValue,
  type McpParameterPath,
} from '../lib/mcpParameterSchema';
import { McpParameterField } from './McpParameterField';

type McpServerRequestPanelProps = {
  ai: AiSettings;
  disabled: boolean;
  environment: Environment | undefined;
  request: McpReviewedServerRequest;
  requestContext: SendRequestContext;
  responding: boolean;
  onRespond: (response: McpServerRequestResponse) => Promise<void>;
};

const asRecord = (value: unknown) => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
const asString = (value: unknown) => typeof value === 'string' ? value : '';
const requestKey = (request: McpReviewedServerRequest) => JSON.stringify([request.clientId, request.id]);
const boundedJson = (value: unknown) => {
  const source = JSON.stringify(value, null, 2);
  return source.length <= 200_000 ? source : `${source.slice(0, 200_000)}\n…truncated`;
};

export function McpServerRequestPanel({ ai, disabled, environment, request, requestContext, responding, onRespond }: McpServerRequestPanelProps) {
  const elicitationSchema = (asRecord(request.params.requestedSchema) ?? {}) as JsonValue;
  const [elicitationValue, setElicitationValue] = useState<Record<string, unknown>>(() => request.method === 'elicitation/create' ? initialMcpToolParameters(elicitationSchema) : {});
  const [variants, setVariants] = useState<Record<string, number>>({});
  const [content, setContent] = useState('');
  const [role, setRole] = useState<'assistant' | 'user'>('assistant');
  const [model, setModel] = useState(ai.model);
  const [stopReason, setStopReason] = useState<'endTurn' | 'stopSequence' | 'maxTokens'>('endTurn');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const variantPrefix = `server-request:${requestKey(request)}`;
  const samplingContext = useMemo(() => boundedJson(request.params), [request.params]);
  const issues = useMemo(() => request.method === 'elicitation/create'
    ? mcpParameterIssues(elicitationSchema, elicitationValue, elicitationSchema, variants, variantPrefix)
    : [], [elicitationSchema, elicitationValue, request.method, variantPrefix, variants]);

  const setElicitationPath = (path: McpParameterPath, value: JsonValue) => setElicitationValue((current) => withMcpParameterValue(current, path, value) as Record<string, unknown>);
  const removeElicitationPath = (path: McpParameterPath) => setElicitationValue((current) => withoutMcpParameterValue(current, path) as Record<string, unknown>);
  const renameElicitationPath = (path: McpParameterPath, currentName: string, nextName: string) => setElicitationValue((current) => renameMcpParameterValue(current, path, currentName, nextName) as Record<string, unknown>);
  const respond = async (response: McpServerRequestResponse) => {
    setError('');
    try { await onRespond(response); }
    catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
  };
  const generateDraft = async () => {
    setGenerating(true); setError('');
    try {
      const source = await generateAiText(ai, `Draft a response to this MCP sampling request. Return only JSON shaped as {"content":"response text","role":"assistant","model":"model identifier","stopReason":"endTurn"}. Do not include tool calls or hidden reasoning.\n\nREQUEST:\n${samplingContext}`, environment, requestContext);
      const parsed = asRecord(parseAiJson(source));
      const generatedContent = asString(parsed?.content);
      if (!generatedContent) throw new Error('The AI provider did not return sampling response content.');
      setContent(generatedContent.slice(0, 1_000_000));
      const generatedRole = asString(parsed?.role);
      if (generatedRole === 'assistant' || generatedRole === 'user') setRole(generatedRole);
      const generatedModel = asString(parsed?.model).trim();
      if (generatedModel) setModel(generatedModel.slice(0, 500));
      const generatedStopReason = asString(parsed?.stopReason);
      if (generatedStopReason === 'endTurn' || generatedStopReason === 'stopSequence' || generatedStopReason === 'maxTokens') setStopReason(generatedStopReason);
    } catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
    finally { setGenerating(false); }
  };

  return <article className="mcp-server-request">
    <header><div><small>Server request · review required</small><h3>{request.method === 'elicitation/create' ? 'Elicitation' : 'Sampling'}</h3></div><code>{String(request.id)}</code></header>
    {request.method === 'elicitation/create' ? <>
      <p>{asString(request.params.message).slice(0, 200_000) || 'The MCP server requested structured input.'}</p>
      <div className="mcp-template-parameters mcp-schema-builder"><McpParameterField schema={elicitationSchema} rootSchema={elicitationSchema} value={elicitationValue} path={[]} label="Response" required variantPrefix={variantPrefix} variants={variants} onSet={setElicitationPath} onRemove={removeElicitationPath} onRename={renameElicitationPath} onVariant={(key, index) => setVariants((current) => ({ ...current, [key]: index }))} />{issues.length ? <div className="mcp-schema-issues"><strong>{issues.length} schema issue{issues.length === 1 ? '' : 's'}</strong><ul>{issues.slice(0, 8).map((issue) => <li key={issue}>{issue}</li>)}</ul></div> : <small className="mcp-schema-valid">The response satisfies the requested schema.</small>}</div>
      <div className="integration-actions"><button disabled={disabled || responding || Boolean(issues.length)} onClick={() => void respond({ result: { action: 'accept', content: elicitationValue } })} type="button">Submit</button><button disabled={disabled || responding} onClick={() => void respond({ result: { action: 'decline' } })} type="button">Decline</button><button disabled={disabled || responding} onClick={() => void respond({ result: { action: 'cancel' } })} type="button">Cancel</button></div>
    </> : <>
      <details><summary>Sampling request context</summary><pre>{samplingContext}</pre></details>
      <label>Response content<textarea maxLength={1_000_000} onChange={(event) => setContent(event.target.value)} value={content} /></label>
      <div className="mcp-server-request-fields"><label>Role<select onChange={(event) => setRole(event.target.value as 'assistant' | 'user')} value={role}><option value="assistant">Assistant</option><option value="user">User</option></select></label><label>Model<input maxLength={500} onChange={(event) => setModel(event.target.value)} value={model} /></label><label>Stop reason<select onChange={(event) => setStopReason(event.target.value as typeof stopReason)} value={stopReason}><option value="endTurn">End turn</option><option value="stopSequence">Stop sequence</option><option value="maxTokens">Max tokens</option></select></label></div>
      <div className="integration-actions"><button disabled={disabled || responding || !content.trim() || !model.trim()} onClick={() => void respond({ result: { content: { type: 'text', text: content }, role, model, stopReason } })} type="button">Approve</button><button disabled={disabled || responding} onClick={() => void respond({ error: { code: -32603, message: 'User rejected the sampling request.' } })} type="button">Reject</button><button disabled={disabled || responding || generating || !ai.enabled || !ai.model.trim()} onClick={() => void generateDraft()} type="button">{generating ? 'Generating…' : 'Generate AI draft'}</button></div>
      <small>AI output fills this form only. Review and approve it explicitly before anything returns to the MCP server.</small>
    </>}
    {error ? <div className="automation-message error">{error}</div> : null}
  </article>;
}
