import { describe, expect, it } from 'vitest';
import { loadShops, menu, pick, shop } from '@/tests/fixtures';
import {
  cartIssues,
  defaultSelections,
  ingredientMap,
  isOptionAvailable,
  kitchenSummary,
  menuAvailability,
  startingPrice,
  unitPrice,
  validate,
  visibleGroups,
} from '.';

describe('pricing and rules (PLAN.md Phase 3 cases)', () => {
  it('พี่ส้ม: 2 proteins + ไข่ข้น + แกงกะหรี่ = ฿80; 3 proteins rejected', () => {
    const s = shop(loadShops(), 'pi-som');
    const m = menu(s, 'ข้าวราด เลือกโปรตีน');
    const ing = ingredientMap(s.ingredients);
    const sel = pick(m, { โปรตีน: ['ไก่กรอบ', 'หมูญี่ปุ่น'], ราดเพิ่ม: ['ไข่ข้น', 'แกงกะหรี่'] });
    const v = validate(m, sel, ing);
    expect(v.ok).toBe(true);
    expect(unitPrice(m, v.selections)).toBe(8000);

    const three = pick(m, { โปรตีน: ['ไก่กรอบ', 'ปลาทอด', 'หมูญี่ปุ่น'] }, sel);
    const r = validate(m, three, ing);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.map((e) => e.code)).toContain('too_many');
  });

  it('เจ๊บึก กะเพราหมูกรอบ / เป็นกับข้าว / พิเศษ + ไข่ดาว ไข่แดงไม่สุก = variant row + ฿10', () => {
    const s = shop(loadShops(), 'jae-buek');
    const m = menu(s, 'ผัดกะเพรา');
    const ing = ingredientMap(s.ingredients);
    const sel = pick(m, {
      เนื้อสัตว์: ['หมูกรอบ'],
      รูปแบบเสิร์ฟ: ['เป็นกับข้าว'],
      ขนาด: ['พิเศษ'],
      ความเผ็ด: ['ปกติ'],
      ไข่เพิ่ม: ['ไข่ดาว'],
      ความสุกไข่ดาว: ['ไข่แดงไม่สุก'],
      'เพิ่มอื่น ๆ': [],
      ไม่ใส่: [],
    });
    const v = validate(m, sel, ing);
    expect(v.ok).toBe(true);
    expect(unitPrice(m, v.selections)).toBe(10000 + 1000);
  });

  it('doneness needs ไข่ดาว: hidden and dropped otherwise, required when shown', () => {
    const s = shop(loadShops(), 'jae-buek');
    const m = menu(s, 'ผัดกะเพรา');
    const ing = ingredientMap(s.ingredients);
    const doneness = m.groups.find((g) => g.name === 'ความสุกไข่ดาว')!;
    const defaults = defaultSelections(m, ing);

    const noEgg = pick(m, { ไข่เพิ่ม: ['ไม่เพิ่ม'], ความสุกไข่ดาว: ['ไข่แดงไม่สุก'] }, defaults);
    const v = validate(m, noEgg, ing);
    expect(v.ok).toBe(true);
    expect(v.selections[doneness.id]).toBeUndefined();

    const eggNoDoneness = pick(m, { ไข่เพิ่ม: ['ไข่ดาว'], ความสุกไข่ดาว: [] }, defaults);
    const r = validate(m, eggNoDoneness, ing);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContainEqual({ code: 'too_few', groupId: doneness.id });
  });

  it('ความเผ็ด is hidden for น้ำใส', () => {
    const s = shop(loadShops(), 'tomyum-kaitoon');
    const m = menu(s, 'ก๋วยเตี๋ยวหมู');
    const ing = ingredientMap(s.ingredients);
    const clear = pick(m, { น้ำซุป: ['น้ำใส'] }, defaultSelections(m, ing));
    expect(visibleGroups(m, clear).map((g) => g.name)).not.toContain('ความเผ็ด');
    const tomyum = pick(m, { น้ำซุป: ['ต้มยำ'] }, clear);
    expect(visibleGroups(m, tomyum).map((g) => g.name)).toContain('ความเผ็ด');
  });

  it('ข้าวเหนียว alone is rejected', () => {
    const s = shop(loadShops(), 'niao-kai');
    const sticky = menu(s, 'ข้าวเหนียว');
    expect(cartIssues([{ menu: sticky }], 1000)).toEqual({
      pairOnlyAlone: true,
      underMinimum: true,
    });
    const withLarb = [{ menu: sticky }, { menu: menu(s, 'ลาบไก่') }];
    expect(cartIssues(withLarb, 6000)).toEqual({ pairOnlyAlone: false, underMinimum: false });
  });

  it('หมูกรอบ sold out at เจ๊บึก disables it in every เจ๊บึก menu but not at another shop', () => {
    const shops = loadShops();
    const buek = shop(shops, 'jae-buek');
    buek.ingredients.find((i) => i.name === 'หมูกรอบ')!.isAvailable = false;
    const ing = ingredientMap(buek.ingredients);

    let seen = 0;
    for (const m of buek.menus) {
      for (const o of m.groups.flatMap((g) => g.options)) {
        if (o.ingredientId === 'jae-buek:หมูกรอบ') {
          seen++;
          expect(isOptionAvailable(o, ing)).toBe(false);
        }
      }
      expect(menuAvailability(m, ing).available).toBe(true);
    }
    expect(seen).toBeGreaterThan(0);

    const other = shop(shops, 'tomyum-kaitoon');
    const crispy = menu(other, 'ข้าวหมูกรอบ');
    expect(menuAvailability(crispy, ingredientMap(other.ingredients)).available).toBe(true);
  });
});

describe('every menu in the YAML', () => {
  it('defaults validate, have a price, and the starting price is the lowest', () => {
    for (const s of loadShops()) {
      const ing = ingredientMap(s.ingredients);
      for (const m of s.menus) {
        const v = validate(m, defaultSelections(m, ing), ing);
        if (m.groups.some((g) => g.kind === 'tiered')) {
          // No default protein: the customer must choose, which blocks "เพิ่มลงตะกร้า".
          expect(v.ok, m.name).toBe(false);
          continue;
        }
        expect(v.ok, `${s.slug} ${m.name}`).toBe(true);
        const price = unitPrice(m, v.selections);
        expect(price, m.name).not.toBeNull();
        expect(startingPrice(m, ing)!, m.name).toBeLessThanOrEqual(price!);
      }
    }
  });

  it('rejects groups from another menu', () => {
    const s = shop(loadShops(), 'jae-buek');
    const ing = ingredientMap(s.ingredients);
    const a = menu(s, 'ผัดกะเพรา');
    const b = menu(s, 'ข้าวผัด');
    const r = validate(a, { ...defaultSelections(a, ing), ...defaultSelections(b, ing) }, ing);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.map((e) => e.code)).toContain('unknown_group');
  });
});

describe('kitchenSummary', () => {
  it('lists parts in group order, joins doneness to the egg, skips "ไม่เพิ่ม"', () => {
    const s = shop(loadShops(), 'jae-buek');
    const m = menu(s, 'ผัดกะเพรา');
    const ing = ingredientMap(s.ingredients);
    const sel = pick(
      m,
      {
        ความเผ็ด: ['เผ็ดน้อย'],
        ไข่เพิ่ม: ['ไข่ดาว'],
        ความสุกไข่ดาว: ['ไข่แดงสุก'],
        ไม่ใส่: ['ถั่วฝักยาว'],
      },
      defaultSelections(m, ing),
    );
    expect(kitchenSummary(m, sel)).toBe(
      'ผัดกะเพรา / หมูสับ / ราดข้าว / ธรรมดา / เผ็ดน้อย / ไข่ดาว ไข่แดงสุก / ไม่ใส่ถั่วฝักยาว',
    );
    expect(kitchenSummary(m, defaultSelections(m, ing))).toBe(
      'ผัดกะเพรา / หมูสับ / ราดข้าว / ธรรมดา / ปกติ',
    );
  });

  it('toppings: select-all label when everything is in, removed items otherwise', () => {
    const s = shop(loadShops(), 'namtok');
    const m = menu(s, 'ก๋วยเตี๋ยวหมู');
    const ing = ingredientMap(s.ingredients);
    const all = defaultSelections(m, ing);
    expect(kitchenSummary(m, all)).toContain('ใส่ทุกอย่าง');
    const noLiver = pick(m, { เครื่อง: ['หมูชิ้น', 'หมูสับ', 'ลูกชิ้นหมู', 'หมูตุ๋น'] }, all);
    expect(kitchenSummary(m, noLiver)).toContain('ไม่ใส่ตับหมู');
  });
});
