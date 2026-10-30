import { notFound } from 'next/navigation';
import { getShop } from '@/lib/demo-data/load';
import { SAMPLE_VENDOR_SHOP } from '@/lib/sample';
import { WalkInForm } from './WalkInForm';

export default function WalkInPage() {
  const shop = getShop(SAMPLE_VENDOR_SHOP);
  if (!shop) notFound();
  return (
    <main className="flex flex-1 justify-center bg-ink/5 px-4 py-6">
      <WalkInForm shop={shop} />
    </main>
  );
}
