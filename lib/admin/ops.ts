import 'server-only';

import { cookies } from 'next/headers';
import { assertAdmin, assertVendorOf, type Session } from '../auth-rules';
import type { Json } from '../database.types';
import { resetDemo } from '../demo-data/reset';
import { loadShopBySlug } from '../menu/db';
import { randomNickname, randomSelections } from '../menu/random';
import { ingredientMap, menuAvailability } from '../menu';
import { buildOrder } from '../orders/build';
import { createAdminClient } from '../supabase/admin';

// Demo tools (PLAN.md §5d). The actions in ./actions.ts also require DEMO_PAYMENTS=true.

export const ADMIN_SHOP_COOKIE = 'imtan_admin_shop';

type Fail<E extends string> = { ok: false; error: E };

/**
 * One simulated paid order from a shop's real menu: random but valid selections, built and
 * priced by lib/menu, queued at once (source `simulated`). The vendor of the shop or an admin.
 */
export async function simulateOrder(
  s: Session,
  shopId: string,
  rng: () => number = Math.random,
): Promise<
  { ok: true; label: string; totalSatang: number } | Fail<'not_found' | 'no_menu' | 'failed'>
> {
  assertVendorOf(s, shopId);
  const db = createAdminClient();
  const { data: row } = await db.from('shops').select('slug').eq('id', shopId).maybeSingle();
  const loaded = row ? await loadShopBySlug(db, row.slug) : null;
  if (!loaded) return { ok: false, error: 'not_found' };
  const shop = loaded.shop;
  const ing = ingredientMap(shop.ingredients);

  // Menus that can be ordered alone (pair_only items need another dish).
  const menus = shop.menus.filter(
    (m) => !m.isDeleted && !m.pairOnly && menuAvailability(m, ing).available,
  );
  for (let attempt = 0; attempt < 12 && menus.length; attempt++) {
    const menu = menus[Math.floor(rng() * menus.length)];
    const selections = randomSelections(menu, ing, rng);
    if (!selections) continue;
    const qty = rng() < 0.75 ? 1 : 2;
    const built = buildOrder(shop, [{ menuId: menu.id, selections, qty, note: '' }], '', {
      walkIn: true,
    });
    if (!built.ok) continue;
    const { data, error } = await db.rpc('insert_order', {
      p_shop_id: shopId,
      p_customer_id: null as unknown as string,
      p_customer_name: randomNickname(rng),
      p_source: 'simulated',
      p_items: built.items as unknown as Json,
      p_total_satang: built.totalSatang,
    });
    if (error || !data?.queue_label) {
      console.error('simulateOrder insert_order failed:', error?.message);
      return { ok: false, error: 'failed' };
    }
    return { ok: true, label: data.queue_label, totalSatang: built.totalSatang };
  }
  return { ok: false, error: 'no_menu' };
}

export async function resetDemoTool(
  s: Session,
  target: string,
): Promise<{ ok: true } | Fail<'failed'>> {
  assertAdmin(s);
  try {
    await resetDemo(target === 'all' ? 'all' : target);
    return { ok: true };
  } catch (e) {
    console.error('resetDemo failed:', e);
    return { ok: false, error: 'failed' };
  }
}

/** "เดินคิวอัตโนมัติ": simulated orders of this shop (or all) move on every minute. */
export async function setAutoAdvance(
  s: Session,
  target: string,
  on: boolean,
): Promise<{ ok: true } | Fail<'failed'>> {
  assertAdmin(s);
  const query = createAdminClient().from('shops').update({ auto_advance: !!on });
  const { error } = await (target === 'all'
    ? query.not('id', 'is', null)
    : query.eq('slug', target));
  return error ? { ok: false, error: 'failed' } : { ok: true };
}

/** Which shop an admin sees on the vendor screens. */
export async function setAdminShop(
  s: Session,
  slug: string,
): Promise<{ ok: true } | Fail<'not_found'>> {
  assertAdmin(s);
  const { data } = await createAdminClient()
    .from('shops')
    .select('slug')
    .eq('slug', slug)
    .maybeSingle();
  if (!data) return { ok: false, error: 'not_found' };
  (await cookies()).set(ADMIN_SHOP_COOKIE, data.slug, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
  });
  return { ok: true };
}

// Shops and vendor accounts (Phase 9) -----------------------------------------------------

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const text = (v: unknown, max: number): string | null =>
  typeof v === 'string' && v.trim() && [...v.trim()].length <= max ? v.trim() : null;

export const vendorEmail = (slug: string) => `${slug}@imtan.local`;

/**
 * Creates a shop and its vendor login (`<slug>@imtan.local`). The password is the shared
 * VENDOR_LOGIN_PASSWORD, so the tap-to-login button works at once. The new shop starts with
 * no menu: the admin builds it with the menu editor. If the account can't be made, the shop
 * is removed again so nothing half-created is left.
 */
export async function createShopWithAccount(
  s: Session,
  input: unknown,
): Promise<
  | { ok: true; shopId: string; slug: string; username: string }
  | Fail<'bad_input' | 'duplicate' | 'no_password' | 'failed'>
> {
  assertAdmin(s);
  const i = (typeof input === 'object' && input !== null ? input : {}) as Record<string, unknown>;
  const slug = typeof i.slug === 'string' ? i.slug.trim() : '';
  const name = text(i.name, 80);
  const category = text(i.category, 80);
  const prefix = text(i.queuePrefix, 8);
  const seconds = typeof i.manualSecondsPerItem === 'number' ? i.manualSecondsPerItem : NaN;
  if (!SLUG.test(slug) || slug.length < 2 || slug.length > 30 || !name || !category || !prefix) {
    return { ok: false, error: 'bad_input' };
  }
  if (!Number.isInteger(seconds) || seconds < 10 || seconds > 3600)
    return { ok: false, error: 'bad_input' };
  const password = process.env.VENDOR_LOGIN_PASSWORD;
  if (!password) return { ok: false, error: 'no_password' };

  const db = createAdminClient();
  const { data: shop, error } = await db
    .from('shops')
    .insert({ slug, name, category, queue_prefix: prefix, manual_seconds_per_item: seconds })
    .select('id')
    .single();
  if (error?.code === '23505') return { ok: false, error: 'duplicate' };
  if (error || !shop) return { ok: false, error: 'failed' };

  const { data: user, error: userError } = await db.auth.admin.createUser({
    email: vendorEmail(slug),
    password,
    email_confirm: true,
    user_metadata: { display_name: name.slice(0, 30) },
  });
  if (userError || !user.user) {
    await db.from('shops').delete().eq('id', shop.id);
    return {
      ok: false,
      error: /already|registered/i.test(userError?.message ?? '') ? 'duplicate' : 'failed',
    };
  }
  // The signup trigger makes a customer; promote with the service role.
  const { error: profileError } = await db
    .from('profiles')
    .update({ role: 'vendor', shop_id: shop.id, display_name: name.slice(0, 30) })
    .eq('id', user.user.id);
  if (profileError) {
    await db.auth.admin.deleteUser(user.user.id);
    await db.from('shops').delete().eq('id', shop.id);
    return { ok: false, error: 'failed' };
  }
  return { ok: true, shopId: shop.id, slug, username: slug };
}

/**
 * Resets a shop's vendor login. With no password it goes back to the shared one (tap-to-login
 * works again); a custom password (6+ characters) makes that shop sign in with username +
 * password on /login instead. Creates the account when the shop has none.
 */
export async function resetVendorPassword(
  s: Session,
  shopId: string,
  password?: unknown,
): Promise<
  | { ok: true; username: string; shared: boolean }
  | Fail<'bad_input' | 'not_found' | 'no_password' | 'failed'>
> {
  assertAdmin(s);
  const shared = process.env.VENDOR_LOGIN_PASSWORD;
  const custom = typeof password === 'string' && password.length > 0 ? password : null;
  if (custom !== null && (custom.length < 6 || custom.length > 72))
    return { ok: false, error: 'bad_input' };
  const next = custom ?? shared;
  if (!next) return { ok: false, error: 'no_password' };

  const db = createAdminClient();
  const { data: shop } = await db
    .from('shops')
    .select('id, slug, name')
    .eq('id', shopId)
    .maybeSingle();
  if (!shop) return { ok: false, error: 'not_found' };
  const { data: profile } = await db
    .from('profiles')
    .select('id')
    .eq('role', 'vendor')
    .eq('shop_id', shopId)
    .maybeSingle();

  if (profile) {
    const { error } = await db.auth.admin.updateUserById(profile.id, { password: next });
    return error
      ? { ok: false, error: 'failed' }
      : { ok: true, username: shop.slug, shared: custom === null };
  }
  const { data: user, error } = await db.auth.admin.createUser({
    email: vendorEmail(shop.slug),
    password: next,
    email_confirm: true,
    user_metadata: { display_name: shop.name.slice(0, 30) },
  });
  if (error || !user.user) return { ok: false, error: 'failed' };
  await db.from('profiles').update({ role: 'vendor', shop_id: shop.id }).eq('id', user.user.id);
  return { ok: true, username: shop.slug, shared: custom === null };
}
