import { isOptionAvailable, menuAvailability } from './availability';
import { basePrice } from './price';
import type { IngredientMap, Menu, Selections } from './types';
import { visibleGroups } from './visibility';

export type ValidationErrorCode =
  | 'menu_unavailable'
  | 'unknown_group'
  | 'unknown_option'
  | 'duplicate_option'
  | 'option_unavailable'
  | 'too_few'
  | 'too_many'
  | 'no_price';

export interface ValidationError {
  code: ValidationErrorCode;
  groupId?: string;
}

export type ValidationResult =
  | { ok: true; selections: Selections }
  | { ok: false; errors: ValidationError[]; selections: Selections };

/**
 * Checks selections against the menu and returns them cleaned: hidden groups are dropped
 * even if the client sent them, and every visible group has an entry.
 */
export function validate(
  menu: Menu,
  selections: Selections,
  ingredients: IngredientMap,
): ValidationResult {
  const errors: ValidationError[] = [];
  const groupIds = new Set(menu.groups.map((g) => g.id));
  for (const id of Object.keys(selections)) {
    if (!groupIds.has(id)) errors.push({ code: 'unknown_group', groupId: id });
  }

  if (!menuAvailability(menu, ingredients).available) errors.push({ code: 'menu_unavailable' });

  const cleaned: Selections = {};
  for (const group of visibleGroups(menu, selections)) {
    const picked = selections[group.id] ?? [];
    cleaned[group.id] = picked;

    if (new Set(picked).size !== picked.length) {
      errors.push({ code: 'duplicate_option', groupId: group.id });
    }
    for (const id of picked) {
      const option = group.options.find((o) => o.id === id);
      if (!option) errors.push({ code: 'unknown_option', groupId: group.id });
      else if (!isOptionAvailable(option, ingredients)) {
        errors.push({ code: 'option_unavailable', groupId: group.id });
      }
    }

    const min = group.kind === 'variant' ? 1 : group.minSelect;
    const max = group.kind === 'variant' ? 1 : group.maxSelect;
    if (picked.length < min) errors.push({ code: 'too_few', groupId: group.id });
    if (picked.length > max) errors.push({ code: 'too_many', groupId: group.id });
  }

  if (errors.length === 0 && basePrice(menu, cleaned) === null) errors.push({ code: 'no_price' });

  return errors.length === 0
    ? { ok: true, selections: cleaned }
    : { ok: false, errors, selections: cleaned };
}
