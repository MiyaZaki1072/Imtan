'use client';

import { useRouter } from 'next/navigation';
import { useId, useRef, useState, useSyncExternalStore } from 'react';
import { ShareIcon } from '@/components/icons';
import { btnLarge, btnPrimary, btnSecondary, card, cx, input } from '@/components/ui';

const NAME_MAX = 30;

function isIosSafariNotInstalled(): boolean {
  const ua = navigator.userAgent;
  const ios =
    /iPhone|iPad|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return ios && !standalone;
}

const noop = () => () => {};

export function WelcomeForm() {
  const router = useRouter();
  const nameRef = useRef<HTMLInputElement>(null);
  const nameId = useId();
  const [name, setName] = useState('');
  const [chulaNote, setChulaNote] = useState(false);
  const [iosPath, setIosPath] = useState<'install' | 'order' | null>(null);
  const ios = useSyncExternalStore(noop, isIosSafariNotInstalled, () => false);
  const trimmed = name.trim();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (trimmed.length < 1 || trimmed.length > NAME_MAX) return;
    // Phase 2: create the anonymous Supabase session with this display name.
    router.push('/');
  }

  if (ios && iosPath === 'install') {
    return (
      <section className={cx(card, 'mt-6 bg-info-soft px-5 py-5 text-info-ink')}>
        <h2 className="text-lg font-bold">ติดตั้งก่อน เพื่อรับแจ้งเตือน (ครั้งเดียว)</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5">
          <li>
            กดปุ่ม &quot;แชร์&quot; <ShareIcon size={18} className="inline align-text-bottom" />{' '}
            ด้านล่างของ Safari
          </li>
          <li>เลือก &quot;เพิ่มไปยังหน้าจอโฮม&quot;</li>
          <li>เปิดอิ่มทันจากไอคอนบนหน้าจอโฮม แล้วใส่ชื่อในแอปนั้น</li>
        </ol>
        <p className="mt-3 text-sm">
          แอปบนหน้าจอโฮมไม่ใช้ข้อมูลร่วมกับ Safari จึงต้องใส่ชื่อในแอปที่ติดตั้งแล้ว
        </p>
        <button
          type="button"
          onClick={() => setIosPath(null)}
          className={cx(btnSecondary, 'mt-4 w-full')}
        >
          ย้อนกลับ
        </button>
      </section>
    );
  }

  return (
    <>
      {ios && iosPath === null && (
        <section className="mt-6 space-y-2.5" aria-label="ใช้ iPhone">
          <p className="text-sm font-semibold">ใช้ iPhone? เลือกวิธีที่สะดวก</p>
          <button
            type="button"
            onClick={() => setIosPath('install')}
            className={cx(card, 'w-full px-4 py-3.5 text-left hover:border-primary/40')}
          >
            <span className="block font-semibold">ติดตั้งก่อน เพื่อรับแจ้งเตือน</span>
            <span className="block text-sm text-muted">ทำ 3 ขั้นตอน ครั้งเดียว</span>
          </button>
          <button
            type="button"
            onClick={() => setIosPath('order')}
            className={cx(card, 'w-full px-4 py-3.5 text-left hover:border-primary/40')}
          >
            <span className="block font-semibold">สั่งเลย (ไม่มีแจ้งเตือน — เปิดหน้าคิวไว้)</span>
            <span className="block text-sm text-muted">
              หน้าคิวจะเปลี่ยนเป็นสีเขียวเมื่ออาหารพร้อม
            </span>
          </button>
        </section>
      )}

      {(!ios || iosPath === 'order') && (
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label htmlFor={nameId} className="mb-1.5 block font-semibold">
              ชื่อที่ให้แม่ค้าเรียก
            </label>
            <input
              ref={nameRef}
              id={nameId}
              className={input}
              value={name}
              maxLength={NAME_MAX}
              autoComplete="nickname"
              onChange={(e) => setName(e.target.value)}
              placeholder="เช่น ฝ้าย"
            />
            <p className="mt-1 text-xs text-muted">
              ร้านจะเห็นชื่อนี้คู่กับเลขคิว เช่น บึก-27 · ฝ้าย
            </p>
          </div>
          <button type="submit" disabled={trimmed.length < 1} className={cx(btnPrimary, btnLarge)}>
            เริ่มใช้งาน
          </button>

          <div className="flex items-center gap-3 text-xs text-muted">
            <span className="h-px flex-1 bg-border" />
            หรือ
            <span className="h-px flex-1 bg-border" />
          </div>
          <button
            type="button"
            onClick={() => {
              setChulaNote(true);
              nameRef.current?.focus();
            }}
            className={cx(btnSecondary, btnLarge)}
          >
            เข้าสู่ระบบด้วยบัญชีจุฬาฯ
          </button>
          {chulaNote && (
            <p role="status" className="rounded-xl bg-info-soft px-4 py-3 text-sm text-info-ink">
              ต้นแบบนี้ยังไม่เชื่อมบัญชีจุฬาฯ — ใส่ชื่อเล่นด้านบนแทนได้เลย
            </p>
          )}
        </form>
      )}
    </>
  );
}
