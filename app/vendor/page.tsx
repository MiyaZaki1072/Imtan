import { notFound } from 'next/navigation';
import { vendorPageShop } from '@/lib/auth';
import { demoPaymentsEnabled } from '@/lib/payments';
import { getVendorBoard } from '@/lib/vendor/board';
import { VendorBoard } from './VendorBoard';

export default async function VendorPage({ searchParams }: PageProps<'/vendor'>) {
  // ?interview=1: a banner and a button for owners to create sample orders (demo mode only).
  const interview = (await searchParams).interview === '1' && demoPaymentsEnabled();
  const { shopId } = await vendorPageShop();
  const board = await getVendorBoard(shopId);
  if (!board) notFound();
  return <VendorBoard initial={board} interview={interview} />;
}
