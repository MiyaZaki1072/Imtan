import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { BackLink } from '@/components/BackLink';
import { BottomNav } from '@/components/BottomNav';
import { HistoryList } from '@/components/HistoryList';
import { getSession } from '@/lib/auth';
import { getHistory } from '@/lib/orders/history';

// Screen 10b: order history + "สั่งอีก" (PLAN.md Phase 8).
export default function HistoryPage() {
  return (
    <>
      <main className="flex-1 px-4 pt-3 pb-24">
        <BackLink href="/">หน้าแรก</BackLink>
        <h1 className="mt-1 text-2xl font-bold">ประวัติการสั่ง</h1>
        <div className="mt-4">
          <Suspense fallback={<p className="text-muted">กำลังโหลดประวัติ…</p>}>
            <History />
          </Suspense>
        </div>
      </main>
      <BottomNav />
    </>
  );
}

async function History() {
  const session = await getSession();
  if (!session) redirect('/welcome?next=/history');
  return <HistoryList entries={await getHistory(session.userId, 30)} />;
}
