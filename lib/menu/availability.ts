import type { IngredientMap, Menu, MenuOption, OptionGroup } from './types';

export function isOptionAvailable(option: MenuOption, ingredients: IngredientMap): boolean {
  if (!option.isAvailable) return false;
  if (option.ingredientId === null) return true;
  return ingredients.get(option.ingredientId)?.isAvailable ?? false;
}

export function availableOptions(group: OptionGroup, ingredients: IngredientMap): MenuOption[] {
  return group.options.filter((o) => isOptionAvailable(o, ingredients));
}

export type MenuUnavailableReason =
  'off' | 'deleted' | 'ingredient_sold_out' | 'required_group_empty';

/**
 * A menu is unavailable if it is off, deleted, any required ingredient is sold out,
 * or a required group (min >= 1) has no available option.
 */
export function menuAvailability(
  menu: Menu,
  ingredients: IngredientMap,
): { available: true } | { available: false; reason: MenuUnavailableReason } {
  if (menu.isDeleted) return { available: false, reason: 'deleted' };
  if (!menu.isAvailable) return { available: false, reason: 'off' };
  for (const id of menu.ingredientIds) {
    if (!(ingredients.get(id)?.isAvailable ?? false)) {
      return { available: false, reason: 'ingredient_sold_out' };
    }
  }
  for (const group of menu.groups) {
    // Groups behind show_when are only required when shown; their parent option
    // being unavailable already hides them.
    if (group.showWhen === null && group.minSelect >= 1) {
      if (availableOptions(group, ingredients).length < group.minSelect) {
        return { available: false, reason: 'required_group_empty' };
      }
    }
  }
  if (
    menu.variants.length > 0 &&
    !menu.variants.some((v) => v.isAvailable && v.priceSatang !== null)
  ) {
    return { available: false, reason: 'off' };
  }
  return { available: true };
}
