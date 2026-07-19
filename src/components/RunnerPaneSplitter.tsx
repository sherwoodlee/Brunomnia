import type { PointerEvent as ReactPointerEvent } from 'react';
import { runnerPaneSizeFromKey, runnerPaneSizeFromPointer, type RunnerPaneDirection } from '../lib/runnerPlan';

type RunnerPaneSplitterProps = {
  direction: RunnerPaneDirection;
  value: number;
  onChange: (value: number) => void;
};

export function RunnerPaneSplitter({ direction, value, onChange }: RunnerPaneSplitterProps) {
  const resizeFromPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const bounds = event.currentTarget.parentElement?.getBoundingClientRect();
    if (bounds) onChange(runnerPaneSizeFromPointer(direction, bounds, event.clientX, event.clientY));
  };
  return <div aria-controls="runner-config-pane runner-results-pane" aria-label="Resize Runner panes" aria-orientation={direction === 'horizontal' ? 'vertical' : 'horizontal'} aria-valuemax={90} aria-valuemin={35} aria-valuenow={Math.round(value)} className="runner-splitter" onKeyDown={(event) => { const next = runnerPaneSizeFromKey(value, direction, event.key, event.shiftKey ? 10 : 2); if (next === value) return; event.preventDefault(); onChange(next); }} onPointerDown={(event) => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={resizeFromPointer} onPointerUp={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }} role="separator" tabIndex={0} title="Drag to resize · Arrow keys adjust · Home/End set limits" />;
}
