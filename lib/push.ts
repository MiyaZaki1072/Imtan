import 'server-only';

import webpush from 'web-push';
import { createAdminClient } from './supabase/admin';

// Web Push on top of the in-page alert (PLAN.md §5). A push that fails never fails the
// status change that triggered it: every caller awaits notifyOrderReady(), which never throws.

let configured = false;
function configure(): boolean {
  const subject = process.env.VAPID_SUBJECT;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!subject || !publicKey || !privateKey) return false;
  if (!configured) {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    configured = true;
  }
  return true;
}

interface Payload {
  title: string;
  body: string;
  url: string;
  tag: string;
}

/** Sends to every device the user subscribed. Returns counts; removes dead subscriptions. */
export async function sendPushToUser(
  userId: string,
  payload: Payload,
  ctx: { shopId: string | null; orderId: string | null },
): Promise<{ sent: number; failed: number }> {
  const db = createAdminClient();
  if (!configure()) return { sent: 0, failed: 0 };
  const { data: subs } = await db
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', userId);

  let sent = 0;
  let failed = 0;
  await Promise.all(
    (subs ?? []).map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload),
          { TTL: 600, urgency: 'high', timeout: 4000 },
        );
        sent++;
        await db.from('events').insert({
          name: 'push_sent',
          shop_id: ctx.shopId,
          order_id: ctx.orderId,
          user_id: userId,
          actor_role: 'vendor',
        });
      } catch (e) {
        failed++;
        const status = (e as { statusCode?: number }).statusCode;
        // 404/410: the browser dropped this subscription.
        if (status === 404 || status === 410) {
          await db.from('push_subscriptions').delete().eq('id', sub.id);
        }
        await db.from('events').insert({
          name: 'push_failed',
          shop_id: ctx.shopId,
          order_id: ctx.orderId,
          user_id: userId,
          actor_role: 'vendor',
          props: { status: status ?? null },
        });
      }
    }),
  );
  return { sent, failed };
}

/** "อาหารพร้อมแล้ว" (or "เรียกซ้ำ") push for one order. Never throws. */
export async function notifyOrderReady(orderId: string, recall: boolean): Promise<void> {
  try {
    const { data: o } = await createAdminClient()
      .from('orders')
      .select('id, shop_id, customer_id, queue_label, shops(name)')
      .eq('id', orderId)
      .maybeSingle();
    if (!o?.customer_id || !o.queue_label) return;
    await sendPushToUser(
      o.customer_id,
      {
        title: recall ? 'อิ่มทัน · เรียกซ้ำ' : 'อิ่มทัน · อาหารพร้อมแล้ว',
        body: recall
          ? `คิว ${o.queue_label} ยังไม่มารับ ไปรับที่ ${o.shops?.name ?? 'ร้าน'} ได้เลย`
          : `คิว ${o.queue_label} อาหารพร้อมแล้ว! ไปรับที่ ${o.shops?.name ?? 'ร้าน'} ได้เลย`,
        url: `/orders/${o.id}`,
        tag: `order-${o.id}`,
      },
      { shopId: o.shop_id, orderId: o.id },
    );
  } catch (e) {
    console.error('notifyOrderReady failed:', e);
  }
}
