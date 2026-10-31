import { getUserId } from '@/lib/auth';
import { getOrderView } from '@/lib/orders/view';

// The caller's own order, fresh. Open order pages refetch this on a Realtime nudge,
// on reconnect, on window focus and on a slow timer.
export async function GET(_req: Request, ctx: RouteContext<'/api/orders/[id]'>) {
  const userId = await getUserId();
  if (!userId) return Response.json({ error: 'signed_out' }, { status: 401 });
  const { id } = await ctx.params;
  const view = await getOrderView(id, userId);
  if (!view) return Response.json({ error: 'not_found' }, { status: 404 });
  return Response.json(view, { headers: { 'Cache-Control': 'no-store' } });
}
