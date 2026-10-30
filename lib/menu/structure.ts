// Menu structure rules for the vendor editor (PLAN.md §4a, Phase 7): which structures are
// valid, which can't be sold yet, and how the variant price grid follows the variant groups.
// Pure functions, shared by the editor (live checks) and the save action (the truth).

import { randomSelections, seededRng } from './random';
import {
  ingredientMap,
  type IngredientMap,
  type Menu,
  type MenuVariant,
  type OptionGroup,
  type OptionGroupKind,
} from './types';
import { unitPrice } from './price';
import { validate } from './validate';

export type IssueSeverity = 'error' | 'block';

export interface StructureIssue {
  /** error: can't be saved. block: can be saved, but the menu can't be sold until fixed. */
  severity: IssueSeverity;
  message: string;
}

export const MAX_VARIANT_COMBOS = 200;
export const MAX_PRICE_SATANG = 100_000;
const KINDS: OptionGroupKind[] = ['variant', 'tiered', 'choice', 'remove', 'toppings'];

export const comboKey = (optionIds: string[]) => [...optionIds].sort().join('|');

/** One sorted option-id list per combination of the variant groups' options. */
export function variantCombos(menu: Menu): string[][] {
  const groups = menu.groups.filter((g) => g.kind === 'variant' && g.options.length > 0);
  if (groups.length === 0) return [];
  let combos: string[][] = [[]];
  for (const g of groups) {
    combos = combos.flatMap((c) => g.options.map((o) => [...c, o.id]));
    if (combos.length > MAX_VARIANT_COMBOS * 4) break;
  }
  return combos.map((c) => [...c].sort());
}

/**
 * Regenerates the variant grid after variant options changed: combinations that still exist
 * keep their price, new ones start with no price, removed ones go away.
 */
export function syncVariants(menu: Menu): Menu {
  const old = new Map(menu.variants.map((v) => [comboKey(v.optionIds), v]));
  const variants: MenuVariant[] = variantCombos(menu).map(
    (optionIds) =>
      old.get(comboKey(optionIds)) ?? { optionIds, priceSatang: null, isAvailable: true },
  );
  return { ...menu, variants };
}

const inRange = (n: number, min: number, max: number) =>
  Number.isInteger(n) && n >= min && n <= max;

function groupIssues(
  menu: Menu,
  g: OptionGroup,
  index: number,
  shopIngredients: Set<string>,
): StructureIssue[] {
  const out: StructureIssue[] = [];
  const label = g.name.trim() || `กลุ่มที่ ${index + 1}`;
  const err = (message: string) => out.push({ severity: 'error', message: `${label}: ${message}` });

  if (!g.name.trim() || g.name.trim().length > 40) err('ใส่ชื่อกลุ่ม (ไม่เกิน 40 ตัวอักษร)');
  if (!KINDS.includes(g.kind)) err('ชนิดกลุ่มไม่ถูกต้อง');
  if (g.options.length === 0) err('ต้องมีตัวเลือกอย่างน้อย 1 อย่าง');
  if (!inRange(g.minSelect, 0, 20) || !inRange(g.maxSelect, 1, 20) || g.minSelect > g.maxSelect) {
    err('จำนวนที่เลือกต่ำสุด/สูงสุดไม่ถูกต้อง');
  }
  if (g.kind === 'variant' && (g.minSelect !== 1 || g.maxSelect !== 1))
    err('กลุ่มราคาตามแบบ ต้องเลือกได้ 1 อย่างพอดี');

  const names = new Set<string>();
  for (const o of g.options) {
    const name = o.name.trim();
    if (!name || name.length > 40) err('ตัวเลือกทุกอันต้องมีชื่อ (ไม่เกิน 40 ตัวอักษร)');
    else if (names.has(name)) err(`ตัวเลือก "${name}" ซ้ำกัน`);
    names.add(name);
    if (!inRange(o.priceDeltaSatang, 0, MAX_PRICE_SATANG))
      err(`ราคาบวกเพิ่มของ "${name}" ไม่ถูกต้อง`);
    if (o.priceDeltaSatang > 0 && g.kind !== 'choice')
      err(`"${name}": มีราคาบวกเพิ่มได้เฉพาะกลุ่มชนิด "เลือกเพิ่ม"`);
    if (o.ingredientId && !shopIngredients.has(o.ingredientId))
      err(`วัตถุดิบของ "${name}" ไม่อยู่ในร้านนี้`);
  }

  const available = g.options.filter((o) => o.isAvailable).length;
  if (g.minSelect >= 1 && g.minSelect > g.options.length) {
    out.push({
      severity: 'block',
      message: `${label}: ต้องเลือก ${g.minSelect} อย่าง แต่มีตัวเลือกแค่ ${g.options.length}`,
    });
  } else if (g.minSelect >= 1 && available < g.minSelect) {
    out.push({ severity: 'block', message: `${label}: ตัวเลือกที่เปิดอยู่ไม่พอให้เลือก` });
  }

  if (g.kind === 'toppings' && g.selectAllLabel !== null && g.selectAllLabel.trim().length > 20)
    err('ข้อความ "ใส่ทุกอย่าง" ยาวเกินไป');
  if (g.note !== null && g.note.length > 80) err('หมายเหตุยาวเกินไป (ไม่เกิน 80 ตัวอักษร)');
  return out;
}

/**
 * Everything wrong with a menu structure. Errors stop a save; blocks only stop selling
 * ("Validation blocks states customers can't order").
 */
export function validateStructure(
  menu: Menu,
  shopIngredientIds: Iterable<string>,
): StructureIssue[] {
  const shopIngredients = new Set(shopIngredientIds);
  const issues: StructureIssue[] = [];
  const err = (message: string) => issues.push({ severity: 'error', message });
  const block = (message: string) => issues.push({ severity: 'block', message });

  if (!menu.name.trim() || menu.name.trim().length > 80) err('ใส่ชื่อเมนู (ไม่เกิน 80 ตัวอักษร)');
  if (!menu.category.trim() || menu.category.trim().length > 40)
    err('ใส่หมวดหมู่ (ไม่เกิน 40 ตัวอักษร)');
  if (!inRange(menu.cookSeconds, 10, 3600)) err('เวลาทำต้องอยู่ระหว่าง 10 วินาที ถึง 60 นาที');
  for (const id of menu.ingredientIds)
    if (!shopIngredients.has(id)) err('มีวัตถุดิบที่ไม่อยู่ในร้านนี้');

  menu.groups.forEach((g, i) => issues.push(...groupIssues(menu, g, i, shopIngredients)));

  // show_when: an earlier group, and options that belong to it.
  menu.groups.forEach((g, i) => {
    if (!g.showWhen) return;
    const parent = menu.groups.findIndex((p) => p.id === g.showWhen!.groupId);
    const label = g.name.trim() || `กลุ่มที่ ${i + 1}`;
    if (parent < 0 || parent >= i) err(`${label}: เงื่อนไขการแสดงต้องอ้างกลุ่มที่อยู่ก่อนหน้า`);
    else if (g.showWhen.optionIds.length === 0)
      err(`${label}: เลือกอย่างน้อย 1 ตัวเลือกที่ทำให้กลุ่มนี้แสดง`);
    else if (
      !g.showWhen.optionIds.every((id) => menu.groups[parent].options.some((o) => o.id === id))
    ) {
      err(`${label}: เงื่อนไขการแสดงอ้างตัวเลือกที่ไม่มี`);
    }
  });

  const variantGroups = menu.groups.filter((g) => g.kind === 'variant');
  const tiered = menu.groups.filter((g) => g.kind === 'tiered');
  if (tiered.length > 1) err('มีกลุ่ม "ราคาตามจำนวน" ได้ไม่เกิน 1 กลุ่ม');
  if (tiered.length > 0 && variantGroups.length > 0)
    err('ใช้ "ราคาตามแบบ" กับ "ราคาตามจำนวน" พร้อมกันไม่ได้');
  if (variantGroups.some((g) => g.showWhen))
    err('กลุ่มราคาตามแบบ ต้องแสดงเสมอ (ห้ามมีเงื่อนไขการแสดง)');

  // One price source, and every price filled in.
  if (variantGroups.length > 0) {
    const combos = variantCombos(menu);
    if (combos.length > MAX_VARIANT_COMBOS)
      err(`ราคาตามแบบมี ${combos.length} แบบ มากเกินไป (สูงสุด ${MAX_VARIANT_COMBOS})`);
    const byKey = new Map(menu.variants.map((v) => [comboKey(v.optionIds), v]));
    const missing = combos.filter(
      (c) => (byKey.get(comboKey(c))?.priceSatang ?? null) === null,
    ).length;
    if (missing > 0) block(`ยังไม่ได้ใส่ราคา ${missing} แบบ`);
    if (
      menu.variants.some(
        (v) => v.priceSatang !== null && !inRange(v.priceSatang, 1, MAX_PRICE_SATANG),
      )
    )
      err('มีราคาแบบที่ไม่ถูกต้อง');
  } else if (tiered.length === 1) {
    const g = tiered[0];
    for (let n = Math.max(1, g.minSelect); n <= g.maxSelect; n++) {
      if (!g.tierPrices.some((t) => t.selectedCount === n))
        block(`ยังไม่ได้ใส่ราคาเมื่อเลือก ${n} อย่าง`);
    }
    if (g.tierPrices.some((t) => !inRange(t.priceSatang, 1, MAX_PRICE_SATANG)))
      err('มีราคาตามจำนวนที่ไม่ถูกต้อง');
  } else if (menu.basePriceSatang === null) {
    block('ยังไม่ได้ใส่ราคา');
  } else if (!inRange(menu.basePriceSatang, 1, MAX_PRICE_SATANG)) {
    err('ราคาไม่ถูกต้อง (฿1–฿1,000)');
  }

  // Can a customer actually order it? Try random orders with every ingredient in stock.
  if (!issues.some((i) => i.severity === 'error') && !issues.some((i) => i.severity === 'block')) {
    const ing: IngredientMap = ingredientMap(
      [...shopIngredients].map((id) => ({ id, name: '', isAvailable: true })),
    );
    const rng = seededRng(1);
    let orderable = false;
    for (let i = 0; i < 25 && !orderable; i++) {
      const sel = randomSelections(menu, ing, rng);
      if (!sel) break;
      const v = validate({ ...menu, isAvailable: true }, sel, ing);
      orderable = v.ok && unitPrice(menu, v.selections) !== null;
    }
    if (!orderable)
      block('ลูกค้ายังสั่งเมนูนี้ไม่ได้ — ตรวจจำนวนที่ต้องเลือกและตัวเลือกที่เปิดอยู่');
  }
  return issues;
}

export const hasErrors = (issues: StructureIssue[]) => issues.some((i) => i.severity === 'error');
export const canSell = (issues: StructureIssue[]) => issues.length === 0;

// Save document ---------------------------------------------------------------------------

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const isId = (v: unknown): v is string => typeof v === 'string' && UUID.test(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const nullableInt = (v: unknown): number | null | undefined =>
  v === null ? null : typeof v === 'number' && Number.isInteger(v) ? v : undefined;

/** Reads the editor's draft (camelCase Menu JSON) from the browser. Null when the shape is wrong. */
export function parseMenuDraft(raw: unknown): Menu | null {
  if (!isObj(raw) || !isId(raw.id) || !isStr(raw.name) || !isStr(raw.category)) return null;
  if (
    typeof raw.cookSeconds !== 'number' ||
    typeof raw.pairOnly !== 'boolean' ||
    typeof raw.isAvailable !== 'boolean'
  )
    return null;
  const base = nullableInt(raw.basePriceSatang);
  if (base === undefined) return null;
  if (
    !Array.isArray(raw.groups) ||
    !Array.isArray(raw.variants) ||
    !Array.isArray(raw.ingredientIds)
  )
    return null;
  if (!raw.ingredientIds.every(isId) || raw.groups.length > 30 || raw.variants.length > 400)
    return null;

  const groups: OptionGroup[] = [];
  for (const g of raw.groups) {
    if (!isObj(g) || !isId(g.id) || !isStr(g.name) || !KINDS.includes(g.kind as OptionGroupKind))
      return null;
    if (typeof g.minSelect !== 'number' || typeof g.maxSelect !== 'number') return null;
    if (!Array.isArray(g.options) || !Array.isArray(g.tierPrices) || g.options.length > 60)
      return null;
    let showWhen: OptionGroup['showWhen'] = null;
    if (g.showWhen !== null && g.showWhen !== undefined) {
      if (
        !isObj(g.showWhen) ||
        !isId(g.showWhen.groupId) ||
        !Array.isArray(g.showWhen.optionIds) ||
        !g.showWhen.optionIds.every(isId)
      )
        return null;
      showWhen = { groupId: g.showWhen.groupId, optionIds: g.showWhen.optionIds };
    }
    const options = [];
    for (const o of g.options) {
      if (!isObj(o) || !isId(o.id) || !isStr(o.name) || typeof o.priceDeltaSatang !== 'number')
        return null;
      if (o.ingredientId !== null && !isId(o.ingredientId)) return null;
      if (typeof o.isDefault !== 'boolean' || typeof o.isAvailable !== 'boolean') return null;
      options.push({
        id: o.id,
        name: o.name,
        priceDeltaSatang: o.priceDeltaSatang,
        ingredientId: o.ingredientId as string | null,
        isDefault: o.isDefault,
        isAvailable: o.isAvailable,
      });
    }
    const tierPrices = [];
    for (const t of g.tierPrices) {
      if (!isObj(t) || typeof t.selectedCount !== 'number' || typeof t.priceSatang !== 'number')
        return null;
      tierPrices.push({ selectedCount: t.selectedCount, priceSatang: t.priceSatang });
    }
    if (g.selectAllLabel !== null && g.selectAllLabel !== undefined && !isStr(g.selectAllLabel))
      return null;
    if (g.note !== null && g.note !== undefined && !isStr(g.note)) return null;
    groups.push({
      id: g.id,
      name: g.name,
      kind: g.kind as OptionGroupKind,
      minSelect: g.minSelect,
      maxSelect: g.maxSelect,
      showWhen,
      selectAllLabel: (g.selectAllLabel as string | null | undefined) ?? null,
      note: (g.note as string | null | undefined) ?? null,
      options,
      tierPrices,
    });
  }

  const variants: MenuVariant[] = [];
  for (const v of raw.variants) {
    if (!isObj(v) || !Array.isArray(v.optionIds) || !v.optionIds.every(isId)) return null;
    const price = nullableInt(v.priceSatang);
    if (price === undefined) return null;
    variants.push({
      optionIds: [...v.optionIds].sort(),
      priceSatang: price,
      isAvailable: v.isAvailable !== false,
    });
  }

  return {
    id: raw.id,
    category: raw.category,
    name: raw.name,
    cookSeconds: raw.cookSeconds,
    basePriceSatang: base,
    pairOnly: raw.pairOnly,
    isAvailable: raw.isAvailable,
    isDeleted: false,
    ingredientIds: raw.ingredientIds as string[],
    groups,
    variants,
  };
}

/** The JSON document vendor_save_menu() reads (snake_case, trimmed, with sort order). */
export function toSaveDocument(menu: Menu): Record<string, unknown> {
  const hasVariants = menu.groups.some((g) => g.kind === 'variant');
  const hasTier = menu.groups.some((g) => g.kind === 'tiered');
  return {
    id: menu.id,
    category: menu.category.trim(),
    name: menu.name.trim(),
    cook_seconds: menu.cookSeconds,
    // Only one price source: base price is unused when variants or tiers price the menu.
    base_price_satang: hasVariants || hasTier ? null : menu.basePriceSatang,
    pair_only: menu.pairOnly,
    is_available: menu.isAvailable,
    ingredient_ids: [...new Set(menu.ingredientIds)],
    groups: menu.groups.map((g, gi) => ({
      id: g.id,
      name: g.name.trim(),
      kind: g.kind,
      min_select: g.minSelect,
      max_select: g.maxSelect,
      sort: gi,
      show_when_group_id: g.showWhen?.groupId ?? null,
      show_when_option_ids: g.showWhen?.optionIds ?? null,
      select_all_label: g.kind === 'toppings' ? g.selectAllLabel?.trim() || null : null,
      note: g.note?.trim() || null,
      options: g.options.map((o, oi) => ({
        id: o.id,
        name: o.name.trim(),
        price_delta_satang: g.kind === 'choice' ? o.priceDeltaSatang : 0,
        ingredient_id: o.ingredientId,
        is_default: o.isDefault,
        is_available: o.isAvailable,
        sort: oi,
      })),
      tier_prices:
        g.kind === 'tiered'
          ? g.tierPrices
              .filter((t) => t.priceSatang > 0)
              .map((t) => ({ selected_count: t.selectedCount, price_satang: t.priceSatang }))
          : [],
    })),
    variants: hasVariants
      ? menu.variants.map((v) => ({
          option_ids: v.optionIds,
          price_satang: v.priceSatang,
          is_available: v.isAvailable,
        }))
      : [],
  };
}
