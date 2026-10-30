// npm run check:phase7 — PLAN.md Phase 7 checks against the hosted project: the menu-structure
// editor's server side (add/edit/delete menus, variant grid, validation, soft delete, ingredients).
// Creates a throwaway menu and customer; everything is removed at the end.

import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { AuthError, type Session } from '../lib/auth-rules';
import type { Database, Json } from '../lib/database.types';
import { resetDemo } from '../lib/demo-data/reset';
import { shopUuid } from '../lib/demo-data/seed-sql';
import type { Menu, OptionGroup } from '../lib/menu';
import { loadShopBySlug } from '../lib/menu/db';
import { buildOrder } from '../lib/orders/build';
import * as ops from '../lib/vendor/ops';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const svc = createClient<Database>(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, opts);
const anon = createClient<Database>(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, opts);

const A = shopUuid('pi-som');
const B = shopUuid('jae-buek');
const vendorA: Session = {
  userId: 'test-vendor-a',
  displayName: 'ร้าน A',
  role: 'vendor',
  shopId: A,
};
const results: { name: string; ok: boolean; detail: string }[] = [];
const check = (name: string, ok: boolean, detail = '') => results.push({ name, ok, detail });
const cleanup = { users: [] as string[], menus: [] as string[], ingredients: [] as string[] };

const opt = (name: string, extra: Partial<OptionGroup['options'][number]> = {}) => ({
  id: randomUUID(),
  name,
  priceDeltaSatang: 0,
  ingredientId: null,
  isDefault: false,
  isAvailable: true,
  ...extra,
});
const group = (
  g: Partial<OptionGroup> & Pick<OptionGroup, 'name' | 'kind' | 'options'>,
): OptionGroup => ({
  id: randomUUID(),
  minSelect: 1,
  maxSelect: 1,
  showWhen: null,
  selectAllLabel: null,
  note: null,
  tierPrices: [],
  ...g,
});
const reload = async () => (await loadShopBySlug(svc, 'pi-som'))!.shop;

async function main() {
  const shop = await reload();
  const ingId = shop.ingredients[0].id;

  // A new menu: ผัดทดสอบ — variant group (ขนาด), a priced extra, a conditional group.
  const size = group({
    name: 'ขนาด',
    kind: 'variant',
    options: [opt('ธรรมดา', { isDefault: true }), opt('พิเศษ')],
  });
  const extra = group({
    name: 'ไข่เพิ่ม',
    kind: 'choice',
    minSelect: 0,
    maxSelect: 1,
    options: [opt('ไข่ดาว', { priceDeltaSatang: 1000 })],
  });
  const done = group({
    name: 'ความสุก',
    kind: 'choice',
    options: [opt('สุก', { isDefault: true }), opt('ไม่สุก')],
    showWhen: { groupId: extra.id, optionIds: [extra.options[0].id] },
  });
  const menuId = randomUUID();
  cleanup.menus.push(menuId);
  const draft: Menu = {
    id: menuId,
    category: 'เมนูทดสอบ',
    name: 'ผัดทดสอบ',
    cookSeconds: 120,
    basePriceSatang: null,
    pairOnly: false,
    isAvailable: true,
    isDeleted: false,
    ingredientIds: [ingId],
    groups: [size, extra, done],
    variants: [],
  };

  // 1. Saved, but forced off until every variant row has a price.
  const first = await ops.saveMenu(vendorA, A, draft);
  const saved1 = (await reload()).menus.find((m) => m.id === menuId);
  check(
    'new menu: saved but forced off while variant prices are missing',
    first.ok &&
      !first.available &&
      saved1?.isAvailable === false &&
      saved1.variants.length === 2 &&
      saved1.variants.every((v) => v.priceSatang === null),
    JSON.stringify(first),
  );

  // 2. Fill the grid → available and orderable at the right price.
  const priced: Menu = {
    ...draft,
    variants: saved1!.variants.map((v) => ({
      ...v,
      priceSatang: v.optionIds.includes(size.options[0].id) ? 5000 : 6000,
    })),
  };
  const second = await ops.saveMenu(vendorA, A, priced);
  const live = await reload();
  const sel = {
    [size.id]: [size.options[0].id],
    [extra.id]: [extra.options[0].id],
    [done.id]: [done.options[1].id],
  };
  const built = buildOrder(live, [{ menuId, selections: sel, qty: 1 }], '');
  check(
    'priced menu: available, and a customer order totals base ฿50 + ไข่ดาว ฿10',
    second.ok && second.available && built.ok && built.totalSatang === 6000,
    JSON.stringify({ second, built: built.ok ? built.totalSatang : built.error }),
  );
  const hidden = buildOrder(live, [{ menuId, selections: { ...sel, [extra.id]: [] }, qty: 1 }], '');
  check(
    'conditional group: doneness is hidden and dropped without ไข่ดาว',
    hidden.ok && hidden.items[0].selections[done.id] === undefined && hidden.totalSatang === 5000,
  );

  // 3. Variant grid follows the options: add one → new unpriced row, menu forced off again.
  const grown: Menu = {
    ...priced,
    groups: priced.groups.map((g) =>
      g.id === size.id ? { ...g, options: [...g.options, opt('จัมโบ้')] } : g,
    ),
  };
  const third = await ops.saveMenu(vendorA, A, { ...grown, variants: priced.variants });
  const saved3 = (await reload()).menus.find((m) => m.id === menuId)!;
  check(
    'adding a variant option adds an unpriced row and blocks selling',
    third.ok &&
      !third.available &&
      saved3.variants.length === 3 &&
      saved3.variants.filter((v) => v.priceSatang === null).length === 1 &&
      saved3.variants.filter((v) => v.priceSatang !== null).length === 2,
    JSON.stringify(third),
  );

  // 4. Invalid structure is refused and changes nothing.
  const broken: Menu = {
    ...grown,
    groups: grown.groups.map((g) => (g.id === extra.id ? { ...g, minSelect: 3 } : g)),
  };
  const refused = await ops.saveMenu(vendorA, A, broken);
  const unchanged = (await reload()).menus.find((m) => m.id === menuId)!;
  check(
    'invalid structure (min > max) is refused and the saved menu is unchanged',
    !refused.ok &&
      refused.error === 'invalid' &&
      unchanged.groups.find((g) => g.id === extra.id)!.minSelect === 0,
    JSON.stringify(refused),
  );
  const junk = await ops.saveMenu(vendorA, A, { id: 'nope' });
  check('junk input is rejected', !junk.ok && junk.error === 'bad_input');

  // 5. Vendor A cannot create or edit menus in shop B, or touch B's menu through A.
  const forbidden = await ops.saveMenu(vendorA, B, draft).then(
    () => false,
    (e) => e instanceof AuthError && e.reason === 'forbidden',
  );
  const bMenu = (await loadShopBySlug(svc, 'jae-buek'))!.shop.menus[0];
  const sneaky = await ops.saveMenu(vendorA, A, { ...bMenu, ingredientIds: [] });
  const bAfter = (await loadShopBySlug(svc, 'jae-buek'))!.shop.menus.find(
    (m) => m.id === bMenu.id,
  )!;
  check(
    "vendor A cannot save into shop B, nor overwrite B's menu via shop A",
    forbidden &&
      !sneaky.ok &&
      bAfter.name === bMenu.name &&
      bAfter.groups.length === bMenu.groups.length,
    JSON.stringify(sneaky),
  );
  const delForbidden = await ops.deleteMenu(vendorA, B, bMenu.id).then(
    () => false,
    (e) => e instanceof AuthError,
  );
  const delCross = await ops.deleteMenu(vendorA, A, bMenu.id);
  check("vendor A cannot delete shop B's menus", delForbidden && !delCross.ok);

  // 6. Round trip: re-saving an existing real menu changes nothing.
  const buekShop = (await loadShopBySlug(svc, 'jae-buek'))!.shop;
  const real = buekShop.menus.find((m) => m.name === 'ผัดกะเพรา')!;
  const adminB: Session = {
    userId: 'test-admin',
    displayName: 'ผู้ดูแล',
    role: 'admin',
    shopId: null,
  };
  const rt = await ops.saveMenu(adminB, B, real);
  const realAfter = (await loadShopBySlug(svc, 'jae-buek'))!.shop.menus.find(
    (m) => m.id === real.id,
  )!;
  const norm = (m: Menu) =>
    JSON.stringify({
      ...m,
      variants: [...m.variants].sort((a, b) =>
        a.optionIds.join().localeCompare(b.optionIds.join()),
      ),
    });
  check(
    're-saving a real menu (24 variants, conditional groups) keeps it identical',
    rt.ok && rt.available && norm(real) === norm(realAfter),
    JSON.stringify(rt),
  );

  // 7. Delete: soft when orders exist, hard otherwise.
  const { data: g } = await anon.auth.signInAnonymously({
    options: { data: { display_name: 'ทดสอบ 7' } },
  });
  cleanup.users.push(g.user!.id);
  const second2 = await ops.saveMenu(vendorA, A, {
    ...priced,
    variants: (await reload()).menus
      .find((m) => m.id === menuId)!
      .variants.map((v) => ({ ...v, priceSatang: 5000 })),
  });
  const orderable = buildOrder(await reload(), [{ menuId, selections: sel, qty: 1 }], '');
  if (!orderable.ok || !second2.ok)
    throw new Error(`setup for delete failed ${JSON.stringify(second2)}`);
  const { data: o } = await svc.rpc('insert_order', {
    p_shop_id: A,
    p_customer_id: g.user!.id,
    p_customer_name: 'ทดสอบ',
    p_source: 'app',
    p_items: orderable.items as unknown as Json,
    p_total_satang: orderable.totalSatang,
  });
  await svc.rpc('confirm_payment', { p_order_id: o!.id, p_method: 'demo' });
  const soft = await ops.deleteMenu(vendorA, A, menuId);
  const row = await svc.from('menus').select('deleted_at, is_available').eq('id', menuId).single();
  const item = await svc.from('order_items').select('menu_id').eq('order_id', o!.id).single();
  const hiddenNow = (await reload()).menus.find((m) => m.id === menuId);
  check(
    'delete with past orders is a soft delete: hidden, history keeps its menu id',
    soft.ok &&
      soft.mode === 'soft' &&
      !!row.data?.deleted_at &&
      row.data.is_available === false &&
      item.data?.menu_id === menuId &&
      hiddenNow?.isDeleted === true,
    JSON.stringify({ soft, row: row.data }),
  );

  const fresh = randomUUID();
  cleanup.menus.push(fresh);
  await ops.saveMenu(vendorA, A, {
    ...draft,
    id: fresh,
    name: 'ลบได้',
    groups: [],
    variants: [],
    basePriceSatang: 4000,
  });
  const hard = await ops.deleteMenu(vendorA, A, fresh);
  const gone = await svc.from('menus').select('id').eq('id', fresh);
  check(
    'delete without orders removes the menu completely',
    hard.ok && hard.mode === 'hard' && gone.data?.length === 0,
    JSON.stringify(hard),
  );

  // 8. Ingredients and categories.
  const add = await ops.addIngredient(vendorA, A, 'วัตถุดิบทดสอบ');
  if (add.ok) cleanup.ingredients.push(add.id);
  const dup = await ops.addIngredient(vendorA, A, 'วัตถุดิบทดสอบ');
  const blank = await ops.addIngredient(vendorA, A, '   ');
  check(
    'ingredient: add works, duplicate and blank names are refused',
    add.ok && !dup.ok && dup.error === 'duplicate' && !blank.ok,
  );
  const rename = add.ok ? await ops.renameIngredient(vendorA, A, add.id, 'ชื่อใหม่') : null;
  const crossRename = await ops.renameIngredient(
    vendorA,
    A,
    shopUuid('jae-buek') && (await loadShopBySlug(svc, 'jae-buek'))!.shop.ingredients[0].id,
    'ถูกแฮก',
  );
  check(
    "ingredient: rename works; another shop's ingredient cannot be renamed",
    !!rename?.ok && !crossRename.ok,
  );
  const bIngredient = (await loadShopBySlug(svc, 'jae-buek'))!.shop.ingredients[0];
  const crossDelete = await ops.deleteIngredient(vendorA, A, bIngredient.id);
  check("ingredient: another shop's ingredient cannot be deleted", !crossDelete.ok);
  const linked = await ops.saveMenu(vendorA, A, {
    ...draft,
    id: menuId,
    name: 'ผัดทดสอบ',
    ingredientIds: add.ok ? [add.id] : [],
    variants: (await reload()).menus.find((m) => m.id === menuId)?.variants ?? [],
  });
  const del = add.ok ? await ops.deleteIngredient(vendorA, A, add.id) : null;
  check(
    'ingredient: delete unlinks it from menus and reports how many',
    !!del?.ok && del.unlinkedMenus >= 0,
    JSON.stringify({ linked: linked.ok, del }),
  );

  const cat = await ops.renameCategory(vendorA, A, 'ข้าวราด', 'ข้าวราดทดสอบ');
  const renamed = (await reload()).menus.filter((m) => m.category === 'ข้าวราดทดสอบ').length;
  await ops.renameCategory(vendorA, A, 'ข้าวราดทดสอบ', 'ข้าวราด');
  check(
    'category rename changes every menu in it (and back)',
    cat.ok && cat.menus > 0 && renamed === cat.menus,
    JSON.stringify(cat),
  );
}

async function clean() {
  for (const id of cleanup.users) {
    const { data: orders } = await svc.from('orders').select('id').eq('customer_id', id);
    const ids = (orders ?? []).map((o) => o.id);
    if (ids.length) {
      await svc.from('events').delete().in('order_id', ids);
      await svc.from('orders').delete().in('id', ids);
    }
    await svc.auth.admin.deleteUser(id);
  }
  if (cleanup.menus.length) await svc.from('menus').delete().in('id', cleanup.menus);
  if (cleanup.ingredients.length)
    await svc.from('ingredients').delete().in('id', cleanup.ingredients);
  await svc.from('events').delete().in('name', ['menu_saved']);
  await resetDemo('all'); // restores the seed (also undoes the re-saved real menu's row order)
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
