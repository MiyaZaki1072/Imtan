// Status taps made while the tablet had no signal (PLAN-V2.md Phase 16). Kept in
// localStorage per shop and replayed in order on reconnect, each through the normal
// actSetOrderStatus checks. A rejected replay (the order moved on, e.g. someone else
// changed it later) is dropped, never forced, so a stale queue can't reverse a change.

export interface PendingTap {
  orderId: string;
  label: string;
  status: 'cooking' | 'ready' | 'picked_up';
}

const key = (shopId: string) => `imtan:pending-taps:${shopId}`;

export function loadTaps(shopId: string): PendingTap[] {
  try {
    const raw = JSON.parse(localStorage.getItem(key(shopId)) ?? '[]');
    return Array.isArray(raw) ? (raw as PendingTap[]) : [];
  } catch {
    return [];
  }
}

export function saveTaps(shopId: string, taps: PendingTap[]) {
  try {
    if (taps.length) localStorage.setItem(key(shopId), JSON.stringify(taps));
    else localStorage.removeItem(key(shopId));
  } catch {
    // Without storage the queue lives only in memory for this page.
  }
}

export type SendResult = 'ok' | 'rejected' | 'network';

/**
 * Sends taps in order. Stops at the first network failure and returns what is still
 * pending, plus the taps the server rejected (to tell the vendor).
 */
export async function replayTaps(
  taps: PendingTap[],
  send: (t: PendingTap) => Promise<SendResult>,
): Promise<{ left: PendingTap[]; rejected: PendingTap[] }> {
  const rejected: PendingTap[] = [];
  for (let i = 0; i < taps.length; i++) {
    const r = await send(taps[i]);
    if (r === 'network') return { left: taps.slice(i), rejected };
    if (r === 'rejected') rejected.push(taps[i]);
  }
  return { left: [], rejected };
}
