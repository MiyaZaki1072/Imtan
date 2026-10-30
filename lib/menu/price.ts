import { availableOptions } from './availability';
import type { IngredientMap, Menu, Selections } from './types';
import { visibleGroups } from './visibility';

/**
 * Base price from exactly one source (PLAN.md §4a): the variant row for the selected
 * variant options, else the tier row for the tiered group's count, else the menu base price.
 * Returns null when no row matches.
 */
export function basePrice(menu: Menu, selections: Selections): number | null {
  const variantGroups = menu.groups.filter((g) => g.kind === 'variant');
  if (variantGroups.length > 0) {
    const picked = variantGroups.map((g) => selections[g.id] ?? []);
    if (picked.some((ids) => ids.length !== 1)) return null;
    const key = picked
      .map((ids) => ids[0])
      .sort()
      .join('|');
    const row = menu.variants.find((v) => v.optionIds.join('|') === key);
    return row && row.isAvailable ? row.priceSatang : null;
  }

  const tiered = menu.groups.find((g) => g.kind === 'tiered');
  if (tiered) {
    const count = (selections[tiered.id] ?? []).length;
    return tiered.tierPrices.find((t) => t.selectedCount === count)?.priceSatang ?? null;
  }

  return menu.basePriceSatang;
}

/** Price of one item: base + deltas of selected `choice` options in visible groups. */
export function unitPrice(menu: Menu, selections: Selections): number | null {
  const base = basePrice(menu, selections);
  if (base === null) return null;
  let extras = 0;
  for (const group of visibleGroups(menu, selections)) {
    if (group.kind !== 'choice') continue;
    for (const id of selections[group.id] ?? []) {
      extras += group.options.find((o) => o.id === id)?.priceDeltaSatang ?? 0;
    }
  }
  return base + extras;
}

export function lineTotal(menu: Menu, selections: Selections, qty: number): number | null {
  const unit = unitPrice(menu, selections);
  return unit === null ? null : unit * qty;
}

/** Lowest price a customer can order this menu for ("เริ่ม ฿50"). */
export function startingPrice(menu: Menu, ingredients: IngredientMap): number | null {
  let bases: number[];
  const tiered = menu.groups.find((g) => g.kind === 'tiered');
  if (menu.groups.some((g) => g.kind === 'variant')) {
    bases = menu.variants.flatMap((v) =>
      v.isAvailable && v.priceSatang !== null ? [v.priceSatang] : [],
    );
  } else if (tiered) {
    bases = tiered.tierPrices
      .filter((t) => t.selectedCount >= tiered.minSelect && t.selectedCount <= tiered.maxSelect)
      .map((t) => t.priceSatang);
  } else {
    bases = menu.basePriceSatang === null ? [] : [menu.basePriceSatang];
  }
  if (bases.length === 0) return null;

  let requiredExtras = 0;
  for (const group of menu.groups) {
    if (group.kind !== 'choice' || group.showWhen !== null || group.minSelect < 1) continue;
    const deltas = availableOptions(group, ingredients)
      .map((o) => o.priceDeltaSatang)
      .sort((a, b) => a - b);
    requiredExtras += deltas.slice(0, group.minSelect).reduce((a, b) => a + b, 0);
  }
  return Math.min(...bases) + requiredExtras;
}
