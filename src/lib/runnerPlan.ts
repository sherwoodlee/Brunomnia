import { normalizeShortcut, shortcutMatches } from './preferences';

export type RunnerPlanItem = { id: string; enabled: boolean };

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

export const runnerLayoutDirection = (forceVerticalLayout: boolean): 'vertical' | 'horizontal' =>
  forceVerticalLayout ? 'vertical' : 'horizontal';
