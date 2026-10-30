'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { btnPrimary, btnSecondary, card, cx } from '@/components/ui';
import type { Ingredient } from '@/lib/menu';
import { actAddIngredient, actDeleteIngredient, actRenameIngredient } from '@/lib/vendor/actions';

const ERRORS: Record<string, string> = {
  bad_input: 'ใส่ชื่อวัตถุดิบ (ไม่เกิน 40 ตัวอักษร)',
  duplicate: 'มีวัตถุดิบชื่อนี้แล้ว',
  failed: 'ทำรายการไม่สำเร็จ ลองใหม่อีกครั้ง',
  not_found: 'ไม่พบวัตถุดิบนี้',
};

/** Add, rename and delete the shop's ingredients (PLAN.md Phase 7). */
export function IngredientManager({
  shopId,
  ingredients,
  usage,
}: {
  shopId: string;
  ingredients: Ingredient[];
  usage: Record<string, number>;
}) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>, done: string) {
    const r = await fn().catch(() => ({ ok: false, error: 'failed' }));
    setMessage(r.ok ? { ok: true, text: done } : { ok: false, text: ERRORS[r.error ?? 'failed'] });
    if (r.ok) router.refresh();
    return r.ok;
  }

  return (
    <section className={cx(card, 'mt-8 px-4 py-4')} aria-label="จัดการวัตถุดิบ">
      <h2 className="text-lg font-bold">จัดการวัตถุดิบ</h2>
      <p className="text-sm text-muted">
        เพิ่ม เปลี่ยนชื่อ หรือลบวัตถุดิบ · ผูกกับเมนูและตัวเลือกได้ในหน้าแก้เมนู
      </p>

      <form
        className="mt-3 flex flex-wrap gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await run(() => actAddIngredient(shopId, name), `เพิ่ม “${name.trim()}” แล้ว`))
            setName('');
        }}
      >
        <input
          aria-label="ชื่อวัตถุดิบใหม่"
          placeholder="ชื่อวัตถุดิบใหม่"
          maxLength={40}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="min-h-12 min-w-0 flex-1 rounded-xl border border-border bg-surface px-3"
        />
        <button type="submit" disabled={!name.trim()} className={cx(btnPrimary, 'min-h-12')}>
          + เพิ่ม
        </button>
      </form>

      <ul className="mt-3 divide-y divide-border">
        {ingredients.map((i) => {
          const text = edits[i.id] ?? i.name;
          const changed = text.trim() !== i.name;
          return (
            <li key={i.id} className="flex flex-wrap items-center gap-2 py-2">
              <input
                aria-label={`ชื่อ ${i.name}`}
                value={text}
                maxLength={40}
                onChange={(e) => setEdits((x) => ({ ...x, [i.id]: e.target.value }))}
                className="min-h-12 min-w-0 flex-1 rounded-xl border border-border bg-surface px-3"
              />
              <span className="text-xs text-muted">ใช้ใน {usage[i.id] ?? 0} เมนู</span>
              <button
                type="button"
                disabled={!changed || !text.trim()}
                onClick={async () => {
                  if (await run(() => actRenameIngredient(shopId, i.id, text), 'เปลี่ยนชื่อแล้ว')) {
                    setEdits((x) => {
                      const next = { ...x };
                      delete next[i.id];
                      return next;
                    });
                  }
                }}
                className={cx(btnSecondary, 'min-h-12 disabled:opacity-40')}
              >
                บันทึกชื่อ
              </button>
              {confirm === i.id ? (
                <span className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      await run(() => actDeleteIngredient(shopId, i.id), `ลบ “${i.name}” แล้ว`);
                      setConfirm(null);
                    }}
                    className="min-h-12 rounded-xl bg-danger px-4 font-semibold text-white"
                  >
                    ลบเลย
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirm(null)}
                    className={cx(btnSecondary, 'min-h-12')}
                  >
                    ไม่ลบ
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirm(i.id)}
                  className="min-h-12 rounded-xl px-3 text-sm font-semibold text-danger hover:bg-danger-soft"
                >
                  ลบ
                </button>
              )}
              {confirm === i.id && (
                <p className="w-full text-xs text-danger">
                  ลบแล้วเมนูจะไม่ต้องใช้วัตถุดิบนี้อีก และตัวเลือกที่ผูกไว้จะไม่ผูกกับอะไร
                </p>
              )}
            </li>
          );
        })}
      </ul>

      <p
        role="status"
        className={cx(
          'mt-2 min-h-5 text-sm',
          message?.ok === false ? 'font-semibold text-danger' : 'text-muted',
        )}
      >
        {message?.text}
      </p>
    </section>
  );
}
