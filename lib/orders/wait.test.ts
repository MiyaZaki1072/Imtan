import { describe, expect, it } from 'vitest';
import { effectiveStatus, remainingWaitSeconds, secondsUntil } from './wait';

const now = new Date('2026-10-30T05:00:00Z');

describe('effectiveStatus', () => {
  it('treats an unpaid order past expiry as expired', () => {
    expect(effectiveStatus('awaiting_payment', '2026-10-30T04:59:59Z', now)).toBe('expired');
    expect(effectiveStatus('awaiting_payment', '2026-10-30T05:00:01Z', now)).toBe(
      'awaiting_payment',
    );
  });
  it('never changes a paid order', () => {
    expect(effectiveStatus('queued', '2026-10-30T04:00:00Z', now)).toBe('queued');
  });
});

describe('remainingWaitSeconds', () => {
  const base = { dishesAhead: 3, itemCount: 2, secondsPerItem: 120, startedAt: null };
  it('queued: (dishes ahead + mine) × s/dish', () => {
    expect(remainingWaitSeconds({ ...base, status: 'queued' }, now)).toBe(600);
  });
  it('cooking: my dishes × s/dish − time since start, never below 0', () => {
    const started = '2026-10-30T04:58:00Z'; // 120 s ago
    expect(remainingWaitSeconds({ ...base, status: 'cooking', startedAt: started }, now)).toBe(120);
    expect(
      remainingWaitSeconds({ ...base, status: 'cooking', startedAt: '2026-10-30T04:00:00Z' }, now),
    ).toBe(0);
  });
  it('is null when not waiting', () => {
    expect(remainingWaitSeconds({ ...base, status: 'ready' }, now)).toBeNull();
  });
});

describe('secondsUntil', () => {
  it('corrects for a device clock that is 10 minutes ahead', () => {
    const serverNow = '2026-10-30T05:00:00Z';
    const fetchedAt = new Date('2026-10-30T05:10:00Z').getTime(); // device clock
    const deviceNow = fetchedAt + 30_000;
    expect(secondsUntil('2026-10-30T05:05:00Z', serverNow, deviceNow, fetchedAt)).toBe(270);
  });
});
