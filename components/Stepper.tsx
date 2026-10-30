'use client';

import { MinusIcon, PlusIcon } from './icons';
import { cx } from './ui';

export function Stepper({
  value,
  onChange,
  min = 1,
  max,
  size = 'md',
  label,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max: number;
  size?: 'md' | 'lg';
  /** What is being counted, for screen readers, e.g. "จำนวนจาน". */
  label: string;
}) {
  const box = size === 'lg' ? 'h-12 w-12' : 'h-11 w-11';
  return (
    <div className="inline-flex items-center gap-1" role="group" aria-label={label}>
      <button
        type="button"
        aria-label="ลดจำนวน"
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
        className={cx(
          box,
          'inline-flex items-center justify-center rounded-xl border border-border bg-surface text-ink disabled:opacity-40',
        )}
      >
        <MinusIcon size={20} />
      </button>
      <output aria-live="polite" className="min-w-8 text-center text-lg font-semibold tabular-nums">
        {value}
      </output>
      <button
        type="button"
        aria-label="เพิ่มจำนวน"
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
        className={cx(
          box,
          'inline-flex items-center justify-center rounded-xl bg-primary text-white hover:bg-primary-hover disabled:opacity-40',
        )}
      >
        <PlusIcon size={20} />
      </button>
    </div>
  );
}
