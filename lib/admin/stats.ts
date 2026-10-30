// Research stats for the admin (PLAN.md Phase 9): how many orders were paid vs expired vs
// abandoned, how long vendors take to tap, how accurate the wait estimate was, and what
// customers said. Pure functions over order rows, so the numbers are easy to check.

export interface StatRow {
  shop_id: string;
  source: 'app' | 'walk_in_quick' | 'walk_in_full' | 'simulated';
  status: string;
  paid_at: string | null;
  queued_at: string | null;
  started_at: string | null;
  ready_at: string | null;
  picked_up_at: string | null;
  picked_up_by: string | null;
  estimated_wait_seconds: number | null;
  feedback: 'faster' | 'accurate' | 'slower' | null;
}

export interface Summary {
  n: number;
  avg: number | null;
  median: number | null;
  p90: number | null;
}

export interface Funnel {
  /** Every app order that was created (paid or not). */
  created: number;
  paid: number;
  expired: number;
  abandoned: number;
  /** Still waiting for payment inside its 5 minutes. */
  awaitingPayment: number;
  /** Paid, then cancelled by the shop (refund simulated). */
  cancelled: number;
  /** paid ÷ created, or null with no orders. */
  conversion: number | null;
}

export interface ShopStats {
  shopId: string;
  name: string;
  funnel: Funnel;
  /** Seconds from "in queue" to the vendor tapping เริ่มทำ. */
  startDelay: Summary;
  /** Seconds from เริ่มทำ to เสร็จแล้ว. */
  cook: Summary;
  /** Seconds from เสร็จแล้ว to the order being closed by the vendor or the customer. */
  pickupDelay: Summary;
  /** Orders that nobody closed and the system closed after 30 minutes. */
  autoClosed: number;
  /** Seconds from paid to ready. */
  actualWait: Summary;
  /** actual − estimate, seconds: positive means the app promised too little. */
  estimateError: Summary;
  feedback: { faster: number; accurate: number; slower: number; total: number };
  /** Orders that reached ready (the base for the delay numbers). */
  served: number;
}

const secs = (from: string | null, to: string | null): number | null => {
  if (!from || !to) return null;
  const d = (Date.parse(to) - Date.parse(from)) / 1000;
  return Number.isFinite(d) ? d : null;
};

export function summarize(values: number[]): Summary {
  if (values.length === 0) return { n: 0, avg: null, median: null, p90: null };
  const v = [...values].sort((a, b) => a - b);
  const at = (q: number) => {
    const pos = (v.length - 1) * q;
    const lo = Math.floor(pos);
    const hi = Math.ceil(pos);
    return v[lo] + (v[hi] - v[lo]) * (pos - lo);
  };
  return {
    n: v.length,
    avg: v.reduce((a, b) => a + b, 0) / v.length,
    median: at(0.5),
    p90: at(0.9),
  };
}

function forRows(shopId: string, name: string, rows: StatRow[]): ShopStats {
  const app = rows.filter((r) => r.source === 'app');
  const paid = app.filter((r) => r.paid_at).length;
  const count = (status: string) => app.filter((r) => r.status === status).length;
  const nonNeg = (xs: (number | null)[]) => xs.filter((x): x is number => x !== null && x >= 0);

  const startDelay = nonNeg(rows.map((r) => secs(r.queued_at, r.started_at)));
  const cook = nonNeg(rows.map((r) => secs(r.started_at, r.ready_at)));
  const closedByPeople = rows.filter(
    (r) => r.picked_up_by === 'vendor' || r.picked_up_by === 'customer',
  );
  const pickupDelay = nonNeg(closedByPeople.map((r) => secs(r.ready_at, r.picked_up_at)));
  const actual = app.map((r) => secs(r.paid_at, r.ready_at));
  const actualWait = nonNeg(actual);
  const errors = app.flatMap((r, i) => {
    const a = actual[i];
    return a !== null && a >= 0 && r.estimated_wait_seconds !== null
      ? [a - r.estimated_wait_seconds]
      : [];
  });

  const fb = { faster: 0, accurate: 0, slower: 0, total: 0 };
  for (const r of app) {
    if (r.feedback) {
      fb[r.feedback]++;
      fb.total++;
    }
  }
  return {
    shopId,
    name,
    funnel: {
      created: app.length,
      paid,
      expired: count('expired'),
      abandoned: count('abandoned'),
      awaitingPayment: count('awaiting_payment'),
      cancelled: count('cancelled'),
      conversion: app.length ? paid / app.length : null,
    },
    startDelay: summarize(startDelay),
    cook: summarize(cook),
    pickupDelay: summarize(pickupDelay),
    autoClosed: rows.filter((r) => r.picked_up_by === 'auto').length,
    actualWait: summarize(actualWait),
    estimateError: summarize(errors),
    feedback: fb,
    served: rows.filter((r) => r.ready_at).length,
  };
}

/** Stats for every shop plus the total over all of them. */
export function computeStats(
  rows: StatRow[],
  shops: { id: string; name: string }[],
): { overall: ShopStats; shops: ShopStats[] } {
  return {
    overall: forRows('all', 'ทุกร้าน', rows),
    shops: shops.map((s) =>
      forRows(
        s.id,
        s.name,
        rows.filter((r) => r.shop_id === s.id),
      ),
    ),
  };
}
