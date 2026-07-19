import { describe, expect, it } from 'vitest';
import { cloneSeedWorkspace } from '../data/seed';
import { clearDeletedUnitTestRequest, createUnitTest, createUnitTestSuite, moveUnitTest, moveUnitTestSuite, orderedTestSuites, unitTestScript } from './unitTests';

describe('standalone unit tests', () => {
  it('creates pinned-shaped suites and tests at the front', () => {
    const first = createUnitTestSuite('suite-one', [], 'First');
    const second = createUnitTestSuite('suite-two', [first], 'Second');
    expect(orderedTestSuites([first, second]).map((suite) => suite.id)).toEqual(['suite-two', 'suite-one']);
    expect(createUnitTest('test-one', [], 'request-one')).toMatchObject({
      id: 'test-one', name: 'Returns 200', requestId: 'request-one', code: expect.stringContaining('await insomnia.send()'),
    });
  });

  it('reorders suites and tests with stable sequential sort keys', () => {
    const suites = [
      { id: 'one', name: 'One', sortKey: 0, tests: [] },
      { id: 'two', name: 'Two', sortKey: 1, tests: [] },
      { id: 'three', name: 'Three', sortKey: 2, tests: [] },
    ];
    expect(moveUnitTestSuite(suites, 'three', 'one', 'before').map((suite) => [suite.id, suite.sortKey])).toEqual([['three', 0], ['one', 1], ['two', 2]]);
    const tests = suites.map((suite) => ({ id: suite.id, name: suite.name, code: '', requestId: null, sortKey: suite.sortKey }));
    expect(moveUnitTest(tests, 'one', 'three', 'after').map((test) => test.id)).toEqual(['two', 'three', 'one']);
  });

  it('wraps code as one async sandbox assertion and clears deleted request references', () => {
    expect(unitTestScript({ name: "It's alive", code: 'const response = await insomnia.send();' })).toContain("insomnia.test(\"It's alive\", async () =>");
    const workspace = cloneSeedWorkspace();
    workspace.testSuites = [{ id: 'suite', name: 'Suite', sortKey: 0, tests: [{ id: 'test', name: 'Test', code: '', requestId: workspace.activeRequestId, sortKey: 0 }] }];
    expect(clearDeletedUnitTestRequest(workspace, workspace.activeRequestId)[0].tests[0].requestId).toBeNull();
  });
});
