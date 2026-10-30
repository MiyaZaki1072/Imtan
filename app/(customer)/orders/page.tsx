import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { BottomNav } from '@/components/BottomNav';
import { btnPrimary } from '@/components/ui';
import { getSession } from '@/lib/auth';
import { getLatestOrderId } from '@/lib/orders/view';

// "คิวของฉัน" in the bottom bar: jump to the newest open order.
export default function MyQueuePage() {
  return (
    <Suspense fallback={<p className="px-4 pt-10 text-muted">กำลังโหลดคิว…</p>}>
      <MyQueue />
    </Suspense>
  );
}

async function MyQueue() {
  const session = await getSession();
  if (!session) redirect('/welcome?next=/orders');
  const id = await getLatestOrderId(session.userId);
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
