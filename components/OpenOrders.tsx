'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { formatClock, formatWaitRange } from '@/lib/format';
import type { HomeMine, OrderStatus } from '@/lib/orders/types';
import { card, cx } from './ui';

const PILL: Partial<Record<OrderStatus, { text: string; cls: string }>> = {
  awaiting_payment: { text: 'รอชำระเงิน', cls: 'bg-info-soft text-info-ink' },
  queued: { text: 'อยู่ในคิว', cls: 'bg-warning-soft text-warning' },
  cooking: { text: 'กำลังทำ', cls: 'bg-warning-soft text-warning' },
  ready: { text: 'พร้อมรับ', cls: 'bg-success text-white' },
};

const SEEN_KEY = 'imtan:ready-opened';

/** Record that the ready alert for this order was shown, so Home doesn't reopen it. */
export function markReadyOpened(id: string) {
  const seen = seenIds();
  if (seen.includes(id)) return;
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen.slice(-20), id]));
  } catch {
    // Without storage the alert may open again later; that is acceptable.
  }
}

function seenIds(): string[] {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
}

/**
 * Opens the full-screen ready alert (`/orders/[id]`) once per order when any open order
 * turns ready. Only mounted on Home and the order list, so checkout is never interrupted.
 */
export function useReadyAutoOpen(orders: HomeMine[]) {
  const router = useRouter();
  const readyId = orders.find((o) => o.status === 'ready')?.orderId;
  useEffect(() => {
    if (!readyId) return;
    if (seenIds().includes(readyId)) return;
    markReadyOpened(readyId);
    router.push(`/orders/${readyId}`);
  }, [readyId, router]);
}

export function OpenOrderCard({ o, showTitle = true }: { o: HomeMine; showTitle?: boolean }) {
  const pill = PILL[o.status];
  return (
    <Link
      href={o.status === 'awaiting_payment' ? `/orders/${o.orderId}/pay` : `/orders/${o.orderId}`}
      className={cx(card, 'flex items-center gap-3 px-4 py-4 hover:border-primary/40')}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs text-muted">
          {showTitle ? 'คิวของฉัน · ' : ''}
          {o.shopName}
        </span>
        <span className="mt-0.5 block text-xl font-bold">{o.queueLabel ?? 'รอชำระเงิน'}</span>
        <span className="block text-sm text-muted">
          {o.status === 'ready'
            ? 'มารับได้เลย'
            : o.pickupAt
              ? `สั่งล่วงหน้า · รับ ${formatClock(o.pickupAt)} น.`
              : o.waitSeconds !== null
                ? `รออีก ${formatWaitRange(o.waitSeconds)}`
                : o.status === 'awaiting_payment'
                  ? 'ไปชำระเงิน เพื่อรับเลขคิว'
                  : ''}
        </span>
      </span>
      {pill && (
        <span className={cx('shrink-0 rounded-full px-3 py-1 text-sm font-semibold', pill.cls)}>
          {pill.text}
        </span>
      )}
    </Link>
  );
}
