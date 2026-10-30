import { formatBaht } from '@/lib/format';
import { card, cx } from './ui';

// A fixed pattern that only looks like a QR code. It is not scannable on purpose.
const SIZE = 21;
const CELLS = Array.from({ length: SIZE * SIZE }, (_, i) => {
  const x = i % SIZE;
  const y = Math.floor(i / SIZE);
  const finder = (fx: number, fy: number) => {
    const dx = x - fx;
    const dy = y - fy;
    if (dx < 0 || dy < 0 || dx > 6 || dy > 6) return null;
    return (
      dx === 0 || dy === 0 || dx === 6 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4)
    );
  };
  const f = finder(0, 0) ?? finder(SIZE - 7, 0) ?? finder(0, SIZE - 7);
  if (f !== null) return f;
  return (x * 7 + y * 13 + x * y) % 5 < 2;
});

function FakeQr() {
  return (
    <svg viewBox={`-1 -1 ${SIZE + 2} ${SIZE + 2}`} className="h-full w-full" aria-hidden="true">
      <rect x="-1" y="-1" width={SIZE + 2} height={SIZE + 2} fill="#fff" />
      {CELLS.map((on, i) =>
        on ? (
          <rect key={i} x={i % SIZE} y={Math.floor(i / SIZE)} width="1" height="1" fill="#1C1B1A" />
        ) : null,
      )}
    </svg>
  );
}

/** Fake PromptPay card for the demo payment provider. */
export function PayCard({
  amountSatang,
  shopName,
  secondsLeft,
  expired,
}: {
  amountSatang: number;
  shopName: string;
  secondsLeft: number;
  expired: boolean;
}) {
  const mm = Math.floor(secondsLeft / 60);
  const ss = String(secondsLeft % 60).padStart(2, '0');
  return (
    <section aria-label="ชำระเงินผ่านพร้อมเพย์ (ตัวอย่าง)" className={cx(card, 'overflow-hidden')}>
      <div className="bg-info-ink px-5 py-3 text-center text-sm font-semibold tracking-wide text-white">
        PromptPay · พร้อมเพย์
      </div>
      <div className="px-5 py-5 text-center">
        <p className="text-sm text-muted">{shopName}</p>
        <div className={cx('relative mx-auto mt-3 aspect-square w-52', expired && 'opacity-30')}>
          <FakeQr />
          <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 rotate-[-8deg] bg-surface/90 py-1.5 text-sm font-bold text-danger">
            ตัวอย่าง — สแกนไม่ได้
          </span>
        </div>
        <p className="mt-4 text-sm text-muted">ยอดที่ต้องชำระ</p>
        <p className="text-4xl font-bold">{formatBaht(amountSatang)}</p>
        <p
          className={cx('mt-2 text-sm font-semibold', expired ? 'text-danger' : 'text-muted')}
          aria-live="polite"
        >
          {expired ? 'หมดเวลาชำระเงิน' : `ชำระภายใน ${mm}:${ss} นาที`}
        </p>
      </div>
    </section>
  );
}
