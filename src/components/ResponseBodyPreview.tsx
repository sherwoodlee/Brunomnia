import { useEffect, useMemo, useState } from 'react';
import { applyResponseBodyFilter, responseFilterLanguage } from '../lib/responseFilter';
import { parseCsvPreview } from '../lib/csvPreview';
import { prettyBody } from '../lib/request';
import { responseSizeBand } from '../lib/responseSize';
import type { HttpResponse, ResponsePreviewMode } from '../types';

type ResponseBodyPreviewProps = {
  response: HttpResponse;
  filter: string;
  filterHistory: string[];
  onApplyFilter: (filter: string, remember: boolean) => void;
  onDownload: () => void;
  onModeChange: (mode: ResponsePreviewMode) => void;
  previewMode: ResponsePreviewMode;
  responseKey: string;
};

let alwaysShowLargeResponses = false;

function CsvResponsePreview({ body }: { body: string }) {
  const preview = useMemo(() => parseCsvPreview(body), [body]);
  if (preview.error) return <div className="response-csv-message bad">{preview.error}</div>;
  return <div className="response-csv-preview">
    <table><tbody>{preview.rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={`${rowIndex}-${cellIndex}`}>{cell}</td>)}</tr>)}</tbody></table>
    {preview.truncated ? <div className="response-csv-message">Preview truncated at the local row, column, or cell safety limit.</div> : null}
    {!preview.rows.length ? <div className="response-csv-message">No CSV rows to display.</div> : null}
  </div>;
}

function FilteredResponseBody({ response, filter, filterHistory, onApplyFilter, previewMode }: Pick<ResponseBodyPreviewProps, 'response' | 'filter' | 'filterHistory' | 'onApplyFilter' | 'previewMode'>) {
  const language = responseFilterLanguage(response);
  const result = useMemo(() => previewMode === 'raw'
    ? { contents: response.body, error: '', matchCount: null }
    : applyResponseBodyFilter(response, filter), [filter, previewMode, response]);
  const lines = (previewMode === 'raw' ? result.contents : prettyBody(result.contents)).split('\n');
  const [draft, setDraft] = useState(filter);
  useEffect(() => setDraft(filter), [filter]);
  const contentType = Object.entries(response.headers).find(([name]) => name.toLowerCase() === 'content-type')?.[1].toLowerCase() ?? '';

  if (previewMode === 'friendly' && contentType.includes('html')) {
    const policy = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:">`;
    return <iframe className="response-html-preview" sandbox="" srcDoc={`${policy}${response.body}`} title="Response visual preview" />;
  }
  if (previewMode === 'friendly' && contentType.includes('csv')) return <CsvResponsePreview body={response.body} />;

  return <>
    <div className={`code-viewer${previewMode === 'raw' ? ' raw-response' : ''}`}>
      {lines.map((line, index) => <div className="code-line" key={`${index}-${line}`}><span>{index + 1}</span><code>{line || ' '}</code></div>)}
    </div>
    {previewMode !== 'raw' && language ? <div className="response-filter-bar">
      <span>{language === 'json' ? 'JSONPath' : 'XPath'}</span>
      <input aria-label="Filter response body" onChange={(event) => { const value = event.target.value; setDraft(value); if (!value) onApplyFilter('', false); }} onKeyDown={(event) => { if (event.key === 'Enter') onApplyFilter(draft, true); }} placeholder={language === 'json' ? '$.store.books[*].author' : '/store/books/author'} value={draft} />
      {filterHistory.length ? <select aria-label="Response filter history" onChange={(event) => { const value = event.target.value; if (!value) return; setDraft(value); onApplyFilter(value, false); }} value=""><option value="">Recent filters</option>{filterHistory.map((candidate) => <option key={candidate} value={candidate}>{candidate}</option>)}</select> : null}
      {filter ? <button aria-label="Clear response filter" onClick={() => { setDraft(''); onApplyFilter('', false); }} type="button">Clear</button> : null}
      {result.error ? <small className="bad" title={result.error}>{result.error}</small> : result.matchCount !== null ? <small>{result.matchCount} {result.matchCount === 1 ? 'match' : 'matches'}</small> : null}
    </div> : null}
  </>;
}

export default function ResponseBodyPreview({ response, filter, filterHistory, onApplyFilter, onDownload, onModeChange, previewMode, responseKey }: ResponseBodyPreviewProps) {
  const band = responseSizeBand(response.sizeBytes);
  const [revealedKey, setRevealedKey] = useState('');
  const blocked = band === 'huge' || (band === 'large' && !alwaysShowLargeResponses && revealedKey !== responseKey);

  return <div className="response-preview-shell">
    <div className="response-preview-toolbar"><span>Preview mode</span><select aria-label="Response preview mode" onChange={(event) => onModeChange(event.target.value as ResponsePreviewMode)} value={previewMode}><option value="friendly">Visual Preview</option><option value="source">Source Code</option><option value="raw">Raw Data</option></select></div>
    {blocked ? <div className="response-size-warning">
      <strong>{band === 'huge' ? 'Response over 100 MB cannot be shown' : 'Response over 5 MB hidden for performance'}</strong>
      <span>{band === 'huge' ? 'Download the stored UTF-8 body to inspect it outside Brunomnia.' : 'Show this response once, always show large responses for this app session, or download the stored body.'}</span>
      <div><button onClick={onDownload} type="button">Save response to file</button>{band === 'large' ? <><button onClick={() => setRevealedKey(responseKey)} type="button">Show anyway</button><button onClick={() => { alwaysShowLargeResponses = true; setRevealedKey(responseKey); }} type="button">Always show this session</button></> : null}</div>
    </div> : <FilteredResponseBody filter={filter} filterHistory={filterHistory} onApplyFilter={onApplyFilter} previewMode={previewMode} response={response} />}
  </div>;
}
