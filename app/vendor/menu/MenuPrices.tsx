'use client';

import { useId, useState } from 'react';
import { btnPrimary, btnSecondary, cx } from '@/components/ui';
import { formatBaht } from '@/lib/format';
import type { Menu } from '@/lib/menu';
import { actSavePrices, actSetMenuAvailable, actSetOptionAvailable } from '@/lib/vendor/actions';

// Prices are typed in whole baht and saved as satang. Edits are kept per field and sent in
// one batch by "บันทึกราคา". New prices apply to new orders; placed orders keep theirs.

type Change =
  | { kind: 'base'; menuId: string; satang: number }
  | { kind: 'variant'; menuId: string; optionIds: string[]; satang: number }
  | { kind: 'tier'; groupId: string; count: number; satang: number }
  | { kind: 'delta'; optionId: string; satang: number };

const MAX_BAHT = 1000;

const keyOf = {
  base: (menuId: string) => `b:${menuId}`,
  variant: (menuId: string, optionIds: string[]) =>
    `v:${menuId}:${[...optionIds].sort().join(',')}`,
  tier: (groupId: string, count: number) => `t:${groupId}:${count}`,
  delta: (optionId: string) => `d:${optionId}`,
};

const priceInput =
  'min-h-12 w-24 rounded-xl border border-border bg-surface px-3 text-right text-lg font-semibold tabular-nums focus:border-primary focus:outline-none';

function BahtField({
  label,
  originalSatang,
  edit,
  allowZero,
  onEdit,
}: {
  label: string;
  originalSatang: number | null;
  edit: string | undefined;
  allowZero?: boolean;
  onEdit: (text: string) => void;
}) {
  const id = useId();
  const shown = edit ?? (originalSatang === null ? '' : String(originalSatang / 100));
  const valid =
    /^\d+$/.test(shown) && Number(shown) <= MAX_BAHT && (allowZero || Number(shown) > 0);
  const changed = edit !== undefined && edit !== String((originalSatang ?? 0) / 100);
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <label htmlFor={id} className={cx('min-w-0 flex-1 text-sm', changed && 'font-semibold')}>
        {label}
      </label>
      <span className="inline-flex items-center gap-1.5">
        <span className="text-muted">฿</span>
        <input
          id={id}
          inputMode="numeric"
          aria-invalid={!valid}
          className={cx(
            priceInput,
            !valid && 'border-danger',
            changed && valid && 'border-primary',
          )}
          value={shown}
          onChange={(e) => onEdit(e.target.value.replace(/[^0-9]/g, ''))}
        />
      </span>
    </div>
  );
}

function Toggle({
  on,
  label,
  busy,
  onChange,
}: {
  on: boolean;
  label: string;
  busy?: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={`${label}: ${on ? 'เปิดขาย' : 'ปิดขาย'}`}
      disabled={busy}
      onClick={onChange}
      className={cx(
        'min-h-12 rounded-xl px-4 text-sm font-bold disabled:opacity-60',
        on ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger',
      )}
    >
      {on ? 'เปิดขาย' : 'ปิดขาย'}
    </button>
  );
}

export function MenuPrices({ shopId, menus: initial }: { shopId: string; menus: Menu[] }) {
  const [menus, setMenus] = useState(initial);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [rowMenu, setRowMenu] = useState<
    Record<string, { group: string; option: string; price: string }>
  >({});

  const edit = (key: string, text: string) => {
    setStatus(null);
    setEdits((e) => ({ ...e, [key]: text }));
  };

  /** Every edited field whose value differs from the saved one, as server changes. */
  function pending(): { changes: Change[]; invalid: boolean } {
    const changes: Change[] = [];
    let invalid = false;
    const take = (
      key: string,
      original: number | null,
      allowZero: boolean,
      make: (s: number) => Change,
    ) => {
      const text = edits[key];
      if (text === undefined) return;
      const ok = /^\d+$/.test(text) && Number(text) <= MAX_BAHT && (allowZero || Number(text) > 0);
      if (!ok) {
        invalid = true;
        return;
      }
      const satang = Number(text) * 100;
      if (satang !== original) changes.push(make(satang));
    };
    for (const m of menus) {
      take(keyOf.base(m.id), m.basePriceSatang, false, (satang) => ({
        kind: 'base',
        menuId: m.id,
        satang,
      }));
      for (const v of m.variants) {
        take(keyOf.variant(m.id, v.optionIds), v.priceSatang, false, (satang) => ({
          kind: 'variant',
          menuId: m.id,
          optionIds: v.optionIds,
          satang,
        }));
      }
      for (const g of m.groups) {
        for (const t of g.tierPrices) {
          take(keyOf.tier(g.id, t.selectedCount), t.priceSatang, false, (satang) => ({
            kind: 'tier',
            groupId: g.id,
            count: t.selectedCount,
            satang,
          }));
        }
        if (g.kind === 'choice') {
          for (const o of g.options.filter((x) => x.priceDeltaSatang > 0)) {
            take(keyOf.delta(o.id), o.priceDeltaSatang, true, (satang) => ({
              kind: 'delta',
              optionId: o.id,
              satang,
            }));
          }
        }
      }
    }
    return { changes, invalid };
  }

  const { changes, invalid } = pending();

  async function save() {
    setBusy('save');
    setStatus(null);
    const result = await actSavePrices(shopId, changes).catch(() => ({ ok: false as const }));
    if (result.ok) {
      // Fold the saved values into the shown menus.
      setMenus((ms) =>
        ms.map((m) => ({
          ...m,
          basePriceSatang:
            changes.find((c) => c.kind === 'base' && c.menuId === m.id)?.satang ??
            m.basePriceSatang,
          variants: m.variants.map((v) => {
            const c = changes.find(
              (x) =>
                x.kind === 'variant' &&
                x.menuId === m.id &&
                keyOf.variant(m.id, x.optionIds) === keyOf.variant(m.id, v.optionIds),
            );
            return c ? { ...v, priceSatang: c.satang } : v;
          }),
          groups: m.groups.map((g) => ({
            ...g,
            tierPrices: g.tierPrices.map((t) => {
              const c = changes.find(
                (x) => x.kind === 'tier' && x.groupId === g.id && x.count === t.selectedCount,
              );
              return c ? { ...t, priceSatang: c.satang } : t;
            }),
            options: g.options.map((o) => {
              const c = changes.find((x) => x.kind === 'delta' && x.optionId === o.id);
              return c ? { ...o, priceDeltaSatang: c.satang } : o;
            }),
          })),
        })),
      );
      setEdits({});
      setStatus({
        ok: true,
        text: `บันทึกแล้ว ${changes.length} รายการ · ลูกค้าเห็นราคาใหม่ทันที`,
      });
    } else {
      setStatus({ ok: false, text: 'บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง' });
    }
    setBusy(null);
  }

  async function toggleMenu(m: Menu) {
    setBusy(m.id);
    const next = !m.isAvailable;
    const result = await actSetMenuAvailable(shopId, m.id, next).catch(() => ({ ok: false }));
    if (result.ok)
      setMenus((ms) => ms.map((x) => (x.id === m.id ? { ...x, isAvailable: next } : x)));
    else setStatus({ ok: false, text: 'เปลี่ยนสถานะเมนูไม่สำเร็จ' });
    setBusy(null);
  }

  async function toggleOption(menuId: string, groupId: string, optionId: string, next: boolean) {
    setBusy(optionId);
    const result = await actSetOptionAvailable(shopId, optionId, next).catch(() => ({ ok: false }));
    if (result.ok) {
      setMenus((ms) =>
        ms.map((m) =>
          m.id !== menuId
            ? m
            : {
                ...m,
                groups: m.groups.map((g) =>
                  g.id !== groupId
                    ? g
                    : {
                        ...g,
                        options: g.options.map((o) =>
                          o.id === optionId ? { ...o, isAvailable: next } : o,
                        ),
                      },
                ),
              },
        ),
      );
    } else setStatus({ ok: false, text: 'เปลี่ยนสถานะตัวเลือกไม่สำเร็จ' });
    setBusy(null);
  }

  /** "ตั้งราคาทั้งแถว": one price for every variant row that includes the chosen option. */
  function setWholeRow(m: Menu) {
    const r = rowMenu[m.id];
    if (!r?.option || !/^\d+$/.test(r.price) || Number(r.price) < 1 || Number(r.price) > MAX_BAHT)
      return;
    setStatus(null);
    setEdits((e) => {
      const next = { ...e };
      for (const v of m.variants)
        if (v.optionIds.includes(r.option)) next[keyOf.variant(m.id, v.optionIds)] = r.price;
      return next;
    });
  }

  return (
    <>
      <ul className="mt-5 space-y-3">
        {menus.map((m) => {
          const variantGroups = m.groups.filter((g) => g.kind === 'variant');
          const optionName = (id: string) =>
            m.groups.flatMap((g) => g.options).find((o) => o.id === id)?.name ?? id;
          const rowLabel = (ids: string[]) =>
            variantGroups
              .map((g) => g.options.find((o) => ids.includes(o.id)))
              .filter(Boolean)
              .map((o) => o!.name)
              .join(' / ') || ids.map(optionName).join(' / ');
          const r = rowMenu[m.id] ?? { group: '', option: '', price: '' };
          return (
            <li key={m.id} className="rounded-2xl border border-border bg-surface px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold">{m.name}</h2>
                  <p className="text-xs text-muted">{m.category}</p>
                </div>
                <Toggle
                  on={m.isAvailable}
                  label={m.name}
                  busy={busy === m.id}
                  onChange={() => toggleMenu(m)}
                />
              </div>

              {m.basePriceSatang !== null && (
                <div className="mt-3 border-t border-border pt-2">
                  <BahtField
                    label="ราคา"
                    originalSatang={m.basePriceSatang}
                    edit={edits[keyOf.base(m.id)]}
                    onEdit={(t) => edit(keyOf.base(m.id), t)}
                  />
                </div>
              )}

              {m.groups
                .filter((g) => g.kind === 'tiered')
                .map((g) => (
                  <div key={g.id} className="mt-3 border-t border-border pt-2">
                    <p className="text-sm font-semibold">{g.name} (ราคาตามจำนวนที่เลือก)</p>
                    {g.tierPrices.map((t) => (
                      <BahtField
                        key={t.selectedCount}
                        label={`${t.selectedCount} อย่าง`}
                        originalSatang={t.priceSatang}
                        edit={edits[keyOf.tier(g.id, t.selectedCount)]}
                        onEdit={(text) => edit(keyOf.tier(g.id, t.selectedCount), text)}
                      />
                    ))}
                  </div>
                ))}

              {m.variants.length > 0 && (
                <div className="mt-3 border-t border-border pt-2">
                  <p className="text-sm font-semibold">ราคาแต่ละแบบ ({m.variants.length} แบบ)</p>
                  {variantGroups.length > 1 && (
                    <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl bg-bg px-3 py-2">
                      <span className="text-sm font-semibold">ตั้งราคาทั้งแถว</span>
                      <select
                        aria-label="กลุ่ม"
                        value={r.group}
                        onChange={(e) =>
                          setRowMenu((s) => ({
                            ...s,
                            [m.id]: { ...r, group: e.target.value, option: '' },
                          }))
                        }
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
                        value={r.option}
                        disabled={!r.group}
                        onChange={(e) =>
                          setRowMenu((s) => ({ ...s, [m.id]: { ...r, option: e.target.value } }))
                        }
                        className="min-h-12 rounded-xl border border-border bg-surface px-2"
                      >
                        <option value="">เลือก</option>
                        {variantGroups
                          .find((g) => g.id === r.group)
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
                        value={r.price}
                        onChange={(e) =>
                          setRowMenu((s) => ({
                            ...s,
                            [m.id]: { ...r, price: e.target.value.replace(/[^0-9]/g, '') },
                          }))
                        }
                        className={priceInput}
                      />
                      <button
                        type="button"
                        onClick={() => setWholeRow(m)}
                        className={cx(btnSecondary, 'min-h-12')}
                      >
                        ใช้ราคานี้
                      </button>
                    </div>
                  )}
                  {m.variants.map((v) => (
                    <BahtField
                      key={v.optionIds.join('|')}
                      label={rowLabel(v.optionIds)}
                      originalSatang={v.priceSatang}
                      edit={edits[keyOf.variant(m.id, v.optionIds)]}
                      onEdit={(t) => edit(keyOf.variant(m.id, v.optionIds), t)}
                    />
                  ))}
                </div>
              )}

              {m.groups
                .filter((g) => g.kind === 'choice' && g.options.some((o) => o.priceDeltaSatang > 0))
                .map((g) => (
                  <div key={g.id} className="mt-3 border-t border-border pt-2">
                    <p className="text-sm font-semibold">{g.name} (บวกเพิ่ม)</p>
                    {g.options
                      .filter((o) => o.priceDeltaSatang > 0)
                      .map((o) => (
                        <BahtField
                          key={o.id}
                          label={`+ ${o.name}`}
                          originalSatang={o.priceDeltaSatang}
                          allowZero
                          edit={edits[keyOf.delta(o.id)]}
                          onEdit={(t) => edit(keyOf.delta(o.id), t)}
                        />
                      ))}
                  </div>
                ))}

              <details className="mt-3 border-t border-border pt-2">
                <summary className="min-h-12 cursor-pointer py-3 text-sm font-semibold">
                  เปิด/ปิดตัวเลือกของเมนูนี้
                </summary>
                {m.groups.map((g) => (
                  <div key={g.id} className="pb-2">
                    <p className="text-xs text-muted">{g.name}</p>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {g.options.map((o) => (
                        <button
                          key={o.id}
                          type="button"
                          aria-pressed={o.isAvailable}
                          disabled={busy === o.id}
                          onClick={() => toggleOption(m.id, g.id, o.id, !o.isAvailable)}
                          className={cx(
                            'min-h-12 rounded-full border px-4 text-sm disabled:opacity-60',
                            o.isAvailable
                              ? 'border-success/40 bg-success-soft text-success'
                              : 'border-danger/40 bg-danger-soft text-danger line-through',
                          )}
                        >
                          {o.name}
                          {o.priceDeltaSatang > 0 && ` +${formatBaht(o.priceDeltaSatang)}`}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </details>
            </li>
          );
        })}
      </ul>

      <div className="sticky bottom-0 mt-4 flex flex-wrap items-center justify-end gap-3 border-t border-border bg-bg py-3">
        <p
          role="status"
          className={cx(
            'mr-auto text-sm',
            status?.ok === false ? 'font-semibold text-danger' : 'text-muted',
          )}
        >
          {status?.text ??
            (invalid
              ? 'ราคาที่กรอกไม่ถูกต้อง'
              : changes.length > 0
                ? `แก้ไขแล้ว ${changes.length} รายการ ยังไม่ได้บันทึก`
                : '')}
        </p>
        <button
          type="button"
          onClick={save}
          disabled={changes.length === 0 || invalid || busy === 'save'}
          className={cx(btnPrimary, 'min-h-12')}
        >
          {busy === 'save' ? 'กำลังบันทึก…' : 'บันทึกราคา'}
        </button>
      </div>
    </>
  );
}
