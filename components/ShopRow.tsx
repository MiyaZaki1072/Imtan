import Link from 'next/link';
import { waitMinutes } from '@/lib/format';
import type { BusyLevel } from '@/lib/queue';
import { BusyPill } from './BusyPill';
import { card, cx } from './ui';

export function ShopRow({
  slug,
  name,
  category,
  dishesInQueue,
  waitSeconds,
  busy,
  isOpen,
}: {
  slug: string;
  name: string;
  category: string;
  dishesInQueue: number;
  waitSeconds: number;
  busy: BusyLevel;
  isOpen: boolean;
}) {
  return (
    <Link
      href={`/s/${slug}`}
      className={cx(card, 'flex items-center gap-3 px-4 py-3.5 hover:border-primary/40')}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-semibold">{name}</p>
        <p className="truncate text-xs text-muted">{category}</p>
        <p className="mt-1 text-sm text-muted">
          {isOpen
            ? `${dishesInQueue} จานในคิว · รอประมาณ ${waitMinutes(waitSeconds)} นาที`
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
