import { AuthError } from '@/lib/auth-rules';
import { requireVendor } from '@/lib/auth';
import { getVendorBoard } from '@/lib/vendor/board';

// The board's open orders, fresh. Only that shop's vendor (or an admin) can read it.
export async function GET(req: Request) {
  const shopId = new URL(req.url).searchParams.get('shopId') ?? '';
  try {
    await requireVendor(shopId);
  } catch (e) {
    if (e instanceof AuthError) {
      return Response.json({ error: e.reason }, { status: e.reason === 'signed_out' ? 401 : 403 });
    }
    throw e;
  }
  const board = await getVendorBoard(shopId);
  if (!board) return Response.json({ error: 'not_found' }, { status: 404 });
  return Response.json(board, { headers: { 'Cache-Control': 'no-store' } });
}
