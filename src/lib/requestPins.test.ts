import { describe, expect, it } from 'vitest';
import { cloneSeedWorkspace, createBlankRequest } from '../data/seed';
import { parsePinnedRequestIds, pinnedWorkspaceRequests, reconcilePinnedRequestIds, togglePinnedRequestId } from './requestPins';

describe('request pins', () => {
  it('parses bounded unique device-local request IDs safely', () => {
    expect(parsePinnedRequestIds('["first","first",42,"second"]')).toEqual(['first', 'second']);
    expect(parsePinnedRequestIds('{"first":true}')).toEqual([]);
    expect(parsePinnedRequestIds('not json')).toEqual([]);
  });

  it('reconciles and toggles pins only for current workspace requests', () => {
    const workspace = cloneSeedWorkspace();
    const requestIds = workspace.collections.flatMap((collection) => collection.requests.map((request) => request.id));
    expect(reconcilePinnedRequestIds(workspace, [requestIds[0], 'missing', requestIds[0]])).toEqual([requestIds[0]]);
    expect(togglePinnedRequestId(workspace, [], requestIds[1])).toEqual([requestIds[1]]);
    expect(togglePinnedRequestId(workspace, [requestIds[1]], requestIds[1])).toEqual([]);
    expect(togglePinnedRequestId(workspace, [], 'missing')).toEqual([]);
  });

  it('lists pinned requests in persisted collection resource order with filtering', () => {
    const workspace = cloneSeedWorkspace();
    const first = createBlankRequest('first');
    first.name = 'First request';
    first.url = 'https://first.example';
    const second = createBlankRequest('second');
    second.name = 'Second request';
    second.method = 'POST';
    workspace.collections = [{
      id: 'collection', name: 'Collection', expanded: true, requests: [first, second],
      folders: [{ id: 'folder', name: 'Folder', parentId: '', expanded: true, headers: [], environment: [], preRequestScript: '', tests: '', documentation: '' }],
      resourceOrder: ['second', 'folder', 'first'],
    }];
    expect(pinnedWorkspaceRequests(workspace, ['first', 'second']).map(({ request }) => request.id)).toEqual(['second', 'first']);
    expect(pinnedWorkspaceRequests(workspace, ['first', 'second'], 'post').map(({ request }) => request.id)).toEqual(['second']);
  });
});
