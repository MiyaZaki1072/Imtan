import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { getShop } from '@/lib/demo-data/load';
import { sampleCustomerOrder, SAMPLE_ORDER_ID, SAMPLE_VENDOR_SHOP } from '@/lib/sample';
import { OrderView } from './OrderView';

export function generateStaticParams() {
  return [{ id: SAMPLE_ORDER_ID }];
}

export default async function OrderPage({ params }: PageProps<'/orders/[id]'>) {
  const { id } = await params;
  const shop = getShop(SAMPLE_VENDOR_SHOP);
  const order = id === SAMPLE_ORDER_ID && shop ? sampleCustomerOrder(shop) : null;
  if (!order) notFound();

  return (
    <Suspense fallback={<p className="px-4 pt-10 text-muted">กำลังโหลดคิว…</p>}>
      <OrderView order={order} />
    </Suspense>
  );
}
