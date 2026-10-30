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
