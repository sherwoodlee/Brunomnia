import type { ApiRequest } from '../types';
import { CodeEditor } from './ProtocolEditors';
import { Icon } from './Icon';

type SocketIoEditorProps = {
  request: ApiRequest;
  onChange: (patch: Partial<ApiRequest>) => void;
  onListenerToggle: (eventName: string, enabled: boolean) => void;
};

export function SocketIoEditor({ request, onChange, onListenerToggle }: SocketIoEditorProps) {
  const socketIo = request.socketIo;
  const update = (patch: Partial<ApiRequest['socketIo']>) => onChange({ socketIo: { ...socketIo, ...patch } });
  const updateArg = (id: string, patch: Partial<ApiRequest['socketIo']['args'][number]>) => update({ args: socketIo.args.map((arg) => arg.id === id ? { ...arg, ...patch } : arg) });
  const updateListener = (id: string, patch: Partial<ApiRequest['socketIo']['eventListeners'][number]>) => {
    const current = socketIo.eventListeners.find((listener) => listener.id === id);
    if (!current) return;
    const next = { ...current, ...patch };
    if (patch.eventName !== undefined && current.enabled) {
      onListenerToggle(current.eventName, false);
      next.enabled = false;
    } else if (patch.enabled !== undefined && current.eventName.trim()) {
      onListenerToggle(current.eventName, patch.enabled);
    }
    update({ eventListeners: socketIo.eventListeners.map((listener) => listener.id === id ? next : listener) });
  };
  const removeListener = (id: string) => {
    const listener = socketIo.eventListeners.find((candidate) => candidate.id === id);
    if (listener?.enabled && listener.eventName.trim()) onListenerToggle(listener.eventName, false);
    update({ eventListeners: socketIo.eventListeners.filter((candidate) => candidate.id !== id) });
  };

  return (
    <div className="stream-setup">
      <div className="empty-state compact"><span className="protocol-glyph socketio">IO</span><strong>Socket.IO event session</strong><span>Connect, emit ordered arguments, request acknowledgements, and listen to named events.</span></div>
      <div className="socketio-settings">
        <section className="socketio-connection-settings"><header><strong>Connection</strong><small>The URL path selects a namespace; this setting selects the Engine.IO handshake path.</small></header><label>Handshake path<input aria-label="Socket.IO handshake path" value={socketIo.path} onChange={(event) => update({ path: event.target.value })} placeholder="/socket.io" /></label></section>
        <section className="socketio-payload-settings">
          <header><div><strong>Event payload</strong><small>JSON arguments parse to typed values; invalid JSON falls back to text.</small></div><button onClick={() => update({ args: [...socketIo.args, { id: `socketio-arg-${crypto.randomUUID()}`, value: '', mode: 'json' }] })} type="button"><Icon name="plus" size={13} /> Add argument</button></header>
          <div className="socketio-event-line"><label>Event name<input aria-label="Socket.IO event name" value={socketIo.eventName} onChange={(event) => update({ eventName: event.target.value })} placeholder="message" /></label><label className="socketio-ack"><input checked={socketIo.ack} onChange={(event) => update({ ack: event.target.checked })} type="checkbox" /> Request acknowledgement</label></div>
          <div className="socketio-args">{socketIo.args.map((arg, index) => <article key={arg.id}><header><strong>Arg {index + 1}</strong><select aria-label={`Socket.IO argument ${index + 1} type`} value={arg.mode} onChange={(event) => updateArg(arg.id, { mode: event.target.value as 'json' | 'text' })}><option value="json">JSON</option><option value="text">Text</option></select><button aria-label={`Remove Socket.IO argument ${index + 1}`} onClick={() => update({ args: socketIo.args.filter((candidate) => candidate.id !== arg.id) })} type="button"><Icon name="trash" size={13} /></button></header><CodeEditor ariaLabel={`Socket.IO argument ${index + 1}`} value={arg.value} onChange={(value) => updateArg(arg.id, { value })} /></article>)}{!socketIo.args.length ? <p>No arguments. The event name will be emitted by itself.</p> : null}</div>
        </section>
        <section className="socketio-listener-settings">
          <header><div><strong>Event listeners</strong><small>Enabled unique names begin listening at connect time and can toggle live.</small></div><button onClick={() => update({ eventListeners: [...socketIo.eventListeners, { id: `socketio-listener-${crypto.randomUUID()}`, eventName: '', description: '', enabled: false }] })} type="button"><Icon name="plus" size={13} /> Add listener</button></header>
          <div className="socketio-listeners">{socketIo.eventListeners.map((listener) => {
            const duplicate = Boolean(listener.eventName.trim()) && socketIo.eventListeners.some((candidate) => candidate.id !== listener.id && candidate.eventName === listener.eventName);
            return <article className={duplicate ? 'duplicate' : ''} key={listener.id}><input aria-label="Socket.IO listener event" value={listener.eventName} onChange={(event) => updateListener(listener.id, { eventName: event.target.value })} placeholder="event name" /><label><input checked={listener.enabled} disabled={!listener.eventName.trim() || duplicate} onChange={(event) => updateListener(listener.id, { enabled: event.target.checked })} type="checkbox" /> Listen</label><input aria-label="Socket.IO listener description" value={listener.description} onChange={(event) => updateListener(listener.id, { description: event.target.value })} placeholder={duplicate ? 'Event names must be unique' : 'Description'} /><button aria-label={`Remove ${listener.eventName || 'Socket.IO listener'}`} onClick={() => removeListener(listener.id)} type="button"><Icon name="trash" size={13} /></button></article>;
          })}{!socketIo.eventListeners.length ? <p>No listeners. Add an event name to receive its arguments.</p> : null}</div>
        </section>
      </div>
    </div>
  );
}
