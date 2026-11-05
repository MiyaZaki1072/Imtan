import type { VendorOrder } from './types';

/**
 * Board order (PLAN-V2.md Phase 14): by effective start time, which is release_at for
 * pre-orders and queued_at otherwise; ties by queue number.
 */
export function sortByStart<T extends Pick<VendorOrder, 'releaseAt' | 'queuedAt' | 'queueNo'>>(
  orders: T[],
): T[] {
  const start = (o: T) => Date.parse(o.releaseAt ?? o.queuedAt);
  return [...orders].sort((a, b) => start(a) - start(b) || a.queueNo - b.queueNo);
}
