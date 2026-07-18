import { useEffect, useMemo, useState } from 'react';
import { applyResponseBodyFilter, responseFilterLanguage } from '../lib/responseFilter';
import { prettyBody } from '../lib/request';
import { responseSizeBand } from '../lib/responseSize';
import type { HttpResponse } from '../types';

type ResponseBodyPreviewProps = {
  response: HttpResponse;
  filter: string;
  filterHistory: string[];
  onApplyFilter: (filter: string, remember: boolean) => void;
  onDownload: () => void;
  responseKey: string;
};

let alwaysShowLargeResponses = false;

function FilteredResponseBody({ response, filter, filterHistory, onApplyFilter }: Omit<ResponseBodyPreviewProps, 'onDownload' | 'responseKey'>) {
  const language = responseFilterLanguage(response);
  const result = useMemo(() => applyResponseBodyFilter(response, filter), [filter, response]);
  const lines = prettyBody(result.contents).split('\n');
  const [draft, setDraft] = useState(filter);
  useEffect(() => setDraft(filter), [filter]);

  return <>
    <div className="code-viewer">
      {lines.map((line, index) => <div className="code-line" key={`${index}-${line}`}><span>{index + 1}</span><code>{line || ' '}</code></div>)}
    </div>
    {language ? <div className="response-filter-bar">
      <span>{language === 'json' ? 'JSONPath' : 'XPath'}</span>
      <input aria-label="Filter response body" onChange={(event) => { const value = event.target.value; setDraft(value); if (!value) onApplyFilter('', false); }} onKeyDown={(event) => { if (event.key === 'Enter') onApplyFilter(draft, true); }} placeholder={language === 'json' ? '$.store.books[*].author' : '/store/books/author'} value={draft} />
      {filterHistory.length ? <select aria-label="Response filter history" onChange={(event) => { const value = event.target.value; if (!value) return; setDraft(value); onApplyFilter(value, false); }} value=""><option value="">Recent filters</option>{filterHistory.map((candidate) => <option key={candidate} value={candidate}>{candidate}</option>)}</select> : null}
      {filter ? <button aria-label="Clear response filter" onClick={() => { setDraft(''); onApplyFilter('', false); }} type="button">Clear</button> : null}
      {result.error ? <small className="bad" title={result.error}>{result.error}</small> : result.matchCount !== null ? <small>{result.matchCount} {result.matchCount === 1 ? 'match' : 'matches'}</small> : null}
    </div> : null}
  </>;
}

export default function ResponseBodyPreview({ response, filter, filterHistory, onApplyFilter, onDownload, responseKey }: ResponseBodyPreviewProps) {
  const band = responseSizeBand(response.sizeBytes);
  const [revealedKey, setRevealedKey] = useState('');
  const blocked = band === 'huge' || (band === 'large' && !alwaysShowLargeResponses && revealedKey !== responseKey);

  if (blocked) return <div className="response-size-warning">
    <strong>{band === 'huge' ? 'Response over 100 MB cannot be shown' : 'Response over 5 MB hidden for performance'}</strong>
    <span>{band === 'huge' ? 'Download the stored UTF-8 body to inspect it outside Brunomnia.' : 'Show this response once, always show large responses for this app session, or download the stored body.'}</span>
    <div><button onClick={onDownload} type="button">Save response to file</button>{band === 'large' ? <><button onClick={() => setRevealedKey(responseKey)} type="button">Show anyway</button><button onClick={() => { alwaysShowLargeResponses = true; setRevealedKey(responseKey); }} type="button">Always show this session</button></> : null}</div>
  </div>;

  return <FilteredResponseBody filter={filter} filterHistory={filterHistory} onApplyFilter={onApplyFilter} response={response} />;
}
