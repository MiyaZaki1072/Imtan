// Maps data/demo-shops.yaml (schema v2) to the menu model, per PLAN.md §4a.
// Strict: an unknown key, a missing value or a dangling reference throws. Never guess.
// Phase 2's seed script reuses this mapping.

import type {
  Ingredient,
  Menu,
  MenuOption,
  OptionGroup,
  OptionGroupKind,
  Shop,
} from '../menu/types';

const KINDS: readonly OptionGroupKind[] = ['variant', 'tiered', 'choice', 'remove', 'toppings'];

type Obj = Record<string, unknown>;

export class DemoDataError extends Error {
  constructor(path: string, message: string) {
    super(`data/demo-shops.yaml ${path}: ${message}`);
    this.name = 'DemoDataError';
  }
}

function obj(value: unknown, path: string, allowed: string[], required: string[]): Obj {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new DemoDataError(path, 'expected a mapping');
  }
  const o = value as Obj;
  for (const key of Object.keys(o)) {
    if (!allowed.includes(key)) throw new DemoDataError(path, `unknown key "${key}"`);
  }
  for (const key of required) {
    if (o[key] === undefined || o[key] === null) {
      throw new DemoDataError(path, `missing value "${key}"`);
    }
  }
  return o;
}

function str(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new DemoDataError(path, 'expected a non-empty string');
  }
  return value;
}

function int(value: unknown, path: string, min = 0): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min) {
    throw new DemoDataError(path, `expected an integer >= ${min}`);
  }
  return value;
}

function bool(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') throw new DemoDataError(path, 'expected true or false');
  return value;
}

function list(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) throw new DemoDataError(path, 'expected a list');
  return value;
}

/** Baht (YAML) to satang. */
function satang(value: unknown, path: string, min = 0): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min) {
    throw new DemoDataError(path, `expected a price in baht >= ${min}`);
  }
  const s = Math.round(value * 100);
  if (Math.abs(s - value * 100) > 1e-6)
    throw new DemoDataError(path, 'price has a sub-satang part');
  return s;
}

type IngredientLookup = (name: unknown, path: string) => string;

const SHOP_KEYS = [
  'slug',
  'name',
  'category',
  'queue_prefix',
  'wait_mode',
  'manual_seconds_per_item',
  'allow_item_note',
  'allow_allergy_note',
  'ingredients',
  'menus',
];

function parseShop(raw: unknown, path: string): Shop {
  const s = obj(raw, path, [...SHOP_KEYS, 'confirmed', 'assumed'], SHOP_KEYS);
  const slug = str(s.slug, `${path}.slug`);
  if (!/^[a-z0-9-]+$/.test(slug)) throw new DemoDataError(`${path}.slug`, 'use a-z, 0-9 and -');
  const queuePrefix = str(s.queue_prefix, `${path}.queue_prefix`);
  if ([...queuePrefix].length > 8) throw new DemoDataError(`${path}.queue_prefix`, 'max 8 chars');
  const waitMode = s.wait_mode;
  if (waitMode !== 'auto' && waitMode !== 'manual') {
    throw new DemoDataError(`${path}.wait_mode`, 'expected auto or manual');
  }

  const ingredients: Ingredient[] = list(s.ingredients, `${path}.ingredients`).map((n, i) => {
    const name = str(n, `${path}.ingredients[${i}]`);
    return { id: `${slug}:${name}`, name, isAvailable: true };
  });
  const byName = new Map(ingredients.map((i) => [i.name, i.id]));
  if (byName.size !== ingredients.length) {
    throw new DemoDataError(`${path}.ingredients`, 'duplicate ingredient');
  }
  const ingredientId: IngredientLookup = (name, p) => {
    const id = byName.get(str(name, p));
    if (!id) throw new DemoDataError(p, `ingredient "${String(name)}" is not in the shop's list`);
    return id;
  };

  const menus = list(s.menus, `${path}.menus`).map((m, i) =>
    parseMenu(m, `${path}.menus[${i}]`, `${slug}-m${i + 1}`, ingredientId),
  );

  return {
    id: slug,
    slug,
    name: str(s.name, `${path}.name`),
    category: str(s.category, `${path}.category`),
    queuePrefix,
    isOpen: true,
    allowItemNote: bool(s.allow_item_note, `${path}.allow_item_note`),
    allowAllergyNote: bool(s.allow_allergy_note, `${path}.allow_allergy_note`),
    waitMode,
    manualSecondsPerItem: int(s.manual_seconds_per_item, `${path}.manual_seconds_per_item`, 1),
    ingredients,
    menus,
  };
}

function parseMenu(raw: unknown, path: string, id: string, ingredientId: IngredientLookup): Menu {
  const m = obj(
    raw,
    path,
    [
      'name',
      'category',
      'cook_seconds',
      'base_price',
      'pair_only',
      'requires_ingredients',
      'groups',
      'variants',
    ],
    ['name', 'category', 'cook_seconds', 'groups'],
  );

  const rawGroups = list(m.groups, `${path}.groups`);
  const groups = rawGroups.map((g, j) =>
    parseGroup(g, `${path}.groups[${j}]`, `${id}-g${j + 1}`, ingredientId),
  );
  const groupByName = new Map(groups.map((g) => [g.name, g]));
  if (groupByName.size !== groups.length) {
    throw new DemoDataError(`${path}.groups`, 'duplicate group');
  }

  // Resolve show_when names to ids now that every group exists.
  rawGroups.forEach((g, j) => {
    const sw = (g as Obj).show_when;
    if (sw === undefined) return;
    const p = `${path}.groups[${j}].show_when`;
    const w = obj(sw, p, ['group', 'options'], ['group', 'options']);
    const parent = groupByName.get(str(w.group, `${p}.group`));
    if (!parent || groups.indexOf(parent) >= j) {
      throw new DemoDataError(`${p}.group`, 'must name an earlier group');
    }
    const optionIds = list(w.options, `${p}.options`).map((n, k) => {
      const opt = parent.options.find((o) => o.name === str(n, `${p}.options[${k}]`));
      if (!opt) throw new DemoDataError(`${p}.options[${k}]`, `unknown option "${String(n)}"`);
      return opt.id;
    });
    groups[j].showWhen = { groupId: parent.id, optionIds };
  });

  const variantGroups = groups.filter((g) => g.kind === 'variant');
  const tieredGroups = groups.filter((g) => g.kind === 'tiered');
  const hasBase = m.base_price !== undefined;
  const sources =
    Number(variantGroups.length > 0) + Number(tieredGroups.length > 0) + Number(hasBase);
  if (sources !== 1 || tieredGroups.length > 1) {
    throw new DemoDataError(
      path,
      'needs exactly one price source: variants, one tiered group, or base_price',
    );
  }
  if ((m.variants !== undefined) !== variantGroups.length > 0) {
    throw new DemoDataError(path, 'a variants list needs variant groups, and the reverse');
  }

  const variantNames = variantGroups.map((g) => g.name);
  const variants = variantGroups.length
    ? list(m.variants, `${path}.variants`).map((v, k) => {
        const p = `${path}.variants[${k}]`;
        const row = obj(v, p, ['options', 'price'], ['options', 'price']);
        const picks = obj(row.options, `${p}.options`, variantNames, variantNames);
        const optionIds = variantGroups
          .map((g) => {
            const name = str(picks[g.name], `${p}.options.${g.name}`);
            const opt = g.options.find((o) => o.name === name);
            if (!opt) throw new DemoDataError(`${p}.options.${g.name}`, `unknown option "${name}"`);
            return opt.id;
          })
          .sort();
        return { optionIds, priceSatang: satang(row.price, `${p}.price`, 0.01), isAvailable: true };
      })
    : [];
  if (variantGroups.length) {
    const combos = variantGroups.reduce((n, g) => n * g.options.length, 1);
    const distinct = new Set(variants.map((v) => v.optionIds.join('|'))).size;
    if (distinct !== combos || variants.length !== combos) {
      throw new DemoDataError(
        `${path}.variants`,
        `must list each of the ${combos} combinations once`,
      );
    }
  }

  return {
    id,
    category: str(m.category, `${path}.category`),
    name: str(m.name, `${path}.name`),
    cookSeconds: int(m.cook_seconds, `${path}.cook_seconds`, 1),
    basePriceSatang: hasBase ? satang(m.base_price, `${path}.base_price`, 0.01) : null,
    pairOnly: m.pair_only === undefined ? false : bool(m.pair_only, `${path}.pair_only`),
    isAvailable: true,
    isDeleted: false,
    ingredientIds:
      m.requires_ingredients === undefined
        ? []
        : list(m.requires_ingredients, `${path}.requires_ingredients`).map((n, k) =>
            ingredientId(n, `${path}.requires_ingredients[${k}]`),
          ),
    groups,
    variants,
  };
}

function parseGroup(
  raw: unknown,
  path: string,
  id: string,
  ingredientId: IngredientLookup,
): OptionGroup {
  const g = obj(
    raw,
    path,
    [
      'name',
      'kind',
      'min',
      'max',
      'note',
      'select_all_label',
      'show_when',
      'tier_prices',
      'options',
    ],
    ['name', 'kind', 'min', 'max', 'options'],
  );
  const kind = g.kind as OptionGroupKind;
  if (!KINDS.includes(kind)) {
    throw new DemoDataError(`${path}.kind`, `unknown kind "${String(g.kind)}"`);
  }
  const minSelect = int(g.min, `${path}.min`);
  const maxSelect = int(g.max, `${path}.max`, 1);
  if (minSelect > maxSelect) throw new DemoDataError(path, 'min > max');
  if (kind === 'variant' && (minSelect !== 1 || maxSelect !== 1)) {
    throw new DemoDataError(path, 'variant groups pick exactly 1');
  }

  const options: MenuOption[] = list(g.options, `${path}.options`).map((o, k) => {
    const p = `${path}.options[${k}]`;
    const opt = obj(o, p, ['name', 'price', 'ingredient', 'default'], ['name', 'price']);
    const priceDeltaSatang = satang(opt.price, `${p}.price`);
    if (priceDeltaSatang !== 0 && kind !== 'choice') {
      throw new DemoDataError(`${p}.price`, 'only choice options may add a price');
    }
    return {
      id: `${id}-o${k + 1}`,
      name: str(opt.name, `${p}.name`),
      priceDeltaSatang,
      ingredientId:
        opt.ingredient === undefined ? null : ingredientId(opt.ingredient, `${p}.ingredient`),
      isDefault: opt.default === undefined ? false : bool(opt.default, `${p}.default`),
      isAvailable: true,
    };
  });
  if (new Set(options.map((o) => o.name)).size !== options.length) {
    throw new DemoDataError(`${path}.options`, 'duplicate option');
  }

  let tierPrices: OptionGroup['tierPrices'] = [];
  if (kind === 'tiered') {
    const p = `${path}.tier_prices`;
    if (typeof g.tier_prices !== 'object' || g.tier_prices === null) {
      throw new DemoDataError(p, 'missing value');
    }
    tierPrices = Object.entries(g.tier_prices as Obj).map(([count, baht]) => ({
      selectedCount: int(Number(count), `${p}.${count}`, 1),
      priceSatang: satang(baht, `${p}.${count}`, 0.01),
    }));
    for (let n = Math.max(1, minSelect); n <= maxSelect; n++) {
      if (!tierPrices.some((tp) => tp.selectedCount === n)) {
        throw new DemoDataError(p, `missing price for ${n}`);
      }
    }
  } else if (g.tier_prices !== undefined) {
    throw new DemoDataError(`${path}.tier_prices`, 'only tiered groups have tier prices');
  }

  return {
    id,
    name: str(g.name, `${path}.name`),
    kind,
    minSelect,
    maxSelect,
    showWhen: null,
    selectAllLabel:
      g.select_all_label === undefined ? null : str(g.select_all_label, `${path}.select_all_label`),
    note: g.note === undefined ? null : str(g.note, `${path}.note`),
    options,
    tierPrices,
  };
}

export interface ShopNotes {
  confirmed: string[];
  assumed: string[];
}

export interface DemoData {
  shops: Shop[];
  /** Team notes per shop slug; shown in vendor interviews, never stored. */
  notes: Record<string, ShopNotes>;
}

export function parseDemoData(raw: unknown): DemoData {
  const root = obj(
    raw,
    '(root)',
    ['schema_version', 'units', 'shops'],
    ['schema_version', 'shops'],
  );
  if (root.schema_version !== 2) throw new DemoDataError('schema_version', 'expected 2');
  const rawShops = list(root.shops, 'shops');
  const shops = rawShops.map((s, i) => parseShop(s, `shops[${i}]`));
  if (new Set(shops.map((s) => s.slug)).size !== shops.length) {
    throw new DemoDataError('shops', 'duplicate slug');
  }
  const strings = (v: unknown, p: string) =>
    v === undefined ? [] : list(v, p).map((x, k) => str(x, `${p}[${k}]`));
  const notes: DemoData['notes'] = {};
  rawShops.forEach((s, i) => {
    const o = s as Obj;
    notes[shops[i].slug] = {
      confirmed: strings(o.confirmed, `shops[${i}].confirmed`),
      assumed: strings(o.assumed, `shops[${i}].assumed`),
    };
  });
  return { shops, notes };
}
