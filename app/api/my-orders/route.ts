import { getUserId } from '@/lib/auth';
import { getOpenOrders } from '@/lib/orders/view';

/** The signed-in customer's open orders. Only ever their own: the user id comes from the session. */
export async function GET() {
  const userId = await getUserId();
  if (!userId) return Response.json({ error: 'signed_out' }, { status: 401 });
  return Response.json(await getOpenOrders(userId), {
    headers: { 'Cache-Control': 'no-store' },
  });
}
