import type { StoredStreamSession } from '../types';
import { streamHistorySections } from '../lib/streamHistory';
import { Icon } from './Icon';

export function StreamHistoryControls({
  sessions,
  selectedSessionId,
  activeEnvironmentCount,
  onSelect,
  onDelete,
  onClear,
}: {
  sessions: StoredStreamSession[];
  selectedSessionId: string;
  activeEnvironmentCount: number;
  onSelect: (id: string) => void;
  onDelete: () => void;
  onClear: () => void;
}) {
  const sections = streamHistorySections(sessions);
  return (
    <div className="response-history-controls">
      <label className="response-history-picker"><Icon name="history" size={15} /><select aria-label="Saved stream session" onChange={(event) => onSelect(event.target.value)} value={selectedSessionId}>{sections.map((section) => <optgroup key={section.label} label={section.label}>{section.sessions.map((session) => <option key={session.id} value={session.id}>{new Date(session.startedAt).toLocaleTimeString()} · {session.protocol === 'socketio' ? 'Socket.IO' : session.protocol === 'websocket' ? 'WebSocket' : 'SSE'} · {session.messages.length} events · {session.requestUrl}</option>)}</optgroup>)}</select></label>
      <button aria-label="Delete saved stream session" disabled={!selectedSessionId} onClick={onDelete} type="button"><Icon name="trash" size={14} /></button>
      <button aria-label="Clear stream environment history" disabled={!activeEnvironmentCount} onClick={onClear} type="button">Clear {activeEnvironmentCount}</button>
    </div>
  );
}
