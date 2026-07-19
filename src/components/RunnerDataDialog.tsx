import { useEffect, useState } from 'react';
import { RUNNER_DATA_ENCODINGS, RUNNER_DATA_FILE_BYTES, decodeRunnerDataBytes, detectRunnerDataEncoding, parseRunnerDataFile, type RunnerDataFilePreview } from '../lib/runner';
import { Icon } from './Icon';

type RunnerDataDialogProps = {
  data: string;
  fileName: string;
  fileEncoding: string;
  onApply: (data: string, fileName: string, fileEncoding: string, rowCount: number) => void;
  onClear: () => void;
  onClose: () => void;
};

const previewExisting = (data: string, fileName: string) => {
  if (!data || !fileName) return undefined;
  try { return parseRunnerDataFile(data, fileName); } catch { return undefined; }
};

export function RunnerDataDialog({ data, fileName: initialFileName, fileEncoding: initialFileEncoding, onApply, onClear, onClose }: RunnerDataDialogProps) {
  const [contents, setContents] = useState(data);
  const [fileName, setFileName] = useState(initialFileName);
  const [fileEncoding, setFileEncoding] = useState(initialFileEncoding || 'utf-8');
  const [fileBytes, setFileBytes] = useState<Uint8Array>();
  const [preview, setPreview] = useState<RunnerDataFilePreview | undefined>(() => previewExisting(data, initialFileName));
  const [error, setError] = useState('');

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  const selectFile = async (file: File | undefined) => {
    if (!file) return;
    setError('');
    setPreview(undefined);
    if (file.size > RUNNER_DATA_FILE_BYTES) {
      setError('Runner data files cannot exceed 5 MB.');
      return;
    }
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const encoding = detectRunnerDataEncoding(bytes);
      setFileBytes(bytes);
      setFileName(file.name);
      setFileEncoding(encoding);
      const nextContents = decodeRunnerDataBytes(bytes, encoding);
      const nextPreview = parseRunnerDataFile(nextContents, file.name);
      setContents(nextContents);
      setPreview(nextPreview);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  };

  const changeEncoding = (encoding: string) => {
    setFileEncoding(encoding);
    setError('');
    if (!fileBytes) return;
    try {
      const nextContents = decodeRunnerDataBytes(fileBytes, encoding);
      setContents(nextContents);
      setPreview(parseRunnerDataFile(nextContents, fileName));
    } catch (caught) {
      setPreview(undefined);
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  };

  return (
    <div className="runner-data-overlay" onMouseDown={onClose} role="presentation">
      <section aria-labelledby="runner-data-title" aria-modal="true" className="runner-data-dialog" onMouseDown={(event) => event.stopPropagation()} role="dialog">
        <header><div><small>Collection Runner</small><h2 id="runner-data-title">{data ? 'Update data' : 'Preview data'}</h2></div><button aria-label="Close Runner data" onClick={onClose} type="button">×</button></header>
        <label className="runner-data-picker"><Icon name="import" size={16} /><span>{preview ? 'Change data file' : 'Select data file'}</span><input accept=".json,.csv,application/json,text/csv" aria-label="Choose Runner data file" type="file" onChange={(event) => { void selectFile(event.target.files?.[0]); event.target.value = ''; }} /></label>
        {fileName ? <div className="runner-data-source"><p><strong>{fileName}</strong><span>{preview?.rows.length ?? 0} iterations · {preview?.headers.length ?? 0} variables</span></p><label>Encoding<select aria-label="Runner data encoding" disabled={!fileBytes} value={fileEncoding} onChange={(event) => changeEncoding(event.target.value)}>{RUNNER_DATA_ENCODINGS.map((encoding) => <option key={encoding.key} value={encoding.key}>{encoding.label}</option>)}</select></label></div> : null}
        {error ? <div className="automation-message error" role="alert">{error}</div> : null}
        {preview ? <div className="runner-data-preview"><table><thead><tr><th>Iteration</th>{preview.headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{preview.rows.slice(0, 100).map((row, index) => <tr key={`${index}-${preview.headers.map((header) => row[header]).join('-')}`}><td>{index + 1}</td>{preview.headers.map((header) => <td key={header}>{row[header] ?? ''}</td>)}</tr>)}</tbody></table>{preview.rows.length > 100 ? <p>Showing the first 100 of {preview.rows.length} iterations.</p> : null}</div> : <div className="empty-state compact"><Icon name="history" size={28} /><strong>No data selected</strong><span>Choose a JSON array or CSV file with a header row.</span></div>}
        <footer>{data ? <button className="secondary-action" onClick={() => { onClear(); onClose(); }} type="button">Remove data</button> : <span />}{preview ? <button className="primary-action" onClick={() => { onApply(contents, fileName, fileEncoding, preview.rows.length); onClose(); }} type="button">Use data</button> : <button className="primary-action" disabled type="button">Use data</button>}</footer>
      </section>
    </div>
  );
}
