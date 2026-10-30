'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { BackLink } from '@/components/BackLink';
import { DemoBanner } from '@/components/DemoBanner';
import { PayCard } from '@/components/PayCard';
import { btnLarge, btnPrimary, btnSecondary, card, cx } from '@/components/ui';

const PAY_SECONDS = 5 * 60;
const VERIFY_MS = 2000;

export function PayView({
  orderId,
  shopSlug,
  shopName,
  amountSatang,
  items,
}: {
  orderId: string;
  shopSlug: string;
  shopName: string;
  amountSatang: number;
  items: string[];
}) {
  const router = useRouter();
  const [secondsLeft, setSecondsLeft] = useState(PAY_SECONDS);
  const [verifying, setVerifying] = useState(false);
  const expired = secondsLeft === 0;

  useEffect(() => {
    const started = Date.now();
    const timer = window.setInterval(() => {
      const left = Math.max(0, PAY_SECONDS - Math.floor((Date.now() - started) / 1000));
      setSecondsLeft(left);
      if (left === 0) window.clearInterval(timer);
    }, 250);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!verifying) return;
    // Phase 4: the server calls confirm_payment(order, 'demo'); this page follows its own order.
    const t = window.setTimeout(() => router.push(`/orders/${orderId}?paid=1`), VERIFY_MS);
    return () => window.clearTimeout(t);
  }, [verifying, orderId, router]);

  return (
    <main className="flex-1 px-4 pt-3 pb-8">
      <BackLink href={`/s/${shopSlug}/cart`}>กลับไปที่ตะกร้า</BackLink>
      <h1 className="mt-1 text-2xl font-bold">ชำระเงิน</h1>
      <DemoBanner className="mt-3" />

      <div className="mt-4">
        <PayCard
          amountSatang={amountSatang}
          shopName={shopName}
          secondsLeft={secondsLeft}
          expired={expired}
        />
      </div>

      <section className={cx(card, 'mt-3 px-4 py-3')} aria-label="รายการที่สั่ง">
        <p className="text-xs text-muted">รายการที่สั่ง</p>
        <ul className="mt-1 space-y-0.5 text-sm">
          {items.map((it) => (
            <li key={it}>{it}</li>
          ))}
        </ul>
      </section>

      <div className="mt-5 space-y-2.5">
        {expired ? (
          <>
            <p
              role="alert"
              className="rounded-xl bg-danger-soft px-4 py-3 font-semibold text-danger"
            >
              หมดเวลาชำระเงิน ออเดอร์นี้ไม่ได้รับเลขคิว
            </p>
            <Link href={`/s/${shopSlug}/cart`} className={cx(btnPrimary, btnLarge)}>
              กลับไปสั่งใหม่
            </Link>
          </>
        ) : (
          <>
            <button
              type="button"
              disabled={verifying}
              onClick={() => setVerifying(true)}
              className={cx(btnPrimary, btnLarge)}
            >
              {verifying ? 'กำลังตรวจสอบการโอน…' : 'ชำระเงิน (จำลอง)'}
            </button>
            <p className="text-center text-sm text-muted">
              ได้เลขคิวทันทีหลังชำระเงิน · ร้านไม่ต้องกดยืนยัน
            </p>
            {!verifying && (
              <Link href={`/s/${shopSlug}/cart`} className={cx(btnSecondary, 'w-full')}>
                ยกเลิก (ยังไม่ได้ชำระเงิน)
              </Link>
            )}
          </>
        )}
      </div>
    </main>
  );
}
