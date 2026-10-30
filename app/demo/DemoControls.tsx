'use client';

import { useRef, useState } from 'react';
import { btnPrimary, btnSecondary, card, cx } from '@/components/ui';
import {
  actResetDemo,
  actSetAdminShop,
  actSetAutoAdvance,
  actSimulateOrder,
} from '@/lib/admin/actions';

interface ShopOption {
  id: string;
  slug: string;
  name: string;
  autoAdvance: boolean;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Presenter controls (PLAN.md §5d): shop picker, simulate rush, auto-advance, reset. */
export function DemoControls({
  shops,
  currentSlug,
  onShopChange,
}: {
  shops: ShopOption[];
  currentSlug: string;
  /** Reload the vendor board and customer frames after a shop change or a reset. */
  onShopChange: () => void;
}) {
  const [slug, setSlug] = useState(currentSlug);
  const [target, setTarget] = useState<'shop' | 'all'>('shop');
  const [count, setCount] = useState(10);
  const [seconds, setSeconds] = useState(100);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [autoOn, setAutoOn] = useState(() => new Map(shops.map((s) => [s.slug, s.autoAdvance])));
  const [confirmReset, setConfirmReset] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const stop = useRef(false);

  const targets = target === 'all' ? shops : shops.filter((s) => s.slug === slug);
  const auto = targets.length > 0 && targets.every((s) => autoOn.get(s.slug));

  async function pickShop(next: string) {
    setSlug(next);
    const r = await actSetAdminShop(next);
    setMessage(r.ok ? null : 'เปลี่ยนร้านไม่สำเร็จ');
    onShopChange();
  }

  async function rush() {
    stop.current = false;
    setMessage(null);
    const total = count;
    setProgress({ done: 0, total });
    const gap = total > 1 ? (seconds * 1000) / (total - 1) : 0;
    let failed = 0;
    for (let i = 0; i < total && !stop.current; i++) {
      // Orders arrive spread out, round-robin over the chosen shops.
      const shop = targets[i % targets.length];
      const r = await actSimulateOrder(shop.id).catch(() => ({ ok: false }));
      if (!r.ok) failed++;
      setProgress({ done: i + 1, total });
      if (i < total - 1 && gap > 0) await sleep(gap);
    }
    setProgress(null);
    setMessage(
      failed
        ? `สร้างไม่สำเร็จ ${failed} ออเดอร์`
        : stop.current
          ? 'หยุดแล้ว'
          : 'สร้างออเดอร์ครบแล้ว',
    );
  }

  async function toggleAuto() {
    const next = !auto;
    const r = await actSetAutoAdvance(target === 'all' ? 'all' : slug, next);
    if (r.ok)
      setAutoOn(
        new Map(
          shops.map((s) => [
            s.slug,
            targets.some((t) => t.slug === s.slug) ? next : (autoOn.get(s.slug) ?? false),
          ]),
        ),
      );
    setMessage(
      r.ok
        ? next
          ? 'เปิดเดินคิวอัตโนมัติ (ทุกนาที)'
          : 'ปิดเดินคิวอัตโนมัติ'
        : 'ทำรายการไม่สำเร็จ',
    );
  }

  async function reset() {
    setConfirmReset(false);
    const r = await actResetDemo(target === 'all' ? 'all' : slug);
    setMessage(r.ok ? 'รีเซ็ตแล้ว: ราคา ของหมด และเลขคิวกลับเป็นค่าตั้งต้น' : 'รีเซ็ตไม่สำเร็จ');
    if (r.ok) {
      setAutoOn(
        new Map(
          shops.map((s) => [
            s.slug,
            targets.some((t) => t.slug === s.slug) ? false : (autoOn.get(s.slug) ?? false),
          ]),
        ),
      );
      onShopChange();
    }
  }

  const field = 'min-h-12 rounded-xl border border-border bg-surface px-3';
  return (
    <section className={cx(card, 'space-y-4 px-4 py-4')}>
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold">ร้านบนกระดานแม่ค้า</span>
        <select
          value={slug}
          onChange={(e) => pickShop(e.target.value)}
          className={cx(field, 'w-full')}
        >
          {shops.map((s) => (
            <option key={s.slug} value={s.slug}>
              {s.name}
            </option>
          ))}
        </select>
      </label>

      <fieldset>
        <legend className="mb-1.5 text-sm font-semibold">ใช้เครื่องมือกับ</legend>
        <div className="grid grid-cols-2 gap-2">
          {(['shop', 'all'] as const).map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={target === t}
              onClick={() => setTarget(t)}
              className={cx(
                'min-h-12 rounded-xl border text-sm font-semibold',
                target === t
                  ? 'border-primary bg-primary-soft text-primary-hover'
                  : 'border-border',
              )}
            >
              {t === 'shop' ? 'ร้านที่เลือก' : 'ทุกร้าน'}
            </button>
          ))}
        </div>
      </fieldset>

      <div>
        <p className="mb-1.5 text-sm font-semibold">จำลองช่วงพีค</p>
        <div className="flex items-center gap-2 text-sm">
          <input
            aria-label="จำนวนออเดอร์"
            inputMode="numeric"
            className={cx(field, 'w-20 text-center')}
            value={count}
            onChange={(e) =>
              setCount(Math.min(60, Math.max(1, Number(e.target.value.replace(/\D/g, '')) || 1)))
            }
          />
          ออเดอร์ ภายใน
          <input
            aria-label="วินาที"
            inputMode="numeric"
            className={cx(field, 'w-20 text-center')}
            value={seconds}
            onChange={(e) =>
              setSeconds(Math.min(600, Number(e.target.value.replace(/\D/g, '')) || 0))
            }
          />
          วินาที
        </div>
        {progress ? (
          <div className="mt-2 grid grid-cols-[1fr_auto] items-center gap-2">
            <div
              className="h-3 overflow-hidden rounded-full bg-bg"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={progress.total}
              aria-valuenow={progress.done}
            >
              <div
                className="h-full bg-primary"
                style={{ width: `${(progress.done / progress.total) * 100}%` }}
              />
            </div>
            <button
              type="button"
              onClick={() => (stop.current = true)}
              className={cx(btnSecondary, 'min-h-12')}
            >
              หยุด {progress.done}/{progress.total}
            </button>
          </div>
        ) : (
          <button type="button" onClick={rush} className={cx(btnPrimary, 'mt-2 min-h-12 w-full')}>
            จำลองช่วงพีค ({count} ออเดอร์)
          </button>
        )}
      </div>

      <button
        type="button"
        aria-pressed={auto}
        onClick={toggleAuto}
        className={cx(btnSecondary, 'min-h-12 w-full', auto && 'border-success text-success')}
      >
        เดินคิวอัตโนมัติ: {auto ? 'เปิด' : 'ปิด'}
      </button>

      {confirmReset ? (
        <div
          role="alertdialog"
          aria-label="ยืนยันรีเซ็ต"
          className="rounded-xl border border-danger/40 bg-danger-soft p-3"
        >
          <p className="text-sm font-semibold text-danger">
            รีเซ็ต {target === 'all' ? 'ทุกร้าน' : 'ร้านนี้'}? ออเดอร์วันนี้จะถูกลบ
            ราคาและของหมดกลับเป็นค่าตั้งต้น
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setConfirmReset(false)}
              className={cx(btnSecondary, 'min-h-12')}
            >
              ไม่รีเซ็ต
            </button>
            <button
              type="button"
              onClick={reset}
              className="min-h-12 rounded-xl bg-danger font-semibold text-white"
            >
              รีเซ็ตเลย
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirmReset(true)}
          className={cx(btnSecondary, 'min-h-12 w-full border-danger/40 text-danger')}
        >
          รีเซ็ตเดโม
        </button>
      )}

      <p role="status" className="min-h-5 text-sm text-muted">
        {message}
      </p>
    </section>
  );
}
