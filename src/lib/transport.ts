import type { TransportConfig } from '../types';

export const resolveFollowRedirects = (transport: TransportConfig, globalDefault = true) => {
  if (transport.followRedirectsMode === 'on') return true;
  if (transport.followRedirectsMode === 'off') return false;
  return globalDefault;
};

export const normalizeRequestTimeout = (value: unknown, fallback = 30_000) => {
  const numeric = typeof value === 'number' ? value : Number.NaN;
  return Number.isFinite(numeric) ? Math.min(2_147_483_647, Math.max(0, Math.trunc(numeric))) : fallback;
};

export const resolveRequestTimeout = (transport: TransportConfig, globalDefault = 30_000) => (
  normalizeRequestTimeout(transport.timeoutMode === 'custom' ? transport.timeoutMs : globalDefault)
);

export const resolveCertificateValidation = (transport: TransportConfig, globalDefault = true) => {
  if (transport.validateCertificatesMode === 'on') return true;
  if (transport.validateCertificatesMode === 'off') return false;
  return globalDefault;
};

export type ProxyPreferences = {
  enabled: boolean;
  httpProxy: string;
  httpsProxy: string;
  noProxy: string;
};

export const resolveProxyTransport = (transport: TransportConfig, requestUrl: string, preferences: ProxyPreferences = { enabled: false, httpProxy: '', httpsProxy: '', noProxy: '' }) => {
  if (transport.proxyMode === 'custom') {
    const proxyUrl = transport.proxyUrl.trim();
    return proxyUrl
      ? { proxyMode: 'custom' as const, proxyUrl, proxyExclusions: transport.proxyExclusions.trim() }
      : { proxyMode: 'disabled' as const, proxyUrl: '', proxyExclusions: '' };
  }
  if (transport.proxyMode === 'disabled') return { proxyMode: 'disabled' as const, proxyUrl: '', proxyExclusions: '' };
  if (!preferences.enabled) return { proxyMode: 'system' as const, proxyUrl: '', proxyExclusions: '' };
  let protocol = '';
  try { protocol = new URL(requestUrl).protocol; } catch { /* URL validation reports the actionable error later. */ }
  const proxyUrl = (protocol === 'http:' ? preferences.httpProxy : preferences.httpsProxy).trim();
  return proxyUrl
    ? { proxyMode: 'custom' as const, proxyUrl, proxyExclusions: preferences.noProxy.trim() }
    : { proxyMode: 'disabled' as const, proxyUrl: '', proxyExclusions: '' };
};
