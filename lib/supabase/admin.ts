import 'server-only';

import { createClient } from '@supabase/supabase-js';
import type { Database } from '../database.types';

/**
 * Service-role client: bypasses RLS. Server actions use it only after
 * requireCustomer() / requireVendor() / requireAdmin().
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
