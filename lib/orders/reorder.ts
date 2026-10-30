import 'server-only';

import { ingredientMap, menuAvailability, validate, type Selections } from '../menu';
import { loadShopBySlug } from '../menu/db';
import { createAdminClient } from '../supabase/admin';

export interface ReorderLine {
  menuId: string;
  selections: Selections;
  qty: number;
  note: string;
}

export type ReorderResult =
  | { ok: true; shopSlug: string; lines: ReorderLine[]; dropped: string[] }
  | { ok: false; error: 'not_found' | 'shop_closed' };

/**
 * "สั่งอีก": turns a past order back into cart lines against today's menu. A line is kept only
 * if its menu is still on sale and its exact choices are still valid (nothing sold out,
 * nothing removed); anything else is dropped and reported by name. Only the owner can reorder.
 */
export async function reorderFrom(userId: string, orderId: string): Promise<ReorderResult> {
  const db = createAdminClient();
  const { data: order } = await db
    .from('orders')
    .select('id, shops(slug), order_items(menu_id, menu_name, selections, qty, note)')
    .eq('id', orderId)
    .eq('customer_id', userId)
    .maybeSingle();
  if (!order?.shops) return { ok: false, error: 'not_found' };

  const loaded = await loadShopBySlug(db, order.shops.slug);
  if (!loaded) return { ok: false, error: 'not_found' };
  const { shop } = loaded;
  if (!shop.isOpen) return { ok: false, error: 'shop_closed' };
  const ing = ingredientMap(shop.ingredients);

  const lines: ReorderLine[] = [];
  const dropped: string[] = [];
  for (const item of order.order_items ?? []) {
    const menu = shop.menus.find((m) => m.id === item.menu_id && !m.isDeleted);
    const raw = item.selections;
    const selections: Selections | null =
      typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? (raw as Selections) : null;
    const v = menu && selections ? validate(menu, selections, ing) : null;
    if (!menu || !v?.ok || !menuAvailability(menu, ing).available) {
      dropped.push(item.menu_name);
      continue;
    }
    lines.push({
      menuId: menu.id,
      selections: v.selections,
      qty: item.qty,
      note: shop.allowItemNote ? (item.note ?? '') : '',
    });
  }
  return { ok: true, shopSlug: shop.slug, lines, dropped };
}
