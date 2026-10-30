'use client';

import { useEffect, useId, useRef } from 'react';
import { CheckIcon } from './icons';
import { btnLarge, cx } from './ui';

/**
 * The main "food is ready" alert: full-screen green, vibration and a flashing title.
 * Push is only a bonus on top of this.
 */
export function ReadyAlert({
  label,
  shopName,
  items,
  onReceived,
}: {
  label: string;
  shopName: string;
  items: string[];
  onReceived: () => void;
}) {
  const titleId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    buttonRef.current?.focus();
    try {
      navigator.vibrate?.([300, 150, 300, 150, 600]);
    } catch {
      // Vibration is optional.
    }
    const original = document.title;
    let on = false;
    const timer = window.setInterval(() => {
      on = !on;
      document.title = on ? `พร้อมแล้ว! ${label}` : original;
    }, 1000);
    return () => {
      window.clearInterval(timer);
      document.title = original;
    };
  }, [label]);

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 flex justify-center bg-success text-white"
    >
      <div className="flex w-full max-w-[430px] flex-col px-6 pt-16 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-center">
        <div className="flex flex-1 flex-col items-center justify-center">
          <span className="inline-flex h-28 w-28 items-center justify-center rounded-full bg-white text-success">
            <CheckIcon size={64} strokeWidth={3} />
          </span>
          <h1 id={titleId} className="mt-6 text-4xl font-bold">
            อาหารพร้อมแล้ว!
          </h1>
          <p className="mt-3 text-xl">
            คิว <strong className="text-2xl">{label}</strong> · {shopName}
          </p>
          <ul className="mt-3 space-y-1 text-base text-white/90">
            {items.map((it) => (
              <li key={it}>{it}</li>
            ))}
          </ul>
          <p className="mt-6 rounded-2xl bg-white px-5 py-3 font-semibold text-success">
            แสดงเลขคิวนี้ให้แม่ค้าเพื่อรับอาหาร · ชำระเงินแล้ว
          </p>
        </div>
        <button
          ref={buttonRef}
          type="button"
          onClick={onReceived}
          className={cx(
            btnLarge,
            'inline-flex items-center justify-center rounded-2xl bg-white font-bold text-success',
          )}
        >
          ได้รับอาหารแล้ว
        </button>
        <p className="mt-3 text-sm text-white/85">
          ถ้ายังไม่มารับ แม่ค้ากด &quot;เรียกซ้ำ&quot; เพื่อเตือนอีกครั้งได้
        </p>
      </div>
    </div>
  );
}
