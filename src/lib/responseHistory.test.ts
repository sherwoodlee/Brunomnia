import { describe, expect, it } from 'vitest';
import { cloneSeedWorkspace, createBlankRequest } from '../data/seed';
import type { ApiRequest, StoredResponse } from '../types';
import { restoreRequestSnapshot, restoreWorkspaceRequestSnapshot } from './historicalRequest';
import { clearSavedResponseHistory, createRequestSnapshot, deleteSavedResponse, responseHistorySections, retainResponseHistory, visibleResponseHistory } from './responseHistory';

const response = (id: string, requestId: string, environmentId: string, receivedAt: string): StoredResponse => ({
  id,
  requestId,
  requestName: requestId,
  requestUrl: `https://example.test/${requestId}`,
  environmentId,
  receivedAt,
  status: 200,
  statusText: 'OK',
  headers: {},
  body: id,
  durationMs: 1,
  sizeBytes: id.length,
});

describe('response history preferences', () => {
  it('keeps a finite newest-first history per request', () => {
    const older = response('older', 'request-a', 'dev', '2026-07-17T01:00:00.000Z');
    const other = response('other', 'request-b', 'dev', '2026-07-17T02:00:00.000Z');
    const newer = response('newer', 'request-a', 'dev', '2026-07-17T03:00:00.000Z');
    const newest = response('newest', 'request-a', 'dev', '2026-07-17T04:00:00.000Z');

    expect(retainResponseHistory([newer, other, older], newest, 2, false).map(({ id }) => id)).toEqual(['newest', 'newer', 'other']);
  });

  it('applies limits per environment only while filtering is enabled', () => {
    const dev = response('dev-old', 'request-a', 'dev', '2026-07-17T01:00:00.000Z');
    const prod = response('prod', 'request-a', 'prod', '2026-07-17T02:00:00.000Z');
    const newestDev = response('dev-new', 'request-a', 'dev', '2026-07-17T03:00:00.000Z');

    const retained = retainResponseHistory([prod, dev], newestDev, 1, true);
    expect(retained.map(({ id }) => id)).toEqual(['dev-new', 'prod']);
    expect(visibleResponseHistory(retained, 'request-a', 'dev', true).map(({ id }) => id)).toEqual(['dev-new']);
    expect(visibleResponseHistory(retained, 'request-a', 'dev', false).map(({ id }) => id)).toEqual(['dev-new', 'prod']);
  });

  it('supports no saved responses and unlimited history', () => {
    const older = response('older', 'request-a', 'dev', '2026-07-17T01:00:00.000Z');
    const newer = response('newer', 'request-a', 'dev', '2026-07-17T02:00:00.000Z');

    expect(retainResponseHistory([older], newer, 0, false)).toEqual([]);
    expect(retainResponseHistory([older], newer, -1, false).map(({ id }) => id)).toEqual(['newer', 'older']);
  });

  it('deletes only the selected saved response', () => {
    const selected = response('selected', 'request-a', 'dev', '2026-07-17T02:00:00.000Z');
    const kept = response('kept', 'request-a', 'dev', '2026-07-17T01:00:00.000Z');
    const remaining = deleteSavedResponse([selected, kept], selected.id);

    expect(remaining.map(({ id }) => id)).toEqual(['kept']);
    expect(visibleResponseHistory(remaining, 'request-a', 'dev', true)[0]?.id).toBe('kept');
  });

  it('clears only the active request and environment history', () => {
    const dev = response('dev', 'request-a', 'dev', '2026-07-17T03:00:00.000Z');
    const prod = response('prod', 'request-a', 'prod', '2026-07-17T02:00:00.000Z');
    const other = response('other', 'request-b', 'dev', '2026-07-17T01:00:00.000Z');
    const remaining = clearSavedResponseHistory([dev, prod, other], 'request-a', 'dev');

    expect(remaining.map(({ id }) => id)).toEqual(['prod', 'other']);
    expect(visibleResponseHistory(remaining, 'request-a', 'dev', false)[0]?.id).toBe('prod');
    expect(visibleResponseHistory(remaining, 'request-a', 'dev', true)).toEqual([]);
  });

  it('groups saved responses into Insomnia-compatible chronological sections', () => {
    const now = new Date('2026-07-17T12:00:00');
    const grouped = responseHistorySections([
      response('minutes', 'request-a', 'dev', new Date(now.getTime() - 4 * 60_000).toISOString()),
      response('hours', 'request-a', 'dev', new Date(now.getTime() - 90 * 60_000).toISOString()),
      response('today', 'request-a', 'dev', '2026-07-17T01:00:00'),
      response('week', 'request-a', 'dev', '2026-07-14T12:00:00'),
      response('older', 'request-a', 'dev', '2026-07-01T12:00:00'),
    ], now);

    expect(grouped.map(({ label, responses }) => [label, responses.map(({ id }) => id)])).toEqual([
      ['Just Now', ['minutes']],
      ['Less Than Two Hours Ago', ['hours']],
      ['Today', ['today']],
      ['This Week', ['week']],
      ['Older Than This Week', ['older']],
    ]);
  });

  it('captures an independent request version for a saved response', () => {
    const request = createBlankRequest('request-a');
    request.url = 'https://example.test/original';
    const snapshot = createRequestSnapshot(request);
    request.url = 'https://example.test/changed';

    expect(snapshot.url).toBe('https://example.test/original');
  });

  it('restores a matching historical request without moving its current tree position', () => {
    const current = createBlankRequest('request-a');
    current.name = 'Current';
    current.folderId = 'current-folder';
    const historical = createBlankRequest('request-a');
    historical.name = 'Historical';
    historical.url = 'https://example.test/historical';
    historical.folderId = 'old-folder';
    const legacySnapshot = createRequestSnapshot(historical) as unknown as Record<string, unknown>;
    delete legacySnapshot.renderBodyTemplates;
    delete legacySnapshot.disableUserAgentHeader;
    (legacySnapshot.grpc as Record<string, unknown>).disableUserAgentHeader = true;
    const saved = { ...response('saved', 'request-a', 'dev', '2026-07-17T01:00:00.000Z'), requestSnapshot: legacySnapshot as unknown as ApiRequest };

    const restored = restoreRequestSnapshot(saved, current);
    expect(restored).toMatchObject({ id: 'request-a', name: 'Historical', url: 'https://example.test/historical', folderId: 'current-folder', renderBodyTemplates: true, disableUserAgentHeader: true });
    expect(restored.grpc).not.toHaveProperty('disableUserAgentHeader');
  });

  it('ignores missing, mismatched, and malformed request versions', () => {
    const current = createBlankRequest('request-a');
    const missing = response('missing', 'request-a', 'dev', '2026-07-17T01:00:00.000Z');
    const mismatched = { ...missing, requestSnapshot: createBlankRequest('request-b') };
    const malformed = { ...missing, requestSnapshot: { id: 'request-a', name: 'Malformed' } } as StoredResponse;

    expect(restoreRequestSnapshot(missing, current)).toBe(current);
    expect(restoreRequestSnapshot(mismatched, current)).toBe(current);
    expect(restoreRequestSnapshot(malformed, current)).toBe(current);
  });

  it('aborts a late restore after the active request changes', () => {
    const workspace = cloneSeedWorkspace();
    const original = workspace.collections[0].requests[0];
    const saved = { ...response('saved', original.id, 'dev', '2026-07-17T01:00:00.000Z'), requestSnapshot: createRequestSnapshot(original) };
    workspace.activeRequestId = workspace.collections[0].requests[1].id;

    expect(restoreWorkspaceRequestSnapshot(saved, workspace)).toBe(workspace);
  });
});
