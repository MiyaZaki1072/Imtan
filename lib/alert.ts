'use client';

import { useEffect } from 'react';

// In-page "food is ready" helpers (PLAN.md §5): chime, and Wake Lock while waiting.
// Browsers only allow sound after a tap, so audio is armed on the first interaction.

let ctx: AudioContext | null = null;

function arm() {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    // No Web Audio: the alert still shows, flashes the title and vibrates.
  }
}

/** Arms audio on the first tap or key press anywhere on the page. */
export function useArmAudio() {
  useEffect(() => {
    const events = ['pointerdown', 'keydown'] as const;
    const once = () => {
      arm();
      events.forEach((e) => window.removeEventListener(e, once));
    };
    events.forEach((e) => window.addEventListener(e, once, { once: true }));
    return () => events.forEach((e) => window.removeEventListener(e, once));
  }, []);
}

/** A short three-note chime. Silent if audio was never armed. */
export function playChime() {
  if (!ctx || ctx.state !== 'running') return;
  const start = ctx.currentTime;
  [880, 1174.66, 1318.51].forEach((freq, i) => {
    const osc = ctx!.createOscillator();
    const gain = ctx!.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const t = start + i * 0.22;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.35, t + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    osc.connect(gain).connect(ctx!.destination);
    osc.start(t);
    osc.stop(t + 0.55);
  });
}

/** Keeps the screen on while `active`, and takes the lock back after the tab was hidden. */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let stopped = false;
    const request = async () => {
      try {
        lock = await navigator.wakeLock.request('screen');
        if (stopped) void lock.release();
      } catch {
        // Denied (low battery, unsupported): the order page still works.
      }
    };
    const onVisible = () => document.visibilityState === 'visible' && void request();
    void request();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stopped = true;
      document.removeEventListener('visibilitychange', onVisible);
      void lock?.release();
    };
  }, [active]);
}
