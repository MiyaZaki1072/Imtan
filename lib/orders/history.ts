import 'server-only';

import { createAdminClient } from '../supabase/admin';
import type { HistoryEntry } from './types';

/** The customer's finished orders (received or cancelled), newest first. */
export async function getHistory(userId: string, limit = 30): Promise<HistoryEntry[]> {
  const { data } = await createAdminClient()
    .from('orders')
    .select(
      'id, status, queue_label, created_at, total_satang, paid_at, ready_at, shops(slug, name), order_items(kitchen_summary, qty)',
    )
    .eq('customer_id', userId)
    .in('status', ['picked_up', 'cancelled'])
    .order('created_at', { ascending: false })
    .limit(limit);

  return (data ?? [])
    .filter((o) => o.shops)
    .map((o) => ({
      orderId: o.id,
      shopSlug: o.shops!.slug,
      shopName: o.shops!.name,
      queueLabel: o.queue_label,
      status: o.status as HistoryEntry['status'],
      createdAt: o.created_at,
      totalSatang: o.total_satang,
      actualWaitSeconds:
        o.paid_at && o.ready_at
          ? Math.max(0, Math.round((Date.parse(o.ready_at) - Date.parse(o.paid_at)) / 1000))
          : null,
      items: (o.order_items ?? []).map((i) => ({ kitchenSummary: i.kitchen_summary, qty: i.qty })),
    }));
}
