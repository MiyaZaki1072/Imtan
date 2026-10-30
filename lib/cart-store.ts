'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { cartLineKey, MAX_QTY, type CartLine } from './menu';

// One cart per shop, kept in sessionStorage on this device.
// Only menu ids, selections, qty and notes are stored. Prices are always recomputed.

export interface StoredLine extends CartLine {
  key: string;
}

export interface StoredCart {
  lines: StoredLine[];
  allergyNote: string;
}

const EMPTY: StoredCart = { lines: [], allergyNote: '' };
const listeners = new Set<() => void>();
const cache = new Map<string, { raw: string | null; value: StoredCart }>();

const storageKey = (slug: string) => `imtan:cart:${slug}`;

function read(slug: string): StoredCart {
  let raw: string | null = null;
  try {
    raw = window.sessionStorage.getItem(storageKey(slug));
  } catch {
    raw = null;
  }
  const hit = cache.get(slug);
  if (hit && hit.raw === raw) return hit.value;
  let value = EMPTY;
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as StoredCart;
      if (Array.isArray(parsed.lines))
        value = { lines: parsed.lines, allergyNote: parsed.allergyNote ?? '' };
    } catch {
      value = EMPTY;
    }
  }
  cache.set(slug, { raw, value });
  return value;
}

function write(slug: string, cart: StoredCart) {
  const raw = JSON.stringify(cart);
  try {
    window.sessionStorage.setItem(storageKey(slug), raw);
  } catch {
    // Storage blocked: keep the cart in memory for this page.
  }
  cache.set(slug, { raw, value: cart });
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useCart(slug: string) {
  const cart = useSyncExternalStore(
    subscribe,
    () => read(slug),
    () => EMPTY,
  );

  const add = useCallback(
    (line: CartLine) => {
      const current = read(slug);
      const key = cartLineKey(line);
      const existing = current.lines.find((l) => l.key === key);
      const lines = existing
        ? current.lines.map((l) =>
            l.key === key ? { ...l, qty: Math.min(MAX_QTY, l.qty + line.qty) } : l,
          )
        : [...current.lines, { ...line, key }];
      write(slug, { ...current, lines });
    },
    [slug],
  );

  const setQty = useCallback(
    (key: string, qty: number) => {
      const current = read(slug);
      const lines =
        qty <= 0
          ? current.lines.filter((l) => l.key !== key)
          : current.lines.map((l) => (l.key === key ? { ...l, qty: Math.min(MAX_QTY, qty) } : l));
      write(slug, { ...current, lines });
    },
    [slug],
  );

  const setAllergyNote = useCallback(
    (allergyNote: string) => write(slug, { ...read(slug), allergyNote }),
    [slug],
  );

  const clear = useCallback(() => write(slug, EMPTY), [slug]);

  return { cart, add, setQty, setAllergyNote, clear };
}

/** Puts these lines in the shop's cart (used by "สั่งอีก"); replaces what was there. */
export function replaceCart(slug: string, lines: CartLine[]) {
  write(slug, { lines: lines.map((l) => ({ ...l, key: cartLineKey(l) })), allergyNote: '' });
}
