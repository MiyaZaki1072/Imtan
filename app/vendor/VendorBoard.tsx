'use client';

import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import { PauseIcon, PlusIcon } from '@/components/icons';
import { Stepper } from '@/components/Stepper';
import { VendorOrderCard } from '@/components/VendorOrderCard';
import { btnPrimary, btnSecondary, cx } from '@/components/ui';
import { queueLabel, waitMinutes } from '@/lib/format';
import type { SampleOrder, SampleStatus } from '@/lib/sample';

const COLUMNS: { status: SampleStatus; title: string; badge: string }[] = [
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
  prefix,
  secondsPerItem,
  waitMode,
  initialOrders,
  now,
}: {
  prefix: string;
  secondsPerItem: number;
  waitMode: 'auto' | 'manual';
  initialOrders: SampleOrder[];
  now: string;
}) {
  // Phase 1: actions change local sample state. Phase 5 calls vendor_* server actions.
  const [orders, setOrders] = useState(initialOrders);
  const [paused, setPaused] = useState(false);
  const [walkIn, setWalkIn] = useState<{ dishes: number; added: string | null } | null>(null);
  const [cancelling, setCancelling] = useState<SampleOrder | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const nowMs = new Date(now).getTime();

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2500);
    return () => window.clearTimeout(t);
  }, [toast]);

  const set = (id: string, status: SampleStatus, patch: Partial<SampleOrder> = {}) =>
    setOrders((os) => os.map((o) => (o.id === id ? { ...o, status, ...patch } : o)));

  const open = orders.filter((o) => o.status !== 'picked_up');
  const waiting = open.filter((o) => o.status === 'queued' || o.status === 'cooking');
  const dishes = waiting.reduce((n, o) => n + o.itemCount, 0);

  // "รวมเมนูซ้ำ": identical kitchen summaries waiting in รอทำ.
  const repeats = new Map<string, { qty: number; labels: string[] }>();
  for (const o of open.filter((x) => x.status === 'queued')) {
    for (const it of o.items) {
      const r = repeats.get(it.kitchenSummary) ?? { qty: 0, labels: [] };
      r.qty += it.qty;
      r.labels.push(o.queueLabel);
      repeats.set(it.kitchenSummary, r);
    }
  }
  const repeatRows = [...repeats.entries()].filter(([, r]) => r.labels.length > 1);

  function addWalkIn() {
    if (!walkIn) return;
    // Sample only. Phase 5: add_quick_walk_in() assigns the real number in SQL.
    const queueNo = Math.max(0, ...orders.map((o) => o.queueNo)) + 1;
    const label = queueLabel(prefix, queueNo);
    setOrders((os) => [
      ...os,
      {
        id: `walk-in-${queueNo}`,
        queueNo,
        queueLabel: label,
        customerName: 'ลูกค้าหน้าร้าน',
        source: 'walk_in_quick',
        status: 'queued',
        itemCount: walkIn.dishes,
        totalSatang: null,
        allergyNote: null,
        items: [],
        queuedAt: now,
        startedAt: null,
        readyAt: null,
        pickedUpAt: null,
      },
    ]);
    setWalkIn({ ...walkIn, added: label });
  }

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 pt-4 pb-10">
      <div className="flex flex-wrap items-center gap-3">
        <p className="mr-auto text-sm text-muted">
          รอทำ {dishes} จาน · ทำเสร็จเฉลี่ย {waitMinutes(secondsPerItem)} นาที/จาน (
          {waitMode === 'auto' ? 'ระบบคำนวณจากปุ่มที่กด' : 'ตั้งเอง'})
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
          aria-pressed={paused}
          onClick={() => setPaused((p) => !p)}
          className={cx(
            btnSecondary,
            'min-h-12',
            paused ? 'border-success text-success' : 'border-danger/40 text-danger',
          )}
        >
          <PauseIcon size={18} />
          {paused ? 'เปิดรับออเดอร์' : 'ปิดรับชั่วคราว'}
        </button>
      </div>

      {paused && (
        <p className="mt-3 rounded-xl bg-danger-soft px-4 py-3 font-semibold text-danger">
          ปิดรับออเดอร์ใหม่ชั่วคราว · ออเดอร์ที่จ่ายแล้วยังอยู่บนกระดาน
        </p>
      )}

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {COLUMNS.map((col) => {
          const list = open
            .filter((o) => o.status === col.status)
            .sort((a, b) => a.queueNo - b.queueNo);
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
                    minutesSinceReady={
                      o.readyAt
                        ? Math.max(0, Math.round((nowMs - new Date(o.readyAt).getTime()) / 60000))
                        : null
                    }
                    onStart={() => set(o.id, 'cooking', { startedAt: now })}
                    onReady={() => set(o.id, 'ready', { readyAt: now })}
                    onPickedUp={() => set(o.id, 'picked_up', { pickedUpAt: now })}
                    onRecall={() => setToast(`เรียกซ้ำ ${o.queueLabel} แล้ว`)}
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
              <p className="my-4 text-center text-6xl font-bold text-primary">{walkIn.added}</p>
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
                setOrders((os) => os.filter((o) => o.id !== cancelling.id));
                setToast(`ยกเลิก ${cancelling.queueLabel} และบันทึกการคืนเงินแล้ว`);
                setCancelling(null);
              }}
              className="min-h-12 rounded-xl bg-danger font-semibold text-white"
            >
              ยกเลิก + คืนเงิน
            </button>
          </div>
        </Modal>
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
