import { notFound } from 'next/navigation';
import { getShop } from '@/lib/demo-data/load';
import { vendorPageShopSlug } from '@/lib/auth';
import { StockToggles } from './StockToggles';

export default async function StockPage() {
  const shop = getShop(await vendorPageShopSlug());
  if (!shop) notFound();
  const usage = Object.fromEntries(
    shop.ingredients.map((i) => [
      i.id,
      shop.menus.filter(
        (m) =>
          m.ingredientIds.includes(i.id) ||
          m.groups.some((g) => g.options.some((o) => o.ingredientId === i.id)),
      ).length,
    ]),
  );
  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 pt-5 pb-10">
      <h1 className="text-2xl font-bold">ของหมด</h1>
      <p className="mt-1 text-muted">
        กดเพื่อสลับ มี / หมด · ลูกค้าจะเลือกไม่ได้ทันทีในทุกเมนูที่ใช้วัตถุดิบนั้น
      </p>
      <StockToggles ingredients={shop.ingredients} usage={usage} />
    </main>
  );
}
