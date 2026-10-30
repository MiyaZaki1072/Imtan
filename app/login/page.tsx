import Link from 'next/link';
import { Suspense } from 'react';
import { card, cx } from '@/components/ui';
import { getShops } from '@/lib/demo-data/load';
import { AdminForm, VendorShops } from './LoginForms';

const ERRORS: Record<string, string> = {
  shop: 'ไม่พบร้านนี้',
  vendor: 'เข้าร้านไม่สำเร็จ ลองใหม่อีกครั้ง',
};

export default function LoginPage(props: PageProps<'/login'>) {
  return (
    <Suspense>
      <Login {...props} />
    </Suspense>
  );
}

async function Login({ searchParams }: PageProps<'/login'>) {
  const params = await searchParams;
  const error = typeof params.error === 'string' ? ERRORS[params.error] : undefined;
  const next = typeof params.next === 'string' ? params.next : '/admin';
  const shops = getShops().map(({ slug, name, category }) => ({ slug, name, category }));

  return (
    <main className="flex flex-1 justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <p className="text-2xl font-bold text-primary">อิ่มทัน</p>
        <h1 className="mt-1 text-xl font-bold">สำหรับร้านค้า</h1>
        <p className="mt-1 text-sm text-muted">ลูกค้าไม่ต้องเข้าสู่ระบบ</p>

        {error && (
          <p role="alert" className="mt-4 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
            {error}
          </p>
        )}

        <section className="mt-6" aria-labelledby="shops-title">
          <h2 id="shops-title" className="font-bold">
            เลือกร้านของคุณ
          </h2>
          <p className="text-sm text-muted">กดชื่อร้านเพื่อเปิดกระดานออเดอร์ ไม่ต้องใช้รหัสผ่าน</p>
          <VendorShops shops={shops} />
        </section>

        <section className={cx(card, 'mt-8 px-5 py-5')} aria-labelledby="admin-title">
          <h2 id="admin-title" className="font-bold">
            ผู้ดูแลระบบ
          </h2>
          <AdminForm next={next.startsWith('/vendor') ? '/admin' : next} />
        </section>

        <Link href="/" className="mt-4 inline-flex min-h-11 items-center text-sm text-primary">
          ไปหน้าลูกค้า
        </Link>
      </div>
    </main>
  );
}
