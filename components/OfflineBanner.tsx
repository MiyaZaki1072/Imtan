/** Shown while live updates are disconnected (PLAN.md §5). */
export function OfflineBanner() {
  return (
    <p
      role="status"
      className="mx-4 mt-3 rounded-xl bg-warning-soft px-4 py-2.5 text-sm font-semibold text-warning"
    >
      ขาดการเชื่อมต่อ · ข้อมูลอาจไม่เป็นปัจจุบัน กำลังเชื่อมต่อใหม่…
    </p>
  );
}
