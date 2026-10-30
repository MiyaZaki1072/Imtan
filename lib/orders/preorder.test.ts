import { describe, expect, it } from 'vitest';
import { checkPickup, earliestPickup, isScheduled, pickupSlots, releaseAt } from './preorder';

const now = new Date('2026-10-30T04:50:00Z'); // 11:50 in Bangkok

describe('releaseAt', () => {
  it('is pickup − (dishes × s/dish) − 3 min, rounded to the minute', () => {
    // pickup 12:05, 2 dishes × 120 s = 4 min, + 3 min lead → start 11:58
    const r = releaseAt(new Date('2026-10-30T05:05:00Z'), 2, 120);
    expect(r.toISOString()).toBe('2026-10-30T04:58:00.000Z');
  });
  it('rounds a fractional result to the nearest minute', () => {
    // 90 s × 1 = 1.5 min + 3 min = 4.5 min → 12:05 − 4.5 = 12:00:30 → 12:01
    const r = releaseAt(new Date('2026-10-30T05:05:00Z'), 1, 90);
    expect(r.toISOString()).toBe('2026-10-30T05:01:00.000Z');
  });
});

describe('earliest pickup and slots', () => {
  it('earliest leaves time to cook, on a 5-minute mark', () => {
    // 11:50 + 2 min cook + 3 + 5 = 12:00
    expect(earliestPickup(now, 1, 120).toISOString()).toBe('2026-10-30T05:00:00.000Z');
    expect(earliestPickup(now, 3, 120).getUTCMinutes() % 5).toBe(0);
  });
  it('offers 10-minute slots, none before the earliest and none past 3 hours', () => {
    const slots = pickupSlots(now, 1, 120, 50);
    expect(slots[0].toISOString()).toBe('2026-10-30T05:00:00.000Z');
    expect(slots[1].getTime() - slots[0].getTime()).toBe(10 * 60_000);
    expect(slots.at(-1)!.getTime()).toBeLessThanOrEqual(now.getTime() + 3 * 3600_000);
    expect(slots.length).toBeLessThan(50);
  });
});

describe('checkPickup', () => {
  it('accepts a slot, rejects too soon, too far and garbage', () => {
    const slot = pickupSlots(now, 1, 120)[2];
    expect(checkPickup(slot, now, 1, 120)).toBe('ok');
    expect(checkPickup(new Date('2026-10-30T04:52:00Z'), now, 1, 120)).toBe('too_soon');
    expect(checkPickup(new Date('2026-10-30T09:00:00Z'), now, 1, 120)).toBe('too_far');
    expect(checkPickup(new Date('nope'), now, 1, 120)).toBe('invalid');
  });
  it('a slot offered a minute ago is still accepted', () => {
    const slot = pickupSlots(now, 1, 120)[0];
    expect(checkPickup(slot, new Date(now.getTime() + 60_000), 1, 120)).toBe('ok');
  });
});

describe('isScheduled', () => {
  it('is true only while release is in the future', () => {
    expect(isScheduled('2026-10-30T05:00:00Z', now)).toBe(true);
    expect(isScheduled('2026-10-30T04:00:00Z', now)).toBe(false);
    expect(isScheduled(null, now)).toBe(false);
  });
});
