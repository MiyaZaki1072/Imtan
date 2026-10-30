'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { btnLarge, btnPrimary, card, cx, input, label } from '@/components/ui';
import { adminLogin, vendorQuickLogin, type AdminLoginState } from './actions';

function ShopButton({ name, category }: { name: string; category: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={cx(
        card,
        'flex min-h-16 w-full items-center justify-between gap-3 px-4 py-3 text-left hover:border-primary/50 disabled:opacity-60',
      )}
    >
      <span>
        <span className="block font-semibold">{name}</span>
        <span className="block text-xs text-muted">{category}</span>
      </span>
      <span className="shrink-0 text-sm font-semibold text-primary">
        {pending ? 'กำลังเข้า…' : 'เข้าร้านนี้'}
      </span>
    </button>
  );
}

export function VendorShops({
  shops,
}: {
  shops: { slug: string; name: string; category: string }[];
}) {
  return (
    <ul className="mt-3 space-y-2">
      {shops.map((s) => (
        <li key={s.slug}>
          <form action={vendorQuickLogin}>
            <input type="hidden" name="slug" value={s.slug} />
            <ShopButton name={s.name} category={s.category} />
          </form>
        </li>
      ))}
    </ul>
  );
}

function AdminSubmit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={cx(btnPrimary, btnLarge)}>
      {pending ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}
    </button>
  );
}

export function AdminForm({ next }: { next: string }) {
  const [state, action] = useActionState<AdminLoginState, FormData>(adminLogin, { error: null });
  return (
    <form action={action} className="mt-3 space-y-3">
      <input type="hidden" name="next" value={next} />
      <div>
        <label htmlFor="username" className={label}>
          ชื่อผู้ใช้
        </label>
        <input
          id="username"
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          className={input}
        />
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
      {state.error && (
        <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
          {state.error}
        </p>
      )}
      <AdminSubmit />
    </form>
  );
}
