import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { getShopFromDb } from '@/lib/shops';
import { ShopMenu } from './ShopMenu';

export default function ShopPage(props: PageProps<'/s/[slug]'>) {
  return (
    <main className="flex-1 pb-28">
      <Suspense fallback={<p className="px-4 pt-10 text-muted">กำลังโหลดเมนู…</p>}>
        <Shop {...props} />
      </Suspense>
    </main>
  );
}

async function Shop({ params }: PageProps<'/s/[slug]'>) {
  const { slug } = await params;
  const loaded = await getShopFromDb(slug);
  if (!loaded) notFound();
  return <ShopMenu initial={loaded} />;
}
