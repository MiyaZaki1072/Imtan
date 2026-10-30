import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { BackLink } from '@/components/BackLink';
import { getShop, getShops } from '@/lib/demo-data/load';
import { waitMinutes } from '@/lib/format';
import { sampleStats } from '@/lib/sample';
import { ShopMenu } from './ShopMenu';

const BUSY_SOFT = {
  ว่าง: 'bg-success-soft text-success',
  ปานกลาง: 'bg-warning-soft text-warning',
  แน่น: 'bg-danger-soft text-danger',
} as const;

export function generateStaticParams() {
  return getShops().map((s) => ({ slug: s.slug }));
}

export default async function ShopPage({ params }: PageProps<'/s/[slug]'>) {
  const { slug } = await params;
  const shop = getShop(slug);
  if (!shop) notFound();
  const st = sampleStats(shop);

  return (
    <main className="flex-1 pb-28">
      <header className="border-b border-border bg-surface px-4 pt-3 pb-4">
        <BackLink href="/">กลับหน้าแรก</BackLink>
        <h1 className="mt-1 text-2xl font-bold">{shop.name}</h1>
        <p className="text-sm text-muted">{shop.category}</p>
        <div className="mt-3 flex flex-wrap gap-2 text-sm font-semibold">
          <span className={`rounded-full px-3 py-1 ${BUSY_SOFT[st.busy]}`}>
            {st.busy} · {st.dishesInQueue} จานในคิว
          </span>
          <span className="rounded-full bg-bg px-3 py-1 text-ink">
            ถ้าสั่งตอนนี้ รอประมาณ {waitMinutes(st.waitSeconds + st.secondsPerItem)} นาที
          </span>
        </div>
      </header>
      <Suspense fallback={<p className="px-4 pt-6 text-muted">กำลังโหลดเมนู…</p>}>
        <ShopMenu shop={shop} />
      </Suspense>
    </main>
  );
}
