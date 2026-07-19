import { useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { clampRunnerHistoryColumnSize, runnerHistoryColumnSizeFromKey } from '../lib/runnerPlan';

type RunnerHistoryColumnResizerProps = {
  label: string;
  value: number;
  minimum: number;
  maximum: number;
  onChange: (value: number) => void;
};

export function RunnerHistoryColumnResizer({ label, value, minimum, maximum, onChange }: RunnerHistoryColumnResizerProps) {
  const drag = useRef<{ pointerId: number; startX: number; startValue: number } | undefined>(undefined);
  const resizeFromPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    const active = drag.current;
    if (!active || active.pointerId !== event.pointerId || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
    onChange(clampRunnerHistoryColumnSize(active.startValue + event.clientX - active.startX, minimum, maximum));
  };
  return <div aria-controls="runner-history-table" aria-label={`Resize Runner History ${label} column`} aria-orientation="vertical" aria-valuemax={maximum} aria-valuemin={minimum} aria-valuenow={Math.round(value)} className="runner-history-column-resizer" onKeyDown={(event) => { const next = runnerHistoryColumnSizeFromKey(value, event.key, minimum, maximum, event.shiftKey ? 24 : 8); if (next === value) return; event.preventDefault(); onChange(next); }} onPointerDown={(event) => { event.preventDefault(); drag.current = { pointerId: event.pointerId, startX: event.clientX, startValue: value }; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={resizeFromPointer} onPointerUp={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); drag.current = undefined; }} role="separator" tabIndex={0} title="Drag to resize · Arrow keys adjust · Home/End set limits" />;
}
