import { describe, expect, it } from 'vitest';
import { loadShops } from '@/tests/fixtures';
import { pickRandomMenu } from './pick';
import { seededRng } from './random';

describe('pickRandomMenu', () => {
  it('never returns a sold-out, deleted or off menu, or a closed shop', () => {
    const shops = loadShops().map((s, i) => ({
      ...s,
      isOpen: i !== 0,
      menus: s.menus.map((m, j) => ({ ...m, isAvailable: j % 3 !== 0, isDeleted: j % 4 === 1 })),
      ingredients: s.ingredients.map((g, k) => ({ ...g, isAvailable: k % 2 === 0 })),
    }));
    const rng = seededRng(7);
    for (let n = 0; n < 500; n++) {
      const p = pickRandomMenu(shops, rng);
      if (!p) continue;
      const s = shops.find((x) => x.slug === p.slug)!;
      const m = s.menus.find((x) => x.id === p.menuId)!;
      expect(s.isOpen).toBe(true);
      expect(m.isAvailable && !m.isDeleted && !m.pairOnly).toBe(true);
    }
  });

  it('returns null when nothing can be ordered', () => {
    const closed = loadShops().map((s) => ({ ...s, isOpen: false }));
    expect(pickRandomMenu(closed, Math.random)).toBeNull();
    expect(pickRandomMenu([], Math.random)).toBeNull();
  });
});
