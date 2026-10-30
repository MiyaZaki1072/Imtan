// npm run check:phase2 — PLAN.md Phase 2 "Accept" checks against the hosted project.
// Creates throwaway users, orders and a temporary shop, and deletes them at the end.

import { randomBytes } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../lib/database.types';
import { shopUuid } from '../lib/demo-data/seed-sql';

type Db = SupabaseClient<Database>;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const vendorPassword = process.env.VENDOR_LOGIN_PASSWORD!;

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const svc: Db = createClient<Database>(url, serviceKey, opts);
const client = (): Db => createClient<Database>(url, anonKey, opts);

const results: { name: string; ok: boolean; detail: string }[] = [];
function check(name: string, ok: boolean, detail = '') {
  results.push({ name, ok, detail });
}

const cleanup = { users: [] as string[], orders: [] as string[], shops: [] as string[] };

async function guest(name: string) {
  const c = client();
  const { data, error } = await c.auth.signInAnonymously({
    options: { data: { display_name: name } },
  });
  if (error || !data.user) throw error ?? new Error('anonymous sign-in failed');
  cleanup.users.push(data.user.id);
  return { c, id: data.user.id };
}

async function vendor(slug: string) {
  const c = client();
  const { error } = await c.auth.signInWithPassword({
    email: `${slug}@imtan.local`,
    password: vendorPassword,
  });
  if (error) throw error;
  return c;
}

async function count(table: 'shops' | 'menus' | 'menu_variants') {
  const { count: n, error } = await svc.from(table).select('*', { count: 'exact', head: true });
  if (error) throw error;
  return n ?? -1;
}

async function denied(
  name: string,
  call: PromiseLike<{ error: { code?: string; message: string } | null }>,
) {
  const { error } = await call;
  check(
    name,
    !!error && (error.code === '42501' || /permission denied/i.test(error.message)),
    error ? `${error.code} ${error.message}` : 'no error',
  );
}

async function testOrder(shopId: string, customerId: string, menuId: string) {
  const { data, error } = await svc.rpc('insert_order', {
    p_shop_id: shopId,
    p_customer_id: customerId,
    p_customer_name: 'ทดสอบ',
    p_source: 'app',
    p_total_satang: 5000,
    p_items: [
      {
        menu_id: menuId,
        menu_name: 'ทดสอบ',
        selections: {},
        kitchen_summary: 'ทดสอบ',
        note: null,
        qty: 1,
        unit_price_satang: 5000,
        line_total_satang: 5000,
      },
    ],
  });
  if (error || !data) throw error ?? new Error('insert_order returned nothing');
  cleanup.orders.push(data.id);
  return data;
}

async function main() {
  // Seed counts
  const [shops, menus, variants] = await Promise.all([
    count('shops'),
    count('menus'),
    count('menu_variants'),
  ]);
  check(
    'seed: 5 shops, 33 menus, 127 variant rows',
    shops === 5 && menus === 33 && variants === 127,
    `${shops} / ${menus} / ${variants}`,
  );

  const shopA = shopUuid('pi-som');
  const shopB = shopUuid('jae-buek');
  const { data: menuRow } = await svc
    .from('menus')
    .select('id')
    .eq('shop_id', shopA)
    .limit(1)
    .single();
  const menuA = menuRow!.id;

  // A customer can't run internal functions or set their own role
  const a = await guest('ทดสอบ A');
  const b = await guest('ทดสอบ B');
  const anyId = '00000000-0000-0000-0000-000000000000';
  await denied(
    'customer cannot run confirm_payment',
    a.c.rpc('confirm_payment', { p_order_id: anyId, p_method: 'demo' }),
  );
  await denied(
    'customer cannot run insert_order',
    a.c.rpc('insert_order', {
      p_shop_id: shopA,
      p_customer_id: a.id,
      p_customer_name: 'x',
      p_source: 'app',
      p_items: [],
      p_total_satang: 0,
    }),
  );
  await denied(
    'customer cannot run vendor_set_order_status',
    a.c.rpc('vendor_set_order_status', { p_shop_id: shopA, p_order_id: anyId, p_status: 'ready' }),
  );
  await denied(
    'customer cannot run vendor_recall_order',
    a.c.rpc('vendor_recall_order', { p_shop_id: shopA, p_order_id: anyId }),
  );
  await denied(
    'customer cannot run assign_queue_number',
    a.c.rpc('assign_queue_number', { p_shop_id: shopA }),
  );
  await denied(
    'customer cannot set own role',
    a.c.from('profiles').update({ role: 'admin' }).eq('id', a.id),
  );
  await denied(
    'customer cannot insert orders',
    a.c
      .from('orders')
      .insert({
        shop_id: shopA,
        customer_name: 'x',
        source: 'app',
        status: 'queued',
        item_count: 1,
        total_satang: 1,
      }),
  );
  {
    const { error } = await a.c
      .from('profiles')
      .update({ display_name: 'ทดสอบ A2' })
      .eq('id', a.id);
    const { data: p } = await svc
      .from('profiles')
      .select('display_name, role')
      .eq('id', a.id)
      .single();
    check(
      'customer can rename self, role stays customer',
      !error && p?.display_name === 'ทดสอบ A2' && p.role === 'customer',
      error?.message ?? JSON.stringify(p),
    );
  }

  // Order visibility
  const orderA = await testOrder(shopA, a.id, menuA);
  const orderB = await testOrder(shopA, b.id, menuA);
  check(
    'unpaid app order has no queue number',
    orderA.status === 'awaiting_payment' && orderA.queue_no === null,
    `${orderA.status} ${orderA.queue_no}`,
  );
  {
    const { data } = await a.c.from('orders').select('id').in('id', [orderA.id, orderB.id]);
    check(
      "customer A sees own order, not B's",
      data?.length === 1 && data[0].id === orderA.id,
      JSON.stringify(data),
    );
  }

  const vendorA = await vendor('pi-som');
  const vendorB = await vendor('jae-buek');
  {
    const { data } = await vendorA.from('orders').select('id').eq('id', orderA.id);
    check('vendor cannot see an unpaid order', data?.length === 0, JSON.stringify(data));
  }
  const { data: paid, error: payError } = await svc.rpc('confirm_payment', {
    p_order_id: orderA.id,
    p_method: 'demo',
  });
  check(
    'confirm_payment queues the order with a label',
    !payError && paid?.status === 'queued' && !!paid.queue_label?.startsWith('ส้ม-'),
    payError?.message ?? `${paid?.status} ${paid?.queue_label}`,
  );
  {
    const { data } = await vendorA.from('orders').select('id').eq('id', orderA.id);
    check('vendor sees own shop order once paid', data?.length === 1, JSON.stringify(data));
    const { data: items } = await vendorA
      .from('order_items')
      .select('id')
      .eq('order_id', orderA.id);
    check('vendor sees its items', items?.length === 1, JSON.stringify(items));
  }
  {
    const { data } = await vendorB.from('orders').select('id').eq('shop_id', shopA);
    check("vendor B cannot read shop A's orders", data?.length === 0, JSON.stringify(data));
    const { data: ev } = await vendorB.from('events').select('id').limit(1);
    check('vendor cannot read events', ev?.length === 0, JSON.stringify(ev));
  }
  void shopB;

  // 50 parallel assign_queue_number calls → 50 unique numbers (temporary shop)
  const tempSlug = `zz-test-${randomBytes(3).toString('hex')}`;
  const { data: temp, error: tempError } = await svc
    .from('shops')
    .insert({
      slug: tempSlug,
      name: 'ร้านทดสอบ',
      category: 'ทดสอบ',
      queue_prefix: 'ทด',
      manual_seconds_per_item: 60,
    })
    .select('id')
    .single();
  if (tempError || !temp) throw tempError;
  cleanup.shops.push(temp.id);
  const numbers = await Promise.all(
    Array.from({ length: 50 }, () => svc.rpc('assign_queue_number', { p_shop_id: temp.id })),
  );
  const values = numbers.map((r) => r.data);
  const errors = numbers.filter((r) => r.error).length;
  check(
    '50 parallel assign_queue_number → 50 unique numbers',
    errors === 0 && new Set(values).size === 50 && Math.max(...(values as number[])) === 50,
    `errors ${errors}, unique ${new Set(values).size}`,
  );
}

async function clean() {
  if (cleanup.orders.length) {
    await svc.from('events').delete().in('order_id', cleanup.orders);
    await svc.from('orders').delete().in('id', cleanup.orders);
    // Give back today's numbers used by the test if the shop has no other orders today.
    const shopA = shopUuid('pi-som');
    const { data: day } = await svc.rpc('current_day');
    const { count: left } = await svc
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('shop_id', shopA)
      .eq('day', day as string);
    if (left === 0)
      await svc
        .from('shop_daily_counters')
        .delete()
        .eq('shop_id', shopA)
        .eq('day', day as string);
  }
  if (cleanup.shops.length) await svc.from('shops').delete().in('id', cleanup.shops);
  for (const id of cleanup.users) await svc.auth.admin.deleteUser(id);
  // Stats were touched by the test orders; recompute.
  await svc.rpc('refresh_shop_stats', { p_shop_id: shopUuid('pi-som') });
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
