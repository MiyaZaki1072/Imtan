import Link from 'next/link';
import { headers } from 'next/headers';
import QRCode from 'qrcode';
import { Suspense } from 'react';
import { adminPageSession } from '@/lib/auth';
import { getShops } from '@/lib/demo-data/load';

// A5 QR poster per shop (PLAN.md Phase 6). The QR is a plain URL, so a phone camera works.
// Print with Ctrl+P, paper size A5, margins none.
export default function PostersPage() {
  return (
    <Suspense fallback={<p className="px-4 pt-10 text-center text-muted">กำลังโหลด…</p>}>
      <Posters />
    </Suspense>
  );
}

async function Posters() {
  await adminPageSession();
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  const posters = await Promise.all(
    getShops().map(async (s) => {
      const url = `${proto}://${host}/s/${s.slug}`;
      return {
        shop: s,
        url,
        svg: await QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' }),
      };
    }),
  );

  return (
    <main className="flex-1 bg-bg print:bg-white">
      <style>{`@page { size: A5; margin: 0 } @media print { body { background: #fff } }`}</style>
      <div className="mx-auto max-w-3xl px-4 py-4 print:hidden">
        <Link href="/admin" className="text-sm font-semibold text-primary">
          ← กลับหน้าผู้ดูแล
        </Link>
        <h1 className="mt-2 text-2xl font-bold">โปสเตอร์ QR หน้าร้าน (A5)</h1>
        <p className="text-muted">พิมพ์ด้วย Ctrl+P เลือกกระดาษ A5 และไม่เว้นขอบ ร้านละ 1 แผ่น</p>
      </div>
      {posters.map(({ shop, url, svg }) => (
        <section
          key={shop.slug}
          className="mx-auto mb-6 flex h-[210mm] w-[148mm] max-w-full flex-col items-center justify-between border border-border bg-white px-[12mm] py-[14mm] text-center break-after-page print:m-0 print:h-[210mm] print:w-[148mm] print:border-0"
        >
          <div>
            <p className="text-2xl font-bold text-primary">อิ่มทัน</p>
            <h2 className="mt-3 text-4xl leading-snug font-bold">{shop.name}</h2>
            <p className="mt-1 text-lg text-muted">{shop.category}</p>
          </div>
          <div>
            <div className="mx-auto h-[86mm] w-[86mm]" dangerouslySetInnerHTML={{ __html: svg }} />
            <p className="mt-4 text-2xl font-bold">สแกนเพื่อดูคิวและสั่งอาหาร</p>
          </div>
          <div>
            <p className="text-lg">ไม่ต้องติดตั้งแอป · จ่ายผ่านมือถือ แล้วรอรับเลขคิว</p>
            <p className="mt-2 text-sm text-muted">{url}</p>
          </div>
        </section>
      ))}
    </main>
  );
}
