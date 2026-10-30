import { notFound } from 'next/navigation';
import { getShop } from '@/lib/demo-data/load';
import { SAMPLE_VENDOR_SHOP } from '@/lib/sample';
import { SettingsForm } from './SettingsForm';

export default function SettingsPage() {
  const shop = getShop(SAMPLE_VENDOR_SHOP);
  if (!shop) notFound();
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 pt-5 pb-10">
      <h1 className="text-2xl font-bold">ตั้งค่าร้าน</h1>
      <SettingsForm
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
