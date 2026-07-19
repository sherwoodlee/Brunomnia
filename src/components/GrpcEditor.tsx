import { useEffect, useRef, useState } from 'react';
import type { ApiRequest, Environment, GrpcSchema, StreamMessage } from '../types';
import type { SendRequestContext } from '../lib/http';
import { cancelGrpcSession, commitGrpcSession, sendGrpcSessionMessage, startGrpcSession } from '../lib/grpc';
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
  environment,
  requestContext,
}: {
  request: ApiRequest;
  schema?: GrpcSchema;
  schemaLoading: boolean;
  onChange: ChangeRequest;
  onLoadSchema: () => void;
  environment: Environment;
  requestContext: SendRequestContext;
}) {
  const grpc = request.grpc;
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState('');
  const [sessionStatus, setSessionStatus] = useState<'idle' | 'starting' | 'active' | 'committed' | 'ended'>('idle');
  const [sessionCallType, setSessionCallType] = useState('');
  const [sessionError, setSessionError] = useState('');
  const [sessionMessages, setSessionMessages] = useState<StreamMessage[]>([]);
  const sessionId = useRef('');
  const activeFile = grpc.protoFiles.find((file) => file.path === grpc.protoActivePath) ?? grpc.protoFiles[0];
  const service = schema?.services.find((candidate) => candidate.fullName === grpc.service) ?? schema?.services[0];
  const method = service?.methods.find((candidate) => candidate.name === grpc.method) ?? service?.methods[0];
  const sessionActive = sessionStatus === 'starting' || sessionStatus === 'active' || sessionStatus === 'committed';
  const statusEvent = [...sessionMessages].reverse().find((message) => message.kind === 'status' && message.statusCode !== undefined);
  const statusMetadata = Object.entries(statusEvent?.metadata ?? {});
  const update = (patch: Partial<ApiRequest['grpc']>) => onChange({ grpc: { ...grpc, ...patch } });
  const onSessionEvent = (message: StreamMessage) => {
    setSessionMessages((current) => [...current, message].slice(-500));
    if (message.kind === 'error') setSessionError(message.text);
    if (message.kind === 'end') {
      sessionId.current = '';
      setSessionStatus('ended');
    }
  };
  const startSession = async () => {
    if (!method) return;
    const nextSessionId = `grpc-${request.id}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    sessionId.current = nextSessionId;
    setSessionStatus('starting');
    setSessionCallType('');
    setSessionError('');
    setSessionMessages([]);
    try {
      const result = await startGrpcSession(
        request,
        environment,
        nextSessionId,
        onSessionEvent,
        requestContext.requestTimeoutMs,
        requestContext.validateCertificates,
        requestContext.certificates,
      );
      if (sessionId.current === nextSessionId) {
        setSessionCallType(result.callType);
        setSessionStatus('active');
      }
    } catch (error) {
      if (sessionId.current === nextSessionId) sessionId.current = '';
      setSessionStatus('ended');
      setSessionError(error instanceof Error ? error.message : String(error));
    }
  };
  const sendMessage = async () => {
    if (!sessionId.current) return;
    try {
      setSessionError('');
      await sendGrpcSessionMessage(sessionId.current, grpc.input, environment);
    } catch (error) {
      setSessionError(error instanceof Error ? error.message : String(error));
    }
  };
  const commitSession = async () => {
    if (!sessionId.current) return;
    try {
      setSessionError('');
      await commitGrpcSession(sessionId.current);
      setSessionStatus('committed');
    } catch (error) {
      setSessionError(error instanceof Error ? error.message : String(error));
    }
  };
  const cancelSession = async () => {
    const activeSessionId = sessionId.current;
    if (!activeSessionId) return;
    try {
      setSessionError('');
      await cancelGrpcSession(activeSessionId);
    } catch (error) {
      setSessionError(error instanceof Error ? error.message : String(error));
    } finally {
      if (sessionId.current === activeSessionId) {
        sessionId.current = '';
        setSessionStatus('ended');
      }
    }
  };
  useEffect(() => {
    setSessionStatus('idle');
    setSessionCallType('');
    setSessionError('');
    setSessionMessages([]);
    return () => {
      const activeSessionId = sessionId.current;
      sessionId.current = '';
      if (activeSessionId) void cancelGrpcSession(activeSessionId).catch(() => undefined);
    };
  }, [request.id, grpc.method, grpc.service]);
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
          <button className={grpc.descriptorSource === 'reflection' ? 'active' : ''} disabled={sessionActive} onClick={() => update({ descriptorSource: 'reflection', descriptorSetBase64: '' })} type="button">Reflection</button>
          <button className={grpc.descriptorSource === 'proto' ? 'active' : ''} disabled={sessionActive} onClick={() => update({ descriptorSource: 'proto', descriptorSetBase64: '' })} type="button">Proto source</button>
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
            <label>Service<select aria-label="gRPC service" disabled={sessionActive} value={service?.fullName ?? ''} onChange={(event) => { const next = schema?.services.find((candidate) => candidate.fullName === event.target.value); update({ service: event.target.value, method: next?.methods[0]?.name ?? '' }); }}><option value="">Select service</option>{schema?.services.map((item) => <option key={item.fullName} value={item.fullName}>{item.fullName}</option>)}</select></label>
            <label>Method<select aria-label="gRPC method" disabled={sessionActive} value={method?.name ?? ''} onChange={(event) => update({ service: service?.fullName ?? '', method: event.target.value })}><option value="">Select method</option>{service?.methods.map((item) => <option key={item.fullName} value={item.name}>{item.name}</option>)}</select></label>
            {method ? <span className="rpc-kind">{method.clientStreaming ? 'client stream' : 'single request'} → {method.serverStreaming ? 'server stream' : 'single response'}</span> : null}
          </div>
          {schema ? <div className="grpc-message-lifecycle">
            <div className="grpc-message-editor"><div className="pane-label"><strong>JSON message</strong><small>{method?.clientStreaming ? 'One message per send' : 'Initial request'}</small></div><CodeEditor ariaLabel="gRPC JSON message" value={grpc.input} onChange={(input) => update({ input })} /></div>
            <div className="grpc-session-console">
              <div className="grpc-session-toolbar">
                <button disabled={!method || sessionActive} onClick={() => void startSession()} type="button">Start</button>
                <button disabled={!method?.clientStreaming || sessionStatus !== 'active'} onClick={() => void sendMessage()} type="button">Send message</button>
                <button disabled={!method?.clientStreaming || sessionStatus !== 'active'} onClick={() => void commitSession()} type="button">Commit</button>
                <button disabled={!sessionActive} onClick={() => void cancelSession()} type="button">Cancel</button>
                <button disabled={!sessionMessages.length} onClick={() => setSessionMessages([])} type="button">Clear</button>
                <span className={`grpc-session-state ${sessionStatus}`}>{sessionStatus}{sessionCallType ? ` · ${sessionCallType}` : ''}</span>
              </div>
              {statusEvent || sessionError ? <div className="grpc-session-notices">
                {statusEvent ? <div className={`grpc-status-summary${statusEvent.statusCode === 0 ? ' ok' : ' bad'}`}><strong>{statusEvent.statusCode} {statusEvent.statusName ?? ''}</strong><span>{statusEvent.statusDetails}</span>{statusMetadata.length ? <details><summary>{statusMetadata.length} metadata {statusMetadata.length === 1 ? 'field' : 'fields'}</summary><div>{statusMetadata.map(([name, values]) => <p key={name}><code>{name}</code><span>{values.join('\n')}</span></p>)}</div></details> : null}</div> : null}
                {sessionError ? <div className="grpc-session-error">{sessionError}</div> : null}
              </div> : null}
              <div aria-live="polite" className="grpc-session-log">
                {sessionMessages.length ? sessionMessages.map((message) => <article className={`stream-message ${message.direction}`} key={message.id}><header><span>{message.direction}</span><strong>{message.kind}</strong><time>{new Date(message.timestamp).toLocaleTimeString()}</time></header><pre>{message.text}</pre></article>) : <div className="empty-state compact"><Icon name="history" size={24} /><strong>No call activity yet</strong><span>Start the call, then send and commit client-stream messages independently.</span></div>}
              </div>
            </div>
          </div> : <div className="empty-state compact"><Icon name="database" size={26} /><strong>Load reflection or this proto definition</strong><span>Brunomnia builds dynamic request and response messages locally.</span></div>}
        </div>
      </div>
    </div>
  );
}
