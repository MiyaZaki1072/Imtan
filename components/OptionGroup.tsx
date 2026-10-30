'use client';

import { formatBaht } from '@/lib/format';
import { isOptionAvailable, type IngredientMap, type OptionGroup as Group } from '@/lib/menu';
import { CheckIcon } from './icons';
import { cx } from './ui';

function hint(group: Group): string {
  switch (group.kind) {
    case 'variant':
      return 'เลือก 1';
    case 'tiered':
      return `เลือก ${group.minSelect}–${group.maxSelect} อย่าง · ${group.tierPrices
        .map((t) => `${t.selectedCount} อย่าง ${formatBaht(t.priceSatang)}`)
        .join(' / ')}`;
    case 'choice':
      if (group.minSelect === 1 && group.maxSelect === 1) return 'เลือก 1';
      return group.minSelect > 0
        ? `เลือก ${group.minSelect}–${group.maxSelect}`
        : `ไม่บังคับ · เลือกได้สูงสุด ${group.maxSelect}`;
    case 'remove':
      return 'ไม่บังคับ · กดสิ่งที่ไม่ต้องการ';
    case 'toppings':
      return 'ใส่ให้ครบทุกอย่าง กดเพื่อเอาออก';
  }
}

/** One option group, for all 5 kinds (PLAN.md §4a). */
export function OptionGroup({
  group,
  selected,
  onChange,
  ingredients,
  missing,
  size = 'md',
}: {
  group: Group;
  selected: string[];
  onChange: (ids: string[]) => void;
  ingredients: IngredientMap;
  /** Required and not chosen yet. */
  missing?: boolean;
  size?: 'md' | 'lg';
}) {
  const single = group.kind === 'variant' || group.maxSelect === 1;
  const full = !single && selected.length >= group.maxSelect;
  const available = group.options.filter((o) => isOptionAvailable(o, ingredients));
  const allIn = available.length > 0 && available.every((o) => selected.includes(o.id));

  function toggle(id: string) {
    const on = selected.includes(id);
    if (single) {
      // A required single pick can't be cleared; an optional one can.
      if (on) onChange(group.minSelect >= 1 ? selected : []);
      else onChange([id]);
      return;
    }
    if (on) onChange(selected.filter((x) => x !== id));
    else if (!full) onChange([...selected, id]);
  }

  return (
    <fieldset className="border-t border-border pt-4">
      <legend className="sr-only">{group.name}</legend>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p aria-hidden="true" className="font-semibold">
          {group.name}
        </p>
        {missing && (
          <span className="rounded-full bg-danger-soft px-2.5 py-0.5 text-xs font-semibold text-danger">
            ต้องเลือก
          </span>
        )}
      </div>
      <p className="mt-0.5 text-xs text-muted">{hint(group)}</p>
      {group.note && <p className="mt-0.5 text-xs text-info-ink">{group.note}</p>}

      <div className="mt-3 flex flex-wrap gap-2">
        {group.kind === 'toppings' && (
          <button
            type="button"
            aria-pressed={allIn}
            onClick={() => onChange(allIn ? [] : available.map((o) => o.id))}
            className={cx(
              'inline-flex items-center gap-1 rounded-full border px-4 font-semibold',
              size === 'lg' ? 'min-h-12' : 'min-h-11',
              allIn ? 'border-primary bg-primary text-white' : 'border-border bg-surface',
            )}
          >
            {group.selectAllLabel ?? 'ใส่ทุกอย่าง'}
          </button>
        )}
        {group.options.map((o) => {
          const ok = isOptionAvailable(o, ingredients);
          const on = selected.includes(o.id);
          const blocked = !ok || (!on && full);
          const name = group.kind === 'remove' ? `ไม่ใส่${o.name}` : o.name;
          return (
            <button
              key={o.id}
              type="button"
              aria-pressed={on}
              disabled={blocked}
              onClick={() => toggle(o.id)}
              className={cx(
                'inline-flex items-center gap-1 rounded-full border px-4 text-sm',
                size === 'lg' ? 'min-h-12 text-base' : 'min-h-11',
                on
                  ? 'border-primary bg-primary-soft font-semibold text-primary-hover'
                  : 'border-border bg-surface text-ink',
                blocked && 'opacity-45',
                !ok && 'line-through',
              )}
            >
              {on && <CheckIcon size={16} strokeWidth={3} />}
              {name}
              {o.priceDeltaSatang > 0 && (
                <span className={cx('text-xs', on ? 'text-primary-hover' : 'text-muted')}>
                  +{formatBaht(o.priceDeltaSatang)}
                </span>
              )}
              {!ok && <span className="text-xs no-underline">(หมด)</span>}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
