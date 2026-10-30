'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '../database.types';

let client: ReturnType<typeof createBrowserClient<Database>> | null = null;

/** Browser client (anon key, session in cookies). Reads and Realtime only; never writes tables. */
export function getBrowserClient() {
  client ??= createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  return client;
}
