'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { BackLink } from '@/components/BackLink';
import { BottomNav } from '@/components/BottomNav';
import { CheckIcon } from '@/components/icons';
import { OrderSteps, type OrderStep } from '@/components/OrderSteps';
import { QueueTicket, TicketStat } from '@/components/QueueTicket';
import { ReadyAlert } from '@/components/ReadyAlert';
import { btnLarge, btnPrimary, card, cx } from '@/components/ui';
import { formatBaht, formatClock, waitMinutes } from '@/lib/format';
import { cookingWaitSeconds, queuedWaitSeconds } from '@/lib/queue';
import { minutesFromSampleNow, type SampleCustomerOrder, type SampleStatus } from '@/lib/sample';

const STATES: SampleStatus[] = ['queued', 'cooking', 'ready', 'picked_up'];
const STATE_LABEL: Record<SampleStatus, string> = {
  queued: 'อยู่ในคิว',
  cooking: 'กำลังทำ',
  ready: 'พร้อมรับ',
  picked_up: 'รับแล้ว',
};

type Feedback = 'faster' | 'accurate' | 'slower';
const FEEDBACK: { value: Feedback; label: string }[] = [
  { value: 'faster', label: 'เร็วกว่าที่บอก' },
  { value: 'accurate', label: 'ตรงตามที่บอก' },
  { value: 'slower', label: 'ช้ากว่าที่บอก' },
];

function steps(order: SampleCustomerOrder, status: SampleStatus): OrderStep[] {
  const idx = STATES.indexOf(status);
  const state = (i: number) => (i < idx + 1 ? 'done' : i === idx + 1 ? 'current' : 'todo');
  return [
    {
      title: 'ชำระเงินแล้ว · ร้านรับออเดอร์',
      detail: `${formatClock(order.paidAt)} น.`,
      state: 'done',
    },
    {
      title: 'อยู่ในคิว',
      detail: idx === 0 ? 'แม่ค้ากำลังทำคิวก่อนหน้าคุณ' : `${formatClock(order.queuedAt)} น.`,
      state: idx === 0 ? 'current' : 'done',
    },
    {
      title: 'กำลังทำอาหารของคุณ',
      detail:
        idx >= 1 && order.startedAt
          ? `แม่ค้ากด "เริ่มทำ" เมื่อ ${formatClock(order.startedAt)} น.`
          : 'เมื่อแม่ค้ากด "เริ่มทำ"',
      state: state(1),
    },
    {
      title: 'พร้อมรับ – แจ้งเตือนทันที',
      detail: 'เมื่อแม่ค้ากด "เสร็จแล้ว" มีเสียงและสั่นเตือน',
      state: idx >= 2 ? 'done' : 'todo',
    },
  ];
}

export function OrderView({ order }: { order: SampleCustomerOrder }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const raw = params.get('state') as SampleStatus | null;
  const status: SampleStatus = raw && STATES.includes(raw) ? raw : 'queued';
  const justPaid = params.get('paid') === '1' && status === 'queued';
  const go = (s: SampleStatus) => router.replace(`${pathname}?state=${s}`, { scroll: false });

  const items = order.items.map((it) => `${it.kitchenSummary} × ${it.qty}`);
  const queuedWait = queuedWaitSeconds(order.dishesAhead, order.itemCount, order.secondsPerItem);
  const readyBy = minutesFromSampleNow(queuedWait / 60);

  if (justPaid) {
    return (
      <main className="flex flex-1 flex-col bg-primary px-4 pt-10 pb-8 text-white">
        <div className="text-center">
          <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-white text-primary">
            <CheckIcon size={36} strokeWidth={3} />
          </span>
          <h1 className="mt-4 text-3xl font-bold">ชำระเงินแล้ว ได้คิวแล้ว!</h1>
          <p className="mt-1 text-sm text-white/90">
            {formatClock(order.paidAt)} น. · ร้านได้รับออเดอร์ของคุณแล้ว
          </p>
        </div>
        <div className="mt-6 rounded-2xl bg-surface px-4 py-5 text-ink">
          <p className="text-center text-sm text-muted">{order.shopName} · เลขคิวของคุณ</p>
          <p className="text-center text-6xl leading-tight font-bold text-primary">
            {order.queueLabel}
          </p>
          <ul className="mt-3 border-t border-border pt-3 text-sm">
            {items.map((it) => (
              <li key={it}>{it}</li>
            ))}
          </ul>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <TicketStat label="จานก่อนหน้า" value={order.dishesAhead} />
            <TicketStat label="รอประมาณ" value={`${waitMinutes(queuedWait)} นาที`} />
            <TicketStat label="พร้อมราว" value={formatClock(readyBy)} />
          </div>
          <p className="mt-3 text-center text-sm text-muted">
            ชำระเงินแล้ว · {formatBaht(order.totalSatang ?? 0)}
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
            onClick={() => go('queued')}
            className={cx(btnLarge, 'rounded-xl border-2 border-white/80 font-bold text-white')}
          >
            ดูสถานะคิวของฉัน
          </button>
        </div>
      </main>
    );
  }

  if (status === 'ready') {
    return (
      <ReadyAlert
        label={order.queueLabel}
        shopName={order.shopName}
        items={items}
        onReceived={() => go('picked_up')}
      />
    );
  }

  const switcher = (
    <section className="mt-6 rounded-xl border border-dashed border-border px-3 py-3">
      <p className="text-xs text-muted">ดูตัวอย่างสถานะ (ต้นแบบ)</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {STATES.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={s === status}
            onClick={() => go(s)}
            className={cx(
              'min-h-11 rounded-full border px-3 text-sm',
              s === status
                ? 'border-primary bg-primary-soft font-semibold text-primary-hover'
                : 'border-border',
            )}
          >
            {STATE_LABEL[s]}
          </button>
        ))}
      </div>
    </section>
  );

  if (status === 'picked_up') {
    const waited = order.readyAt
      ? Math.round((new Date(order.readyAt).getTime() - new Date(order.paidAt).getTime()) / 60000)
      : 0;
    return (
      <>
        <main className="flex-1 px-4 pt-10 pb-24">
          <h1 className="text-center text-3xl font-bold">รับอาหารแล้ว ขอให้อร่อย!</h1>
          <p className="mt-1 text-center text-muted">
            คิว {order.queueLabel} · {order.shopName}
          </p>
          <section className={cx(card, 'mt-6 px-4 py-4')} aria-label="สรุปเวลาครั้งนี้">
            <h2 className="font-bold">สรุปเวลาครั้งนี้</h2>
            <dl className="mt-2 space-y-2 text-sm">
              {[
                ['ชำระเงิน', order.paidAt],
                ['อาหารพร้อม', order.readyAt],
                ['รับอาหาร', order.pickedUpAt],
              ].map(([k, v]) =>
                v ? (
                  <div key={k} className="flex justify-between">
                    <dt className="text-muted">{k}</dt>
                    <dd>{formatClock(v)} น.</dd>
                  </div>
                ) : null,
              )}
              <div className="flex justify-between border-t border-border pt-2 font-semibold">
                <dt>รอจริง</dt>
                <dd className="text-success">
                  {waited} นาที (แอปประมาณไว้ {waitMinutes(queuedWait)} นาที)
                </dd>
              </div>
            </dl>
          </section>

          <section className={cx(card, 'mt-3 px-4 py-4')} aria-label="ความแม่นยำของเวลารอ">
            <h2 className="font-bold">เวลารอที่แอปบอก แม่นแค่ไหน?</h2>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {FEEDBACK.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  aria-pressed={feedback === f.value}
                  onClick={() => setFeedback(f.value)}
                  className={cx(
                    'min-h-12 rounded-xl border px-2 text-sm',
                    feedback === f.value
                      ? 'border-primary bg-primary-soft font-semibold text-primary-hover'
                      : 'border-border',
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted" aria-live="polite">
              {feedback
                ? 'ขอบคุณ! คำตอบช่วยให้ระบบประมาณเวลาได้แม่นขึ้น'
                : 'คำตอบช่วยให้ระบบประมาณเวลาได้แม่นขึ้น'}
            </p>
          </section>

          <Link href="/" className={cx(btnPrimary, btnLarge, 'mt-6')}>
            กลับหน้าแรก
          </Link>
          {switcher}
        </main>
        <BottomNav />
      </>
    );
  }

  const cooking = status === 'cooking';
  const cookLeft = cookingWaitSeconds(order.itemCount, order.secondsPerItem, 60);
  const cookTotal = order.itemCount * order.secondsPerItem;

  return (
    <>
      <main className="flex-1 px-4 pt-3 pb-24">
        <BackLink href="/">หน้าแรก</BackLink>
        <h1 className="mt-1 text-2xl font-bold">คิวของฉัน</h1>

        <div className="mt-4">
          {cooking ? (
            <QueueTicket
              shopName={order.shopName}
              label={order.queueLabel}
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
                aria-valuenow={Math.round(((cookTotal - cookLeft) / cookTotal) * 100)}
              >
                <div
                  className="h-full rounded-full bg-warning"
                  style={{ width: `${((cookTotal - cookLeft) / cookTotal) * 100}%` }}
                />
              </div>
              <div className="mt-1 flex justify-between text-xs text-muted">
                <span>เริ่มทำ {order.startedAt && formatClock(order.startedAt)}</span>
                <span>พร้อมราว {order.readyAt && formatClock(order.readyAt)}</span>
              </div>
              <p className="mt-3 text-3xl font-bold">อีกประมาณ {waitMinutes(cookLeft)} นาที</p>
            </QueueTicket>
          ) : (
            <QueueTicket shopName={order.shopName} label={order.queueLabel}>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <TicketStat label="จานก่อนหน้าคุณ" value={`${order.dishesAhead} จาน`} />
                <TicketStat label="เวลารอโดยประมาณ" value={`~${waitMinutes(queuedWait)} นาที`} />
              </div>
              <p className="mt-3 text-sm text-muted">
                คาดว่าพร้อมรับประมาณ {formatClock(readyBy)} น. (
                {order.dishesAhead + order.itemCount} จาน × เฉลี่ย{' '}
                {waitMinutes(order.secondsPerItem)} นาที)
              </p>
            </QueueTicket>
          )}
        </div>

        <h2 className="mt-6 mb-2 font-bold">สถานะออเดอร์</h2>
        <OrderSteps steps={steps(order, status)} />

        <p className="mt-4 rounded-xl bg-primary-soft px-4 py-3 text-sm text-primary-hover">
          {cooking
            ? 'ใกล้ได้แล้ว เริ่มเดินกลับไปที่ร้านได้เลย'
            : 'ไม่ต้องยืนรอหน้าร้าน ไปนั่งรอหรือทำธุระอื่นได้เลย ระบบจะเรียกเมื่ออาหารพร้อม'}
        </p>
        <p className="mt-3 text-center text-xs text-muted">
          ชำระเงินแล้ว ยกเลิกเองไม่ได้ · หากต้องการยกเลิก แจ้งแม่ค้าที่ร้าน
        </p>
        {switcher}
      </main>
      <BottomNav />
    </>
  );
}
