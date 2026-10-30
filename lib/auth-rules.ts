// Who may do what. Pure functions: no cookies, no database, so they are easy to test.
// lib/auth.ts supplies the verified session; vendor ops check it again (defence in depth).

export type Role = 'customer' | 'vendor' | 'admin';

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

/** Any signed-in user (guests are anonymous Supabase users). */
export function assertSignedIn(s: Session | null): Session {
  if (!s) throw new AuthError('signed_out');
  return s;
}

/** The vendor of exactly this shop, or an admin. A vendor can never act on another shop. */
export function assertVendorOf(s: Session | null, shopId: string): Session {
  const session = assertSignedIn(s);
  if (session.role === 'admin') return session;
  if (session.role !== 'vendor' || !session.shopId || session.shopId !== shopId) {
    throw new AuthError('forbidden');
  }
  return session;
}

export function assertAdmin(s: Session | null): Session {
  const session = assertSignedIn(s);
  if (session.role !== 'admin') throw new AuthError('forbidden');
  return session;
}
