import { describe, expect, it } from 'vitest';
import { createBlankRequest } from '../data/seed';
import { resolveCertificateValidation, resolveFollowRedirects, resolveRequestTimeout } from './transport';

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

describe('resolveRequestTimeout', () => {
  it('inherits the device timeout, including disabled timeouts', () => {
    const transport = createBlankRequest('global-timeout').transport;
    expect(resolveRequestTimeout(transport, 12_345)).toBe(12_345);
    expect(resolveRequestTimeout(transport, 0)).toBe(0);
  });

  it('gives an explicit request timeout precedence without mutating it', () => {
    const transport = createBlankRequest('custom-timeout').transport;
    transport.timeoutMode = 'custom';
    transport.timeoutMs = 4_321;
    expect(resolveRequestTimeout(transport, 30_000)).toBe(4_321);
    expect(transport.timeoutMs).toBe(4_321);
  });
});

describe('resolveCertificateValidation', () => {
  it('inherits the device validation preference in global mode', () => {
    const transport = createBlankRequest('global-certificates').transport;
    expect(resolveCertificateValidation(transport, true)).toBe(true);
    expect(resolveCertificateValidation(transport, false)).toBe(false);
  });

  it('gives explicit request modes precedence', () => {
    const transport = createBlankRequest('certificate-override').transport;
    transport.validateCertificatesMode = 'on';
    expect(resolveCertificateValidation(transport, false)).toBe(true);
    transport.validateCertificatesMode = 'off';
    expect(resolveCertificateValidation(transport, true)).toBe(false);
  });
});
