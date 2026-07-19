import { describe, expect, it } from 'vitest';
import { parseRunnerNumberDraft, runnerPlanSelectionState, runnerShortcutLabel, runnerShortcutShouldStart, toggleRunnerPlanSelection } from './runnerPlan';

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

  it('keeps blank, invalid, and out-of-range number drafts out of execution state', () => {
    expect(parseRunnerNumberDraft('', 1, 1_000)).toBeUndefined();
    expect(parseRunnerNumberDraft('invalid', 1, 1_000)).toBeUndefined();
    expect(parseRunnerNumberDraft('0', 1, 1_000)).toBeUndefined();
    expect(parseRunnerNumberDraft('1001', 1, 1_000)).toBeUndefined();
    expect(parseRunnerNumberDraft('4.9', 1, 1_000)).toBe(4);
    expect(parseRunnerNumberDraft('42', 1, 1_000)).toBe(42);
  });

  it('uses the configured Send shortcut only for runnable non-repeat events', () => {
    const event = { key: 'Enter', metaKey: true, ctrlKey: false, altKey: false, shiftKey: false, repeat: false } as KeyboardEvent;
    expect(runnerShortcutShouldStart(event, 'Mod+Enter', true)).toBe(true);
    expect(runnerShortcutShouldStart(event, 'Mod+Enter', false)).toBe(false);
    expect(runnerShortcutShouldStart({ ...event, repeat: true } as KeyboardEvent, 'Mod+Enter', true)).toBe(false);
    expect(runnerShortcutShouldStart(event, 'Mod+Shift+Enter', true)).toBe(false);
    expect(runnerShortcutLabel(' mod + Enter ')).toBe('⌘/Ctrl+Enter');
  });
});
