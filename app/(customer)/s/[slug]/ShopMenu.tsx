'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';
import { BackLink } from '@/components/BackLink';
import { CustomizeSheet } from '@/components/CustomizeSheet';
import { CartIcon } from '@/components/icons';
import { MenuCard } from '@/components/MenuCard';
import { OfflineBanner } from '@/components/OfflineBanner';
import { btnPrimary, cx } from '@/components/ui';
import { useCart } from '@/lib/cart-store';
import { formatBaht, waitMinutes } from '@/lib/format';
import {
  ingredientMap,
  lineTotal,
  menuAvailability,
  startingPrice,
  validate,
  type CartLine,
} from '@/lib/menu';
import type { LoadedShop } from '@/lib/menu/db';
import { useLiveShop } from '@/lib/use-live-shop';

const BUSY_SOFT = {
  ว่าง: 'bg-success-soft text-success',
  ปานกลาง: 'bg-warning-soft text-warning',
  แน่น: 'bg-danger-soft text-danger',
} as const;

export function ShopMenu({ initial }: { initial: LoadedShop }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { data, offline } = useLiveShop(initial);
  const { shop, stats } = data;
  const { cart, add } = useCart(shop.slug);
  const ingredients = useMemo(() => ingredientMap(shop.ingredients), [shop.ingredients]);

  const openId = params.get('menu');
  const openMenu = shop.menus.find((m) => m.id === openId && !m.isDeleted);

  const categories = useMemo(() => {
    const order: string[] = [];
    for (const m of shop.menus)
      if (!m.isDeleted && !order.includes(m.category)) order.push(m.category);
    return order.map((c) => ({
      name: c,
      menus: shop.menus.filter((m) => m.category === c && !m.isDeleted),
    }));
  }, [shop.menus]);

  const close = useCallback(() => router.replace(pathname, { scroll: false }), [router, pathname]);

  const { count, total } = useMemo(() => {
    let count = 0;
    let total = 0;
    for (const line of cart.lines) {
      const menu = shop.menus.find((m) => m.id === line.menuId);
      if (!menu) continue;
      const v = validate(menu, line.selections, ingredients);
      count += line.qty;
      total += (v.ok && lineTotal(menu, v.selections, line.qty)) || 0;
    }
    return { count, total };
  }, [cart.lines, shop.menus, ingredients]);

  function onAdd(line: CartLine) {
    add(line);
    close();
  }

  return (
    <>
      <header className="border-b border-border bg-surface px-4 pt-3 pb-4">
        <BackLink href="/">กลับหน้าแรก</BackLink>
        <h1 className="mt-1 text-2xl font-bold">{shop.name}</h1>
        <p className="text-sm text-muted">{shop.category}</p>
        <div className="mt-3 flex flex-wrap gap-2 text-sm font-semibold">
          <span className={`rounded-full px-3 py-1 ${BUSY_SOFT[stats.busyLevel]}`}>
            {stats.busyLevel} · {stats.itemsInQueue} จานในคิว
          </span>
          <span className="rounded-full bg-bg px-3 py-1 text-ink">
            ถ้าสั่งตอนนี้ รอประมาณ {waitMinutes(stats.estWaitSeconds + stats.secondsPerItem)} นาที
          </span>
        </div>
      </header>
      {offline && <OfflineBanner />}

      {!shop.isOpen && (
        <p className="mx-4 mt-4 rounded-xl bg-danger-soft px-4 py-3 font-semibold text-danger">
          ร้านปิดรับออเดอร์ชั่วคราว
        </p>
      )}
      {categories.map((c) => (
        <section key={c.name} className="px-4 pt-5" aria-labelledby={`cat-${c.name}`}>
          <h2 id={`cat-${c.name}`} className="mb-2.5 font-bold">
            {c.name}
          </h2>
          <ul className="space-y-2.5">
            {c.menus.map((m) => (
              <li key={m.id}>
                <MenuCard
                  name={m.name}
                  cookSeconds={m.cookSeconds}
                  startingPriceSatang={startingPrice(m, ingredients)}
                  available={shop.isOpen && menuAvailability(m, ingredients).available}
                  pairOnly={m.pairOnly}
                  inCart={cart.lines
                    .filter((l) => l.menuId === m.id)
                    .reduce((n, l) => n + l.qty, 0)}
                  onOpen={() =>
                    router.replace(`${pathname}?menu=${encodeURIComponent(m.id)}`, {
                      scroll: false,
                    })
                  }
                />
              </li>
            ))}
          </ul>
        </section>
      ))}

      {count > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]">
          <div className="mx-auto flex max-w-[430px] items-center gap-3 px-4 py-3">
            <p className="min-w-0 flex-1 text-sm text-muted">
              {count} จาน
              <span className="block text-lg font-bold text-ink">{formatBaht(total)}</span>
            </p>
            <Link href={`/s/${shop.slug}/cart`} className={cx(btnPrimary, 'min-h-12 px-6')}>
              <CartIcon size={20} />
              ดูตะกร้า
            </Link>
          </div>
        </div>
      )}

      {openMenu && (
        <CustomizeSheet
          key={openMenu.id}
          menu={openMenu}
          ingredients={ingredients}
          allowItemNote={shop.allowItemNote}
          onClose={close}
          onAdd={onAdd}
        />
      )}
    </>
  );
}
