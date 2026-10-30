import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { getShopFromDb } from '@/lib/shops';
import { PreorderView } from './PreorderView';

// Screen 4: choose a pickup time for the cart (PLAN.md Phase 8).
export default function PreorderPage(props: PageProps<'/s/[slug]/preorder'>) {
  return (
    <main className="flex-1 px-4 pt-3 pb-40">
      <Suspense fallback={<p className="pt-10 text-muted">กำลังโหลด…</p>}>
        <Preorder {...props} />
      </Suspense>
    </main>
  );
}

async function Preorder({ params }: PageProps<'/s/[slug]/preorder'>) {
  const { slug } = await params;
  const loaded = await getShopFromDb(slug);
  if (!loaded) notFound();
  return <PreorderView initial={loaded} serverNow={new Date().toISOString()} />;
}
