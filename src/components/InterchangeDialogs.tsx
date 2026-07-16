import { useMemo, useState } from 'react';
import type { Workspace } from '../types';
import { exportArtifact } from '../lib/interchange/exporters';
import { importArtifact, importSummary, type ArtifactImport, type ExportFormat, type ExportScope } from '../lib/interchange';
import { Icon } from './Icon';

type ImportDialogProps = {
  onApply: (result: ArtifactImport) => void;
  onClose: () => void;
  onFetchUrl: (url: string) => Promise<string>;
};

export function ImportDialog({ onApply, onClose, onFetchUrl }: ImportDialogProps) {
  const [mode, setMode] = useState<'file' | 'clipboard' | 'url'>('file');
  const [contents, setContents] = useState('');
  const [sourceName, setSourceName] = useState('Imported artifact');
  const [url, setUrl] = useState('');
  const [result, setResult] = useState<ArtifactImport>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const analyze = async () => {
    setBusy(true); setError(''); setResult(undefined);
    try {
      const text = mode === 'url' ? await onFetchUrl(url) : contents;
      const imported = importArtifact(text, mode === 'url' ? url : sourceName);
      setContents(text);
      setResult(imported);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section aria-labelledby="import-title" aria-modal="true" className="modal interchange-modal" onMouseDown={(event) => event.stopPropagation()} role="dialog">
        <header><div><small>Interoperability</small><h2 id="import-title">Import API artifacts</h2></div><button aria-label="Close" className="icon-button subtle" onClick={onClose} type="button"><Icon name="x" /></button></header>
        <p>Detect and convert Brunomnia, Insomnia v4/v5, Postman 2.0/2.1, HAR, OpenAPI 3.x, Swagger 2, WSDL, or cURL without executing imported content.</p>
        <nav aria-label="Import source" className="interchange-tabs">{(['file', 'clipboard', 'url'] as const).map((item) => <button className={mode === item ? 'active' : ''} key={item} onClick={() => { setMode(item); setResult(undefined); setError(''); }} type="button">{item === 'url' ? 'URL' : `${item.charAt(0).toUpperCase()}${item.slice(1)}`}</button>)}</nav>
        <div className="interchange-form">
          {mode === 'file' ? <label className="interchange-file"><Icon name="import" size={24} /><strong>{sourceName === 'Imported artifact' ? 'Choose an artifact' : sourceName}</strong><span>JSON, YAML, HAR, WSDL, shell text, or API specification · 20 MB max</span><input aria-label="Import file" accept=".json,.yaml,.yml,.har,.wsdl,.xml,.txt,.sh,application/json,application/yaml,text/yaml,text/xml,text/plain" type="file" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; setSourceName(file.name); setResult(undefined); setError(''); if (file.size > 20_000_000) { setContents(''); setError('The import exceeds the 20 MB local conversion limit.'); return; } void file.text().then(setContents); }} /></label> : null}
          {mode === 'clipboard' ? <label>Clipboard or pasted text<textarea aria-label="Import text" autoFocus placeholder="Paste an export, API definition, WSDL, or cURL command…" value={contents} onChange={(event) => { setContents(event.target.value); setSourceName('clipboard.txt'); setResult(undefined); }} /></label> : null}
          {mode === 'url' ? <label>Artifact URL<input aria-label="Import URL" autoFocus placeholder="https://example.com/openapi.yaml" type="url" value={url} onChange={(event) => { setUrl(event.target.value); setResult(undefined); }} /></label> : null}
          {error ? <div className="interchange-error" role="alert">{error}</div> : null}
          {result ? <div className="import-preview" role="status"><header><div><small>{result.format.replace('-', ' ')}</small><strong>{importSummary(result)}</strong></div><span>{result.warnings.length} warnings</span></header>{Object.keys(result.metadata).length ? <dl>{Object.entries(result.metadata).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl> : null}{result.warnings.length ? <div className="conversion-warnings">{result.warnings.map((warning, index) => <article key={`${warning.code}-${index}`}><strong>{warning.code}</strong><span>{warning.message}</span>{warning.resource ? <small>{warning.resource}</small> : null}</article>)}</div> : <div className="conversion-clean"><Icon name="spark" size={18} /> No conversion warnings</div>}</div> : null}
        </div>
        <footer><button className="modal-cancel" onClick={onClose} type="button">Cancel</button><button className="secondary-button" disabled={busy || (!result && mode === 'file' && !contents)} onClick={result ? () => { onApply(result); onClose(); } : () => void analyze()} type="button">{busy ? 'Analyzing…' : result ? result.replacement ? 'Replace workspace' : 'Import resources' : 'Analyze import'}</button></footer>
      </section>
    </div>
  );
}

type ExportDialogProps = { onClose: () => void; workspace: Workspace };

const exportLabels: Record<ExportFormat, string> = {
  brunomnia: 'Brunomnia JSON',
  'insomnia-v4': 'Insomnia v4 JSON',
  'insomnia-v5': 'Insomnia v5 YAML',
  har: 'HAR 1.2',
  openapi: 'OpenAPI document',
};

export function ExportDialog({ onClose, workspace }: ExportDialogProps) {
  const [scope, setScope] = useState<ExportScope>('all');
  const [format, setFormat] = useState<ExportFormat>('brunomnia');
  const [collectionId, setCollectionId] = useState(workspace.collections[0]?.id ?? '');
  const [designId, setDesignId] = useState(workspace.apiDesigns[0]?.id ?? '');
  const output = useMemo(() => {
    try {
      return { artifact: exportArtifact(workspace, { format, scope, collectionId, designId }), error: '' };
    } catch (caught) {
      return { artifact: undefined, error: caught instanceof Error ? caught.message : String(caught) };
    }
  }, [collectionId, designId, format, scope, workspace]);

  const download = () => {
    if (!output.artifact) return;
    const url = URL.createObjectURL(new Blob([output.artifact.contents], { type: output.artifact.mimeType }));
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = output.artifact.fileName; anchor.click();
    URL.revokeObjectURL(url);
    onClose();
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section aria-labelledby="export-title" aria-modal="true" className="modal interchange-modal export-modal" onMouseDown={(event) => event.stopPropagation()} role="dialog">
        <header><div><small>Portable data</small><h2 id="export-title">Export API artifacts</h2></div><button aria-label="Close" className="icon-button subtle" onClick={onClose} type="button"><Icon name="x" /></button></header>
        <p>Choose a scope and compatibility format. Conversion warnings are shown before anything is downloaded.</p>
        <div className="interchange-form export-options">
          <label>Scope<select aria-label="Export scope" value={scope} onChange={(event) => setScope(event.target.value as ExportScope)}><option value="all">All workspace data</option><option value="collection">Selected collection</option><option value="design">Selected API design</option></select></label>
          {scope === 'collection' ? <label>Collection<select aria-label="Export collection" value={collectionId} onChange={(event) => setCollectionId(event.target.value)}>{workspace.collections.map((collection) => <option key={collection.id} value={collection.id}>{collection.name} · {collection.requests.length}</option>)}</select></label> : null}
          {scope === 'design' ? <label>API design<select aria-label="Export API design" value={designId} onChange={(event) => setDesignId(event.target.value)}>{workspace.apiDesigns.map((design) => <option key={design.id} value={design.id}>{design.name}</option>)}</select></label> : null}
          <label>Format<select aria-label="Export format" value={format} onChange={(event) => { const next = event.target.value as ExportFormat; setFormat(next); if (next === 'openapi') setScope('design'); }}>{Object.entries(exportLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          {output.error ? <div className="interchange-error" role="alert">{output.error}</div> : null}
          {output.artifact ? <div className="export-preview"><Icon name="download" size={24} /><div><strong>{output.artifact.fileName}</strong><span>{new Blob([output.artifact.contents]).size.toLocaleString()} bytes · {output.artifact.warnings.length} warnings</span></div></div> : null}
          {output.artifact?.warnings.length ? <div className="conversion-warnings">{output.artifact.warnings.map((warning, index) => <article key={`${warning.code}-${index}`}><strong>{warning.code}</strong><span>{warning.message}</span>{warning.resource ? <small>{warning.resource}</small> : null}</article>)}</div> : null}
        </div>
        <footer><button className="modal-cancel" onClick={onClose} type="button">Cancel</button><button className="secondary-button" disabled={!output.artifact} onClick={download} type="button">Download export</button></footer>
      </section>
    </div>
  );
}
