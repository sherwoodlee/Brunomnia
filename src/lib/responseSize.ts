export const LARGE_RESPONSE_BYTES = 5 * 1024 * 1024;
export const HUGE_RESPONSE_BYTES = 100 * 1024 * 1024;

export type ResponseSizeBand = 'normal' | 'large' | 'huge';

export const responseSizeBand = (bytes: number): ResponseSizeBand => {
  const size = Number.isFinite(bytes) ? Math.max(0, bytes) : 0;
  if (size > HUGE_RESPONSE_BYTES) return 'huge';
  if (size > LARGE_RESPONSE_BYTES) return 'large';
  return 'normal';
};
