import { notFound } from 'next/navigation';
import { getShop } from '@/lib/demo-data/load';
import { sampleCustomerOrder, SAMPLE_ORDER_ID, SAMPLE_VENDOR_SHOP } from '@/lib/sample';
import { PayView } from './PayView';

export function generateStaticParams() {
  return [{ id: SAMPLE_ORDER_ID }];
}

// Phase 4 adds the DEMO_PAYMENTS=true check and order ownership.
export default async function PayPage({ params }: PageProps<'/orders/[id]/pay'>) {
  const { id } = await params;
  const shop = getShop(SAMPLE_VENDOR_SHOP);
  const order = id === SAMPLE_ORDER_ID && shop ? sampleCustomerOrder(shop) : null;
  if (!order || !shop || order.totalSatang === null) notFound();

  return (
    <PayView
      orderId={order.id}
      shopSlug={shop.slug}
      shopName={shop.name}
      amountSatang={order.totalSatang}
      items={order.items.map((it) => `${it.kitchenSummary} × ${it.qty}`)}
    />
  );
}
