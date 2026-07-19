import { useEffect, useMemo, useState } from 'react';
import type { ApiRequest, ResponsePreviewMode, StreamMessage } from '../types';
import { filterStreamMessages, type StreamEventCategory } from '../lib/streamHistory';
import { downloadStreamMessage, streamMessageArguments, streamMessageBytes, streamMessagePreview, streamMessageRawText, streamMessageSummary } from '../lib/streamEvent';
import { Icon } from './Icon';

const fileBase64 = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(reader.error ?? new Error('Unable to read the selected file.'));
  reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
  reader.readAsDataURL(file);
});

export function StreamConsole({
  request,
  sessionId,
  protocol,
  messages,
  connected,
  draft,
  onDraftChange,
  frameKind,
  onFrameKindChange,
  onSend,
  previewMode,
  onPreviewModeChange,
}: {
  request: ApiRequest;
  sessionId: string;
  protocol: ApiRequest['protocol'];
  messages: StreamMessage[];
  connected: boolean;
  draft: string;
  onDraftChange: (value: string) => void;
  frameKind: 'text' | 'binary';
  onFrameKindChange: (value: 'text' | 'binary') => void;
  onSend: () => void;
  previewMode: ResponsePreviewMode;
  onPreviewModeChange: (value: ResponsePreviewMode) => void;
}) {
  const [eventType, setEventType] = useState<StreamEventCategory>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [clearedThrough, setClearedThrough] = useState('');
  const [selectedMessageId, setSelectedMessageId] = useState('');
  const [selectedArgument, setSelectedArgument] = useState(0);
  const [actionError, setActionError] = useState('');
  const visibleMessages = useMemo(
    () => filterStreamMessages(messages, eventType, searchQuery, clearedThrough),
    [clearedThrough, eventType, messages, searchQuery],
  );
  const selectedMessage = messages.find((message) => message.id === selectedMessageId && message.direction !== 'system');
  const socketArguments = useMemo(() => selectedMessage && protocol === 'socketio' ? streamMessageArguments(selectedMessage) : [], [protocol, selectedMessage]);
  const selectedPreview = useMemo(() => selectedMessage
    ? streamMessagePreview(selectedMessage, previewMode, previewMode === 'friendly' && socketArguments.length ? Math.min(selectedArgument, socketArguments.length - 1) : undefined)
    : '', [previewMode, selectedArgument, selectedMessage, socketArguments.length]);
  useEffect(() => {
    setEventType('');
    setSearchQuery('');
    setClearedThrough('');
    setSelectedMessageId('');
    setSelectedArgument(0);
    setActionError('');
  }, [sessionId]);
  useEffect(() => {
    if (selectedMessageId && !messages.some((message) => message.id === selectedMessageId)) setSelectedMessageId('');
  }, [messages, selectedMessageId]);
  useEffect(() => { setSelectedArgument(0); setActionError(''); }, [selectedMessageId]);

  return (
    <div className={`stream-console${protocol === 'websocket' || protocol === 'socketio' ? ' with-composer' : ''}`}>
      <div className={`stream-main${selectedMessage ? ' with-inspector' : ''}`}>
        <div className="stream-log" aria-live="polite">
          <div className="stream-log-toolbar">
            <select aria-label="Stream event type" disabled={protocol === 'sse'} onChange={(event) => setEventType(event.target.value as StreamEventCategory)} value={eventType}><option value="">All</option><option value="message">Message</option><option value="open">Open</option><option value="close">Close</option><option value="error">Error</option></select>
            <label><Icon name="search" size={14} /><input aria-label="Events filter" onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search" type="search" value={searchQuery} /></label>
            <span>{visibleMessages.length} / {messages.length}</span>
            <button aria-label="Clear visible stream events" disabled={!messages.length} onClick={() => setClearedThrough(messages.at(-1)?.timestamp ?? '')} type="button"><Icon name="x" size={14} /> Clear view</button>
          </div>
          {visibleMessages.length ? visibleMessages.map((message) => {
            const selectable = message.direction !== 'system';
            return (
              <article className={`stream-message ${message.direction}${selectedMessageId === message.id ? ' selected' : ''}`} key={message.id}>
                <button aria-label={selectable ? `Inspect ${message.kind} event` : undefined} aria-pressed={selectable ? selectedMessageId === message.id : undefined} disabled={!selectable} onClick={() => { setSelectedMessageId((current) => current === message.id ? '' : message.id); }} type="button">
                  <header><span>{message.direction}</span><strong>{message.kind}</strong><time>{new Date(message.timestamp).toLocaleTimeString()}</time></header>
                  <pre>{streamMessageSummary(message)}</pre>
                </button>
              </article>
            );
          }) : <div className="empty-state compact"><Icon name="history" size={26} /><strong>{messages.length ? 'No matching stream activity' : 'No stream activity yet'}</strong><span>{messages.length ? 'Adjust the event type, search, or wait for a new event.' : 'Connect to start the ordered event log.'}</span></div>}
        </div>
        {selectedMessage ? (
          <section className="stream-event-inspector" aria-label="Selected realtime event">
            <header>
              <div><small>{selectedMessage.direction} · {selectedMessage.kind}</small><strong>{protocol === 'socketio' ? selectedMessage.kind : 'Message data'}</strong><span>{streamMessageBytes(selectedMessage).byteLength.toLocaleString()} bytes · {new Date(selectedMessage.timestamp).toLocaleTimeString()}</span></div>
              <div>
                <select aria-label="Realtime event preview mode" onChange={(event) => onPreviewModeChange(event.target.value as ResponsePreviewMode)} value={previewMode}><option value="friendly">Friendly</option><option value="source">Source</option><option value="raw">Raw</option></select>
                <button onClick={() => { setActionError(''); void navigator.clipboard.writeText(streamMessageRawText(selectedMessage)).catch((error) => setActionError(error instanceof Error ? error.message : String(error))); }} type="button"><Icon name="copy" size={13} /> Copy raw</button>
                <button onClick={() => { setActionError(''); try { downloadStreamMessage(request.name, selectedMessage); } catch (error) { setActionError(error instanceof Error ? error.message : String(error)); } }} type="button"><Icon name="download" size={13} /> Export raw</button>
                <button aria-label="Close event inspector" onClick={() => setSelectedMessageId('')} type="button"><Icon name="x" size={13} /></button>
              </div>
            </header>
            {protocol === 'socketio' && previewMode === 'friendly' && socketArguments.length ? <div className="stream-event-arguments" role="tablist" aria-label="Socket.IO event arguments">{socketArguments.map((_, index) => <button aria-selected={selectedArgument === index} key={index} onClick={() => setSelectedArgument(index)} role="tab" type="button">Argument {index + 1}</button>)}</div> : null}
            {actionError ? <div className="stream-event-error" role="alert">{actionError}</div> : null}
            <pre className={previewMode}>{selectedPreview || ' '}</pre>
          </section>
        ) : null}
      </div>
      {protocol === 'websocket' ? (
        <div className="stream-composer">
          <div className="stream-frame-tools"><select aria-label="WebSocket frame type" disabled={!connected} value={frameKind} onChange={(event) => onFrameKindChange(event.target.value as 'text' | 'binary')}><option value="text">Text</option><option value="binary">Binary (base64)</option></select>{frameKind === 'binary' ? <label className="file-picker"><Icon name="import" size={14} /><span>{draft ? `${Math.floor(draft.length * .75)} bytes selected` : 'Choose binary file'}</span><input type="file" onChange={(event) => { const file = event.target.files?.[0]; if (file) void fileBase64(file).then(onDraftChange); }} /></label> : null}</div>
          <textarea aria-label="WebSocket message" disabled={!connected} placeholder={connected ? frameKind === 'binary' ? 'Paste base64 or choose a file…' : 'Type a text frame…' : 'Connect before sending a frame'} value={draft} onChange={(event) => onDraftChange(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) onSend(); }} />
          <button disabled={!connected || !draft.trim()} onClick={onSend} type="button">Send frame</button>
        </div>
      ) : null}
      {protocol === 'socketio' ? (
        <div className="stream-composer socketio-live-composer">
          <div><span><strong>{request.socketIo.eventName.trim() || 'message'}</strong><small>{request.socketIo.args.length} {request.socketIo.args.length === 1 ? 'argument' : 'arguments'}{request.socketIo.ack ? ' · acknowledgement' : ''}</small></span><button disabled={!connected || !request.socketIo.eventName.trim()} onClick={onSend} type="button">Emit event</button></div>
          <small>Edit event name, ordered arguments, acknowledgement, and listeners in the request Body tab.</small>
        </div>
      ) : null}
    </div>
  );
}
