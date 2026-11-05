'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { actRandomMenu } from '@/lib/orders/actions';
import { DiceIcon } from './icons';
import { btnSecondary, cx } from './ui';

/** "สุ่มเมนู": opens a random orderable menu at an open shop. */
export function RandomMenuButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [empty, setEmpty] = useState(false);
  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await actRandomMenu().catch(() => null);
            if (r) router.push(r.href);
            else setEmpty(true);
          })
        }
        className={cx(btnSecondary, 'min-h-12 w-full')}
      >
        <DiceIcon size={20} />
        {pending ? 'กำลังสุ่ม…' : 'ไม่รู้จะกินอะไร? สุ่มเมนู'}
      </button>
      {empty && (
        <p className="mt-1 text-center text-sm text-muted" role="status">
          ตอนนี้ไม่มีเมนูที่สั่งได้
        </p>
      )}
    </div>
  );
}
