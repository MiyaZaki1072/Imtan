'use client';

import Link from 'next/link';
import { useState } from 'react';
import { BackLink } from '@/components/BackLink';
import { BellIcon } from '@/components/icons';
import { btnLarge, btnPrimary, btnSecondary, card, cx } from '@/components/ui';

type Result = 'granted' | 'denied' | 'unsupported' | null;

export function NotificationsView() {
  const [result, setResult] = useState<Result>(null);

  async function allow() {
    if (typeof Notification === 'undefined') {
      setResult('unsupported');
      return;
    }
    // Phase 6 also subscribes to Web Push here.
    const permission = await Notification.requestPermission();
    setResult(permission === 'granted' ? 'granted' : 'denied');
  }

  const queueHref = '/orders';

  return (
    <main className="flex flex-1 flex-col px-4 pt-3 pb-8">
      <BackLink href={queueHref}>กลับ</BackLink>
      <div className="mt-6 text-center">
        <span className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-primary-soft text-primary">
          <BellIcon size={40} />
        </span>
        <h1 className="mt-4 text-2xl font-bold">เปิดการแจ้งเตือน</h1>
        <p className="mt-2 text-muted">
          เราจะเตือนคุณทันทีเมื่ออาหารพร้อม
          <br />
          ไปนั่งรอที่ไหนก็ได้ ไม่ต้องคอยดูหน้าจอ
        </p>
      </div>

      <section className={cx(card, 'mt-6 px-4 py-4 text-center')}>
        <p className="font-semibold">&quot;อิ่มทัน&quot; ต้องการส่งการแจ้งเตือนถึงคุณ</p>
        <button type="button" onClick={allow} className={cx(btnPrimary, 'mt-3 w-full min-h-12')}>
          อนุญาต
        </button>
        <p className="mt-2 text-sm" role="status">
          {result === 'granted' && <span className="text-success">เปิดการแจ้งเตือนแล้ว</span>}
          {result === 'denied' && (
            <span className="text-danger">
              ไม่ได้รับอนุญาต — เปิดหน้าคิวไว้เพื่อดูเมื่ออาหารพร้อม
            </span>
          )}
          {result === 'unsupported' && (
            <span className="text-warning">
              เบราว์เซอร์นี้แจ้งเตือนไม่ได้ — ดูวิธีสำหรับ iPhone ด้านล่าง
            </span>
          )}
        </p>
      </section>

      <section className="mt-4 rounded-2xl bg-info-soft px-4 py-4 text-info-ink">
        <h2 className="font-bold">ใช้ iPhone? ทำ 3 ขั้นตอนนี้ก่อน (ครั้งเดียว)</h2>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm">
          <li>กดปุ่ม &quot;แชร์&quot; ด้านล่างของ Safari</li>
          <li>เลือก &quot;เพิ่มไปยังหน้าจอโฮม&quot;</li>
          <li>เปิดอิ่มทันจากไอคอนบนหน้าจอโฮม แล้วกด &quot;อนุญาต&quot;</li>
        </ol>
      </section>
      <p className="mt-3 text-sm text-muted">Android: กด &quot;อนุญาต&quot; ได้ทันที</p>

      <Link href={queueHref} className={cx(btnSecondary, btnLarge, 'mt-auto text-primary')}>
        ข้ามไปก่อน ดูคิวของฉัน
      </Link>
    </main>
  );
}
