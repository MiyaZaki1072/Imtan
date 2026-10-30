import Link from 'next/link';
import { Suspense } from 'react';
import { card, cx } from '@/components/ui';
import { computeStats, type ShopStats, type StatRow, type Summary } from '@/lib/admin/stats';
import { adminPageSession } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

// Admin stats (PLAN.md Phase 9): payments, vendor tap delays, wait accuracy, feedback.
const RANGES = [
  ['today', 'วันนี้'],
  ['7d', '7 วัน'],
  ['all', 'ทั้งหมด'],
] as const;

const sec = (n: number | null) =>
  n === null ? '–' : n < 90 ? `${Math.round(n)} วิ` : `${(n / 60).toFixed(1)} นาที`;
const signed = (n: number | null) =>
  n === null ? '–' : `${n > 0 ? '+' : n < 0 ? '−' : ''}${sec(Math.abs(n))}`;
const pct = (n: number | null) => (n === null ? '–' : `${Math.round(n * 100)}%`);

export default function StatsPage(props: PageProps<'/admin/stats'>) {
  return (
    <Suspense fallback={<p className="px-4 pt-10 text-center text-muted">กำลังโหลด…</p>}>
      <Stats {...props} />
    </Suspense>
  );
}

function Tile({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-xl bg-bg px-3 py-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-0.5 text-2xl font-bold tabular-nums">{value}</p>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2 text-left text-xs font-semibold text-muted">{children}</th>;
}

const stat = (s: Summary) =>
  s.n === 0 ? '–' : `${sec(s.avg)} (กลาง ${sec(s.median)} · 90% ${sec(s.p90)})`;

function FeedbackBar({ f }: { f: ShopStats['feedback'] }) {
  if (f.total === 0) return <span className="text-muted">ยังไม่มีคำตอบ</span>;
  const part = (n: number, text: string, cls: string) =>
    n > 0 && (
      <span
        className={cx(
          'inline-flex h-6 items-center justify-center px-1.5 text-xs font-semibold text-white',
          cls,
        )}
        style={{ width: `${(n / f.total) * 100}%` }}
        title={`${text} ${n}`}
      >
        {text} {n}
      </span>
    );
  return (
    <span className="flex w-full min-w-40 overflow-hidden rounded-md">
      {part(f.faster, 'เร็วกว่า', 'bg-success')}
      {part(f.accurate, 'ตรง', 'bg-info-ink')}
      {part(f.slower, 'ช้ากว่า', 'bg-danger')}
    </span>
  );
}

async function Stats({ searchParams }: PageProps<'/admin/stats'>) {
  await adminPageSession();
  const params = await searchParams;
  const range = ['today', '7d', 'all'].includes(String(params.range)) ? String(params.range) : '7d';
  const sim = params.sim === '1';

  const db = createAdminClient();
  const { data: day } = await db.rpc('current_day');
  const since =
    range === 'today'
      ? `${day}T00:00:00+07:00`
      : range === '7d'
        ? new Date(Date.parse(`${day}T00:00:00+07:00`) - 6 * 86_400_000).toISOString()
        : null;
  let query = db
    .from('orders')
    .select(
      'shop_id, source, status, paid_at, queued_at, started_at, ready_at, picked_up_at, picked_up_by, estimated_wait_seconds, feedback',
    )
    .limit(20000);
  if (since) query = query.gte('created_at', since);
  if (!sim) query = query.neq('source', 'simulated');
  const [{ data: rows }, { data: shops }] = await Promise.all([
    query,
    db.from('shops').select('id, name').order('name'),
  ]);
  const { overall, shops: perShop } = computeStats((rows ?? []) as StatRow[], shops ?? []);
  const f = overall.funnel;

  const link = (r: string, s: boolean) => `/admin/stats?range=${r}${s ? '&sim=1' : ''}`;
  const chip = (active: boolean) =>
    cx(
      'inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold',
      active ? 'border-primary bg-primary-soft text-primary-hover' : 'border-border bg-surface',
    );

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-12">
      <Link href="/admin" className="text-sm font-semibold text-primary">
        ← กลับหน้าผู้ดูแล
      </Link>
      <h1 className="mt-1 text-2xl font-bold">สถิติ</h1>
      <nav aria-label="ช่วงเวลา" className="mt-3 flex flex-wrap items-center gap-2">
        {RANGES.map(([value, text]) => (
          <Link
            key={value}
            href={link(value, sim)}
            aria-current={range === value ? 'page' : undefined}
            className={chip(range === value)}
          >
            {text}
          </Link>
        ))}
        <Link href={link(range, !sim)} aria-pressed={sim} className={chip(sim)}>
          {sim ? '✓ ' : ''}รวมออเดอร์จำลอง
        </Link>
      </nav>

      <section className={cx(card, 'mt-4 px-4 py-4')} aria-label="การชำระเงิน">
        <h2 className="font-bold">ออเดอร์ผ่านแอป</h2>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <Tile label="สร้างออเดอร์" value={f.created} />
          <Tile label="ชำระเงินแล้ว" value={f.paid} hint={`${pct(f.conversion)} ของที่สร้าง`} />
          <Tile label="หมดเวลา (ไม่จ่าย)" value={f.expired} />
          <Tile label="ลูกค้ายกเลิกก่อนจ่าย" value={f.abandoned} />
          <Tile label="กำลังรอจ่าย" value={f.awaitingPayment} />
          <Tile label="ร้านยกเลิกหลังจ่าย" value={f.cancelled} />
        </div>
      </section>

      <section
        className={cx(card, 'mt-4 overflow-x-auto px-4 py-4')}
        aria-label="ความเร็วของแม่ค้า"
      >
        <h2 className="font-bold">ความเร็วของแม่ค้า (เวลาที่กดปุ่ม)</h2>
        <p className="text-xs text-muted">
          รอกดเริ่มทำ = จากเข้าคิวถึงกด “เริ่มทำ” · ทำ = จาก “เริ่มทำ” ถึง “เสร็จแล้ว” · รอรับ = จาก
          “เสร็จแล้ว” ถึงปิดออเดอร์
        </p>
        <table className="mt-2 w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-border">
              <Th>ร้าน</Th>
              <Th>ออเดอร์ที่เสร็จ</Th>
              <Th>รอกดเริ่มทำ</Th>
              <Th>เวลาทำ</Th>
              <Th>รอรับ</Th>
              <Th>ปิดอัตโนมัติ (30 นาที)</Th>
            </tr>
          </thead>
          <tbody>
            {[overall, ...perShop].map((s) => (
              <tr
                key={s.shopId}
                className={cx(
                  'border-b border-border last:border-0',
                  s.shopId === 'all' && 'bg-bg font-semibold',
                )}
              >
                <td className="px-3 py-2">{s.name}</td>
                <td className="px-3 py-2 tabular-nums">{s.served}</td>
                <td className="px-3 py-2">{stat(s.startDelay)}</td>
                <td className="px-3 py-2">{stat(s.cook)}</td>
                <td className="px-3 py-2">{stat(s.pickupDelay)}</td>
                <td className="px-3 py-2 tabular-nums">{s.autoClosed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section
        className={cx(card, 'mt-4 overflow-x-auto px-4 py-4')}
        aria-label="ความแม่นของเวลารอ"
      >
        <h2 className="font-bold">ความแม่นของเวลารอ</h2>
        <p className="text-xs text-muted">
          คลาดเคลื่อน = เวลารอจริง − ที่แอปบอก (บวก = แอปบอกน้อยไป ลบ = แอปบอกมากไป)
        </p>
        <table className="mt-2 w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-border">
              <Th>ร้าน</Th>
              <Th>เวลารอจริง</Th>
              <Th>คลาดเคลื่อนเฉลี่ย</Th>
              <Th>ความเห็นลูกค้า ({overall.feedback.total})</Th>
            </tr>
          </thead>
          <tbody>
            {[overall, ...perShop].map((s) => (
              <tr
                key={s.shopId}
                className={cx(
                  'border-b border-border last:border-0',
                  s.shopId === 'all' && 'bg-bg font-semibold',
                )}
              >
                <td className="px-3 py-2">{s.name}</td>
                <td className="px-3 py-2">{stat(s.actualWait)}</td>
                <td className="px-3 py-2">
                  {signed(s.estimateError.avg)}{' '}
                  <span className="font-normal text-muted">({s.estimateError.n} ออเดอร์)</span>
                </td>
                <td className="px-3 py-2">
                  <FeedbackBar f={s.feedback} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
