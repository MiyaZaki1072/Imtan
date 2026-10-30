import { notFound } from 'next/navigation';
import { BackLink } from '@/components/BackLink';
import { getShop, getShops } from '@/lib/demo-data/load';
import { CartView } from './CartView';

export function generateStaticParams() {
  return getShops().map((s) => ({ slug: s.slug }));
}

export default async function CartPage({ params }: PageProps<'/s/[slug]/cart'>) {
  const { slug } = await params;
  const shop = getShop(slug);
  if (!shop) notFound();

  return (
    <main className="flex-1 px-4 pt-3 pb-40">
      <BackLink href={`/s/${shop.slug}`}>กลับหน้าร้าน</BackLink>
      <h1 className="mt-1 text-2xl font-bold">ตะกร้า</h1>
      <p className="text-sm text-muted">{shop.name} · 1 ตะกร้า = 1 ออเดอร์ = 1 เลขคิว</p>
      <CartView shop={shop} />
    </main>
  );
}
