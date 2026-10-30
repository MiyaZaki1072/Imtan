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

// Admin app (Phase 9): these work in production too, so they are not behind DEMO_PAYMENTS.

export async function actCreateShop(input: unknown) {
  return ops.createShopWithAccount(await requireAdmin(), input);
}

export async function actResetVendorPassword(shopId: string, password?: string) {
  return ops.resetVendorPassword(await requireAdmin(), shopId, password);
}

/** Choose which shop the vendor screens (menu, stock, settings, board) show for this admin. */
export async function actSelectShop(slug: string) {
  return ops.setAdminShop(await requireAdmin(), slug);
}
