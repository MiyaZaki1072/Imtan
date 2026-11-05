import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { BottomNav } from '@/components/BottomNav';
import { Greeting } from '@/components/Greeting';
import { QrIcon } from '@/components/icons';
import { getUserId } from '@/lib/auth';
import { getHomeData } from '@/lib/home';
import { InstallPrompt } from '@/components/InstallPrompt';
import { RandomMenuButton } from '@/components/RandomMenuButton';
import { ThemeToggle } from '@/components/ThemeToggle';
import { card, cx } from '@/components/ui';
import { getPopularMenus } from '@/lib/orders/popular';
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
          <div className="flex items-center gap-2">
            <Greeting />
            <ThemeToggle />
          </div>
        </header>
        <InstallPrompt />

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

        <div className="mt-6">
          <RandomMenuButton />
        </div>
        <Suspense fallback={null}>
          <Popular />
        </Suspense>
      </main>
      <BottomNav />
    </>
  );
}

/** Top 3 menus from real orders in the last 14 days; hidden without data. */
async function Popular() {
  const menus = await getPopularMenus();
  if (menus.length === 0) return null;
  return (
    <section className="mt-6" aria-label="เมนูยอดนิยม">
      <h2 className="text-lg font-bold">เมนูยอดนิยม 14 วัน</h2>
      <ul className="mt-3 space-y-2">
        {menus.map((m, i) => (
          <li key={m.menuId}>
            <Link
              href={`/s/${m.shopSlug}?menu=${encodeURIComponent(m.menuId)}`}
              className={cx(card, 'flex min-h-12 items-center gap-3 px-4 py-3 hover:border-primary/40')}
            >
              <span className="text-lg font-bold text-primary">{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{m.menuName}</span>
                <span className="block truncate text-xs text-muted">{m.shopName}</span>
              </span>
              <span className="text-sm text-muted">{m.qty} จาน</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

async function Live() {
  const userId = await getUserId();
  if (!userId) redirect('/welcome');
  return <HomeLive initial={await getHomeData(userId)} />;
}
