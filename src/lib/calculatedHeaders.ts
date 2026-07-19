import type { ApiRequest, KeyValue } from '../types';
import { BRUNOMNIA_USER_AGENT, hasAuthoredUserAgentHeader } from './userAgent';

export const DEFAULT_ACCEPT_HEADER = '*/*';

export type CalculatedHeader = KeyValue & { canDisable: boolean };

const isHeaderNamed = (header: Pick<KeyValue, 'name'>, name: string) => header.name.toLowerCase() === name;

export const applyDefaultAcceptHeader = (headers: KeyValue[]): KeyValue[] => {
  if (headers.some((header) => header.enabled && isHeaderNamed(header, 'accept'))) return headers;
  return [...headers, { id: 'default-accept', name: 'Accept', value: DEFAULT_ACCEPT_HEADER, enabled: true }];
};

export const calculatedRequestHeaders = (request: Pick<ApiRequest, 'protocol' | 'headers' | 'disableUserAgentHeader'>): CalculatedHeader[] => {
  if (request.protocol === 'grpc') return [];
  const headers: CalculatedHeader[] = request.protocol === 'http' || request.protocol === 'graphql'
    ? [
      { id: 'default-accept', name: 'Accept', value: DEFAULT_ACCEPT_HEADER, enabled: true, description: 'Added automatically', canDisable: false },
      { id: 'calculated-host', name: 'Host', value: '<calculated at runtime>', enabled: true, description: 'Calculated at runtime', canDisable: false },
    ]
    : [];
  if (!hasAuthoredUserAgentHeader(request.headers)) headers.push({ id: 'default-user-agent', name: 'User-Agent', value: BRUNOMNIA_USER_AGENT, enabled: !request.disableUserAgentHeader, description: 'Added automatically', canDisable: true });
  return headers;
};
