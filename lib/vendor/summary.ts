// Shop summary for vendors (PLAN-V2.md Phase 14): today and the last 7 Bangkok days.
// Pure functions over order rows, so the numbers are easy to check. The page loads rows
// only after vendorPageShop() has checked the vendor owns the shop.

import { TIME_ZONE } from '../format';

export interface SummaryOrder {
  id: string;
  source: 'app' | 'walk_in_quick' | 'walk_in_full' | 'simulated';
  status: string;
  created_at: string;
  item_count: number;
  /** Null for quick walk-ins, which have no menu or price. */
  total_satang: number | null;
  paid_at: string | null;
  queued_at: string | null;
  ready_at: string | null;
}

export interface SummaryItem {
  order_id: string;
  menu_name: string;
  qty: number;
}

export interface DayTotals {
  day: string;
  orders: number;
  dishes: number;
  salesSatang: number;
  /** Average seconds from paid (or queued) to ready, null with no data. */
  avgWaitSeconds: number | null;
}

export interface ShopSummary {
  today: DayTotals;
  week: DayTotals;
  days: DayTotals[];
  topMenus: { name: string; qty: number }[];
  /** Quick walk-ins counted in orders/dishes but not in sales (no price). */
  quickWalkIns: number;
}

const COUNTED = new Set(['queued', 'cooking', 'ready', 'picked_up']);

const dayFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** The Bangkok calendar day of a timestamp, `YYYY-MM-DD`. */
export function bangkokDay(iso: string | Date): string {
  return dayFmt.format(typeof iso === 'string' ? new Date(iso) : iso);
}

/** The 7 Bangkok days ending at `today`, oldest first. */
export function lastSevenDays(today: string): string[] {
  const base = Date.parse(`${today}T12:00:00+07:00`);
  return Array.from({ length: 7 }, (_, i) => bangkokDay(new Date(base - (6 - i) * 86_400_000)));
}

function totals(day: string, orders: SummaryOrder[]): DayTotals {
  const waits = orders.flatMap((o) => {
    const from = o.paid_at ?? o.queued_at;
    if (!from || !o.ready_at) return [];
    const s = (Date.parse(o.ready_at) - Date.parse(from)) / 1000;
    return s >= 0 ? [s] : [];
  });
  return {
    day,
    orders: orders.length,
    dishes: orders.reduce((n, o) => n + o.item_count, 0),
    salesSatang: orders.reduce((n, o) => n + (o.total_satang ?? 0), 0),
    avgWaitSeconds: waits.length ? waits.reduce((a, b) => a + b, 0) / waits.length : null,
  };
}

export function computeSummary(
  rows: SummaryOrder[],
  items: SummaryItem[],
  today: string,
  includeSimulated: boolean,
): ShopSummary {
  const days = lastSevenDays(today);
  const inWeek = new Set(days);
  const counted = rows.filter(
    (o) =>
      COUNTED.has(o.status) &&
      (includeSimulated || o.source !== 'simulated') &&
      inWeek.has(bangkokDay(o.created_at)),
  );
  const byDay = days.map((d) =>
    totals(
      d,
      counted.filter((o) => bangkokDay(o.created_at) === d),
    ),
  );

  const ids = new Set(counted.map((o) => o.id));
  const qty = new Map<string, number>();
  for (const it of items) {
    if (!ids.has(it.order_id)) continue;
    qty.set(it.menu_name, (qty.get(it.menu_name) ?? 0) + it.qty);
  }
  const topMenus = [...qty.entries()]
    .map(([name, q]) => ({ name, qty: q }))
    .sort((a, b) => b.qty - a.qty || a.name.localeCompare(b.name))
    .slice(0, 5);

  return {
    today: byDay[byDay.length - 1],
    week: totals('7d', counted),
    days: byDay,
    topMenus,
    quickWalkIns: counted.filter((o) => o.source === 'walk_in_quick').length,
  };
}
