// Turns a cart sent by the browser into priced order items, using lib/menu as the truth.
// Only menu ids, selections, qty and notes are read from the client. Any price, total or
// other field the client sends is ignored. placeOrder() calls this with a shop freshly
// loaded from the database, then passes the result to insert_order().

import {
  cartIssues,
  ingredientMap,
  kitchenSummary,
  MAX_NOTE_LENGTH,
  MAX_QTY,
  unitPrice,
  validate,
  type Menu,
  type Selections,
  type Shop,
} from '../menu';

export interface PricedItem {
  menu_id: string;
  menu_name: string;
  selections: Selections;
  kitchen_summary: string;
  note: string | null;
  qty: number;
  unit_price_satang: number;
  line_total_satang: number;
}

export type BuildError =
  | 'empty'
  | 'bad_input'
  | 'shop_closed'
  | 'unknown_menu'
  | 'invalid_selections'
  | 'pair_only_alone'
  | 'under_minimum';

export type BuildResult =
  | {
      ok: true;
      items: PricedItem[];
      totalSatang: number;
      itemCount: number;
      allergyNote: string | null;
    }
  | { ok: false; error: BuildError; line?: number };

const MAX_LINES = 30;

function readSelections(raw: unknown): Selections | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const out: Selections = {};
  for (const [groupId, ids] of Object.entries(raw)) {
    if (!Array.isArray(ids) || !ids.every((x) => typeof x === 'string')) return null;
    out[groupId] = ids as string[];
  }
  return out;
}

function readNote(raw: unknown): string | null | undefined {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== 'string') return undefined;
  const t = raw.trim();
  if (t.length > MAX_NOTE_LENGTH) return undefined;
  return t === '' ? null : t;
}

export interface BuildOptions {
  /** Vendor-entered walk-in: paid in cash at the counter, so no ฿20 minimum, and it works while the shop is paused for app orders. */
  walkIn?: boolean;
}

export function buildOrder(
  shop: Shop,
  rawLines: unknown,
  rawAllergy: unknown,
  options: BuildOptions = {},
): BuildResult {
  if (!shop.isOpen && !options.walkIn) return { ok: false, error: 'shop_closed' };
  if (!Array.isArray(rawLines)) return { ok: false, error: 'bad_input' };
  if (rawLines.length === 0) return { ok: false, error: 'empty' };
  if (rawLines.length > MAX_LINES) return { ok: false, error: 'bad_input' };

  const allergy = shop.allowAllergyNote ? readNote(rawAllergy) : null;
  if (allergy === undefined) return { ok: false, error: 'bad_input' };

  const ingredients = ingredientMap(shop.ingredients);
  const items: PricedItem[] = [];
  const menus: { menu: Menu }[] = [];

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i] as Record<string, unknown> | null;
    if (typeof line !== 'object' || line === null)
      return { ok: false, error: 'bad_input', line: i };
    const menu = shop.menus.find((m) => m.id === line.menuId && !m.isDeleted);
    if (!menu) return { ok: false, error: 'unknown_menu', line: i };
    const selections = readSelections(line.selections);
    const qty = line.qty;
    const note = shop.allowItemNote ? readNote(line.note) : null;
    if (
      !selections ||
      note === undefined ||
      typeof qty !== 'number' ||
      !Number.isInteger(qty) ||
      qty < 1 ||
      qty > MAX_QTY
    ) {
      return { ok: false, error: 'bad_input', line: i };
    }

    const v = validate(menu, selections, ingredients);
    const unit = v.ok ? unitPrice(menu, v.selections) : null;
    if (!v.ok || unit === null) return { ok: false, error: 'invalid_selections', line: i };

    items.push({
      menu_id: menu.id,
      menu_name: menu.name,
      selections: v.selections,
      kitchen_summary: kitchenSummary(menu, v.selections),
      note,
      qty,
      unit_price_satang: unit,
      line_total_satang: unit * qty,
    });
    menus.push({ menu });
  }

  const totalSatang = items.reduce((s, it) => s + it.line_total_satang, 0);
  const issues = cartIssues(menus, totalSatang);
  if (issues.pairOnlyAlone) return { ok: false, error: 'pair_only_alone' };
  if (issues.underMinimum && !options.walkIn) return { ok: false, error: 'under_minimum' };

  return {
    ok: true,
    items,
    totalSatang,
    itemCount: items.reduce((n, it) => n + it.qty, 0),
    allergyNote: allergy,
  };
}
