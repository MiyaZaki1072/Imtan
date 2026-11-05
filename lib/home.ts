import 'server-only';

import { getOpenOrders } from './orders/view';
import type { HomeData } from './orders/types';
import { createAdminClient } from './supabase/admin';

/** Every shop's live queue (written only by refresh_shop_stats) plus the user's open orders. */
export async function getHomeData(userId: string): Promise<HomeData> {
  // The shop list and the user's order chain don't depend on each other: run them together.
  const [{ data }, mine] = await Promise.all([
    createAdminClient()
      .from('shops')
      .select('slug, name, category, is_open, items_in_queue, est_wait_seconds, busy_level, rating_avg, rating_count')
      .order('name'),
    getOpenOrders(userId),
  ]);

  const shops: HomeData['shops'] = (data ?? []).map((s) => ({
    slug: s.slug,
    name: s.name,
    category: s.category,
    isOpen: s.is_open,
    itemsInQueue: s.items_in_queue,
    estWaitSeconds: s.est_wait_seconds,
    busyLevel: s.busy_level as HomeData['shops'][number]['busyLevel'],
    ratingAvg: s.rating_avg,
    ratingCount: s.rating_count,
  }));

  return { userId, shops, mine };
}
