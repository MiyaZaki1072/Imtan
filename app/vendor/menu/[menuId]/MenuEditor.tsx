'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useId, useMemo, useState } from 'react';
import { CustomizeSheet } from '@/components/CustomizeSheet';
import { btnPrimary, btnSecondary, card, cx } from '@/components/ui';
import {
  ingredientMap,
  type Ingredient,
  type Menu,
  type OptionGroup,
  type OptionGroupKind,
} from '@/lib/menu';
import {
  canSell,
  hasErrors,
  syncVariants,
  validateStructure,
  variantCombos,
  comboKey,
} from '@/lib/menu/structure';
import { actDeleteMenu, actSaveMenu } from '@/lib/vendor/actions';

const KIND_LABEL: Record<OptionGroupKind, string> = {
  variant: 'ราคาตามแบบ (เลือก 1 · ราคาแต่ละชุดกรอกในตาราง)',
  tiered: 'ราคาตามจำนวนที่เลือก (เช่น 1 อย่าง ฿50 / 2 อย่าง ฿60)',
  choice: 'เลือก (บวกราคาได้)',
  remove: 'ไม่ใส่… (ไม่คิดราคา)',
  toppings: 'เครื่อง (ใส่ครบ ลูกค้ากดเอาออก)',
};

const field = 'min-h-12 rounded-xl border border-border bg-surface px-3 text-base';
const small = 'min-h-12 rounded-xl border border-border bg-surface px-2 text-sm';

const toBaht = (satang: number | null | undefined) => (satang == null ? '' : String(satang / 100));
const fromBaht = (text: string): number | null => (/^\d+$/.test(text) ? Number(text) * 100 : null);

/** Keeps derived data consistent: the variant grid follows the variant groups. */
function normalize(menu: Menu): Menu {
  return menu.groups.some((g) => g.kind === 'variant')
    ? syncVariants(menu)
    : { ...menu, variants: [] };
}

function newMenu(category: string): Menu {
  return {
    id: crypto.randomUUID(),
    category,
    name: '',
    cookSeconds: 120,
    basePriceSatang: null,
    pairOnly: false,
    isAvailable: true,
    isDeleted: false,
    ingredientIds: [],
    groups: [],
    variants: [],
  };
}

function Num({
  value,
  onChange,
  label,
  min = 0,
  max = 99,
  disabled,
}: {
  value: number;
  onChange: (n: number) => void;
  label: string;
  min?: number;
  max?: number;
  disabled?: boolean;
}) {
  return (
    <input
      aria-label={label}
      inputMode="numeric"
      disabled={disabled}
      className={cx(small, 'w-16 text-center disabled:opacity-50')}
      value={value}
      onChange={(e) =>
        onChange(Math.max(min, Math.min(max, Number(e.target.value.replace(/\D/g, '')) || 0)))
      }
    />
  );
}

function BahtBox({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (s: number | null) => void;
}) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="text-muted">฿</span>
      <input
        aria-label={label}
        inputMode="numeric"
        className={cx(small, 'w-20 text-right tabular-nums')}
        value={toBaht(value)}
        onChange={(e) => onChange(fromBaht(e.target.value.replace(/[^0-9]/g, '')))}
      />
    </span>
  );
}

export function MenuEditor({
  shopId,
  initial,
  ingredients,
  categories,
}: {
  shopId: string;
  initial: Menu | null;
  ingredients: Ingredient[];
  categories: string[];
}) {
  const router = useRouter();
  const isNew = initial === null;
  const [menu, setMenu] = useState<Menu>(() => normalize(initial ?? newMenu(categories[0] ?? '')));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string; list?: string[] } | null>(
    null,
  );
  const [preview, setPreview] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const listId = useId();

  const ingredientIds = useMemo(() => ingredients.map((i) => i.id), [ingredients]);
  const issues = useMemo(() => validateStructure(menu, ingredientIds), [menu, ingredientIds]);
  const errors = issues.filter((i) => i.severity === 'error');
  const blocks = issues.filter((i) => i.severity === 'block');
  const sellable = canSell(issues);

  const update = (fn: (m: Menu) => Menu) => {
    setMessage(null);
    setMenu((m) => normalize(fn(m)));
  };
  const patchGroup = (id: string, fn: (g: OptionGroup) => OptionGroup) =>
    update((m) => ({ ...m, groups: m.groups.map((g) => (g.id === id ? fn(g) : g)) }));

  function addGroup() {
    update((m) => ({
      ...m,
      groups: [
        ...m.groups,
        {
          id: crypto.randomUUID(),
          name: '',
          kind: 'choice',
          minSelect: 0,
          maxSelect: 1,
          showWhen: null,
          selectAllLabel: null,
          note: null,
          tierPrices: [],
          options: [
            {
              id: crypto.randomUUID(),
              name: '',
              priceDeltaSatang: 0,
              ingredientId: null,
              isDefault: false,
              isAvailable: true,
            },
          ],
        },
      ],
    }));
  }

  function move(index: number, dir: -1 | 1) {
    update((m) => {
      const groups = [...m.groups];
      const to = index + dir;
      if (to < 0 || to >= groups.length) return m;
      [groups[index], groups[to]] = [groups[to], groups[index]];
      // A conditional group must stay after the group it depends on.
      const order = new Map(groups.map((g, i) => [g.id, i]));
      return {
        ...m,
        groups: groups.map((g) =>
          g.showWhen && (order.get(g.showWhen.groupId) ?? 0) >= (order.get(g.id) ?? 0)
            ? { ...g, showWhen: null }
            : g,
        ),
      };
    });
  }

  function changeKind(g: OptionGroup, kind: OptionGroupKind) {
    patchGroup(g.id, (x) => ({
      ...x,
      kind,
      minSelect: kind === 'variant' ? 1 : x.minSelect,
      maxSelect: kind === 'variant' ? 1 : Math.max(1, x.maxSelect),
      showWhen: kind === 'variant' ? null : x.showWhen,
      tierPrices: kind === 'tiered' ? x.tierPrices : [],
      selectAllLabel: kind === 'toppings' ? (x.selectAllLabel ?? 'ใส่ทุกอย่าง') : null,
      options: x.options.map((o) => ({
        ...o,
        priceDeltaSatang: kind === 'choice' ? o.priceDeltaSatang : 0,
      })),
    }));
  }

  async function save() {
    setBusy(true);
    setMessage(null);
    const result = await actSaveMenu(shopId, menu).catch(() => null);
    setBusy(false);
    if (result?.ok) {
      setMessage({
        ok: true,
        text: result.available
          ? 'บันทึกแล้ว · เมนูเปิดขายและลูกค้าเห็นทันที'
          : menu.isAvailable
            ? 'บันทึกแล้ว แต่ยังปิดขายอยู่ จนกว่าจะแก้ตามรายการด้านล่าง'
            : 'บันทึกแล้ว · เมนูปิดขายอยู่ ติ๊ก “เปิดขาย” แล้วบันทึกอีกครั้งเพื่อให้ลูกค้าเห็น',
      });
      if (isNew) router.replace(`/vendor/menu/${result.menuId}`);
      else setMenu((m) => ({ ...m, isAvailable: result.available }));
    } else if (result?.error === 'invalid') {
      setMessage({ ok: false, text: 'บันทึกไม่ได้ ต้องแก้ก่อน:', list: result.issues });
    } else {
      setMessage({ ok: false, text: 'บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง' });
    }
  }

  async function remove() {
    setBusy(true);
    const result = await actDeleteMenu(shopId, menu.id).catch(() => null);
    if (result?.ok) router.push('/vendor/menu');
    else {
      setBusy(false);
      setConfirmDelete(false);
      setMessage({ ok: false, text: 'ลบไม่สำเร็จ' });
    }
  }

  const variantGroups = menu.groups.filter((g) => g.kind === 'variant');
  const tiered = menu.groups.find((g) => g.kind === 'tiered');
  const optionName = (id: string) =>
    menu.groups.flatMap((g) => g.options).find((o) => o.id === id)?.name || '…';
  const rowLabel = (ids: string[]) =>
    variantGroups.map((g) => g.options.find((o) => ids.includes(o.id))?.name || '…').join(' / ') ||
    ids.map(optionName).join(' / ');

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 pt-5 pb-28">
      <Link href="/vendor/menu" className="text-sm font-semibold text-primary">
        ← กลับไปเมนูและราคา
      </Link>
      <h1 className="mt-1 text-2xl font-bold">
        {isNew ? 'เพิ่มเมนูใหม่' : `แก้เมนู: ${initial.name}`}
      </h1>
      <p className="mt-1 text-sm text-muted">
        แก้โครงสร้างตัวเลือกได้เต็มที่ · ออเดอร์ที่สั่งไปแล้วไม่เปลี่ยน
      </p>

      {/* Basics */}
      <section
        className={cx(card, 'mt-4 grid gap-3 px-4 py-4 sm:grid-cols-2')}
        aria-label="ข้อมูลเมนู"
      >
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">ชื่อเมนู</span>
          <input
            className={cx(field, 'w-full')}
            value={menu.name}
            maxLength={80}
            onChange={(e) => update((m) => ({ ...m, name: e.target.value }))}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">หมวดหมู่</span>
          <input
            className={cx(field, 'w-full')}
            list={listId}
            value={menu.category}
            maxLength={40}
            onChange={(e) => update((m) => ({ ...m, category: e.target.value }))}
          />
          <datalist id={listId}>
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">เวลาทำ (นาที)</span>
          <input
            inputMode="decimal"
            className={cx(field, 'w-28')}
            value={menu.cookSeconds / 60}
            onChange={(e) => {
              const min = Number(e.target.value);
              if (Number.isFinite(min) && min >= 0)
                update((m) => ({ ...m, cookSeconds: Math.round(min * 60) }));
            }}
          />
        </label>
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex min-h-12 items-center gap-2">
            <input
              type="checkbox"
              className="h-6 w-6 accent-primary"
              checked={menu.pairOnly}
              onChange={(e) => update((m) => ({ ...m, pairOnly: e.target.checked }))}
            />
            <span>ต้องสั่งคู่กับเมนูอื่น</span>
          </label>
          <label className="flex min-h-12 items-center gap-2">
            <input
              type="checkbox"
              className="h-6 w-6 accent-primary"
              checked={menu.isAvailable && sellable}
              disabled={!sellable}
              onChange={(e) => update((m) => ({ ...m, isAvailable: e.target.checked }))}
            />
            <span>เปิดขาย{!sellable && ' (ต้องแก้รายการด้านล่างก่อน)'}</span>
          </label>
        </div>
      </section>

      <section className={cx(card, 'mt-3 px-4 py-4')} aria-label="วัตถุดิบที่เมนูนี้ต้องใช้">
        <h2 className="font-bold">วัตถุดิบที่เมนูนี้ต้องใช้</h2>
        <p className="text-xs text-muted">ถ้าวัตถุดิบเหล่านี้หมด เมนูจะถูกปิดให้ลูกค้าอัตโนมัติ</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {ingredients.map((i) => {
            const on = menu.ingredientIds.includes(i.id);
            return (
              <button
                key={i.id}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  update((m) => ({
                    ...m,
                    ingredientIds: on
                      ? m.ingredientIds.filter((x) => x !== i.id)
                      : [...m.ingredientIds, i.id],
                  }))
                }
                className={cx(
                  'min-h-12 rounded-full border px-4 text-sm',
                  on
                    ? 'border-primary bg-primary-soft font-semibold text-primary-hover'
                    : 'border-border',
                )}
              >
                {i.name}
              </button>
            );
          })}
        </div>
      </section>

      {/* Groups */}
      <h2 className="mt-6 text-lg font-bold">กลุ่มตัวเลือก</h2>
      <ol className="mt-2 space-y-3">
        {menu.groups.map((g, gi) => {
          const earlier = menu.groups.slice(0, gi).filter((p) => p.kind !== 'variant' || true);
          const parent = g.showWhen
            ? menu.groups.find((p) => p.id === g.showWhen!.groupId)
            : undefined;
          return (
            <li key={g.id} className={cx(card, 'px-4 py-4')}>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  aria-label={`ชื่อกลุ่มที่ ${gi + 1}`}
                  placeholder="ชื่อกลุ่ม เช่น ความเผ็ด"
                  className={cx(field, 'min-w-0 flex-1')}
                  value={g.name}
                  maxLength={40}
                  onChange={(e) => patchGroup(g.id, (x) => ({ ...x, name: e.target.value }))}
                />
                <button
                  type="button"
                  aria-label="เลื่อนขึ้น"
                  disabled={gi === 0}
                  onClick={() => move(gi, -1)}
                  className={cx(btnSecondary, 'min-h-12 px-3 disabled:opacity-40')}
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label="เลื่อนลง"
                  disabled={gi === menu.groups.length - 1}
                  onClick={() => move(gi, 1)}
                  className={cx(btnSecondary, 'min-h-12 px-3 disabled:opacity-40')}
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() =>
                    update((m) => ({
                      ...m,
                      groups: m.groups
                        .filter((x) => x.id !== g.id)
                        .map((x) => (x.showWhen?.groupId === g.id ? { ...x, showWhen: null } : x)),
                    }))
                  }
                  className={cx(btnSecondary, 'min-h-12 border-danger/40 px-3 text-danger')}
                >
                  ลบกลุ่ม
                </button>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
                <label className="block">
                  <span className="mb-1 block text-xs text-muted">ชนิดกลุ่ม</span>
                  <select
                    aria-label="ชนิดกลุ่ม"
                    className={cx(field, 'w-full text-sm')}
                    value={g.kind}
                    onChange={(e) => changeKind(g, e.target.value as OptionGroupKind)}
                  >
                    {(Object.keys(KIND_LABEL) as OptionGroupKind[]).map((k) => (
                      <option key={k} value={k}>
                        {KIND_LABEL[k]}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex items-end gap-2 text-sm">
                  <span>เลือก</span>
                  <Num
                    label="เลือกอย่างน้อย"
                    value={g.minSelect}
                    disabled={g.kind === 'variant'}
                    onChange={(n) => patchGroup(g.id, (x) => ({ ...x, minSelect: n }))}
                  />
                  <span>ถึง</span>
                  <Num
                    label="เลือกได้สูงสุด"
                    min={1}
                    value={g.maxSelect}
                    disabled={g.kind === 'variant'}
                    onChange={(n) => patchGroup(g.id, (x) => ({ ...x, maxSelect: n }))}
                  />
                  <span>อย่าง</span>
                </div>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {g.kind === 'toppings' && (
                  <label className="block">
                    <span className="mb-1 block text-xs text-muted">ปุ่มเลือกทั้งหมด</span>
                    <input
                      className={cx(field, 'w-full')}
                      value={g.selectAllLabel ?? ''}
                      maxLength={20}
                      onChange={(e) =>
                        patchGroup(g.id, (x) => ({ ...x, selectAllLabel: e.target.value }))
                      }
                    />
                  </label>
                )}
                <label className="block">
                  <span className="mb-1 block text-xs text-muted">
                    หมายเหตุใต้ชื่อกลุ่ม (ไม่บังคับ)
                  </span>
                  <input
                    className={cx(field, 'w-full')}
                    value={g.note ?? ''}
                    maxLength={80}
                    onChange={(e) =>
                      patchGroup(g.id, (x) => ({ ...x, note: e.target.value || null }))
                    }
                  />
                </label>
              </div>

              {g.kind !== 'variant' && earlier.length > 0 && (
                <div className="mt-3 rounded-xl bg-bg px-3 py-3">
                  <label className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-semibold">แสดงกลุ่มนี้เมื่อ</span>
                    <select
                      aria-label="แสดงเมื่อกลุ่ม"
                      className={small}
                      value={g.showWhen?.groupId ?? ''}
                      onChange={(e) =>
                        patchGroup(g.id, (x) => ({
                          ...x,
                          showWhen: e.target.value
                            ? { groupId: e.target.value, optionIds: [] }
                            : null,
                        }))
                      }
                    >
                      <option value="">แสดงเสมอ</option>
                      {earlier.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name || 'กลุ่มที่ไม่มีชื่อ'}
                        </option>
                      ))}
                    </select>
                  </label>
                  {parent && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {parent.options.map((o) => {
                        const on = g.showWhen!.optionIds.includes(o.id);
                        return (
                          <button
                            key={o.id}
                            type="button"
                            aria-pressed={on}
                            onClick={() =>
                              patchGroup(g.id, (x) => ({
                                ...x,
                                showWhen: {
                                  groupId: parent.id,
                                  optionIds: on
                                    ? x.showWhen!.optionIds.filter((i) => i !== o.id)
                                    : [...x.showWhen!.optionIds, o.id],
                                },
                              }))
                            }
                            className={cx(
                              'min-h-12 rounded-full border px-4 text-sm',
                              on
                                ? 'border-primary bg-primary-soft font-semibold text-primary-hover'
                                : 'border-border bg-surface',
                            )}
                          >
                            {o.name || '…'}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <ul className="mt-3 space-y-2">
                {g.options.map((o) => (
                  <li
                    key={o.id}
                    className="flex flex-wrap items-center gap-2 rounded-xl border border-border px-2 py-2"
                  >
                    <input
                      aria-label="ชื่อตัวเลือก"
                      placeholder="ชื่อตัวเลือก"
                      className={cx(small, 'min-w-0 flex-1 text-base')}
                      value={o.name}
                      maxLength={40}
                      onChange={(e) =>
                        patchGroup(g.id, (x) => ({
                          ...x,
                          options: x.options.map((y) =>
                            y.id === o.id ? { ...y, name: e.target.value } : y,
                          ),
                        }))
                      }
                    />
                    {g.kind === 'choice' && (
                      <span className="inline-flex items-center gap-1 text-sm">
                        <span className="text-muted">+฿</span>
                        <input
                          aria-label="ราคาบวกเพิ่ม (บาท)"
                          inputMode="numeric"
                          className={cx(small, 'w-16 text-right')}
                          value={o.priceDeltaSatang / 100 || ''}
                          placeholder="0"
                          onChange={(e) =>
                            patchGroup(g.id, (x) => ({
                              ...x,
                              options: x.options.map((y) =>
                                y.id === o.id
                                  ? {
                                      ...y,
                                      priceDeltaSatang:
                                        Number(e.target.value.replace(/\D/g, '') || 0) * 100,
                                    }
                                  : y,
                              ),
                            }))
                          }
                        />
                      </span>
                    )}
                    <select
                      aria-label="วัตถุดิบ"
                      className={cx(small, 'max-w-36')}
                      value={o.ingredientId ?? ''}
                      onChange={(e) =>
                        patchGroup(g.id, (x) => ({
                          ...x,
                          options: x.options.map((y) =>
                            y.id === o.id ? { ...y, ingredientId: e.target.value || null } : y,
                          ),
                        }))
                      }
                    >
                      <option value="">ไม่ผูกวัตถุดิบ</option>
                      {ingredients.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name}
                        </option>
                      ))}
                    </select>
                    <label className="inline-flex min-h-12 items-center gap-1 text-sm">
                      <input
                        type="checkbox"
                        className="h-5 w-5 accent-primary"
                        checked={o.isDefault}
                        onChange={(e) =>
                          patchGroup(g.id, (x) => ({
                            ...x,
                            options: x.options.map((y) =>
                              y.id === o.id ? { ...y, isDefault: e.target.checked } : y,
                            ),
                          }))
                        }
                      />
                      เริ่มต้น
                    </label>
                    <label className="inline-flex min-h-12 items-center gap-1 text-sm">
                      <input
                        type="checkbox"
                        className="h-5 w-5 accent-primary"
                        checked={o.isAvailable}
                        onChange={(e) =>
                          patchGroup(g.id, (x) => ({
                            ...x,
                            options: x.options.map((y) =>
                              y.id === o.id ? { ...y, isAvailable: e.target.checked } : y,
                            ),
                          }))
                        }
                      />
                      เปิดขาย
                    </label>
                    <button
                      type="button"
                      aria-label="ลบตัวเลือก"
                      onClick={() =>
                        update((m) => ({
                          ...m,
                          groups: m.groups.map((x) =>
                            x.id === g.id
                              ? { ...x, options: x.options.filter((y) => y.id !== o.id) }
                              : {
                                  ...x,
                                  showWhen: x.showWhen
                                    ? {
                                        ...x.showWhen,
                                        optionIds: x.showWhen.optionIds.filter((i) => i !== o.id),
                                      }
                                    : null,
                                },
                          ),
                        }))
                      }
                      className="min-h-12 rounded-lg px-3 text-danger hover:bg-danger-soft"
                    >
                      ลบ
                    </button>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() =>
                  patchGroup(g.id, (x) => ({
                    ...x,
                    options: [
                      ...x.options,
                      {
                        id: crypto.randomUUID(),
                        name: '',
                        priceDeltaSatang: 0,
                        ingredientId: null,
                        isDefault: false,
                        isAvailable: true,
                      },
                    ],
                  }))
                }
                className={cx(btnSecondary, 'mt-2 min-h-12')}
              >
                + เพิ่มตัวเลือก
              </button>
            </li>
          );
        })}
      </ol>
      <button type="button" onClick={addGroup} className={cx(btnSecondary, 'mt-3 min-h-12')}>
        + เพิ่มกลุ่มตัวเลือก
      </button>

      {/* Prices: exactly one source */}
      <section className={cx(card, 'mt-6 px-4 py-4')} aria-label="ราคา">
        <h2 className="font-bold">ราคา</h2>
        {variantGroups.length > 0 ? (
          <>
            <p className="text-xs text-muted">
              ราคาแต่ละชุดของ {variantGroups.map((g) => g.name || '…').join(' × ')} (
              {variantCombos(menu).length} แบบ) · แบบใหม่ที่เพิ่มต้องใส่ราคาก่อนเปิดขาย
            </p>
            <div className="mt-2 divide-y divide-border">
              {menu.variants.map((v) => (
                <div
                  key={comboKey(v.optionIds)}
                  className="flex items-center justify-between gap-3 py-1.5"
                >
                  <span
                    className={cx('text-sm', v.priceSatang === null && 'font-semibold text-danger')}
                  >
                    {rowLabel(v.optionIds)}
                  </span>
                  <BahtBox
                    label={`ราคา ${rowLabel(v.optionIds)}`}
                    value={v.priceSatang}
                    onChange={(s) =>
                      update((m) => ({
                        ...m,
                        variants: m.variants.map((x) =>
                          comboKey(x.optionIds) === comboKey(v.optionIds)
                            ? { ...x, priceSatang: s }
                            : x,
                        ),
                      }))
                    }
                  />
                </div>
              ))}
            </div>
          </>
        ) : tiered ? (
          <>
            <p className="text-xs text-muted">
              ราคาเมื่อลูกค้าเลือกจาก “{tiered.name || '…'}” ตามจำนวน
            </p>
            {Array.from(
              { length: Math.max(0, tiered.maxSelect - Math.max(1, tiered.minSelect) + 1) },
              (_, i) => Math.max(1, tiered.minSelect) + i,
            ).map((n) => (
              <div key={n} className="flex items-center justify-between gap-3 py-1.5">
                <span className="text-sm">{n} อย่าง</span>
                <BahtBox
                  label={`ราคา ${n} อย่าง`}
                  value={tiered.tierPrices.find((t) => t.selectedCount === n)?.priceSatang ?? null}
                  onChange={(s) =>
                    patchGroup(tiered.id, (x) => ({
                      ...x,
                      tierPrices: [
                        ...x.tierPrices.filter((t) => t.selectedCount !== n),
                        ...(s === null ? [] : [{ selectedCount: n, priceSatang: s }]),
                      ],
                    }))
                  }
                />
              </div>
            ))}
          </>
        ) : (
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="text-sm">ราคาเมนู</span>
            <BahtBox
              label="ราคาเมนู"
              value={menu.basePriceSatang}
              onChange={(s) => update((m) => ({ ...m, basePriceSatang: s }))}
            />
          </div>
        )}
      </section>

      {/* Issues */}
      {issues.length > 0 && (
        <section
          className="mt-4 rounded-2xl border border-warning/40 bg-warning-soft px-4 py-3"
          aria-label="ต้องแก้ก่อนเปิดขาย"
        >
          <h2 className="font-bold text-warning">
            ต้องแก้{errors.length ? 'ก่อนบันทึก' : 'ก่อนเปิดขาย'}
          </h2>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-warning">
            {[...errors, ...blocks].map((i, k) => (
              <li key={k} className={i.severity === 'error' ? 'font-semibold' : undefined}>
                {i.message}
              </li>
            ))}
          </ul>
        </section>
      )}

      {message && (
        <p
          role="status"
          className={cx(
            'mt-4 rounded-xl px-4 py-3 font-semibold',
            message.ok ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger',
          )}
        >
          {message.text}
          {message.list && (
            <span className="block text-sm font-normal">{message.list.join(' · ')}</span>
          )}
        </p>
      )}

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-2 px-4 py-3">
          {!isNew && (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className={cx(btnSecondary, 'min-h-12 border-danger/40 text-danger')}
            >
              ลบเมนู
            </button>
          )}
          <button
            type="button"
            disabled={hasErrors(issues) || (!sellable && blocks.length > 0 && false)}
            onClick={() => setPreview(true)}
            className={cx(btnSecondary, 'ml-auto min-h-12')}
          >
            ดูตัวอย่างที่ลูกค้าเห็น
          </button>
          <button
            type="button"
            disabled={busy || errors.length > 0}
            onClick={save}
            className={cx(btnPrimary, 'min-h-12')}
          >
            {busy ? 'กำลังบันทึก…' : 'บันทึกเมนู'}
          </button>
        </div>
      </div>

      {confirmDelete && (
        <div
          role="alertdialog"
          aria-label="ยืนยันลบเมนู"
          className="fixed inset-0 z-40 flex items-center justify-center bg-ink/60 p-4"
        >
          <div className="w-full max-w-sm rounded-3xl bg-surface p-6">
            <h2 className="text-lg font-bold">ลบเมนู “{menu.name}”?</h2>
            <p className="mt-2 text-sm text-muted">
              ถ้ามีคนเคยสั่งเมนูนี้แล้ว เมนูจะถูกซ่อน (ประวัติยังอยู่) ถ้ายังไม่มี จะถูกลบถาวร
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className={cx(btnSecondary, 'min-h-12')}
              >
                ไม่ลบ
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={remove}
                className="min-h-12 rounded-xl bg-danger font-semibold text-white"
              >
                ลบเมนู
              </button>
            </div>
          </div>
        </div>
      )}

      {preview && (
        <CustomizeSheet
          menu={{ ...menu, isAvailable: true }}
          ingredients={ingredientMap(ingredients.map((i) => ({ ...i, isAvailable: true })))}
          allowItemNote
          preview
          onClose={() => setPreview(false)}
          onAdd={() => setPreview(false)}
        />
      )}
    </main>
  );
}
