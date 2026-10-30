'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { BackLink } from '@/components/BackLink';
import { BottomNav } from '@/components/BottomNav';
import { CheckIcon } from '@/components/icons';
import { OfflineBanner } from '@/components/OfflineBanner';
import { OrderSteps, type OrderStep } from '@/components/OrderSteps';
import { QueueTicket, TicketStat } from '@/components/QueueTicket';
import { ReadyAlert } from '@/components/ReadyAlert';
import { btnLarge, btnPrimary, card, cx } from '@/components/ui';
import { useArmAudio, useWakeLock } from '@/lib/alert';
import { formatBaht, formatClock, waitMinutes } from '@/lib/format';
import { markReceived, submitFeedback } from '@/lib/orders/actions';
import type { OrderViewData, WaitFeedback } from '@/lib/orders/types';
import { remainingWaitSeconds } from '@/lib/orders/wait';
import { useLiveData } from '@/lib/use-live-data';

const FEEDBACK: { value: WaitFeedback; label: string }[] = [
  { value: 'faster', label: 'เร็วกว่าที่บอก' },
  { value: 'accurate', label: 'ตรงตามที่บอก' },
  { value: 'slower', label: 'ช้ากว่าที่บอก' },
];

function steps(o: OrderViewData): OrderStep[] {
  const idx = ['queued', 'cooking', 'ready', 'picked_up'].indexOf(o.status);
  const cooking = idx >= 1;
  return [
    {
      title: 'ชำระเงินแล้ว · ร้านรับออเดอร์',
      detail: o.paidAt ? `${formatClock(o.paidAt)} น.` : '',
      state: 'done',
    },
    {
      title: 'อยู่ในคิว',
      detail:
        idx === 0
          ? 'แม่ค้ากำลังทำคิวก่อนหน้าคุณ'
          : o.queuedAt
            ? `${formatClock(o.queuedAt)} น.`
            : '',
      state: idx === 0 ? 'current' : 'done',
    },
    {
      title: 'กำลังทำอาหารของคุณ',
      detail:
        cooking && o.startedAt
          ? `แม่ค้ากด "เริ่มทำ" เมื่อ ${formatClock(o.startedAt)} น.`
          : 'เมื่อแม่ค้ากด "เริ่มทำ"',
      state: idx === 1 ? 'current' : idx > 1 ? 'done' : 'todo',
    },
    {
      title: 'พร้อมรับ – แจ้งเตือนทันที',
      detail: 'เมื่อแม่ค้ากด "เสร็จแล้ว" มีเสียงและสั่นเตือน',
      state: idx >= 2 ? 'done' : 'todo',
    },
  ];
}

export function OrderView({ initial }: { initial: OrderViewData }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const {
    data: o,
    offline,
    fetchedAt,
    refresh,
  } = useLiveData(
    `/api/orders/${initial.id}`,
    initial,
    [
      { table: 'orders', filter: `id=eq.${initial.id}` },
      { table: 'shops', filter: `id=eq.${initial.shopId}` },
    ],
    `order:${initial.id}`,
  );

  // Server time, advanced by the device clock between fetches (ignores a wrong device clock).
  // Null until the first tick, so server and client render the same first frame.
  const [nowMs, setNowMs] = useState<number | null>(null);
  useEffect(() => {
    const t = window.setInterval(() => setNowMs(Date.now()), 10_000);
    return () => window.clearInterval(t);
  }, []);
  const serverNow = new Date(
    Date.parse(o.serverNow) + (nowMs === null ? 0 : Math.max(0, nowMs - fetchedAt)),
  );

  useArmAudio();
  useWakeLock(o.status === 'queued' || o.status === 'cooking');

  useEffect(() => {
    if (o.status === 'awaiting_payment') router.replace(`/orders/${o.id}/pay`);
  }, [o.status, o.id, router]);

  const items = o.items.map((it) => `${it.kitchenSummary} × ${it.qty}`);
  const wait = remainingWaitSeconds(o, serverNow) ?? 0;
  const readyBy = new Date(serverNow.getTime() + wait * 1000);
  const label = o.queueLabel ?? '';
  const justPaid = params.get('paid') === '1' && o.status === 'queued';

  function received() {
    startTransition(async () => {
      await markReceived(o.id);
      refresh();
    });
  }

  function rate(value: WaitFeedback) {
    startTransition(async () => {
      await submitFeedback(o.id, value);
      refresh();
    });
  }

  if (o.status === 'awaiting_payment') {
    return <p className="px-4 pt-10 text-muted">กำลังไปหน้าชำระเงิน…</p>;
  }

  if (o.status === 'expired' || o.status === 'abandoned' || o.status === 'cancelled') {
    const text =
      o.status === 'expired'
        ? ['หมดเวลาชำระเงิน', 'ออเดอร์นี้ไม่ได้รับเลขคิวและไม่มีการตัดเงิน']
        : o.status === 'abandoned'
          ? ['ยกเลิกออเดอร์แล้ว', 'ยังไม่ได้ชำระเงิน จึงไม่มีการตัดเงิน']
          : ['ร้านยกเลิกออเดอร์', `คิว ${label} · บันทึกการคืนเงิน (จำลอง) แล้ว`];
    return (
      <>
        <main className="flex flex-1 flex-col items-center justify-center px-4 pb-24 text-center">
          <h1 className="text-2xl font-bold">{text[0]}</h1>
          <p className="mt-2 text-muted">{text[1]}</p>
          <Link
            href={o.status === 'cancelled' ? '/' : `/s/${o.shopSlug}/cart`}
            className={cx(btnPrimary, 'mt-6 min-h-12')}
          >
            {o.status === 'cancelled' ? 'กลับหน้าแรก' : 'กลับไปสั่งใหม่'}
          </Link>
        </main>
        <BottomNav />
      </>
    );
  }

  if (justPaid) {
    return (
      <main className="flex flex-1 flex-col bg-primary px-4 pt-10 pb-8 text-white">
        <div className="text-center">
          <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-white text-primary">
            <CheckIcon size={36} strokeWidth={3} />
          </span>
          <h1 className="mt-4 text-3xl font-bold">ชำระเงินแล้ว ได้คิวแล้ว!</h1>
          <p className="mt-1 text-sm text-white/90">
            {o.paidAt && `${formatClock(o.paidAt)} น. · `}ร้านได้รับออเดอร์ของคุณแล้ว
          </p>
        </div>
        <div className="mt-6 rounded-2xl bg-surface px-4 py-5 text-ink">
          <p className="text-center text-sm text-muted">{o.shopName} · เลขคิวของคุณ</p>
          <p className="mt-2 text-center text-6xl leading-[1.35] font-bold text-primary">{label}</p>
          <ul className="mt-3 border-t border-border pt-3 text-sm">
            {items.map((it) => (
              <li key={it}>{it}</li>
            ))}
          </ul>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <TicketStat label="จานก่อนหน้า" value={o.dishesAhead} />
            <TicketStat label="รอประมาณ" value={`${waitMinutes(wait)} นาที`} />
            <TicketStat label="พร้อมราว" value={formatClock(readyBy)} />
          </div>
          <p className="mt-3 text-center text-sm text-muted">
            ชำระเงินแล้ว · {formatBaht(o.totalSatang ?? 0)}
          </p>
        </div>
        <div className="mt-auto space-y-2.5 pt-6">
          <Link
            href="/notifications"
            className={cx(
              btnLarge,
              'inline-flex items-center justify-center rounded-xl bg-white font-bold text-primary',
            )}
          >
            เปิดการแจ้งเตือน เพื่อไม่พลาดคิว
          </Link>
          <button
            type="button"
            onClick={() => router.replace(pathname, { scroll: false })}
            className={cx(btnLarge, 'rounded-xl border-2 border-white/80 font-bold text-white')}
          >
            ดูสถานะคิวของฉัน
          </button>
        </div>
      </main>
    );
  }

  if (o.status === 'ready') {
    return (
      <ReadyAlert
        label={label}
        shopName={o.shopName}
        items={items}
        callKey={o.lastCalledAt ?? ''}
        busy={pending}
        onReceived={received}
      />
    );
  }

  if (o.status === 'picked_up') {
    const waited =
      o.readyAt && o.paidAt
        ? Math.max(0, Math.round((Date.parse(o.readyAt) - Date.parse(o.paidAt)) / 60000))
        : null;
    return (
      <>
        <main className="flex-1 px-4 pt-10 pb-24">
          <h1 className="text-center text-3xl font-bold">รับอาหารแล้ว ขอให้อร่อย!</h1>
          <p className="mt-1 text-center text-muted">
            คิว {label} · {o.shopName}
          </p>
          <section className={cx(card, 'mt-6 px-4 py-4')} aria-label="สรุปเวลาครั้งนี้">
            <h2 className="font-bold">สรุปเวลาครั้งนี้</h2>
            <dl className="mt-2 space-y-2 text-sm">
              {(
                [
                  ['ชำระเงิน', o.paidAt],
                  ['อาหารพร้อม', o.readyAt],
                  ['รับอาหาร', o.pickedUpAt],
                ] as const
              ).map(([k, v]) =>
                v ? (
                  <div key={k} className="flex justify-between">
                    <dt className="text-muted">{k}</dt>
                    <dd>{formatClock(v)} น.</dd>
                  </div>
                ) : null,
              )}
              {waited !== null && (
                <div className="flex justify-between border-t border-border pt-2 font-semibold">
                  <dt>รอจริง</dt>
                  <dd className="text-success">
                    {waited} นาที
                    {o.estimatedWaitSeconds !== null &&
                      ` (แอปประมาณไว้ ${waitMinutes(o.estimatedWaitSeconds)} นาที)`}
                  </dd>
                </div>
              )}
            </dl>
          </section>

          <section className={cx(card, 'mt-3 px-4 py-4')} aria-label="ความแม่นยำของเวลารอ">
            <h2 className="font-bold">เวลารอที่แอปบอก แม่นแค่ไหน?</h2>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {FEEDBACK.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  aria-pressed={o.feedback === f.value}
                  disabled={pending}
                  onClick={() => rate(f.value)}
                  className={cx(
                    'min-h-12 rounded-xl border px-2 text-sm',
                    o.feedback === f.value
                      ? 'border-primary bg-primary-soft font-semibold text-primary-hover'
                      : 'border-border',
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted" aria-live="polite">
              {o.feedback
                ? 'ขอบคุณ! คำตอบช่วยให้ระบบประมาณเวลาได้แม่นขึ้น'
                : 'คำตอบช่วยให้ระบบประมาณเวลาได้แม่นขึ้น'}
            </p>
          </section>

          <Link href="/" className={cx(btnPrimary, btnLarge, 'mt-6')}>
            กลับหน้าแรก
          </Link>
        </main>
        <BottomNav />
      </>
    );
  }

  const cooking = o.status === 'cooking';
  const cookTotal = Math.max(1, o.itemCount * o.secondsPerItem);
  const pct = Math.min(100, Math.max(0, ((cookTotal - wait) / cookTotal) * 100));

  return (
    <>
      <main className="flex-1 px-4 pt-3 pb-24">
        <BackLink href="/">หน้าแรก</BackLink>
        <h1 className="mt-1 text-2xl font-bold">คิวของฉัน</h1>
        {offline && <OfflineBanner />}

        <div className="mt-4">
          {cooking ? (
            <QueueTicket
              shopName={o.shopName}
              label={label}
              tone="cooking"
              badge={
                <span className="inline-block rounded-lg bg-warning-soft px-3 py-1 text-sm font-semibold text-warning ring-1 ring-warning/40">
                  ถึงคิวคุณแล้ว!
                </span>
              }
            >
              <p className="mt-1 font-semibold">แม่ค้ากำลังทำอาหารของคุณ</p>
              <div
                className="mt-4 h-3 overflow-hidden rounded-full bg-warning-soft"
                role="progressbar"
                aria-label="ความคืบหน้าการทำอาหาร"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(pct)}
              >
                <div className="h-full rounded-full bg-warning" style={{ width: `${pct}%` }} />
              </div>
              <div className="mt-1 flex justify-between text-xs text-muted">
                <span>เริ่มทำ {o.startedAt && formatClock(o.startedAt)}</span>
                <span>พร้อมราว {formatClock(readyBy)}</span>
              </div>
              <p className="mt-3 text-3xl font-bold">
                {wait > 0 ? `อีกประมาณ ${waitMinutes(wait)} นาที` : 'ใกล้เสร็จแล้ว'}
              </p>
            </QueueTicket>
          ) : (
            <QueueTicket shopName={o.shopName} label={label}>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <TicketStat label="จานก่อนหน้าคุณ" value={`${o.dishesAhead} จาน`} />
                <TicketStat label="เวลารอโดยประมาณ" value={`~${waitMinutes(wait)} นาที`} />
              </div>
              <p className="mt-3 text-sm text-muted">
                คาดว่าพร้อมรับประมาณ {formatClock(readyBy)} น. ({o.dishesAhead + o.itemCount} จาน ×
                เฉลี่ย {waitMinutes(o.secondsPerItem)} นาที)
              </p>
            </QueueTicket>
          )}
        </div>

        <section className={cx(card, 'mt-3 px-4 py-3')} aria-label="รายการที่สั่ง">
          <ul className="space-y-0.5 text-sm">
            {items.map((it) => (
              <li key={it}>{it}</li>
            ))}
          </ul>
        </section>

        <h2 className="mt-6 mb-2 font-bold">สถานะออเดอร์</h2>
        <OrderSteps steps={steps(o)} />

        <p className="mt-4 rounded-xl bg-primary-soft px-4 py-3 text-sm text-primary-hover">
          {cooking
            ? 'ใกล้ได้แล้ว เริ่มเดินกลับไปที่ร้านได้เลย'
            : 'ไม่ต้องยืนรอหน้าร้าน ไปนั่งรอหรือทำธุระอื่นได้เลย ระบบจะเรียกเมื่ออาหารพร้อม'}
        </p>
        <p className="mt-3 text-center text-xs text-muted">
          ชำระเงินแล้ว ยกเลิกเองไม่ได้ · หากต้องการยกเลิก แจ้งแม่ค้าที่ร้าน
        </p>
      </main>
      <BottomNav />
    </>
  );
}
