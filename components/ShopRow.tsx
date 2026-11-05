import Link from 'next/link';
import { formatWaitRange } from '@/lib/format';
import type { BusyLevel } from '@/lib/queue';
import { BusyPill } from './BusyPill';
import { StarIcon } from './icons';
import { card, cx } from './ui';

export function ShopRow({
  slug,
  name,
  category,
  dishesInQueue,
  waitSeconds,
  busy,
  isOpen,
  ratingAvg = null,
  ratingCount = 0,
}: {
  slug: string;
  name: string;
  category: string;
  dishesInQueue: number;
  waitSeconds: number;
  busy: BusyLevel;
  isOpen: boolean;
  ratingAvg?: number | null;
  ratingCount?: number;
}) {
  return (
    <Link
      href={`/s/${slug}`}
      className={cx(card, 'flex items-center gap-3 px-4 py-3.5 hover:border-primary/40')}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-semibold">{name}</p>
        <p className="flex items-center gap-1 truncate text-xs text-muted">
          {category}
          {/* Only with 3+ ratings: one rating is misleading (PLAN-V2.md D5). */}
          {ratingAvg !== null && ratingCount >= 3 && (
            <span className="inline-flex items-center gap-0.5 font-semibold text-warning">
              · <StarIcon size={12} fill="currentColor" />
              {Number(ratingAvg).toFixed(1)} ({ratingCount})
            </span>
          )}
        </p>
        <p className="mt-1 text-sm text-muted">
          {isOpen
            ? `${dishesInQueue} จานในคิว · รอ ${formatWaitRange(waitSeconds)}`
            : 'ปิดรับชั่วคราว'}
        </p>
      </div>
      {isOpen ? (
        <BusyPill level={busy} />
      ) : (
        <span className="rounded-full bg-border px-3 py-1 text-sm font-semibold text-muted">
          ปิด
        </span>
      )}
    </Link>
  );
}
