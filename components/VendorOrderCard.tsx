'use client';

import { formatClock } from '@/lib/format';
import type { VendorOrder } from '@/lib/vendor/types';
import { btnSecondary, btnSuccess, btnWarning, cx } from './ui';

const SOURCE: Record<VendorOrder['source'], string> = {
  app: 'สั่งผ่านแอป',
  walk_in_quick: 'หน้าร้าน',
  walk_in_full: 'หน้าร้าน',
  simulated: 'จำลอง',
};

/** Splits a kitchen summary so "ไม่ใส่…" parts stand out in red. */
function Summary({ text }: { text: string }) {
  const parts = text.split(' / ');
  return (
    <span>
      {parts.map((p, i) => (
        <span key={i}>
          {i > 0 && <span className="text-muted"> / </span>}
          <span className={p.startsWith('ไม่ใส่') ? 'font-bold text-danger' : undefined}>{p}</span>
        </span>
      ))}
    </span>
  );
}

const vendorBtn = 'min-h-12 w-full';

export function VendorOrderCard({
  order,
  minutesSinceReady,
  busy,
  onStart,
  onReady,
  onPickedUp,
  onRecall,
  onCancel,
}: {
  order: VendorOrder;
  minutesSinceReady: number | null;
  /** An action for this order is running: buttons wait so a double tap can't fire twice. */
  busy?: boolean;
  onStart: () => void;
  onReady: () => void;
  onPickedUp: () => void;
  onRecall: () => void;
  onCancel: () => void;
}) {
  const late = minutesSinceReady !== null && minutesSinceReady >= 5;
  return (
    <article
      aria-label={`ออเดอร์ ${order.queueLabel}`}
      className={cx(
        'rounded-2xl border px-4 py-3.5',
        order.status === 'ready'
          ? 'border-success/40 bg-success-soft/60'
          : 'border-border bg-surface',
        order.status === 'cooking' && 'border-warning/50',
      )}
    >
      <header className="flex flex-wrap items-baseline justify-between gap-x-2">
        <p className="text-2xl font-bold">
          {order.queueLabel}
          <span className="ml-1.5 text-base font-semibold text-muted">· {order.customerName}</span>
        </p>
        <p className={cx('text-xs', late ? 'font-semibold text-danger' : 'text-muted')}>
          {order.status === 'ready' && minutesSinceReady !== null
            ? late
              ? `ยังไม่มารับ ${minutesSinceReady} นาที`
              : `แจ้งเมื่อ ${minutesSinceReady} นาทีที่แล้ว`
            : order.status === 'cooking' && order.startedAt
              ? `เริ่ม ${formatClock(order.startedAt)}`
              : `${SOURCE[order.source]} · ${formatClock(order.queuedAt)}`}
        </p>
      </header>

      {order.allergyNote && (
        <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-danger px-2.5 py-1 text-sm font-bold text-white">
          แพ้อาหาร: {order.allergyNote}
        </p>
      )}

      {order.items.length > 0 ? (
        <ul className="mt-2 space-y-1.5">
          {order.items.map((it, i) => (
            <li key={i} className="text-lg leading-snug font-semibold">
              <Summary text={it.kitchenSummary} /> <span className="text-primary">× {it.qty}</span>
              {it.note && (
                <span className="mt-1 block rounded-md bg-warning-soft px-2 py-0.5 text-sm font-normal text-warning">
                  หมายเหตุ: {it.note}
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-lg font-semibold">ลูกค้าหน้าร้าน · {order.itemCount} จาน</p>
      )}

      <div className="mt-3 space-y-2">
        {order.status === 'queued' && (
          // "เสร็จแล้ว" is allowed straight from รอทำ (vendors may skip "เริ่มทำ").
          <div className="grid grid-cols-[3fr_2fr] gap-2">
            <button
              type="button"
              onClick={onStart}
              disabled={busy}
              className={cx(btnWarning, vendorBtn)}
            >
              เริ่มทำ
            </button>
            <button
              type="button"
              onClick={onReady}
              disabled={busy}
              className={cx(
                btnSecondary,
                vendorBtn,
                'border-success/50 px-2! whitespace-nowrap text-success',
              )}
            >
              เสร็จแล้ว
            </button>
          </div>
        )}
        {order.status === 'cooking' && (
          <button
            type="button"
            onClick={onReady}
            disabled={busy}
            className={cx(btnSuccess, vendorBtn)}
          >
            เสร็จแล้ว – แจ้งลูกค้า
          </button>
        )}
        {order.status === 'ready' && (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onPickedUp}
              disabled={busy}
              className={cx(
                btnSecondary,
                vendorBtn,
                'border-success px-2! whitespace-nowrap text-success',
              )}
            >
              ลูกค้ารับแล้ว
            </button>
            <button
              type="button"
              onClick={onRecall}
              disabled={busy}
              className={cx(btnSecondary, vendorBtn, 'px-2! whitespace-nowrap')}
            >
              เรียกซ้ำ
            </button>
          </div>
        )}
        {(order.status === 'queued' || order.status === 'cooking') && (
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="ml-auto flex min-h-12 w-fit items-center rounded-xl px-3 text-sm font-semibold text-danger hover:bg-danger-soft"
          >
            ยกเลิก + คืนเงิน
          </button>
        )}
      </div>
    </article>
  );
}
