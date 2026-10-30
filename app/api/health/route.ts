import { createAdminClient } from '@/lib/supabase/admin';

// Daily Vercel Cron keep-alive (vercel.json): one tiny query so the Supabase project stays awake.
export async function GET() {
  const { count, error } = await createAdminClient()
    .from('shops')
    .select('*', { count: 'exact', head: true });
  if (error) return Response.json({ ok: false }, { status: 503 });
  return Response.json({ ok: true, shops: count });
}
