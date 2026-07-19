export type RunnerPlanItem = { id: string; enabled: boolean };

export const runnerPlanSelectionState = (plan: RunnerPlanItem[]): 'all' | 'some' | 'none' => {
  if (!plan.length || plan.every((item) => !item.enabled)) return 'none';
  return plan.every((item) => item.enabled) ? 'all' : 'some';
};

export const toggleRunnerPlanSelection = (plan: RunnerPlanItem[]): RunnerPlanItem[] => {
  const enabled = runnerPlanSelectionState(plan) !== 'all';
  return plan.map((item) => ({ ...item, enabled }));
};
