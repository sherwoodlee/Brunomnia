import type { TransportConfig } from '../types';

export const resolveFollowRedirects = (transport: TransportConfig, globalDefault = true) => {
  if (transport.followRedirectsMode === 'on') return true;
  if (transport.followRedirectsMode === 'off') return false;
  return globalDefault;
};
