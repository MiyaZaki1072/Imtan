'use client';

import Link from 'next/link';
import { useId, useMemo } from 'react';
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
  type Shop,
} from '@/lib/menu';
import { SAMPLE_ORDER_ID } from '@/lib/sample';

export function CartView({ shop }: { shop: Shop }) {
  const { cart, setQty, setAllergyNote } = useCart(shop.slug);
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
          {blocked ? (
            <button type="button" disabled className={cx(btnPrimary, btnLarge)}>
              ไปชำระเงิน
            </button>
          ) : (
            // Phase 4: placeOrder() recomputes everything on the server, then opens the pay page.
            <Link href={`/orders/${SAMPLE_ORDER_ID}/pay`} className={cx(btnPrimary, btnLarge)}>
              ไปชำระเงิน
            </Link>
          )}
        </div>
      </div>
    </>
  );
}
