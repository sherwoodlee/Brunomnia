import { describe, expect, it } from 'vitest';
import { HUGE_RESPONSE_BYTES, LARGE_RESPONSE_BYTES, responseSizeBand } from './responseSize';

describe('large response safety', () => {
  it('uses the pinned upstream five and one-hundred MiB boundaries', () => {
    expect(LARGE_RESPONSE_BYTES).toBe(5_242_880);
    expect(HUGE_RESPONSE_BYTES).toBe(104_857_600);
    expect(responseSizeBand(LARGE_RESPONSE_BYTES)).toBe('normal');
    expect(responseSizeBand(LARGE_RESPONSE_BYTES + 1)).toBe('large');
    expect(responseSizeBand(HUGE_RESPONSE_BYTES)).toBe('large');
    expect(responseSizeBand(HUGE_RESPONSE_BYTES + 1)).toBe('huge');
  });

  it('treats invalid and negative evidence as a normal empty size', () => {
    expect(responseSizeBand(Number.NaN)).toBe('normal');
    expect(responseSizeBand(-1)).toBe('normal');
  });
});
