import { describe, expect, it } from 'vitest';
import { integrationSecretInputType } from './IntegrationWorkbench';

describe('integration credential visibility', () => {
  it('masks credentials by default', () => {
    expect(integrationSecretInputType(false, false)).toBe('password');
  });

  it('reveals every credential through the device preference', () => {
    expect(integrationSecretInputType(true, false)).toBe('text');
  });

  it('allows one credential to be revealed without changing the preference', () => {
    expect(integrationSecretInputType(false, true)).toBe('text');
  });
});
