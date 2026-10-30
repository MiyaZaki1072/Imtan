// Skeleton while a vendor screen loads (three board columns).
export default function Loading() {
  return (
    <main
      className="mx-auto w-full max-w-7xl flex-1 animate-pulse px-4 pt-4"
      aria-busy="true"
      aria-label="กำลังโหลด"
    >
      <div className="h-6 w-64 rounded bg-border" />
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-72 rounded-2xl border border-border bg-surface" />
        ))}
      </div>
    </main>
  );
}
