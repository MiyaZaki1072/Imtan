'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useMemo, useState } from 'react';
import { CartLine } from '@/components/CartLine';
import { AlertIcon } from '@/components/icons';
import { btnLarge, btnPrimary, btnSecondary, cx, input } from '@/components/ui';
import { useCart } from '@/lib/cart-store';
import { formatBaht } from '@/lib/format';
import {
  cartIssues,
  ingredientMap,
  kitchenSummary,
  lineTotal,
  MAX_NOTE_LENGTH,
  MIN_ORDER_SATANG,
  validate,
} from '@/lib/menu';
import type { LoadedShop } from '@/lib/menu/db';
import { placeOrder, type PlaceOrderError } from '@/lib/orders/actions';
import { track } from '@/lib/track';
import { useLiveShop } from '@/lib/use-live-shop';

const ORDER_ERRORS: Record<PlaceOrderError, string> = {
  empty: 'ตะกร้ายังว่าง',
  bad_input: 'ข้อมูลตะกร้าไม่ถูกต้อง ลองลบแล้วเพิ่มรายการใหม่',
  shop_closed: 'ร้านปิดรับออเดอร์ชั่วคราว',
  unknown_menu: 'มีเมนูที่ร้านเอาออกแล้ว ลบรายการนั้นก่อน',
  invalid_selections: 'มีรายการที่สั่งไม่ได้แล้ว (ของหมดหรือเมนูเปลี่ยน) ลบรายการนั้นก่อน',
  pair_only_alone: 'เมนูนี้ต้องสั่งคู่กับเมนูอื่น',
  under_minimum: 'ยอดต่ำกว่าขั้นต่ำ',
  signed_out: 'หมดเวลาเข้าใช้งาน กรุณาใส่ชื่ออีกครั้ง',
  shop_not_found: 'ไม่พบร้านนี้',
  failed: 'สั่งไม่สำเร็จ ลองใหม่อีกครั้ง',
};

export function CartView({ initial }: { initial: LoadedShop }) {
  const router = useRouter();
  const { shop } = useLiveShop(initial).data;
  const [placing, setPlacing] = useState(false);
  const cartSlug = initial.shop.slug;
  useEffect(() => track('cart_opened', { shop: cartSlug }), [cartSlug]);
  const [orderError, setOrderError] = useState<string | null>(null);
  const { cart, setQty, setAllergyNote } = useCart(shop.slug);

  // The server reloads the menu and prices everything itself; only ids, choices, qty and notes are sent.
  async function submit() {
    setPlacing(true);
    setOrderError(null);
    const result = await placeOrder({
      shopSlug: shop.slug,
      lines: cart.lines.map((l) => ({
        menuId: l.menuId,
        selections: l.selections,
        qty: l.qty,
        note: l.note,
      })),
      allergyNote: cart.allergyNote,
    });
    if (result.ok) {
      router.push(`/orders/${result.orderId}/pay`);
      return;
    }
    if (result.error === 'signed_out') {
      router.push(`/welcome?next=${encodeURIComponent(`/s/${shop.slug}/cart`)}`);
      return;
    }
    setPlacing(false);
    setOrderError(ORDER_ERRORS[result.error]);
  }
  const allergyId = useId();
  const ingredients = useMemo(() => ingredientMap(shop.ingredients), [shop.ingredients]);

  const lines = useMemo(
    () =>
      cart.lines.flatMap((line) => {
        const menu = shop.menus.find((m) => m.id === line.menuId);
        if (!menu) return [];
        const v = validate(menu, line.selections, ingredients);
        return [
          {
            line,
            menu,
            summary: kitchenSummary(menu, v.selections),
            total: v.ok ? lineTotal(menu, v.selections, line.qty) : null,
            problem: v.ok ? null : 'สั่งไม่ได้แล้ว (ของหมดหรือเมนูเปลี่ยน) — ลบรายการนี้',
          },
        ];
      }),
    [cart.lines, shop.menus, ingredients],
  );

  const total = lines.reduce((sum, l) => sum + (l.total ?? 0), 0);
  const issues = cartIssues(lines, total);
  const pairOnlyNames = [...new Set(lines.filter((l) => l.menu.pairOnly).map((l) => l.menu.name))];
  const blocked =
    lines.length === 0 ||
    lines.some((l) => l.problem) ||
    issues.pairOnlyAlone ||
    issues.underMinimum ||
    !shop.isOpen;

  if (lines.length === 0) {
    return (
      <div className="mt-10 text-center">
        <p className="text-lg font-semibold">ตะกร้ายังว่าง</p>
        <p className="mt-1 text-sm text-muted">เลือกเมนูจากหน้าร้านก่อน</p>
        <Link href={`/s/${shop.slug}`} className={cx(btnSecondary, 'mt-5')}>
          ไปเลือกเมนู
        </Link>
      </div>
    );
  }

  return (
    <>
      <ul className="mt-4 space-y-2.5">
        {lines.map((l) => (
          <CartLine
            key={l.line.key}
            summary={l.summary}
            note={l.line.note}
            qty={l.line.qty}
            lineTotalSatang={l.total}
            problem={l.problem}
            onQty={(q) => setQty(l.line.key, q)}
            onRemove={() => setQty(l.line.key, 0)}
          />
        ))}
      </ul>
      <Link
        href={`/s/${shop.slug}`}
        className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-primary"
      >
        + เพิ่มเมนูอื่น
      </Link>

      {shop.allowAllergyNote && (
        <div className="mt-4">
          <label htmlFor={allergyId} className="mb-1.5 block font-semibold">
            แพ้อาหาร (ถ้ามี)
          </label>
          <input
            id={allergyId}
            className={input}
            value={cart.allergyNote}
            maxLength={MAX_NOTE_LENGTH}
            onChange={(e) => setAllergyNote(e.target.value)}
            placeholder="เช่น แพ้กุ้ง แพ้ถั่ว"
          />
          <p className="mt-1.5 flex items-start gap-1.5 text-xs text-warning">
            <AlertIcon size={16} className="mt-px shrink-0" />
            ร้านไม่สามารถรับประกันว่าไม่มีการปนเปื้อน
          </p>
        </div>
      )}

      <div className="mt-4 space-y-2" aria-live="polite">
        {issues.pairOnlyAlone && (
          <p className="rounded-xl bg-warning-soft px-4 py-3 text-sm font-semibold text-warning">
            {pairOnlyNames.join(', ')} ต้องสั่งคู่กับเมนูอื่น
          </p>
        )}
        {issues.underMinimum && !issues.pairOnlyAlone && (
          <p className="rounded-xl bg-warning-soft px-4 py-3 text-sm font-semibold text-warning">
            ยอดขั้นต่ำ {formatBaht(MIN_ORDER_SATANG)} ต่อออเดอร์
          </p>
        )}
        {!shop.isOpen && (
          <p className="rounded-xl bg-danger-soft px-4 py-3 text-sm font-semibold text-danger">
            ร้านปิดรับออเดอร์ชั่วคราว
          </p>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto max-w-[430px] px-4 py-3">
          <p className="mb-2 flex items-baseline justify-between text-sm text-muted">
            {lines.reduce((n, l) => n + l.line.qty, 0)} จาน · ชำระเงินก่อน แล้วได้เลขคิวทันที
            <span className="text-xl font-bold text-ink">{formatBaht(total)}</span>
          </p>
          {orderError && (
            <p
              role="alert"
              className="mb-2 rounded-xl bg-danger-soft px-4 py-2.5 text-sm font-semibold text-danger"
            >
              {orderError}
            </p>
          )}
          <button
            type="button"
            disabled={blocked || placing}
            onClick={submit}
            className={cx(btnPrimary, btnLarge)}
          >
            {placing ? 'กำลังสั่ง…' : 'ไปชำระเงิน'}
          </button>
        </div>
      </div>
    </>
  );
}
