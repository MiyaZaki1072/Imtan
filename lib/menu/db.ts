// Loads one shop's menu from the database into the lib/menu model.
// The database is the truth for prices and availability; the YAML only seeds it.
// Takes a client so server code (service role) and scripts can both use it.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../database.types';
import type { BusyLevel } from '../queue';
import type { Menu, OptionGroup, Shop } from './types';

export interface ShopLiveStats {
  itemsInQueue: number;
  estWaitSeconds: number;
  busyLevel: BusyLevel;
  secondsPerItem: number;
}

export interface LoadedShop {
  shop: Shop;
  stats: ShopLiveStats;
}

/** Unwraps a Supabase list result; an empty list comes back as []. */
function rows<T>(
  result: { data: T[] | null; error: { message: string } | null },
  what: string,
): T[] {
  if (result.error) throw new Error(`load ${what}: ${result.error.message}`);
  return result.data ?? [];
}

export async function loadShopBySlug(
  db: SupabaseClient<Database>,
  slug: string,
): Promise<LoadedShop | null> {
  const shopResult = await db.from('shops').select('*').eq('slug', slug).maybeSingle();
  if (shopResult.error) throw new Error(`load shop: ${shopResult.error.message}`);
  const shopRow = shopResult.data;
  if (!shopRow) return null;

  const [ingredients, menus] = await Promise.all([
    db.from('ingredients').select('id, name, is_available').eq('shop_id', shopRow.id).order('name'),
    db.from('menus').select('*').eq('shop_id', shopRow.id).order('sort'),
  ]).then(([i, m]) => [rows(i, 'ingredients'), rows(m, 'menus')] as const);

  const menuIds = menus.map((m) => m.id);
  const [links, groups, variants] = await Promise.all([
    db.from('menu_ingredients').select('menu_id, ingredient_id').in('menu_id', menuIds),
    db.from('option_groups').select('*').in('menu_id', menuIds).order('sort'),
    db
      .from('menu_variants')
      .select('menu_id, option_ids, price_satang, is_available')
      .in('menu_id', menuIds),
  ]).then(
    ([l, g, v]) =>
      [rows(l, 'menu_ingredients'), rows(g, 'option_groups'), rows(v, 'menu_variants')] as const,
  );

  const groupIds = groups.map((g) => g.id);
  const [options, tiers] = await Promise.all([
    db.from('options').select('*').in('group_id', groupIds).order('sort'),
    db.from('group_tier_prices').select('*').in('group_id', groupIds),
  ]).then(([o, t]) => [rows(o, 'options'), rows(t, 'group_tier_prices')] as const);

  const toGroup = (g: (typeof groups)[number]): OptionGroup => ({
    id: g.id,
    name: g.name,
    kind: g.kind,
    minSelect: g.min_select,
    maxSelect: g.max_select,
    showWhen:
      g.show_when_group_id && g.show_when_option_ids
        ? { groupId: g.show_when_group_id, optionIds: g.show_when_option_ids }
        : null,
    selectAllLabel: g.select_all_label,
    note: g.note,
    options: options
      .filter((o) => o.group_id === g.id)
      .map((o) => ({
        id: o.id,
        name: o.name,
        priceDeltaSatang: o.price_delta_satang,
        ingredientId: o.ingredient_id,
        isDefault: o.is_default,
        isAvailable: o.is_available,
      })),
    tierPrices: tiers
      .filter((t) => t.group_id === g.id)
      .map((t) => ({ selectedCount: t.selected_count, priceSatang: t.price_satang }))
      .sort((a, b) => a.selectedCount - b.selectedCount),
  });

  const toMenu = (m: (typeof menus)[number]): Menu => ({
    id: m.id,
    category: m.category,
    name: m.name,
    cookSeconds: m.cook_seconds,
    basePriceSatang: m.base_price_satang,
    pairOnly: m.pair_only,
    isAvailable: m.is_available,
    isDeleted: m.deleted_at !== null,
    ingredientIds: links.filter((l) => l.menu_id === m.id).map((l) => l.ingredient_id),
    groups: groups.filter((g) => g.menu_id === m.id).map(toGroup),
    variants: variants
      .filter((v) => v.menu_id === m.id)
      .map((v) => ({
        optionIds: [...v.option_ids].sort(),
        priceSatang: v.price_satang,
        isAvailable: v.is_available,
      })),
  });

  const secondsPerItem =
    shopRow.wait_mode === 'manual'
      ? shopRow.manual_seconds_per_item
      : (shopRow.learned_seconds_per_item ?? shopRow.manual_seconds_per_item);

  return {
    shop: {
      id: shopRow.id,
      slug: shopRow.slug,
      name: shopRow.name,
      category: shopRow.category,
      queuePrefix: shopRow.queue_prefix,
      isOpen: shopRow.is_open,
      allowItemNote: shopRow.allow_item_note,
      allowAllergyNote: shopRow.allow_allergy_note,
      waitMode: shopRow.wait_mode,
      manualSecondsPerItem: shopRow.manual_seconds_per_item,
      ingredients: ingredients.map((i) => ({
        id: i.id,
        name: i.name,
        isAvailable: i.is_available,
      })),
      menus: menus.map(toMenu),
    },
    stats: {
      itemsInQueue: shopRow.items_in_queue,
      estWaitSeconds: shopRow.est_wait_seconds,
      busyLevel: shopRow.busy_level as BusyLevel,
      secondsPerItem,
    },
  };
}
