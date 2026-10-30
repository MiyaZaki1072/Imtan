'use server';

import { requireAdmin, requireVendor } from '../auth';
import { demoPaymentsEnabled } from '../payments';
import * as ops from './ops';

// Demo tools answer "unavailable" (the screens 404) unless DEMO_PAYMENTS=true.
const unavailable = { ok: false, error: 'unavailable' } as const;

/** One simulated order: admin (rush) or the shop's own vendor (interview mode). */
export async function actSimulateOrder(shopId: string) {
  if (!demoPaymentsEnabled()) return unavailable;
  return ops.simulateOrder(await requireVendor(shopId), shopId);
}

export async function actResetDemo(target: string) {
  if (!demoPaymentsEnabled()) return unavailable;
  return ops.resetDemoTool(await requireAdmin(), target);
}

export async function actSetAutoAdvance(target: string, on: boolean) {
  if (!demoPaymentsEnabled()) return unavailable;
  return ops.setAutoAdvance(await requireAdmin(), target, on);
}

export async function actSetAdminShop(slug: string) {
  if (!demoPaymentsEnabled()) return unavailable;
  return ops.setAdminShop(await requireAdmin(), slug);
}
