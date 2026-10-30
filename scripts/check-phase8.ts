// npm run check:phase8 — PLAN.md Phase 8 checks against the hosted project: pre-orders
// (pickup time → release time, not counted until released, released by the minute job),
// history, and reorder. Creates throwaway customers and orders; everything is removed at the end.

import { createClient } from '@supabase/supabase-js';
import type { Session } from '../lib/auth-rules';
import type { Database } from '../lib/database.types';
import { shopUuid } from '../lib/demo-data/seed-sql';
import { availableOptions, defaultSelections, ingredientMap } from '../lib/menu';
import { loadShopBySlug } from '../lib/menu/db';
import { buildOrder } from '../lib/orders/build';
import { getHistory } from '../lib/orders/history';
import { createAppOrder } from '../lib/orders/place';
import { pickupSlots, releaseAt } from '../lib/orders/preorder';
import { reorderFrom } from '../lib/orders/reorder';
import { getOrderView } from '../lib/orders/view';
import { getVendorBoard } from '../lib/vendor/board';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const svc = createClient<Database>(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, opts);
const anon = createClient<Database>(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, opts);

const SHOP = shopUuid('pi-som');
const results: { name: string; ok: boolean; detail: string }[] = [];
const check = (name: string, ok: boolean, detail = '') => results.push({ name, ok, detail });
const cleanup = { users: [] as string[] };

async function guest(name: string): Promise<Session> {
  const { data } = await anon.auth.signInAnonymously({ options: { data: { display_name: name } } });
  cleanup.users.push(data.user!.id);
  return { userId: data.user!.id, displayName: name, role: 'customer', shopId: null };
}

async function main() {
  const loaded = (await loadShopBySlug(svc, 'pi-som'))!;
  const shop = loaded.shop;
  const spi = loaded.stats.secondsPerItem;
  const rice = shop.menus.find((m) => m.name === 'ข้าวราด เลือกโปรตีน')!;
  const protein = rice.groups.find((g) => g.kind === 'tiered')!;
  const chicken = protein.options.find((o) => o.name === 'ไก่กรอบ')!;
  const sel = {
    ...defaultSelections(rice, ingredientMap(shop.ingredients)),
    [protein.id]: [chicken.id],
  };
  const lines = [{ menuId: rice.id, selections: sel, qty: 2, note: '' }];
  const dishes = 2;
  const alice = await guest('ทดสอบ 8A');
  const bob = await guest('ทดสอบ 8B');

  const statsBefore = (await svc.from('shops').select('items_in_queue').eq('id', SHOP).single())
    .data!.items_in_queue;

  // 1. Pre-order: pickup → release_at = pickup − dishes × s/dish − 3 min, rounded to the minute.
  const now = new Date();
  const slot = pickupSlots(now, dishes, spi)[3];
  const placed = await createAppOrder(
    alice,
    { shopSlug: 'pi-som', lines, allergyNote: '', pickupAt: slot.toISOString() },
    now,
  );
  if (!placed.ok) throw new Error(`pre-order failed: ${placed.error}`);
  const expectedRelease = releaseAt(slot, dishes, spi);
  const { data: paid } = await svc.rpc('confirm_payment', {
    p_order_id: placed.orderId,
    p_method: 'demo',
  });
  check(
    'pre-order: paid, numbered, release_at = pickup − (2 dishes × s/dish) − 3 min',
    paid?.status === 'queued' &&
      !!paid.queue_label &&
      new Date(paid.pickup_at!).getTime() === slot.getTime() &&
      new Date(paid.release_at!).getTime() === expectedRelease.getTime() &&
      new Date(paid.queued_at!).getTime() >= expectedRelease.getTime(),
    JSON.stringify({
      pickup: paid?.pickup_at,
      release: paid?.release_at,
      expected: expectedRelease.toISOString(),
      queued_at: paid?.queued_at,
    }),
  );

  // 2. Not in the queue yet: no stats, nobody waits behind it.
  await svc.rpc('refresh_shop_stats', { p_shop_id: SHOP });
  const statsHeld = (await svc.from('shops').select('items_in_queue').eq('id', SHOP).single()).data!
    .items_in_queue;
  check(
    'pre-order is not counted in the shop queue before release',
    statsHeld === statsBefore,
    `${statsBefore} → ${statsHeld}`,
  );
  const builtBob = buildOrder(shop, lines, '');
  if (!builtBob.ok) throw new Error('bob build');
  const bobOrder = await createAppOrder(bob, { shopSlug: 'pi-som', lines, allergyNote: '' });
  if (!bobOrder.ok) throw new Error('bob order');
  await svc.rpc('confirm_payment', { p_order_id: bobOrder.orderId, p_method: 'demo' });
  const bobView = await getOrderView(bobOrder.orderId, bob.userId);
  const aliceView = await getOrderView(placed.orderId, alice.userId);
  check(
    'a walk-up order is not queued behind the unreleased pre-order',
    bobView?.dishesAhead === 0,
    `${bobView?.dishesAhead}`,
  );
  check(
    'order view reports pickup and release times for the pre-order',
    !!aliceView?.pickupAt &&
      !!aliceView.releaseAt &&
      aliceView.status === 'queued' &&
      new Date(aliceView.releaseAt).getTime() > Date.now(),
  );

  // 3. The vendor board sees it as a scheduled order.
  const board = await getVendorBoard(SHOP);
  const onBoard = board?.orders.find((o) => o.id === placed.orderId);
  check(
    'vendor board gets the pre-order with its pickup and release times',
    !!onBoard?.pickupAt &&
      !!onBoard.releaseAt &&
      new Date(onBoard.releaseAt).getTime() > Date.now(),
  );

  // 4. Released by the minute job once release_at has passed.
  await svc
    .from('orders')
    .update({ release_at: new Date(Date.now() - 60_000).toISOString() })
    .eq('id', placed.orderId);
  await svc.rpc('cron_tick');
  const statsReleased = (await svc.from('shops').select('items_in_queue').eq('id', SHOP).single())
    .data!.items_in_queue;
  check(
    'after release the minute job counts its 2 dishes in the queue',
    statsReleased === statsBefore + dishes + dishes /* bob's 2 + alice's 2 */,
    `${statsBefore} → ${statsReleased}`,
  );

  // 5. Bad pickup times are refused.
  const soon = await createAppOrder(alice, {
    shopSlug: 'pi-som',
    lines,
    allergyNote: '',
    pickupAt: new Date(Date.now() + 2 * 60_000).toISOString(),
  });
  const far = await createAppOrder(alice, {
    shopSlug: 'pi-som',
    lines,
    allergyNote: '',
    pickupAt: new Date(Date.now() + 5 * 3600_000).toISOString(),
  });
  const junk = await createAppOrder(alice, {
    shopSlug: 'pi-som',
    lines,
    allergyNote: '',
    pickupAt: 'ไม่ใช่เวลา',
  });
  check(
    'pickup too soon / too far / invalid are refused',
    !soon.ok &&
      soon.error === 'pickup_too_soon' &&
      !far.ok &&
      far.error === 'pickup_too_far' &&
      !junk.ok &&
      junk.error === 'pickup_invalid',
    JSON.stringify([soon, far, junk]),
  );

  // 6. History: finished orders only, with items and the real wait.
  for (const id of [placed.orderId]) {
    await svc.rpc('vendor_set_order_status', {
      p_shop_id: SHOP,
      p_order_id: id,
      p_status: 'ready',
    });
    await svc.rpc('vendor_set_order_status', {
      p_shop_id: SHOP,
      p_order_id: id,
      p_status: 'picked_up',
    });
  }
  const history = await getHistory(alice.userId);
  check(
    'history lists the received order with its dishes and real wait; not open orders',
    history.length === 1 &&
      history[0].orderId === placed.orderId &&
      history[0].items.length === 1 &&
      history[0].actualWaitSeconds !== null &&
      history[0].shopSlug === 'pi-som',
    JSON.stringify(history),
  );
  const bobHistory = await getHistory(bob.userId);
  check('history is private and skips orders still in progress', bobHistory.length === 0);

  // 7. Reorder: same dish and choices back in the cart, minus what is no longer available.
  const again = await reorderFrom(alice.userId, placed.orderId);
  const rebuilt = again.ok ? buildOrder(shop, again.lines, '') : null;
  check(
    'reorder: the same line comes back, and it prices through the normal path',
    again.ok &&
      again.lines.length === 1 &&
      again.dropped.length === 0 &&
      again.lines[0].qty === 2 &&
      !!rebuilt?.ok &&
      rebuilt.totalSatang === 2 * 5000,
    JSON.stringify(again),
  );
  const crispy = shop.ingredients.find((i) => i.name === 'ไก่กรอบ')!;
  await svc.from('ingredients').update({ is_available: false }).eq('id', crispy.id);
  const dropped = await reorderFrom(alice.userId, placed.orderId);
  await svc.from('ingredients').update({ is_available: true }).eq('id', crispy.id);
  check(
    'reorder: a line whose choice is sold out is dropped and named',
    dropped.ok && dropped.lines.length === 0 && dropped.dropped.length === 1,
    JSON.stringify(dropped),
  );
  const stranger = await reorderFrom(bob.userId, placed.orderId);
  check(
    "reorder: nobody can reorder someone else's order",
    !stranger.ok && stranger.error === 'not_found',
  );
  void availableOptions;
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
  await svc.from('ingredients').update({ is_available: true }).eq('shop_id', SHOP);
  const { data: day } = await svc.rpc('current_day');
  const { count } = await svc
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('shop_id', SHOP)
    .eq('day', day as string);
  if (count === 0)
    await svc
      .from('shop_daily_counters')
      .delete()
      .eq('shop_id', SHOP)
      .eq('day', day as string);
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
