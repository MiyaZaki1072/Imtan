'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { replaceCart } from '@/lib/cart-store';
import { formatBaht, TIME_ZONE, waitMinutes } from '@/lib/format';
import { actReorder } from '@/lib/orders/actions';
import type { HistoryEntry } from '@/lib/orders/types';
import { btnPrimary, card, cx } from './ui';

const dayFormat = new Intl.DateTimeFormat('th-TH', {
  timeZone: TIME_ZONE,
  day: 'numeric',
  month: 'short',
});
const dayKey = (iso: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(new Date(iso));

function dayLabel(iso: string): string {
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86_400_000);
  const key = dayKey(iso);
  if (key === dayKey(today.toISOString())) return 'วันนี้';
  if (key === dayKey(yesterday.toISOString())) return 'เมื่อวาน';
  return dayFormat.format(new Date(iso));
}

/** Past orders with "สั่งอีก". Give `entries`, or `limit` to load them. */
export function HistoryList({
  entries: given,
  limit = 10,
}: {
  entries?: HistoryEntry[];
  limit?: number;
}) {
  const router = useRouter();
  const [loaded, setLoaded] = useState<HistoryEntry[] | null>(given ?? null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (given) return;
    let alive = true;
    fetch(`/api/history?limit=${limit}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: HistoryEntry[]) => alive && setLoaded(d))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [given, limit]);

  async function reorder(entry: HistoryEntry) {
    setBusy(entry.orderId);
    setNotice(null);
    const r = await actReorder(entry.orderId).catch(() => null);
    setBusy(null);
    if (!r?.ok) {
      setNotice(
        r?.error === 'shop_closed'
          ? 'ร้านปิดรับออเดอร์ชั่วคราว'
          : 'สั่งอีกไม่สำเร็จ ลองใหม่อีกครั้ง',
      );
      return;
    }
    if (r.lines.length === 0) {
      setNotice(`เมนูเหล่านี้ไม่มีขายแล้ว: ${r.dropped.join(', ')}`);
      return;
    }
    replaceCart(r.shopSlug, r.lines);
    const dropped = r.dropped.length ? `?dropped=${encodeURIComponent(r.dropped.join(', '))}` : '';
    router.push(`/s/${r.shopSlug}/cart${dropped}`);
  }

  if (failed) {
    return (
      <p
        role="alert"
        className="rounded-xl bg-danger-soft px-4 py-3 text-sm font-semibold text-danger"
      >
        โหลดประวัติไม่สำเร็จ ลองรีเฟรชหน้านี้
      </p>
    );
  }
  if (loaded === null) return <p className="text-muted">กำลังโหลดประวัติ…</p>;
  if (loaded.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border px-4 py-8 text-center">
        <p className="font-semibold">ยังไม่มีประวัติการสั่ง</p>
        <p className="mt-1 text-sm text-muted">
          ออเดอร์ที่รับแล้วจะมาอยู่ที่นี่ สั่งอีกได้ในแตะเดียว
        </p>
        <Link href="/" className={cx(btnPrimary, 'mt-4 min-h-12')}>
          ดูคิวทุกร้าน
        </Link>
      </div>
    );
  }

  const rows = loaded.map((e, i) => {
    const label = dayLabel(e.createdAt);
    return { e, heading: i === 0 || label !== dayLabel(loaded[i - 1].createdAt) ? label : null };
  });
  return (
    <div>
      {notice && (
        <p
          role="status"
          className="mb-3 rounded-xl bg-warning-soft px-4 py-3 text-sm font-semibold text-warning"
        >
          {notice}
        </p>
      )}
      <ul className="space-y-2.5">
        {rows.map(({ e, heading }) => {
          return (
            <li key={e.orderId}>
              {heading && (
                <h3 className="mt-3 mb-1.5 text-sm font-bold text-muted first:mt-0">{heading}</h3>
              )}
              <div className={cx(card, 'flex items-start gap-3 px-4 py-3')}>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {e.items
                      .map(
                        (i) => `${i.kitchenSummary.split(' / ').slice(0, 2).join(' ')} × ${i.qty}`,
                      )
                      .join(', ') || 'ออเดอร์'}
                  </p>
                  <p className="mt-0.5 text-sm text-muted">
                    {e.shopName}
                    {e.status === 'cancelled'
                      ? ' · ร้านยกเลิก'
                      : e.actualWaitSeconds !== null
                        ? ` · รอ ${waitMinutes(e.actualWaitSeconds)} นาที`
                        : ''}
                    {e.totalSatang !== null && ` · ${formatBaht(e.totalSatang)}`}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy === e.orderId}
                  onClick={() => reorder(e)}
                  className="min-h-11 shrink-0 rounded-lg px-2 text-sm font-semibold text-primary underline disabled:opacity-50"
                >
                  {busy === e.orderId ? 'กำลังโหลด…' : 'สั่งอีก'}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
