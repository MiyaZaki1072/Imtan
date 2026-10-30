import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { BackLink } from '@/components/BackLink';
import { getShopFromDb } from '@/lib/shops';
import { CartView } from './CartView';

export default function CartPage(props: PageProps<'/s/[slug]/cart'>) {
  return (
    <main className="flex-1 px-4 pt-3 pb-40">
      <Suspense fallback={<p className="pt-10 text-muted">กำลังโหลดตะกร้า…</p>}>
        <Cart {...props} />
      </Suspense>
    </main>
  );
}

async function Cart({ params }: PageProps<'/s/[slug]/cart'>) {
  const { slug } = await params;
  const loaded = await getShopFromDb(slug);
  if (!loaded) notFound();
  return (
    <>
      <BackLink href={`/s/${slug}`}>กลับหน้าร้าน</BackLink>
      <h1 className="mt-1 text-2xl font-bold">ตะกร้า</h1>
      <p className="text-sm text-muted">{loaded.shop.name} · 1 ตะกร้า = 1 ออเดอร์ = 1 เลขคิว</p>
      <CartView initial={loaded} />
    </>
  );
}
