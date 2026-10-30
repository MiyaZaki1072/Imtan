import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';
import { getSession } from '@/lib/auth';
import { getOrderView } from '@/lib/orders/view';
import { OrderView } from './OrderView';

export default function OrderPage(props: PageProps<'/orders/[id]'>) {
  return (
    <Suspense fallback={<p className="px-4 pt-10 text-muted">กำลังโหลดคิว…</p>}>
      <Order {...props} />
    </Suspense>
  );
}

async function Order({ params }: PageProps<'/orders/[id]'>) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect(`/welcome?next=/orders/${id}`);
  // Only the owner can open an order; anything else is a 404.
  const order = /^[0-9a-f-]{36}$/.test(id) ? await getOrderView(id, session.userId) : null;
  if (!order) notFound();
  if (order.status === 'awaiting_payment') redirect(`/orders/${id}/pay`);
  return <OrderView initial={order} />;
}
