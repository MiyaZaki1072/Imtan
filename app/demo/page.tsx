import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { adminPageSession, vendorPageShop } from '@/lib/auth';
import { demoPaymentsEnabled } from '@/lib/payments';
import { createAdminClient } from '@/lib/supabase/admin';
import { DemoView } from './DemoView';

// Presenter view (PLAN.md §5d): a phone frame (customer app) beside the vendor board.
// Admin only, and 404 unless DEMO_PAYMENTS=true.
export default function DemoPage() {
  return (
    <Suspense fallback={<p className="px-4 pt-10 text-center text-muted">กำลังโหลด…</p>}>
      <DemoContent />
    </Suspense>
  );
}

async function DemoContent() {
  if (!demoPaymentsEnabled()) notFound();
  await adminPageSession();
  const { slug } = await vendorPageShop();
  const { data } = await createAdminClient()
    .from('shops')
    .select('id, slug, name, auto_advance')
    .order('name');
  const shops = (data ?? []).map((s) => ({
    id: s.id,
    slug: s.slug,
    name: s.name,
    autoAdvance: s.auto_advance,
  }));
  return <DemoView shops={shops} currentSlug={slug} />;
}
