import { getSession } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

// Client research events (PLAN.md §5c): own user only, fixed names, small payloads,
// a small per-user rate limit.
const ALLOWED = new Set([
  'shop_viewed',
  'customize_opened',
  'cart_opened',
  'pay_viewed',
  'alert_shown',
  'notif_permission',
]);
const LIMIT = 60; // per minute
const hits = new Map<string, number[]>();

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: 'signed_out' }, { status: 401 });

  const now = Date.now();
  const recent = (hits.get(session.userId) ?? []).filter((t) => now - t < 60_000);
  if (recent.length >= LIMIT) return Response.json({ error: 'rate_limited' }, { status: 429 });
  hits.set(session.userId, [...recent, now]);

  const body = (await req.json().catch(() => null)) as { name?: unknown; props?: unknown } | null;
  if (typeof body?.name !== 'string' || !ALLOWED.has(body.name)) {
    return Response.json({ error: 'bad_input' }, { status: 400 });
  }
  const props =
    body.props && typeof body.props === 'object' && JSON.stringify(body.props).length <= 500
      ? (body.props as Record<string, never>)
      : {};

  await createAdminClient()
    .from('events')
    .insert({ name: body.name, actor_role: session.role, user_id: session.userId, props });
  return Response.json({ ok: true });
}
