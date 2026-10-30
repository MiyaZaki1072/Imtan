'use client';

import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import { OfflineBanner } from '@/components/OfflineBanner';
import { PauseIcon, PlusIcon } from '@/components/icons';
import { Stepper } from '@/components/Stepper';
import { VendorOrderCard } from '@/components/VendorOrderCard';
import { btnPrimary, btnSecondary, cx } from '@/components/ui';
import { playChime, useArmAudio, useWakeLock } from '@/lib/alert';
import { waitMinutes } from '@/lib/format';
import { isScheduled } from '@/lib/orders/preorder';
import { actSimulateOrder } from '@/lib/admin/actions';
import { useLiveData } from '@/lib/use-live-data';
import {
  actAddQuickWalkIn,
  actRecallOrder,
  actSetOrderStatus,
  actUpdateShopSettings,
} from '@/lib/vendor/actions';
import type { VendorBoardData, VendorOrder, VendorOrderStatus } from '@/lib/vendor/types';

const COLUMNS: { status: VendorOrderStatus; title: string; badge: string }[] = [
  { status: 'queued', title: 'รอทำ', badge: 'bg-bg text-ink' },
  { status: 'cooking', title: 'กำลังทำ', badge: 'bg-warning-soft text-warning' },
  { status: 'ready', title: 'พร้อมรับ (แจ้งแล้ว)', badge: 'bg-success-soft text-success' },
];

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('button, input')?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <button
        type="button"
        tabIndex={-1}
        aria-label="ปิด"
        onClick={onClose}
        className="absolute inset-0 bg-ink/60"
      />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-md rounded-3xl bg-surface p-6"
      >
        <h2 id={titleId} className="text-xl font-bold">
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}

export function VendorBoard({
  initial,
  interview = false,
}: {
  initial: VendorBoardData;
  interview?: boolean;
}) {
  const shopId = initial.shopId;
  const {
    data: board,
    offline,
    fetchedAt,
    refresh,
  } = useLiveData(
    `/api/vendor/board?shopId=${shopId}`,
    initial,
    [
      { table: 'orders', filter: `shop_id=eq.${shopId}` },
      { table: 'shops', filter: `id=eq.${shopId}` },
    ],
    `vendor:${shopId}`,
    10000,
  );

  const [busyId, setBusyId] = useState<string | null>(null);
  const [walkIn, setWalkIn] = useState<{ dishes: number; added: string | null } | null>(null);
  const [cancelling, setCancelling] = useState<VendorOrder | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useArmAudio();
  useWakeLock(true);

  // A chime for each new order that arrives after the board opened.
  const seen = useRef(new Set(initial.orders.map((o) => o.id)));
  useEffect(() => {
    let fresh = false;
    for (const o of board.orders) {
      if (!seen.current.has(o.id)) {
        seen.current.add(o.id);
        if (o.source === 'app') fresh = true;
      }
    }
    if (fresh) playChime();
  }, [board.orders]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2500);
    return () => window.clearTimeout(t);
  }, [toast]);

  // Server time, advanced by the device clock between fetches.
  const [nowMs, setNowMs] = useState<number | null>(null);
  useEffect(() => {
    const t = window.setInterval(() => setNowMs(Date.now()), 20_000);
    return () => window.clearInterval(t);
  }, []);
  const serverNow =
    Date.parse(board.serverNow) + (nowMs === null ? 0 : Math.max(0, nowMs - fetchedAt));

  async function run(order: VendorOrder, fn: () => Promise<{ ok: boolean }>, done?: string) {
    setBusyId(order.id);
    try {
      const result = await fn();
      if (done && result.ok) setToast(done);
      if (!result.ok) setToast('ทำรายการไม่ได้ ออเดอร์อาจเปลี่ยนไปแล้ว');
    } catch {
      setToast('ทำรายการไม่ได้ ลองใหม่อีกครั้ง');
    }
    refresh();
    setBusyId(null);
  }

  // Pre-orders that are not released yet wait at the bottom of รอทำ.
  const scheduledIds = new Set(
    board.orders
      .filter((o) => o.status === 'queued' && isScheduled(o.releaseAt, new Date(serverNow)))
      .map((o) => o.id),
  );
  const orders = [...board.orders].sort((a, b) => {
    const sa = scheduledIds.has(a.id);
    const sb = scheduledIds.has(b.id);
    if (sa !== sb) return sa ? 1 : -1;
    return sa
      ? Date.parse(a.releaseAt ?? '') - Date.parse(b.releaseAt ?? '')
      : a.queueNo - b.queueNo;
  });
  const repeats = new Map<string, { qty: number; labels: string[] }>();
  for (const o of orders.filter((x) => x.status === 'queued' && !scheduledIds.has(x.id))) {
    for (const it of o.items) {
      const r = repeats.get(it.kitchenSummary) ?? { qty: 0, labels: [] };
      r.qty += it.qty;
      r.labels.push(o.queueLabel);
      repeats.set(it.kitchenSummary, r);
    }
  }
  const repeatRows = [...repeats.entries()].filter(([, r]) => r.labels.length > 1);

  async function addWalkIn() {
    if (!walkIn) return;
    const result = await actAddQuickWalkIn(shopId, walkIn.dishes);
    if (result.ok) {
      setWalkIn({ ...walkIn, added: result.label });
      refresh();
    } else {
      setToast('เพิ่มคิวไม่สำเร็จ ลองใหม่อีกครั้ง');
    }
  }

  async function sampleOrder() {
    const result = await actSimulateOrder(shopId).catch(() => ({ ok: false as const }));
    setToast(result.ok ? 'สร้างออเดอร์ตัวอย่างแล้ว' : 'สร้างออเดอร์ตัวอย่างไม่สำเร็จ');
    refresh();
  }

  async function togglePause() {
    const result = await actUpdateShopSettings(shopId, { is_open: !board.isOpen });
    setToast(
      result.ok
        ? board.isOpen
          ? 'ปิดรับออเดอร์ใหม่แล้ว'
          : 'เปิดรับออเดอร์แล้ว'
        : 'ทำรายการไม่ได้',
    );
    refresh();
  }

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 pt-4 pb-10">
      {interview && (
        <p className="mb-3 rounded-xl bg-info-soft px-4 py-2.5 text-center text-sm font-semibold text-info-ink">
          โหมดสาธิต — ออเดอร์ที่เห็นเป็นตัวอย่าง ไม่มีการตัดเงินจริง
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <p className="mr-auto text-sm text-muted">
          รอทำ {board.itemsInQueue} จาน · ทำเสร็จเฉลี่ย {waitMinutes(board.secondsPerItem)} นาที/จาน
          ({board.waitMode === 'auto' ? 'ระบบคำนวณจากปุ่มที่กด' : 'ตั้งเอง'})
        </p>
        <button
          type="button"
          onClick={() => setWalkIn({ dishes: 1, added: null })}
          className={cx(btnPrimary, 'min-h-12')}
        >
          <PlusIcon size={20} />1 คิวหน้าร้าน
        </button>
        <Link href="/vendor/walk-in" className={cx(btnSecondary, 'min-h-12')}>
          สั่งหน้าร้าน (เลือกเมนู)
        </Link>
        <button
          type="button"
          aria-pressed={!board.isOpen}
          onClick={togglePause}
          className={cx(
            btnSecondary,
            'min-h-12',
            board.isOpen ? 'border-danger/40 text-danger' : 'border-success text-success',
          )}
        >
          <PauseIcon size={18} />
          {board.isOpen ? 'ปิดรับชั่วคราว' : 'เปิดรับออเดอร์'}
        </button>
      </div>
      {offline && <OfflineBanner />}

      {!board.isOpen && (
        <p className="mt-3 rounded-xl bg-danger-soft px-4 py-3 font-semibold text-danger">
          ปิดรับออเดอร์ใหม่ชั่วคราว · ออเดอร์ที่จ่ายแล้วยังอยู่บนกระดาน
        </p>
      )}

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {COLUMNS.map((col) => {
          const list = orders.filter((o) => o.status === col.status);
          return (
            <section
              key={col.status}
              aria-labelledby={`col-${col.status}`}
              className="rounded-2xl border border-border bg-bg/60 p-3"
            >
              <div className="mb-3 flex items-center justify-between px-1">
                <h2 id={`col-${col.status}`} className="text-lg font-bold">
                  {col.title}
                </h2>
                <span className={cx('rounded-full px-2.5 py-0.5 text-sm font-bold', col.badge)}>
                  {list.length}
                </span>
              </div>
              {col.status === 'queued' &&
                repeatRows.map(([summary, r]) => (
                  <p
                    key={summary}
                    className="mb-3 rounded-xl border border-warning/40 bg-warning-soft px-3 py-2 text-sm font-semibold text-warning"
                  >
                    รวมเมนูซ้ำ: {summary} × {r.qty} ({r.labels.join(', ')}) ทำพร้อมกันได้
                  </p>
                ))}
              <div className="space-y-3">
                {list.length === 0 && (
                  <p className="px-1 py-6 text-center text-sm text-muted">ไม่มีออเดอร์</p>
                )}
                {list.map((o) => (
                  <VendorOrderCard
                    key={o.id}
                    order={o}
                    busy={busyId === o.id}
                    scheduled={scheduledIds.has(o.id)}
                    minutesSinceReady={
                      o.readyAt
                        ? Math.max(0, Math.round((serverNow - Date.parse(o.readyAt)) / 60000))
                        : null
                    }
                    onStart={() => run(o, () => actSetOrderStatus(shopId, o.id, 'cooking'))}
                    onReady={() =>
                      run(
                        o,
                        () => actSetOrderStatus(shopId, o.id, 'ready'),
                        `แจ้ง ${o.queueLabel} แล้ว`,
                      )
                    }
                    onPickedUp={() => run(o, () => actSetOrderStatus(shopId, o.id, 'picked_up'))}
                    onRecall={() =>
                      run(o, () => actRecallOrder(shopId, o.id), `เรียกซ้ำ ${o.queueLabel} แล้ว`)
                    }
                    onCancel={() => setCancelling(o)}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {walkIn && (
        <Modal title="+1 คิวหน้าร้าน" onClose={() => setWalkIn(null)}>
          {walkIn.added ? (
            <>
              <p className="mt-2 text-muted">บอกลูกค้าให้รอฟังเรียกเลขนี้</p>
              <p className="my-4 text-center text-6xl leading-[1.35] font-bold text-primary">
                {walkIn.added}
              </p>
              <button
                type="button"
                onClick={() => setWalkIn(null)}
                className={cx(btnPrimary, 'min-h-12 w-full')}
              >
                เสร็จ
              </button>
            </>
          ) : (
            <>
              <p className="mt-1 text-sm text-muted">
                สำหรับลูกค้าที่ไม่ได้สั่งผ่านมือถือ ให้อยู่ในลำดับคิวเดียวกัน
              </p>
              <div className="mt-5 flex items-center justify-between">
                <span className="font-semibold">จำนวนจาน</span>
                <Stepper
                  value={walkIn.dishes}
                  onChange={(d) => setWalkIn({ ...walkIn, dishes: d })}
                  max={20}
                  size="lg"
                  label="จำนวนจาน"
                />
              </div>
              <div className="mt-6 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setWalkIn(null)}
                  className={cx(btnSecondary, 'min-h-12')}
                >
                  ยกเลิก
                </button>
                <button type="button" onClick={addWalkIn} className={cx(btnPrimary, 'min-h-12')}>
                  เพิ่มเข้าคิว
                </button>
              </div>
            </>
          )}
        </Modal>
      )}

      {cancelling && (
        <Modal
          title={`ยกเลิกออเดอร์ ${cancelling.queueLabel}?`}
          onClose={() => setCancelling(null)}
        >
          <p className="mt-2 text-muted">
            ระบบจะบันทึกการคืนเงิน (จำลอง) ให้ลูกค้า {cancelling.customerName} ทำย้อนกลับไม่ได้
          </p>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setCancelling(null)}
              className={cx(btnSecondary, 'min-h-12')}
            >
              ไม่ยกเลิก
            </button>
            <button
              type="button"
              onClick={() => {
                const o = cancelling;
                setCancelling(null);
                void run(
                  o,
                  () => actSetOrderStatus(shopId, o.id, 'cancelled', 'ร้านยกเลิก'),
                  `ยกเลิก ${o.queueLabel} และบันทึกการคืนเงินแล้ว`,
                );
              }}
              className="min-h-12 rounded-xl bg-danger font-semibold text-white"
            >
              ยกเลิก + คืนเงิน
            </button>
          </div>
        </Modal>
      )}

      {interview && (
        <button
          type="button"
          onClick={sampleOrder}
          className={cx(btnPrimary, 'fixed right-6 bottom-6 z-30 min-h-14 px-6 shadow-lg')}
        >
          สร้างออเดอร์ตัวอย่าง
        </button>
      )}

      <p
        role="status"
        className={cx(
          'fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-ink px-5 py-3 font-semibold text-white transition-opacity',
          toast ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      >
        {toast}
      </p>
    </main>
  );
}
