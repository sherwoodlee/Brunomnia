import { describe, expect, it } from 'vitest';
import { createBlankRequest } from '../data/seed';
import { resolveCertificateValidation, resolveFollowRedirects, resolveProxyTransport, resolveRequestTimeout } from './transport';

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

describe('resolveProxyTransport', () => {
  it('uses system discovery by default and selects a manual proxy by request protocol', () => {
    const transport = createBlankRequest('global-proxy').transport;
    expect(resolveProxyTransport(transport, 'https://example.test')).toEqual({ proxyMode: 'system', proxyUrl: '', proxyExclusions: '' });
    const preferences = { enabled: true, httpProxy: 'http://http-proxy.test:8080', httpsProxy: 'http://https-proxy.test:8443', noProxy: 'localhost,.internal' };
    expect(resolveProxyTransport(transport, 'http://example.test', preferences)).toEqual({ proxyMode: 'custom', proxyUrl: preferences.httpProxy, proxyExclusions: preferences.noProxy });
    expect(resolveProxyTransport(transport, 'https://example.test', preferences)).toEqual({ proxyMode: 'custom', proxyUrl: preferences.httpsProxy, proxyExclusions: preferences.noProxy });
  });

  it('gives custom and direct request modes precedence', () => {
    const transport = createBlankRequest('proxy-override').transport;
    transport.proxyMode = 'custom';
    transport.proxyUrl = 'http://request-proxy.test:9000';
    transport.proxyExclusions = 'localhost';
    expect(resolveProxyTransport(transport, 'https://example.test', { enabled: false, httpProxy: '', httpsProxy: '', noProxy: '' })).toEqual({ proxyMode: 'custom', proxyUrl: transport.proxyUrl, proxyExclusions: 'localhost' });
    transport.proxyMode = 'disabled';
    expect(resolveProxyTransport(transport, 'https://example.test', { enabled: true, httpProxy: 'http://global', httpsProxy: 'http://global', noProxy: '' })).toEqual({ proxyMode: 'disabled', proxyUrl: '', proxyExclusions: '' });
  });
});
