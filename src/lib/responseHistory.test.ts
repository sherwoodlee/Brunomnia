import { describe, expect, it } from 'vitest';
import type { StoredResponse } from '../types';
import { clearSavedResponseHistory, deleteSavedResponse, retainResponseHistory, visibleResponseHistory } from './responseHistory';

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
});
