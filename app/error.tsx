'use client';

import Link from 'next/link';

// Shown when a screen crashes: a Thai message, a retry and a way home.
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <h1 className="text-2xl font-bold">มีบางอย่างผิดพลาด</h1>
      <p className="mt-2 max-w-xs text-muted">
        ลองใหม่อีกครั้ง ถ้ายังไม่หาย กลับหน้าแรกแล้วเปิดใหม่ ออเดอร์ที่ชำระเงินแล้วไม่หายไปไหน
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="inline-flex min-h-12 items-center rounded-xl bg-primary px-6 font-semibold text-white hover:bg-primary-hover"
        >
          ลองใหม่
        </button>
        <Link
          href="/"
          className="inline-flex min-h-12 items-center rounded-xl border border-border bg-surface px-6 font-semibold"
        >
          กลับหน้าแรก
        </Link>
      </div>
    </main>
  );
}
