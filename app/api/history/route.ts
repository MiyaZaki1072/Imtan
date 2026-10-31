import { getUserId } from '@/lib/auth';
import { getHistory } from '@/lib/orders/history';

// The caller's finished orders (for "ประวัติการสั่ง" and the summary screen).
export async function GET(req: Request) {
  const userId = await getUserId();
  if (!userId) return Response.json({ error: 'signed_out' }, { status: 401 });
  const limit = Math.min(50, Math.max(1, Number(new URL(req.url).searchParams.get('limit')) || 10));
  return Response.json(await getHistory(userId, limit), {
    headers: { 'Cache-Control': 'no-store' },
  });
}
