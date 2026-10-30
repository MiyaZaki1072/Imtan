import 'server-only';

import { createAdminClient } from '../supabase/admin';
import type { OrderStatus, OrderViewData } from './types';
import { effectiveStatus } from './wait';

/**
 * One order as its owner sees it. Reads with the service role after checking the order
 * belongs to `userId`, because dishes-ahead needs other customers' orders (which RLS hides).
 */
export async function getOrderView(orderId: string, userId: string): Promise<OrderViewData | null> {
  const db = createAdminClient();
  const { data: o } = await db
    .from('orders')
    .select(
      '*, order_items(menu_name, kitchen_summary, qty, note), shops(slug, name, wait_mode, manual_seconds_per_item, learned_seconds_per_item)',
    )
    .eq('id', orderId)
    .eq('customer_id', userId)
    .maybeSingle();
  if (!o || !o.shops) return null;

  const now = new Date();
  const status = effectiveStatus(o.status as OrderStatus, o.payment_expires_at, now);
  const shop = o.shops;
  const secondsPerItem =
    shop.wait_mode === 'manual'
      ? shop.manual_seconds_per_item
      : (shop.learned_seconds_per_item ?? shop.manual_seconds_per_item);

  let dishesAhead = 0;
  if ((status === 'queued' || status === 'cooking') && o.queued_at && o.queue_no !== null) {
    const { data: queue } = await db
      .from('orders')
      .select('item_count, queued_at, queue_no, release_at')
      .eq('shop_id', o.shop_id)
      .in('status', ['queued', 'cooking']);
    const mine = new Date(o.queued_at).getTime();
    dishesAhead = (queue ?? [])
      .filter((q) => q.queued_at !== null && q.queue_no !== null)
      .filter((q) => !q.release_at || new Date(q.release_at) <= now)
      .filter((q) => {
        const t = new Date(q.queued_at!).getTime();
        return t < mine || (t === mine && q.queue_no! < o.queue_no!);
      })
      .reduce((sum, q) => sum + q.item_count, 0);
  }

  return {
    id: o.id,
    shopId: o.shop_id,
    shopSlug: shop.slug,
    shopName: shop.name,
    status,
    queueLabel: o.queue_label,
    customerName: o.customer_name,
    itemCount: o.item_count,
    totalSatang: o.total_satang,
    items: (o.order_items ?? []).map((i) => ({
      menuName: i.menu_name,
      kitchenSummary: i.kitchen_summary,
      qty: i.qty,
      note: i.note,
    })),
    allergyNote: o.allergy_note,
    paymentExpiresAt: o.payment_expires_at,
    pickupAt: o.pickup_at,
    releaseAt: o.release_at,
    paidAt: o.paid_at,
    queuedAt: o.queued_at,
    startedAt: o.started_at,
    readyAt: o.ready_at,
    pickedUpAt: o.picked_up_at,
    lastCalledAt: o.last_called_at,
    feedback: o.feedback,
    estimatedWaitSeconds: o.estimated_wait_seconds,
    dishesAhead,
    secondsPerItem,
    serverNow: now.toISOString(),
  };
}

/** The customer's newest order that still needs attention, else their newest order. */
export async function getLatestOrderId(userId: string): Promise<string | null> {
  const db = createAdminClient();
  const { data } = await db
    .from('orders')
    .select('id, status, payment_expires_at, created_at')
    .eq('customer_id', userId)
    .order('created_at', { ascending: false })
    .limit(10);
  const now = new Date();
  const rows = data ?? [];
  const active = rows.find((r) => {
    const s = effectiveStatus(r.status as OrderStatus, r.payment_expires_at, now);
    return s === 'queued' || s === 'cooking' || s === 'ready' || s === 'awaiting_payment';
  });
  return (active ?? rows[0])?.id ?? null;
}
