import { getSession } from '@/lib/auth';
import { getHomeData } from '@/lib/home';

export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ error: 'signed_out' }, { status: 401 });
  return Response.json(await getHomeData(session.userId), {
    headers: { 'Cache-Control': 'no-store' },
  });
}
