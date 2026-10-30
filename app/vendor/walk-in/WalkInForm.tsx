'use client';

import Link from 'next/link';
import { useId, useMemo, useState } from 'react';
import { OptionGroup } from '@/components/OptionGroup';
import { Stepper } from '@/components/Stepper';
import { btnPrimary, btnSecondary, cx, input } from '@/components/ui';
import { formatBaht } from '@/lib/format';
import { actAddWalkInOrder } from '@/lib/vendor/actions';
import {
  defaultSelections,
  ingredientMap,
  kitchenSummary,
  MAX_QTY,
  menuAvailability,
  unitPrice,
  validate,
  visibleGroups,
  type Selections,
  type Shop,
} from '@/lib/menu';

/** Full walk-in form (screen 12): same menu rules as the app, cash at the counter. */
export function WalkInForm({ shop }: { shop: Shop }) {
  const ingredients = useMemo(() => ingredientMap(shop.ingredients), [shop.ingredients]);
  const menus = shop.menus.filter(
    (m) => !m.isDeleted && menuAvailability(m, ingredients).available,
  );
  const [menuId, setMenuId] = useState<string | null>(null);
  const [selections, setSelections] = useState<Selections>({});
  const [qty, setQty] = useState(1);
  const [name, setName] = useState('');
  const [done, setDone] = useState<{ label: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameId = useId();

  const menu = menus.find((m) => m.id === menuId) ?? null;
  const result = menu ? validate(menu, selections, ingredients) : null;
  const unit = menu && result?.ok ? unitPrice(menu, result.selections) : null;

  function choose(id: string) {
    const m = menus.find((x) => x.id === id);
    if (!m) return;
    setMenuId(id);
    setSelections(defaultSelections(m, ingredients));
    setQty(1);
  }

  async function submit() {
    if (!menu || !result?.ok) return;
    setSaving(true);
    setError(null);
    // The server reloads the menu and prices the order itself, like the customer app.
    const res = await actAddWalkInOrder(
      shop.id,
      [{ menuId: menu.id, selections: result.selections, qty, note: '' }],
      name,
    ).catch(() => null);
    setSaving(false);
    if (res?.ok) setDone({ label: res.label });
    else setError('เพิ่มเข้าคิวไม่สำเร็จ (ของอาจหมดหรือเมนูเปลี่ยน) ลองใหม่อีกครั้ง');
  }

  if (done && menu && result?.ok) {
    return (
      <section className="w-full max-w-2xl rounded-3xl bg-surface p-6 text-center">
        <h1 className="text-xl font-bold">เพิ่มเข้าคิวแล้ว</h1>
        <p className="my-3 text-6xl leading-[1.35] font-bold text-primary">{done.label}</p>
        <p className="mt-2 text-muted">
          {kitchenSummary(menu, result.selections)} × {qty}
        </p>
        <p className="mt-1 text-sm text-muted">
          บอกลูกค้าให้รอฟังเรียกเลขนี้ · เก็บเงินสด {unit === null ? '' : formatBaht(unit * qty)}
        </p>
        <Link href="/vendor" className={cx(btnPrimary, 'mt-5 min-h-12 w-full')}>
          กลับกระดานออเดอร์
        </Link>
      </section>
    );
  }

  return (
    <section className="w-full max-w-2xl rounded-3xl bg-surface p-6">
      <h1 className="text-2xl font-bold">เพิ่มคิวลูกค้าหน้าร้าน</h1>
      <p className="mt-1 text-sm text-muted">
        สำหรับลูกค้าที่ไม่ได้สั่งผ่านมือถือ ให้อยู่ในลำดับคิวเดียวกัน · ลูกค้าจ่ายเงินสดที่ร้าน
      </p>

      <p className="mt-5 mb-2 font-semibold">เมนู</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {menus.map((m) => (
          <button
            key={m.id}
            type="button"
            aria-pressed={m.id === menuId}
            onClick={() => choose(m.id)}
            className={cx(
              'min-h-14 rounded-xl border px-3 text-left font-semibold',
              m.id === menuId
                ? 'border-primary bg-primary-soft text-primary-hover'
                : 'border-border hover:border-primary/40',
            )}
          >
            {m.name}
          </button>
        ))}
      </div>

      {menu && (
        <div className="mt-4 space-y-4">
          {visibleGroups(menu, selections).map((g) => (
            <OptionGroup
              key={g.id}
              group={g}
              size="lg"
              selected={selections[g.id] ?? []}
              onChange={(ids) => setSelections((s) => ({ ...s, [g.id]: ids }))}
              ingredients={ingredients}
              missing={
                !result?.ok &&
                result?.errors.some((e) => e.code === 'too_few' && e.groupId === g.id)
              }
            />
          ))}
        </div>
      )}

      <div className="mt-5 grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
        <div>
          <label htmlFor={nameId} className="mb-1.5 block font-semibold">
            ชื่อลูกค้า (ไม่บังคับ)
          </label>
          <input
            id={nameId}
            className={input}
            value={name}
            maxLength={30}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="flex items-end justify-between gap-3">
          <span className="font-semibold">จำนวน</span>
          <Stepper value={qty} onChange={setQty} max={MAX_QTY} size="lg" label="จำนวนจาน" />
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between rounded-xl bg-warning-soft px-4 py-3">
        <p className="text-sm text-warning">
          ยอดเงินสดที่ต้องเก็บ
          <span className="block text-xs">เลขคิวออกให้หลังกดเพิ่มเข้าคิว</span>
        </p>
        <p className="text-3xl font-bold text-warning">
          {unit === null ? '–' : formatBaht(unit * qty)}
        </p>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-xl bg-danger-soft px-4 py-3 text-sm font-semibold text-danger"
        >
          {error}
        </p>
      )}
      <div className="mt-5 grid grid-cols-2 gap-3">
        <Link href="/vendor" className={cx(btnSecondary, 'min-h-12')}>
          ยกเลิก
        </Link>
        <button
          type="button"
          disabled={!result?.ok || unit === null || saving}
          onClick={submit}
          className={cx(btnPrimary, 'min-h-12')}
        >
          เพิ่มเข้าคิว
        </button>
      </div>
    </section>
  );
}
