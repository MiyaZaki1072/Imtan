import { getUserId } from '@/lib/auth';
import { getHomeData } from '@/lib/home';

export async function GET() {
  const userId = await getUserId();
  if (!userId) return Response.json({ error: 'signed_out' }, { status: 401 });
  return Response.json(await getHomeData(userId), {
    headers: { 'Cache-Control': 'no-store' },
  });
}
