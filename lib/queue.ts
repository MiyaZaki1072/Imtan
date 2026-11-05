// Busy level and wait rules from PLAN.md §4c. Waits count dishes, not orders.

export type BusyLevel = 'ว่าง' | 'ปานกลาง' | 'แน่น';

/** ว่าง < 5 min ≤ ปานกลาง ≤ 12 min < แน่น */
export function busyLevel(waitSeconds: number): BusyLevel {
  if (waitSeconds < 5 * 60) return 'ว่าง';
  if (waitSeconds <= 12 * 60) return 'ปานกลาง';
  return 'แน่น';
}

/** Wait while queued: (dishes ahead + my dishes) × seconds per dish. */
export function queuedWaitSeconds(
  dishesAhead: number,
  myDishes: number,
  secondsPerItem: number,
): number {
  return (dishesAhead + myDishes) * secondsPerItem;
}

/** Wait while cooking: max(0, my dishes × seconds per dish − time since started). */
export function cookingWaitSeconds(
  myDishes: number,
  secondsPerItem: number,
  secondsSinceStart: number,
): number {
  return Math.max(0, myDishes * secondsPerItem - secondsSinceStart);
}

/**
 * Wait shown to customers as a range (PLAN-V2.md D4): low = round(0.85 × min),
 * high = ceil(1.3 × min). Always low ≥ 1 and high > low. 6 min → 5–8.
 */
export function waitRangeMinutes(seconds: number): { low: number; high: number } {
  const min = Math.max(0, seconds) / 60;
  const low = Math.max(1, Math.round(0.85 * min));
  const high = Math.max(low + 1, Math.ceil(1.3 * min));
  return { low, high };
}

/** True when an actual wait landed inside the range promised for `estimatedSeconds`. */
export function withinWaitRange(actualSeconds: number, estimatedSeconds: number): boolean {
  const { high } = waitRangeMinutes(estimatedSeconds);
  return actualSeconds / 60 <= high;
}
