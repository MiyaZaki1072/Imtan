// npm run check:phase5 — PLAN.md Phase 5 "Accept" checks against the hosted project.
// Runs the real vendor ops (the code behind the server actions) with fabricated sessions,
// so "Vendor A can't change shop B" is tested on the server, not just in the UI.
// Creates a throwaway customer and orders, and restores every value it changes.

import { createClient } from '@supabase/supabase-js';
import type { Database, Json } from '../lib/database.types';
import { AuthError, type Session } from '../lib/auth-rules';
import { shopUuid } from '../lib/demo-data/seed-sql';
import {
  availableOptions,
  defaultSelections,
  ingredientMap,
  type Menu,
  type Shop,
} from '../lib/menu';
import { loadShopBySlug } from '../lib/menu/db';
import { buildOrder } from '../lib/orders/build';
import * as ops from '../lib/vendor/ops';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const svc = createClient<Database>(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const anon = createClient<Database>(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const A = shopUuid('pi-som');
const B = shopUuid('jae-buek');
const vendorA: Session = {
  userId: 'test-vendor-a',
  displayName: 'ร้าน A',
  role: 'vendor',
  shopId: A,
};
const results: { name: string; ok: boolean; detail: string }[] = [];
const check = (name: string, ok: boolean, detail = '') => results.push({ name, ok, detail });
const cleanup = { orders: [] as string[], users: [] as string[] };

async function forbidden(fn: () => Promise<unknown>): Promise<boolean> {
  try {
    await fn();
    return false;
  } catch (e) {
    return e instanceof AuthError && e.reason === 'forbidden';
  }
}

function lineFor(shop: Shop, menuName: string, picks: Record<string, string[]> = {}) {
  const m = shop.menus.find((x) => x.name === menuName) as Menu;
  const ing = ingredientMap(shop.ingredients);
  const sel = defaultSelections(m, ing);
  for (const g of m.groups) {
    if ((sel[g.id]?.length ?? 0) < g.minSelect) {
      sel[g.id] = availableOptions(g, ing)
        .slice(0, g.minSelect)
        .map((o) => o.id);
    }
    if (picks[g.name])
      sel[g.id] = picks[g.name].map((n) => g.options.find((o) => o.name === n)!.id);
  }
  return { menuId: m.id, selections: sel, qty: 1, note: '' };
}

async function main() {
  const shopA = (await loadShopBySlug(svc, 'pi-som'))!.shop;
  const shopB = (await loadShopBySlug(svc, 'jae-buek'))!.shop;
  const bBefore = await svc
    .from('shops')
    .select('name, is_open, queue_prefix')
    .eq('id', B)
    .single();
  const bIng = shopB.ingredients[0];
  const bMenu = shopB.menus[0];
  const bOptionId = bMenu.groups.flatMap((g) => g.options)[0].id;
  const bVariant = shopB.menus.find((m) => m.variants.length)!.variants[0];
  const bVariantMenu = shopB.menus.find((m) => m.variants.length)!;
  const orderIdStub = '00000000-0000-0000-0000-000000000000';

  // 1. Vendor A cannot touch shop B (every op).
  const attempts: [string, () => Promise<unknown>][] = [
    ['setOrderStatus', () => ops.setOrderStatus(vendorA, B, orderIdStub, 'ready')],
    ['recallOrder', () => ops.recallOrder(vendorA, B, orderIdStub)],
    ['addQuickWalkIn', () => ops.addQuickWalkIn(vendorA, B, 1)],
    ['addWalkInOrder', () => ops.addWalkInOrder(vendorA, B, [], '')],
    ['setIngredientAvailable', () => ops.setIngredientAvailable(vendorA, B, bIng.id, false)],
    ['setMenuAvailable', () => ops.setMenuAvailable(vendorA, B, bMenu.id, false)],
    ['setOptionAvailable', () => ops.setOptionAvailable(vendorA, B, bOptionId, false)],
    [
      'savePrices',
      () => ops.savePrices(vendorA, B, [{ kind: 'base', menuId: bMenu.id, satang: 100 }]),
    ],
    ['updateShopSettings', () => ops.updateShopSettings(vendorA, B, { name: 'ถูกแฮก' })],
  ];
  const blocked = await Promise.all(attempts.map(([, fn]) => forbidden(fn)));
  check(
    `vendor A is refused on shop B by all ${attempts.length} server ops`,
    blocked.every(Boolean),
    attempts
      .filter((_, i) => !blocked[i])
      .map(([n]) => n)
      .join(', '),
  );
  const bAfter = await svc.from('shops').select('name, is_open, queue_prefix').eq('id', B).single();
  const bIngAfter = await svc.from('ingredients').select('is_available').eq('id', bIng.id).single();
  check(
    'shop B is unchanged after those attempts',
    JSON.stringify(bBefore.data) === JSON.stringify(bAfter.data) &&
      bIngAfter.data?.is_available === true,
  );

  // ...and own shop id with another shop's rows is rejected too.
  const crossIng = await ops.setIngredientAvailable(vendorA, A, bIng.id, false);
  const crossMenu = await ops.setMenuAvailable(vendorA, A, bMenu.id, false);
  const crossOpt = await ops.setOptionAvailable(vendorA, A, bOptionId, false);
  const crossPrice = await ops.savePrices(vendorA, A, [
    { kind: 'variant', menuId: bVariantMenu.id, optionIds: bVariant.optionIds, satang: 100 },
  ]);
  const bMenuAfter = await svc.from('menus').select('is_available').eq('id', bMenu.id).single();
  check(
    "vendor A cannot reach shop B's rows through shop A's id",
    !crossIng.ok &&
      !crossMenu.ok &&
      !crossOpt.ok &&
      !crossPrice.ok &&
      bMenuAfter.data?.is_available === true,
    JSON.stringify([crossIng, crossMenu, crossOpt, crossPrice]),
  );

  // 2. The board flow, with "เสร็จแล้ว" straight from รอทำ.
  const { data: g } = await anon.auth.signInAnonymously({
    options: { data: { display_name: 'ทดสอบ 5' } },
  });
  const customerId = g.user!.id;
  cleanup.users.push(customerId);
  const buildFrom = (shop: Shop, line: ReturnType<typeof lineFor>) => buildOrder(shop, [line], '');
  const proteinLine = (n: string) => lineFor(shopA, 'ข้าวราด เลือกโปรตีน', { โปรตีน: [n] });
  const built = buildFrom(shopA, proteinLine('ไก่กรอบ'));
  if (!built.ok) throw new Error(`build failed: ${built.error}`);
  const { data: o } = await svc.rpc('insert_order', {
    p_shop_id: A,
    p_customer_id: customerId,
    p_customer_name: 'ทดสอบ',
    p_source: 'app',
    p_items: built.items as unknown as Json,
    p_total_satang: built.totalSatang,
  });
  cleanup.orders.push(o!.id);
  await svc.rpc('confirm_payment', { p_order_id: o!.id, p_method: 'demo' });
  const ready = await ops.setOrderStatus(vendorA, A, o!.id, 'ready');
  const { data: r1 } = await svc
    .from('orders')
    .select('status, started_at, ready_at')
    .eq('id', o!.id)
    .single();
  check(
    'เสร็จแล้ว works straight from รอทำ',
    ready.ok && r1?.status === 'ready' && !!r1.ready_at && r1.started_at === null,
    JSON.stringify(r1),
  );
  const recall = await ops.recallOrder(vendorA, A, o!.id);
  const { data: r2 } = await svc.from('orders').select('last_called_at').eq('id', o!.id).single();
  check('เรียกซ้ำ stamps last_called_at', recall.ok && !!r2?.last_called_at);
  const picked = await ops.setOrderStatus(vendorA, A, o!.id, 'picked_up');
  const bad = await ops.setOrderStatus(vendorA, A, o!.id, 'cooking');
  check(
    'ลูกค้ารับแล้ว closes it; a closed order cannot be reopened',
    picked.ok && !bad.ok && bad.error === 'invalid_transition',
    JSON.stringify(bad),
  );
  const nope = await ops.setOrderStatus(vendorA, A, o!.id, 'queued');
  check('only vendor statuses are accepted', !nope.ok && nope.error === 'bad_status');

  // Cancel + simulated refund.
  const { data: o2 } = await svc.rpc('insert_order', {
    p_shop_id: A,
    p_customer_id: customerId,
    p_customer_name: 'ทดสอบ',
    p_source: 'app',
    p_items: built.items as unknown as Json,
    p_total_satang: built.totalSatang,
  });
  cleanup.orders.push(o2!.id);
  await svc.rpc('confirm_payment', { p_order_id: o2!.id, p_method: 'demo' });
  const cancel = await ops.setOrderStatus(vendorA, A, o2!.id, 'cancelled', 'ร้านยกเลิก');
  const { data: c } = await svc
    .from('orders')
    .select('status, refund_method, cancel_reason')
    .eq('id', o2!.id)
    .single();
  const { data: pay } = await svc.from('payments').select('status').eq('order_id', o2!.id).single();
  check(
    'ยกเลิก + คืนเงิน records a simulated refund',
    cancel.ok &&
      c?.status === 'cancelled' &&
      c.refund_method === 'demo' &&
      pay?.status === 'refunded',
    JSON.stringify({ c, pay }),
  );

  // 3. +1 walk-in updates the shop's stats at once (Home listens to `shops`).
  const before = (await svc.from('shops').select('items_in_queue').eq('id', A).single()).data!
    .items_in_queue;
  const quick = await ops.addQuickWalkIn(vendorA, A, 3);
  const after = (
    await svc.from('shops').select('items_in_queue, est_wait_seconds').eq('id', A).single()
  ).data!;
  if (quick.ok) {
    const { data: q } = await svc
      .from('orders')
      .select('id')
      .eq('shop_id', A)
      .eq('queue_label', quick.label)
      .single();
    cleanup.orders.push(q!.id);
  }
  check(
    '+1 คิวหน้าร้าน (3 dishes) gets a label and counts in stats',
    quick.ok && quick.label.startsWith('ส้ม-') && after.items_in_queue === before + 3,
    `${quick.ok ? quick.label : quick.error} ${before}→${after.items_in_queue}`,
  );
  const badCount = await ops.addQuickWalkIn(vendorA, A, 0);
  check('walk-in dish count is validated', !badCount.ok);

  // 4. Full walk-in form: same pricing as the app, queued at once.
  const wl = lineFor(shopA, 'ข้าวราด เลือกโปรตีน', {
    โปรตีน: ['ไก่กรอบ', 'หมูญี่ปุ่น'],
    ราดเพิ่ม: ['ไข่ข้น'],
  });
  const walk = await ops.addWalkInOrder(vendorA, A, [wl], 'ลูกค้าทดสอบ');
  if (walk.ok) {
    const { data: w } = await svc
      .from('orders')
      .select('id, status, source, customer_id, total_satang')
      .eq('queue_label', walk.label)
      .eq('shop_id', A)
      .single();
    cleanup.orders.push(w!.id);
    check(
      'full walk-in: ฿70 (2 proteins ฿60 + ไข่ข้น ฿10), queued, no customer account',
      walk.totalSatang === 7000 &&
        w?.status === 'queued' &&
        w.source === 'walk_in_full' &&
        w.customer_id === null &&
        w.total_satang === 7000,
      JSON.stringify(w),
    );
  } else check('full walk-in works', false, walk.error);

  // 5. Settings: manual mode, whitelist, validation.
  const man = await ops.updateShopSettings(vendorA, A, {
    wait_mode: 'manual',
    manual_seconds_per_item: 200,
  });
  const st = (
    await svc
      .from('shops')
      .select('items_in_queue, est_wait_seconds, wait_mode')
      .eq('id', A)
      .single()
  ).data!;
  check(
    'manual mode changes the wait immediately (dishes × 200 s)',
    man.ok && st.wait_mode === 'manual' && st.est_wait_seconds === st.items_in_queue * 200,
    JSON.stringify(st),
  );
  const slugBefore = (await svc.from('shops').select('slug, items_in_queue').eq('id', A).single())
    .data!;
  const mixed = await ops.updateShopSettings(vendorA, A, {
    slug: 'hacked',
    items_in_queue: 99,
    id: B,
    manual_seconds_per_item: 210,
  });
  const slugAfter = (
    await svc
      .from('shops')
      .select('slug, items_in_queue, manual_seconds_per_item')
      .eq('id', A)
      .single()
  ).data!;
  check(
    'settings: non-whitelisted fields never change',
    mixed.ok &&
      slugAfter.slug === slugBefore.slug &&
      slugAfter.items_in_queue === slugBefore.items_in_queue &&
      slugAfter.manual_seconds_per_item === 210,
    JSON.stringify(slugAfter),
  );
  const only = await ops.updateShopSettings(vendorA, A, { slug: 'hacked' });
  check('settings: nothing valid is rejected', !only.ok);
  const longPrefix = await ops.updateShopSettings(vendorA, A, { queue_prefix: 'ยาวเกินแปดตัว' });
  const fast = await ops.updateShopSettings(vendorA, A, { manual_seconds_per_item: 5 });
  check('settings are validated (prefix ≤ 8, 10 s–60 min)', !longPrefix.ok && !fast.ok);
  await ops.updateShopSettings(vendorA, A, { wait_mode: 'auto', manual_seconds_per_item: 90 });

  // 6. Stock toggle flows into the loader customers use.
  const crispy = shopA.ingredients.find((i) => i.name === 'ไก่กรอบ')!;
  await ops.setIngredientAvailable(vendorA, A, crispy.id, false);
  const stocked = (await loadShopBySlug(svc, 'pi-som'))!.shop.ingredients.find(
    (i) => i.id === crispy.id,
  )!;
  const refused = buildOrder(
    (await loadShopBySlug(svc, 'pi-som'))!.shop,
    [proteinLine('ไก่กรอบ')],
    '',
  );
  await ops.setIngredientAvailable(vendorA, A, crispy.id, true);
  check(
    'ของหมด reaches customers and blocks ordering',
    stocked.isAvailable === false && !refused.ok && refused.error === 'invalid_selections',
    refused.ok ? 'ordered' : refused.error,
  );

  // 7. Price change: new orders pay the new price, placed orders keep theirs.
  const rice = shopA.menus.find((m) => m.name === 'ข้าวราด เลือกโปรตีน')!;
  const tierGroup = rice.groups.find((x) => x.kind === 'tiered')!;
  const old = tierGroup.tierPrices.find((t) => t.selectedCount === 1)!.priceSatang;
  const edit = await ops.savePrices(vendorA, A, [
    { kind: 'tier', groupId: tierGroup.id, count: 1, satang: old + 500 },
  ]);
  const fresh = (await loadShopBySlug(svc, 'pi-som'))!.shop;
  const newBuild = buildOrder(fresh, [proteinLine('ไก่กรอบ')], '');
  const { data: oldItems } = await svc
    .from('order_items')
    .select('unit_price_satang')
    .eq('order_id', o!.id);
  check(
    'price change: new orders pay ฿5 more, the placed order keeps its price',
    edit.ok &&
      newBuild.ok &&
      newBuild.totalSatang === old + 500 &&
      oldItems?.[0].unit_price_satang === old,
    `${old} → ${newBuild.ok ? newBuild.totalSatang : newBuild.error}; old item ${oldItems?.[0].unit_price_satang}`,
  );
  await ops.savePrices(vendorA, A, [
    { kind: 'tier', groupId: tierGroup.id, count: 1, satang: old },
  ]);
  const badPrices = await Promise.all([
    ops.savePrices(vendorA, A, [{ kind: 'tier', groupId: tierGroup.id, count: 1, satang: 0 }]),
    ops.savePrices(vendorA, A, [{ kind: 'tier', groupId: tierGroup.id, count: 1, satang: -5 }]),
    ops.savePrices(vendorA, A, [{ kind: 'tier', groupId: tierGroup.id, count: 1, satang: 12.5 }]),
    ops.savePrices(vendorA, A, [
      { kind: 'tier', groupId: tierGroup.id, count: 1, satang: 99_999_999 },
    ]),
    ops.savePrices(vendorA, A, []),
  ]);
  check(
    'bad prices are rejected (0, negative, fraction, huge, empty)',
    badPrices.every((r) => !r.ok),
    JSON.stringify(badPrices),
  );
}

async function clean() {
  // Restore anything a failed run may have left behind.
  await svc.from('ingredients').update({ is_available: true }).eq('shop_id', A);
  await svc
    .from('shops')
    .update({ wait_mode: 'auto', manual_seconds_per_item: 90, is_open: true })
    .eq('id', A);
  if (cleanup.orders.length) {
    await svc.from('events').delete().in('order_id', cleanup.orders);
    await svc.from('orders').delete().in('id', cleanup.orders);
  }
  await svc
    .from('events')
    .delete()
    .eq('shop_id', A)
    .in('name', ['ingredient_toggled', 'price_changed']);
  const { data: day } = await svc.rpc('current_day');
  for (const id of [A, B]) {
    const { count } = await svc
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('shop_id', id)
      .eq('day', day as string);
    if (count === 0)
      await svc
        .from('shop_daily_counters')
        .delete()
        .eq('shop_id', id)
        .eq('day', day as string);
    await svc.rpc('refresh_shop_stats', { p_shop_id: id });
  }
  for (const id of cleanup.users) await svc.auth.admin.deleteUser(id);
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
