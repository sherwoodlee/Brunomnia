import { useEffect, useMemo, useState } from 'react';
import type { ApiRequest, StreamMessage } from '../types';
import { filterStreamMessages, type StreamEventCategory } from '../lib/streamHistory';
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
}) {
  const [eventType, setEventType] = useState<StreamEventCategory>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [clearedThrough, setClearedThrough] = useState('');
  const visibleMessages = useMemo(
    () => filterStreamMessages(messages, eventType, searchQuery, clearedThrough),
    [clearedThrough, eventType, messages, searchQuery],
  );
  useEffect(() => {
    setEventType('');
    setSearchQuery('');
    setClearedThrough('');
  }, [sessionId]);

  return (
    <div className={`stream-console${protocol === 'websocket' || protocol === 'socketio' ? ' with-composer' : ''}`}>
      <div className="stream-log" aria-live="polite">
        <div className="stream-log-toolbar">
          <select aria-label="Stream event type" disabled={protocol === 'sse'} onChange={(event) => setEventType(event.target.value as StreamEventCategory)} value={eventType}><option value="">All</option><option value="message">Message</option><option value="open">Open</option><option value="close">Close</option><option value="error">Error</option></select>
          <label><Icon name="search" size={14} /><input aria-label="Events filter" onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search" type="search" value={searchQuery} /></label>
          <span>{visibleMessages.length} / {messages.length}</span>
          <button aria-label="Clear visible stream events" disabled={!messages.length} onClick={() => setClearedThrough(messages.at(-1)?.timestamp ?? '')} type="button"><Icon name="x" size={14} /> Clear view</button>
        </div>
        {visibleMessages.length ? visibleMessages.map((message) => (
          <article className={`stream-message ${message.direction}`} key={message.id}>
            <header><span>{message.direction}</span><strong>{message.kind}</strong><time>{new Date(message.timestamp).toLocaleTimeString()}</time></header>
            <pre>{message.text}</pre>
          </article>
        )) : <div className="empty-state compact"><Icon name="history" size={26} /><strong>{messages.length ? 'No matching stream activity' : 'No stream activity yet'}</strong><span>{messages.length ? 'Adjust the event type, search, or wait for a new event.' : 'Connect to start the ordered event log.'}</span></div>}
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
