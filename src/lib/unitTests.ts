import type { UnitTest, UnitTestSuite, Workspace } from '../types';

export type UnitTestPlacement = 'before' | 'after';

const nextSortKey = (items: Array<{ sortKey: number }>) => Math.min(0, ...items.map((item) => item.sortKey)) - 1;

const reorder = <Item extends { id: string; sortKey: number }>(items: Item[], id: string, targetId: string, placement: UnitTestPlacement): Item[] => {
  const source = items.find((item) => item.id === id);
  if (!source || id === targetId || !items.some((item) => item.id === targetId)) return items;
  const ordered = [...items].sort((left, right) => left.sortKey - right.sortKey);
  const next = ordered.filter((item) => item.id !== id);
  const targetIndex = next.findIndex((item) => item.id === targetId);
  next.splice(targetIndex + (placement === 'after' ? 1 : 0), 0, source);
  return next.map((item, index) => ({ ...item, sortKey: index }));
};

export const orderedTestSuites = (suites: UnitTestSuite[]) => [...suites].sort((left, right) => left.sortKey - right.sortKey);

export const orderedUnitTests = (tests: UnitTest[]) => [...tests].sort((left, right) => left.sortKey - right.sortKey);

export const createUnitTestSuite = (id: string, suites: UnitTestSuite[], collectionId: string, name = 'New Suite'): UnitTestSuite => ({
  id,
  name,
  collectionId,
  sortKey: nextSortKey(suites),
  tests: [],
});

export const createUnitTest = (id: string, tests: UnitTest[], requestId: string | null, name = 'Returns 200'): UnitTest => ({
  id,
  name,
  requestId,
  sortKey: nextSortKey(tests),
  code: "const response = await insomnia.send();\nexpect(response.status).to.equal(200);\n",
});

export const moveUnitTestSuite = (suites: UnitTestSuite[], id: string, targetId: string, placement: UnitTestPlacement) => reorder(suites, id, targetId, placement);

export const moveUnitTest = (tests: UnitTest[], id: string, targetId: string, placement: UnitTestPlacement) => reorder(tests, id, targetId, placement);

export const unitTestScript = (test: Pick<UnitTest, 'name' | 'code'>) => `insomnia.test(${JSON.stringify(test.name)}, async () => {\n${test.code}\n});`;

export const generateUnitTestCliArtifact = (suites: UnitTestSuite[]) => {
  const lines = [
    'const { expect } = chai;',
    '',
    'beforeEach(() => insomnia.clearActiveRequest());',
    '',
  ];
  orderedTestSuites(suites).forEach((suite, suiteIndex) => {
    if (suiteIndex) lines.push('');
    lines.push(`describe(${JSON.stringify(suite.name)}, () => {`);
    orderedUnitTests(suite.tests).forEach((test, testIndex) => {
      if (testIndex) lines.push('');
      lines.push(`  it(${JSON.stringify(test.name)}, async () => {`);
      if (test.requestId) lines.push(`    insomnia.setActiveRequestId(${JSON.stringify(test.requestId)});`);
      if (test.code) lines.push(...test.code.split(/\r?\n/).map((line) => `    ${line}`));
      lines.push('  });');
    });
    lines.push('});');
  });
  return `${lines.join('\n')}\n`;
};

const idMatches = (id: string, identifier: string) => id === identifier || id.startsWith(identifier);

export const selectUnitTestSuites = (workspace: Workspace, identifier: string): UnitTestSuite[] => {
  const direct = workspace.testSuites.filter((suite) => suite.name === identifier || idMatches(suite.id, identifier));
  if (direct.length === 1) return direct;
  if (direct.length > 1) throw new Error(`Unit test suite identifier '${identifier}' is ambiguous.`);
  const designs = workspace.apiDesigns.filter((candidate) => candidate.name === identifier || idMatches(candidate.id, identifier));
  if (designs.length > 1) throw new Error(`API specification identifier '${identifier}' is ambiguous.`);
  const design = designs[0];
  const collections = workspace.collections.filter((candidate) => candidate.name === identifier || idMatches(candidate.id, identifier));
  if (!design && collections.length > 1) throw new Error(`Collection identifier '${identifier}' is ambiguous.`);
  const collection = collections[0]
    ?? workspace.collections.find((candidate) => candidate.id === design?.generatedCollectionId);
  return collection ? orderedTestSuites(workspace.testSuites.filter((suite) => suite.collectionId === collection.id)) : [];
};

export const moveUnitTestSuiteToCollection = (suite: UnitTestSuite, collectionId: string, requestIds: Set<string>): UnitTestSuite => ({
  ...suite,
  collectionId,
  tests: suite.tests.map((test) => test.requestId && !requestIds.has(test.requestId) ? { ...test, requestId: null } : test),
});

export const clearDeletedUnitTestRequest = (workspace: Workspace, requestId: string): UnitTestSuite[] => workspace.testSuites.map((suite) => ({
  ...suite,
  tests: suite.tests.map((test) => test.requestId === requestId ? { ...test, requestId: null } : test),
}));
