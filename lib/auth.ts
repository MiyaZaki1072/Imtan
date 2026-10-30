import 'server-only';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { assertAdmin, assertSignedIn, assertVendorOf, type Session } from './auth-rules';
import { createAdminClient } from './supabase/admin';
import { createClient } from './supabase/server';

// Roles are checked on the server from the verified session plus `profiles`.
// Never trust a role or shop id sent by the client. The rules live in ./auth-rules.

export { AuthError, type Role, type Session } from './auth-rules';

/** Admins see this shop on vendor screens until they pick another on /demo. */
const ADMIN_DEFAULT_SHOP = 'jae-buek';
const ADMIN_SHOP_COOKIE = 'imtan_admin_shop';

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
  return assertSignedIn(await getSession());
}

/** The vendor of this shop, or an admin. */
export async function requireVendor(shopId: string): Promise<Session> {
  return assertVendorOf(await getSession(), shopId);
}

export async function requireAdmin(): Promise<Session> {
  return assertAdmin(await getSession());
}

/** For vendor pages: the shop to show, or a redirect to /login. */
export const vendorPageShop = cache(async (): Promise<{ shopId: string; slug: string }> => {
  const s = await getSession();
  if (!s || (s.role !== 'vendor' && s.role !== 'admin')) redirect('/login?next=/vendor');
  const query = createAdminClient().from('shops').select('id, slug');
  const { data } = await (
    s.role === 'admin'
      ? query.eq('slug', (await cookies()).get(ADMIN_SHOP_COOKIE)?.value ?? ADMIN_DEFAULT_SHOP)
      : query.eq('id', s.shopId ?? '')
  ).maybeSingle();
  if (!data) redirect('/login');
  return { shopId: data.id, slug: data.slug };
});

/** For admin pages: the admin session, or a redirect to /login. */
export async function adminPageSession(): Promise<Session> {
  const s = await getSession();
  if (!s || s.role !== 'admin') redirect('/login?next=/admin');
  return s;
}
