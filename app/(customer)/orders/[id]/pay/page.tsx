import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';
import { getSession } from '@/lib/auth';
import { getOrderView } from '@/lib/orders/view';
import { demoPaymentsEnabled } from '@/lib/payments';
import { PayView } from './PayView';

export default function PayPage(props: PageProps<'/orders/[id]/pay'>) {
  return (
    <Suspense fallback={<p className="px-4 pt-10 text-muted">กำลังโหลด…</p>}>
      <Pay {...props} />
    </Suspense>
  );
}

async function Pay({ params }: PageProps<'/orders/[id]/pay'>) {
  // Demo payment screens are 404 unless DEMO_PAYMENTS=true.
  if (!demoPaymentsEnabled()) notFound();
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect(`/welcome?next=/orders/${id}/pay`);
  const order = /^[0-9a-f-]{36}$/.test(id) ? await getOrderView(id, session.userId) : null;
  if (!order || order.totalSatang === null) notFound();
  // Paid, expired or abandoned orders belong on the order page.
  if (order.status !== 'awaiting_payment') redirect(`/orders/${id}`);
  return <PayView initial={order} />;
}
