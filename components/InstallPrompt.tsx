'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { DownloadIcon, XIcon } from './icons';
import { card, cx } from './ui';

const KEY = 'imtan:install-dismissed';

interface InstallEvent extends Event {
  prompt: () => Promise<void>;
}

/**
 * "เพิ่มอิ่มทันไว้ในหน้าจอโฮม" (PLAN-V2.md Phase 16). Android/Chrome: the browser's own
 * install prompt. iOS: a link to the existing guide. Hidden once installed or dismissed.
 */
export function InstallPrompt() {
  const [mode, setMode] = useState<'none' | 'android' | 'ios'>('none');
  const [event, setEvent] = useState<InstallEvent | null>(null);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(KEY) === '1';
    } catch {
      // Treat as not dismissed.
    }
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (dismissed || standalone) return;
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as InstallEvent);
      setMode('android');
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    const t = /iphone|ipad|ipod/i.test(navigator.userAgent)
      ? window.setTimeout(() => setMode('ios'), 0)
      : undefined;
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.clearTimeout(t);
    };
  }, []);

  if (mode === 'none') return null;
  const dismiss = () => {
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      // Hidden for this page only.
    }
    setMode('none');
  };

  return (
    <div className={cx(card, 'mt-4 flex items-center gap-3 px-4 py-3')}>
      <DownloadIcon size={24} className="shrink-0 text-primary" />
      {mode === 'android' ? (
        <button
          type="button"
          onClick={async () => {
            await event?.prompt();
            dismiss();
          }}
          className="min-h-11 flex-1 text-left font-semibold"
        >
          เพิ่มอิ่มทันไว้ในหน้าจอโฮม
        </button>
      ) : (
        <Link href="/notifications" className="inline-flex min-h-11 flex-1 items-center font-semibold">
          เพิ่มอิ่มทันไว้ในหน้าจอโฮม (วิธีบน iPhone)
        </Link>
      )}
      <button
        type="button"
        onClick={dismiss}
        aria-label="ปิด"
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted"
      >
        <XIcon size={20} />
      </button>
    </div>
  );
}
