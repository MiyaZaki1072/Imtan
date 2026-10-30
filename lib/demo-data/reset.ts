import 'server-only';

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import type { Database } from '../database.types';
import { createAdminClient } from '../supabase/admin';
import { parseDemoData } from './parse';
import { shopUuid } from './seed-sql';
import { uuidV5 } from './uuid';

type Db = ReturnType<typeof createAdminClient>;
type Insert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];

const id = (key: string) => uuidV5(key);

function check(error: { message: string } | null, what: string) {
  if (error) throw new Error(`reset ${what}: ${error.message}`);
}

/**
 * "Reset demo" (PLAN.md §5d): puts one shop (or all) back to the YAML seed. Prices,
 * availability and shop settings are restored with the same ids and values as seed.sql;
 * today's orders and queue counters are wiped so numbers start again at 1.
 * Events are kept for the research log.
 */
export async function resetDemo(slug: string | 'all'): Promise<{ shops: number }> {
  const db: Db = createAdminClient();
  const yaml = parseDemoData(
    parse(readFileSync(path.join(process.cwd(), 'data', 'demo-shops.yaml'), 'utf8')),
  );
  const shops = yaml.shops.filter((s) => slug === 'all' || s.slug === slug);

  for (const shop of shops) {
    const shopId = shopUuid(shop.slug);

    // Orders first: today's numbers would collide with a reset counter.
    const { data: day } = await db.rpc('current_day');
    const { error: delOrders } = await db
      .from('orders')
      .delete()
      .eq('shop_id', shopId)
      .or(`day.eq.${day},day.is.null`);
    check(delOrders, 'orders');
    check(
      (
        await db
          .from('shop_daily_counters')
          .delete()
          .eq('shop_id', shopId)
          .eq('day', day as string)
      ).error,
      'counters',
    );

    const shopRow: Insert<'shops'> = {
      id: shopId,
      slug: shop.slug,
      name: shop.name,
      category: shop.category,
      queue_prefix: shop.queuePrefix,
      is_open: true,
      allow_item_note: shop.allowItemNote,
      allow_allergy_note: shop.allowAllergyNote,
      wait_mode: shop.waitMode,
      manual_seconds_per_item: shop.manualSecondsPerItem,
      auto_advance: false,
    };
    check((await db.from('shops').upsert(shopRow, { onConflict: 'id' })).error, 'shop');

    const ingredientIds = (key: string) => id(`ingredient:${key}`);

    // Vendors may have added menus, groups, options or ingredients (Phase 7): drop everything
    // that is not in the seed, and rebuild each seed menu's structure below.
    const seedMenuIds = shop.menus.map((m) => id(`menu:${m.id}`));
    const { error: delMenus } = await db
      .from('menus')
      .delete()
      .eq('shop_id', shopId)
      .not('id', 'in', `(${seedMenuIds.join(',')})`);
    check(delMenus, 'extra menus');
    check(
      (await db.from('menu_variants').delete().in('menu_id', seedMenuIds)).error,
      'old variants',
    );
    check(
      (await db.from('menu_ingredients').delete().in('menu_id', seedMenuIds)).error,
      'old links',
    );
    check((await db.from('option_groups').delete().in('menu_id', seedMenuIds)).error, 'old groups');
    check(
      (
        await db.from('ingredients').upsert(
          shop.ingredients.map((i) => ({
            id: ingredientIds(i.id),
            shop_id: shopId,
            name: i.name,
            is_available: true,
          })),
          { onConflict: 'id' },
        )
      ).error,
      'ingredients',
    );
    const seedIngredientIds = shop.ingredients.map((i) => ingredientIds(i.id));
    check(
      (
        await db
          .from('ingredients')
          .delete()
          .eq('shop_id', shopId)
          .not('id', 'in', `(${seedIngredientIds.join(',')})`)
      ).error,
      'extra ingredients',
    );

    const menus: Insert<'menus'>[] = [];
    const links: Insert<'menu_ingredients'>[] = [];
    const groups: Insert<'option_groups'>[] = [];
    const options: Insert<'options'>[] = [];
    const variants: Insert<'menu_variants'>[] = [];
    const tiers: Insert<'group_tier_prices'>[] = [];
    shop.menus.forEach((m, mi) => {
      const menuId = id(`menu:${m.id}`);
      menus.push({
        id: menuId,
        shop_id: shopId,
        category: m.category,
        name: m.name,
        cook_seconds: m.cookSeconds,
        base_price_satang: m.basePriceSatang,
        pair_only: m.pairOnly,
        is_available: true,
        deleted_at: null,
        sort: mi,
      });
      for (const ingId of m.ingredientIds)
        links.push({ menu_id: menuId, ingredient_id: ingredientIds(ingId) });
      m.groups.forEach((g, gi) => {
        const groupId = id(`group:${g.id}`);
        groups.push({
          id: groupId,
          menu_id: menuId,
          name: g.name,
          kind: g.kind,
          min_select: g.minSelect,
          max_select: g.maxSelect,
          sort: gi,
          show_when_group_id: g.showWhen ? id(`group:${g.showWhen.groupId}`) : null,
          show_when_option_ids: g.showWhen
            ? g.showWhen.optionIds.map((o) => id(`option:${o}`))
            : null,
          select_all_label: g.selectAllLabel,
          note: g.note,
        });
        g.options.forEach((o, oi) =>
          options.push({
            id: id(`option:${o.id}`),
            group_id: groupId,
            name: o.name,
            price_delta_satang: o.priceDeltaSatang,
            ingredient_id: o.ingredientId ? ingredientIds(o.ingredientId) : null,
            is_default: o.isDefault,
            is_available: true,
            sort: oi,
          }),
        );
        for (const t of g.tierPrices) {
          tiers.push({
            group_id: groupId,
            selected_count: t.selectedCount,
            price_satang: t.priceSatang,
          });
        }
      });
      for (const v of m.variants) {
        const optionIds = v.optionIds.map((o) => id(`option:${o}`)).sort();
        variants.push({
          id: id(`variant:${m.id}:${optionIds.join(',')}`),
          menu_id: menuId,
          option_ids: optionIds,
          price_satang: v.priceSatang,
          is_available: true,
        });
      }
    });

    check((await db.from('menus').upsert(menus, { onConflict: 'id' })).error, 'menus');
    check((await db.from('menu_ingredients').insert(links)).error, 'links');
    check((await db.from('option_groups').insert(groups)).error, 'groups');
    check((await db.from('options').upsert(options, { onConflict: 'id' })).error, 'options');
    check(
      (await db.from('menu_variants').upsert(variants, { onConflict: 'id' })).error,
      'variants',
    );
    if (tiers.length) {
      check(
        (
          await db
            .from('group_tier_prices')
            .upsert(tiers, { onConflict: 'group_id,selected_count' })
        ).error,
        'tiers',
      );
    }
    await db.rpc('refresh_shop_stats', { p_shop_id: shopId });
  }
  return { shops: shops.length };
}
