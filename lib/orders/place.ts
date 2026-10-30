import 'server-only';

import type { Session } from '../auth-rules';
import type { Json } from '../database.types';
import { loadShopBySlug } from '../menu/db';
import { getPaymentProvider } from '../payments';
import { createAdminClient } from '../supabase/admin';
import { buildOrder, type BuildError } from './build';
import { checkPickup, releaseAt } from './preorder';

// Creates an unpaid app order for a signed-in customer. Prices are never read from the client:
// the menu is reloaded from the database and priced with lib/menu. With `pickupAt` it is a
// pre-order: the shop is told to start at release_at (see ./preorder), after payment.

export type PlaceOrderError =
  | BuildError
  | 'signed_out'
  | 'shop_not_found'
  | 'pickup_invalid'
  | 'pickup_too_soon'
  | 'pickup_too_far'
  | 'failed';

export type PlaceOrderResult =
  { ok: true; orderId: string } | { ok: false; error: PlaceOrderError; line?: number };

export async function createAppOrder(
  session: Session,
  input: { shopSlug: string; lines: unknown; allergyNote: unknown; pickupAt?: unknown },
  now: Date = new Date(),
): Promise<PlaceOrderResult> {
  const db = createAdminClient();
  const loaded = await loadShopBySlug(db, String(input.shopSlug));
  if (!loaded) return { ok: false, error: 'shop_not_found' };

  const built = buildOrder(loaded.shop, input.lines, input.allergyNote);
  if (!built.ok) return { ok: false, error: built.error, line: built.line };

  let pickup: Date | null = null;
  let release: Date | null = null;
  if (input.pickupAt !== undefined && input.pickupAt !== null && input.pickupAt !== '') {
    pickup = new Date(String(input.pickupAt));
    const check = checkPickup(pickup, now, built.itemCount, loaded.stats.secondsPerItem);
    if (check !== 'ok') return { ok: false, error: `pickup_${check}` as PlaceOrderError };
    release = releaseAt(pickup, built.itemCount, loaded.stats.secondsPerItem);
  }

  // A customer has one open payment per shop: an older unpaid order is abandoned.
  const { data: stale } = await db
    .from('orders')
    .update({ status: 'abandoned' })
    .eq('customer_id', session.userId)
    .eq('shop_id', loaded.shop.id)
    .eq('status', 'awaiting_payment')
    .select('id');
  if (stale?.length) {
    await db
      .from('payments')
      .update({ status: 'abandoned' })
      .in(
        'order_id',
        stale.map((s) => s.id),
      )
      .eq('status', 'pending');
  }

  const { data: order, error } = await db.rpc('insert_order', {
    p_shop_id: loaded.shop.id,
    p_customer_id: session.userId,
    p_customer_name: session.displayName,
    p_source: 'app',
    p_items: built.items as unknown as Json,
    p_total_satang: built.totalSatang,
    p_allergy_note: built.allergyNote ?? undefined,
    p_pickup_at: pickup?.toISOString(),
    p_release_at: release?.toISOString(),
  });
  if (error || !order) {
    console.error('insert_order failed:', error?.message);
    return { ok: false, error: 'failed' };
  }

  await getPaymentProvider().createPayment({ id: order.id, amountSatang: built.totalSatang });
  return { ok: true, orderId: order.id };
}
