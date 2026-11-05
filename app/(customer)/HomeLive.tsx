'use client';

import Link from 'next/link';
import { OfflineBanner } from '@/components/OfflineBanner';
import { ShopRow } from '@/components/ShopRow';
import { OpenOrderCard, useReadyAutoOpen } from '@/components/OpenOrders';
import type { HomeData } from '@/lib/orders/types';
import { useLiveData } from '@/lib/use-live-data';

/** Every shop's live queue and the user's open orders, refreshed as stats change. */
export function HomeLive({ initial }: { initial: HomeData }) {
  const { data, offline, fetchedAt } = useLiveData(
    '/api/home',
    initial,
    [{ table: 'shops' }, { table: 'orders', filter: `customer_id=eq.${initial.userId}` }],
    `home:${initial.userId}`,
    10000,
  );
  useReadyAutoOpen(data.mine);

  return (
    <>
      {offline && <OfflineBanner fetchedAt={fetchedAt} />}
      {data.mine.length > 0 && (
        <ul className="mt-3 space-y-2.5" aria-label="คิวของฉัน">
          {data.mine.map((o) => (
            <li key={o.orderId}>
              <OpenOrderCard o={o} />
            </li>
          ))}
        </ul>
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
              ratingAvg={s.ratingAvg}
              ratingCount={s.ratingCount}
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
