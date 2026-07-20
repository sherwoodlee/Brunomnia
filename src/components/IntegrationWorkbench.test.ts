import { describe, expect, it } from 'vitest';
import type { McpReviewedServerRequest } from '../lib/mcp';
import { konnectCatalogSummaryLines } from '../lib/konnectCatalog';
import { integrationSecretInputType, mcpOperationDraftKey, withMcpParameterDraft, withMcpServerRequest, withoutMcpServerRequest } from './IntegrationWorkbench';

describe('integration credential visibility', () => {
  it('masks credentials by default', () => {
    expect(integrationSecretInputType(false, false)).toBe('password');
  });

  it('reveals every credential through the device preference', () => {
    expect(integrationSecretInputType(true, false)).toBe('text');
  });

  it('allows one credential to be revealed without changing the preference', () => {
    expect(integrationSecretInputType(false, true)).toBe('text');
  });

  it('isolates MCP parameter drafts by client, primitive family, and name', () => {
    expect(mcpOperationDraftKey('client-a', 'tool', 'search')).not.toBe(mcpOperationDraftKey('client-b', 'tool', 'search'));
    expect(mcpOperationDraftKey('client-a', 'tool', 'search')).not.toBe(mcpOperationDraftKey('client-a', 'prompt', 'search'));
    let drafts: Record<string, string> = {};
    for (let index = 0; index < 1002; index += 1) drafts = withMcpParameterDraft(drafts, `draft-${index}`, String(index));
    expect(Object.keys(drafts)).toHaveLength(1000);
    expect(drafts['draft-0']).toBeUndefined();
    expect(drafts['draft-1001']).toBe('1001');
  });

  it('deduplicates, bounds, and cancels reviewed MCP server requests', () => {
    let requests: McpReviewedServerRequest[] = Array.from({ length: 100 }, (_, index) => ({
      clientId: 'client-a',
      id: index,
      method: 'sampling/createMessage' as const,
      params: {},
      receivedAt: `2026-01-01T00:00:${String(index).padStart(2, '0')}Z`,
    }));
    requests = withMcpServerRequest(requests, { ...requests[50], params: { replacement: true } });
    expect(requests).toHaveLength(100);
    expect(requests.at(-1)).toEqual(expect.objectContaining({ id: 50, params: { replacement: true } }));
    requests = withMcpServerRequest(requests, { clientId: 'client-a', id: 100, method: 'elicitation/create', params: {}, receivedAt: '2026-01-01T00:02:00Z' });
    expect(requests).toHaveLength(100);
    expect(requests.some((request) => request.id === 0)).toBe(false);
    expect(withoutMcpServerRequest(requests, 'client-a', 50).some((request) => request.id === 50)).toBe(false);
  });

  it('formats all-region Konnect reconciliation counts', () => {
    const counts = (total: number, created: number, updated: number, deleted: number, skipped = 0) => ({ total, created, updated, deleted, skipped });
    expect(konnectCatalogSummaryLines({
      controlPlanes: counts(3, 1, 1, 1),
      services: counts(8, 2, 3, 1),
      routes: counts(21, 5, 4, 2, 3),
      skippedRegions: ['eu: unavailable'],
    })).toEqual([
      'Control planes  total 3 · created 1 · updated 1 · deleted 1',
      'Services        total 8 · created 2 · updated 3 · deleted 1',
      'Routes          total 21 · created 5 · updated 4 · deleted 2 · skipped 3',
      'Skipped regions 1',
    ]);
  });
});
