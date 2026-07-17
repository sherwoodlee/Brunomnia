import { describe, expect, it } from 'vitest';
import { createBlankRequest } from '../data/seed';
import { resolveFollowRedirects } from './transport';

describe('resolveFollowRedirects', () => {
  it('inherits the device default in global mode', () => {
    const transport = createBlankRequest('global-redirect').transport;
    expect(resolveFollowRedirects(transport, true)).toBe(true);
    expect(resolveFollowRedirects(transport, false)).toBe(false);
  });

  it('gives explicit request modes precedence', () => {
    const transport = createBlankRequest('redirect-override').transport;
    transport.followRedirectsMode = 'on';
    expect(resolveFollowRedirects(transport, false)).toBe(true);
    transport.followRedirectsMode = 'off';
    expect(resolveFollowRedirects(transport, true)).toBe(false);
  });
});
