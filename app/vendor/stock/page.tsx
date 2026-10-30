import { notFound } from 'next/navigation';
import { vendorPageShop } from '@/lib/auth';
import { getShopFromDb } from '@/lib/shops';
import { StockToggles } from './StockToggles';

export default async function StockPage() {
  const { slug } = await vendorPageShop();
  const loaded = await getShopFromDb(slug);
  if (!loaded) notFound();
  const { shop } = loaded;
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
      <StockToggles shopId={shop.id} ingredients={shop.ingredients} usage={usage} />
    </main>
  );
}
