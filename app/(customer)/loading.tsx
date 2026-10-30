// Skeleton while a customer screen loads.
export default function Loading() {
  return (
    <main className="flex-1 animate-pulse px-4 pt-6 pb-24" aria-busy="true" aria-label="กำลังโหลด">
      <div className="h-8 w-32 rounded-lg bg-border" />
      <div className="mt-3 h-4 w-56 rounded bg-border" />
      <div className="mt-6 space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-2xl border border-border bg-surface" />
        ))}
      </div>
    </main>
  );
}
