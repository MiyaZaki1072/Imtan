'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { formatBaht, waitMinutes } from '@/lib/format';
import {
  defaultSelections,
  kitchenSummary,
  MAX_NOTE_LENGTH,
  MAX_QTY,
  unitPrice,
  validate,
  visibleGroups,
  type CartLine,
  type IngredientMap,
  type Menu,
  type Selections,
} from '@/lib/menu';
import { XIcon } from './icons';
import { OptionGroup } from './OptionGroup';
import { Stepper } from './Stepper';
import { btnLarge, btnPrimary, cx, input } from './ui';

/** Bottom sheet to customise one menu. Price and validation run through lib/menu. */
export function CustomizeSheet({
  menu,
  ingredients,
  allowItemNote,
  onClose,
  onAdd,
}: {
  menu: Menu;
  ingredients: IngredientMap;
  allowItemNote: boolean;
  onClose: () => void;
  onAdd: (line: CartLine) => void;
}) {
  const [selections, setSelections] = useState<Selections>(() =>
    defaultSelections(menu, ingredients),
  );
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState('');
  const titleId = useId();
  const noteId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  const groups = visibleGroups(menu, selections);
  const result = useMemo(
    () => validate(menu, selections, ingredients),
    [menu, selections, ingredients],
  );
  const unit = result.ok ? unitPrice(menu, result.selections) : null;
  const missing = new Set(
    result.ok ? [] : result.errors.filter((e) => e.code === 'too_few').map((e) => e.groupId),
  );

  function add() {
    if (!result.ok) return;
    onAdd({ menuId: menu.id, selections: result.selections, qty, note: note.trim() });
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center">
      <button
        type="button"
        aria-label="ปิด"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 bg-ink/50"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex max-h-[92dvh] w-full max-w-[430px] flex-col rounded-t-3xl bg-surface"
      >
        <div className="flex items-start gap-3 px-5 pt-5 pb-3">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-xl font-bold">
              {menu.name}
            </h2>
            <p className="text-sm text-muted">ใช้เวลาทำ ~{waitMinutes(menu.cookSeconds)} นาที</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            aria-label="ปิด"
            onClick={onClose}
            className="-mr-2 inline-flex h-11 w-11 items-center justify-center rounded-full text-muted hover:bg-bg"
          >
            <XIcon />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 pb-4">
          {menu.pairOnly && (
            <p className="rounded-xl bg-warning-soft px-3 py-2 text-sm text-warning">
              เมนูนี้ต้องสั่งคู่กับเมนูอื่นในร้านเดียวกัน
            </p>
          )}
          {groups.map((g) => (
            <OptionGroup
              key={g.id}
              group={g}
              selected={selections[g.id] ?? []}
              onChange={(ids) => setSelections((s) => ({ ...s, [g.id]: ids }))}
              ingredients={ingredients}
              missing={missing.has(g.id)}
            />
          ))}

          {allowItemNote && (
            <div className="border-t border-border pt-4">
              <label htmlFor={noteId} className="font-semibold">
                หมายเหตุถึงร้าน
              </label>
              <p className="mb-2 text-xs text-muted">ร้านอาจทำตามไม่ได้ทุกกรณี</p>
              <input
                id={noteId}
                className={input}
                value={note}
                maxLength={MAX_NOTE_LENGTH}
                onChange={(e) => setNote(e.target.value)}
                placeholder="เช่น แยกน้ำจิ้ม"
              />
              <p className="mt-1 text-right text-xs text-muted">
                {note.length}/{MAX_NOTE_LENGTH}
              </p>
            </div>
          )}

          {result.ok && (
            <p className="rounded-xl bg-bg px-3 py-2 text-sm text-muted">
              ร้านจะเห็น:{' '}
              <span className="text-ink">{kitchenSummary(menu, result.selections)}</span>
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 border-t border-border px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Stepper value={qty} onChange={setQty} max={MAX_QTY} label="จำนวนจาน" />
          <button
            type="button"
            onClick={add}
            disabled={!result.ok || unit === null}
            className={cx(btnPrimary, btnLarge, 'flex-1')}
          >
            {result.ok && unit !== null
              ? `เพิ่มลงตะกร้า · ${formatBaht(unit * qty)}`
              : 'เลือกให้ครบก่อน'}
          </button>
        </div>
      </div>
    </div>
  );
}
