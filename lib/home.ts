import 'server-only';

import { getLatestOrderId, getOrderView } from './orders/view';
import { remainingWaitSeconds } from './orders/wait';
import type { HomeData } from './orders/types';
import { createAdminClient } from './supabase/admin';

const SHOWN = new Set(['queued', 'cooking', 'ready', 'awaiting_payment']);

/** Every shop's live queue (written only by refresh_shop_stats) plus the user's open order. */
export async function getHomeData(userId: string): Promise<HomeData> {
  const { data } = await createAdminClient()
    .from('shops')
    .select('slug, name, category, is_open, items_in_queue, est_wait_seconds, busy_level')
    .order('name');

  const shops: HomeData['shops'] = (data ?? []).map((s) => ({
    slug: s.slug,
    name: s.name,
    category: s.category,
    isOpen: s.is_open,
    itemsInQueue: s.items_in_queue,
    estWaitSeconds: s.est_wait_seconds,
    busyLevel: s.busy_level as HomeData['shops'][number]['busyLevel'],
  }));

  let mine: HomeData['mine'] = null;
  const orderId = await getLatestOrderId(userId);
  const order = orderId ? await getOrderView(orderId, userId) : null;
  if (order && SHOWN.has(order.status)) {
    mine = {
      orderId: order.id,
      shopName: order.shopName,
      queueLabel: order.queueLabel,
      status: order.status,
      waitSeconds: remainingWaitSeconds(order, new Date(order.serverNow)),
    };
  }
  return { userId, shops, mine };
}
