'use client';

import { useEffect, useRef, useState } from 'react';
import type { LoadedShop } from './menu/db';
import { getBrowserClient } from './supabase/client';

const TABLES = [
  'shops',
  'ingredients',
  'menus',
  'options',
  'menu_variants',
  'group_tier_prices',
] as const;

/**
 * A shop's menu that stays current. Realtime is only a nudge: any change refetches the
 * whole menu from the server, as do reconnects and window focus.
 */
export function useLiveShop(initial: LoadedShop): { data: LoadedShop; offline: boolean } {
  const [data, setData] = useState(initial);
  const [offline, setOffline] = useState(false);
  const timer = useRef<number | null>(null);
  const slug = initial.shop.slug;
  const shopId = initial.shop.id;

  useEffect(() => {
    let active = true;
    const refetch = () => {
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(async () => {
        try {
          const res = await fetch(`/api/shops/${slug}/menu`, { cache: 'no-store' });
          if (res.ok && active) setData((await res.json()) as LoadedShop);
        } catch {
          // Network blip: the next nudge, focus or reconnect tries again.
        }
      }, 250);
    };

    const supabase = getBrowserClient();
    const channel = supabase.channel(`shop-menu:${shopId}`);
    for (const table of TABLES) {
      // Rows without shop_id (options, variants, tiers) can't be filtered; any change refetches.
      const filter =
        table === 'shops'
          ? `id=eq.${shopId}`
          : table === 'ingredients' || table === 'menus'
            ? `shop_id=eq.${shopId}`
            : undefined;
      channel.on('postgres_changes', { event: '*', schema: 'public', table, filter }, refetch);
    }
    channel.subscribe((status) => {
      if (!active) return;
      if (status === 'SUBSCRIBED') {
        setOffline(false);
        refetch();
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        setOffline(true);
      }
    });

    const onOnline = () => {
      setOffline(false);
      refetch();
    };
    const onOffline = () => setOffline(true);
    const onVisible = () => document.visibilityState === 'visible' && refetch();
    window.addEventListener('focus', refetch);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      active = false;
      if (timer.current) window.clearTimeout(timer.current);
      supabase.removeChannel(channel);
      window.removeEventListener('focus', refetch);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [slug, shopId]);

  return { data, offline };
}
