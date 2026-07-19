import { describe, expect, it } from 'vitest';
import { activeRunnerResultPane, clampRunnerHistoryColumnSize, clampRunnerPaneSize, parseRunnerNumberDraft, reorderRunnerPlan, runnerDraggedRequestIds, runnerHistoryColumnSizeFromKey, runnerHistoryDeleteDecision, runnerLayoutDirection, runnerPaneSizeFromKey, runnerPaneSizeFromPointer, runnerPlanSelectionState, runnerShortcutLabel, runnerShortcutShouldStart, toggleRunnerPlanSelection } from './runnerPlan';

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

  it('drags the selected request set or one unselected request', () => {
    const plan = [{ id: 'one', enabled: true }, { id: 'two', enabled: false }, { id: 'three', enabled: true }];
    expect(runnerDraggedRequestIds(plan, 'one')).toEqual(['one', 'three']);
    expect(runnerDraggedRequestIds(plan, 'two')).toEqual(['two']);
    expect(runnerDraggedRequestIds(plan, 'missing')).toEqual([]);
  });

  it('moves multiple selected requests as one ordered block before or after a target', () => {
    const plan = [{ id: 'one', enabled: true }, { id: 'two', enabled: false }, { id: 'three', enabled: true }, { id: 'four', enabled: false }];
    expect(reorderRunnerPlan(plan, ['one', 'three'], 'four', 'before').map((item) => item.id)).toEqual(['two', 'one', 'three', 'four']);
    expect(reorderRunnerPlan(plan, ['one', 'three'], 'four', 'after').map((item) => item.id)).toEqual(['two', 'four', 'one', 'three']);
    expect(reorderRunnerPlan(plan, ['four'], 'one', 'after').map((item) => item.id)).toEqual(['one', 'four', 'two', 'three']);
  });

  it('ignores invalid or self-contained Runner drops', () => {
    const plan = [{ id: 'one', enabled: true }, { id: 'two', enabled: true }];
    expect(reorderRunnerPlan(plan, [], 'two', 'before')).toBe(plan);
    expect(reorderRunnerPlan(plan, ['missing'], 'two', 'before')).toBe(plan);
    expect(reorderRunnerPlan(plan, ['one', 'two'], 'two', 'after')).toBe(plan);
    expect(reorderRunnerPlan(plan, ['one'], 'missing', 'after')).toBe(plan);
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

  it('maps the forced layout preference to the Runner pane direction', () => {
    expect(runnerLayoutDirection(false)).toBe('horizontal');
    expect(runnerLayoutDirection(true)).toBe('vertical');
  });

  it('forces Results while running and restores the selected inactive pane afterward', () => {
    expect(activeRunnerResultPane('history', true)).toBe('results');
    expect(activeRunnerResultPane('console', true)).toBe('results');
    expect(activeRunnerResultPane('history', false)).toBe('history');
    expect(activeRunnerResultPane('console', false)).toBe('console');
  });

  it('requires a second click on the same Runner history entry before deletion', () => {
    expect(runnerHistoryDeleteDecision('', 'run-one')).toEqual({ confirmed: false, pendingId: 'run-one' });
    expect(runnerHistoryDeleteDecision('run-one', 'run-two')).toEqual({ confirmed: false, pendingId: 'run-two' });
    expect(runnerHistoryDeleteDecision('run-one', 'run-one')).toEqual({ confirmed: true, pendingId: '' });
  });

  it('bounds Runner History columns and supports horizontal keyboard resizing', () => {
    expect(clampRunnerHistoryColumnSize(Number.NaN, 58, 160)).toBe(58);
    expect(clampRunnerHistoryColumnSize(20, 58, 160)).toBe(58);
    expect(clampRunnerHistoryColumnSize(200, 58, 160)).toBe(160);
    expect(runnerHistoryColumnSizeFromKey(100, 'ArrowLeft', 58, 160)).toBe(92);
    expect(runnerHistoryColumnSizeFromKey(100, 'ArrowRight', 58, 160, 24)).toBe(124);
    expect(runnerHistoryColumnSizeFromKey(100, 'Home', 58, 160)).toBe(58);
    expect(runnerHistoryColumnSizeFromKey(100, 'End', 58, 160)).toBe(160);
    expect(runnerHistoryColumnSizeFromKey(100, 'ArrowUp', 58, 160)).toBe(100);
  });

  it('bounds pointer-derived Runner pane sizes in either direction', () => {
    const bounds = { left: 100, top: 50, width: 1_000, height: 800 };
    expect(runnerPaneSizeFromPointer('horizontal', bounds, 600, 0)).toBe(50);
    expect(runnerPaneSizeFromPointer('horizontal', bounds, 200, 0)).toBe(35);
    expect(runnerPaneSizeFromPointer('vertical', bounds, 0, 650)).toBe(75);
    expect(runnerPaneSizeFromPointer('vertical', bounds, 0, 900)).toBe(90);
    expect(clampRunnerPaneSize(Number.NaN)).toBe(35);
  });

  it('resizes the first Runner pane with axis-aware keyboard controls', () => {
    expect(runnerPaneSizeFromKey(50, 'horizontal', 'ArrowLeft')).toBe(48);
    expect(runnerPaneSizeFromKey(50, 'horizontal', 'ArrowRight', 10)).toBe(60);
    expect(runnerPaneSizeFromKey(50, 'vertical', 'ArrowUp')).toBe(48);
    expect(runnerPaneSizeFromKey(50, 'vertical', 'ArrowDown', 10)).toBe(60);
    expect(runnerPaneSizeFromKey(50, 'vertical', 'Home')).toBe(35);
    expect(runnerPaneSizeFromKey(50, 'horizontal', 'End')).toBe(90);
    expect(runnerPaneSizeFromKey(50, 'horizontal', 'Enter')).toBe(50);
  });
});
