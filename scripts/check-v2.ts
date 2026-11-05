// npm run check:v2 — PLAN-V2.md checks against the hosted project: pre-order slot capacity,
// unpaid orders holding a slot, the per-order dish limit, vendor shop isolation, simulate-rush,
// and ratings (Phase 15). Needs the V2 migrations pushed. Throwaway data is removed at the end.

import { createClient } from '@supabase/supabase-js';
import type { Session } from '../lib/auth-rules';
import type { Database } from '../lib/database.types';
import { shopUuid } from '../lib/demo-data/seed-sql';
import { defaultSelections, ingredientMap } from '../lib/menu';
import { loadShopBySlug } from '../lib/menu/db';
import { createAppOrder } from '../lib/orders/place';
import { pickupSlots } from '../lib/orders/preorder';
import { simulateOrder } from '../lib/admin/ops';
import { updateShopSettings } from '../lib/vendor/ops';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const svc = createClient<Database>(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, opts);

const SLUG = 'pi-som';
const SHOP = shopUuid(SLUG);
const OTHER = shopUuid('jae-buek');
const results: { name: string; ok: boolean; detail: string }[] = [];
const check = (name: string, ok: boolean, detail = '') => results.push({ name, ok, detail });
const cleanup = { users: [] as string[], simulated: [] as string[] };

type Guest = Session & { client: ReturnType<typeof createClient<Database>> };

async function guest(name: string): Promise<Guest> {
  const client = createClient<Database>(url, anonKey, opts);
  const { data } = await client.auth.signInAnonymously({
    options: { data: { display_name: name } },
  });
  cleanup.users.push(data.user!.id);
  return { userId: data.user!.id, displayName: name, role: 'customer', shopId: null, client };
}

async function main() {
  const loaded = (await loadShopBySlug(svc, SLUG))!;
  const shop = loaded.shop;
  const dish = shop.menus.find((m) => !m.pairOnly && !m.isDeleted)!;
  const sel = defaultSelections(dish, ingredientMap(shop.ingredients));
  const lines = (qty: number) => [{ menuId: dish.id, selections: sel, qty, note: '' }];
  const capacity = shop.preorderDishesPerSlot ?? 6;
  const now = new Date();
  const slot = pickupSlots(now, 1, loaded.stats.secondsPerItem).at(-1)!;
  const preorder = (p: Session) =>
    createAppOrder(
      p,
      { shopSlug: SLUG, lines: lines(1), allergyNote: '', pickupAt: slot.toISOString() },
      now,
    );

  // 1. 20 parallel one-dish pre-orders on one slot never exceed its capacity.
  const people = await Promise.all(Array.from({ length: 20 }, (_, i) => guest(`ทดสอบ V2-${i}`)));
  const placed = await Promise.all(people.map(preorder));
  const okOrders = placed.filter((r) => r.ok);
  const full = placed.filter((r) => !r.ok && r.error === 'pickup_full').length;
  check(
    `20 parallel pre-orders fill at most ${capacity} dishes`,
    okOrders.length === capacity && full === 20 - capacity,
    `ok=${okOrders.length} full=${full}`,
  );

  // 2. Unpaid orders hold their space; abandoning one frees it.
  const late = await guest('ทดสอบ V2-late');
  const refused = await preorder(late);
  check('an unpaid order holds its slot', !refused.ok && refused.error === 'pickup_full');
  const first = okOrders[0];
  if (first?.ok) await svc.from('orders').update({ status: 'abandoned' }).eq('id', first.orderId);
  const freed = await preorder(late);
  check('abandoning an unpaid order frees its space', freed.ok, JSON.stringify(freed));

  // 3. Over-limit orders are refused on the server, in TS and in SQL.
  const big = await guest('ทดสอบ V2-big');
  const max = shop.maxDishesPerOrder ?? 10;
  const tooMany = await createAppOrder(big, {
    shopSlug: SLUG,
    lines: lines(Math.min(max + 1, 20)),
    allergyNote: '',
  });
  check(
    'an over-limit app order is rejected by the server',
    !tooMany.ok && tooMany.error === 'too_many_dishes',
    JSON.stringify(tooMany),
  );
  const { error: sqlErr } = await svc.rpc('insert_order', {
    p_shop_id: SHOP,
    p_customer_id: big.userId,
    p_customer_name: 'x',
    p_source: 'app',
    p_items: Array.from({ length: max + 1 }, () => ({
      menu_id: dish.id,
      menu_name: 'x',
      selections: {},
      kitchen_summary: 'x',
      note: null,
      qty: 1,
      unit_price_satang: 100,
      line_total_satang: 100,
    })),
    p_total_satang: (max + 1) * 100,
  });
  check(
    'insert_order itself refuses an over-limit app order',
    !!sqlErr?.message.includes('too_many_dishes'),
    sqlErr?.message ?? 'no error',
  );

  // 4. Vendor A can't change shop B's limits.
  const vendorA: Session = { userId: people[0].userId, displayName: 'A', role: 'vendor', shopId: SHOP };
  let blocked = false;
  try {
    const r = await updateShopSettings(vendorA, OTHER, { max_dishes_per_order: 1 });
    blocked = !r.ok;
  } catch {
    blocked = true;
  }
  check("vendor A can't change shop B's limits", blocked);

  // 5. Simulate-rush still works (simulated orders ignore the per-order limit).
  const admin: Session = { userId: people[0].userId, displayName: 'admin', role: 'admin', shopId: null };
  const sim = await simulateOrder(admin, SHOP);
  check('simulate-rush still works', sim.ok, JSON.stringify(sim));
  if (sim.ok) {
    const { data } = await svc
      .from('orders')
      .select('id')
      .eq('shop_id', SHOP)
      .eq('source', 'simulated')
      .eq('queue_label', sim.label);
    cleanup.simulated.push(...(data ?? []).map((o) => o.id));
  }

  // 6. Ratings (Phase 15): only the owner of a picked-up order can rate it.
  const rater = people[1];
  const mine = placed[1];
  if (mine.ok) {
    const rate = (g: Guest, rating: number) =>
      g.client.rpc('submit_rating', { p_order_id: mine.orderId, p_rating: rating, p_comment: '' });
    check('cannot rate an order that is not picked up', !!(await rate(rater, 5)).error);
    await svc
      .from('orders')
      .update({ status: 'picked_up', picked_up_at: new Date().toISOString() })
      .eq('id', mine.orderId);
    check("cannot rate someone else's order", !!(await rate(people[2], 1)).error);
    const own = await rate(rater, 4);
    const { data: row } = await svc
      .from('orders')
      .select('shop_rating')
      .eq('id', mine.orderId)
      .single();
    check('owner can rate a picked-up order', !own.error && row?.shop_rating === 4, own.error?.message);
  }
}

async function clean() {
  for (const id of cleanup.users) {
    const { data: orders } = await svc.from('orders').select('id').eq('customer_id', id);
    const ids = (orders ?? []).map((o) => o.id);
    if (ids.length) {
      await svc.from('events').delete().in('order_id', ids);
      await svc.from('orders').delete().in('id', ids);
    }
    await svc.auth.admin.deleteUser(id);
  }
  if (cleanup.simulated.length) {
    await svc.from('events').delete().in('order_id', cleanup.simulated);
    await svc.from('orders').delete().in('id', cleanup.simulated);
  }
  await svc.rpc('refresh_shop_stats', { p_shop_id: SHOP });
}

main()
  .catch((e) => check('script ran without error', false, String(e?.stack ?? e)))
  .finally(async () => {
    await clean().catch((e) => console.error('cleanup failed:', e));
    for (const r of results)
      console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.ok ? '' : `  (${r.detail})`}`);
    const failed = results.filter((r) => !r.ok).length;
    console.log(`\n${results.length - failed}/${results.length} passed`);
    process.exit(failed ? 1 : 0);
  });
