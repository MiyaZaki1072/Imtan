'use server';

import { requireVendor } from '../auth';
import * as ops from './ops';

// Server actions for the vendor screens. Each one first calls requireVendor(shopId), which
// accepts only that shop's vendor (or an admin), then runs the matching op. The shop id comes
// from the page the vendor is on; it is never trusted without that check.

export async function actSetOrderStatus(
  shopId: string,
  orderId: string,
  status: string,
  reason?: string,
) {
  return ops.setOrderStatus(await requireVendor(shopId), shopId, orderId, status, reason);
}

export async function actRecallOrder(shopId: string, orderId: string) {
  return ops.recallOrder(await requireVendor(shopId), shopId, orderId);
}

export async function actAddQuickWalkIn(shopId: string, count: number) {
  return ops.addQuickWalkIn(await requireVendor(shopId), shopId, count);
}

export async function actAddWalkInOrder(shopId: string, lines: unknown, customerName: unknown) {
  return ops.addWalkInOrder(await requireVendor(shopId), shopId, lines, customerName);
}

export async function actSetIngredientAvailable(
  shopId: string,
  ingredientId: string,
  available: boolean,
) {
  return ops.setIngredientAvailable(await requireVendor(shopId), shopId, ingredientId, available);
}

export async function actSetMenuAvailable(shopId: string, menuId: string, available: boolean) {
  return ops.setMenuAvailable(await requireVendor(shopId), shopId, menuId, available);
}

export async function actSetOptionAvailable(shopId: string, optionId: string, available: boolean) {
  return ops.setOptionAvailable(await requireVendor(shopId), shopId, optionId, available);
}

export async function actSavePrices(shopId: string, changes: unknown) {
  return ops.savePrices(await requireVendor(shopId), shopId, changes);
}

export async function actUpdateShopSettings(shopId: string, input: unknown) {
  return ops.updateShopSettings(await requireVendor(shopId), shopId, input);
}
