import { notFound } from 'next/navigation';
import { vendorPageShop } from '@/lib/auth';
import { getVendorBoard } from '@/lib/vendor/board';
import { VendorBoard } from './VendorBoard';

export default async function VendorPage() {
  const { shopId } = await vendorPageShop();
  const board = await getVendorBoard(shopId);
  if (!board) notFound();
  return <VendorBoard initial={board} />;
}
