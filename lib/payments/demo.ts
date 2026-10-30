import 'server-only';

import { createAdminClient } from '../supabase/admin';
import type { PaymentProvider, PaymentStatus } from './types';

/** Demo payments exist only when DEMO_PAYMENTS=true; everything else returns 404. */
export function demoPaymentsEnabled(): boolean {
  return process.env.DEMO_PAYMENTS === 'true';
}

export const demoProvider: PaymentProvider = {
  id: 'demo',

  async createPayment(order) {
    // insert_order() already wrote the pending `payments` row (method 'demo').
    return { reference: `demo-${order.id}` };
  },

  async getStatus(orderId) {
    const { data } = await createAdminClient()
      .from('payments')
      .select('status')
      .eq('order_id', orderId)
      .maybeSingle();
    return (data?.status as PaymentStatus | undefined) ?? null;
  },
};

/** The fake "ชำระเงิน (จำลอง)": confirm_payment() assigns the queue number in SQL. */
export async function confirmDemoPayment(orderId: string) {
  const { data, error } = await createAdminClient().rpc('confirm_payment', {
    p_order_id: orderId,
    p_method: 'demo',
  });
  if (error) throw new Error(error.message);
  return data;
}
