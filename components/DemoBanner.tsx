import { cx } from './ui';

/** Required label on every demo payment / demo tool screen. */
export function DemoBanner({ className }: { className?: string }) {
  return (
    <p
      role="note"
      className={cx(
        'rounded-xl bg-info-soft px-4 py-2.5 text-center text-sm font-semibold text-info-ink',
        className,
      )}
    >
      โหมดทดสอบ — ไม่มีการตัดเงินจริง
    </p>
  );
}
