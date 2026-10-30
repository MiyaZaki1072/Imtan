'use client';

import { useId, useState } from 'react';
import { btnPrimary, btnSecondary, cx } from '@/components/ui';
import type { Menu } from '@/lib/menu';

// Prices are edited in whole baht here and stored as satang. Phase 5 saves via server actions.

const priceInput =
  'min-h-12 w-24 rounded-xl border border-border bg-surface px-3 text-right text-lg font-semibold tabular-nums focus:border-primary focus:outline-none';

function BahtField({
  label,
  satang,
  onChange,
}: {
  label: string;
  satang: number | null;
  onChange: (satang: number | null) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <label htmlFor={id} className="min-w-0 flex-1 text-sm">
        {label}
      </label>
      <span className="inline-flex items-center gap-1.5">
        <span className="text-muted">฿</span>
        <input
          id={id}
          inputMode="numeric"
          className={priceInput}
          value={satang === null ? '' : String(satang / 100)}
          onChange={(e) => {
            const v = e.target.value.replace(/[^0-9]/g, '');
            onChange(v === '' ? null : Number(v) * 100);
          }}
        />
      </span>
    </div>
  );
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: () => void; label: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={`${label}: ${on ? 'เปิดขาย' : 'ปิดขาย'}`}
      onClick={onChange}
      className={cx(
        'min-h-12 rounded-xl px-4 text-sm font-bold',
        on ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger',
      )}
    >
      {on ? 'เปิดขาย' : 'ปิดขาย'}
    </button>
  );
}

function MenuEditor({ initial }: { initial: Menu }) {
  const [menu, setMenu] = useState(initial);
  const [rowGroup, setRowGroup] = useState<string>('');
  const [rowOption, setRowOption] = useState<string>('');
  const [rowPrice, setRowPrice] = useState<string>('');
  const variantGroups = menu.groups.filter((g) => g.kind === 'variant');
  const optionName = (id: string) =>
    menu.groups.flatMap((g) => g.options).find((o) => o.id === id)?.name ?? id;
  // Show variant rows in the menu's group order, not id order.
  const rowLabel = (ids: string[]) =>
    variantGroups
      .map((g) => g.options.find((o) => ids.includes(o.id)))
      .filter(Boolean)
      .map((o) => o!.name)
      .join(' / ');

  function setWholeRow() {
    const price = Number(rowPrice);
    if (!rowOption || !Number.isInteger(price) || price <= 0) return;
    setMenu((m) => ({
      ...m,
      variants: m.variants.map((v) =>
        v.optionIds.includes(rowOption) ? { ...v, priceSatang: price * 100 } : v,
      ),
    }));
  }

  return (
    <li className="rounded-2xl border border-border bg-surface px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">{menu.name}</h2>
          <p className="text-xs text-muted">{menu.category}</p>
        </div>
        <Toggle
          on={menu.isAvailable}
          label={menu.name}
          onChange={() => setMenu((m) => ({ ...m, isAvailable: !m.isAvailable }))}
        />
      </div>

      {menu.basePriceSatang !== null && (
        <div className="mt-3 border-t border-border pt-2">
          <BahtField
            label="ราคา"
            satang={menu.basePriceSatang}
            onChange={(s) => setMenu((m) => ({ ...m, basePriceSatang: s }))}
          />
        </div>
      )}

      {menu.groups
        .filter((g) => g.kind === 'tiered')
        .map((g) => (
          <div key={g.id} className="mt-3 border-t border-border pt-2">
            <p className="text-sm font-semibold">{g.name} (ราคาตามจำนวนที่เลือก)</p>
            {g.tierPrices.map((t) => (
              <BahtField
                key={t.selectedCount}
                label={`${t.selectedCount} อย่าง`}
                satang={t.priceSatang}
                onChange={(s) =>
                  setMenu((m) => ({
                    ...m,
                    groups: m.groups.map((x) =>
                      x.id !== g.id
                        ? x
                        : {
                            ...x,
                            tierPrices: x.tierPrices.map((tp) =>
                              tp.selectedCount === t.selectedCount
                                ? { ...tp, priceSatang: s ?? 0 }
                                : tp,
                            ),
                          },
                    ),
                  }))
                }
              />
            ))}
          </div>
        ))}

      {menu.variants.length > 0 && (
        <div className="mt-3 border-t border-border pt-2">
          <p className="text-sm font-semibold">ราคาแต่ละแบบ ({menu.variants.length} แบบ)</p>
          {variantGroups.length > 1 && (
            <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl bg-bg px-3 py-2">
              <span className="text-sm font-semibold">ตั้งราคาทั้งแถว</span>
              <select
                aria-label="กลุ่ม"
                value={rowGroup}
                onChange={(e) => {
                  setRowGroup(e.target.value);
                  setRowOption('');
                }}
                className="min-h-12 rounded-xl border border-border bg-surface px-2"
              >
                <option value="">เลือกกลุ่ม</option>
                {variantGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
              <select
                aria-label="ตัวเลือก"
                value={rowOption}
                disabled={!rowGroup}
                onChange={(e) => setRowOption(e.target.value)}
                className="min-h-12 rounded-xl border border-border bg-surface px-2"
              >
                <option value="">เลือก</option>
                {variantGroups
                  .find((g) => g.id === rowGroup)
                  ?.options.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
              </select>
              <input
                aria-label="ราคา (บาท)"
                inputMode="numeric"
                placeholder="฿"
                value={rowPrice}
                onChange={(e) => setRowPrice(e.target.value.replace(/[^0-9]/g, ''))}
                className={priceInput}
              />
              <button type="button" onClick={setWholeRow} className={cx(btnSecondary, 'min-h-12')}>
                ใช้ราคานี้
              </button>
            </div>
          )}
          {menu.variants.map((v, i) => (
            <BahtField
              key={v.optionIds.join('|')}
              label={rowLabel(v.optionIds) || v.optionIds.map(optionName).join(' / ')}
              satang={v.priceSatang}
              onChange={(s) =>
                setMenu((m) => ({
                  ...m,
                  variants: m.variants.map((x, j) => (j === i ? { ...x, priceSatang: s } : x)),
                }))
              }
            />
          ))}
        </div>
      )}

      {menu.groups
        .filter((g) => g.kind === 'choice' && g.options.some((o) => o.priceDeltaSatang > 0))
        .map((g) => (
          <div key={g.id} className="mt-3 border-t border-border pt-2">
            <p className="text-sm font-semibold">{g.name} (บวกเพิ่ม)</p>
            {g.options.map((o) => (
              <BahtField
                key={o.id}
                label={`+ ${o.name}`}
                satang={o.priceDeltaSatang}
                onChange={(s) =>
                  setMenu((m) => ({
                    ...m,
                    groups: m.groups.map((x) =>
                      x.id !== g.id
                        ? x
                        : {
                            ...x,
                            options: x.options.map((y) =>
                              y.id === o.id ? { ...y, priceDeltaSatang: s ?? 0 } : y,
                            ),
                          },
                    ),
                  }))
                }
              />
            ))}
          </div>
        ))}
    </li>
  );
}

export function MenuPrices({ menus }: { menus: Menu[] }) {
  const [saved, setSaved] = useState(false);
  return (
    <>
      <ul className="mt-5 space-y-3">
        {menus.map((m) => (
          <MenuEditor key={m.id} initial={m} />
        ))}
      </ul>
      <div className="sticky bottom-0 mt-4 flex items-center justify-end gap-3 border-t border-border bg-bg py-3">
        <p className="text-sm text-muted" role="status">
          {saved ? 'ต้นแบบ: ยังไม่บันทึกจริงจนกว่าจะเชื่อมฐานข้อมูล' : ''}
        </p>
        <button type="button" onClick={() => setSaved(true)} className={cx(btnPrimary, 'min-h-12')}>
          บันทึกราคา
        </button>
      </div>
    </>
  );
}
