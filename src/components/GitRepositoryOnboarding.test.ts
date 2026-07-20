import { describe, expect, it } from 'vitest';
import { gitProviderSupportsDiscovery, gitRepositoryScanSummary } from './GitRepositoryOnboarding';

describe('Git repository onboarding helpers', () => {
  it('limits automatic provider discovery to authenticated provider APIs', () => {
    expect(gitProviderSupportsDiscovery('github')).toBe(true);
    expect(gitProviderSupportsDiscovery('gitlab')).toBe(true);
    expect(gitProviderSupportsDiscovery('custom')).toBe(false);
    expect(gitProviderSupportsDiscovery('system')).toBe(false);
  });

  it('formats bounded remote tree scan evidence', () => {
    expect(gitRepositoryScanSummary({ defaultBranch: 'main', branches: ['main'], totalFiles: 50_000, brunomniaFiles: 12, insomniaFiles: 4, specificationFiles: 2, truncated: true })).toEqual([
      '50000+ repository files',
      '12 Brunomnia files',
      '4 Insomnia files',
      '2 API specifications',
    ]);
  });
});
