import 'server-only';

import { createAdminClient } from '../supabase/admin';

/** Dishes already held per pickup slot (ISO time) for a shop's upcoming pre-orders. */
export async function getSlotUsage(shopId: string, now = new Date()): Promise<Record<string, number>> {
  const { data } = await createAdminClient()
    .from('orders')
    .select('pickup_at, item_count, status, payment_expires_at')
    .eq('shop_id', shopId)
    .gte('pickup_at', now.toISOString())
    .in('status', ['awaiting_payment', 'queued', 'cooking', 'ready']);
  const used: Record<string, number> = {};
  for (const o of data ?? []) {
    if (!o.pickup_at) continue;
    if (o.status === 'awaiting_payment' && (!o.payment_expires_at || new Date(o.payment_expires_at) <= now)) continue;
    const key = new Date(o.pickup_at).toISOString();
    used[key] = (used[key] ?? 0) + o.item_count;
  }
  return used;
}
