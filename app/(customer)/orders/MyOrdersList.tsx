'use client';

import { OfflineBanner } from '@/components/OfflineBanner';
import { OpenOrderCard, useReadyAutoOpen } from '@/components/OpenOrders';
import type { HomeMine } from '@/lib/orders/types';
import { useLiveData } from '@/lib/use-live-data';

/** "คิวของฉัน" when the customer has two or more open orders. */
export function MyOrdersList({ userId, initial }: { userId: string; initial: HomeMine[] }) {
  const { data, offline, fetchedAt } = useLiveData(
    '/api/my-orders',
    initial,
    [{ table: 'orders', filter: `customer_id=eq.${userId}` }],
    `my-orders:${userId}`,
    10000,
  );
  useReadyAutoOpen(data);
  return (
    <>
      {offline && <OfflineBanner fetchedAt={fetchedAt} />}
      {data.length === 0 ? (
        <p className="mt-6 text-center text-muted">ไม่มีคิวที่เปิดอยู่แล้ว</p>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {data.map((o) => (
            <li key={o.orderId}>
              <OpenOrderCard o={o} showTitle={false} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
