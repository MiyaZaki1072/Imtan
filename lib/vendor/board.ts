import 'server-only';

import { createAdminClient } from '../supabase/admin';
import type { VendorBoardData, VendorOrder } from './types';

/**
 * The open orders of one shop: paid app orders and every walk-in. Unpaid app orders never
 * appear (same rule as the RLS policy). Caller must have passed requireVendor(shopId).
 */
export async function getVendorBoard(shopId: string): Promise<VendorBoardData | null> {
  const db = createAdminClient();
  const { data: shop } = await db
    .from('shops')
    .select(
      'id, name, queue_prefix, is_open, wait_mode, manual_seconds_per_item, learned_seconds_per_item, items_in_queue',
    )
    .eq('id', shopId)
    .maybeSingle();
  if (!shop) return null;

  const { data: rows } = await db
    .from('orders')
    .select(
      'id, queue_no, queue_label, customer_name, source, status, item_count, total_satang, allergy_note, queued_at, started_at, ready_at, last_called_at, pickup_at, release_at, order_items(menu_name, kitchen_summary, qty, note)',
    )
    .eq('shop_id', shopId)
    .in('status', ['queued', 'cooking', 'ready'])
    .or('paid_at.not.is.null,source.neq.app')
    .order('queue_no');

  const orders: VendorOrder[] = (rows ?? [])
    .filter((r) => r.queue_no !== null && r.queue_label !== null && r.queued_at !== null)
    .map((r) => ({
      id: r.id,
      queueNo: r.queue_no!,
      queueLabel: r.queue_label!,
      customerName: r.customer_name,
      source: r.source,
      status: r.status as VendorOrder['status'],
      itemCount: r.item_count,
      totalSatang: r.total_satang,
      allergyNote: r.allergy_note,
      items: (r.order_items ?? []).map((i) => ({
        menuName: i.menu_name,
        kitchenSummary: i.kitchen_summary,
        qty: i.qty,
        note: i.note,
      })),
      pickupAt: r.pickup_at,
      releaseAt: r.release_at,
      queuedAt: r.queued_at!,
      startedAt: r.started_at,
      readyAt: r.ready_at,
      lastCalledAt: r.last_called_at,
    }));

  return {
    shopId: shop.id,
    shopName: shop.name,
    queuePrefix: shop.queue_prefix,
    isOpen: shop.is_open,
    waitMode: shop.wait_mode,
    secondsPerItem:
      shop.wait_mode === 'manual'
        ? shop.manual_seconds_per_item
        : (shop.learned_seconds_per_item ?? shop.manual_seconds_per_item),
    itemsInQueue: shop.items_in_queue,
    orders,
    serverNow: new Date().toISOString(),
  };
}
