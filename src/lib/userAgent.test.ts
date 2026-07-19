import { describe, expect, it } from 'vitest';
import type { KeyValue } from '../types';
import { applyDefaultUserAgentHeader, BRUNOMNIA_USER_AGENT, userAgentDisabledAfterHeaderChange } from './userAgent';

const header = (name: string, enabled = true): KeyValue => ({ id: name, name, value: 'custom/1.0', enabled });

describe('default User-Agent policy', () => {
  it('adds the Brunomnia default without mutating authored headers', () => {
    const headers = [header('Accept')];
    const result = applyDefaultUserAgentHeader(headers, false);

    expect(result).toEqual([headers[0], { id: 'default-user-agent', name: 'User-Agent', value: BRUNOMNIA_USER_AGENT, enabled: true }]);
    expect(headers).toHaveLength(1);
  });

  it('never replaces enabled or disabled authored User-Agent rows', () => {
    const enabled = [header('user-agent')];
    const disabled = [header('User-Agent', false)];

    expect(applyDefaultUserAgentHeader(enabled, false)).toBe(enabled);
    expect(applyDefaultUserAgentHeader(disabled, false)).toBe(disabled);
    expect(applyDefaultUserAgentHeader([], true)).toEqual([]);
  });

  it('opts out when the final authored User-Agent row is removed', () => {
    expect(userAgentDisabledAfterHeaderChange([header('User-Agent')], [header('Accept')], false)).toBe(true);
    expect(userAgentDisabledAfterHeaderChange([header('Accept')], [], false)).toBe(false);
    expect(userAgentDisabledAfterHeaderChange([header('User-Agent')], [header('user-agent')], false)).toBe(false);
  });
});
