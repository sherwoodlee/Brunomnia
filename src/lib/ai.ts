import type { AiSettings, Environment, HttpMethod, MockServer } from '../types';
import { createBlankRequest } from '../data/seed';
import { sendRequest, type SendRequestContext } from './http';
import { isProtectedSecretReference } from './security';

export type AiCommitGroup = { message: string; comment: string; files: string[] };

const asRecord = (value: unknown) => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
const asString = (value: unknown) => typeof value === 'string' ? value : '';
const endpoint = (settings: AiSettings) => {
  const fallback = settings.provider === 'openai'
    ? 'https://api.openai.com/v1'
    : settings.provider === 'anthropic'
      ? 'https://api.anthropic.com'
      : settings.provider === 'gemini'
        ? 'https://generativelanguage.googleapis.com/v1beta'
        : 'http://127.0.0.1:11434/v1';
  const url = new URL(settings.baseUrl.trim() || fallback);
  if (url.username || url.password) throw new Error('AI provider URLs cannot contain credentials. Use a local-vault or external-vault reference in the API key field.');
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '::1';
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) throw new Error('Remote AI providers must use HTTPS; HTTP is limited to loopback models.');
  return url.toString().replace(/\/$/, '');
};

export const generateAiText = async (settings: AiSettings, prompt: string, environment: Environment | undefined, context: SendRequestContext) => {
  if (!settings.enabled) throw new Error('Activate an AI provider in Integrations before using AI-assisted workflows.');
  if (!settings.model.trim()) throw new Error('Choose an AI model.');
  const hosted = settings.provider !== 'openai-compatible';
  if (hosted && !settings.apiKey.trim()) throw new Error('Hosted AI providers require an API key stored in the local vault or an approved external vault.');
  if (settings.apiKey.trim() && !isProtectedSecretReference(settings.apiKey)) throw new Error('AI provider keys must be a complete local-vault or approved external-vault reference.');
  const request = createBlankRequest(`ai-${crypto.randomUUID()}`);
  request.name = `AI · ${settings.provider}`;
  request.method = 'POST';
  request.bodyMode = 'json';
  request.transport = { ...request.transport, timeoutMode: 'custom', timeoutMs: 120_000, followRedirects: false, followRedirectsMode: 'off', sendCookies: false, storeCookies: false };
  request.headers = [{ id: 'ai-content-type', name: 'Content-Type', value: 'application/json', enabled: true }];
  if (settings.provider === 'anthropic') {
    request.url = `${endpoint(settings)}/v1/messages`;
    request.headers.push(
      { id: 'ai-key', name: 'x-api-key', value: settings.apiKey, enabled: Boolean(settings.apiKey) },
      { id: 'ai-version', name: 'anthropic-version', value: '2023-06-01', enabled: true },
    );
    request.body = JSON.stringify({ model: settings.model, max_tokens: 4_096, messages: [{ role: 'user', content: prompt }] });
  } else if (settings.provider === 'gemini') {
    request.url = `${endpoint(settings)}/models/${encodeURIComponent(settings.model)}:generateContent`;
    request.headers.push({ id: 'ai-key', name: 'x-goog-api-key', value: settings.apiKey, enabled: Boolean(settings.apiKey) });
    request.body = JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json' } });
  } else {
    request.url = `${endpoint(settings)}/chat/completions`;
    request.auth = { ...request.auth, type: settings.apiKey ? 'bearer' : 'none', token: settings.apiKey, disabled: !settings.apiKey };
    request.body = JSON.stringify({
      model: settings.model,
      messages: [{ role: 'user', content: prompt }],
      ...(settings.provider === 'openai' ? { response_format: { type: 'json_object' } } : {}),
      temperature: 0.2,
    });
  }
  const response = await sendRequest(request, environment, context);
  if (response.status < 200 || response.status >= 300) throw new Error(`AI provider request failed (${response.status}): ${response.body.slice(0, 2_000)}`);
  if (response.body.length > 10_000_000) throw new Error('AI provider output exceeded the 10 MB safety limit.');
  const payload: unknown = JSON.parse(response.body);
  if (settings.provider === 'anthropic') {
    const content = asRecord(payload)?.content;
    const text = Array.isArray(content) ? content.map((item) => asString(asRecord(item)?.text)).filter(Boolean).join('\n') : '';
    if (text) return text;
  } else if (settings.provider === 'gemini') {
    const candidates = asRecord(payload)?.candidates;
    const content = Array.isArray(candidates) ? asRecord(asRecord(candidates[0])?.content)?.parts : undefined;
    const text = Array.isArray(content) ? content.map((item) => asString(asRecord(item)?.text)).filter(Boolean).join('\n') : '';
    if (text) return text;
  } else {
    const choices = asRecord(payload)?.choices;
    const text = Array.isArray(choices) ? asString(asRecord(asRecord(choices[0])?.message)?.content) : '';
    if (text) return text;
  }
  throw new Error('The AI provider response did not contain text output.');
};

export const parseAiJson = (source: string): unknown => {
  const withoutFence = source.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try { return JSON.parse(withoutFence); }
  catch {
    const objectStart = withoutFence.indexOf('{');
    const arrayStart = withoutFence.indexOf('[');
    const start = objectStart < 0 ? arrayStart : arrayStart < 0 ? objectStart : Math.min(objectStart, arrayStart);
    const end = Math.max(withoutFence.lastIndexOf('}'), withoutFence.lastIndexOf(']'));
    if (start < 0 || end <= start) throw new Error('The AI provider did not return valid JSON.');
    return JSON.parse(withoutFence.slice(start, end + 1));
  }
};

export const suggestCommitGroups = async (
  settings: AiSettings,
  diff: string,
  files: string[],
  environment: Environment | undefined,
  context: SendRequestContext,
): Promise<AiCommitGroup[]> => {
  if (!settings.commitSuggestions) throw new Error('Enable AI commit suggestions first.');
  const boundedDiff = diff.slice(0, 200_000);
  const source = await generateAiText(settings, `You are grouping an existing Git diff into atomic commits. Return only JSON with this shape: {"groups":[{"message":"imperative conventional commit subject","comment":"short rationale","files":["exact/path"]}]}. Use only the provided file paths, include each relevant file at most once, and create at most 8 groups.\n\nFILES:\n${files.join('\n')}\n\nDIFF:\n${boundedDiff}`, environment, context);
  const groups = asRecord(parseAiJson(source))?.groups;
  const allowed = new Set(files);
  if (!Array.isArray(groups)) throw new Error('The AI commit suggestion did not contain groups.');
  return groups.flatMap((item): AiCommitGroup[] => {
    const group = asRecord(item);
    const message = asString(group?.message).trim().slice(0, 200);
    const selected = Array.isArray(group?.files) ? group.files.filter((file): file is string => typeof file === 'string' && allowed.has(file)) : [];
    return group && message && selected.length ? [{ message, comment: asString(group.comment).slice(0, 1_000), files: [...new Set(selected)] }] : [];
  }).slice(0, 8);
};

export const generateMockWithAi = async (
  settings: AiSettings,
  prompt: string,
  port: number,
  environment: Environment | undefined,
  context: SendRequestContext,
): Promise<MockServer> => {
  if (!settings.mockGeneration) throw new Error('Enable AI mock generation first.');
  if (!prompt.trim()) throw new Error('Describe the mock API, paste an OpenAPI document, or include an example response.');
  const source = await generateAiText(settings, `Create a local API mock from the source below. Return only JSON with this shape: {"name":"Mock name","routes":[{"name":"Route","method":"GET","path":"/path","status":200,"headers":{"Content-Type":"application/json"},"body":"string response body","delayMs":0}]}. Use only HTTP methods GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS; paths must start with /; status 100-599; no executable code.\n\nSOURCE:\n${prompt.slice(0, 200_000)}`, environment, context);
  const payload = asRecord(parseAiJson(source));
  const methods = new Set<HttpMethod>(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);
  const routes = !Array.isArray(payload?.routes) ? [] : payload.routes.flatMap((item, routeIndex): MockServer['routes'] => {
    const route = asRecord(item);
    const method = asString(route?.method).toUpperCase() as HttpMethod;
    const path = asString(route?.path);
    if (!route || !methods.has(method) || !path.startsWith('/')) return [];
    const status = Math.min(599, Math.max(100, Number(route.status) || 200));
    const rawHeaders = asRecord(route.headers) ?? {};
    const headers = Object.entries(rawHeaders).filter(([, value]) => typeof value === 'string').slice(0, 100).map(([name, value], index) => ({ id: `ai-header-${routeIndex}-${index}`, name, value: String(value), enabled: true }));
    return [{ id: `ai-route-${crypto.randomUUID()}`, name: asString(route.name) || `${method} ${path}`, enabled: true, method, path, status, headers, body: asString(route.body), delayMs: Math.min(60_000, Math.max(0, Number(route.delayMs) || 0)) }];
  }).slice(0, 500);
  if (!routes.length) throw new Error('The AI provider did not return any valid mock routes.');
  const safePort = Number.isFinite(port) ? Math.min(65_535, Math.max(1_024, Math.round(port))) : 4_020;
  return { id: `ai-mock-${crypto.randomUUID()}`, name: asString(payload?.name) || 'AI generated mock', host: '127.0.0.1', port: safePort, routes, source: { format: 'ai-generated' } };
};
