// "สุ่มเมนู" (PLAN-V2.md Phase 15): one orderable menu at an open shop, chosen at random.
// Pure, with the random function injected, so tests can repeat a pick.

import { menuAvailability } from './availability';
import type { Rng } from './random';
import { ingredientMap, type Shop } from './types';

export interface MenuPick {
  slug: string;
  menuId: string;
}

/** Never a sold-out, switched-off, deleted or pair-only menu, nor one at a closed shop. */
export function pickRandomMenu(shops: Shop[], rng: Rng): MenuPick | null {
  const pool = shops
    .filter((s) => s.isOpen)
    .flatMap((s) => {
      const ing = ingredientMap(s.ingredients);
      return s.menus
        .filter((m) => !m.pairOnly && menuAvailability(m, ing).available)
        .map((m) => ({ slug: s.slug, menuId: m.id }));
    });
  if (pool.length === 0) return null;
  return pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))];
}
