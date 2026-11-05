import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { BottomNav } from '@/components/BottomNav';
import { btnPrimary } from '@/components/ui';
import { getUserId } from '@/lib/auth';
import { getLatestOrderId, getOpenOrders } from '@/lib/orders/view';
import { MyOrdersList } from './MyOrdersList';

// "คิวของฉัน" in the bottom bar: a list when there are 2+ open orders, else the newest order.
export default function MyQueuePage() {
  return (
    <Suspense fallback={<p className="px-4 pt-10 text-muted">กำลังโหลดคิว…</p>}>
      <MyQueue />
    </Suspense>
  );
}

async function MyQueue() {
  const userId = await getUserId();
  if (!userId) redirect('/welcome?next=/orders');
  const open = await getOpenOrders(userId);
  if (open.length >= 2) {
    return (
      <>
        <main className="flex-1 px-4 pt-6 pb-24">
          <h1 className="text-2xl font-bold">คิวของฉัน</h1>
          <p className="mt-1 text-sm text-muted">{open.length} ออเดอร์ที่ยังไม่ได้รับ</p>
          <MyOrdersList userId={userId} initial={open} />
        </main>
        <BottomNav />
      </>
    );
  }
  const id = open[0]?.orderId ?? (await getLatestOrderId(userId));
  if (id) redirect(`/orders/${id}`);
  return (
    <>
      <main className="flex flex-1 flex-col items-center justify-center px-4 pb-24 text-center">
        <h1 className="text-2xl font-bold">ยังไม่มีคิว</h1>
        <p className="mt-2 text-muted">เลือกร้านแล้วสั่งอาหาร คิวของคุณจะมาอยู่ที่นี่</p>
        <Link href="/" className={`${btnPrimary} mt-6 min-h-12`}>
          ดูคิวทุกร้าน
        </Link>
      </main>
      <BottomNav />
    </>
  );
}
