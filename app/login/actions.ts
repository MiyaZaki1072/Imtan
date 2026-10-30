'use server';

import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

// Accounts are <username>@imtan.local in Supabase Auth.
// Vendors tap their shop: the server signs them in with VENDOR_LOGIN_PASSWORD, which
// never leaves the server. Anyone with the /login URL can do this (prototype decision).

function safeNext(next: FormDataEntryValue | null, fallback: string): string {
  return typeof next === 'string' && next.startsWith('/') && !next.startsWith('//')
    ? next
    : fallback;
}

export async function vendorQuickLogin(formData: FormData): Promise<void> {
  const slug = formData.get('slug');
  const { data: shop } =
    typeof slug === 'string'
      ? await createAdminClient().from('shops').select('slug').eq('slug', slug).maybeSingle()
      : { data: null };
  if (typeof slug !== 'string' || !shop) {
    redirect('/login?error=shop');
  }
  const password = process.env.VENDOR_LOGIN_PASSWORD;
  if (!password) throw new Error('VENDOR_LOGIN_PASSWORD is not set');
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: `${slug}@imtan.local`,
    password,
  });
  if (error) redirect('/login?error=vendor');
  redirect('/vendor');
}

export interface AdminLoginState {
  error: string | null;
}

export async function adminLogin(
  _prev: AdminLoginState,
  formData: FormData,
): Promise<AdminLoginState> {
  const username = String(formData.get('username') ?? '')
    .trim()
    .toLowerCase();
  const password = String(formData.get('password') ?? '');
  if (!/^[a-z0-9-]{1,40}$/.test(username) || password.length === 0) {
    return { error: 'ใส่ชื่อผู้ใช้และรหัสผ่าน' };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: `${username}@imtan.local`,
    password,
  });
  if (error) return { error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' };
  // Vendors with their own password sign in here too; send each role to its own home.
  const { data: claims } = await supabase.auth.getClaims();
  const { data: profile } = await createAdminClient()
    .from('profiles')
    .select('role')
    .eq('id', claims?.claims?.sub ?? '')
    .maybeSingle();
  if (profile?.role === 'vendor') redirect('/vendor');
  redirect(safeNext(formData.get('next'), '/admin'));
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
