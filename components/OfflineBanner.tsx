import { formatClock } from '@/lib/format';

/** Shown while live updates are disconnected (PLAN.md §5), with the last good fetch time. */
export function OfflineBanner({ fetchedAt }: { fetchedAt?: number }) {
  return (
    <p
      role="status"
      className="mx-4 mt-3 rounded-xl bg-warning-soft px-4 py-2.5 text-sm font-semibold text-warning"
    >
      ขาดการเชื่อมต่อ · กำลังเชื่อมต่อใหม่…
      {fetchedAt ? ` ข้อมูลล่าสุดเมื่อ ${formatClock(new Date(fetchedAt))} น.` : ' ข้อมูลอาจไม่เป็นปัจจุบัน'}
    </p>
  );
}
