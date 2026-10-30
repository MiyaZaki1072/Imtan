'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { BackLink } from '@/components/BackLink';
import { btnLarge, btnPrimary, card, cx } from '@/components/ui';
import { useCart } from '@/lib/cart-store';
import { formatBaht, formatClock } from '@/lib/format';
import { ingredientMap, kitchenSummary, lineTotal, validate } from '@/lib/menu';
import type { LoadedShop } from '@/lib/menu/db';
import { placeOrder } from '@/lib/orders/actions';
import { pickupSlots, releaseAt } from '@/lib/orders/preorder';
import { ORDER_ERRORS } from '../cart/CartView';

export function PreorderView({ initial, serverNow }: { initial: LoadedShop; serverNow: string }) {
  const router = useRouter();
  const { shop, stats } = initial;
  const { cart } = useCart(shop.slug);
  const ingredients = useMemo(() => ingredientMap(shop.ingredients), [shop.ingredients]);
  const [chosen, setChosen] = useState<number | null>(null);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lines = useMemo(
    () =>
      cart.lines.flatMap((line) => {
        const menu = shop.menus.find((m) => m.id === line.menuId);
        if (!menu) return [];
        const v = validate(menu, line.selections, ingredients);
        return v.ok
          ? [
              {
                line,
                summary: kitchenSummary(menu, v.selections),
                total: lineTotal(menu, v.selections, line.qty) ?? 0,
              },
            ]
          : [];
      }),
    [cart.lines, shop.menus, ingredients],
  );
  const dishes = lines.reduce((n, l) => n + l.line.qty, 0);
  const total = lines.reduce((n, l) => n + l.total, 0);
  const slots = useMemo(
    () => (dishes > 0 ? pickupSlots(new Date(serverNow), dishes, stats.secondsPerItem) : []),
    [dishes, serverNow, stats.secondsPerItem],
  );
  const slot = slots[chosen ?? 0];
  const start = slot ? releaseAt(slot, dishes, stats.secondsPerItem) : null;

  async function confirm() {
    if (!slot) return;
    setPlacing(true);
    setError(null);
    const result = await placeOrder({
      shopSlug: shop.slug,
      lines: cart.lines.map((l) => ({
        menuId: l.menuId,
        selections: l.selections,
        qty: l.qty,
        note: l.note,
      })),
      allergyNote: cart.allergyNote,
      pickupAt: slot.toISOString(),
    });
    if (result.ok) {
      router.push(`/orders/${result.orderId}/pay`);
      return;
    }
    if (result.error === 'signed_out') {
      router.push(`/welcome?next=${encodeURIComponent(`/s/${shop.slug}/preorder`)}`);
      return;
    }
    setPlacing(false);
    setError(ORDER_ERRORS[result.error]);
  }

  if (lines.length === 0) {
    return (
      <div className="mt-10 text-center">
        <p className="text-lg font-semibold">ตะกร้ายังว่าง</p>
        <Link href={`/s/${shop.slug}`} className={cx(btnPrimary, 'mt-5 min-h-12')}>
          ไปเลือกเมนู
        </Link>
      </div>
    );
  }

  return (
    <>
      <BackLink href={`/s/${shop.slug}/cart`}>กลับหน้าร้าน</BackLink>
      <h1 className="mt-1 text-2xl font-bold">สั่งล่วงหน้า</h1>
      <p className="text-sm text-muted">{shop.name} · สั่งไว้ก่อนเลิกเรียน มาถึงแล้วรับได้เลย</p>

      <section className={cx(card, 'mt-4 px-4 py-3')} aria-label="รายการที่สั่ง">
        <div className="flex items-baseline justify-between">
          <p className="text-xs text-muted">รายการที่สั่ง</p>
          <Link
            href={`/s/${shop.slug}/cart`}
            className="text-sm font-semibold text-primary underline"
          >
            แก้ไข
          </Link>
        </div>
        <ul className="mt-1 space-y-0.5 text-sm">
          {lines.map((l) => (
            <li key={l.line.key}>
              {l.summary} × {l.line.qty}
            </li>
          ))}
        </ul>
      </section>

      <h2 className="mt-5 mb-2 font-bold">เลือกเวลาที่จะมารับ</h2>
      {slots.length === 0 ? (
        <p className="rounded-xl bg-warning-soft px-4 py-3 text-sm font-semibold text-warning">
          ไม่มีเวลาให้เลือกแล้ว ลองสั่งแบบรับเลย
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="เวลารับ">
          {slots.map((t, i) => (
            <button
              key={t.toISOString()}
              type="button"
              role="radio"
              aria-checked={(chosen ?? 0) === i}
              onClick={() => setChosen(i)}
              className={cx(
                'min-h-12 rounded-xl border-2 text-base font-semibold',
                (chosen ?? 0) === i
                  ? 'border-primary bg-primary-soft text-primary-hover'
                  : 'border-border bg-surface',
              )}
            >
              {formatClock(t)}
            </button>
          ))}
        </div>
      )}

      {slot && start && (
        <section
          className="mt-4 rounded-xl bg-info-soft px-4 py-3 text-info-ink"
          aria-label="เวลาที่ร้านเริ่มทำ"
        >
          <p className="font-bold">ระบบจะส่งออเดอร์ให้ร้านเริ่มทำประมาณ {formatClock(start)} น.</p>
          <p className="mt-1 text-sm">
            คำนวณจากเวลาทำของเมนูนี้ เพื่อให้อาหารเสร็จพอดีเวลารับ {formatClock(slot)} น.
            ไม่เย็นและไม่ต้องรอ
          </p>
        </section>
      )}
      <p className="mt-3 text-sm text-muted">
        ชำระเงินก่อนแล้วได้เลขคิวทันที · ร้านจะเริ่มทำเมื่อถึงเวลา · ถ้ามาช้ากว่าเวลา
        อาหารจะรออยู่ที่ร้าน
      </p>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto max-w-[430px] px-4 py-3">
          <p className="mb-2 flex items-baseline justify-between text-sm text-muted">
            {slot ? `รับเวลา ${formatClock(slot)} น.` : 'ยังไม่ได้เลือกเวลา'} · {dishes} จาน
            <span className="text-xl font-bold text-ink">{formatBaht(total)}</span>
          </p>
          {error && (
            <p
              role="alert"
              className="mb-2 rounded-xl bg-danger-soft px-4 py-2.5 text-sm font-semibold text-danger"
            >
              {error}
            </p>
          )}
          <button
            type="button"
            disabled={!slot || placing}
            onClick={confirm}
            className={cx(btnPrimary, btnLarge)}
          >
            {placing ? 'กำลังสั่ง…' : 'ยืนยันสั่งล่วงหน้า และไปชำระเงิน'}
          </button>
        </div>
      </div>
    </>
  );
}
