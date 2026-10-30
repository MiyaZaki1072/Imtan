// npm run check:phase3 — PLAN.md Phase 3 "Accept" checks against the hosted project.
// For every menu: the browser preview total equals the server total, and a tampered
// client price is ignored. Also checks that a sold-out ingredient flows through the
// database loader. It restores availability at the end.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { parse } from 'yaml';
import type { Database } from '../lib/database.types';
import { parseDemoData } from '../lib/demo-data/parse';
import { shopUuid } from '../lib/demo-data/seed-sql';
import {
  availableOptions,
  defaultSelections,
  ingredientMap,
  lineTotal,
  menuAvailability,
  validate,
  type Menu,
  type Shop,
} from '../lib/menu';
import { loadShopBySlug } from '../lib/menu/db';
import { buildOrder } from '../lib/orders/build';

const db = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const results: { name: string; ok: boolean; detail: string }[] = [];
const check = (name: string, ok: boolean, detail = '') => results.push({ name, ok, detail });

/** Defaults, plus the first available picks for a required group with no default. */
function sampleSelections(m: Menu, s: Shop) {
  const ing = ingredientMap(s.ingredients);
  const sel = defaultSelections(m, ing);
  for (const g of m.groups) {
    if ((sel[g.id]?.length ?? 0) < g.minSelect) {
      sel[g.id] = availableOptions(g, ing)
        .slice(0, g.minSelect)
        .map((o) => o.id);
    }
  }
  return sel;
}

async function main() {
  const yaml = parseDemoData(
    parse(readFileSync(path.join(__dirname, '..', 'data', 'demo-shops.yaml'), 'utf8')),
  );

  // 1. Per menu: DB menu → preview total == server total; tampered price ignored.
  let menuCount = 0;
  const mismatches: string[] = [];
  const loadedShops: Shop[] = [];
  for (const y of yaml.shops) {
    const loaded = await loadShopBySlug(db, y.slug);
    if (!loaded) throw new Error(`shop ${y.slug} missing in DB`);
    const shop = loaded.shop;
    loadedShops.push(shop);
    const ing = ingredientMap(shop.ingredients);
    const main = shop.menus.find((m) => !m.pairOnly)!;
    for (const m of shop.menus) {
      menuCount++;
      const sel = sampleSelections(m, shop);
      const v = validate(m, sel, ing);
      const preview = v.ok ? lineTotal(m, v.selections, 2) : null;
      const lines: Record<string, unknown>[] = [
        {
          menuId: m.id,
          selections: sel,
          qty: 2,
          note: '',
          unitPriceSatang: 1,
          lineTotalSatang: 1,
          totalSatang: 1,
        },
      ];
      let expected = preview;
      if (expected !== null && (m.pairOnly || expected < 2000)) {
        const mainSel = sampleSelections(main, shop);
        lines.push({ menuId: main.id, selections: mainSel, qty: 1, note: '' });
        const mv = validate(main, mainSel, ing);
        expected += mv.ok ? (lineTotal(main, mv.selections, 1) ?? 0) : 0;
      }
      const built = buildOrder(shop, lines, '');
      if (!built.ok || expected === null || built.totalSatang !== expected) {
        mismatches.push(
          `${shop.slug} ${m.name}: preview ${expected} server ${built.ok ? built.totalSatang : built.error}`,
        );
      }
    }
  }
  check(
    `every menu: preview total == server total, tampered price ignored (${menuCount} menus)`,
    mismatches.length === 0 && menuCount === 33,
    mismatches.slice(0, 3).join(' | '),
  );

  // 2. DB menu data matches the YAML (prices in satang, ids differ so compare by names).
  const yamlVariants = yaml.shops.flatMap((s) =>
    s.menus.flatMap((m) => m.variants.map((v) => v.priceSatang)),
  );
  const dbVariants = loadedShops.flatMap((s) =>
    s.menus.flatMap((m) => m.variants.map((v) => v.priceSatang)),
  );
  check(
    'DB prices equal the YAML (127 variant prices)',
    yamlVariants.length === 127 &&
      JSON.stringify([...yamlVariants].sort()) === JSON.stringify([...dbVariants].sort()),
    `${yamlVariants.length} vs ${dbVariants.length}`,
  );

  // 3. หมูกรอบ sold out at เจ๊บึก flows through the loader and affects only that shop.
  const buek = shopUuid('jae-buek');
  const { error: offError } = await db
    .from('ingredients')
    .update({ is_available: false })
    .eq('shop_id', buek)
    .eq('name', 'หมูกรอบ');
  if (offError) throw offError;
  try {
    const afterBuek = (await loadShopBySlug(db, 'jae-buek'))!.shop;
    const ingB = ingredientMap(afterBuek.ingredients);
    const buekHit = afterBuek.menus.flatMap((m) =>
      m.groups.flatMap((g) =>
        g.options.filter((o) => o.ingredientId && ingB.get(o.ingredientId)?.name === 'หมูกรอบ'),
      ),
    );
    const buekAvail = buekHit.every(
      (o) => !availableOptions({ ...afterBuek.menus[0].groups[0], options: [o] }, ingB).length,
    );
    const afterTom = (await loadShopBySlug(db, 'tomyum-kaitoon'))!.shop;
    const crispy = afterTom.menus.find((m) => m.name === 'ข้าวหมูกรอบ')!;
    check(
      'หมูกรอบ sold out at เจ๊บึก: options disabled there, shop 2 unaffected',
      buekHit.length > 0 &&
        buekAvail &&
        menuAvailability(crispy, ingredientMap(afterTom.ingredients)).available,
      `${buekHit.length} options`,
    );
    // And the server refuses to order it.
    const m = afterBuek.menus.find((x) => x.name === 'ผัดกะเพรา')!;
    const sel = sampleSelections(m, afterBuek);
    const g = m.groups.find((x) => x.name === 'เนื้อสัตว์')!;
    sel[g.id] = [g.options.find((o) => o.name === 'หมูกรอบ')!.id];
    const refused = buildOrder(afterBuek, [{ menuId: m.id, selections: sel, qty: 1 }], '');
    check(
      'server refuses an order with the sold-out option',
      !refused.ok && refused.error === 'invalid_selections',
      JSON.stringify(refused),
    );
  } finally {
    await db
      .from('ingredients')
      .update({ is_available: true })
      .eq('shop_id', buek)
      .eq('name', 'หมูกรอบ');
  }
}

main()
  .catch((e) => check('script ran without error', false, String(e?.message ?? e)))
  .finally(() => {
    for (const r of results)
      console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.ok ? '' : `  (${r.detail})`}`);
    const failed = results.filter((r) => !r.ok).length;
    console.log(`\n${results.length - failed}/${results.length} passed`);
    process.exit(failed ? 1 : 0);
  });
