import 'server-only';

import { createAdminClient } from '../supabase/admin';
import { isScheduled } from './preorder';
import type { HomeMine, OrderStatus, OrderViewData } from './types';
import { effectiveStatus, remainingWaitSeconds } from './wait';

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
    shopRating: o.shop_rating,
    ratingComment: o.rating_comment,
    estimatedWaitSeconds: o.estimated_wait_seconds,
    dishesAhead,
    secondsPerItem,
    waitMode: shop.wait_mode === 'manual' ? 'manual' : 'auto',
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

const OPEN: OrderStatus[] = ['awaiting_payment', 'queued', 'cooking', 'ready'];

/** The customer's open orders (unpaid, queued, cooking, ready), newest first, at most 5. */
export async function getOpenOrderIds(userId: string): Promise<string[]> {
  const { data } = await createAdminClient()
    .from('orders')
    .select('id, status, payment_expires_at')
    .eq('customer_id', userId)
    .in('status', OPEN)
    .order('created_at', { ascending: false })
    .limit(5);
  const now = new Date();
  return (data ?? [])
    .filter((r) => OPEN.includes(effectiveStatus(r.status as OrderStatus, r.payment_expires_at, now)))
    .map((r) => r.id);
}

/** Open orders as cards for Home and the "คิวของฉัน" list. */
export async function getOpenOrders(userId: string): Promise<HomeMine[]> {
  const ids = await getOpenOrderIds(userId);
  const views = await Promise.all(ids.map((id) => getOrderView(id, userId)));
  return views
    .filter((o): o is OrderViewData => o !== null && OPEN.includes(o.status))
    .map((o) => {
      const now = new Date(o.serverNow);
      const scheduled = o.status === 'queued' && isScheduled(o.releaseAt, now);
      return {
        orderId: o.id,
        shopName: o.shopName,
        pickupAt: scheduled ? o.pickupAt : null,
        queueLabel: o.queueLabel,
        status: o.status,
        waitSeconds:
          o.status === 'queued' || o.status === 'cooking' ? remainingWaitSeconds(o, now) : null,
      };
    });
}
