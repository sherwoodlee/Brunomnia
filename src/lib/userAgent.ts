import type { KeyValue } from '../types';

export const BRUNOMNIA_USER_AGENT = 'brunomnia/0.1.0';

export const isUserAgentHeader = (header: Pick<KeyValue, 'name'>) => header.name.toLowerCase() === 'user-agent';

export const hasAuthoredUserAgentHeader = (headers: Array<Pick<KeyValue, 'name'>>) => headers.some(isUserAgentHeader);

export const applyDefaultUserAgentHeader = (headers: KeyValue[], disableUserAgentHeader: boolean): KeyValue[] => {
  if (disableUserAgentHeader || hasAuthoredUserAgentHeader(headers)) return headers;
  return [...headers, { id: 'default-user-agent', name: 'User-Agent', value: BRUNOMNIA_USER_AGENT, enabled: true }];
};

export const userAgentDisabledAfterHeaderChange = (
  currentHeaders: Array<Pick<KeyValue, 'name'>>,
  nextHeaders: Array<Pick<KeyValue, 'name'>>,
  currentValue: boolean,
) => hasAuthoredUserAgentHeader(currentHeaders) && !hasAuthoredUserAgentHeader(nextHeaders) ? true : currentValue;
