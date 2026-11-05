import Link from 'next/link';
import { vendorPageShop } from '@/lib/auth';
import { card, cx } from '@/components/ui';
import { formatBaht, waitMinutes } from '@/lib/format';
import { demoPaymentsEnabled } from '@/lib/payments';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  bangkokDay,
  computeSummary,
  lastSevenDays,
  type SummaryItem,
  type SummaryOrder,
} from '@/lib/vendor/summary';

// Shop summary (PLAN-V2.md Phase 14): today and the last 7 days, top menus.
export default async function SummaryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { shopId } = await vendorPageShop();
  const params = await searchParams;
  const interview = params.interview === '1' && demoPaymentsEnabled();
  const sim = params.sim === undefined ? interview : params.sim === '1';

  const today = bangkokDay(new Date());
  const since = `${lastSevenDays(today)[0]}T00:00:00+07:00`;
  const db = createAdminClient();
  const { data: rows } = await db
    .from('orders')
    .select('id, source, status, created_at, item_count, total_satang, paid_at, queued_at, ready_at')
    .eq('shop_id', shopId)
    .gte('created_at', since)
    .limit(10000);
  const ids = (rows ?? []).map((r) => r.id);
  const { data: items } = ids.length
    ? await db.from('order_items').select('order_id, menu_name, qty').in('order_id', ids)
    : { data: [] as SummaryItem[] };
  const [{ data: shopRow }, { data: comments }] = await Promise.all([
    db.from('shops').select('rating_avg, rating_count').eq('id', shopId).single(),
    db
      .from('orders')
      .select('shop_rating, rating_comment, picked_up_at')
      .eq('shop_id', shopId)
      .not('shop_rating', 'is', null)
      .order('picked_up_at', { ascending: false })
      .limit(10),
  ]);
  const s = computeSummary((rows ?? []) as SummaryOrder[], items ?? [], today, sim);
  const maxDishes = Math.max(1, ...s.days.map((d) => d.dishes));

  const toggle = `/vendor/summary?sim=${sim ? '0' : '1'}${interview ? '&interview=1' : ''}`;
  const stat = (label: string, value: string) => (
    <div className="rounded-xl bg-bg px-3 py-2">
      <p className="text-xs text-muted">{label}</p>
      <p className="text-xl font-bold">{value}</p>
    </div>
  );

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 pt-5 pb-10">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-2xl font-bold">สรุปยอดขาย</h1>
        <Link
          href={toggle}
          aria-pressed={sim}
          className={cx(
            'inline-flex min-h-12 items-center rounded-full border px-4 text-sm font-semibold',
            sim ? 'border-primary bg-primary-soft text-primary-hover' : 'border-border bg-surface',
          )}
        >
          รวมออเดอร์จำลอง: {sim ? 'เปิด' : 'ปิด'}
        </Link>
        <Link
          href="/vendor"
          className="inline-flex min-h-12 items-center text-sm font-semibold text-primary"
        >
          กลับหน้าคิว
        </Link>
      </div>

      {s.week.orders === 0 ? (
        <p className={cx(card, 'mt-6 px-4 py-10 text-center text-muted')}>
          ยังไม่มีออเดอร์ใน 7 วันที่ผ่านมา
        </p>
      ) : (
        <>
          {[
            ['วันนี้', s.today],
            ['7 วันล่าสุด', s.week],
          ].map(([title, t]) =>
            typeof t === 'string' ? null : (
              <section key={String(title)} className={cx(card, 'mt-4 px-4 py-4')}>
                <h2 className="font-bold">{String(title)}</h2>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {stat('ออเดอร์', String(t.orders))}
                  {stat('จาน', String(t.dishes))}
                  {stat('ยอดขาย', formatBaht(t.salesSatang))}
                  {stat(
                    'รอเฉลี่ย',
                    t.avgWaitSeconds === null ? '–' : `${waitMinutes(t.avgWaitSeconds)} นาที`,
                  )}
                </div>
              </section>
            ),
          )}
          {s.quickWalkIns > 0 && (
            <p className="mt-2 text-sm text-muted">
              ยอดขายไม่รวมคิวหน้าร้านแบบด่วน {s.quickWalkIns} ออเดอร์ (ไม่มีราคา)
            </p>
          )}

          <section className={cx(card, 'mt-4 px-4 py-4')} aria-label="จานต่อวัน">
            <h2 className="font-bold">จานต่อวัน</h2>
            <ul className="mt-3 space-y-2">
              {s.days.map((d) => (
                <li key={d.day} className="grid grid-cols-[5rem_1fr_7rem] items-center gap-3 text-sm">
                  <span className="text-muted">{d.day.slice(5).split('-').reverse().join('/')}</span>
                  <span className="h-4 overflow-hidden rounded-full bg-bg">
                    <span
                      className="block h-full rounded-full bg-primary"
                      style={{ width: `${(d.dishes / maxDishes) * 100}%` }}
                    />
                  </span>
                  <span className="text-right font-semibold">
                    {d.dishes} จาน · {formatBaht(d.salesSatang)}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className={cx(card, 'mt-4 px-4 py-4')} aria-label="คะแนนจากลูกค้า">
            <h2 className="font-bold">คะแนนจากลูกค้า</h2>
            <p className="mt-1 text-sm">
              {shopRow?.rating_count
                ? `เฉลี่ย ${Number(shopRow.rating_avg).toFixed(1)} / 5 จาก ${shopRow.rating_count} คะแนน`
                : 'ยังไม่มีคะแนน'}
            </p>
            {(comments ?? []).some((c) => c.rating_comment) && (
              <ul className="mt-2 space-y-1.5 text-sm">
                {(comments ?? [])
                  .filter((c) => c.rating_comment)
                  .map((c, i) => (
                    <li key={i} className="rounded-lg bg-bg px-3 py-2">
                      <span className="font-semibold">{c.shop_rating} ดาว</span> · {c.rating_comment}
                    </li>
                  ))}
              </ul>
            )}
          </section>

          <section className={cx(card, 'mt-4 px-4 py-4')} aria-label="เมนูขายดี">
            <h2 className="font-bold">เมนูขายดี 7 วัน</h2>
            <ol className="mt-2 space-y-1.5 text-sm">
              {s.topMenus.map((m, i) => (
                <li key={m.name} className="flex justify-between">
                  <span>
                    {i + 1}. {m.name}
                  </span>
                  <span className="font-semibold">{m.qty} จาน</span>
                </li>
              ))}
            </ol>
          </section>
        </>
      )}
    </main>
  );
}
