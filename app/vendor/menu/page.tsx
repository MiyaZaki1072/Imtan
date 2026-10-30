import { notFound } from 'next/navigation';
import { getShop } from '@/lib/demo-data/load';
import { SAMPLE_VENDOR_SHOP } from '@/lib/sample';
import { MenuPrices } from './MenuPrices';

export default function VendorMenuPage() {
  const shop = getShop(SAMPLE_VENDOR_SHOP);
  if (!shop) notFound();
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-5 pb-10">
      <h1 className="text-2xl font-bold">เมนูและราคา</h1>
      <p className="mt-1 text-muted">
        แก้ราคาและเปิด/ปิดเมนูได้ · ราคาใหม่ใช้กับออเดอร์ใหม่เท่านั้น ออเดอร์เดิมคงราคาเดิม
      </p>
      <MenuPrices menus={shop.menus} />
    </main>
  );
}
