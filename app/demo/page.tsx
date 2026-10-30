import { DemoBanner } from '@/components/DemoBanner';
import { btnPrimary, btnSecondary, card, cx } from '@/components/ui';
import { getShops } from '@/lib/demo-data/load';
import { SAMPLE_VENDOR_SHOP } from '@/lib/sample';

// Presenter view (PLAN.md §5d). Phase 6 adds the admin + DEMO_PAYMENTS=true guard
// and makes the controls work.
export default function DemoPage() {
  const shops = getShops();
  return (
    <main className="flex flex-1 flex-col gap-4 px-4 py-4 xl:flex-row">
      <aside className="space-y-3 xl:w-72 xl:shrink-0">
        <h1 className="text-2xl font-bold">โหมดนำเสนอ</h1>
        <DemoBanner />
        <section className={cx(card, 'space-y-3 px-4 py-4')}>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold">ร้านบนกระดานแม่ค้า</span>
            <select
              defaultValue={SAMPLE_VENDOR_SHOP}
              disabled
              className="min-h-12 w-full rounded-xl border border-border bg-surface px-3"
            >
              {shops.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <button type="button" disabled className={cx(btnPrimary, 'min-h-12 w-full')}>
            จำลองช่วงพีค (10 ออเดอร์)
          </button>
          <button type="button" disabled className={cx(btnSecondary, 'min-h-12 w-full')}>
            เดินคิวอัตโนมัติ: ปิด
          </button>
          <button
            type="button"
            disabled
            className={cx(btnSecondary, 'min-h-12 w-full border-danger/40 text-danger')}
          >
            รีเซ็ตเดโม
          </button>
          <p className="text-xs text-muted">ปุ่มเหล่านี้ใช้ได้เมื่อเชื่อมฐานข้อมูลแล้ว</p>
        </section>
      </aside>

      <section aria-label="มือถือลูกค้า" className="flex justify-center xl:shrink-0">
        <div className="rounded-[2.75rem] border-[10px] border-ink bg-ink shadow-xl">
          <iframe
            src="/"
            title="แอปลูกค้า"
            className="h-[760px] w-[390px] max-w-[calc(100vw-3.5rem)] rounded-[2rem] bg-bg"
          />
        </div>
      </section>

      <section
        aria-label="กระดานแม่ค้า"
        className="min-h-[760px] flex-1 overflow-hidden rounded-2xl border border-border"
      >
        <iframe src="/vendor" title="กระดานแม่ค้า" className="h-full min-h-[760px] w-full bg-bg" />
      </section>
    </main>
  );
}
