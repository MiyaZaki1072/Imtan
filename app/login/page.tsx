import Link from 'next/link';
import { btnLarge, btnPrimary, card, cx, input, label } from '@/components/ui';

// Phase 2: signs in <username>@imtan.local with Supabase Auth, then routes by role.
export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <section className={cx(card, 'w-full max-w-sm px-6 py-7')}>
        <p className="text-2xl font-bold text-primary">อิ่มทัน</p>
        <h1 className="mt-1 text-xl font-bold">เข้าสู่ระบบสำหรับร้านค้า</h1>
        <p className="mt-1 text-sm text-muted">บัญชีร้านค้าและผู้ดูแล · ลูกค้าไม่ต้องเข้าสู่ระบบ</p>
        <form action="/vendor" className="mt-5 space-y-4">
          <div>
            <label htmlFor="username" className={label}>
              ชื่อผู้ใช้
            </label>
            <input id="username" name="username" autoComplete="username" className={input} />
          </div>
          <div>
            <label htmlFor="password" className={label}>
              รหัสผ่าน
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              className={input}
            />
          </div>
          <button type="submit" className={cx(btnPrimary, btnLarge)}>
            เข้าสู่ระบบ
          </button>
        </form>
        <Link href="/" className="mt-4 inline-flex min-h-11 items-center text-sm text-primary">
          ไปหน้าลูกค้า
        </Link>
      </section>
    </main>
  );
}
