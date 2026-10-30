import type { Menu, Selections } from './types';

/** PromptPay minimum; a cart below this is blocked. */
export const MIN_ORDER_SATANG = 2000;
export const MAX_QTY = 20;
export const MAX_NOTE_LENGTH = 100;

export interface CartLine {
  menuId: string;
  selections: Selections;
  qty: number;
  note: string;
}

/** Lines with the same menu, selections and note merge into one. */
export function cartLineKey(line: Omit<CartLine, 'qty'>): string {
  const groups = Object.keys(line.selections)
    .sort()
    .map((g) => `${g}=${[...line.selections[g]].sort().join(',')}`);
  return `${line.menuId}#${groups.join(';')}#${line.note.trim()}`;
}

export interface CartIssues {
  /** Every line is a pair_only item (e.g. ข้าวเหนียว alone). */
  pairOnlyAlone: boolean;
  underMinimum: boolean;
}

export function cartIssues(lines: { menu: Menu }[], totalSatang: number): CartIssues {
  return {
    pairOnlyAlone: lines.length > 0 && lines.every((l) => l.menu.pairOnly),
    underMinimum: lines.length > 0 && totalSatang < MIN_ORDER_SATANG,
  };
}
