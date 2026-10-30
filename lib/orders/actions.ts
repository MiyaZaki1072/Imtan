'use server';

import { AuthError, requireCustomer } from '../auth';
import { confirmDemoPayment, demoPaymentsEnabled } from '../payments';
import { createAdminClient } from '../supabase/admin';
import { createClient } from '../supabase/server';
import { createAppOrder, type PlaceOrderResult } from './place';
import { reorderFrom } from './reorder';
import type { WaitFeedback } from './types';

// Every action checks the session first. Prices are never read from the client:
// placeOrder() reloads the menu from the database and prices the cart with lib/menu.

export type { PlaceOrderError, PlaceOrderResult } from './place';

export async function placeOrder(input: {
  shopSlug: string;
  lines: unknown;
  allergyNote: unknown;
  /** ISO time for a pre-order; leave out to queue right after payment. */
  pickupAt?: unknown;
}): Promise<PlaceOrderResult> {
  let session;
  try {
    session = await requireCustomer();
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: 'signed_out' };
    throw e;
  }
  return createAppOrder(session, input);
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

/** "สั่งอีก": the lines of a past order that still work on today's menu. */
export async function actReorder(orderId: string) {
  const session = await requireCustomer();
  return reorderFrom(session.userId, orderId);
}
