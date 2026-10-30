// npm run check:phase6 — PLAN.md Phase 6 "Accept" checks against the hosted project.
// Runs the real demo-tool ops. Ends by resetting พี่ส้ม to the seed, so nothing is left behind.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { parse } from 'yaml';
import * as admin from '../lib/admin/ops';
import { AuthError, type Session } from '../lib/auth-rules';
import type { Database, Json } from '../lib/database.types';
import { parseDemoData } from '../lib/demo-data/parse';
import { shopUuid } from '../lib/demo-data/seed-sql';
import { loadShopBySlug } from '../lib/menu/db';
import { demoPaymentsEnabled } from '../lib/payments/demo';
import { buildOrder } from '../lib/orders/build';
import * as vendor from '../lib/vendor/ops';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const svc = createClient<Database>(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, opts);
const anon = createClient<Database>(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, opts);

const SHOP = shopUuid('pi-som');
const adminSession: Session = {
  userId: 'test-admin',
  displayName: 'ผู้ดูแล',
  role: 'admin',
  shopId: null,
};
const vendorSession: Session = {
  userId: 'test-vendor',
  displayName: 'ร้าน',
  role: 'vendor',
  shopId: SHOP,
};
const results: { name: string; ok: boolean; detail: string }[] = [];
const check = (name: string, ok: boolean, detail = '') => results.push({ name, ok, detail });
const cleanup = { users: [] as string[] };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  // 1. Simulate rush: 10 valid, correctly priced orders.
  const t0 = Date.now();
  const made = [];
  for (let i = 0; i < 10; i++) made.push(await admin.simulateOrder(adminSession, SHOP));
  const labels = made.flatMap((m) => (m.ok ? [m.label] : []));
  check(
    'rush: 10 simulated orders created',
    labels.length === 10 && new Set(labels).size === 10,
    JSON.stringify(made.filter((m) => !m.ok)),
  );
  const { data: orders } = await svc
    .from('orders')
    .select(
      'id, status, source, total_satang, order_items(menu_id, selections, qty, unit_price_satang, line_total_satang, kitchen_summary)',
    )
    .eq('shop_id', SHOP)
    .eq('source', 'simulated');
  const shop = (await loadShopBySlug(svc, 'pi-som'))!.shop;
  let bad = 0;
  for (const o of orders ?? []) {
    const lines = (o.order_items ?? []).map((i) => ({
      menuId: i.menu_id,
      selections: i.selections,
      qty: i.qty,
      note: '',
    }));
    const again = buildOrder(shop, lines, '', { walkIn: true });
    const sum = (o.order_items ?? []).reduce((n, i) => n + i.line_total_satang, 0);
    if (
      !again.ok ||
      again.totalSatang !== o.total_satang ||
      sum !== o.total_satang ||
      o.status !== 'queued'
    )
      bad++;
  }
  check(
    'rush: every order re-validates and its price matches lib/menu',
    (orders?.length ?? 0) === 10 && bad === 0,
    `${bad} bad of ${orders?.length}`,
  );
  const board = await svc.from('shops').select('items_in_queue').eq('id', SHOP).single();
  check(
    'rush: Home stats count the simulated dishes',
    (board.data?.items_in_queue ?? 0) >= 10,
    `${board.data?.items_in_queue}`,
  );
  check(
    `rush: 10 orders in ${((Date.now() - t0) / 1000).toFixed(1)} s (well under 2 min)`,
    Date.now() - t0 < 120_000,
  );

  // Only vendor-of-shop or admin may simulate; resets are admin-only.
  const otherVendor: Session = { ...vendorSession, shopId: shopUuid('jae-buek') };
  const refused = await admin.simulateOrder(otherVendor, SHOP).then(
    () => false,
    (e) => e instanceof AuthError,
  );
  const resetRefused = await admin.resetDemoTool(vendorSession, 'pi-som').then(
    () => false,
    (e) => e instanceof AuthError,
  );
  check('vendor of another shop cannot simulate; vendors cannot reset', refused && resetRefused);

  // 2. Auto-advance (the same function pg_cron runs every minute).
  await admin.setAutoAdvance(adminSession, 'pi-som', true);
  await svc.rpc('advance_simulated_orders');
  const cooking = await svc
    .from('orders')
    .select('id')
    .eq('shop_id', SHOP)
    .eq('source', 'simulated')
    .eq('status', 'cooking');
  check(
    'auto-advance: one simulated order starts cooking',
    cooking.data?.length === 1,
    `${cooking.data?.length}`,
  );
  await svc
    .from('orders')
    .update({ started_at: new Date(Date.now() - 600_000).toISOString() })
    .eq('id', cooking.data![0].id);
  await svc.rpc('advance_simulated_orders');
  const ready = await svc
    .from('orders')
    .select('id, ready_at')
    .eq('id', cooking.data![0].id)
    .single();
  const next = await svc
    .from('orders')
    .select('id')
    .eq('shop_id', SHOP)
    .eq('source', 'simulated')
    .eq('status', 'cooking');
  check(
    'auto-advance: finished order is ready and the next one starts',
    !!ready.data?.ready_at && next.data?.length === 1,
  );
  await svc
    .from('orders')
    .update({ ready_at: new Date(Date.now() - 120_000).toISOString() })
    .eq('id', cooking.data![0].id);
  await svc.rpc('advance_simulated_orders');
  const picked = await svc
    .from('orders')
    .select('status, picked_up_by')
    .eq('id', cooking.data![0].id)
    .single();
  check(
    'auto-advance: a ready order is picked up automatically',
    picked.data?.status === 'picked_up' && picked.data.picked_up_by === 'auto',
    JSON.stringify(picked.data),
  );

  // 3. Push never breaks a status change (bogus subscription, real send attempt).
  const { data: g } = await anon.auth.signInAnonymously({
    options: { data: { display_name: 'ทดสอบ 6' } },
  });
  const customerId = g.user!.id;
  cleanup.users.push(customerId);
  const line = shop.menus.find((m) => m.name === 'ข้าวราด เลือกโปรตีน')!;
  const group = line.groups.find((x) => x.kind === 'tiered')!;
  const built = buildOrder(
    shop,
    [{ menuId: line.id, selections: { [group.id]: [group.options[0].id] }, qty: 1 }],
    '',
  );
  if (!built.ok) throw new Error(`build failed ${built.error}`);
  const { data: o } = await svc.rpc('insert_order', {
    p_shop_id: SHOP,
    p_customer_id: customerId,
    p_customer_name: 'ทดสอบ',
    p_source: 'app',
    p_items: built.items as unknown as Json,
    p_total_satang: built.totalSatang,
  });
  await svc.rpc('confirm_payment', { p_order_id: o!.id, p_method: 'demo' });
  await svc.from('push_subscriptions').insert({
    user_id: customerId,
    endpoint: 'https://push.invalid.example/sub',
    p256dh:
      'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM',
    auth: 'tBHItJI5svbpez7KI4CCXg',
  });
  const ready2 = await vendor.setOrderStatus(vendorSession, SHOP, o!.id, 'ready');
  const { data: after } = await svc.from('orders').select('status').eq('id', o!.id).single();
  await sleep(500);
  const ev = await svc
    .from('events')
    .select('name')
    .eq('order_id', o!.id)
    .in('name', ['push_sent', 'push_failed']);
  check(
    'push to a dead subscription is logged and the order still becomes ready',
    ready2.ok &&
      after?.status === 'ready' &&
      ev.data?.some((e) => e.name === 'push_failed') === true,
    JSON.stringify({ ready2, after, ev: ev.data }),
  );

  // 4. Reset restores the seed.
  await svc.from('ingredients').update({ is_available: false }).eq('shop_id', SHOP).limit(3);
  await svc
    .from('shops')
    .update({
      name: 'ชื่อที่ถูกแก้',
      is_open: false,
      wait_mode: 'manual',
      manual_seconds_per_item: 999,
      auto_advance: true,
    })
    .eq('id', SHOP);
  const tier = shop.menus.flatMap((m) => m.groups).find((x) => x.kind === 'tiered')!;
  await svc
    .from('group_tier_prices')
    .update({ price_satang: 9900 })
    .eq('group_id', tier.id)
    .eq('selected_count', 1);
  await svc.from('menus').update({ is_available: false }).eq('shop_id', SHOP);
  const reset = await admin.resetDemoTool(adminSession, 'pi-som');
  const yaml = parseDemoData(
    parse(readFileSync(path.join(process.cwd(), 'data', 'demo-shops.yaml'), 'utf8')),
  ).shops.find((s) => s.slug === 'pi-som')!;
  const db = (await loadShopBySlug(svc, 'pi-som'))!;
  const yTier = yaml.menus
    .flatMap((m) => m.groups)
    .find((x) => x.kind === 'tiered')!
    .tierPrices.map((t) => t.priceSatang)
    .join();
  const dTier = db.shop.menus
    .flatMap((m) => m.groups)
    .find((x) => x.kind === 'tiered')!
    .tierPrices.map((t) => t.priceSatang)
    .join();
  const yDelta = yaml.menus
    .flatMap((m) => m.groups.flatMap((g) => g.options.map((x) => x.priceDeltaSatang)))
    .join();
  const dDelta = db.shop.menus
    .flatMap((m) => m.groups.flatMap((g) => g.options.map((x) => x.priceDeltaSatang)))
    .join();
  const { data: left } = await svc.from('orders').select('id').eq('shop_id', SHOP);
  const { data: ctr } = await svc.from('shop_daily_counters').select('last_no').eq('shop_id', SHOP);
  const { data: sh } = await svc
    .from('shops')
    .select('auto_advance, items_in_queue')
    .eq('id', SHOP)
    .single();
  check(
    'reset: prices, availability, settings and queue are back to the seed',
    reset.ok &&
      db.shop.name === yaml.name &&
      db.shop.isOpen &&
      db.shop.waitMode === yaml.waitMode &&
      db.shop.manualSecondsPerItem === yaml.manualSecondsPerItem &&
      db.shop.ingredients.every((i) => i.isAvailable) &&
      db.shop.menus.every((m) => m.isAvailable) &&
      yTier === dTier &&
      yDelta === dDelta &&
      (left?.length ?? 1) === 0 &&
      (ctr?.length ?? 1) === 0 &&
      sh?.auto_advance === false &&
      sh.items_in_queue === 0,
    JSON.stringify({
      reset,
      name: db.shop.name,
      yTier,
      dTier,
      left: left?.length,
      ctr: ctr?.length,
      sh,
    }),
  );

  // 5. Health check and the DEMO_PAYMENTS gate.
  const { GET } = await import('../app/api/health/route');
  const health = await GET();
  check('health check answers ok', health.status === 200 && (await health.json()).ok === true);
  // Every demo action starts with this check and answers "unavailable" when it is false.
  const was = process.env.DEMO_PAYMENTS;
  process.env.DEMO_PAYMENTS = 'false';
  const off = demoPaymentsEnabled();
  process.env.DEMO_PAYMENTS = 'true';
  const on = demoPaymentsEnabled();
  process.env.DEMO_PAYMENTS = was;
  check('demo tools are off unless DEMO_PAYMENTS=true', !off && on);
}

async function clean() {
  await svc.from('events').delete().in('user_id', cleanup.users);
  for (const id of cleanup.users) await svc.auth.admin.deleteUser(id);
  await admin.resetDemoTool(adminSession, 'pi-som').catch(() => {});
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
