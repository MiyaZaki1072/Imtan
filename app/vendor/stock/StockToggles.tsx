'use client';

import { useState } from 'react';
import { cx } from '@/components/ui';
import type { Ingredient } from '@/lib/menu';
import { actSetIngredientAvailable } from '@/lib/vendor/actions';

export function StockToggles({
  shopId,
  ingredients,
  usage,
}: {
  shopId: string;
  ingredients: Ingredient[];
  usage: Record<string, number>;
}) {
  const [available, setAvailable] = useState(
    () => new Map(ingredients.map((i) => [i.id, i.isAvailable])),
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle(id: string) {
    const next = !(available.get(id) ?? true);
    setBusy(id);
    setError(null);
    // Saved first, then shown: the toggle always matches what customers see.
    const result = await actSetIngredientAvailable(shopId, id, next).catch(() => ({ ok: false }));
    if (result.ok) setAvailable((m) => new Map(m).set(id, next));
    else setError('บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง');
    setBusy(null);
  }

  return (
    <>
      {error && (
        <p
          role="alert"
          className="mt-4 rounded-xl bg-danger-soft px-4 py-3 font-semibold text-danger"
        >
          {error}
        </p>
      )}
      <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {ingredients.map((i) => {
          const on = available.get(i.id) ?? true;
          return (
            <li key={i.id}>
              <button
                type="button"
                aria-pressed={!on}
                aria-label={`${i.name}: ${on ? 'มี' : 'หมด'}`}
                disabled={busy === i.id}
                onClick={() => toggle(i.id)}
                className={cx(
                  'flex min-h-24 w-full flex-col items-start justify-between rounded-2xl border-2 px-4 py-3 text-left disabled:opacity-60',
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
    </>
  );
}
