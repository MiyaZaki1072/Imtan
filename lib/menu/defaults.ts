import { availableOptions, isOptionAvailable } from './availability';
import type { IngredientMap, Menu, Selections } from './types';

/**
 * Starting selections from the data: `is_default` options that are available.
 * Toppings start with every available option selected. Remove groups start empty.
 * Hidden groups are included; validation drops them.
 */
export function defaultSelections(menu: Menu, ingredients: IngredientMap): Selections {
  const selections: Selections = {};
  for (const group of menu.groups) {
    if (group.kind === 'remove') {
      selections[group.id] = [];
    } else if (group.kind === 'toppings') {
      selections[group.id] = availableOptions(group, ingredients).map((o) => o.id);
    } else {
      selections[group.id] = group.options
        .filter((o) => o.isDefault && isOptionAvailable(o, ingredients))
        .slice(0, group.maxSelect)
        .map((o) => o.id);
    }
  }
  return selections;
}
