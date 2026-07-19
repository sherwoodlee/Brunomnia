import { normalizeShortcut, shortcutMatches } from './preferences';

export type RunnerPlanItem = { id: string; enabled: boolean };
export type RunnerPaneDirection = 'vertical' | 'horizontal';
export type RunnerResultPane = 'results' | 'history' | 'console';
export type RunnerHistoryDeleteDecision = { confirmed: boolean; pendingId: string };

export const runnerPlanSelectionState = (plan: RunnerPlanItem[]): 'all' | 'some' | 'none' => {
  if (!plan.length || plan.every((item) => !item.enabled)) return 'none';
  return plan.every((item) => item.enabled) ? 'all' : 'some';
};

export const toggleRunnerPlanSelection = (plan: RunnerPlanItem[]): RunnerPlanItem[] => {
  const enabled = runnerPlanSelectionState(plan) !== 'all';
  return plan.map((item) => ({ ...item, enabled }));
};

export const parseRunnerNumberDraft = (draft: string, minimum: number, maximum: number): number | undefined => {
  if (draft === '') return undefined;
  const value = Number.parseInt(draft, 10);
  return Number.isFinite(value) && value >= minimum && value <= maximum ? value : undefined;
};

export const runnerShortcutLabel = (shortcut: string) => normalizeShortcut(shortcut).replace('Mod', '⌘/Ctrl');

export const runnerShortcutShouldStart = (event: KeyboardEvent, shortcut: string, canStart: boolean) =>
  canStart && !event.repeat && shortcutMatches(event, shortcut);

export const runnerLayoutDirection = (forceVerticalLayout: boolean): RunnerPaneDirection =>
  forceVerticalLayout ? 'vertical' : 'horizontal';

export const activeRunnerResultPane = (selectedPane: RunnerResultPane, isRunning: boolean): RunnerResultPane =>
  isRunning ? 'results' : selectedPane;

export const runnerHistoryDeleteDecision = (pendingId: string, clickedId: string): RunnerHistoryDeleteDecision =>
  pendingId === clickedId ? { confirmed: true, pendingId: '' } : { confirmed: false, pendingId: clickedId };

export const clampRunnerPaneSize = (size: number) => Math.max(35, Math.min(90, Number.isFinite(size) ? size : 35));

export const runnerPaneSizeFromPointer = (
  direction: RunnerPaneDirection,
  bounds: Pick<DOMRect, 'height' | 'left' | 'top' | 'width'>,
  clientX: number,
  clientY: number,
) => {
  const total = direction === 'horizontal' ? bounds.width : bounds.height;
  if (!Number.isFinite(total) || total <= 0) return 35;
  const offset = direction === 'horizontal' ? clientX - bounds.left : clientY - bounds.top;
  return clampRunnerPaneSize((offset / total) * 100);
};

export const runnerPaneSizeFromKey = (size: number, direction: RunnerPaneDirection, key: string, step = 2) => {
  if (key === 'Home') return 35;
  if (key === 'End') return 90;
  if (key === (direction === 'horizontal' ? 'ArrowLeft' : 'ArrowUp')) return clampRunnerPaneSize(size - step);
  if (key === (direction === 'horizontal' ? 'ArrowRight' : 'ArrowDown')) return clampRunnerPaneSize(size + step);
  return clampRunnerPaneSize(size);
};
