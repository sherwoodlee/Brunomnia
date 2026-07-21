import { runnerShortcutLabel } from '../lib/runnerPlan';
import { Icon } from './Icon';

export function RunnerResultsEmptyState({ hasSavedReport, shortcut }: { hasSavedReport: boolean; shortcut: string | readonly string[] }) {
  return (
    <div className="empty-state compact">
      <Icon name="history" size={28} />
      <strong>{hasSavedReport ? 'No results from this run' : 'Run results will appear here'}</strong>
      {hasSavedReport
        ? <span>Add test cases in scripts and run them to see results.</span>
        : <span>Select requests and press <kbd>{runnerShortcutLabel(shortcut)}</kbd> to run</span>}
    </div>
  );
}
