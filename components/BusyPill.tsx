import type { BusyLevel } from '@/lib/queue';
import { cx } from './ui';

// Status always shows text plus color.
const STYLES: Record<BusyLevel, string> = {
  ว่าง: 'bg-success text-white',
  ปานกลาง: 'bg-warning-soft text-warning ring-1 ring-inset ring-warning/40',
  แน่น: 'bg-danger text-white',
};

export function BusyPill({ level, className }: { level: BusyLevel; className?: string }) {
  return (
    <span
      className={cx(
        'inline-flex min-w-16 items-center justify-center rounded-full px-3 py-1 text-sm font-semibold',
        STYLES[level],
        className,
      )}
    >
      {level}
    </span>
  );
}
