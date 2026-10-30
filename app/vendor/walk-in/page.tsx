import { notFound } from 'next/navigation';
import { vendorPageShop } from '@/lib/auth';
import { getShopFromDb } from '@/lib/shops';
import { WalkInForm } from './WalkInForm';

export default async function WalkInPage() {
  const { slug } = await vendorPageShop();
  const loaded = await getShopFromDb(slug);
  if (!loaded) notFound();
  return (
    <main className="flex flex-1 justify-center bg-ink/5 px-4 py-6">
      <WalkInForm shop={loaded.shop} />
    </main>
  );
}
