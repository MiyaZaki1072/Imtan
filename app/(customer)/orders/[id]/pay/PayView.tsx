'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { BackLink } from '@/components/BackLink';
import { DemoBanner } from '@/components/DemoBanner';
import { PayCard } from '@/components/PayCard';
import { btnLarge, btnPrimary, btnSecondary, card, cx } from '@/components/ui';
import { useCart } from '@/lib/cart-store';
import { abandonOrder, demoPay } from '@/lib/orders/actions';
import type { OrderViewData } from '@/lib/orders/types';
import { secondsUntil } from '@/lib/orders/wait';
import { track } from '@/lib/track';
import { useLiveData } from '@/lib/use-live-data';

const VERIFY_MS = 2000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function PayView({ initial }: { initial: OrderViewData }) {
  const router = useRouter();
  const { data: o, fetchedAt } = useLiveData(
    `/api/orders/${initial.id}`,
    initial,
    [{ table: 'orders', filter: `id=eq.${initial.id}` }],
    `pay:${initial.id}`,
  );
  const { clear } = useCart(o.shopSlug);
  const [verifying, setVerifying] = useState(false);
  const orderId = initial.id;
  useEffect(() => track('pay_viewed', { order: orderId }), [orderId]);
  const [leaving, setLeaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Countdown by the server's clock. Null until the first tick, so the first frame matches the server.
  const [nowMs, setNowMs] = useState<number | null>(null);
  useEffect(() => {
    const t = window.setInterval(() => setNowMs(Date.now()), 250);
    return () => window.clearInterval(t);
  }, []);
  const secondsLeft = o.paymentExpiresAt
    ? secondsUntil(o.paymentExpiresAt, o.serverNow, nowMs ?? fetchedAt, fetchedAt)
    : 0;
  const expired = o.status === 'expired' || (o.status === 'awaiting_payment' && secondsLeft === 0);

  // The page follows its own order: paid, abandoned or expired elsewhere moves it on.
  useEffect(() => {
    if (o.status !== 'awaiting_payment' && o.status !== 'expired' && !verifying && !leaving) {
      router.replace(`/orders/${o.id}${o.status === 'queued' ? '?paid=1' : ''}`);
    }
  }, [o.status, o.id, verifying, leaving, router]);

  async function pay() {
    setVerifying(true);
    setMessage(null);
    // The fake transfer check takes about 2 s; the server confirms and assigns the number.
    const [result] = await Promise.all([demoPay(o.id), sleep(VERIFY_MS)]);
    if (result.ok) {
      clear();
      router.replace(`/orders/${o.id}?paid=1`);
      return;
    }
    setVerifying(false);
    setMessage(
      result.error === 'expired'
        ? 'หมดเวลาชำระเงินแล้ว'
        : result.error === 'unavailable'
          ? 'โหมดทดสอบปิดอยู่'
          : 'ออเดอร์นี้ชำระเงินไม่ได้แล้ว',
    );
    router.refresh();
  }

  async function abandon() {
    setLeaving(true);
    await abandonOrder(o.id);
    router.push(`/s/${o.shopSlug}/cart`);
  }

  return (
    <main className="flex-1 px-4 pt-3 pb-8">
      <BackLink href={`/s/${o.shopSlug}/cart`}>กลับไปที่ตะกร้า</BackLink>
      <h1 className="mt-1 text-2xl font-bold">ชำระเงิน</h1>
      <DemoBanner className="mt-3" />

      <div className="mt-4">
        <PayCard
          amountSatang={o.totalSatang ?? 0}
          shopName={o.shopName}
          secondsLeft={secondsLeft}
          expired={expired}
        />
      </div>

      <section className={cx(card, 'mt-3 px-4 py-3')} aria-label="รายการที่สั่ง">
        <p className="text-xs text-muted">รายการที่สั่ง</p>
        <ul className="mt-1 space-y-0.5 text-sm">
          {o.items.map((it) => (
            <li key={`${it.kitchenSummary}-${it.note}`}>
              {it.kitchenSummary} × {it.qty}
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-5 space-y-2.5">
        {message && (
          <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 font-semibold text-danger">
            {message}
          </p>
        )}
        {expired ? (
          <>
            <p
              role="alert"
              className="rounded-xl bg-danger-soft px-4 py-3 font-semibold text-danger"
            >
              หมดเวลาชำระเงิน ออเดอร์นี้ไม่ได้รับเลขคิว
            </p>
            <Link href={`/s/${o.shopSlug}/cart`} className={cx(btnPrimary, btnLarge)}>
              กลับไปสั่งใหม่
            </Link>
          </>
        ) : (
          <>
            <button
              type="button"
              disabled={verifying}
              onClick={pay}
              className={cx(btnPrimary, btnLarge)}
            >
              {verifying ? 'กำลังตรวจสอบการโอน…' : 'ชำระเงิน (จำลอง)'}
            </button>
            <p className="text-center text-sm text-muted">
              ได้เลขคิวทันทีหลังชำระเงิน · ร้านไม่ต้องกดยืนยัน
            </p>
            {!verifying && (
              <button type="button" onClick={abandon} className={cx(btnSecondary, 'w-full')}>
                ยกเลิก (ยังไม่ได้ชำระเงิน)
              </button>
            )}
          </>
        )}
      </div>
    </main>
  );
}
