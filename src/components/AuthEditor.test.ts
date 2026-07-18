import { describe, expect, it } from 'vitest';
import { authInputType } from './AuthEditor';

describe('authentication password visibility', () => {
  it('masks secret fields by default', () => {
    expect(authInputType(true, false, false)).toBe('password');
  });

  it('reveals every secret when the device preference is enabled', () => {
    expect(authInputType(true, true, false)).toBe('text');
  });

  it('allows a single field to be revealed without changing the preference', () => {
    expect(authInputType(true, false, true)).toBe('text');
    expect(authInputType(false, false, false)).toBe('text');
  });
});
