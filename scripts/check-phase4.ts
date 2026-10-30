// npm run check:phase4 — PLAN.md Phase 4 "Accept" checks against the hosted project.
// Creates throwaway users and orders at one shop and deletes them at the end.
// The expiry check waits for the real pg_cron job (up to ~100 s).

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '../lib/database.types';
import { shopUuid } from '../lib/demo-data/seed-sql';

type Db = SupabaseClient<Database>;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const svc: Db = createClient<Database>(url, serviceKey, opts);
const anon = (): Db => createClient<Database>(url, anonKey, opts);

const SLUG = 'namtok';
const shopId = shopUuid(SLUG);
const results: { name: string; ok: boolean; detail: string }[] = [];
const check = (name: string, ok: boolean, detail = '') => results.push({ name, ok, detail });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const cleanup = { users: [] as string[], orders: [] as string[] };

async function guest(name: string) {
  const c = anon();
  const { data, error } = await c.auth.signInAnonymously({
    options: { data: { display_name: name } },
  });
  if (error || !data.user) throw error ?? new Error('guest sign-in failed');
  cleanup.users.push(data.user.id);
  return { c, id: data.user.id };
}

async function order(customerId: string, menuId: string, qty: number, unit = 5000) {
  const { data, error } = await svc.rpc('insert_order', {
    p_shop_id: shopId,
    p_customer_id: customerId,
    p_customer_name: 'ทดสอบ',
    p_source: 'app',
    p_total_satang: unit * qty,
    p_items: [
      {
        menu_id: menuId,
        menu_name: 'ทดสอบ',
        selections: {},
        kitchen_summary: 'ทดสอบ',
        note: null,
        qty,
        unit_price_satang: unit,
        line_total_satang: unit * qty,
      },
    ] as unknown as Json,
  });
  if (error || !data) throw error ?? new Error('insert_order failed');
  cleanup.orders.push(data.id);
  return data;
}

async function shopStats() {
  const { data } = await svc
    .from('shops')
    .select(
      'items_in_queue, est_wait_seconds, busy_level, manual_seconds_per_item, wait_mode, learned_seconds_per_item',
    )
    .eq('id', shopId)
    .single();
  return data!;
}

async function main() {
  const { data: menuRow } = await svc
    .from('menus')
    .select('id')
    .eq('shop_id', shopId)
    .limit(1)
    .single();
  const menuId = menuRow!.id;
  const a = await guest('ทดสอบ 4A');
  const b = await guest('ทดสอบ 4B');

  // A queue number appears only after demo payment.
  const o1 = await order(a.id, menuId, 2);
  check(
    'new app order: awaiting_payment, no queue number',
    o1.status === 'awaiting_payment' && o1.queue_no === null && o1.paid_at === null,
    `${o1.status} ${o1.queue_no}`,
  );
  const { data: board1 } = await svc
    .from('orders')
    .select('id')
    .eq('id', o1.id)
    .in('status', ['queued', 'cooking']);
  check('unpaid order is not in the queue', board1?.length === 0);
  const { data: paid } = await svc.rpc('confirm_payment', { p_order_id: o1.id, p_method: 'demo' });
  check(
    'after demo payment: queued with number and label',
    paid?.status === 'queued' && paid.queue_no !== null && !!paid.queue_label?.startsWith('น้ำตก-'),
    `${paid?.status} ${paid?.queue_label}`,
  );
  const again = await svc.rpc('confirm_payment', { p_order_id: o1.id, p_method: 'demo' });
  check(
    'paying twice is harmless (same number)',
    again.data?.queue_no === paid?.queue_no,
    `${again.data?.queue_no} vs ${paid?.queue_no}`,
  );

  // Wait is counted in dishes, not orders.
  await sleep(500);
  const s = await shopStats();
  const spi =
    s.wait_mode === 'manual'
      ? s.manual_seconds_per_item
      : (s.learned_seconds_per_item ?? s.manual_seconds_per_item);
  check(
    'shop stats count dishes (2 dishes in 1 order)',
    s.items_in_queue === 2 && s.est_wait_seconds === 2 * spi,
    `items ${s.items_in_queue}, wait ${s.est_wait_seconds}, s/dish ${spi}`,
  );

  // Home on a second phone updates within 2 s: Realtime on `shops`.
  const watcher = anon();
  let firedAt = 0;
  const ready = new Promise<void>((resolve) => {
    watcher
      .channel('check-phase4-shops')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'shops', filter: `id=eq.${shopId}` },
        () => {
          if (!firedAt) firedAt = Date.now();
        },
      )
      .subscribe((status) => status === 'SUBSCRIBED' && resolve());
  });
  await Promise.race([ready, sleep(8000)]);
  const o2 = await order(b.id, menuId, 3);
  const t0 = Date.now();
  await svc.rpc('confirm_payment', { p_order_id: o2.id, p_method: 'demo' });
  for (let i = 0; i < 40 && !firedAt; i++) await sleep(100);
  await watcher.removeAllChannels();
  check(
    'Home gets a shop update within 2 s of a payment',
    firedAt > 0 && firedAt - t0 < 2000,
    firedAt ? `${firedAt - t0} ms` : 'no event',
  );
  const s2 = await shopStats();
  check('stats now 5 dishes (2 + 3)', s2.items_in_queue === 5, `${s2.items_in_queue}`);

  // Customer functions: ownership.
  const o3 = await order(a.id, menuId, 1);
  const wrong = await b.c.rpc('abandon_order', { p_order_id: o3.id });
  check(
    "another customer cannot abandon someone else's order",
    !!wrong.error,
    wrong.error?.message ?? 'no error',
  );
  const right = await a.c.rpc('abandon_order', { p_order_id: o3.id });
  const { data: o3row } = await svc.from('orders').select('status').eq('id', o3.id).single();
  check(
    'owner can abandon an unpaid order',
    !right.error && o3row?.status === 'abandoned',
    right.error?.message ?? o3row?.status,
  );
  const early = await a.c.rpc('mark_received', { p_order_id: paid!.id });
  check('cannot mark received before ready', !!early.error, early.error?.message ?? 'no error');
  await svc.rpc('vendor_set_order_status', {
    p_shop_id: shopId,
    p_order_id: paid!.id,
    p_status: 'ready',
  });
  const fb = await a.c.rpc('submit_feedback', { p_order_id: paid!.id, p_feedback: 'accurate' });
  check('feedback opens at ready', !fb.error, fb.error?.message);
  const recv = await a.c.rpc('mark_received', { p_order_id: paid!.id });
  const { data: pu } = await svc
    .from('orders')
    .select('status, picked_up_by')
    .eq('id', paid!.id)
    .single();
  check(
    'owner marks received → picked_up by customer',
    !recv.error && pu?.status === 'picked_up' && pu.picked_up_by === 'customer',
    JSON.stringify(pu),
  );

  // An unpaid order past its 5 minutes expires via the real pg_cron job, never gets a number.
  const o4 = await order(b.id, menuId, 1);
  await svc
    .from('orders')
    .update({ payment_expires_at: new Date(Date.now() - 60_000).toISOString() })
    .eq('id', o4.id);
  let status = 'awaiting_payment';
  let waited = 0;
  while (waited < 100_000) {
    const { data } = await svc.from('orders').select('status').eq('id', o4.id).single();
    status = data!.status;
    if (status !== 'awaiting_payment') break;
    await sleep(5000);
    waited += 5000;
  }
  const { data: o4row } = await svc
    .from('orders')
    .select('status, queue_no, queue_label')
    .eq('id', o4.id)
    .single();
  check(
    `unpaid order expires via pg_cron within ~1 min (${Math.round(waited / 1000)} s)`,
    o4row?.status === 'expired',
    JSON.stringify(o4row),
  );
  check(
    'expired order never got a queue number',
    o4row?.queue_no === null && o4row?.queue_label === null,
  );
  const late = await svc.rpc('confirm_payment', { p_order_id: o4.id, p_method: 'demo' });
  check(
    'paying an expired order does not queue it',
    !late.data || (late.data.status !== 'queued' && late.data.queue_no === null),
    `${late.data?.status} ${late.error?.message ?? ''}`,
  );
}

async function clean() {
  if (cleanup.orders.length) {
    await svc.from('events').delete().in('order_id', cleanup.orders);
    await svc.from('orders').delete().in('id', cleanup.orders);
  }
  const { data: day } = await svc.rpc('current_day');
  const { count } = await svc
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('shop_id', shopId)
    .eq('day', day as string);
  if (count === 0)
    await svc
      .from('shop_daily_counters')
      .delete()
      .eq('shop_id', shopId)
      .eq('day', day as string);
  for (const id of cleanup.users) await svc.auth.admin.deleteUser(id);
  await svc.rpc('refresh_shop_stats', { p_shop_id: shopId });
}

main()
  .catch((e) => check('script ran without error', false, String(e?.message ?? e)))
  .finally(async () => {
    await clean().catch((e) => console.error('cleanup failed:', e));
    for (const r of results)
      console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.ok ? '' : `  (${r.detail})`}`);
    const failed = results.filter((r) => !r.ok).length;
    console.log(`\n${results.length - failed}/${results.length} passed`);
    process.exit(failed ? 1 : 0);
  });
