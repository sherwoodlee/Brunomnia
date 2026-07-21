import { useMemo, useState } from 'react';
import type { Workspace } from '../types';
import { exportArtifact } from '../lib/interchange/exporters';
import { importArtifact, importSummary, type ArtifactImport, type ExportFormat, type ExportScope } from '../lib/interchange';
import { importArtifactFiles, importMcpServerUrl, isSupportedImportFile } from '../lib/interchange/batch';
import { folderPath, orderedCollectionChildren } from '../lib/resources';
import { Icon } from './Icon';

type ImportDialogProps = {
  onApply: (results: ArtifactImport[]) => void;
  onClose: () => void;
  onFetchUrl: (url: string) => Promise<string>;
};

export function ImportDialog({ onApply, onClose, onFetchUrl }: ImportDialogProps) {
  const [mode, setMode] = useState<'file' | 'clipboard' | 'url' | 'mcp'>('file');
  const [files, setFiles] = useState<File[]>([]);
  const [contents, setContents] = useState('');
  const [url, setUrl] = useState('');
  const [results, setResults] = useState<ArtifactImport[]>([]);
  const [failures, setFailures] = useState<Array<{ sourceName: string; message: string }>>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const selectFiles = (selected: File[]) => {
    const supported = selected.filter((file) => isSupportedImportFile(file.name));
    setFiles(supported);
    setResults([]); setFailures([]);
    setError(supported.length ? '' : 'No supported import files were selected.');
  };
  const analyze = async () => {
    setBusy(true); setError(''); setResults([]); setFailures([]);
    try {
      if (mode === 'file') {
        const batch = await importArtifactFiles(await Promise.all(files.map(async (file) => ({ name: file.webkitRelativePath || file.name, bytes: new Uint8Array(await file.arrayBuffer()) }))));
        setResults(batch.imports); setFailures(batch.errors);
        if (!batch.imports.length) setError('No selected file produced importable resources.');
      } else if (mode === 'mcp') {
        setResults([importMcpServerUrl(url)]);
      } else {
        const text = mode === 'url' ? await onFetchUrl(url) : contents;
        setContents(text);
        setResults([importArtifact(text, mode === 'url' ? url : 'clipboard.txt')]);
      }
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
        <p>Detect and convert Brunomnia, Insomnia v1–v5, Postman 2.0/2.1 or data-dump ZIP, HAR, OpenAPI 3.x, Swagger 2, WSDL, cURL, or an MCP server URL without executing imported content.</p>
        <nav aria-label="Import source" className="interchange-tabs">{(['file', 'clipboard', 'url', 'mcp'] as const).map((item) => <button className={mode === item ? 'active' : ''} key={item} onClick={() => { setMode(item); setResults([]); setFailures([]); setError(''); }} type="button">{item === 'url' ? 'URL' : item === 'mcp' ? 'MCP URL' : `${item.charAt(0).toUpperCase()}${item.slice(1)}`}</button>)}</nav>
        <div className="interchange-form">
          {mode === 'file' ? <><label className="interchange-file"><Icon name="import" size={24} /><strong>{files.length ? `${files.length} supported file${files.length === 1 ? '' : 's'} selected` : 'Choose files or a Postman ZIP'}</strong><span>JSON, YAML, HAR, WSDL, shell text, ZIP, or API specifications · 20 MB each</span><input aria-label="Import files" accept=".json,.yaml,.yml,.har,.wsdl,.xml,.txt,.sh,.bash,.shell,.curl,.zip,application/json,application/yaml,text/yaml,text/xml,text/plain,application/zip" multiple type="file" onChange={(event) => selectFiles(Array.from(event.target.files ?? []))} /></label><label className="interchange-file"><Icon name="folder" size={20} /><strong>Choose a folder recursively</strong><span>Up to 100 supported files · 100 MB batch limit</span><input aria-label="Import folder" multiple type="file" {...{ webkitdirectory: '' }} onChange={(event) => selectFiles(Array.from(event.target.files ?? []))} /></label></> : null}
          {mode === 'clipboard' ? <label>Clipboard or pasted text<textarea aria-label="Import text" autoFocus placeholder="Paste an export, API definition, WSDL, or cURL command…" value={contents} onChange={(event) => { setContents(event.target.value); setResults([]); setFailures([]); }} /></label> : null}
          {mode === 'url' ? <label>Artifact URL<input aria-label="Import URL" autoFocus placeholder="https://example.com/openapi.yaml" type="url" value={url} onChange={(event) => { setUrl(event.target.value); setResults([]); setFailures([]); }} /></label> : null}
          {mode === 'mcp' ? <label>MCP server URL<input aria-label="MCP server URL" autoFocus placeholder="https://mcp.example.com/mcp" type="url" value={url} onChange={(event) => { setUrl(event.target.value); setResults([]); setFailures([]); }} /></label> : null}
          {error ? <div className="interchange-error" role="alert">{error}</div> : null}
          {failures.length ? <div className="conversion-warnings">{failures.map((failure, index) => <article key={`${failure.sourceName}-${index}`}><strong>Import failed</strong><span>{failure.message}</span><small>{failure.sourceName}</small></article>)}</div> : null}
          {results.map((result, resultIndex) => <div className="import-preview" key={`${result.sourceName}-${resultIndex}`} role="status"><header><div><small>{result.format.replace('-', ' ')}</small><strong>{importSummary(result)}</strong></div><span>{result.warnings.length} warnings</span></header>{Object.keys(result.metadata).length ? <dl>{Object.entries(result.metadata).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl> : null}{result.warnings.length ? <div className="conversion-warnings">{result.warnings.map((warning, index) => <article key={`${warning.code}-${index}`}><strong>{warning.code}</strong><span>{warning.message}</span>{warning.resource ? <small>{warning.resource}</small> : null}</article>)}</div> : <div className="conversion-clean"><Icon name="spark" size={18} /> No conversion warnings</div>}</div>)}
        </div>
        <footer><button className="modal-cancel" onClick={onClose} type="button">Cancel</button><button className="secondary-button" disabled={busy || (!results.length && ((mode === 'file' && !files.length) || (mode === 'clipboard' && !contents.trim()) || ((mode === 'url' || mode === 'mcp') && !url.trim())))} onClick={results.length ? () => { onApply(results); onClose(); } : () => void analyze()} type="button">{busy ? 'Analyzing…' : results.length ? results[0].replacement ? 'Replace workspace' : `Import ${results.length} artifact${results.length === 1 ? '' : 's'}` : 'Analyze import'}</button></footer>
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
  const [requestIds, setRequestIds] = useState(() => workspace.collections[0]?.requests.map((request) => request.id) ?? []);
  const [includePrivateEnvironments, setIncludePrivateEnvironments] = useState(false);
  const collection = workspace.collections.find((candidate) => candidate.id === collectionId);
  const requestRows = useMemo(() => {
    if (!collection) return [];
    const requests = new Map(collection.requests.map((request) => [request.id, request]));
    const folders = new Map((collection.folders ?? []).map((folder) => [folder.id, folder]));
    const rows: Array<{ id: string; name: string; path: string }> = [];
    const visitedRequests = new Set<string>();
    const visitedFolders = new Set<string>();
    const visit = (parentId: string, path: string[]) => {
      orderedCollectionChildren(collection, parentId).forEach((resource) => {
        if (resource.kind === 'request') {
          const request = requests.get(resource.id);
          if (request && !visitedRequests.has(request.id)) {
            visitedRequests.add(request.id);
            rows.push({ id: request.id, name: request.name, path: path.join(' / ') });
          }
          return;
        }
        if (visitedFolders.has(resource.id)) return;
        const folder = folders.get(resource.id);
        if (!folder) return;
        visitedFolders.add(folder.id);
        visit(folder.id, [...path, folder.name]);
      });
    };
    visit('', []);
    collection.requests.forEach((request) => {
      if (!visitedRequests.has(request.id)) rows.push({ id: request.id, name: request.name, path: request.folderId ? folderPath(collection, request.folderId) : '' });
    });
    return rows;
  }, [collection]);
  const privateEnvironmentCount = workspace.environments.length - workspace.environments.filter((environment) => !environment.private).length;
  const output = useMemo(() => {
    try {
      return { artifact: exportArtifact(workspace, { format, scope, collectionId, designId, requestIds: scope === 'collection' ? requestIds : undefined, includePrivateEnvironments }), error: '' };
    } catch (caught) {
      return { artifact: undefined, error: caught instanceof Error ? caught.message : String(caught) };
    }
  }, [collectionId, designId, format, includePrivateEnvironments, requestIds, scope, workspace]);

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
          {scope === 'collection' ? <label>Collection<select aria-label="Export collection" value={collectionId} onChange={(event) => { const nextId = event.target.value; setCollectionId(nextId); setRequestIds(workspace.collections.find((candidate) => candidate.id === nextId)?.requests.map((request) => request.id) ?? []); }}>{workspace.collections.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name} · {candidate.requests.length}</option>)}</select></label> : null}
          {scope === 'design' ? <label>API design<select aria-label="Export API design" value={designId} onChange={(event) => setDesignId(event.target.value)}>{workspace.apiDesigns.map((design) => <option key={design.id} value={design.id}>{design.name}</option>)}</select></label> : null}
          <label>Format<select aria-label="Export format" value={format} onChange={(event) => { const next = event.target.value as ExportFormat; setFormat(next); if (next === 'openapi') { setScope('design'); setIncludePrivateEnvironments(false); } }}>{Object.entries(exportLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          {scope === 'collection' ? <fieldset className="export-request-selection"><legend><span>Requests</span><button onClick={() => setRequestIds(requestIds.length === requestRows.length ? [] : requestRows.map((request) => request.id))} type="button">{requestIds.length === requestRows.length ? 'Clear all' : 'Select all'}</button></legend><div>{requestRows.map((request) => <label key={request.id}><input checked={requestIds.includes(request.id)} onChange={(event) => setRequestIds((current) => event.target.checked ? [...current, request.id] : current.filter((id) => id !== request.id))} type="checkbox" /><span><strong>{request.name}</strong>{request.path ? <small>{request.path}</small> : null}</span></label>)}</div></fieldset> : null}
          {format !== 'openapi' && privateEnvironmentCount ? <label className="export-private-consent"><input checked={includePrivateEnvironments} onChange={(event) => setIncludePrivateEnvironments(event.target.checked)} type="checkbox" /><span><strong>Include private environments</strong><small>Explicitly export device-private values. The downloaded file may contain secrets.</small></span></label> : null}
          {output.error ? <div className="interchange-error" role="alert">{output.error}</div> : null}
          {output.artifact ? <div className="export-preview"><Icon name="download" size={24} /><div><strong>{output.artifact.fileName}</strong><span>{new Blob([output.artifact.contents]).size.toLocaleString()} bytes · {output.artifact.warnings.length} warnings</span></div></div> : null}
          {output.artifact?.warnings.length ? <div className="conversion-warnings">{output.artifact.warnings.map((warning, index) => <article key={`${warning.code}-${index}`}><strong>{warning.code}</strong><span>{warning.message}</span>{warning.resource ? <small>{warning.resource}</small> : null}</article>)}</div> : null}
        </div>
        <footer><button className="modal-cancel" onClick={onClose} type="button">Cancel</button><button className="secondary-button" disabled={!output.artifact} onClick={download} type="button">Download export</button></footer>
      </section>
    </div>
  );
}
