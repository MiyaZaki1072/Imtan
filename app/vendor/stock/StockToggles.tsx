'use client';

import { useState } from 'react';
import { cx } from '@/components/ui';
import type { Ingredient } from '@/lib/menu';

export function StockToggles({
  ingredients,
  usage,
}: {
  ingredients: Ingredient[];
  usage: Record<string, number>;
}) {
  // Phase 5: each toggle calls a vendor server action and reaches customers via Realtime.
  const [available, setAvailable] = useState(
    () => new Map(ingredients.map((i) => [i.id, i.isAvailable])),
  );

  return (
    <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {ingredients.map((i) => {
        const on = available.get(i.id) ?? true;
        return (
          <li key={i.id}>
            <button
              type="button"
              aria-pressed={!on}
              aria-label={`${i.name}: ${on ? 'มี' : 'หมด'}`}
              onClick={() => setAvailable((m) => new Map(m).set(i.id, !on))}
              className={cx(
                'flex min-h-24 w-full flex-col items-start justify-between rounded-2xl border-2 px-4 py-3 text-left',
                on ? 'border-success/40 bg-surface' : 'border-danger bg-danger-soft',
              )}
            >
              <span className="text-lg font-bold">{i.name}</span>
              <span className="flex w-full items-center justify-between">
                <span
                  className={cx(
                    'rounded-full px-3 py-0.5 text-sm font-bold',
                    on ? 'bg-success text-white' : 'bg-danger text-white',
                  )}
                >
                  {on ? 'มี' : 'หมด'}
                </span>
                <span className="text-xs text-muted">ใช้ใน {usage[i.id] ?? 0} เมนู</span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
