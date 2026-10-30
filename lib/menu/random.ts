import { availableOptions } from './availability';
import type { IngredientMap, Menu, Selections } from './types';
import { visibleGroups } from './visibility';

export type Rng = () => number;

/** Small seeded generator so tests can repeat a run. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NICKNAMES = [
  'ฝ้าย',
  'ต้น',
  'มิ้นท์',
  'บอส',
  'ฝน',
  'แพร',
  'ภูมิ',
  'ใบเตย',
  'กันต์',
  'ปาล์ม',
  'นนท์',
  'พลอย',
  'ก้อง',
  'เบล',
  'ไอซ์',
  'ต้นข้าว',
  'เอม',
  'โอ๊ต',
  'น้ำ',
  'ทีม',
];

export const randomNickname = (rng: Rng): string => NICKNAMES[Math.floor(rng() * NICKNAMES.length)];

function pickDistinct<T>(items: T[], count: number, rng: Rng): T[] {
  const pool = [...items];
  const out: T[] = [];
  while (out.length < count && pool.length)
    out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  return out;
}

/**
 * A random order for one menu that follows its own rules: groups in order, hidden groups
 * skipped, picks within min..max from available options. Returns null when the menu can't
 * be ordered right now (a required group has no available option). Callers still run
 * the result through validate()/buildOrder(), so a bad pick can never reach an order.
 */
export function randomSelections(
  menu: Menu,
  ingredients: IngredientMap,
  rng: Rng,
): Selections | null {
  const sel: Selections = {};
  for (const group of menu.groups) {
    if (!visibleGroups(menu, sel).some((g) => g.id === group.id)) continue;
    const avail = availableOptions(group, ingredients);
    const min = group.kind === 'variant' ? 1 : group.minSelect;
    const max = group.kind === 'variant' ? 1 : group.maxSelect;
    if (avail.length < min) return null;

    let count: number;
    switch (group.kind) {
      case 'toppings':
        sel[group.id] = avail.map((o) => o.id); // everything on, like the default
        continue;
      case 'remove':
        count = rng() < 0.75 ? 0 : 1;
        break;
      case 'variant':
        count = 1;
        break;
      case 'tiered':
        count = min + Math.floor(rng() * (Math.min(max, avail.length) - min + 1));
        break;
      default:
        // choice: required groups take their minimum most of the time; optional extras are rare.
        count = min >= 1 ? (rng() < 0.8 ? min : Math.min(max, min + 1)) : rng() < 0.7 ? 0 : 1;
    }
    count = Math.max(min, Math.min(count, max, avail.length));
    sel[group.id] = pickDistinct(avail, count, rng).map((o) => o.id);
  }
  return sel;
}
