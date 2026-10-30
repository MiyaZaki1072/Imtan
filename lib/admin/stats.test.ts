import { describe, expect, it } from 'vitest';
import { computeStats, summarize, type StatRow } from './stats';

const t = (min: number) => new Date(Date.UTC(2026, 9, 30, 4, min)).toISOString();
const row = (over: Partial<StatRow>): StatRow => ({
  shop_id: 's1',
  source: 'app',
  status: 'picked_up',
  paid_at: null,
  queued_at: null,
  started_at: null,
  ready_at: null,
  picked_up_at: null,
  picked_up_by: null,
  estimated_wait_seconds: null,
  feedback: null,
  ...over,
});

describe('summarize', () => {
  it('average, median and p90', () => {
    const s = summarize([10, 20, 30, 40, 100]);
    expect(s).toMatchObject({ n: 5, avg: 40, median: 30 });
    expect(s.p90).toBeCloseTo(76);
  });
  it('is empty-safe', () => {
    expect(summarize([])).toEqual({ n: 0, avg: null, median: null, p90: null });
  });
});

describe('computeStats', () => {
  const shops = [
    { id: 's1', name: 'ร้าน 1' },
    { id: 's2', name: 'ร้าน 2' },
  ];
  const rows: StatRow[] = [
    // served: paid 0, queued 0, started +2 min, ready +5 min, picked up +6 min; estimate 240 s
    row({
      paid_at: t(0),
      queued_at: t(0),
      started_at: t(2),
      ready_at: t(5),
      picked_up_at: t(6),
      picked_up_by: 'vendor',
      estimated_wait_seconds: 240,
      feedback: 'slower',
    }),
    // served, closed by the customer, estimate 360 s, actual 300 s
    row({
      paid_at: t(10),
      queued_at: t(10),
      started_at: t(11),
      ready_at: t(15),
      picked_up_at: t(18),
      picked_up_by: 'customer',
      estimated_wait_seconds: 360,
      feedback: 'accurate',
    }),
    row({ status: 'expired' }),
    row({ status: 'abandoned' }),
    row({ status: 'awaiting_payment' }),
    row({ status: 'cancelled', paid_at: t(20), queued_at: t(20) }),
    // not an app order: counts for delays, not for the payment funnel or feedback
    row({
      source: 'walk_in_quick',
      queued_at: t(30),
      started_at: t(31),
      ready_at: t(33),
      picked_up_at: t(40),
      picked_up_by: 'auto',
    }),
    row({
      shop_id: 's2',
      paid_at: t(50),
      queued_at: t(50),
      started_at: t(51),
      ready_at: t(52),
      picked_up_at: t(53),
      picked_up_by: 'vendor',
      estimated_wait_seconds: 60,
    }),
  ];
  const { overall, shops: per } = computeStats(rows, shops);
  const s1 = per[0];

  it('counts the payment funnel for app orders only', () => {
    expect(s1.funnel).toEqual({
      created: 6,
      paid: 3,
      expired: 1,
      abandoned: 1,
      awaitingPayment: 1,
      cancelled: 1,
      conversion: 0.5,
    });
    expect(overall.funnel.created).toBe(7);
  });
  it('measures vendor tap delays in seconds', () => {
    expect(s1.startDelay.avg).toBe((120 + 60 + 60) / 3); // app 2 min, app 1 min, walk-in 1 min
    expect(s1.cook.n).toBe(3);
    expect(s1.pickupDelay.n).toBe(2); // the auto-closed walk-in is not a vendor/customer delay
    expect(s1.pickupDelay.avg).toBe((60 + 180) / 2);
    expect(s1.autoClosed).toBe(1);
  });
  it('compares the real wait with the estimate (positive = app promised too little)', () => {
    expect(s1.actualWait.avg).toBe((300 + 300) / 2);
    expect(s1.estimateError.avg).toBe((300 - 240 + (300 - 360)) / 2);
    expect(s1.estimateError.n).toBe(2);
  });
  it('tallies feedback', () => {
    expect(s1.feedback).toEqual({ faster: 0, accurate: 1, slower: 1, total: 2 });
    expect(overall.feedback.total).toBe(2);
  });
  it('keeps shops apart and handles a shop with no orders', () => {
    expect(per[1].funnel.created).toBe(1);
    const none = computeStats([], shops).shops[0];
    expect(none.funnel.conversion).toBeNull();
    expect(none.actualWait.avg).toBeNull();
  });
});
