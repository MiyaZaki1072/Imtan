import { describe, expect, it } from 'vitest';
import { formatWaitRange } from './format';
import { waitRangeMinutes, withinWaitRange } from './queue';

describe('waitRangeMinutes', () => {
  it('turns 6 min into 5–8', () => {
    expect(waitRangeMinutes(360)).toEqual({ low: 5, high: 8 });
    expect(formatWaitRange(360)).toBe('5–8 นาที');
  });

  it('handles 0 s, 30 s and 30 min', () => {
    expect(waitRangeMinutes(0)).toEqual({ low: 1, high: 2 });
    expect(waitRangeMinutes(30)).toEqual({ low: 1, high: 2 });
    expect(waitRangeMinutes(1800)).toEqual({ low: 26, high: 39 });
  });

  it('keeps 1 ≤ low < high for every second up to 1 hour', () => {
    for (let s = 1; s <= 3600; s++) {
      const { low, high } = waitRangeMinutes(s);
      expect(low).toBeGreaterThanOrEqual(1);
      expect(high).toBeGreaterThan(low);
    }
  });

  it('checks whether an actual wait was inside the range', () => {
    expect(withinWaitRange(7 * 60, 360)).toBe(true);
    expect(withinWaitRange(9 * 60, 360)).toBe(false);
  });
});
