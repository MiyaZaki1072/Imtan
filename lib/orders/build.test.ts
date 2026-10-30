import { describe, expect, it } from 'vitest';
import { loadShops, menu, pick, shop } from '@/tests/fixtures';
import {
  availableOptions,
  defaultSelections,
  ingredientMap,
  lineTotal,
  validate,
  type Menu,
  type Shop,
} from '../menu';
import { buildOrder } from './build';

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

/** What the browser shows: lib/menu on its copy of the menu. */
function preview(m: Menu, s: Shop, selections: ReturnType<typeof sampleSelections>, qty: number) {
  const v = validate(m, selections, ingredientMap(s.ingredients));
  return v.ok ? lineTotal(m, v.selections, qty) : null;
}

describe('buildOrder', () => {
  it('server total equals the preview for every menu (with a main dish for pair_only)', () => {
    for (const s of loadShops()) {
      const main = s.menus.find((m) => !m.pairOnly)!;
      for (const m of s.menus) {
        const sel = sampleSelections(m, s);
        const lines = [{ menuId: m.id, selections: sel, qty: 2, note: '' }];
        let expected = preview(m, s, sel, 2)!;
        if (m.pairOnly || expected < 2000) {
          const mainSel = sampleSelections(main, s);
          lines.push({ menuId: main.id, selections: mainSel, qty: 1, note: '' });
          expected += preview(main, s, mainSel, 1)!;
        }
        const r = buildOrder(s, lines, '');
        expect(r.ok, `${s.slug} ${m.name}`).toBe(true);
        if (r.ok) expect(r.totalSatang, `${s.slug} ${m.name}`).toBe(expected);
      }
    }
  });

  it('ignores a tampered client price', () => {
    const s = shop(loadShops(), 'jae-buek');
    const m = menu(s, 'ผัดกะเพรา');
    const sel = pick(m, { เนื้อสัตว์: ['กุ้ง'] }, sampleSelections(m, s));
    const r = buildOrder(
      s,
      [
        {
          menuId: m.id,
          selections: sel,
          qty: 1,
          note: '',
          unitPriceSatang: 1,
          lineTotalSatang: 1,
          price: 1,
        },
      ],
      '',
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.items[0].unit_price_satang).toBe(6500);
      expect(r.totalSatang).toBe(6500);
    }
  });

  it('rejects bad input', () => {
    const shops = loadShops();
    const s = shop(shops, 'jae-buek');
    const m = menu(s, 'ผัดกะเพรา');
    const sel = sampleSelections(m, s);
    const ok = { menuId: m.id, selections: sel, qty: 1, note: '' };
    expect(buildOrder(s, [], '')).toEqual({ ok: false, error: 'empty' });
    expect(buildOrder(s, 'x', '')).toEqual({ ok: false, error: 'bad_input' });
    expect(buildOrder(s, [{ ...ok, qty: 0 }], '').ok).toBe(false);
    expect(buildOrder(s, [{ ...ok, qty: 21 }], '').ok).toBe(false);
    expect(buildOrder(s, [{ ...ok, note: 'x'.repeat(101) }], '').ok).toBe(false);
    expect(buildOrder(s, [ok], 'x'.repeat(101)).ok).toBe(false);
    // A menu from another shop
    const other = shop(shops, 'pi-som').menus[0];
    expect(buildOrder(s, [{ ...ok, menuId: other.id }], '')).toEqual({
      ok: false,
      error: 'unknown_menu',
      line: 0,
    });
    // Invalid selections (3 proteins at พี่ส้ม)
    const piSom = shop(shops, 'pi-som');
    const rice = menu(piSom, 'ข้าวราด เลือกโปรตีน');
    const three = pick(rice, { โปรตีน: ['ไก่กรอบ', 'ปลาทอด', 'หมูญี่ปุ่น'] });
    expect(buildOrder(piSom, [{ menuId: rice.id, selections: three, qty: 1 }], '')).toEqual({
      ok: false,
      error: 'invalid_selections',
      line: 0,
    });
  });

  it('blocks ข้าวเหนียว alone and closed shops', () => {
    const s = shop(loadShops(), 'niao-kai');
    const sticky = menu(s, 'ข้าวเหนียว');
    const line = { menuId: sticky.id, selections: {}, qty: 3 };
    expect(buildOrder(s, [line], '')).toEqual({ ok: false, error: 'pair_only_alone' });
    expect(buildOrder({ ...s, isOpen: false }, [line], '')).toEqual({
      ok: false,
      error: 'shop_closed',
    });
  });

  it('keeps notes only where the shop allows them', () => {
    const s = shop(loadShops(), 'jae-buek');
    const m = menu(s, 'ผัดกะเพรา');
    const line = { menuId: m.id, selections: sampleSelections(m, s), qty: 1, note: ' แยกน้ำ ' };
    const r = buildOrder(
      { ...s, allowItemNote: false, allowAllergyNote: false },
      [line],
      'แพ้กุ้ง',
    );
    expect(r.ok && r.items[0].note === null && r.allergyNote === null).toBe(true);
    const r2 = buildOrder(s, [line], 'แพ้กุ้ง');
    expect(r2.ok && r2.items[0].note === 'แยกน้ำ' && r2.allergyNote === 'แพ้กุ้ง').toBe(true);
  });
});
