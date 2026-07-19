import { useState } from 'react';
import type { RunnerItemResult, RunnerLiveItem } from '../types';
import { scriptTestPassed, type ScriptTestFilter } from '../lib/scriptTests';
import { Icon } from './Icon';
import { RunnerAssertionEvidence } from './RunnerAssertionEvidence';

type RunnerAttemptCardProps = {
  item: RunnerLiveItem;
  result?: RunnerItemResult;
  defaultExpanded: boolean;
  statusFilter: ScriptTestFilter;
  nameFilter: string;
  onSkip?: () => void;
};

const responseStats = (item: RunnerLiveItem) => [
  item.responseTime === undefined ? '' : `${Math.round(item.responseTime)} ms`,
  item.responseSize === undefined ? '' : item.responseSize < 1024 ? `${item.responseSize} B` : `${(item.responseSize / 1024).toFixed(item.responseSize < 10_240 ? 1 : 0)} KiB`,
].filter(Boolean).join(' · ');

export function RunnerAttemptCard({ item, result, defaultExpanded, statusFilter, nameFilter, onSkip }: RunnerAttemptCardProps) {
  const canExpand = Boolean(result) && (item.status === 'completed' || item.status === 'failed');
  const [isExpanded, setIsExpanded] = useState(defaultExpanded && canExpand);
  const tests = result?.tests ?? item.tests ?? [];
  const passedTests = tests.filter(scriptTestPassed).length;
  const statusLabel = item.statusCode && item.statusCode > 0 ? `${item.statusCode}${item.statusMessage ? ` ${item.statusMessage}` : ''}` : item.status.toUpperCase();
  const statusTone = item.statusCode && item.statusCode > 0 ? item.statusCode < 300 ? 'http-success' : item.statusCode < 400 ? 'http-warning' : 'http-error' : item.status;
  const stats = responseStats(item);
  const showSkip = Boolean(onSkip) && (item.status === 'pending' || item.status === 'running');
  const showError = (item.status === 'failed' || item.status === 'canceled') && Boolean(item.errorMessage);

  return (
    <article className={`runner-attempt-card${isExpanded ? ' expanded' : ''}`}>
      <header>
        <span className={`runner-status status-${statusTone}`}>{statusLabel}</span>
        <div className="runner-attempt-identity"><strong>{item.requestName}</strong><small title={item.requestUrl}>{item.requestUrl || 'Prepared request'}</small>{!isExpanded && tests.length ? <small>{passedTests}/{tests.length} tests passed</small> : null}{isExpanded && stats ? <small>{stats}</small> : null}{showError ? <small className="error">{item.errorMessage}</small> : null}</div>
        <div className="runner-attempt-meta"><span>Iteration {item.iteration}</span><span>Attempt {item.attempt ?? '—'}</span></div>
        <div className="runner-attempt-actions">{showSkip ? <button className="runner-skip" onClick={onSkip} type="button">Skip</button> : null}{canExpand ? <button aria-expanded={isExpanded} aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${item.requestName} attempt evidence`} onClick={() => setIsExpanded((current) => !current)} type="button"><Icon name={isExpanded ? 'chevron-down' : 'chevron-right'} size={13} /></button> : null}</div>
      </header>
      {isExpanded && result ? <section className="runner-response-detail"><header><div><small>Attempt evidence</small><strong>{result.requestName} · iteration {result.iteration}, attempt {result.attempt}</strong></div></header><RunnerAssertionEvidence nameFilter={nameFilter} statusFilter={statusFilter} tests={result.tests} />{result.request ? <div className="runner-request-content"><div><small>Request</small><strong>{result.request.method} · {result.request.protocol}</strong><code title={result.request.url}>{result.request.url}{result.request.urlTruncated ? '…' : ''}</code></div><details><summary>{result.request.headers.length} configured headers{result.request.headersTruncated ? ' · truncated' : ''}</summary><pre>{result.request.headers.map((header) => `${header.name}: ${header.value}`).join('\n') || '(no configured headers)'}</pre></details><div><small>{result.request.bodyMode} body</small><strong>{result.request.bodySummary}</strong><span>{result.request.bodySizeEstimated ? 'Approximately ' : ''}{result.request.bodySizeBytes.toLocaleString()} payload bytes · {result.request.storedBytes.toLocaleString()} snapshot bytes</span></div></div> : null}{result.response ? <div className="runner-response-content"><div className="runner-response-meta"><span><strong>{result.status}</strong> {result.response.statusText}{result.response.statusTextTruncated ? '…' : ''}</span><span>{result.response.sizeBytes.toLocaleString()} response bytes</span><span>{result.durationMs} ms</span></div><details><summary>{Object.keys(result.response.headers).length} response headers{result.response.headersTruncated ? ' · truncated' : ''}</summary><pre>{Object.entries(result.response.headers).map(([name, value]) => `${name}: ${value}`).join('\n') || '(no response headers)'}</pre></details><div className="runner-body-preview"><small>Response body preview · {result.response.storedBytes.toLocaleString()} snapshot bytes{result.response.bodyTruncated ? ' · truncated' : ''}</small><pre>{result.response.bodyPreview || '(empty response body)'}</pre></div></div> : <p>{result.error || 'No response was returned for this attempt.'}</p>}</section> : null}
    </article>
  );
}
