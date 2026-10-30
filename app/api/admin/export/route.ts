import { AuthError, requireAdmin } from '@/lib/auth';
import { toCsv } from '@/lib/csv';
import { createAdminClient } from '@/lib/supabase/admin';

// CSV for WS 8.2 and the professor: events or orders, UTF-8 with BOM so Thai opens correctly.
const EVENT_COLUMNS = ['id', 'at', 'actor_role', 'user_id', 'shop_id', 'order_id', 'name', 'props'];
const ORDER_COLUMNS = [
  'id',
  'shop',
  'queue_label',
  'customer_name',
  'source',
  'status',
  'item_count',
  'total_baht',
  'created_at',
  'paid_at',
  'started_at',
  'ready_at',
  'picked_up_at',
  'picked_up_by',
  'cancelled_at',
  'cancel_reason',
  'feedback',
  'estimated_wait_seconds',
  'allergy_note',
];
const MAX_ROWS = 50_000;

export async function GET(req: Request) {
  try {
    await requireAdmin();
  } catch (e) {
    if (e instanceof AuthError) {
      return Response.json({ error: e.reason }, { status: e.reason === 'signed_out' ? 401 : 403 });
    }
    throw e;
  }

  const type = new URL(req.url).searchParams.get('type');
  const db = createAdminClient();
  let csv: string;
  if (type === 'events') {
    const { data } = await db.from('events').select('*').order('id').limit(MAX_ROWS);
    csv = toCsv(EVENT_COLUMNS, data ?? []);
  } else if (type === 'orders') {
    const { data } = await db
      .from('orders')
      .select('*, shops(name)')
      .order('created_at')
      .limit(MAX_ROWS);
    csv = toCsv(
      ORDER_COLUMNS,
      (data ?? []).map((o) => ({
        ...o,
        shop: o.shops?.name,
        total_baht: o.total_satang === null ? null : o.total_satang / 100,
      })),
    );
  } else {
    return Response.json({ error: 'bad_type' }, { status: 400 });
  }

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="imtan-${type}-${stamp}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
