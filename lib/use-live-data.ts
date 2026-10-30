'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getBrowserClient } from './supabase/client';

export interface Watch {
  table: string;
  /** PostgREST filter such as `id=eq.<uuid>`. Leave out to watch the whole table. */
  filter?: string;
}

/**
 * Server data that stays current. Realtime is only a nudge: any matching change refetches
 * `url`, as do reconnects, window focus and a slow timer (so a dropped socket can't strand
 * a screen). `fetchedAt` is the device time of the last fetch, for clock-skew maths.
 */
export function useLiveData<T>(
  url: string,
  initial: T,
  watches: Watch[],
  channelKey: string,
  pollMs = 15000,
): { data: T; offline: boolean; fetchedAt: number; refresh: () => void } {
  const [state, setState] = useState(() => ({ data: initial, fetchedAt: Date.now() }));
  const [offline, setOffline] = useState(false);
  const timer = useRef<number | null>(null);
  const alive = useRef(true);
  // Watches are compared by value so a new array each render doesn't resubscribe.
  const watchKey = JSON.stringify(watches);

  const refetch = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (res.ok && alive.current) {
          setState({ data: (await res.json()) as T, fetchedAt: Date.now() });
          setOffline(false);
        }
      } catch {
        if (alive.current) setOffline(true);
      }
    }, 150);
  }, [url]);

  useEffect(() => {
    alive.current = true;
    const supabase = getBrowserClient();
    const channel = supabase.channel(channelKey);
    for (const w of JSON.parse(watchKey) as Watch[]) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: w.table, filter: w.filter },
        refetch,
      );
    }
    channel.subscribe((status) => {
      if (!alive.current) return;
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
    const poll = window.setInterval(
      () => document.visibilityState === 'visible' && refetch(),
      pollMs,
    );

    return () => {
      alive.current = false;
      if (timer.current) window.clearTimeout(timer.current);
      window.clearInterval(poll);
      supabase.removeChannel(channel);
      window.removeEventListener('focus', refetch);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [channelKey, watchKey, refetch, pollMs]);

  return {
    data: state.data,
    offline,
    fetchedAt: state.fetchedAt,
    refresh: refetch,
  };
}
