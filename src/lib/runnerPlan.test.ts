import { describe, expect, it } from 'vitest';
import { runnerPlanSelectionState, toggleRunnerPlanSelection } from './runnerPlan';

describe('Runner request-plan selection', () => {
  it('distinguishes empty, none, partial, and complete selection', () => {
    expect(runnerPlanSelectionState([])).toBe('none');
    expect(runnerPlanSelectionState([{ id: 'one', enabled: false }])).toBe('none');
    expect(runnerPlanSelectionState([{ id: 'one', enabled: true }, { id: 'two', enabled: false }])).toBe('some');
    expect(runnerPlanSelectionState([{ id: 'one', enabled: true }, { id: 'two', enabled: true }])).toBe('all');
  });

  it('unselects every request when all are selected', () => {
    expect(toggleRunnerPlanSelection([{ id: 'one', enabled: true }, { id: 'two', enabled: true }])).toEqual([{ id: 'one', enabled: false }, { id: 'two', enabled: false }]);
  });

  it('selects every request when selection is partial or empty', () => {
    expect(toggleRunnerPlanSelection([{ id: 'one', enabled: true }, { id: 'two', enabled: false }])).toEqual([{ id: 'one', enabled: true }, { id: 'two', enabled: true }]);
    expect(toggleRunnerPlanSelection([{ id: 'one', enabled: false }, { id: 'two', enabled: false }])).toEqual([{ id: 'one', enabled: true }, { id: 'two', enabled: true }]);
    expect(toggleRunnerPlanSelection([])).toEqual([]);
  });
});
