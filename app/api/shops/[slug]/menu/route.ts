import { connection } from 'next/server';
import { getShopFromDb } from '@/lib/shops';

// Fresh menu, prices and stats for one shop. Open shop pages refetch this when Realtime
// says something changed, on reconnect and on window focus.
export async function GET(_req: Request, ctx: RouteContext<'/api/shops/[slug]/menu'>) {
  await connection();
  const { slug } = await ctx.params;
  const loaded = await getShopFromDb(slug);
  if (!loaded) return Response.json({ error: 'not_found' }, { status: 404 });
  return Response.json(loaded, { headers: { 'Cache-Control': 'no-store' } });
}
