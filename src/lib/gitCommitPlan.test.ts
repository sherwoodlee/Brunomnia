import { describe, expect, it } from 'vitest';
import { validateGitCommitPlan } from './gitCommitPlan';

describe('grouped Git commit plans', () => {
  it('preserves reviewed commit and file order', () => {
    expect(validateGitCommitPlan([
      { message: ' feat: add request ', files: ['request.yaml'] },
      { message: 'test: cover request', files: ['request.test.yaml'] },
    ], ['request.yaml', 'request.test.yaml'])).toEqual([
      { message: 'feat: add request', files: ['request.yaml'] },
      { message: 'test: cover request', files: ['request.test.yaml'] },
    ]);
  });

  it('rejects stale and conflicted paths', () => {
    expect(() => validateGitCommitPlan([{ message: 'feat: unsafe', files: ['stale.yaml'] }], ['current.yaml'])).toThrow('stale or conflicted');
  });

  it('rejects duplicate assignment within or across groups', () => {
    expect(() => validateGitCommitPlan([
      { message: 'feat: first', files: ['request.yaml'] },
      { message: 'test: second', files: ['request.yaml'] },
    ], ['request.yaml'])).toThrow('more than one');
    expect(() => validateGitCommitPlan([
      { message: 'feat: duplicate', files: ['request.yaml', 'request.yaml'] },
    ], ['request.yaml'])).toThrow('more than one');
  });

  it('bounds group count, messages, and empty groups', () => {
    expect(() => validateGitCommitPlan([], [])).toThrow('at least one');
    expect(() => validateGitCommitPlan([{ message: '', files: ['request.yaml'] }], ['request.yaml'])).toThrow('needs a message');
    expect(() => validateGitCommitPlan([{ message: 'x'.repeat(201), files: ['request.yaml'] }], ['request.yaml'])).toThrow('200-character');
    expect(() => validateGitCommitPlan(Array.from({ length: 9 }, (_, index) => ({ message: `commit ${index}`, files: [`${index}.yaml`] })), Array.from({ length: 9 }, (_, index) => `${index}.yaml`))).toThrow('at most 8');
  });
});
