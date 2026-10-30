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
