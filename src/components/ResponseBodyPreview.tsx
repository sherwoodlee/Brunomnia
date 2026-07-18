import { useEffect, useMemo, useState } from 'react';
import { applyResponseBodyFilter, responseFilterLanguage } from '../lib/responseFilter';
import { parseCsvPreview } from '../lib/csvPreview';
import { createMultipartPartArtifact, parseMultipartPreview, type MultipartPreviewPart } from '../lib/multipartPreview';
import { prettyBody } from '../lib/request';
import { responseBodyBytes } from '../lib/responseBytes';
import { createResponseMediaArtifact, responseMedia, type ResponseMedia } from '../lib/responseMedia';
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

function ResponseMediaPreview({ media, response }: { media: ResponseMedia; response: HttpResponse }) {
  const artifact = useMemo(() => createResponseMediaArtifact(response, media), [media.mimeType, response.body, response.bodyBase64]);
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    setUrl('');
    setError('');
    if (!artifact.bytes.byteLength) return;
    try {
      const objectUrl = URL.createObjectURL(artifact.blob);
      setUrl(objectUrl);
      return () => URL.revokeObjectURL(objectUrl);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }, [artifact]);

  if (!artifact.bytes.byteLength) return <div className="response-media-message">No body returned for this {media.kind} response.</div>;
  if (error) return <div className="response-media-message bad">Unable to display the local {media.kind} preview: {error}</div>;
  if (!url) return <div className="response-media-message">Preparing local {media.kind} preview…</div>;
  const decodeError = () => setError(`The desktop WebView could not decode the ${media.mimeType} body.`);
  if (media.kind === 'image') return <div className="response-media-preview image"><img alt="Response body preview" onError={decodeError} src={url} /></div>;
  if (media.kind === 'audio') return <div className="response-media-preview audio"><audio aria-label="Response audio preview" controls onError={decodeError} src={url} /></div>;
  return <iframe className="response-media-preview pdf" onError={decodeError} src={url} title="PDF response preview" />;
}

const downloadMultipartPart = (part: MultipartPreviewPart) => {
  const artifact = createMultipartPartArtifact(part);
  const url = URL.createObjectURL(new Blob([new Uint8Array(artifact.contents).buffer], { type: artifact.mimeType }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = artifact.fileName;
  anchor.click();
  URL.revokeObjectURL(url);
};

function MultipartResponsePreview({ contentType, response }: { contentType: string; response: HttpResponse }) {
  const bytes = useMemo(() => responseBodyBytes(response), [response.body, response.bodyBase64]);
  const preview = useMemo(() => parseMultipartPreview(bytes, contentType), [bytes, contentType]);
  const [selectedId, setSelectedId] = useState(0);
  const [showHeaders, setShowHeaders] = useState(false);
  const selected = preview.parts.find((part) => part.id === selectedId) ?? preview.parts[0];
  if (preview.error) return <div className="response-multipart-message bad">Failed to parse multipart response: {preview.error}</div>;
  if (!selected) return <div className="response-multipart-message">No multipart sections to display.</div>;
  const truncatedBody = selected.body.length > 1_000_000;
  const partBody = selected.body.slice(0, 1_000_000);
  const displayBody = selected.contentType.includes('json') ? prettyBody(partBody) : partBody;
  return <div className="response-multipart-preview">
    <div className="response-multipart-toolbar"><select aria-label="Multipart response part" onChange={(event) => { setSelectedId(Number(event.target.value)); setShowHeaders(false); }} value={selected.id}>{preview.parts.map((part) => <option key={part.id} value={part.id}>{part.title} · {part.sizeBytes} B</option>)}</select><button onClick={() => setShowHeaders((value) => !value)} type="button">{showHeaders ? 'Hide' : 'View'} headers</button><button onClick={() => downloadMultipartPart(selected)} type="button">Save part</button></div>
    {preview.truncated ? <div className="response-multipart-message">Part list truncated at 100 sections.</div> : null}
    {showHeaders ? <div className="response-multipart-headers">{selected.headers.map((header, index) => <div key={`${header.name}-${index}`}><strong>{header.name}</strong><span>{header.value}</span></div>)}</div> : null}
    <div className="code-viewer response-part-body">{displayBody.split('\n').map((line, index) => <div className="code-line" key={`${index}-${line}`}><span>{index + 1}</span><code>{line || ' '}</code></div>)}</div>
    {truncatedBody ? <div className="response-multipart-message">Part preview truncated at 1,000,000 decoded characters; Save part retains the complete original bytes.</div> : null}
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
  const media = responseMedia(contentType);

  if (previewMode === 'friendly' && media) return <ResponseMediaPreview media={media} response={response} />;
  if (previewMode === 'friendly' && contentType.includes('html')) {
    const policy = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:">`;
    return <iframe className="response-html-preview" sandbox="" srcDoc={`${policy}${response.body}`} title="Response visual preview" />;
  }
  if (previewMode === 'friendly' && contentType.includes('multipart/')) return <MultipartResponsePreview contentType={contentType} response={response} />;
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
      <span>{band === 'huge' ? 'Download the stored response bytes to inspect them outside Brunomnia.' : 'Show this response once, always show large responses for this app session, or download the stored body.'}</span>
      <div><button onClick={onDownload} type="button">Save response to file</button>{band === 'large' ? <><button onClick={() => setRevealedKey(responseKey)} type="button">Show anyway</button><button onClick={() => { alwaysShowLargeResponses = true; setRevealedKey(responseKey); }} type="button">Always show this session</button></> : null}</div>
    </div> : <FilteredResponseBody filter={filter} filterHistory={filterHistory} key={responseKey} onApplyFilter={onApplyFilter} previewMode={previewMode} response={response} />}
  </div>;
}
