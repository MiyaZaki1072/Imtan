import { cookingWaitSeconds, queuedWaitSeconds } from '../queue';
import type { OrderStatus } from './types';

/** An unpaid order past its expiry reads as expired even before the cron job marks it. */
export function effectiveStatus(
  status: OrderStatus,
  paymentExpiresAt: string | null,
  now: Date,
): OrderStatus {
  if (status === 'awaiting_payment' && paymentExpiresAt && new Date(paymentExpiresAt) <= now) {
    return 'expired';
  }
  return status;
}

/**
 * Seconds left until the food is ready (PLAN.md §4c), counted in dishes:
 * queued → (dishes ahead + my dishes) × s/dish; cooking → my dishes × s/dish − time since start.
 * Null when the order is not waiting.
 */
export function remainingWaitSeconds(
  o: {
    status: OrderStatus;
    dishesAhead: number;
    itemCount: number;
    secondsPerItem: number;
    startedAt: string | null;
  },
  now: Date,
): number | null {
  if (o.status === 'queued') {
    return queuedWaitSeconds(o.dishesAhead, o.itemCount, o.secondsPerItem);
  }
  if (o.status === 'cooking') {
    const since = o.startedAt
      ? Math.max(0, (now.getTime() - new Date(o.startedAt).getTime()) / 1000)
      : 0;
    return cookingWaitSeconds(o.itemCount, o.secondsPerItem, since);
  }
  return null;
}

/** Whole seconds until `iso` by the server's clock (clamped at 0), ignoring a wrong device clock. */
export function secondsUntil(
  iso: string,
  serverNow: string,
  deviceNow: number,
  fetchedAt: number,
): number {
  const skew = new Date(serverNow).getTime() - fetchedAt;
  return Math.max(0, Math.ceil((new Date(iso).getTime() - (deviceNow + skew)) / 1000));
}
