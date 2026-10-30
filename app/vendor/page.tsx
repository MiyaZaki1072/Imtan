import { notFound } from 'next/navigation';
import { getShop } from '@/lib/demo-data/load';
import { sampleOrders, SAMPLE_NOW } from '@/lib/sample';
import { vendorPageShopSlug } from '@/lib/auth';
import { VendorBoard } from './VendorBoard';

export default async function VendorPage() {
  const shop = getShop(await vendorPageShopSlug());
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
