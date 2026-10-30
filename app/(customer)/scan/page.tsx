import Link from 'next/link';
import { ChevronLeftIcon } from '@/components/icons';
import { getShops } from '@/lib/demo-data/load';

// The QR on each shop poster is a plain URL (/s/<slug>), so the phone camera works too.
export default function ScanPage() {
  const shops = getShops();
  return (
    <main className="flex flex-1 flex-col bg-ink text-white">
      <header className="relative flex items-center justify-center px-4 pt-4 pb-2">
        <Link
          href="/"
          className="absolute left-2 inline-flex min-h-11 items-center gap-0.5 px-2 text-sm font-semibold"
        >
          <ChevronLeftIcon size={18} />
          กลับ
        </Link>
        <h1 className="text-lg font-bold">สแกน QR หน้าร้าน</h1>
      </header>

      <div className="flex flex-col items-center px-6 pt-10 pb-8">
        <div className="relative aspect-square w-64">
          {[
            'top-0 left-0 border-t-4 border-l-4 rounded-tl-2xl',
            'top-0 right-0 border-t-4 border-r-4 rounded-tr-2xl',
            'bottom-0 left-0 border-b-4 border-l-4 rounded-bl-2xl',
            'bottom-0 right-0 border-b-4 border-r-4 rounded-br-2xl',
          ].map((c) => (
            <span key={c} className={`absolute h-12 w-12 border-[#FB923C] ${c}`} />
          ))}
          <span className="absolute inset-x-6 top-1/2 h-0.5 bg-[#FB923C]" />
        </div>
        <p className="mt-6 text-center">
          เล็งกล้องไปที่ QR code
          <br />
          บนป้ายหน้าร้าน
        </p>
        <p className="mt-2 text-center text-sm text-white/70">
          ใช้แอปกล้องของมือถือสแกนก็ได้ จะเปิดหน้าร้านให้ทันที
        </p>
      </div>

      <section className="mt-auto rounded-t-3xl bg-surface px-4 pt-5 pb-8 text-ink">
        <h2 className="font-bold">สแกนไม่ได้? เลือกร้านจากรายการ</h2>
        <ul className="mt-3 space-y-2">
          {shops.map((s) => (
            <li key={s.slug}>
              <Link
                href={`/s/${s.slug}`}
                className="flex min-h-12 items-center justify-between rounded-xl border border-border px-4 py-2 hover:border-primary/40"
              >
                <span>
                  <span className="block font-semibold">{s.name}</span>
                  <span className="block text-xs text-muted">{s.category}</span>
                </span>
                <span className="text-sm font-semibold text-primary">ไปที่หน้าร้าน</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
