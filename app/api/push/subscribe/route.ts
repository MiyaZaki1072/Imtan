import { getSession } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

// Stores this device's push subscription for the signed-in user. Clients never write tables:
// the browser only sends the subscription; this route saves it with the service role.
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: 'signed_out' }, { status: 401 });

  const body = (await req.json().catch(() => null)) as {
    endpoint?: unknown;
    keys?: { p256dh?: unknown; auth?: unknown };
  } | null;
  const endpoint = body?.endpoint;
  const p256dh = body?.keys?.p256dh;
  const auth = body?.keys?.auth;
  if (
    typeof endpoint !== 'string' ||
    !endpoint.startsWith('https://') ||
    endpoint.length > 1000 ||
    typeof p256dh !== 'string' ||
    typeof auth !== 'string' ||
    p256dh.length > 200 ||
    auth.length > 100
  ) {
    return Response.json({ error: 'bad_input' }, { status: 400 });
  }

  const { error } = await createAdminClient()
    .from('push_subscriptions')
    .upsert({ user_id: session.userId, endpoint, p256dh, auth }, { onConflict: 'endpoint' });
  if (error) return Response.json({ error: 'failed' }, { status: 500 });
  return Response.json({ ok: true });
}
