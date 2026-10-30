// Pre-order timing (PLAN.md Phase 8). The customer picks a pickup time; the shop is told to
// start `release_at = pickup_at − (dishes × seconds per dish) − 3 min`, rounded to the minute,
// so the food is ready when they arrive. Until release the order is paid and numbered but
// does not count toward the queue or the wait times.

export const RELEASE_LEAD_SECONDS = 3 * 60;
/** Extra time before the earliest pickup, so the shop is not told to start in the past. */
export const EARLIEST_BUFFER_SECONDS = 5 * 60;
export const MAX_AHEAD_SECONDS = 3 * 60 * 60;
export const SLOT_STEP_MINUTES = 10;

const MINUTE = 60_000;
const roundToMinute = (ms: number) => Math.round(ms / MINUTE) * MINUTE;
const ceilTo = (ms: number, stepMs: number) => Math.ceil(ms / stepMs) * stepMs;

/** When the shop should start cooking for this pickup time. */
export function releaseAt(pickupAt: Date, itemCount: number, secondsPerItem: number): Date {
  return new Date(
    roundToMinute(pickupAt.getTime() - (itemCount * secondsPerItem + RELEASE_LEAD_SECONDS) * 1000),
  );
}

/** The earliest pickup that still gives the shop time to cook (on a 5-minute mark). */
export function earliestPickup(now: Date, itemCount: number, secondsPerItem: number): Date {
  const ms =
    now.getTime() +
    (itemCount * secondsPerItem + RELEASE_LEAD_SECONDS + EARLIEST_BUFFER_SECONDS) * 1000;
  return new Date(ceilTo(ms, 5 * MINUTE));
}

export type PickupCheck = 'ok' | 'invalid' | 'too_soon' | 'too_far';

export function checkPickup(
  pickupAt: Date,
  now: Date,
  itemCount: number,
  secondsPerItem: number,
): PickupCheck {
  if (Number.isNaN(pickupAt.getTime())) return 'invalid';
  // The shop must still be told to start in the future (slots offered a few minutes ago stay valid).
  if (releaseAt(pickupAt, itemCount, secondsPerItem).getTime() < now.getTime()) return 'too_soon';
  if (pickupAt.getTime() > now.getTime() + MAX_AHEAD_SECONDS * 1000) return 'too_far';
  return 'ok';
}

/** Pickup times to offer: every 10 minutes from the earliest, up to 3 hours ahead. */
export function pickupSlots(
  now: Date,
  itemCount: number,
  secondsPerItem: number,
  count = 12,
): Date[] {
  const first = earliestPickup(now, itemCount, secondsPerItem).getTime();
  const limit = now.getTime() + MAX_AHEAD_SECONDS * 1000;
  const slots: Date[] = [];
  for (let t = first; slots.length < count && t <= limit; t += SLOT_STEP_MINUTES * MINUTE) {
    slots.push(new Date(t));
  }
  return slots;
}

/** A paid pre-order that the shop has not been told to start yet. */
export function isScheduled(releaseAtIso: string | null, now: Date): boolean {
  return !!releaseAtIso && new Date(releaseAtIso).getTime() > now.getTime();
}
