import 'server-only';

import { connection } from 'next/server';
import { demoPaymentsEnabled } from '../payments';
import { createAdminClient } from '../supabase/admin';

export interface PopularMenu {
  menuId: string;
  menuName: string;
  shopSlug: string;
  shopName: string;
  qty: number;
}

const COUNTED = ['queued', 'cooking', 'ready', 'picked_up'] as const;

/** Rank menus by dishes ordered; pure so it can be checked without a database. */
export function topMenus<T extends { menuId: string; qty: number }>(rows: T[], n = 3): T[] {
  const sum = new Map<string, T>();
  for (const r of rows) {
    const prev = sum.get(r.menuId);
    sum.set(r.menuId, prev ? { ...prev, qty: prev.qty + r.qty } : { ...r });
  }
  return [...sum.values()].sort((a, b) => b.qty - a.qty).slice(0, n);
}

/**
 * "เมนูยอดนิยม" (PLAN-V2.md Phase 15): top 3 menus by dishes in real orders over the last
 * 14 days, available menus at open shops only. Simulated orders count only in demo mode.
 * Empty when there is no data, so the section hides. Never hard-coded.
 */
export async function getPopularMenus(): Promise<PopularMenu[]> {
  await connection(); // live data: render at request time
  const since = new Date(Date.now() - 14 * 86_400_000).toISOString();
  let query = createAdminClient()
    .from('order_items')
    .select(
      'menu_id, qty, orders!inner(status, source, created_at), menus!inner(name, is_available, deleted_at, shops!inner(slug, name, is_open))',
    )
    .gte('orders.created_at', since)
    .in('orders.status', COUNTED)
    .limit(5000);
  if (!demoPaymentsEnabled()) query = query.neq('orders.source', 'simulated');
  const { data, error } = await query;
  if (error) {
    console.error('popular menus:', error.message);
    return [];
  }
  const rows = (data ?? [])
    .filter((r) => r.menu_id && r.menus && r.menus.is_available && !r.menus.deleted_at && r.menus.shops?.is_open)
    .map((r): PopularMenu => ({
      menuId: r.menu_id!,
      menuName: r.menus.name,
      shopSlug: r.menus.shops.slug,
      shopName: r.menus.shops.name,
      qty: r.qty,
    }));
  return topMenus(rows);
}
