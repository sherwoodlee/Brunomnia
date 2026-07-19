import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { RunnerItemResult, RunnerLiveItem } from '../types';
import { RunnerAttemptCard } from './RunnerAttemptCard';

const item: RunnerLiveItem = { key: 'item', iteration: 2, requestId: 'request', requestName: 'Create order', requestUrl: 'https://example.test/orders', status: 'completed', attempt: 1, statusCode: 201, statusMessage: 'Created', responseTime: 12, responseSize: 42 };
const result: RunnerItemResult = {
  id: 'result',
  key: 'item',
  requestId: 'request',
  requestName: 'Create order',
  iteration: 2,
  attempt: 1,
  status: 201,
  durationMs: 12,
  passed: true,
  tests: [{ name: 'created', passed: true, status: 'passed' }],
  request: { protocol: 'http', method: 'POST', url: item.requestUrl, urlTruncated: false, headers: [{ name: 'content-type', value: 'application/json', redacted: false }], headersTruncated: false, bodyMode: 'json', bodySummary: 'JSON document', bodySizeBytes: 18, bodySizeEstimated: false, storedBytes: 96 },
  response: { statusText: 'Created', statusTextTruncated: false, headers: { 'content-type': 'application/json' }, headersTruncated: false, bodyPreview: '{"created":true}', bodyTruncated: false, sizeBytes: 42, storedBytes: 82 },
};

describe('Runner attempt card', () => {
  it('starts completed saved evidence expanded', () => {
    const markup = renderToStaticMarkup(<RunnerAttemptCard defaultExpanded item={item} nameFilter="" result={result} statusFilter="all" />);

    expect(markup).toContain('201 Created');
    expect(markup).toContain('Iteration 2');
    expect(markup).toContain('12ms - 42 bytes');
    expect(markup).toContain('Attempt evidence');
    expect(markup).toContain('created');
    expect(markup).toContain('POST · http');
    expect(markup).toContain('{&quot;created&quot;:true}');
    expect(markup).toContain('Collapse Create order attempt evidence');
    expect(markup).toContain('aria-expanded="true"');
  });

  it('starts live evidence collapsed and preserves its summary', () => {
    const markup = renderToStaticMarkup(<RunnerAttemptCard defaultExpanded={false} item={item} nameFilter="" result={result} statusFilter="all" />);

    expect(markup).toContain('1/1 tests passed');
    expect(markup).toContain('Expand Create order attempt evidence');
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).not.toContain('Attempt evidence</small>');
  });

  it('shows live skip controls without expandable result evidence', () => {
    const live = { ...item, status: 'running' as const, statusCode: undefined, statusMessage: undefined };
    const markup = renderToStaticMarkup(<RunnerAttemptCard defaultExpanded={false} item={live} nameFilter="" onSkip={vi.fn()} statusFilter="all" />);

    expect(markup).toContain('RUNNING');
    expect(markup).toContain('>Skip</button>');
    expect(markup).not.toContain('attempt evidence');
  });
});
