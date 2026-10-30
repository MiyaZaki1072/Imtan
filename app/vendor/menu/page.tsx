import { notFound } from 'next/navigation';
import { vendorPageShop } from '@/lib/auth';
import { getShopFromDb } from '@/lib/shops';
import { MenuPrices } from './MenuPrices';

export default async function VendorMenuPage() {
  const { slug } = await vendorPageShop();
  const loaded = await getShopFromDb(slug);
  if (!loaded) notFound();
  const { shop } = loaded;
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-5 pb-10">
      <h1 className="text-2xl font-bold">เมนูและราคา</h1>
      <p className="mt-1 text-muted">
        แก้ราคาและเปิด/ปิดเมนูได้ · ราคาใหม่ใช้กับออเดอร์ใหม่เท่านั้น ออเดอร์เดิมคงราคาเดิม
      </p>
      <MenuPrices shopId={shop.id} menus={shop.menus.filter((m) => !m.isDeleted)} />
    </main>
  );
}
