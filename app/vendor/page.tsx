import { notFound } from 'next/navigation';
import { getShop } from '@/lib/demo-data/load';
import { sampleOrders, SAMPLE_NOW, SAMPLE_VENDOR_SHOP } from '@/lib/sample';
import { VendorBoard } from './VendorBoard';

export default function VendorPage() {
  const shop = getShop(SAMPLE_VENDOR_SHOP);
  if (!shop) notFound();
  return (
    <VendorBoard
      prefix={shop.queuePrefix}
      secondsPerItem={shop.manualSecondsPerItem}
      waitMode={shop.waitMode}
      initialOrders={sampleOrders(shop)}
      now={SAMPLE_NOW}
    />
  );
}
