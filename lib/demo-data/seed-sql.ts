// Builds supabase/seed.sql from the parsed YAML (PLAN.md §4a mapping, prices in satang).
// Every statement is an upsert on stable ids, so the file can run again to restore
// availability and prices ("Reset demo").

import type { Shop } from '../menu/types';
import type { DemoData } from './parse';
import { uuidV5 } from './uuid';

const id = (key: string) => uuidV5(key);
export const shopUuid = (slug: string) => id(`shop:${slug}`);

function lit(value: string | number | boolean | null): string {
  if (value === null) return 'null';
  if (typeof value === 'number') {
    if (!Number.isInteger(value)) throw new Error(`non-integer in seed: ${value}`);
    return String(value);
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return `'${value.replace(/'/g, "''")}'`;
}

function uuidArray(ids: string[]): string {
  return `array[${ids.map((x) => `'${x}'`).join(', ')}]::uuid[]`;
}

function upsert(
  table: string,
  columns: string[],
  rows: string[][],
  conflict: string,
  update: string[] | 'nothing',
): string {
  if (rows.length === 0) return '';
  const values = rows.map((r) => `  (${r.join(', ')})`).join(',\n');
  const action =
    update === 'nothing'
      ? 'do nothing'
      : `do update set ${update.map((c) => `${c} = excluded.${c}`).join(', ')}`;
  return `insert into public.${table} (${columns.join(', ')}) values\n${values}\non conflict (${conflict}) ${action};\n`;
}

function shopSql(shop: Shop): string {
  const shopId = shopUuid(shop.slug);
  const ing = (key: string) => id(`ingredient:${key}`);
  const out: string[] = [`-- ${shop.name} (${shop.slug})`];

  out.push(
    upsert(
      'shops',
      [
        'id',
        'slug',
        'name',
        'category',
        'queue_prefix',
        'is_open',
        'allow_item_note',
        'allow_allergy_note',
        'wait_mode',
        'manual_seconds_per_item',
      ],
      [
        [
          lit(shopId),
          lit(shop.slug),
          lit(shop.name),
          lit(shop.category),
          lit(shop.queuePrefix),
          'true',
          lit(shop.allowItemNote),
          lit(shop.allowAllergyNote),
          lit(shop.waitMode),
          lit(shop.manualSecondsPerItem),
        ],
      ],
      'id',
      [
        'slug',
        'name',
        'category',
        'queue_prefix',
        'is_open',
        'allow_item_note',
        'allow_allergy_note',
        'wait_mode',
        'manual_seconds_per_item',
      ],
    ),
  );

  out.push(
    upsert(
      'ingredients',
      ['id', 'shop_id', 'name', 'is_available'],
      shop.ingredients.map((i) => [lit(ing(i.id)), lit(shopId), lit(i.name), 'true']),
      'id',
      ['name', 'is_available'],
    ),
  );

  const menus: string[][] = [];
  const menuIngredients: string[][] = [];
  const groups: string[][] = [];
  const options: string[][] = [];
  const variants: string[][] = [];
  const tiers: string[][] = [];

  shop.menus.forEach((m, mi) => {
    const menuId = id(`menu:${m.id}`);
    menus.push([
      lit(menuId),
      lit(shopId),
      lit(m.category),
      lit(m.name),
      lit(m.cookSeconds),
      lit(m.basePriceSatang),
      lit(m.pairOnly),
      'true',
      'null',
      lit(mi),
    ]);
    for (const ingId of m.ingredientIds) menuIngredients.push([lit(menuId), lit(ing(ingId))]);

    m.groups.forEach((g, gi) => {
      const groupId = id(`group:${g.id}`);
      groups.push([
        lit(groupId),
        lit(menuId),
        lit(g.name),
        lit(g.kind),
        lit(g.minSelect),
        lit(g.maxSelect),
        lit(gi),
        g.showWhen ? lit(id(`group:${g.showWhen.groupId}`)) : 'null',
        g.showWhen ? uuidArray(g.showWhen.optionIds.map((o) => id(`option:${o}`))) : 'null',
        lit(g.selectAllLabel),
        lit(g.note),
      ]);
      g.options.forEach((o, oi) => {
        options.push([
          lit(id(`option:${o.id}`)),
          lit(groupId),
          lit(o.name),
          lit(o.priceDeltaSatang),
          o.ingredientId ? lit(ing(o.ingredientId)) : 'null',
          lit(o.isDefault),
          'true',
          lit(oi),
        ]);
      });
      for (const t of g.tierPrices) {
        tiers.push([lit(groupId), lit(t.selectedCount), lit(t.priceSatang)]);
      }
    });

    for (const v of m.variants) {
      // Sorted, matching lib/menu basePrice().
      const optionIds = v.optionIds.map((o) => id(`option:${o}`)).sort();
      variants.push([
        lit(id(`variant:${m.id}:${optionIds.join(',')}`)),
        lit(menuId),
        uuidArray(optionIds),
        lit(v.priceSatang),
        'true',
      ]);
    }
  });

  out.push(
    upsert(
      'menus',
      [
        'id',
        'shop_id',
        'category',
        'name',
        'cook_seconds',
        'base_price_satang',
        'pair_only',
        'is_available',
        'deleted_at',
        'sort',
      ],
      menus,
      'id',
      [
        'category',
        'name',
        'cook_seconds',
        'base_price_satang',
        'pair_only',
        'is_available',
        'deleted_at',
        'sort',
      ],
    ),
  );
  out.push(
    upsert(
      'menu_ingredients',
      ['menu_id', 'ingredient_id'],
      menuIngredients,
      'menu_id, ingredient_id',
      'nothing',
    ),
  );
  out.push(
    upsert(
      'option_groups',
      [
        'id',
        'menu_id',
        'name',
        'kind',
        'min_select',
        'max_select',
        'sort',
        'show_when_group_id',
        'show_when_option_ids',
        'select_all_label',
        'note',
      ],
      groups,
      'id',
      [
        'name',
        'kind',
        'min_select',
        'max_select',
        'sort',
        'show_when_group_id',
        'show_when_option_ids',
        'select_all_label',
        'note',
      ],
    ),
  );
  out.push(
    upsert(
      'options',
      [
        'id',
        'group_id',
        'name',
        'price_delta_satang',
        'ingredient_id',
        'is_default',
        'is_available',
        'sort',
      ],
      options,
      'id',
      ['name', 'price_delta_satang', 'ingredient_id', 'is_default', 'is_available', 'sort'],
    ),
  );
  out.push(
    upsert(
      'menu_variants',
      ['id', 'menu_id', 'option_ids', 'price_satang', 'is_available'],
      variants,
      'id',
      ['option_ids', 'price_satang', 'is_available'],
    ),
  );
  out.push(
    upsert(
      'group_tier_prices',
      ['group_id', 'selected_count', 'price_satang'],
      tiers,
      'group_id, selected_count',
      ['price_satang'],
    ),
  );

  return out.filter(Boolean).join('\n');
}

export function buildSeedSql(data: DemoData): string {
  const header = [
    '-- GENERATED by `npm run seed` from data/demo-shops.yaml. Do not edit by hand.',
    '-- Prices are satang (baht × 100). Re-running restores menus, prices and availability.',
    '-- Login accounts are not here: `npm run seed:accounts` creates them from env.',
    '',
  ].join('\n');
  return header + data.shops.map(shopSql).join('\n') + '\n';
}
