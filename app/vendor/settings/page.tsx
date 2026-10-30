import { notFound } from 'next/navigation';
import { vendorPageShop } from '@/lib/auth';
import { getShopFromDb } from '@/lib/shops';
import { SettingsForm } from './SettingsForm';

export default async function SettingsPage() {
  const { slug } = await vendorPageShop();
  const loaded = await getShopFromDb(slug);
  if (!loaded) notFound();
  const { shop } = loaded;
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 pt-5 pb-10">
      <h1 className="text-2xl font-bold">ตั้งค่าร้าน</h1>
      <SettingsForm
        shopId={shop.id}
        initial={{
          name: shop.name,
          category: shop.category,
          queuePrefix: shop.queuePrefix,
          isOpen: shop.isOpen,
          waitMode: shop.waitMode,
          manualSecondsPerItem: shop.manualSecondsPerItem,
          allowItemNote: shop.allowItemNote,
          allowAllergyNote: shop.allowAllergyNote,
        }}
      />
    </main>
  );
}
