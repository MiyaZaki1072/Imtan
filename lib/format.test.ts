import { describe, expect, it } from 'vitest';
import { formatBaht, formatClock, waitMinutes } from './format';
import { busyLevel, cookingWaitSeconds, queuedWaitSeconds } from './queue';

describe('format', () => {
  it('shows baht without decimals unless there are satang', () => {
    expect(formatBaht(4500)).toBe('฿45');
    expect(formatBaht(4550)).toBe('฿45.50');
    expect(formatBaht(105000)).toBe('฿1,050');
  });

  it('formats Bangkok 24 h time', () => {
    expect(formatClock('2026-10-30T04:42:00Z')).toBe('11:42');
    expect(formatClock('2026-10-30T13:05:00Z')).toBe('20:05');
  });

  it('rounds waits up to whole minutes', () => {
    expect(waitMinutes(0)).toBe(0);
    expect(waitMinutes(30)).toBe(1);
    expect(waitMinutes(361)).toBe(7);
  });
});

describe('queue', () => {
  it('busy level: ว่าง < 5 min ≤ ปานกลาง ≤ 12 min < แน่น', () => {
    expect(busyLevel(299)).toBe('ว่าง');
    expect(busyLevel(300)).toBe('ปานกลาง');
    expect(busyLevel(720)).toBe('ปานกลาง');
    expect(busyLevel(721)).toBe('แน่น');
  });

  it('counts dishes, not orders', () => {
    expect(queuedWaitSeconds(3, 2, 120)).toBe(600);
    expect(cookingWaitSeconds(2, 120, 100)).toBe(140);
    expect(cookingWaitSeconds(1, 120, 500)).toBe(0);
  });
});
