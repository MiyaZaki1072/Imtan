import { describe, expect, it } from 'vitest';
import { bangkokDay, computeSummary, lastSevenDays, type SummaryOrder } from './summary';

const order = (o: Partial<SummaryOrder> & { id: string; created_at: string }): SummaryOrder => ({
  source: 'app',
  status: 'picked_up',
  item_count: 1,
  total_satang: 5000,
  paid_at: null,
  queued_at: null,
  ready_at: null,
  ...o,
});

describe('vendor summary', () => {
  it('uses Bangkok days, including the midnight boundary', () => {
    expect(bangkokDay('2026-11-04T16:59:59Z')).toBe('2026-11-04');
    expect(bangkokDay('2026-11-04T17:00:00Z')).toBe('2026-11-05');
    expect(lastSevenDays('2026-11-05')).toEqual([
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
      '2026-11-03',
      '2026-11-04',
      '2026-11-05',
    ]);
  });

  it('counts paid orders, skips cancelled and unpaid, and leaves quick walk-ins out of sales', () => {
    const rows = [
      order({ id: 'a', created_at: '2026-11-04T17:30:00Z', item_count: 2, total_satang: 9000, paid_at: '2026-11-04T17:30:00Z', ready_at: '2026-11-04T17:36:00Z' }),
      order({ id: 'b', created_at: '2026-11-04T16:30:00Z' }), // 23:30 on the 4th
      order({ id: 'c', created_at: '2026-11-05T01:00:00Z', status: 'cancelled' }),
      order({ id: 'd', created_at: '2026-11-05T01:00:00Z', status: 'expired' }),
      order({ id: 'e', created_at: '2026-11-05T02:00:00Z', source: 'walk_in_quick', total_satang: null, item_count: 3 }),
      order({ id: 'f', created_at: '2026-11-05T02:00:00Z', source: 'simulated' }),
    ];
    const items = [
      { order_id: 'a', menu_name: 'ข้าวผัด', qty: 2 },
      { order_id: 'b', menu_name: 'กะเพรา', qty: 1 },
      { order_id: 'c', menu_name: 'กะเพรา', qty: 5 },
    ];
    const s = computeSummary(rows, items, '2026-11-05', false);
    expect(s.today).toMatchObject({ orders: 2, dishes: 5, salesSatang: 9000, avgWaitSeconds: 360 });
    expect(s.week).toMatchObject({ orders: 3, dishes: 6, salesSatang: 14000 });
    expect(s.quickWalkIns).toBe(1);
    expect(s.topMenus).toEqual([
      { name: 'ข้าวผัด', qty: 2 },
      { name: 'กะเพรา', qty: 1 },
    ]);
    expect(computeSummary(rows, items, '2026-11-05', true).today.orders).toBe(3);
  });
});
