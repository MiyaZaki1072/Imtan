import { Suspense } from 'react';
import { adminPageSession } from '@/lib/auth';
import Link from 'next/link';
import { DemoBanner } from '@/components/DemoBanner';
import { btnPrimary, btnSecondary, card, cx } from '@/components/ui';
import { getShops } from '@/lib/demo-data/load';

// M1 admin: demo tools, reset, CSV export, QR posters. Admins only.
export default function AdminPage() {
  return (
    <Suspense fallback={<p className="px-4 pt-10 text-center text-muted">กำลังโหลด…</p>}>
      <AdminPageContent />
    </Suspense>
  );
}

async function AdminPageContent() {
  await adminPageSession();
  const shops = getShops();
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-10">
      <h1 className="text-2xl font-bold">ผู้ดูแลระบบ</h1>
      <DemoBanner className="mt-3" />

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <section className={cx(card, 'px-5 py-5')}>
          <h2 className="text-lg font-bold">เครื่องมือเดโม</h2>
          <p className="mt-1 text-sm text-muted">
            มือถือลูกค้าและกระดานแม่ค้าในจอเดียว พร้อมปุ่มจำลองช่วงพีค
          </p>
          <Link href="/demo" className={cx(btnPrimary, 'mt-4 min-h-12')}>
            เปิดโหมดนำเสนอ
          </Link>
        </section>

        <section className={cx(card, 'px-5 py-5')}>
          <h2 className="text-lg font-bold">รีเซ็ตเดโม</h2>
          <p className="mt-1 text-sm text-muted">
            ยกเลิกออเดอร์ที่ค้าง ล้างเลขคิววันนี้ คืนของหมดและราคาตามข้อมูลตั้งต้น
          </p>
          <button
            type="button"
            disabled
            className={cx(btnSecondary, 'mt-4 min-h-12 border-danger/40 text-danger')}
          >
            รีเซ็ตทุกร้าน
          </button>
        </section>

        <section className={cx(card, 'px-5 py-5')}>
          <h2 className="text-lg font-bold">ส่งออก CSV</h2>
          <p className="mt-1 text-sm text-muted">ไฟล์ UTF-8 เปิดภาษาไทยใน Sheets/Excel ได้</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" disabled className={cx(btnSecondary, 'min-h-12')}>
              เหตุการณ์ (events)
            </button>
            <button type="button" disabled className={cx(btnSecondary, 'min-h-12')}>
              ออเดอร์
            </button>
          </div>
        </section>

        <section className={cx(card, 'px-5 py-5')}>
          <h2 className="text-lg font-bold">โปสเตอร์ QR หน้าร้าน</h2>
          <p className="mt-1 text-sm text-muted">QR เป็นลิงก์ธรรมดา สแกนด้วยกล้องมือถือได้</p>
          <ul className="mt-3 space-y-1.5 text-sm">
            {shops.map((s) => (
              <li key={s.slug} className="flex items-center justify-between gap-2">
                <span className="truncate">{s.name}</span>
                <Link href={`/s/${s.slug}`} className="shrink-0 font-mono text-primary">
                  /s/{s.slug}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
      <p className="mt-4 text-xs text-muted">ปุ่มที่กดไม่ได้จะใช้งานได้เมื่อเชื่อมฐานข้อมูลแล้ว</p>
    </main>
  );
}
