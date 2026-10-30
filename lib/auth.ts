import 'server-only';

import { redirect } from 'next/navigation';
import { cache } from 'react';
import type { Database } from './database.types';
import { SAMPLE_VENDOR_SHOP } from './sample';
import { createAdminClient } from './supabase/admin';
import { createClient } from './supabase/server';

// Roles are checked on the server from the verified session plus `profiles`.
// Never trust a role or shop id sent by the client.

export type Role = Database['public']['Enums']['user_role'];

export interface Session {
  userId: string;
  displayName: string;
  role: Role;
  shopId: string | null;
}

export class AuthError extends Error {
  constructor(public reason: 'signed_out' | 'forbidden') {
    super(reason === 'signed_out' ? 'Not signed in' : 'Not allowed');
    this.name = 'AuthError';
  }
}

/** The verified session for this request, or null. Cached per request. */
export const getSession = cache(async (): Promise<Session | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return null;
  const { data: profile } = await createAdminClient()
    .from('profiles')
    .select('display_name, role, shop_id')
    .eq('id', userId)
    .maybeSingle();
  if (!profile) return null;
  return {
    userId,
    displayName: profile.display_name,
    role: profile.role,
    shopId: profile.shop_id,
  };
});

/** Any signed-in user (guests are anonymous Supabase users). */
export async function requireCustomer(): Promise<Session> {
  const s = await getSession();
  if (!s) throw new AuthError('signed_out');
  return s;
}

/** The vendor of this shop, or an admin. */
export async function requireVendor(shopId: string): Promise<Session> {
  const s = await getSession();
  if (!s) throw new AuthError('signed_out');
  if (s.role === 'admin') return s;
  if (s.role !== 'vendor' || s.shopId !== shopId) throw new AuthError('forbidden');
  return s;
}

export async function requireAdmin(): Promise<Session> {
  const s = await getSession();
  if (!s) throw new AuthError('signed_out');
  if (s.role !== 'admin') throw new AuthError('forbidden');
  return s;
}

/**
 * For vendor pages: the slug of the shop to show, or a redirect to /login.
 * Admins see the sample shop until the demo shop picker exists (Phase 6).
 */
export const vendorPageShopSlug = cache(async (): Promise<string> => {
  const s = await getSession();
  if (!s || (s.role !== 'vendor' && s.role !== 'admin')) redirect('/login?next=/vendor');
  if (s.role === 'admin') return SAMPLE_VENDOR_SHOP;
  const { data } = await createAdminClient()
    .from('shops')
    .select('slug')
    .eq('id', s.shopId!)
    .single();
  if (!data) redirect('/login');
  return data.slug;
});

/** For admin pages: the admin session, or a redirect to /login. */
export async function adminPageSession(): Promise<Session> {
  const s = await getSession();
  if (!s || s.role !== 'admin') redirect('/login?next=/admin');
  return s;
}
