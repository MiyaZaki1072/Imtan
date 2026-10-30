import Link from 'next/link';
import { Suspense } from 'react';
import { adminPageSession } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { ShopsManager } from './ShopsManager';

// Admin app: create shops with a vendor login, reset passwords, jump into any shop's editors.
export default function AdminShopsPage() {
  return (
    <Suspense fallback={<p className="px-4 pt-10 text-center text-muted">กำลังโหลด…</p>}>
      <AdminShops />
    </Suspense>
  );
}

async function AdminShops() {
  await adminPageSession();
  const db = createAdminClient();
  const [{ data: shops }, { data: vendors }] = await Promise.all([
    db.from('shops').select('id, slug, name, category, queue_prefix, is_open').order('name'),
    db.from('profiles').select('shop_id').eq('role', 'vendor'),
  ]);
  const withAccount = new Set((vendors ?? []).map((v) => v.shop_id));
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-10">
      <Link href="/admin" className="text-sm font-semibold text-primary">
        ← กลับหน้าผู้ดูแล
      </Link>
      <h1 className="mt-1 text-2xl font-bold">ร้านและบัญชีร้านค้า</h1>
      <ShopsManager
        shops={(shops ?? []).map((s) => ({
          id: s.id,
          slug: s.slug,
          name: s.name,
          category: s.category,
          queuePrefix: s.queue_prefix,
          isOpen: s.is_open,
          hasAccount: withAccount.has(s.id),
        }))}
      />
    </main>
  );
}
