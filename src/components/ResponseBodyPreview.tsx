import { useEffect, useMemo, useState } from 'react';
import { applyResponseBodyFilter, responseFilterLanguage } from '../lib/responseFilter';
import { prettyBody } from '../lib/request';
import type { HttpResponse } from '../types';

type ResponseBodyPreviewProps = {
  response: HttpResponse;
  filter: string;
  filterHistory: string[];
  onApplyFilter: (filter: string, remember: boolean) => void;
};

export default function ResponseBodyPreview({ response, filter, filterHistory, onApplyFilter }: ResponseBodyPreviewProps) {
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
