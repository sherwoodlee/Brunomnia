import { describe, expect, it } from 'vitest';
import { cloneSeedWorkspace } from '../data/seed';
import type { StoredResponse } from '../types';
import { buildMockAiContext, composeMockAiInput, findLatestResponseForActiveRequest, MAX_MOCK_AI_INPUT_CHARS } from './mockAiContext';

describe('AI mock context', () => {
  it('builds active-request context without configured credentials or binary bytes', () => {
    const workspace = cloneSeedWorkspace();
    const request = workspace.collections[0].requests[0];
    workspace.activeRequestId = request.id;
    request.url = 'https://person:password@example.com/orders?api_key=topsecret&limit=10';
    request.headers = [
      { id: 'auth', name: 'Authorization', value: 'Bearer header-secret', enabled: true },
      { id: 'accept', name: 'Accept', value: 'application/json', enabled: true },
    ];
    request.bodyMode = 'json';
    request.body = '{"customer":"Ada","clientSecret":"body-secret"}';
    request.auth = { ...request.auth, type: 'bearer', disabled: false, token: 'auth-secret' };

    const context = buildMockAiContext(workspace, 'active-request');

    expect(context.text).toContain('application/json');
    expect(context.text).toContain('Ada');
    expect(context.text).toContain('limit=10');
    expect(context.text).toContain('bearer');
    expect(context.text).not.toContain('person:password');
    expect(context.text).not.toContain('topsecret');
    expect(context.text).not.toContain('header-secret');
    expect(context.text).not.toContain('body-secret');
    expect(context.text).not.toContain('auth-secret');
  });

  it('selects the newest active-environment response and redacts response credentials', () => {
    const workspace = cloneSeedWorkspace();
    const request = workspace.collections[0].requests[0];
    workspace.activeRequestId = request.id;
    workspace.preferences.filterResponsesByEnv = true;
    const response = (id: string, environmentId: string, receivedAt: string, status: number): StoredResponse => ({
      id, requestId: request.id, requestName: request.name, requestUrl: request.url, environmentId, receivedAt,
      status, statusText: 'OK', headers: { 'Content-Type': 'application/json', 'Set-Cookie': 'session=response-secret' },
      body: '{"result":"kept","accessToken":"body-secret"}', durationMs: 10, sizeBytes: 50,
    });
    workspace.responses = [
      response('old', workspace.activeEnvironmentId, '2026-01-01T00:00:00.000Z', 201),
      response('other-env', 'another-env', '2026-03-01T00:00:00.000Z', 203),
      response('new', workspace.activeEnvironmentId, '2026-02-01T00:00:00.000Z', 202),
    ];

    expect(findLatestResponseForActiveRequest(workspace)?.id).toBe('new');
    const context = buildMockAiContext(workspace, 'latest-response');
    expect(context.label).toContain('202');
    expect(context.text).toContain('kept');
    expect(context.text).not.toContain('response-secret');
    expect(context.text).not.toContain('body-secret');
    expect(context.text).not.toContain('203');
  });

  it('allows selected context without extra instructions and bounds combined input', () => {
    const workspace = cloneSeedWorkspace();
    workspace.activeRequestId = workspace.collections[0].requests[0].id;
    const context = buildMockAiContext(workspace, 'active-request');
    expect(composeMockAiInput('', context)).toContain('credential-redacted active request');
    expect(composeMockAiInput('x'.repeat(MAX_MOCK_AI_INPUT_CHARS), context).length).toBeLessThanOrEqual(MAX_MOCK_AI_INPUT_CHARS);
  });

  it('requires a valid manual or workspace source', () => {
    const workspace = cloneSeedWorkspace();
    workspace.activeRequestId = 'missing';
    expect(() => composeMockAiInput('')).toThrow('Describe the mock API');
    expect(() => buildMockAiContext(workspace, 'active-request')).toThrow('Select an active request');
  });
});
