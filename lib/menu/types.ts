// Menu model per PLAN.md §4a. Money is integer satang.

export type OptionGroupKind = 'variant' | 'tiered' | 'choice' | 'remove' | 'toppings';

export interface Ingredient {
  id: string;
  name: string;
  isAvailable: boolean;
}

export interface MenuOption {
  id: string;
  name: string;
  priceDeltaSatang: number;
  ingredientId: string | null;
  isDefault: boolean;
  isAvailable: boolean;
}

export interface TierPrice {
  selectedCount: number;
  priceSatang: number;
}

export interface OptionGroup {
  id: string;
  name: string;
  kind: OptionGroupKind;
  minSelect: number;
  maxSelect: number;
  showWhen: { groupId: string; optionIds: string[] } | null;
  selectAllLabel: string | null;
  note: string | null;
  options: MenuOption[];
  tierPrices: TierPrice[];
}

export interface MenuVariant {
  /** One option id per variant group, sorted. */
  optionIds: string[];
  priceSatang: number | null;
  isAvailable: boolean;
}

export interface Menu {
  id: string;
  category: string;
  name: string;
  cookSeconds: number;
  basePriceSatang: number | null;
  pairOnly: boolean;
  isAvailable: boolean;
  isDeleted: boolean;
  ingredientIds: string[];
  groups: OptionGroup[];
  variants: MenuVariant[];
}

export interface Shop {
  id: string;
  slug: string;
  name: string;
  category: string;
  queuePrefix: string;
  isOpen: boolean;
  allowItemNote: boolean;
  allowAllergyNote: boolean;
  waitMode: 'auto' | 'manual';
  manualSecondsPerItem: number;
  ingredients: Ingredient[];
  menus: Menu[];
}

/** Selected option ids per group id. */
export type Selections = Record<string, string[]>;

export type IngredientMap = ReadonlyMap<string, Ingredient>;

export function ingredientMap(ingredients: readonly Ingredient[]): IngredientMap {
  return new Map(ingredients.map((i) => [i.id, i]));
}
