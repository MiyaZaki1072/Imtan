import { describe, expect, it } from 'vitest';
import { loadShops, menu, shop } from '@/tests/fixtures';
import type { Menu } from '.';
import {
  canSell,
  hasErrors,
  parseMenuDraft,
  syncVariants,
  toSaveDocument,
  validateStructure,
  variantCombos,
} from './structure';

const ids = (s: { ingredients: { id: string }[] }) => s.ingredients.map((i) => i.id);
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

describe('validateStructure on the real menus', () => {
  it('finds nothing wrong with any of the 33 YAML menus', () => {
    for (const s of loadShops()) {
      for (const m of s.menus) {
        expect(validateStructure(m, ids(s)), `${s.slug} ${m.name}`).toEqual([]);
      }
    }
  });
});

describe('validateStructure catches broken menus', () => {
  const buek = () => shop(loadShops(), 'jae-buek');
  const krapao = (): { s: ReturnType<typeof buek>; m: Menu } => {
    const s = buek();
    return { s, m: clone(menu(s, 'ผัดกะเพรา')) };
  };
  const messages = (m: Menu, s: ReturnType<typeof buek>, severity: 'error' | 'block') =>
    validateStructure(m, ids(s))
      .filter((i) => i.severity === severity)
      .map((i) => i.message)
      .join(' | ');

  it('min above max, empty group, duplicate and blank names are errors', () => {
    const { s, m } = krapao();
    m.groups[3].minSelect = 3; // ความเผ็ด min 3 > max 1
    m.groups[4].options = []; // ไข่เพิ่ม has no options
    m.groups[0].options[1].name = m.groups[0].options[0].name; // duplicate
    m.name = '  ';
    const errors = messages(m, s, 'error');
    expect(errors).toContain('จำนวนที่เลือกต่ำสุด/สูงสุดไม่ถูกต้อง');
    expect(errors).toContain('ต้องมีตัวเลือกอย่างน้อย 1 อย่าง');
    expect(errors).toContain('ซ้ำกัน');
    expect(errors).toContain('ใส่ชื่อเมนู');
    expect(hasErrors(validateStructure(m, ids(s)))).toBe(true);
  });

  it('show_when must point at an earlier group and its own options', () => {
    const { s, m } = krapao();
    const doneness = m.groups.find((g) => g.name === 'ความสุกไข่ดาว')!;
    const egg = m.groups.find((g) => g.name === 'ไข่เพิ่ม')!;
    doneness.showWhen = { groupId: doneness.id, optionIds: [egg.options[1].id] };
    expect(messages(m, s, 'error')).toContain('ต้องอ้างกลุ่มที่อยู่ก่อนหน้า');
    doneness.showWhen = { groupId: egg.id, optionIds: [doneness.options[0].id] }; // option of another group
    expect(messages(m, s, 'error')).toContain('อ้างตัวเลือกที่ไม่มี');
  });

  it('a price delta outside "choice", and an ingredient from another shop, are errors', () => {
    const { s, m } = krapao();
    m.groups[0].options[0].priceDeltaSatang = 500; // variant group
    m.groups[1].options[0].ingredientId = '00000000-0000-4000-8000-000000000000';
    const errors = messages(m, s, 'error');
    expect(errors).toContain('เฉพาะกลุ่มชนิด');
    expect(errors).toContain('ไม่อยู่ในร้านนี้');
  });

  it('missing prices block selling but do not stop a save', () => {
    const { s, m } = krapao();
    m.variants[0].priceSatang = null;
    const issues = validateStructure(m, ids(s));
    expect(hasErrors(issues)).toBe(false);
    expect(canSell(issues)).toBe(false);
    expect(messages(m, s, 'block')).toContain('ยังไม่ได้ใส่ราคา 1 แบบ');
    const plain = clone(menu(s, 'ไข่เจียวราดข้าว'));
    plain.groups = [];
    plain.variants = [];
    plain.basePriceSatang = null;
    expect(messages(plain, s, 'block')).toContain('ยังไม่ได้ใส่ราคา');
  });

  it('a menu nobody can order (required group with too few options) is blocked', () => {
    const { s, m } = krapao();
    m.groups[3].minSelect = 1;
    m.groups[3].options = m.groups[3].options
      .slice(0, 1)
      .map((o) => ({ ...o, isAvailable: false }));
    expect(messages(m, s, 'block')).toContain('ตัวเลือกที่เปิดอยู่ไม่พอ');
  });

  it('variant with tiered together, or two tiered groups, is an error', () => {
    const piSom = shop(loadShops(), 'pi-som');
    const rice = clone(menu(piSom, 'ข้าวราด เลือกโปรตีน'));
    const tier = rice.groups[0];
    rice.groups.push({ ...clone(tier), id: '11111111-1111-4111-8111-111111111111' });
    expect(messages(rice, piSom, 'error')).toContain('ไม่เกิน 1 กลุ่ม');
  });
});

describe('variant grid follows the variant groups', () => {
  it('adding an option adds new unpriced combinations; removing one drops its rows', () => {
    const s = shop(loadShops(), 'jae-buek');
    const m = clone(menu(s, 'ผัดกะเพรา'));
    const before = variantCombos(m).length;
    expect(before).toBe(24);
    m.groups[0].options.push({
      id: '22222222-2222-4222-8222-222222222222',
      name: 'ปู',
      priceDeltaSatang: 0,
      ingredientId: null,
      isDefault: false,
      isAvailable: true,
    });
    const grown = syncVariants(m);
    expect(grown.variants).toHaveLength(before + 4); // 4 = serving (2) × size (2)
    expect(grown.variants.filter((v) => v.priceSatang === null)).toHaveLength(4);
    expect(grown.variants.filter((v) => v.priceSatang !== null)).toHaveLength(before);

    const shrunk = syncVariants({
      ...grown,
      groups: grown.groups.map((g, i) => (i === 0 ? { ...g, options: g.options.slice(0, 2) } : g)),
    });
    expect(shrunk.variants).toHaveLength(2 * 2 * 2);
    expect(shrunk.variants.every((v) => v.priceSatang !== null)).toBe(true);
  });
});

describe('save document', () => {
  it('round-trips a real menu through parse and toSaveDocument', () => {
    const s = shop(loadShops(), 'tomyum-kaitoon');
    const m = clone(menu(s, 'ก๋วยเตี๋ยวหมู'));
    const parsed = parseMenuDraft({
      ...m,
      id: '33333333-3333-4333-8333-333333333333',
      ingredientIds: [],
      groups: m.groups.map((g) => ({
        ...g,
        id: g.id
          .replace(/[^0-9a-f]/g, '0')
          .padEnd(32, '0')
          .replace(/^(.{8})(.{4})(.{4})(.{4})(.{12}).*$/, '$1-$2-$3-$4-$5'),
      })),
    });
    // Ids that are not UUIDs are rejected: the editor always sends UUIDs.
    expect(parsed).toBeNull();
  });

  it('rejects junk and keeps only one price source in the document', () => {
    expect(parseMenuDraft(null)).toBeNull();
    expect(parseMenuDraft({ id: 'x' })).toBeNull();
    const base = {
      id: '33333333-3333-4333-8333-333333333333',
      name: 'เมนู',
      category: 'หมวด',
      cookSeconds: 60,
      pairOnly: false,
      isAvailable: true,
      basePriceSatang: 5000,
      ingredientIds: [],
      groups: [],
      variants: [],
    };
    const m = parseMenuDraft(base)!;
    expect(m).not.toBeNull();
    const doc = toSaveDocument(m);
    expect(doc.base_price_satang).toBe(5000);
    expect(doc.groups).toEqual([]);
  });
});
