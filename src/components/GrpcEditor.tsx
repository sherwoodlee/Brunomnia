import { useRef, useState } from 'react';
import type { ApiRequest, GrpcSchema } from '../types';
import { importGrpcProtoFiles } from '../lib/grpcProtoImport';
import { CodeEditor } from './ProtocolEditors';
import { Icon } from './Icon';

type ChangeRequest = (patch: Partial<ApiRequest>) => void;

export function GrpcEditor({
  request,
  schema,
  schemaLoading,
  onChange,
  onLoadSchema,
}: {
  request: ApiRequest;
  schema?: GrpcSchema;
  schemaLoading: boolean;
  onChange: ChangeRequest;
  onLoadSchema: () => void;
}) {
  const grpc = request.grpc;
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState('');
  const activeFile = grpc.protoFiles.find((file) => file.path === grpc.protoActivePath) ?? grpc.protoFiles[0];
  const service = schema?.services.find((candidate) => candidate.fullName === grpc.service) ?? schema?.services[0];
  const method = service?.methods.find((candidate) => candidate.name === grpc.method) ?? service?.methods[0];
  const update = (patch: Partial<ApiRequest['grpc']>) => onChange({ grpc: { ...grpc, ...patch } });
  const importFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    try {
      const tree = await importGrpcProtoFiles(files);
      setImportError('');
      update({ ...tree, descriptorSetBase64: '', service: '', method: '' });
    } catch (error) {
      setImportError(error instanceof Error ? error.message : String(error));
    }
  };
  const updateActiveFile = (text: string) => {
    if (!activeFile) return;
    update({
      protoFiles: grpc.protoFiles.map((file) => file.id === activeFile.id ? { ...file, text } : file),
      ...(grpc.protoEntryPath === activeFile.path ? { protoText: text } : {}),
      descriptorSetBase64: '',
    });
  };
  return (
    <div className="grpc-editor">
      <div className="grpc-schema-bar">
        <div className="segmented-control">
          <button className={grpc.descriptorSource === 'reflection' ? 'active' : ''} onClick={() => update({ descriptorSource: 'reflection', descriptorSetBase64: '' })} type="button">Reflection</button>
          <button className={grpc.descriptorSource === 'proto' ? 'active' : ''} onClick={() => update({ descriptorSource: 'proto', descriptorSetBase64: '' })} type="button">Proto source</button>
        </div>
        <button className="secondary-button compact-button" disabled={schemaLoading} onClick={onLoadSchema} type="button">{schemaLoading ? 'Loading…' : 'Load schema'}</button>
      </div>
      <div className={`grpc-workspace${grpc.descriptorSource === 'proto' ? ' with-proto' : ''}`}>
        {grpc.descriptorSource === 'proto' ? (
          <div className="proto-source-pane">
            <div className="proto-import-bar">
              <div>
                <button onClick={() => fileInput.current?.click()} type="button"><Icon name="import" size={12} />Import files</button>
                <button onClick={() => folderInput.current?.click()} type="button"><Icon name="folder" size={12} />Import folder</button>
              </div>
              <small className={importError ? 'error' : ''}>{importError || `${grpc.protoFiles.length} file${grpc.protoFiles.length === 1 ? '' : 's'} · 10 MiB max`}</small>
              <input ref={fileInput} accept=".proto" hidden multiple onChange={(event) => { void importFiles(event.target.files); event.target.value = ''; }} type="file" />
              <input ref={folderInput} accept=".proto" hidden multiple onChange={(event) => { void importFiles(event.target.files); event.target.value = ''; }} type="file" {...{ webkitdirectory: '' }} />
            </div>
            <div className="proto-file-controls">
              <label>Editing<select aria-label="Active proto file" value={activeFile?.path ?? ''} onChange={(event) => update({ protoActivePath: event.target.value })}>{grpc.protoFiles.map((file) => <option key={file.id} value={file.path}>{file.path}</option>)}</select></label>
              <label>Compile entry<select aria-label="Proto entry file" value={grpc.protoEntryPath} onChange={(event) => { const entry = grpc.protoFiles.find((file) => file.path === event.target.value); update({ protoEntryPath: event.target.value, protoText: entry?.text ?? '', descriptorSetBase64: '', service: '', method: '' }); }}>{grpc.protoFiles.map((file) => <option key={file.id} value={file.path}>{file.path}</option>)}</select></label>
            </div>
            {activeFile ? <CodeEditor ariaLabel={`Protocol Buffer definition ${activeFile.path}`} value={activeFile.text} onChange={updateActiveFile} /> : <div className="empty-state compact"><Icon name="import" size={26} /><strong>Import a proto file or folder</strong><span>Relative imports are compiled from the selected entry file.</span></div>}
          </div>
        ) : null}
        <div className="grpc-call-editor">
          <div className="grpc-method-picker">
            <label>Service<select aria-label="gRPC service" value={service?.fullName ?? ''} onChange={(event) => { const next = schema?.services.find((candidate) => candidate.fullName === event.target.value); update({ service: event.target.value, method: next?.methods[0]?.name ?? '' }); }}><option value="">Select service</option>{schema?.services.map((item) => <option key={item.fullName} value={item.fullName}>{item.fullName}</option>)}</select></label>
            <label>Method<select aria-label="gRPC method" value={method?.name ?? ''} onChange={(event) => update({ service: service?.fullName ?? '', method: event.target.value })}><option value="">Select method</option>{service?.methods.map((item) => <option key={item.fullName} value={item.name}>{item.name}</option>)}</select></label>
            {method ? <span className="rpc-kind">{method.clientStreaming ? 'client stream' : 'single request'} → {method.serverStreaming ? 'server stream' : 'single response'}</span> : null}
          </div>
          {schema ? <CodeEditor ariaLabel="gRPC JSON message" value={grpc.input} onChange={(input) => update({ input })} /> : <div className="empty-state compact"><Icon name="database" size={26} /><strong>Load reflection or this proto definition</strong><span>Brunomnia builds dynamic request and response messages locally.</span></div>}
        </div>
      </div>
    </div>
  );
}
