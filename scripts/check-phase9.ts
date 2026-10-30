// npm run check:phase9 — PLAN.md Phase 9 checks against the hosted project: create a shop with
// a vendor login, reset passwords, admin edits any shop with the vendor ops. Creates a throwaway
// shop and account and removes them at the end.

import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import * as admin from '../lib/admin/ops';
import { AuthError, type Session } from '../lib/auth-rules';
import type { Database } from '../lib/database.types';
import { shopUuid } from '../lib/demo-data/seed-sql';
import { loadShopBySlug } from '../lib/menu/db';
import * as vendor from '../lib/vendor/ops';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const svc = createClient<Database>(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, opts);
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const shared = process.env.VENDOR_LOGIN_PASSWORD!;

const adminS: Session = {
  userId: 'test-admin',
  displayName: 'ผู้ดูแล',
  role: 'admin',
  shopId: null,
};
const vendorS: Session = {
  userId: 'test-vendor',
  displayName: 'ร้าน',
  role: 'vendor',
  shopId: shopUuid('pi-som'),
};
const results: { name: string; ok: boolean; detail: string }[] = [];
const check = (name: string, ok: boolean, detail = '') => results.push({ name, ok, detail });
const slug = `zz-test-${Math.random().toString(36).slice(2, 7)}`;
let shopId: string | null = null;

const signIn = async (email: string, password: string) =>
  !(await createClient<Database>(url, anonKey, opts).auth.signInWithPassword({ email, password }))
    .error;
const denied = (fn: () => Promise<unknown>) =>
  fn().then(
    () => false,
    (e) => e instanceof AuthError && e.reason === 'forbidden',
  );

async function main() {
  const input = {
    slug,
    name: 'ร้านทดสอบเฟส9',
    category: 'ทดสอบ',
    queuePrefix: 'ทด',
    manualSecondsPerItem: 120,
  };

  // Only admins create shops.
  check(
    'a vendor cannot create shops or reset passwords',
    (await denied(() => admin.createShopWithAccount(vendorS, input))) &&
      (await denied(() => admin.resetVendorPassword(vendorS, vendorS.shopId!))),
  );

  // Validation.
  const bads = await Promise.all([
    admin.createShopWithAccount(adminS, { ...input, slug: 'Bad Slug' }),
    admin.createShopWithAccount(adminS, { ...input, slug: 'x' }),
    admin.createShopWithAccount(adminS, { ...input, name: '  ' }),
    admin.createShopWithAccount(adminS, { ...input, queuePrefix: 'ยาวเกินแปดตัว' }),
    admin.createShopWithAccount(adminS, { ...input, manualSecondsPerItem: 5 }),
    admin.createShopWithAccount(adminS, null),
  ]);
  check(
    'bad shop input is refused (slug, name, prefix, seconds)',
    bads.every((r) => !r.ok && r.error === 'bad_input'),
    JSON.stringify(bads),
  );

  // Create: shop + vendor account that works with the shared password.
  const made = await admin.createShopWithAccount(adminS, input);
  if (made.ok) shopId = made.shopId;
  const { data: shopRow } = await svc
    .from('shops')
    .select('slug, queue_prefix, manual_seconds_per_item, is_open')
    .eq('slug', slug)
    .maybeSingle();
  const { data: profile } = shopId
    ? await svc.from('profiles').select('role, shop_id').eq('shop_id', shopId).maybeSingle()
    : { data: null };
  check(
    'create shop: shop row and a vendor profile bound to it',
    made.ok &&
      shopRow?.queue_prefix === 'ทด' &&
      shopRow.manual_seconds_per_item === 120 &&
      profile?.role === 'vendor',
    JSON.stringify({ made, shopRow, profile }),
  );
  check(
    'the new vendor signs in with the shared password (tap-to-login works)',
    await signIn(`${slug}@imtan.local`, shared),
  );
  const dup = await admin.createShopWithAccount(adminS, input);
  check(
    'the same shop code twice is refused',
    !dup.ok && dup.error === 'duplicate',
    JSON.stringify(dup),
  );
  const { count } = await svc
    .from('shops')
    .select('*', { count: 'exact', head: true })
    .eq('slug', slug);
  check('a refused duplicate leaves exactly one shop', count === 1);

  // Passwords.
  const custom = await admin.resetVendorPassword(adminS, shopId!, 'secret-pass-9');
  check(
    'custom password: works, and the shared one stops working for that shop',
    custom.ok &&
      !custom.shared &&
      (await signIn(`${slug}@imtan.local`, 'secret-pass-9')) &&
      !(await signIn(`${slug}@imtan.local`, shared)),
  );
  const short = await admin.resetVendorPassword(adminS, shopId!, '123');
  check('a short custom password is refused', !short.ok && short.error === 'bad_input');
  const back = await admin.resetVendorPassword(adminS, shopId!);
  check(
    'reset to the shared password restores tap-to-login',
    back.ok && back.shared && (await signIn(`${slug}@imtan.local`, shared)),
  );
  const missing = await admin.resetVendorPassword(adminS, randomUUID());
  check('reset for an unknown shop is refused', !missing.ok && missing.error === 'not_found');

  // A shop without an account gets one.
  const { data: prof } = await svc.from('profiles').select('id').eq('shop_id', shopId!).single();
  await svc.auth.admin.deleteUser(prof!.id);
  const recreated = await admin.resetVendorPassword(adminS, shopId!);
  check(
    'reset creates the account when the shop has none',
    recreated.ok && (await signIn(`${slug}@imtan.local`, shared)),
  );

  // Admin edits any shop with the same editors: build a menu in the new shop.
  const menuId = randomUUID();
  const saved = await vendor.saveMenu(adminS, shopId!, {
    id: menuId,
    category: 'ทดสอบ',
    name: 'เมนูแรกของร้านใหม่',
    cookSeconds: 90,
    basePriceSatang: 4500,
    pairOnly: false,
    isAvailable: true,
    isDeleted: false,
    ingredientIds: [],
    groups: [],
    variants: [],
  });
  const created = (await loadShopBySlug(svc, slug))?.shop.menus.find((m) => m.id === menuId);
  check(
    'admin builds a menu in the new shop with the menu editor ops',
    saved.ok && saved.available && created?.basePriceSatang === 4500,
    JSON.stringify(saved),
  );
  const other = await vendor.setIngredientAvailable(
    adminS,
    shopUuid('jae-buek'),
    randomUUID(),
    false,
  );
  check(
    'admin reaches other shops through the same ops (unknown ids are just not found)',
    !other.ok && other.error === 'not_found',
  );
  check(
    "the new shop's own vendor cannot touch another shop",
    await denied(() =>
      vendor.updateShopSettings({ ...vendorS, shopId }, shopUuid('pi-som'), { name: 'x' }),
    ),
  );
}

async function clean() {
  // Users first: a vendor profile must keep its shop (check constraint), so the shop can only go after it.
  const { data: users } = await svc.auth.admin.listUsers({ perPage: 1000 });
  for (const u of users?.users ?? [])
    if (u.email === `${slug}@imtan.local`) await svc.auth.admin.deleteUser(u.id);
  if (shopId) {
    const { data: prof } = await svc.from('profiles').select('id').eq('shop_id', shopId);
    for (const p of prof ?? []) await svc.auth.admin.deleteUser(p.id);
    const { error } = await svc.from('shops').delete().eq('id', shopId);
    if (error) throw new Error(`could not remove test shop: ${error.message}`);
  }
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
