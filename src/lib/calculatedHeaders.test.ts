import { describe, expect, it } from 'vitest';
import { createBlankRequest } from '../data/seed';
import type { KeyValue } from '../types';
import { applyDefaultAcceptHeader, calculatedRequestHeaders, DEFAULT_ACCEPT_HEADER } from './calculatedHeaders';

const accept = (enabled = true): KeyValue => ({ id: 'accept', name: 'accept', value: 'application/json', enabled });

describe('calculated request headers', () => {
  it('adds the HTTP Accept default only without an enabled authored row', () => {
    const headers: KeyValue[] = [];
    expect(applyDefaultAcceptHeader(headers)).toEqual([{ id: 'default-accept', name: 'Accept', value: DEFAULT_ACCEPT_HEADER, enabled: true }]);
    expect(headers).toEqual([]);

    const enabled = [accept()];
    expect(applyDefaultAcceptHeader(enabled)).toBe(enabled);
    const empty = [{ ...accept(), value: '' }];
    expect(applyDefaultAcceptHeader(empty)).toBe(empty);
    expect(applyDefaultAcceptHeader([accept(false)])).toEqual([accept(false), { id: 'default-accept', name: 'Accept', value: '*/*', enabled: true }]);
  });

  it('describes regular-editor HTTP rows and the request-level User-Agent toggle', () => {
    const request = createBlankRequest('calculated-http');
    request.headers = [];
    expect(calculatedRequestHeaders(request)).toEqual([
      expect.objectContaining({ name: 'Accept', value: '*/*', canDisable: false }),
      expect.objectContaining({ name: 'Host', value: '<calculated at runtime>', canDisable: false }),
      expect.objectContaining({ name: 'User-Agent', value: 'brunomnia/0.1.0', enabled: true, canDisable: true }),
    ]);

    request.disableUserAgentHeader = true;
    expect(calculatedRequestHeaders(request).at(-1)).toMatchObject({ name: 'User-Agent', enabled: false });
    request.headers = [{ id: 'agent', name: 'user-agent', value: 'custom/1.0', enabled: false }];
    expect(calculatedRequestHeaders(request).map((header) => header.name)).toEqual(['Accept', 'Host']);
  });

  it('keeps non-HTTP protocols limited to supported calculated rows', () => {
    const request = createBlankRequest('calculated-protocol');
    request.headers = [];
    request.protocol = 'websocket';
    expect(calculatedRequestHeaders(request).map((header) => header.name)).toEqual(['User-Agent']);
    request.protocol = 'grpc';
    expect(calculatedRequestHeaders(request)).toEqual([]);
  });
});
