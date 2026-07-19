import type { FilePayload, KeyValue, MultipartPart } from '../types';
import { Icon } from './Icon';

export type MultipartEditorMode = 'text' | 'multiline' | 'file';

export const multipartEditorMode = (part: MultipartPart): MultipartEditorMode => part.kind === 'file'
  ? 'file'
  : part.multiline ? 'multiline' : 'text';

export const withMultipartEditorMode = (part: MultipartPart, mode: MultipartEditorMode): MultipartPart => {
  const current = multipartEditorMode(part);
  if (current === mode) return part;
  if (current === 'file' || mode === 'file') {
    return {
      ...part,
      kind: mode === 'file' ? 'file' : 'text',
      multiline: mode === 'multiline',
      file: undefined,
      fileName: '',
      contentType: '',
    };
  }
  return { ...part, kind: 'text', multiline: mode === 'multiline' };
};

export const moveBodyRow = <Row extends { id: string }>(rows: Row[], id: string, offset: -1 | 1) => {
  const index = rows.findIndex((row) => row.id === id);
  const target = index + offset;
  if (index < 0 || target < 0 || target >= rows.length) return rows;
  const next = [...rows];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
};

export const filePayload = async (file: File): Promise<FilePayload> => ({
  fileName: file.name,
  mimeType: file.type || 'application/octet-stream',
  dataBase64: await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.readAsDataURL(file);
  }),
});

const uid = () => `part-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const formUid = () => `form-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

export function FormBodyEditor({ rows, onChange }: { rows: KeyValue[]; onChange: (rows: KeyValue[]) => void }) {
  const update = (id: string, patch: Partial<KeyValue>) => onChange(rows.map((row) => row.id === id ? { ...row, ...patch } : row));
  return <div className="form-body-editor">
    <div className="form-body-header"><span>On</span><span>Type</span><span>Name</span><span>Value</span><span>Description</span><span /></div>
    {rows.map((row, index) => <div className={`form-body-row${row.multiline ? ' multiline' : ''}${row.enabled ? '' : ' disabled'}`} key={row.id}>
      <label className="multipart-enabled"><input aria-label="Enable form field" checked={row.enabled} onChange={(event) => update(row.id, { enabled: event.target.checked })} type="checkbox" /></label>
      <select aria-label="Form field type" disabled={!row.enabled} value={row.multiline ? 'multiline' : 'text'} onChange={(event) => update(row.id, { multiline: event.target.value === 'multiline' })}><option value="text">Text</option><option value="multiline">Multiline</option></select>
      <input aria-label="Form field name" disabled={!row.enabled} placeholder="field" value={row.name} onChange={(event) => update(row.id, { name: event.target.value })} />
      {row.multiline ? <textarea aria-label="Form field value" disabled={!row.enabled} placeholder="Multiline value" spellCheck={false} value={row.value} onChange={(event) => update(row.id, { value: event.target.value })} /> : <input aria-label="Form field value" disabled={!row.enabled} placeholder="value" value={row.value} onChange={(event) => update(row.id, { value: event.target.value })} />}
      <input aria-label="Form field description" disabled={!row.enabled} placeholder="description" value={row.description ?? ''} onChange={(event) => update(row.id, { description: event.target.value })} />
      <div className="body-row-actions"><button aria-label="Move form field up" disabled={index === 0} onClick={() => onChange(moveBodyRow(rows, row.id, -1))} type="button"><Icon name="chevron-up" size={13} /></button><button aria-label="Move form field down" disabled={index === rows.length - 1} onClick={() => onChange(moveBodyRow(rows, row.id, 1))} type="button"><Icon name="chevron-down" size={13} /></button><button aria-label="Remove form field" onClick={() => onChange(rows.filter((candidate) => candidate.id !== row.id))} type="button"><Icon name="trash" size={13} /></button></div>
    </div>)}
    <button className="add-row" onClick={() => onChange([...rows, { id: formUid(), name: '', value: '', enabled: true, description: '', multiline: false }])} type="button"><Icon name="plus" size={14} /> Add field</button>
  </div>;
}

export default function MultipartEditor({ parts, onChange }: { parts: MultipartPart[]; onChange: (parts: MultipartPart[]) => void }) {
  const update = (id: string, patch: Partial<MultipartPart>) => onChange(parts.map((part) => part.id === id ? { ...part, ...patch } : part));
  const setMode = (id: string, mode: MultipartEditorMode) => onChange(parts.map((part) => part.id === id ? withMultipartEditorMode(part, mode) : part));
  return (
    <div className="multipart-editor">
      <div className="multipart-header"><span>On</span><span>Type</span><span>Name</span><span>Value / file</span><span>Part metadata</span><span /></div>
      {parts.map((part, index) => {
        const mode = multipartEditorMode(part);
        return <div className={`multipart-row${mode === 'multiline' ? ' multiline' : ''}${part.enabled ? '' : ' disabled'}`} key={part.id}>
          <label className="multipart-enabled"><input aria-label="Enable multipart field" checked={part.enabled} onChange={(event) => update(part.id, { enabled: event.target.checked })} type="checkbox" /></label>
          <select aria-label="Multipart field type" disabled={!part.enabled} value={mode} onChange={(event) => setMode(part.id, event.target.value as MultipartEditorMode)}>
            <option value="text">Text</option><option value="multiline">Multiline</option><option value="file">File</option>
          </select>
          <input aria-label="Multipart field name" disabled={!part.enabled} value={part.name} onChange={(event) => update(part.id, { name: event.target.value })} placeholder="field" />
          {mode === 'file' ? (
            <label className="file-picker"><Icon name="import" size={14} /><span>{part.file?.fileName ?? 'Choose file'}</span><input disabled={!part.enabled} type="file" onChange={(event) => { const file = event.target.files?.[0]; if (file) void filePayload(file).then((payload) => update(part.id, { file: payload, fileName: payload.fileName, contentType: payload.mimeType })); }} /></label>
          ) : mode === 'multiline' ? (
            <textarea aria-label="Multipart field value" disabled={!part.enabled} value={part.value} onChange={(event) => update(part.id, { value: event.target.value })} placeholder="Multiline value" spellCheck={false} />
          ) : <input aria-label="Multipart field value" disabled={!part.enabled} value={part.value} onChange={(event) => update(part.id, { value: event.target.value })} placeholder="value" />}
          <div className="multipart-metadata">
            {mode === 'file' ? <input aria-label="Multipart file name" disabled={!part.enabled} value={part.fileName ?? part.file?.fileName ?? ''} onChange={(event) => update(part.id, { fileName: event.target.value })} placeholder="filename" /> : null}
            <input aria-label="Multipart content type" disabled={!part.enabled} value={part.contentType ?? part.file?.mimeType ?? ''} onChange={(event) => update(part.id, { contentType: event.target.value })} placeholder={mode === 'file' ? 'application/octet-stream' : 'text/plain'} />
            <input aria-label="Multipart description" disabled={!part.enabled} value={part.description ?? ''} onChange={(event) => update(part.id, { description: event.target.value })} placeholder="description" />
          </div>
          <div className="body-row-actions"><button aria-label="Move multipart field up" disabled={index === 0} onClick={() => onChange(moveBodyRow(parts, part.id, -1))} type="button"><Icon name="chevron-up" size={13} /></button><button aria-label="Move multipart field down" disabled={index === parts.length - 1} onClick={() => onChange(moveBodyRow(parts, part.id, 1))} type="button"><Icon name="chevron-down" size={13} /></button><button aria-label="Remove multipart field" onClick={() => onChange(parts.filter((candidate) => candidate.id !== part.id))} type="button"><Icon name="trash" size={13} /></button></div>
        </div>;
      })}
      <button className="add-row" onClick={() => onChange([...parts, { id: uid(), name: '', value: '', enabled: true, description: '', kind: 'text', multiline: false, contentType: '', fileName: '' }])} type="button"><Icon name="plus" size={14} /> Add part</button>
    </div>
  );
}
