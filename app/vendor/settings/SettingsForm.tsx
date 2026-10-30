'use client';

import { useId, useState } from 'react';
import { btnPrimary, card, cx, input, label } from '@/components/ui';

// Exactly the vendor-editable whitelist from PLAN.md §4b.
export interface ShopSettings {
  name: string;
  category: string;
  queuePrefix: string;
  isOpen: boolean;
  waitMode: 'auto' | 'manual';
  manualSecondsPerItem: number;
  allowItemNote: boolean;
  allowAllergyNote: boolean;
}

function Check({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex min-h-12 cursor-pointer items-center gap-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-6 w-6 accent-primary"
      />
      <span>{children}</span>
    </label>
  );
}

export function SettingsForm({ initial }: { initial: ShopSettings }) {
  const [s, setS] = useState(initial);
  const [saved, setSaved] = useState(false);
  const ids = { name: useId(), category: useId(), prefix: useId(), minutes: useId() };
  const update = (patch: Partial<ShopSettings>) => {
    setSaved(false);
    setS((x) => ({ ...x, ...patch }));
  };
  const prefixOk = [...s.queuePrefix.trim()].length >= 1 && [...s.queuePrefix.trim()].length <= 8;

  return (
    <form
      className="mt-5 space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (prefixOk) setSaved(true);
      }}
    >
      <section className={cx(card, 'space-y-4 px-4 py-4')}>
        <div>
          <label htmlFor={ids.name} className={label}>
            ชื่อร้าน
          </label>
          <input
            id={ids.name}
            className={input}
            value={s.name}
            onChange={(e) => update({ name: e.target.value })}
          />
        </div>
        <div>
          <label htmlFor={ids.category} className={label}>
            ประเภทร้าน
          </label>
          <input
            id={ids.category}
            className={input}
            value={s.category}
            onChange={(e) => update({ category: e.target.value })}
          />
        </div>
        <div>
          <label htmlFor={ids.prefix} className={label}>
            คำนำหน้าเลขคิว (ไม่เกิน 8 ตัวอักษร)
          </label>
          <input
            id={ids.prefix}
            className={input}
            value={s.queuePrefix}
            onChange={(e) => update({ queuePrefix: e.target.value })}
            aria-invalid={!prefixOk}
          />
          <p className={cx('mt-1 text-sm', prefixOk ? 'text-muted' : 'text-danger')}>
            {prefixOk ? `ตัวอย่างเลขคิว: ${s.queuePrefix.trim()}-27` : 'ต้องมี 1–8 ตัวอักษร'}
          </p>
        </div>
      </section>

      <section className={cx(card, 'px-4 py-4')}>
        <p className="font-semibold">สถานะร้าน</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {[
            { v: true, t: 'เปิดรับออเดอร์' },
            { v: false, t: 'ปิดรับชั่วคราว' },
          ].map((o) => (
            <button
              key={o.t}
              type="button"
              aria-pressed={s.isOpen === o.v}
              onClick={() => update({ isOpen: o.v })}
              className={cx(
                'min-h-12 rounded-xl border font-semibold',
                s.isOpen === o.v
                  ? o.v
                    ? 'border-success bg-success-soft text-success'
                    : 'border-danger bg-danger-soft text-danger'
                  : 'border-border',
              )}
            >
              {o.t}
            </button>
          ))}
        </div>
      </section>

      <section className={cx(card, 'px-4 py-4')}>
        <p className="font-semibold">เวลาทำต่อจาน</p>
        <div className="mt-2 space-y-1">
          <label className="flex min-h-12 cursor-pointer items-center gap-3">
            <input
              type="radio"
              name="wait-mode"
              checked={s.waitMode === 'auto'}
              onChange={() => update({ waitMode: 'auto' })}
              className="h-6 w-6 accent-primary"
            />
            ให้ระบบคำนวณจากเวลาที่กด &quot;เสร็จแล้ว&quot;
          </label>
          <label className="flex min-h-12 cursor-pointer flex-wrap items-center gap-3">
            <input
              type="radio"
              name="wait-mode"
              checked={s.waitMode === 'manual'}
              onChange={() => update({ waitMode: 'manual' })}
              className="h-6 w-6 accent-primary"
            />
            <span>ตั้งเอง: ใช้เวลาประมาณ</span>
            <input
              id={ids.minutes}
              aria-label="นาทีต่อจาน"
              inputMode="decimal"
              className={cx(input, 'w-20 text-center')}
              value={String(s.manualSecondsPerItem / 60)}
              onChange={(e) => {
                const min = Number(e.target.value);
                if (Number.isFinite(min) && min > 0)
                  update({ manualSecondsPerItem: Math.round(min * 60) });
              }}
            />
            <span>นาทีต่อจาน</span>
          </label>
          <p className="text-xs text-muted">ถ้าระบบยังมีข้อมูลไม่พอ จะใช้ค่าที่ตั้งเองแทน</p>
        </div>
      </section>

      <section className={cx(card, 'px-4 py-3')}>
        <Check checked={s.allowItemNote} onChange={(v) => update({ allowItemNote: v })}>
          ให้ลูกค้าเขียนหมายเหตุต่อจาน
        </Check>
        <Check checked={s.allowAllergyNote} onChange={(v) => update({ allowAllergyNote: v })}>
          ให้ลูกค้าแจ้งแพ้อาหาร
        </Check>
      </section>

      <div className="flex items-center justify-end gap-3">
        <p className="text-sm text-muted" role="status">
          {saved ? 'ต้นแบบ: ยังไม่บันทึกจริงจนกว่าจะเชื่อมฐานข้อมูล' : ''}
        </p>
        <button type="submit" disabled={!prefixOk} className={cx(btnPrimary, 'min-h-12')}>
          บันทึก
        </button>
      </div>
    </form>
  );
}
