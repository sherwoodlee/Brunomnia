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
