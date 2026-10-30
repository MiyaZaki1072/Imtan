import { notFound } from 'next/navigation';
import { vendorPageShop } from '@/lib/auth';
import { getShopFromDb } from '@/lib/shops';
import { MenuEditor } from './MenuEditor';

// Menu structure editor (PLAN.md Phase 7). /vendor/menu/new adds a menu.
export default async function MenuEditorPage({ params }: PageProps<'/vendor/menu/[menuId]'>) {
  const { menuId } = await params;
  const { slug } = await vendorPageShop();
  const loaded = await getShopFromDb(slug);
  if (!loaded) notFound();
  const { shop } = loaded;
  const existing =
    menuId === 'new' ? null : shop.menus.find((m) => m.id === menuId && !m.isDeleted);
  if (menuId !== 'new' && !existing) notFound();
  const categories = [...new Set(shop.menus.filter((m) => !m.isDeleted).map((m) => m.category))];
  return (
    <MenuEditor
      shopId={shop.id}
      initial={existing ?? null}
      ingredients={shop.ingredients}
      categories={categories}
    />
  );
}
