import { describe, expect, it } from 'vitest';
import { loadShops } from '@/tests/fixtures';
import { ingredientMap, unitPrice, validate } from '.';
import { randomNickname, randomSelections, seededRng } from './random';

describe('randomSelections', () => {
  it('always passes validation and has a price, for every menu', () => {
    const rng = seededRng(42);
    for (const shop of loadShops()) {
      const ing = ingredientMap(shop.ingredients);
      for (const menu of shop.menus) {
        for (let i = 0; i < 60; i++) {
          const sel = randomSelections(menu, ing, rng);
          expect(sel, `${shop.slug} ${menu.name}`).not.toBeNull();
          const v = validate(menu, sel!, ing);
          expect(v.ok, `${shop.slug} ${menu.name} ${JSON.stringify(v)}`).toBe(true);
          if (v.ok) expect(unitPrice(menu, v.selections)).toBeGreaterThan(0);
        }
      }
    }
  });

  it('returns null when a required group has nothing available', () => {
    const shop = loadShops().find((s) => s.slug === 'jae-buek')!;
    for (const i of shop.ingredients) i.isAvailable = false;
    const ing = ingredientMap(shop.ingredients);
    const menu = shop.menus.find((m) => m.name === 'ผัดกะเพรา')!;
    expect(randomSelections(menu, ing, seededRng(1))).toBeNull();
  });

  it('is repeatable with the same seed and picks Thai nicknames', () => {
    const shop = loadShops()[3];
    const ing = ingredientMap(shop.ingredients);
    const a = randomSelections(shop.menus[0], ing, seededRng(7));
    const b = randomSelections(shop.menus[0], ing, seededRng(7));
    expect(a).toEqual(b);
    expect(randomNickname(seededRng(3)).length).toBeGreaterThan(0);
  });
});
