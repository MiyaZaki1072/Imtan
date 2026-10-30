import { formatBaht, waitMinutes } from '@/lib/format';
import { PlusIcon } from './icons';
import { card, cx } from './ui';

export function MenuCard({
  name,
  cookSeconds,
  startingPriceSatang,
  available,
  pairOnly,
  inCart,
  onOpen,
}: {
  name: string;
  cookSeconds: number;
  startingPriceSatang: number | null;
  available: boolean;
  pairOnly: boolean;
  inCart: number;
  onOpen: () => void;
}) {
  const price = startingPriceSatang === null ? null : formatBaht(startingPriceSatang);
  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={!available}
      aria-label={available ? `เลือก ${name}` : `${name} หมดแล้ว`}
      className={cx(
        card,
        'flex w-full items-center gap-3 px-4 py-3.5 text-left',
        available ? 'hover:border-primary/40' : 'cursor-not-allowed bg-bg',
      )}
    >
      <div className="min-w-0 flex-1">
        <p className={cx('font-semibold', !available && 'text-muted line-through')}>{name}</p>
        <p className="mt-0.5 text-sm text-muted">
          ใช้เวลาทำ ~{waitMinutes(cookSeconds)} นาที{price && ` · เริ่ม ${price}`}
        </p>
        {pairOnly && <p className="mt-0.5 text-xs text-warning">สั่งคู่กับเมนูอื่นเท่านั้น</p>}
      </div>
      {available ? (
        <span className="relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border text-ink">
          <PlusIcon size={20} />
          {inCart > 0 && (
            <span className="absolute -top-2 -right-2 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold text-white">
              {inCart}
            </span>
          )}
        </span>
      ) : (
        <span className="shrink-0 rounded-full bg-danger-soft px-3 py-1 text-sm font-semibold text-danger">
          หมดแล้ว
        </span>
      )}
    </button>
  );
}
