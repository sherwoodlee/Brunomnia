import { describe, expect, it } from 'vitest';
import { closeAllRequestTabs, closeOtherRequestTabs, closeRequestTab, cycleRequestTab, emptyRequestTabState, moveRequestTab, openDocumentTab, openRequestTab, parseRequestTabState, promoteRequestTab, reconcileRequestTabState, reopenClosedDocumentTab, reopenClosedRequestTab } from './requestTabs';

describe('request document tabs', () => {
  it('parses bounded unique tabs and only one temporary tab', () => {
    expect(parseRequestTabState(JSON.stringify({
      tabs: [{ requestId: 'first', temporary: true }, { requestId: 'first' }, { requestId: 'second', temporary: true }],
      activeRequestId: 'second', history: ['first', 'first'], closed: ['third', 'third'],
    }))).toEqual({
      tabs: [{ requestId: 'first', type: 'request', temporary: true }, { requestId: 'second', type: 'request', temporary: false }],
      activeRequestId: 'second', history: ['first'], closed: ['third'], dashboard: false,
    });
    expect(parseRequestTabState('{"tabs":[],"dashboard":true}').dashboard).toBe(true);
    expect(parseRequestTabState('{"tabs":[{"requestId":"first"}],"dashboard":true}').dashboard).toBe(false);
    expect(parseRequestTabState('not json')).toEqual(emptyRequestTabState());
    expect(parseRequestTabState('x'.repeat(1_000_001))).toEqual(emptyRequestTabState());
  });

  it('replaces one temporary tab and promotes explicit tabs', () => {
    const first = openRequestTab(emptyRequestTabState(), 'first');
    expect(first.tabs).toEqual([{ requestId: 'first', type: 'request', temporary: true }]);
    const replaced = openRequestTab(first, 'second');
    expect(replaced.tabs).toEqual([{ requestId: 'second', type: 'request', temporary: true }]);
    const permanent = openRequestTab(replaced, 'third', true);
    expect(permanent.tabs).toEqual([{ requestId: 'second', type: 'request', temporary: true }, { requestId: 'third', type: 'request', temporary: false }]);
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
    expect(reopened.tabs.at(-1)).toEqual({ requestId: 'first', type: 'request', temporary: false });
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
    expect(closed).toEqual({ tabs: [{ requestId: 'second', type: 'request', temporary: true }], activeRequestId: 'second', history: [], closed: ['first', 'third'], dashboard: false });
    expect(closeOtherRequestTabs(closed, 'missing')).toBe(closed);
    expect(closeOtherRequestTabs(closed, 'second')).toBe(closed);
  });

  it('reconciles deleted tabs, history, closed IDs, and a fallback request', () => {
    const state = {
      tabs: [{ requestId: 'deleted', type: 'request' as const, temporary: true }, { requestId: 'kept', type: 'request' as const, temporary: false }],
      activeRequestId: 'deleted', history: ['kept', 'missing'], closed: ['closed', 'missing'],
      dashboard: false,
    };
    expect(reconcileRequestTabState(state, ['kept', 'closed'], 'kept')).toEqual({
      tabs: [{ requestId: 'kept', type: 'request', temporary: false }], activeRequestId: 'kept', history: [], closed: ['closed'], dashboard: false,
    });
    expect(reconcileRequestTabState(emptyRequestTabState(), ['fallback'], 'fallback').tabs).toEqual([{ requestId: 'fallback', type: 'request', temporary: true }]);
    expect(reconcileRequestTabState({ ...emptyRequestTabState(), dashboard: true, closed: ['closed'] }, ['fallback', 'closed'], 'fallback')).toEqual({
      tabs: [], activeRequestId: '', history: [], closed: ['closed'], dashboard: true,
    });
  });

  it('shares temporary, ordering, close, and reopen behavior with folder documents', () => {
    let state = openRequestTab(emptyRequestTabState(), 'request', true);
    state = openDocumentTab(state, 'folder', 'folder');
    expect(state.tabs).toEqual([
      { requestId: 'request', type: 'request', temporary: false },
      { requestId: 'folder', type: 'folder', temporary: true },
    ]);
    state = openRequestTab(state, 'replacement');
    expect(state.tabs.at(-1)).toEqual({ requestId: 'replacement', type: 'request', temporary: true });
    state = openDocumentTab(state, 'folder', 'folder', true);
    expect(parseRequestTabState(JSON.stringify(state)).tabs.at(-1)).toEqual({ requestId: 'folder', type: 'folder', temporary: false });
    const closed = closeRequestTab(state, 'folder');
    const reopened = reopenClosedDocumentTab(closed, [
      { id: 'request', type: 'request' },
      { id: 'replacement', type: 'request' },
      { id: 'folder', type: 'folder' },
    ]);
    expect(reopened.tabs.at(-1)).toEqual({ requestId: 'folder', type: 'folder', temporary: false });
    expect(reconcileRequestTabState(reopened, [{ id: 'request', type: 'request' }, { id: 'folder', type: 'folder' }]).tabs.map((tab) => tab.requestId)).toEqual(['request', 'folder']);
  });

  it('persists synthetic runner tabs in the shared document lifecycle', () => {
    let state = openDocumentTab(emptyRequestTabState(), 'runner_workspace', 'runner');
    expect(parseRequestTabState(JSON.stringify(state)).tabs).toEqual([{ requestId: 'runner_workspace', type: 'runner', temporary: true }]);
    state = promoteRequestTab(state, 'runner_workspace');
    state = openDocumentTab(state, 'runner_folder', 'runner');
    const reconciled = reconcileRequestTabState(state, [
      { id: 'runner_workspace', type: 'runner' },
      { id: 'runner_folder', type: 'runner' },
    ]);
    expect(reconciled.tabs).toEqual([
      { requestId: 'runner_workspace', type: 'runner', temporary: false },
      { requestId: 'runner_folder', type: 'runner', temporary: true },
    ]);
    expect(reopenClosedDocumentTab(closeRequestTab(reconciled, 'runner_folder'), [{ id: 'runner_folder', type: 'runner' }]).tabs.at(-1)).toEqual({ requestId: 'runner_folder', type: 'runner', temporary: false });
  });

  it('persists the environment workspace in the shared document lifecycle', () => {
    let state = openRequestTab(emptyRequestTabState(), 'request', true);
    state = openDocumentTab(state, 'environment_workspace', 'environment');
    expect(parseRequestTabState(JSON.stringify(state)).tabs.at(-1)).toEqual({ requestId: 'environment_workspace', type: 'environment', temporary: true });
    const closed = closeRequestTab(state, 'environment_workspace');
    expect(reopenClosedDocumentTab(closed, [
      { id: 'request', type: 'request' },
      { id: 'environment_workspace', type: 'environment' },
    ]).tabs.at(-1)).toEqual({ requestId: 'environment_workspace', type: 'environment', temporary: false });
  });

  it('persists API design documents in the shared document lifecycle', () => {
    let state = openDocumentTab(emptyRequestTabState(), 'design_one', 'document');
    state = promoteRequestTab(state, 'design_one');
    state = openDocumentTab(state, 'design_two', 'document');
    const parsed = parseRequestTabState(JSON.stringify(state));
    expect(parsed.tabs).toEqual([
      { requestId: 'design_one', type: 'document', temporary: false },
      { requestId: 'design_two', type: 'document', temporary: true },
    ]);
    expect(reconcileRequestTabState(parsed, [{ id: 'design_two', type: 'document' }]).tabs).toEqual([{ requestId: 'design_two', type: 'document', temporary: true }]);
  });

  it('persists mock servers and routes and reconciles deleted routes', () => {
    let state = openDocumentTab(emptyRequestTabState(), 'mock_server', 'mockServer', true);
    state = openDocumentTab(state, 'mock_route', 'mockRoute');
    expect(parseRequestTabState(JSON.stringify(state)).tabs).toEqual([
      { requestId: 'mock_server', type: 'mockServer', temporary: false },
      { requestId: 'mock_route', type: 'mockRoute', temporary: true },
    ]);
    expect(reconcileRequestTabState(state, [{ id: 'mock_server', type: 'mockServer' }])).toEqual({
      tabs: [{ requestId: 'mock_server', type: 'mockServer', temporary: false }],
      activeRequestId: 'mock_server', history: [], closed: [], dashboard: false,
    });
  });

  it('persists collection workspace documents', () => {
    const state = openDocumentTab(emptyRequestTabState(), 'collection_one', 'collection');
    expect(parseRequestTabState(JSON.stringify(state)).tabs).toEqual([{ requestId: 'collection_one', type: 'collection', temporary: true }]);
    expect(reopenClosedDocumentTab(closeRequestTab(state, 'collection_one'), [{ id: 'collection_one', type: 'collection' }]).tabs).toEqual([{ requestId: 'collection_one', type: 'collection', temporary: false }]);
  });
});
