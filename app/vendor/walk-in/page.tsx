import { notFound } from 'next/navigation';
import { getShop } from '@/lib/demo-data/load';
import { vendorPageShopSlug } from '@/lib/auth';
import { WalkInForm } from './WalkInForm';

export default async function WalkInPage() {
  const shop = getShop(await vendorPageShopSlug());
  if (!shop) notFound();
  return (
    <main className="flex flex-1 justify-center bg-ink/5 px-4 py-6">
      <WalkInForm shop={shop} />
    </main>
  );
}
