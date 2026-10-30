import Link from 'next/link';
import { BottomNav } from '@/components/BottomNav';
import { QrIcon } from '@/components/icons';
import { ShopRow } from '@/components/ShopRow';
import { card, cx } from '@/components/ui';
import { getShop, getShops } from '@/lib/demo-data/load';
import { waitMinutes } from '@/lib/format';
import { queuedWaitSeconds } from '@/lib/queue';
import { sampleCustomerOrder, sampleStats, SAMPLE_VENDOR_SHOP } from '@/lib/sample';

export default function HomePage() {
  const shops = getShops();
  const myShop = getShop(SAMPLE_VENDOR_SHOP);
  const mine = myShop ? sampleCustomerOrder(myShop) : null;

  return (
    <>
      <main className="flex-1 px-4 pt-6 pb-24">
        <header className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-primary">อิ่มทัน</h1>
            <p className="mt-1 text-sm text-muted">โรงอาหารคณะวิศวกรรมศาสตร์ จุฬาฯ</p>
          </div>
          <Link
            href="/welcome"
            className="mt-1 inline-flex min-h-11 items-center rounded-full bg-primary-soft px-3 text-sm font-semibold text-primary-hover"
          >
            สวัสดี ฝ้าย
          </Link>
        </header>

        <Link
          href="/scan"
          className="mt-5 flex items-center gap-4 rounded-2xl bg-primary px-5 py-5 text-white hover:bg-primary-hover"
        >
          <QrIcon size={44} strokeWidth={1.75} />
          <span>
            <span className="block text-xl font-bold">สแกน QR หน้าร้าน</span>
            <span className="block text-sm text-white/90">
              รับคิวและสั่งอาหารได้ทันที ไม่ต้องติดตั้งแอป
            </span>
          </span>
        </Link>

        {mine && (
          <Link
            href={`/orders/${mine.id}`}
            className={cx(card, 'mt-3 flex items-center gap-3 px-4 py-4 hover:border-primary/40')}
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs text-muted">คิวของฉัน · {mine.shopName}</span>
              <span className="mt-0.5 block text-xl font-bold">
                {mine.queueLabel} · รออีก ~
                {waitMinutes(
                  queuedWaitSeconds(mine.dishesAhead, mine.itemCount, mine.secondsPerItem),
                )}{' '}
                นาที
              </span>
            </span>
            <span className="rounded-full bg-warning-soft px-3 py-1 text-sm font-semibold text-warning">
              อยู่ในคิว
            </span>
          </Link>
        )}

        <div className="mt-7 flex items-baseline justify-between">
          <h2 className="text-lg font-bold">คิวแต่ละร้านตอนนี้</h2>
          <p className="text-xs text-muted">อัปเดตแบบเรียลไทม์</p>
        </div>
        <ul className="mt-3 space-y-2.5">
          {shops.map((s) => {
            const st = sampleStats(s);
            return (
              <li key={s.slug}>
                <ShopRow
                  slug={s.slug}
                  name={s.name}
                  category={s.category}
                  dishesInQueue={st.dishesInQueue}
                  waitSeconds={st.waitSeconds}
                  busy={st.busy}
                  isOpen={s.isOpen}
                />
              </li>
            );
          })}
        </ul>
        <p className="mt-4 text-xs text-muted">* จำนวนคิวและเวลารอเป็นข้อมูลตัวอย่างในต้นแบบ</p>
      </main>
      <BottomNav />
    </>
  );
}
