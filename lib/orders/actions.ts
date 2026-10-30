'use server';

import type { Json } from '../database.types';
import { AuthError, requireCustomer } from '../auth';
import { loadShopBySlug } from '../menu/db';
import { confirmDemoPayment, demoPaymentsEnabled, getPaymentProvider } from '../payments';
import { createAdminClient } from '../supabase/admin';
import { createClient } from '../supabase/server';
import { buildOrder, type BuildError } from './build';
import type { WaitFeedback } from './types';

// Every action checks the session first. Prices are never read from the client:
// placeOrder() reloads the menu from the database and prices the cart with lib/menu.

export type PlaceOrderError = BuildError | 'signed_out' | 'shop_not_found' | 'failed';
export type PlaceOrderResult =
  { ok: true; orderId: string } | { ok: false; error: PlaceOrderError; line?: number };

export async function placeOrder(input: {
  shopSlug: string;
  lines: unknown;
  allergyNote: unknown;
}): Promise<PlaceOrderResult> {
  let session;
  try {
    session = await requireCustomer();
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: 'signed_out' };
    throw e;
  }

  const db = createAdminClient();
  const loaded = await loadShopBySlug(db, String(input.shopSlug));
  if (!loaded) return { ok: false, error: 'shop_not_found' };

  const built = buildOrder(loaded.shop, input.lines, input.allergyNote);
  if (!built.ok) return { ok: false, error: built.error, line: built.line };

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
  });
  if (error || !order) {
    console.error('insert_order failed:', error?.message);
    return { ok: false, error: 'failed' };
  }

  await getPaymentProvider().createPayment({ id: order.id, amountSatang: built.totalSatang });
  return { ok: true, orderId: order.id };
}

export type DemoPayResult =
  { ok: true } | { ok: false; error: 'unavailable' | 'expired' | 'not_payable' };

/** The fake payment. Returns 404-like "unavailable" unless DEMO_PAYMENTS=true. */
export async function demoPay(orderId: string): Promise<DemoPayResult> {
  if (!demoPaymentsEnabled()) return { ok: false, error: 'unavailable' };
  const session = await requireCustomer();

  const { data: order } = await createAdminClient()
    .from('orders')
    .select('id, status')
    .eq('id', orderId)
    .eq('customer_id', session.userId)
    .maybeSingle();
  if (!order || order.status !== 'awaiting_payment') return { ok: false, error: 'not_payable' };

  try {
    const paid = await confirmDemoPayment(orderId);
    if (paid.status === 'expired') return { ok: false, error: 'expired' };
    return { ok: true };
  } catch {
    // The order changed between the check and the payment (expired or abandoned).
    return { ok: false, error: 'not_payable' };
  }
}

// Customer functions check ownership in SQL (auth.uid()), so they run as the user.

export async function abandonOrder(orderId: string): Promise<{ ok: boolean }> {
  await requireCustomer();
  const { error } = await (await createClient()).rpc('abandon_order', { p_order_id: orderId });
  return { ok: !error };
}

export async function markReceived(orderId: string): Promise<{ ok: boolean }> {
  await requireCustomer();
  const { error } = await (await createClient()).rpc('mark_received', { p_order_id: orderId });
  return { ok: !error };
}

const FEEDBACK: WaitFeedback[] = ['faster', 'accurate', 'slower'];

export async function submitFeedback(orderId: string, feedback: string): Promise<{ ok: boolean }> {
  await requireCustomer();
  if (!FEEDBACK.includes(feedback as WaitFeedback)) return { ok: false };
  const { error } = await (
    await createClient()
  ).rpc('submit_feedback', {
    p_order_id: orderId,
    p_feedback: feedback as WaitFeedback,
  });
  return { ok: !error };
}
