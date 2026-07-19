import { describe, expect, it } from 'vitest';
import { closeAllRequestTabs, closeOtherRequestTabs, closeRequestTab, cycleRequestTab, emptyRequestTabState, moveRequestTab, openRequestTab, parseRequestTabState, promoteRequestTab, reconcileRequestTabState, reopenClosedRequestTab } from './requestTabs';

describe('request document tabs', () => {
  it('parses bounded unique tabs and only one temporary tab', () => {
    expect(parseRequestTabState(JSON.stringify({
      tabs: [{ requestId: 'first', temporary: true }, { requestId: 'first' }, { requestId: 'second', temporary: true }],
      activeRequestId: 'second', history: ['first', 'first'], closed: ['third', 'third'],
    }))).toEqual({
      tabs: [{ requestId: 'first', temporary: true }, { requestId: 'second', temporary: false }],
      activeRequestId: 'second', history: ['first'], closed: ['third'], dashboard: false,
    });
    expect(parseRequestTabState('{"tabs":[],"dashboard":true}').dashboard).toBe(true);
    expect(parseRequestTabState('{"tabs":[{"requestId":"first"}],"dashboard":true}').dashboard).toBe(false);
    expect(parseRequestTabState('not json')).toEqual(emptyRequestTabState());
    expect(parseRequestTabState('x'.repeat(1_000_001))).toEqual(emptyRequestTabState());
  });

  it('replaces one temporary tab and promotes explicit tabs', () => {
    const first = openRequestTab(emptyRequestTabState(), 'first');
    expect(first.tabs).toEqual([{ requestId: 'first', temporary: true }]);
    const replaced = openRequestTab(first, 'second');
    expect(replaced.tabs).toEqual([{ requestId: 'second', temporary: true }]);
    const permanent = openRequestTab(replaced, 'third', true);
    expect(permanent.tabs).toEqual([{ requestId: 'second', temporary: true }, { requestId: 'third', temporary: false }]);
    expect(promoteRequestTab(permanent, 'second').tabs[0].temporary).toBe(false);
  });

  it('closes to recent history and reopens the latest valid tab', () => {
    let state = openRequestTab(emptyRequestTabState(), 'first', true);
    state = openRequestTab(state, 'second', true);
    state = openRequestTab(state, 'third', true);
    state = openRequestTab(state, 'first', true);
    const closed = closeRequestTab(state, 'first');
    expect(closed.activeRequestId).toBe('third');
    expect(closed.closed).toEqual(['first']);
    const reopened = reopenClosedRequestTab(closed, ['first', 'second', 'third']);
    expect(reopened.activeRequestId).toBe('first');
    expect(reopened.tabs.at(-1)).toEqual({ requestId: 'first', temporary: false });
  });

  it('closes the final or all tabs to the project dashboard and preserves reopen order', () => {
    const single = openRequestTab(emptyRequestTabState(), 'first', true);
    const closedSingle = closeRequestTab(single, 'first');
    expect(closedSingle).toEqual({ tabs: [], activeRequestId: '', history: [], closed: ['first'], dashboard: true });
    expect(openRequestTab(closedSingle, 'first', true).dashboard).toBe(false);

    let state = openRequestTab(emptyRequestTabState(), 'first', true);
    state = openRequestTab(state, 'second');
    state = openRequestTab(state, 'third', true);
    state = { ...state, closed: ['second', 'older'] };
    const closedAll = closeAllRequestTabs(state);
    expect(closedAll).toEqual({ tabs: [], activeRequestId: '', history: [], closed: ['older', 'first', 'second', 'third'], dashboard: true });
    expect(reopenClosedRequestTab(closedAll, ['first', 'second', 'third']).activeRequestId).toBe('third');
    expect(closeAllRequestTabs(closedAll)).toBe(closedAll);
  });

  it('cycles and reorders tabs without changing temporary state', () => {
    let state = openRequestTab(emptyRequestTabState(), 'first', true);
    state = openRequestTab(state, 'second');
    state = openRequestTab(state, 'third', true);
    expect(cycleRequestTab(state, 'next').activeRequestId).toBe('first');
    expect(cycleRequestTab(state, 'previous').activeRequestId).toBe('second');
    const moved = moveRequestTab(state, 'second', 'third', 'after');
    expect(moved.tabs.map((tab) => tab.requestId)).toEqual(['first', 'third', 'second']);
    expect(moved.tabs.at(-1)?.temporary).toBe(true);
  });

  it('closes every other tab and activates the reserved tab', () => {
    let state = openRequestTab(emptyRequestTabState(), 'first', true);
    state = openRequestTab(state, 'second');
    state = openRequestTab(state, 'third', true);
    const closed = closeOtherRequestTabs(state, 'second');
    expect(closed).toEqual({ tabs: [{ requestId: 'second', temporary: true }], activeRequestId: 'second', history: [], closed: ['first', 'third'], dashboard: false });
    expect(closeOtherRequestTabs(closed, 'missing')).toBe(closed);
    expect(closeOtherRequestTabs(closed, 'second')).toBe(closed);
  });

  it('reconciles deleted tabs, history, closed IDs, and a fallback request', () => {
    const state = {
      tabs: [{ requestId: 'deleted', temporary: true }, { requestId: 'kept', temporary: false }],
      activeRequestId: 'deleted', history: ['kept', 'missing'], closed: ['closed', 'missing'],
      dashboard: false,
    };
    expect(reconcileRequestTabState(state, ['kept', 'closed'], 'kept')).toEqual({
      tabs: [{ requestId: 'kept', temporary: false }], activeRequestId: 'kept', history: [], closed: ['closed'], dashboard: false,
    });
    expect(reconcileRequestTabState(emptyRequestTabState(), ['fallback'], 'fallback').tabs).toEqual([{ requestId: 'fallback', temporary: true }]);
    expect(reconcileRequestTabState({ ...emptyRequestTabState(), dashboard: true, closed: ['closed'] }, ['fallback', 'closed'], 'fallback')).toEqual({
      tabs: [], activeRequestId: '', history: [], closed: ['closed'], dashboard: true,
    });
  });
});
