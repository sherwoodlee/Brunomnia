import { describe, expect, it } from 'vitest';
import { cloneSeedWorkspace } from '../data/seed';
import { clearDeletedUnitTestRequest, createUnitTest, createUnitTestSuite, generateUnitTestCliArtifact, moveUnitTest, moveUnitTestSuite, moveUnitTestSuiteToCollection, orderedTestSuites, selectUnitTestSuites, unitTestScript } from './unitTests';

describe('standalone unit tests', () => {
  it('creates pinned-shaped suites and tests at the front', () => {
    const first = createUnitTestSuite('suite-one', [], 'collection-one', 'First');
    const second = createUnitTestSuite('suite-two', [first], 'collection-one', 'Second');
    expect(orderedTestSuites([first, second]).map((suite) => suite.id)).toEqual(['suite-two', 'suite-one']);
    expect(createUnitTest('test-one', [], 'request-one')).toMatchObject({
      id: 'test-one', name: 'Returns 200', requestId: 'request-one', code: expect.stringContaining('await insomnia.send()'),
    });
  });

  it('reorders suites and tests with stable sequential sort keys', () => {
    const suites = [
      { id: 'one', name: 'One', collectionId: 'collection', sortKey: 0, tests: [] },
      { id: 'two', name: 'Two', collectionId: 'collection', sortKey: 1, tests: [] },
      { id: 'three', name: 'Three', collectionId: 'collection', sortKey: 2, tests: [] },
    ];
    expect(moveUnitTestSuite(suites, 'three', 'one', 'before').map((suite) => [suite.id, suite.sortKey])).toEqual([['three', 0], ['one', 1], ['two', 2]]);
    const tests = suites.map((suite) => ({ id: suite.id, name: suite.name, code: '', requestId: null, sortKey: suite.sortKey }));
    expect(moveUnitTest(tests, 'one', 'three', 'after').map((test) => test.id)).toEqual(['two', 'three', 'one']);
  });

  it('wraps code as one async sandbox assertion and clears deleted request references', () => {
    expect(unitTestScript({ name: "It's alive", code: 'const response = await insomnia.send();' })).toContain("insomnia.test(\"It's alive\", async () =>");
    const workspace = cloneSeedWorkspace();
    workspace.testSuites = [{ id: 'suite', name: 'Suite', collectionId: workspace.collections[0].id, sortKey: 0, tests: [{ id: 'test', name: 'Test', code: '', requestId: workspace.activeRequestId, sortKey: 0 }] }];
    expect(clearDeletedUnitTestRequest(workspace, workspace.activeRequestId)[0].tests[0].requestId).toBeNull();
    expect(moveUnitTestSuiteToCollection(workspace.testSuites[0], workspace.collections[1].id, new Set(workspace.collections[1].requests.map((request) => request.id))).tests[0].requestId).toBeNull();
  });

  it('selects one suite directly or every ordered suite owned by an API specification', () => {
    const workspace = cloneSeedWorkspace();
    const collectionId = workspace.collections[0].id;
    workspace.apiDesigns[0].generatedCollectionId = collectionId;
    workspace.testSuites = [
      { id: 'suite-later', name: 'Later', collectionId, sortKey: 2, tests: [] },
      { id: 'suite-first', name: 'First', collectionId, sortKey: 1, tests: [] },
    ];
    expect(selectUnitTestSuites(workspace, 'suite-f')).toEqual([expect.objectContaining({ id: 'suite-first' })]);
    expect(selectUnitTestSuites(workspace, workspace.apiDesigns[0].id).map((suite) => suite.id)).toEqual(['suite-first', 'suite-later']);
  });

  it('generates a sorted source-shaped retained CLI test artifact', () => {
    const artifact = generateUnitTestCliArtifact([
      { id: 'suite-later', name: 'Later', collectionId: 'collection', sortKey: 2, tests: [] },
      { id: 'suite-first', name: 'First "suite"', collectionId: 'collection', sortKey: 1, tests: [
        { id: 'test-later', name: 'Later', requestId: null, sortKey: 2, code: '' },
        { id: 'test-first', name: 'First', requestId: 'request-one', sortKey: 1, code: 'const response = await insomnia.send();\nexpect(response.status).to.equal(200);' },
      ] },
    ]);
    expect(artifact).toContain('describe("First \\"suite\\"", () => {');
    expect(artifact).toContain('insomnia.setActiveRequestId("request-one");');
    expect(artifact).toContain('    expect(response.status).to.equal(200);');
    expect(artifact.indexOf('describe("First')).toBeLessThan(artifact.indexOf('describe("Later'));
    expect(artifact.indexOf('it("First"')).toBeLessThan(artifact.indexOf('it("Later"'));
    expect(artifact.endsWith('\n')).toBe(true);
  });
});
