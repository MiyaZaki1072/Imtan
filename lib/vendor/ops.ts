import 'server-only';

import { assertVendorOf, type Session } from '../auth-rules';
import type { Database, Json } from '../database.types';
import { loadShopBySlug } from '../menu/db';
import { buildOrder, type BuildError } from '../orders/build';
import { notifyOrderReady } from '../push';
import { createAdminClient } from '../supabase/admin';

// Every vendor write lives here. Each function takes the session and re-checks that the
// caller owns `shopId`, and every row it touches is verified to belong to that shop.
// lib/vendor/actions.ts wraps these as server actions after requireVendor(shopId).

type Db = ReturnType<typeof createAdminClient>;
type Fail<E extends string> = { ok: false; error: E };

async function logEvent(db: Db, s: Session, shopId: string, name: string, props: Json) {
  await db.from('events').insert({
    name,
    shop_id: shopId,
    actor_role: s.role,
    user_id: s.userId,
    props,
  });
}

// Orders ------------------------------------------------------------------------------

const STATUSES = ['cooking', 'ready', 'picked_up', 'cancelled'] as const;
type VendorStatus = (typeof STATUSES)[number];

/** เริ่มทำ / เสร็จแล้ว (also straight from รอทำ) / ลูกค้ารับแล้ว / ยกเลิก + คืนเงิน (simulated refund). */
export async function setOrderStatus(
  s: Session,
  shopId: string,
  orderId: string,
  status: string,
  reason?: string,
): Promise<{ ok: true } | Fail<'bad_status' | 'invalid_transition'>> {
  assertVendorOf(s, shopId);
  if (!STATUSES.includes(status as VendorStatus)) return { ok: false, error: 'bad_status' };
  const { error } = await createAdminClient().rpc('vendor_set_order_status', {
    p_shop_id: shopId,
    p_order_id: orderId,
    p_status: status as VendorStatus,
    p_reason: reason ? reason.slice(0, 200) : undefined,
  });
  if (error) return { ok: false, error: 'invalid_transition' };
  // The in-page alert is the main one; a failed push never fails the status change.
  if (status === 'ready') await notifyOrderReady(orderId, false);
  return { ok: true };
}

/** เรียกซ้ำ: the customer's ready alert plays again. */
export async function recallOrder(
  s: Session,
  shopId: string,
  orderId: string,
): Promise<{ ok: true } | Fail<'not_ready'>> {
  assertVendorOf(s, shopId);
  const { error } = await createAdminClient().rpc('vendor_recall_order', {
    p_shop_id: shopId,
    p_order_id: orderId,
  });
  if (error) return { ok: false, error: 'not_ready' };
  await notifyOrderReady(orderId, true);
  return { ok: true };
}

/** "+1 คิวหน้าร้าน": no menu, just a number and a dish count. */
export async function addQuickWalkIn(
  s: Session,
  shopId: string,
  count: number,
): Promise<{ ok: true; label: string } | Fail<'bad_input' | 'failed'>> {
  assertVendorOf(s, shopId);
  if (!Number.isInteger(count) || count < 1 || count > 20) return { ok: false, error: 'bad_input' };
  const { data, error } = await createAdminClient().rpc('add_quick_walk_in', {
    p_shop_id: shopId,
    p_item_count: count,
  });
  if (error || !data?.queue_label) return { ok: false, error: 'failed' };
  return { ok: true, label: data.queue_label };
}

/** Full walk-in form: same menu rules and pricing as the app, queued at once, cash at the counter. */
export async function addWalkInOrder(
  s: Session,
  shopId: string,
  lines: unknown,
  customerName: unknown,
): Promise<
  { ok: true; label: string; totalSatang: number } | Fail<BuildError | 'not_found' | 'failed'>
> {
  assertVendorOf(s, shopId);
  const db = createAdminClient();
  const { data: row } = await db.from('shops').select('slug').eq('id', shopId).maybeSingle();
  const loaded = row ? await loadShopBySlug(db, row.slug) : null;
  if (!loaded) return { ok: false, error: 'not_found' };

  const built = buildOrder(loaded.shop, lines, '', { walkIn: true });
  if (!built.ok) return { ok: false, error: built.error };

  const name = typeof customerName === 'string' ? customerName.trim().slice(0, 30) : '';
  const { data, error } = await db.rpc('insert_order', {
    p_shop_id: shopId,
    // No customer account: a walk-in has no app user.
    p_customer_id: null as unknown as string,
    p_customer_name: name || 'ลูกค้าหน้าร้าน',
    p_source: 'walk_in_full',
    p_items: built.items as unknown as Json,
    p_total_satang: built.totalSatang,
  });
  if (error || !data?.queue_label) {
    console.error('walk-in insert_order failed:', error?.message);
    return { ok: false, error: 'failed' };
  }
  return { ok: true, label: data.queue_label, totalSatang: built.totalSatang };
}

// Stock and availability ---------------------------------------------------------------

/** ของหมด: customers see it through Realtime and can't pick anything that uses it. */
export async function setIngredientAvailable(
  s: Session,
  shopId: string,
  ingredientId: string,
  available: boolean,
): Promise<{ ok: true } | Fail<'not_found'>> {
  assertVendorOf(s, shopId);
  const db = createAdminClient();
  const { data } = await db
    .from('ingredients')
    .update({ is_available: !!available })
    .eq('id', ingredientId)
    .eq('shop_id', shopId)
    .select('id');
  if (!data?.length) return { ok: false, error: 'not_found' };
  await logEvent(db, s, shopId, 'ingredient_toggled', {
    ingredient_id: ingredientId,
    available: !!available,
  });
  return { ok: true };
}

export async function setMenuAvailable(
  s: Session,
  shopId: string,
  menuId: string,
  available: boolean,
): Promise<{ ok: true } | Fail<'not_found'>> {
  assertVendorOf(s, shopId);
  const { data } = await createAdminClient()
    .from('menus')
    .update({ is_available: !!available })
    .eq('id', menuId)
    .eq('shop_id', shopId)
    .is('deleted_at', null)
    .select('id');
  return data?.length ? { ok: true } : { ok: false, error: 'not_found' };
}

/** Everything of one shop that a price or availability edit may touch. */
async function loadOwned(db: Db, shopId: string) {
  const { data: menus } = await db.from('menus').select('id').eq('shop_id', shopId);
  const menuIds = (menus ?? []).map((m) => m.id);
  const { data: groups } = await db.from('option_groups').select('id').in('menu_id', menuIds);
  const groupIds = (groups ?? []).map((g) => g.id);
  const { data: options } = await db.from('options').select('id').in('group_id', groupIds);
  const { data: variants } = await db
    .from('menu_variants')
    .select('id, menu_id, option_ids')
    .in('menu_id', menuIds);
  return {
    menus: new Set(menuIds),
    groups: new Set(groupIds),
    options: new Set((options ?? []).map((o) => o.id)),
    variants: variants ?? [],
  };
}

export async function setOptionAvailable(
  s: Session,
  shopId: string,
  optionId: string,
  available: boolean,
): Promise<{ ok: true } | Fail<'not_found'>> {
  assertVendorOf(s, shopId);
  const db = createAdminClient();
  const owned = await loadOwned(db, shopId);
  if (!owned.options.has(optionId)) return { ok: false, error: 'not_found' };
  const { error } = await db
    .from('options')
    .update({ is_available: !!available })
    .eq('id', optionId);
  return error ? { ok: false, error: 'not_found' } : { ok: true };
}

// Prices -------------------------------------------------------------------------------

export type PriceChange =
  | { kind: 'base'; menuId: string; satang: number }
  | { kind: 'variant'; menuId: string; optionIds: string[]; satang: number }
  | { kind: 'tier'; groupId: string; count: number; satang: number }
  | { kind: 'delta'; optionId: string; satang: number };

const MAX_PRICE_SATANG = 100_000; // ฿1,000

const isInt = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
const isId = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f-]{36}$/.test(v);

/**
 * Saves edited prices in satang: base price, each variant row, each tier row, each
 * option delta. New prices apply to new orders only; placed orders keep their snapshot.
 */
export async function savePrices(
  s: Session,
  shopId: string,
  raw: unknown,
): Promise<{ ok: true; changed: number } | Fail<'bad_input' | 'not_found' | 'failed'>> {
  assertVendorOf(s, shopId);
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 500)
    return { ok: false, error: 'bad_input' };

  const db = createAdminClient();
  const owned = await loadOwned(db, shopId);
  const updates: PromiseLike<{ error: { message: string } | null }>[] = [];

  for (const c of raw as Record<string, unknown>[]) {
    if (typeof c !== 'object' || c === null) return { ok: false, error: 'bad_input' };
    if (c.kind === 'base') {
      if (!isId(c.menuId) || !isInt(c.satang, 1, MAX_PRICE_SATANG))
        return { ok: false, error: 'bad_input' };
      if (!owned.menus.has(c.menuId)) return { ok: false, error: 'not_found' };
      updates.push(db.from('menus').update({ base_price_satang: c.satang }).eq('id', c.menuId));
    } else if (c.kind === 'variant') {
      if (
        !isId(c.menuId) ||
        !Array.isArray(c.optionIds) ||
        !c.optionIds.every(isId) ||
        !isInt(c.satang, 1, MAX_PRICE_SATANG)
      ) {
        return { ok: false, error: 'bad_input' };
      }
      const key = [...(c.optionIds as string[])].sort().join('|');
      const row = owned.variants.find(
        (v) => v.menu_id === c.menuId && [...v.option_ids].sort().join('|') === key,
      );
      if (!row) return { ok: false, error: 'not_found' };
      updates.push(db.from('menu_variants').update({ price_satang: c.satang }).eq('id', row.id));
    } else if (c.kind === 'tier') {
      if (!isId(c.groupId) || !isInt(c.count, 1, 20) || !isInt(c.satang, 1, MAX_PRICE_SATANG))
        return { ok: false, error: 'bad_input' };
      if (!owned.groups.has(c.groupId)) return { ok: false, error: 'not_found' };
      updates.push(
        db
          .from('group_tier_prices')
          .update({ price_satang: c.satang })
          .eq('group_id', c.groupId)
          .eq('selected_count', c.count),
      );
    } else if (c.kind === 'delta') {
      if (!isId(c.optionId) || !isInt(c.satang, 0, MAX_PRICE_SATANG))
        return { ok: false, error: 'bad_input' };
      if (!owned.options.has(c.optionId)) return { ok: false, error: 'not_found' };
      updates.push(
        db.from('options').update({ price_delta_satang: c.satang }).eq('id', c.optionId),
      );
    } else {
      return { ok: false, error: 'bad_input' };
    }
  }

  const results = await Promise.all(updates);
  const failed = results.find((r) => r.error);
  if (failed) {
    console.error('savePrices failed:', failed.error?.message);
    return { ok: false, error: 'failed' };
  }
  await logEvent(db, s, shopId, 'price_changed', { changes: raw as unknown as Json });
  return { ok: true, changed: raw.length };
}

// Shop settings (the whitelist from PLAN.md §4b) ------------------------------------------

type ShopUpdate = Database['public']['Tables']['shops']['Update'];

const text = (v: unknown, max: number): v is string =>
  typeof v === 'string' && [...v.trim()].length >= 1 && [...v.trim()].length <= max;

/**
 * Only these fields can ever change: name, category, queue_prefix, is_open, wait_mode,
 * manual_seconds_per_item, allow_item_note, allow_allergy_note. Anything else is ignored.
 */
export async function updateShopSettings(
  s: Session,
  shopId: string,
  raw: unknown,
): Promise<{ ok: true } | Fail<'bad_input'>> {
  assertVendorOf(s, shopId);
  if (typeof raw !== 'object' || raw === null) return { ok: false, error: 'bad_input' };
  const input = raw as Record<string, unknown>;
  const update: ShopUpdate = {};

  if ('name' in input) {
    if (!text(input.name, 80)) return { ok: false, error: 'bad_input' };
    update.name = input.name.trim();
  }
  if ('category' in input) {
    if (!text(input.category, 80)) return { ok: false, error: 'bad_input' };
    update.category = input.category.trim();
  }
  if ('queue_prefix' in input) {
    if (!text(input.queue_prefix, 8)) return { ok: false, error: 'bad_input' };
    update.queue_prefix = input.queue_prefix.trim();
  }
  for (const key of ['is_open', 'allow_item_note', 'allow_allergy_note'] as const) {
    if (key in input) {
      if (typeof input[key] !== 'boolean') return { ok: false, error: 'bad_input' };
      update[key] = input[key] as boolean;
    }
  }
  if ('wait_mode' in input) {
    if (input.wait_mode !== 'auto' && input.wait_mode !== 'manual')
      return { ok: false, error: 'bad_input' };
    update.wait_mode = input.wait_mode;
  }
  if ('manual_seconds_per_item' in input) {
    if (!isInt(input.manual_seconds_per_item, 10, 3600)) return { ok: false, error: 'bad_input' };
    update.manual_seconds_per_item = input.manual_seconds_per_item;
  }
  if (Object.keys(update).length === 0) return { ok: false, error: 'bad_input' };

  const { error } = await createAdminClient().from('shops').update(update).eq('id', shopId);
  return error ? { ok: false, error: 'bad_input' } : { ok: true };
}
