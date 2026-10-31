import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { BottomNav } from '@/components/BottomNav';
import { Greeting } from '@/components/Greeting';
import { QrIcon } from '@/components/icons';
import { getUserId } from '@/lib/auth';
import { getHomeData } from '@/lib/home';
import { HomeLive } from './HomeLive';

export default function HomePage() {
  return (
    <>
      <main className="flex-1 px-4 pt-6 pb-24">
        <header className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-primary">อิ่มทัน</h1>
            <p className="mt-1 text-sm text-muted">โรงอาหารคณะวิศวกรรมศาสตร์ จุฬาฯ</p>
          </div>
          <Greeting />
        </header>

        <Link
          href="/scan"
          className="mt-5 flex items-center gap-4 rounded-2xl bg-primary px-5 py-5 text-white hover:bg-primary-hover"
        >
          <QrIcon size={44} strokeWidth={1.75} />
          <span>
            <span className="block text-xl font-bold">สแกน QR หน้าร้าน</span>
            <span className="block text-sm text-white/90">
              รับคิวและสั่งอาหารได้ทันที ไม่ต้องติดตั้งแอป
            </span>
          </span>
        </Link>

        <Suspense fallback={<p className="mt-8 text-muted">กำลังโหลดคิว…</p>}>
          <Live />
        </Suspense>
      </main>
      <BottomNav />
    </>
  );
}

async function Live() {
  const userId = await getUserId();
  if (!userId) redirect('/welcome');
  return <HomeLive initial={await getHomeData(userId)} />;
}
