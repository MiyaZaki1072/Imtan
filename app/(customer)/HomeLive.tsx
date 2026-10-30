'use client';

import Link from 'next/link';
import { OfflineBanner } from '@/components/OfflineBanner';
import { ShopRow } from '@/components/ShopRow';
import { card, cx } from '@/components/ui';
import { waitMinutes } from '@/lib/format';
import type { HomeData, OrderStatus } from '@/lib/orders/types';
import { useLiveData } from '@/lib/use-live-data';

const MINE_PILL: Partial<Record<OrderStatus, { text: string; cls: string }>> = {
  awaiting_payment: { text: 'รอชำระเงิน', cls: 'bg-info-soft text-info-ink' },
  queued: { text: 'อยู่ในคิว', cls: 'bg-warning-soft text-warning' },
  cooking: { text: 'กำลังทำ', cls: 'bg-warning-soft text-warning' },
  ready: { text: 'พร้อมรับ', cls: 'bg-success text-white' },
};

/** Every shop's live queue and the user's open order, refreshed as stats change. */
export function HomeLive({ initial }: { initial: HomeData }) {
  const { data, offline } = useLiveData(
    '/api/home',
    initial,
    [{ table: 'shops' }, { table: 'orders', filter: `customer_id=eq.${initial.userId}` }],
    `home:${initial.userId}`,
    10000,
  );
  const mine = data.mine;
  const pill = mine ? MINE_PILL[mine.status] : undefined;

  return (
    <>
      {offline && <OfflineBanner />}
      {mine && pill && (
        <Link
          href={
            mine.status === 'awaiting_payment'
              ? `/orders/${mine.orderId}/pay`
              : `/orders/${mine.orderId}`
          }
          className={cx(card, 'mt-3 flex items-center gap-3 px-4 py-4 hover:border-primary/40')}
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs text-muted">คิวของฉัน · {mine.shopName}</span>
            <span className="mt-0.5 block text-xl font-bold">
              {mine.queueLabel ?? 'รอชำระเงิน'}
              {mine.waitSeconds !== null && ` · รออีก ~${waitMinutes(mine.waitSeconds)} นาที`}
              {mine.status === 'ready' && ' · มารับได้เลย'}
            </span>
          </span>
          <span className={cx('rounded-full px-3 py-1 text-sm font-semibold', pill.cls)}>
            {pill.text}
          </span>
        </Link>
      )}

      <div className="mt-7 flex items-baseline justify-between">
        <h2 className="text-lg font-bold">คิวแต่ละร้านตอนนี้</h2>
        <p className="text-xs text-muted">อัปเดตแบบเรียลไทม์</p>
      </div>
      <ul className="mt-3 space-y-2.5">
        {data.shops.map((s) => (
          <li key={s.slug}>
            <ShopRow
              slug={s.slug}
              name={s.name}
              category={s.category}
              dishesInQueue={s.itemsInQueue}
              waitSeconds={s.estWaitSeconds}
              busy={s.busyLevel}
              isOpen={s.isOpen}
            />
          </li>
        ))}
      </ul>
      <Link
        href="/history"
        className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-primary"
      >
        ประวัติการสั่ง
      </Link>
    </>
  );
}
